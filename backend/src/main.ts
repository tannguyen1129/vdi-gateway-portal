import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  
  // Cấu hình CORS chặt chẽ hơn (Optional) hoặc giữ mặc định
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const server = app.getHttpServer();
  
  // Lắng nghe port 3000
  await app.listen(3000);

  // Cấu hình Socket.io thủ công để tăng buffer size (quan trọng cho RDP)
  const io = new Server(server, { 
    cors: { origin: '*' },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8 // 100MB
  });

  const guacdOptions = {
    host: 'umt_guacd', // Tên service trong Docker Compose
    port: 4822,
  };

  const clientOptions = {
    crypt: {
      cypher: 'AES-256-CBC',
      key: 'MySuperSecretKeyForEncryption123' 
    },
    log: {
        level: 'ERR'
    }
  };

  // Khởi tạo GuacamoleLite với đúng 3 tham số
  // @ts-ignore: Bỏ qua check type vì thư viện này cũ chưa có @types chuẩn
  new GuacamoleLite(
    { server, path: '/guaclite' }, 
    guacdOptions, 
    clientOptions
  );
  
  console.log('VDI Portal Backend is running on port 3000');
}
bootstrap();