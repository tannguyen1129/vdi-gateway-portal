import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import * as crypto from 'crypto';
import * as net from 'net';

// [CẤU HÌNH]
const MY_SECRET_KEY = process.env.VDI_SECRET_KEY ?? '';
if (!MY_SECRET_KEY) throw new Error("Missing VDI_SECRET_KEY");
const MY_SECRET_KEY_BYTES = crypto.createHash('sha256').update(MY_SECRET_KEY).digest();

const GUAC_PREFER_JPEG = (process.env.GUAC_PREFER_JPEG || '').toLowerCase() === 'true';
const GUACD_HOST = 'guacd'; // Đảm bảo tên service trong docker-compose là 'guacd'
const GUACD_PORT = 4822;
const API_PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  await app.listen(API_PORT);
  console.log(`✅ Backend API running on port ${API_PORT}`);

  const server = app.getHttpServer();
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      if (protocols.has('guacamole')) return 'guacamole';
      const first = protocols.values().next().value;
      return first ?? false;
    },
  });

  // Xử lý WebSocket VDI
  wss.on('connection', (ws, req) => {
    console.log(`🔌 [VDI] New Connection Request: ${req.url}`);

    let connectionSettings: any = null;
    let guacClient: net.Socket | null = null;
    let handshakeState: 'WAITING_ARGS' | 'WAITING_READY' | 'READY' = 'WAITING_ARGS';
    let buffer = '';

    // 1. Giải mã Token
    try {
      const urlString = req.url.startsWith('/') ? `http://localhost${req.url}` : req.url;
      const urlObj = new URL(urlString);
      const token = urlObj.searchParams.get('token');
      const widthParam = urlObj.searchParams.get('width');
      const heightParam = urlObj.searchParams.get('height');
      const dpiParam = urlObj.searchParams.get('dpi');

      if (!token) throw new Error("No token provided");
      
      const clientOptions = JSON.parse(Buffer.from(token, 'base64').toString());
      const iv = Buffer.from(clientOptions.iv, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', MY_SECRET_KEY_BYTES, iv);
      let decrypted = decipher.update(clientOptions.value, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      connectionSettings = JSON.parse(decrypted);

      // Override kích thước
      if (connectionSettings?.connection?.settings) {
        if (widthParam) connectionSettings.connection.settings.width = widthParam;
        if (heightParam) connectionSettings.connection.settings.height = heightParam;
        if (dpiParam) connectionSettings.connection.settings.dpi = dpiParam;
      }
      console.log(`✅ [VDI] Token Decrypted. Target VM: ${connectionSettings.connection.settings.hostname}`);
    } catch (e) {
      console.error('❌ [VDI] Token Invalid:', e.message);
      ws.close(1008, 'Invalid Token');
      return;
    }

    // 2. Kết nối tới Guacd
    console.log(`➡️ [VDI] Connecting to Guacd (${GUACD_HOST}:${GUACD_PORT})...`);
    guacClient = net.createConnection(GUACD_PORT, GUACD_HOST);

    // Timeout nếu Guacd không phản hồi sau 10s
    guacClient.setTimeout(10000);
    guacClient.on('timeout', () => {
        console.error('🔥 [VDI] Guacd Connection Timeout!');
        guacClient.destroy();
        ws.close(1011, 'Guacd Timeout');
    });

    guacClient.on('connect', () => {
      console.log('✅ [VDI] Connected to Guacd! Sending Handshake...');
      const protocol = connectionSettings.connection.type || 'rdp';
      // Gửi handshake chọn giao thức (Step 1)
      guacClient.write(`6.select,${protocol.length}.${protocol};`);
    });

    guacClient.on('error', (err) => {
        console.error('🔥 [VDI] Guacd Socket Error:', err.message);
        ws.close();
    });

    // 3. Xử lý dữ liệu từ Guacd
    guacClient.on('data', (dataBuffer) => {
      const msgString = dataBuffer.toString('utf8');
      
      // Nếu đã Ready, truyền thẳng (Fast path)
      if (handshakeState === 'READY') {
        ws.send(msgString);
        return;
      }

      buffer += msgString;

      // [DEBUG] Log handshake packet
      // console.log(`📩 [VDI] Guacd Packet: ${msgString.substring(0, 50)}...`);

      // Xử lý lỗi từ Guacd (VD: 5.error...)
      if (buffer.indexOf('5.error') !== -1) {
          console.error('❌ [VDI] Guacd sent ERROR during handshake:', buffer);
          ws.close(1011, 'Guacd Error');
          return;
      }

      // Step 2: Nhận Arguments (4.args...)
      if (handshakeState === 'WAITING_ARGS') {
        const argsIdx = buffer.indexOf('4.args');
        const endIdx = buffer.indexOf(';', argsIdx);
        
        if (argsIdx !== -1 && endIdx !== -1) {
          console.log('✅ [VDI] Received ARGS from Guacd. Configuring connection...');
          const argsCmd = buffer.substring(argsIdx, endIdx + 1);
          buffer = buffer.substring(endIdx + 1); // Cắt buffer

          const currentIdx = argsCmd.indexOf(',') + 1;
          const argNames = argsCmd.substring(currentIdx, argsCmd.length - 1).split(',').map((s) => {
             const dotIdx = s.indexOf('.');
             return s.substring(dotIdx + 1);
          });

          const settings = connectionSettings.connection.settings;
          const width = String(settings.width || '1024');
          const height = String(settings.height || '768');
          const dpi = String(settings.dpi || '96');

          // Phản hồi size/audio/video
          guacClient.write(`4.size,${width.length}.${width},${height.length}.${height},${dpi.length}.${dpi};`);
          guacClient.write(`5.audio,9.audio/ogg;`);
          guacClient.write(`5.image,9.image/png;`); // Force PNG cho ổn định

          // Gửi lệnh Connect (Step 3)
          let connectOp = '7.connect';
          argNames.forEach((arg) => {
            const val = String(settings[arg] || '');
            connectOp += `,${val.length}.${val}`;
          });
          connectOp += ';';
          guacClient.write(connectOp);

          handshakeState = 'WAITING_READY';
        }
      }

      // Step 4: Đợi Ready (5.ready...)
      if (handshakeState === 'WAITING_READY') {
        if (buffer.indexOf('5.ready') !== -1) {
           console.log('🎉 [VDI] Handshake Complete! Tunnel established.');
           handshakeState = 'READY';
           ws.send(buffer);
           buffer = '';
        }
      }
    });

    // 4. Browser -> Guacd
    ws.on('message', (msg) => {
      if (handshakeState === 'READY' && guacClient) {
        guacClient.write(msg as Buffer);
      }
    });

    ws.on('close', () => {
        console.log('🔌 [VDI] Client Disconnected.');
        if (guacClient) guacClient.end();
    });
    
    if (guacClient) {
        guacClient.on('end', () => ws.close());
    }
  });

  // Bắt sự kiện Upgrade thủ công cho đường dẫn /guaclite
  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    if (url.startsWith('/guaclite')) {
      // Upgrade request for VDI WebSocket
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });
}
bootstrap();
