// backend/src/modules/vdi/vdi.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vm } from '../../entities/vm.entity';
import * as crypto from 'crypto';

@Injectable()
export class VdiService {
  constructor(
    @InjectRepository(Vm)
    private vmRepo: Repository<Vm>,
  ) {}

  async allocateVm(userId: number): Promise<Vm> {
    let vm = await this.vmRepo.findOne({ where: { allocatedToUserId: userId } });
    if (vm) return vm;

    vm = await this.vmRepo.findOne({ where: { isAllocated: false } });
    if (!vm) throw new NotFoundException('Hệ thống hết máy ảo. Vui lòng liên hệ giám thị.');

    vm.isAllocated = true;
    vm.allocatedToUserId = userId;
    await this.vmRepo.save(vm);
    
    return vm;
  }

  // --- HÀM TẠO TOKEN (CẤU HÌNH "SAFE MODE" - ỔN ĐỊNH CAO) ---
  generateGuacamoleToken(vm: Vm): string {
    const connectionSettings = {
      connection: {
        type: 'rdp',
        settings: {
          'hostname': vm.ip,
          'port': vm.port.toString(),
          'username': vm.username,
          'password': vm.password,
          
          // 1. BẢO MẬT & MẠNG
          'security': 'rdp',       
          'ignore-cert': 'true',
          
          // 2. ĐỒ HỌA (Fix lỗi màn hình đen/disconnect)
          'color-depth': '32',          // Windows mới bắt buộc 32-bit
          'resize-method': 'display-update',
          'force-lossless': 'false',   
          'enable-gfx': 'false',        // Tắt GFX để nhẹ trình duyệt
          'enable-video-streaming': 'false',

          // 3. TẮT TẤT CẢ TÍNH NĂNG PHỤ (Fix lỗi RDPDR Crash)
          // Tắt Âm thanh
          'disable-audio': 'true',
          'enable-audio-input': 'false',
          'console-audio': 'false',
          
          // Tắt In ấn & Ổ đĩa (Nguyên nhân chính gây crash RDPDR)
          'enable-printing': 'false',
          'enable-drive': 'false',
          'create-drive-path': 'false',
          'disable-upload': 'true',
          'disable-download': 'true',
          
          // Tắt Hiệu ứng Windows
          'enable-wallpaper': 'false',
          'enable-theming': 'false',
          'enable-font-smoothing': 'false',
          'enable-full-window-drag': 'false',
          'enable-menu-animations': 'false',
          'disable-bitmap-caching': 'false',
          'disable-offscreen-caching': 'false',
          
          // Locale
          'server-layout': 'en-us-qwerty',
          'dpi': '96'
        }
      }
    };

    // Mã hóa Token (Không đổi)
    const keyString = 'MySuperSecretKeyForEncryption123';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyString, iv);
    
    let encrypted = cipher.update(JSON.stringify(connectionSettings), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return Buffer.from(JSON.stringify({ 
        iv: iv.toString('base64'), 
        value: encrypted 
    })).toString('base64');
  }

  async releaseVm(userId: number) {
    const vm = await this.vmRepo.findOne({ where: { allocatedToUserId: userId } });
    if (vm) {
      vm.isAllocated = false;
      vm.allocatedToUserId = null;
      await this.vmRepo.save(vm);
    }
  }
}