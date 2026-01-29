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
        // [QUAN TRỌNG 1] Đổi giao thức sang VNC
        type: 'vnc', 
        settings: {
          // [QUAN TRỌNG 2] Thông số kết nối cơ bản
          'hostname': vm.ip,       // IP Host (ví dụ 172.17.0.1)
          'port': vm.port.toString(), // Port map ra ngoài (ví dụ 31001)
          
          // [QUAN TRỌNG 3] Cấu hình không mật khẩu (Khớp với -SecurityTypes None)
          // Không cần điền username/password ở đây vì VNC này không set pass.
          
          // Cấu hình hiển thị tối ưu cho Web
          'cursor': 'remote',       // Dùng con trỏ chuột của server để đỡ lag
          'color-depth': '24',      // Màu sắc chuẩn đẹp (True Color)
          'swap-red-blue': 'false', // Sửa lỗi màu xanh/đỏ nếu bị ngược
          'read-only': 'false',     // Cho phép điều khiển chuột/phím
          'ignore-cert': 'true',    // Bỏ qua check SSL (dư thừa với VNC nhưng cứ để cho chắc)
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