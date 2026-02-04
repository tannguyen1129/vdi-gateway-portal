import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import * as crypto from 'crypto';
import * as net from 'net';

// [CẤU HÌNH]
const MY_SECRET_KEY = process.env.VDI_SECRET_KEY ?? '';
const MY_SECRET_KEY_BYTES = MY_SECRET_KEY 
  ? crypto.createHash('sha256').update(MY_SECRET_KEY).digest() 
  : Buffer.alloc(32); 

const GUACD_HOST = 'guacd'; 
const GUACD_PORT = 4822;
// QUAN TRỌNG: Mặc định dùng port 3000 nếu không có biến môi trường
const API_PORT = parseInt(process.env.PORT || '3000', 10);

async function bootstrap() {
  console.log('🚀 [STARTUP] Đang khởi động Backend trên Port ' + API_PORT);
  
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  
  app.use((req, res, next) => {
    // Log request để debug
    // console.log(`📥 [HTTP] ${req.method} ${req.originalUrl}`);
    next();
  });

  app.enableCors({ 
    origin: true, 
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  });

  await app.listen(API_PORT);
  console.log(`✅ [STARTUP] Backend API đang chạy tại: http://localhost:${API_PORT}`);

  const server = app.getHttpServer();
  
  // WebSocket Server cho VDI (Guacamole)
  const wss = new WebSocketServer({
    noServer: true,
    path: '/guaclite'
  });

  // Xử lý logic VDI
  wss.on('connection', (ws, req) => {
    console.log(`🔌 [VDI] Client Connected! URL: ${req.url}`);

    let connectionSettings: any = null;
    let guacClient: net.Socket | null = null;
    let handshakeState: 'WAITING_ARGS' | 'WAITING_READY' | 'READY' = 'WAITING_ARGS';
    let buffer = '';

    try {
      const urlString = req.url.startsWith('/') ? `http://localhost${req.url}` : req.url;
      const urlObj = new URL(urlString);
      const token = urlObj.searchParams.get('token');
      const widthParam = urlObj.searchParams.get('width');
      const heightParam = urlObj.searchParams.get('height');
      const dpiParam = urlObj.searchParams.get('dpi');

      if (!token) {
          console.warn('⚠️ [VDI] Missing token');
          ws.close(1008, 'Missing Token');
          return;
      }
      
      const clientOptions = JSON.parse(Buffer.from(token, 'base64').toString());
      const iv = Buffer.from(clientOptions.iv, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', MY_SECRET_KEY_BYTES, iv);
      let decrypted = decipher.update(clientOptions.value, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      connectionSettings = JSON.parse(decrypted);

      if (connectionSettings?.connection?.settings) {
        if (widthParam) connectionSettings.connection.settings.width = widthParam;
        if (heightParam) connectionSettings.connection.settings.height = heightParam;
        if (dpiParam) connectionSettings.connection.settings.dpi = dpiParam;
      }
      console.log(`✅ [VDI] Target VM: ${connectionSettings.connection.settings.hostname}`);
    } catch (e) {
      console.error('❌ [VDI] Token Error:', e.message);
      ws.close(1008, 'Invalid Token');
      return;
    }

    // Kết nối Guacd
    guacClient = net.createConnection(GUACD_PORT, GUACD_HOST);

    guacClient.on('connect', () => {
      const protocol = connectionSettings.connection.type || 'rdp';
      guacClient.write(`6.select,${protocol.length}.${protocol};`);
    });

    guacClient.on('error', (err) => {
        console.error('🔥 [VDI] Guacd Error:', err.message);
        ws.close(1011, 'Guacd Error');
    });

    guacClient.on('data', (dataBuffer) => {
      const msgString = dataBuffer.toString('utf8');
      if (handshakeState === 'READY') {
        ws.send(msgString);
        return;
      }
      buffer += msgString;

      if (buffer.indexOf('5.error') !== -1) {
          console.error('❌ [VDI] Guacd Handshake Failed');
          ws.close(1011, 'Guacd Handshake Error');
          return;
      }

      if (handshakeState === 'WAITING_ARGS') {
        const argsIdx = buffer.indexOf('4.args');
        const endIdx = buffer.indexOf(';', argsIdx);
        if (argsIdx !== -1 && endIdx !== -1) {
          const argsCmd = buffer.substring(argsIdx, endIdx + 1);
          buffer = buffer.substring(endIdx + 1);
          const currentIdx = argsCmd.indexOf(',') + 1;
          const argNames = argsCmd.substring(currentIdx, argsCmd.length - 1).split(',').map(s => s.substring(s.indexOf('.') + 1));

          const settings = connectionSettings.connection.settings;
          const width = String(settings.width || '1024');
          const height = String(settings.height || '768');
          const dpi = String(settings.dpi || '96');

          guacClient.write(`4.size,${width.length}.${width},${height.length}.${height},${dpi.length}.${dpi};`);
          guacClient.write(`5.audio,9.audio/ogg;`);
          guacClient.write(`5.image,9.image/png;`);

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

      if (handshakeState === 'WAITING_READY') {
        if (buffer.indexOf('5.ready') !== -1) {
           console.log('🎉 [VDI] Tunnel READY!');
           handshakeState = 'READY';
           ws.send(buffer);
           buffer = '';
        }
      }
    });

    ws.on('message', (msg) => {
      if (handshakeState === 'READY' && guacClient) guacClient.write(msg as Buffer);
    });

    ws.on('close', () => {
        if (guacClient) guacClient.end();
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    if (url.startsWith('/guaclite')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Để Socket.io tự xử lý các url khác
  });
}
bootstrap();