import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import * as crypto from 'crypto';
import * as net from 'net';
import { IncomingMessage } from 'http';

// [CẤU HÌNH]
const MY_SECRET_KEY = process.env.VDI_SECRET_KEY ?? 'secret_key_phai_duoc_thay_doi';
// Tạo Buffer 32 bytes từ key để dùng cho AES-256
const MY_SECRET_KEY_BYTES = crypto
  .createHash('sha256')
  .update(MY_SECRET_KEY)
  .digest();

// Trong Docker Compose, service name là 'guacd'
const GUACD_HOST = process.env.GUACD_HOST || 'guacd';
const GUACD_PORT = parseInt(process.env.GUACD_PORT || '4822', 10);
const API_PORT = parseInt(process.env.PORT || '3000', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Cấu hình Prefix API
  app.setGlobalPrefix('api');

  // Cấu hình CORS để Frontend gọi được API (HTTP)
  app.enableCors({
    origin: true, // Cho phép tất cả origin (Development), nên set cụ thể khi Prod
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Khởi động HTTP Server
  await app.listen(API_PORT);
  console.log(`🚀 [STARTUP] Backend đang chạy tại port: ${API_PORT}`);
  console.log(`🔗 [VDI] Kết nối Guacd tại: ${GUACD_HOST}:${GUACD_PORT}`);

  // --- WEBSOCKET SERVER (GUACAMOLE PROXY) ---
  // Lấy instance của HTTP Server gốc để lắng nghe sự kiện upgrade
  const server = app.getHttpServer();

  // Tạo WebSocket Server (No Server mode - để tự handle upgrade)
  const wss = new WebSocketServer({
    noServer: true,
    path: '/guaclite',
  });

  // Xử lý sự kiện upgrade từ HTTP -> WebSocket
  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = request.url || '';
    
    // Chỉ bắt connection tới đường dẫn /guaclite
    if (url.startsWith('/guaclite')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Các đường dẫn khác (ví dụ Socket.io của NestJS) sẽ được NestJS tự xử lý,
    // không được socket.destroy() ở đây nếu dùng song song với Gateway khác.
  });

  // --- LOGIC XỬ LÝ KẾT NỐI VDI ---
  wss.on('connection', (ws, req) => {
    // console.log(`🔌 [VDI] Client kết nối từ: ${req.socket.remoteAddress}`);

    let connectionSettings: any = null;
    let guacClient: net.Socket | null = null;
    let handshakeState: 'WAITING_ARGS' | 'WAITING_READY' | 'READY' = 'WAITING_ARGS';
    let buffer = '';

    // 1. Giải mã Token từ URL
    try {
      // Hacky way để parse URL query params
      const urlString = req.url?.startsWith('/') ? `http://localhost${req.url}` : req.url || '';
      const urlObj = new URL(urlString);
      
      const token = urlObj.searchParams.get('token');
      const widthParam = urlObj.searchParams.get('width');
      const heightParam = urlObj.searchParams.get('height');
      const dpiParam = urlObj.searchParams.get('dpi');

      if (!token) {
        console.warn('⚠️ [VDI] Thiếu Token kết nối');
        ws.close(1008, 'Missing Token');
        return;
      }

      // Decrypt Token (Format: { iv: base64, value: base64 })
      const clientOptions = JSON.parse(Buffer.from(token, 'base64').toString());
      const iv = Buffer.from(clientOptions.iv, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', MY_SECRET_KEY_BYTES, iv);
      
      let decrypted = decipher.update(clientOptions.value, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      connectionSettings = JSON.parse(decrypted);

      // Override kích thước màn hình từ Client gửi lên
      if (connectionSettings?.connection?.settings) {
        if (widthParam) connectionSettings.connection.settings.width = widthParam;
        if (heightParam) connectionSettings.connection.settings.height = heightParam;
        if (dpiParam) connectionSettings.connection.settings.dpi = dpiParam;
      }

      console.log(`✅ [VDI] Đã xác thực token. Target: ${connectionSettings.connection.settings.hostname}`);

    } catch (e: any) {
      console.error('❌ [VDI] Lỗi giải mã Token:', e.message);
      ws.close(1008, 'Invalid Token');
      return;
    }

    // 2. Kết nối tới Guacd (TCP)
    guacClient = net.createConnection(GUACD_PORT, GUACD_HOST);

    // Xử lý lỗi kết nối Guacd
    guacClient.on('error', (err) => {
      console.error('🔥 [VDI] Guacd Error:', err.message);
      ws.close(1011, 'Guacd connection error');
    });

    // Khi đóng kết nối Guacd -> đóng luôn WS client
    guacClient.on('close', () => {
      ws.close();
    });

    // 3. Handshake Guacamole Protocol
    guacClient.on('connect', () => {
      // Bước 1: Gửi lệnh select protocol (rdp, vnc, ssh...)
      const protocol = connectionSettings.connection.type || 'rdp';
      guacClient?.write(`${protocol.length}.select,${protocol.length}.${protocol};`);
    });

    guacClient.on('data', (dataBuffer) => {
      const msgString = dataBuffer.toString('utf8');

      // Nếu đã xong handshake, forward toàn bộ data sang WebSocket cho Client
      if (handshakeState === 'READY') {
        ws.send(msgString);
        return;
      }

      // Đưa vào buffer để xử lý handshake
      buffer += msgString;

      // Kiểm tra lỗi từ Guacd
      if (buffer.indexOf('5.error') !== -1) {
        console.error('❌ [VDI] Guacd trả về lỗi trong quá trình handshake');
        ws.close(1011, 'Guacd Handshake Error');
        return;
      }

      // Bước 2: Nhận yêu cầu args từ Guacd
      if (handshakeState === 'WAITING_ARGS') {
        const argsIdx = buffer.indexOf('4.args');
        const endIdx = buffer.indexOf(';', argsIdx);
        
        if (argsIdx !== -1 && endIdx !== -1) {
          // Trích xuất danh sách tham số (hostname, port, width, height...)
          const argsCmd = buffer.substring(argsIdx, endIdx + 1);
          buffer = buffer.substring(endIdx + 1); // Xóa phần đã xử lý khỏi buffer
          
          const currentIdx = argsCmd.indexOf(',') + 1;
          const argContent = argsCmd.substring(currentIdx, argsCmd.length - 1);
          
          // Parse mảng args: 4.args,8.hostname,4.port; -> ['hostname', 'port']
          const argNames = argContent.split(',').map(s => {
             const dotIdx = s.indexOf('.');
             return s.substring(dotIdx + 1);
          });

          // Chuẩn bị lệnh connect
          const settings = connectionSettings.connection.settings;
          
          // Gửi kích thước màn hình
          const width = String(settings.width || '1024');
          const height = String(settings.height || '768');
          const dpi = String(settings.dpi || '96');
          
          guacClient?.write(`4.size,${width.length}.${width},${height.length}.${height},${dpi.length}.${dpi};`);
          guacClient?.write(`5.audio,9.audio/ogg;`);
          guacClient?.write(`5.image,9.image/png;`);

          // Gửi lệnh connect với các tham số tương ứng
          let connectOp = '7.connect';
          argNames.forEach((arg) => {
            const val = String(settings[arg] || '');
            connectOp += `,${val.length}.${val}`;
          });
          connectOp += ';';
          
          guacClient?.write(connectOp);
          handshakeState = 'WAITING_READY';
        }
      }

      // Bước 3: Đợi tín hiệu ready
      if (handshakeState === 'WAITING_READY') {
        // Tìm lệnh ready (5.ready,...)
        if (buffer.indexOf('5.ready') !== -1) {
          console.log('🎉 [VDI] Tunnel READY! Bắt đầu stream hình ảnh.');
          handshakeState = 'READY';
          
          // Gửi phần buffer còn dư (nếu có dữ liệu hình ảnh đi kèm lệnh ready) cho Client
          if (buffer.length > 0) {
             ws.send(buffer);
             buffer = '';
          }
        }
      }
    });

    // 4. Forward dữ liệu từ Client -> Guacd
    ws.on('message', (msg) => {
      if (handshakeState === 'READY' && guacClient) {
        // ws gửi buffer hoặc string, guacClient.write chấp nhận cả hai
        guacClient.write(msg as any);
      }
    });

    // 5. Cleanup khi Client ngắt kết nối
    ws.on('close', () => {
      // console.log('👋 [VDI] Client Disconnected');
      if (guacClient) {
        guacClient.end();
        guacClient.destroy();
      }
    });

    ws.on('error', (e) => {
      console.error('❌ [VDI] WebSocket Client Error', e.message);
      if (guacClient) guacClient.destroy();
    });
  });
}

bootstrap();