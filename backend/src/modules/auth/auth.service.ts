import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../entities/user.entity'; // Nhớ import Enum

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(username: string, pass: string): Promise<any> {
    console.log(`--- LOGIN ATTEMPT ---`);
    console.log(`Input: ${username} / ${pass}`);
    
    const user = await this.usersService.findOne(username);
    console.log(`User found in DB:`, user);

    if (user && user.password === pass) {
      console.log('--> PASSWORD MATCH!');
      const { password, ...result } = user;
      return result;
    }
    
    console.log('--> PASSWORD MISMATCH or USER NOT FOUND');
    return null;
  }

  // --- THÊM HÀM NÀY: TẠO ADMIN MẶC ĐỊNH ---
  async createDefaultAdmin() {
    // 1. Kiểm tra xem đã có admin chưa
    const existingAdmin = await this.usersService.findOne('admin');
    if (existingAdmin) {
      return "Admin đã tồn tại! (User: admin / Pass: 123)";
    }

    // 2. Nếu chưa có thì tạo mới
    await this.usersService.create({
      username: 'admin',
      password: '7816404122Tan', // Mật khẩu mặc định
      fullName: 'Super Administrator',
      role: UserRole.ADMIN,
      className: 'Staff'
    });

    return "Đã tạo tài khoản Admin thành công! (User: admin/Pass: 7816404122Tan)";
  }
}