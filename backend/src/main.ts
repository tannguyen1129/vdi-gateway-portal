import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server } from 'socket.io';
const GuacamoleLite = require('guacamole-lite');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  
  app.enableCors();

  const server = app.getHttpServer();
  
  await app.listen(3000);

  // --- CẤU HÌNH SOCKET.IO TĂNG CƯỜNG ---
  const io = new Server(server, { 
    cors: { origin: '*' },
    pingTimeout: 60000,   // Tăng lên 60 giây (Mặc định là 20s - quá ngắn cho RDP)
    pingInterval: 25000,  // Gửi ping mỗi 25s
    maxHttpBufferSize: 1e8 // Tăng bộ đệm lên 100MB để chứa hình ảnh lớn
  });

  const guacdOptions = {
    host: 'umt_guacd',
    port: 4822,
  };

  const clientOptions = {
    crypt: {
      cypher: 'AES-256-CBC',
      key: 'MySuperSecretKeyForEncryption123' 
    },
    log: {
        level: 'DEBUG' // Bật log debug để xem chi tiết
    }
  };

  new GuacamoleLite({ server, io }, guacdOptions, clientOptions);
  
  console.log('VDI Portal Backend is running on port 3000');
}
bootstrap();