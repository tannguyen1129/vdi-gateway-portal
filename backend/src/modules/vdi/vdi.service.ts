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

  // 1. Logic Cấp phát máy
  async allocateVm(userId: number): Promise<Vm> {
    // Check xem user này đã có máy chưa
    let vm = await this.vmRepo.findOne({ where: { allocatedToUserId: userId } });
    if (vm) return vm;

    // Tìm máy rảnh
    vm = await this.vmRepo.findOne({ where: { isAllocated: false } });
    
    if (!vm) {
      throw new NotFoundException('Hệ thống hết máy ảo. Vui lòng liên hệ giám thị.');
    }

    // Khóa máy
    vm.isAllocated = true;
    vm.allocatedToUserId = userId;
    await this.vmRepo.save(vm);
    
    console.log(`[VDI] Allocated ${vm.username} for UserID ${userId}`);
    return vm;
  }

  // 2. Logic tạo Token (CẤU HÌNH LEGACY CHUẨN)
  generateGuacamoleToken(vm: Vm): string {
    const connectionSettings = {
      connection: {
        type: 'rdp',
        settings: {
          'hostname': vm.ip,
          'port': vm.port.toString(),
          'username': vm.username,
          'password': vm.password,
          
          // --- CẤU HÌNH LEGACY (NHẸ & ỔN ĐỊNH) ---
          'security': 'nla',           
          'ignore-cert': 'true',
          
          // TẮT HOÀN TOÀN GFX ĐỂ TRÁNH TREO BROWSER
          'enable-gfx': 'false',       
          'enable-video-streaming': 'false',
          
          // Tối ưu hóa hiển thị
          'color-depth': '16',         
          'resize-method': 'display-update',
          'force-lossless': 'false',   
          
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

    // Mã hóa token
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

  // 3. Logic thu hồi máy
  async releaseVm(userId: number) {
    const vm = await this.vmRepo.findOne({ where: { allocatedToUserId: userId } });
    if (vm) {
      vm.isAllocated = false;
      vm.allocatedToUserId = null; // Lỗi TypeScript đã được fix nhờ sửa Entity ở Bước 1
      await this.vmRepo.save(vm);
      console.log(`[VDI] Released ${vm.username}`);
    }
  }
}