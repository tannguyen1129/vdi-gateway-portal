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

    // Tìm máy chưa cấp phát (Ưu tiên máy có Port nhỏ nhất để gọn)
    vm = await this.vmRepo.findOne({ 
        where: { isAllocated: false },
        order: { port: 'ASC' }
    });
    
    if (!vm) throw new NotFoundException('Hệ thống hết máy ảo. Vui lòng liên hệ giám thị.');

    vm.isAllocated = true;
    vm.allocatedToUserId = userId;
    await this.vmRepo.save(vm);
    
    return vm;
  }

  // --- HÀM TẠO TOKEN (PHIÊN BẢN VNC - NO PASSWORD) ---
  generateGuacamoleToken(vm: Vm): string {
    const connectionSettings = {
      connection: {
        type: 'rdp',
        settings: {
          'hostname': vm.ip,
          'port': vm.port.toString(),
          'username': vm.username,
          'password': vm.password,

          // 1. Bảo mật
          'security': 'nla',      
          'ignore-cert': 'true',
          // [FIX] Tăng timeout kết nối RDP với Windows
          'timeout': '60', 

          // 2. Fix màn hình đen
          'enable-gfx': 'true',    
          'color-depth': '32',      
          'disable-gfx-h264': 'true',  
          'disable-gfx-avc444': 'true',

          // 3. Cấu hình Resize
          'resize-method': 'display-update', // Bắt buộc cho auto-resize
          'dpi': '96',
          
          // [QUAN TRỌNG] Đã XÓA 'width' và 'height' cứng ở đây.
          // Để trình duyệt tự gửi kích thước lên.

          // 4. Các setting khác
          'disable-audio': 'true',
          'enable-drive': 'false',
          'enable-printing': 'false',
          'disable-wallpaper': 'true', 
          'disable-theming': 'true',
          'enable-font-smoothing': 'false',
          'server-layout': 'en-us-qwerty',
        }
      }
    };

    // Mã hóa Token (Giữ nguyên logic cũ)
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