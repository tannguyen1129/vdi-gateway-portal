import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Vm } from '../../entities/vm.entity';
import * as XLSX from 'xlsx';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Vm) private vmRepo: Repository<Vm>,
  ) {}

  // 1. IMPORT SINH VIÊN (Giữ nguyên logic của bạn - rất ổn)
  async importUsers(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    let countNew = 0;
    let countUpdate = 0;

    for (const row of data as any[]) {
      const mssv = row['mssv'] || row['username'] || row['User Name'] || row['Student ID'] || row['User ID'];
      const hoTen = row['ho_ten'] || row['fullName'] || row['Full Name'] || row['Name'] || row['Họ Tên'];
      const lop = row['lop'] || row['className'] || row['Class Name'] || row['Class'] || 'K14-CNTT';
      const matKhau = row['mat_khau'] || row['password'] || row['Password'] || '123456';

      if (!mssv) continue;

      let user = await this.userRepo.findOne({ where: { username: mssv.toString() } });
      
      if (user) {
        user.password = matKhau.toString();
        user.fullName = hoTen ? hoTen.toString() : user.fullName;
        user.className = lop.toString();
        await this.userRepo.save(user);
        countUpdate++;
      } else {
        await this.userRepo.save({
          username: mssv.toString(),
          password: matKhau.toString(),
          fullName: hoTen ? hoTen.toString() : `Sinh viên ${mssv}`,
          className: lop.toString(),
          role: UserRole.STUDENT
        });
        countNew++;
      }
    }
    return { message: `Xử lý xong: Thêm mới ${countNew}, Cập nhật ${countUpdate} sinh viên.` };
  }

  // 2. IMPORT VM (Sửa lại logic: Map theo IP + Chống crash)
  async importVms(fileBuffer: Buffer) {
    console.log("--> BẮT ĐẦU IMPORT VM (CHẾ ĐỘ MULTI-USER/IP)...");
    
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let countNew = 0;
    let countUpdate = 0;
    let countError = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
            const ip = row['ip'] || row['IP'] || row['Ip Address'] || row['Host'];
            const username = row['username'] || row['User'] || row['Username'];
            const password = row['password'] || row['Pass'] || row['Mật khẩu'] || '123';

            if (!ip || !username) continue;

            const ipString = ip.toString().trim();
            const userString = username.toString().trim();

            // SỬA LẠI: Tìm xem có cặp (IP + USERNAME) này chưa?
            const existingVm = await this.vmRepo.findOne({ 
                where: { 
                    ip: ipString, 
                    username: userString 
                } 
            });

            if (existingVm) {
                // Có rồi -> Update pass
                existingVm.password = password.toString();
                await this.vmRepo.save(existingVm);
                countUpdate++;
            } else {
                // Chưa có cặp này -> Tạo mới (Dù IP đã tồn tại ở dòng khác)
                await this.vmRepo.save({
                    ip: ipString,
                    port: 3389,
                    username: userString,
                    password: password.toString(),
                    isAllocated: false,
                    allocatedToUserId: null
                });
                countNew++;
            }
        } catch (error) {
            console.error(`Lỗi dòng ${i}:`, error.message);
            countError++;
        }
    }
    return { message: `Xong! Mới: ${countNew}, Update: ${countUpdate}, Lỗi: ${countError}` };
  }

  // 3. LẤY DANH SÁCH (Giữ nguyên)
  async getAllStudents() {
    return this.userRepo.find({ 
        where: { role: UserRole.STUDENT },
        order: { username: 'ASC' }
    });
  }

  async getAllVms() {
    return this.vmRepo.find({ order: { ip: 'ASC' } }); // Sắp xếp theo IP cho dễ nhìn
  }

  // 4. CÁC HÀM CÒN THIẾU (Fix lỗi Controller đỏ lòm)
  async updateVm(id: number, data: Partial<Vm>) {
    const vm = await this.vmRepo.findOne({ where: { id } });
    if (!vm) throw new NotFoundException('Không tìm thấy máy ảo');
    
    if (data.ip) vm.ip = data.ip;
    if (data.username) vm.username = data.username;
    if (data.password) vm.password = data.password;
    
    return this.vmRepo.save(vm);
  }

  async deleteVm(id: number) {
    const result = await this.vmRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Không tìm thấy ID để xóa');
    return { message: 'Đã xóa thành công' };
  }
}