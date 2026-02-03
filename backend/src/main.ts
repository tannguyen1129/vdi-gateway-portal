import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import * as crypto from 'crypto';
import * as net from 'net';

// [CẤU HÌNH]
const MY_SECRET_KEY = process.env.VDI_SECRET_KEY ?? '';
if (!MY_SECRET_KEY) throw new Error("Missing VDI_SECRET_KEY");
// AES-256-CBC yêu cầu key 32 bytes
const MY_SECRET_KEY_BYTES = crypto.createHash('sha256').update(MY_SECRET_KEY).digest();
const GUAC_PREFER_JPEG = (process.env.GUAC_PREFER_JPEG || '').toLowerCase() === 'true';
const GUACD_HOST = 'guacd';
const GUACD_PORT = 4822;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  const server = app.getHttpServer();
  
  // WebSocket Server chạy chung port 3000
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    console.log('🔌 [VDI] Client connected (Port 3000)!');

    let connectionSettings: any = null;
    let guacClient: net.Socket | null = null;
    let handshakeState: 'WAITING_ARGS' | 'WAITING_READY' | 'READY' = 'WAITING_ARGS';

    // 1. Giải mã Token
    try {
      // Lấy token từ URL (hỗ trợ cả /guaclite?token=... và /?token=...)
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

      // Override kích thước nếu client gửi lên (đảm bảo full màn hình)
      if (connectionSettings?.connection?.settings) {
        if (widthParam) connectionSettings.connection.settings.width = widthParam;
        if (heightParam) connectionSettings.connection.settings.height = heightParam;
        if (dpiParam) connectionSettings.connection.settings.dpi = dpiParam;
      }
      console.log(`✅ [VDI] Target: ${connectionSettings.connection.settings.hostname}`);
    } catch (e) {
      console.error('❌ [VDI] Token Error:', e.message);
      ws.close(1008, 'Invalid Token');
      return;
    }

    // 2. Kết nối tới Guacd (TCP)
    guacClient = net.createConnection(GUACD_PORT, GUACD_HOST);

    guacClient.on('connect', () => {
      const protocol = connectionSettings.connection.type || 'rdp';
      // Gửi handshake chọn giao thức
      guacClient?.write(`6.select,${protocol.length}.${protocol};`);
    });

    guacClient.on('error', (err) => {
        console.error('🔥 [VDI] Guacd Error:', err.message);
        ws.close();
    });

    // 3. Xử lý dữ liệu từ Guacd -> Browser
    guacClient.on('data', (dataBuffer) => {
      // Guacamole protocol là UTF-8 text, cần giữ đúng ký tự để length chuẩn
      const msgString = dataBuffer.toString('utf8');

      if (handshakeState === 'READY') {
        ws.send(msgString);
        return;
      }

      if (handshakeState === 'WAITING_ARGS' && msgString.startsWith('4.args')) {
        const currentIdx = msgString.indexOf(',') + 1;
        const argNames = msgString
          .substring(currentIdx)
          .split(',')
          .map((s) => {
            const dotIdx = s.indexOf('.');
            return s.substring(dotIdx + 1).replace(';', '');
          });

        const settings = connectionSettings.connection.settings;
        const width = String(settings.width || '1024');
        const height = String(settings.height || '768');
        const dpi = String(settings.dpi || '96');

        guacClient?.write(
          `4.size,${width.length}.${width},${height.length}.${height},${dpi.length}.${dpi};`,
        );
        guacClient?.write(`5.audio,9.audio/ogg;`);
        if (GUAC_PREFER_JPEG) {
          // Ưu tiên JPEG để giảm băng thông, vẫn giữ PNG làm fallback
          guacClient?.write(`5.image,10.image/jpeg;`);
          guacClient?.write(`5.image,9.image/png;`);
        } else {
          // Mặc định PNG để đảm bảo tương thích hiển thị
          guacClient?.write(`5.image,9.image/png;`);
        }

        let connectOp = '7.connect';
        argNames.forEach((arg) => {
          const val = String(settings[arg] || '');
          connectOp += `,${val.length}.${val}`;
        });
        connectOp += ';';
        guacClient?.write(connectOp);

        handshakeState = 'WAITING_READY';
        return;
      }

      if (handshakeState === 'WAITING_READY' && msgString.startsWith('5.ready')) {
        console.log('✅ [VDI] Handshake Complete!');
        handshakeState = 'READY';
        // Gửi gói ready dạng text để Client JS nhận diện được
        ws.send(msgString);
      }
    });

    // 4. Browser -> Guacd
    ws.on('message', (msg) => {
      if (handshakeState === 'READY' && guacClient) {
        // Dữ liệu từ Browser lên thường là text opcode, gửi thẳng ok
        guacClient.write(msg as Buffer);
      }
    });

    ws.on('close', () => {
        if (guacClient) guacClient.end();
    });
    
    if (guacClient) {
        guacClient.on('end', () => ws.close());
    }
  });

  // --- BẮT ĐƯỜNG DẪN /guaclite ---
  server.on('upgrade', (request, socket, head) => {
      // Chỉ xử lý nếu URL bắt đầu bằng /guaclite
      if (request.url.startsWith('/guaclite')) {
          wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
          });
      }
  });

  await app.listen(3000);
  console.log(`✅ VDI Portal Backend running on port 3000/api`);
}
bootstrap();
