import { Controller, Get } from '@nestjs/common';
import * as crypto from 'crypto';

@Controller()
export class AppController {
  @Get('get-token')
  getToken(): string {
    const connectionSettings = {
      connection: {
        type: 'rdp',
        settings: {
          'hostname': '103.56.164.247',
          'port': '3389',
          'username': 'lab01',
          'password': '258248',
          
          // --- CẤU HÌNH LEGACY (NHẸ & ỔN ĐỊNH) ---
          'security': 'nla',           // Giữ nguyên NLA
          'ignore-cert': 'true',
          
          // TẮT HOÀN TOÀN GFX ĐỂ TRÁNH TREO BROWSER
          'enable-gfx': 'false',       // Quay về RDP cổ điển
          'enable-video-streaming': 'false',
          
          // Tối ưu hóa hiển thị
          'color-depth': '16',         // Ép 16-bit
          'resize-method': 'display-update',
          'force-lossless': 'false',   // Cho phép nén ảnh
          
          // Tắt các hiệu ứng rác
          'disable-audio': 'true',
          'enable-wallpaper': 'false',
          'enable-theming': 'false',
          'enable-font-smoothing': 'false',
          'enable-full-window-drag': 'false',
          'enable-menu-animations': 'false',
          'enable-drive': 'false',
          'create-drive-path': 'false',
          'dpi': '96'
        }
      }
    };

    const keyString = 'MySuperSecretKeyForEncryption123';
    
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', keyString, iv);

        let encrypted = cipher.update(JSON.stringify(connectionSettings), 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const tokenObject = {
            iv: iv.toString('base64'),
            value: encrypted
        };

        return Buffer.from(JSON.stringify(tokenObject)).toString('base64');

    } catch (error) {
        console.error("Encryption error:", error);
        throw error;
    }
  }
}