import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from '../../entities/exam.entity';
import { Vm } from '../../entities/vm.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private examRepo: Repository<Exam>,
    @InjectRepository(Vm) private vmRepo: Repository<Vm>,
    @InjectRepository(User) private userRepo: Repository<User>,
) {}

  findAll() {
    return this.examRepo.find({ order: { createdAt: 'DESC' } });
  }

  create(data: Partial<Exam>) {
    return this.examRepo.save(data);
  }
  
  async findOne(id: number) {
    return this.examRepo.findOne({ where: { id }, relations: ['students'] });
  }

  async update(id: number, data: Partial<Exam>) {
    await this.examRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.examRepo.delete(id);
  }

  async joinExam(examId: number, userId: number, accessCode?: string) {
    // 1. KIỂM TRA KỲ THI
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Kỳ thi không tồn tại!');
    if (!exam.isActive) throw new BadRequestException('Kỳ thi đang tạm khóa!');

    // 2. KIỂM TRA THỜI GIAN
    const now = new Date();
    // Cho phép vào sớm 15 phút để chuẩn bị
    const entryTime = new Date(new Date(exam.startTime).getTime() - 15 * 60000); 

    if (now < entryTime) {
       throw new BadRequestException(`Chưa đến giờ thi! Mở cửa lúc: ${new Date(exam.startTime).toLocaleTimeString()}`);
    }
    if (now > new Date(exam.endTime)) {
       throw new BadRequestException('Kỳ thi đã kết thúc!');
    }

    // 3. KIỂM TRA MÃ TRUY CẬP (ACCESS CODE) - LOGIC GỐC
    if (exam.accessCode && exam.accessCode.trim() !== "") {
        if (!accessCode || accessCode !== exam.accessCode) {
            throw new UnauthorizedException("Sai mã truy cập (Access Code)!");
        }
    }

    // 4. [LOGIC GỐC] CẬP NHẬT TRẠNG THÁI USER
    // Ghi nhận sinh viên đang tham gia kỳ thi này
    // ⚠️ LƯU Ý: Nếu User entity của bạn dùng quan hệ (relation), hãy sửa 'examId' cho khớp.
    await this.userRepo.update(userId, { 
        // examId: examId   <-- Mở comment dòng này nếu bảng User có cột examId
        // Hoặc nếu bạn muốn đánh dấu user đang online/bận:
        // status: 'IN_EXAM' 
    });

    // 5. [LOGIC MỚI] CẤP PHÁT MÁY ẢO
    // A. Kiểm tra xem User này có đang giữ máy nào không? (Reconnect)
    let allocatedVm = await this.vmRepo.findOne({ 
        where: { allocatedToUserId: userId } 
    });

    // B. Nếu chưa có máy -> Tìm máy rảnh để cấp
    if (!allocatedVm) {
        // Tìm máy chưa ai dùng, ưu tiên theo thứ tự IP
        const freeVm = await this.vmRepo.findOne({
            where: { isAllocated: false },
            order: { ip: 'ASC' } 
        });

        if (!freeVm) {
            throw new BadRequestException('HẾT MÁY ẢO! Vui lòng liên hệ giám thị ngay lập tức.');
        }

        // Lock máy cho User này
        freeVm.isAllocated = true;
        freeVm.allocatedToUserId = userId;
        allocatedVm = await this.vmRepo.save(freeVm);
    }

    // 6. TRẢ VỀ KẾT QUẢ ĐẦY ĐỦ
    return {
        message: 'Vào thi thành công',
        examName: exam.name,
        startTime: exam.startTime,
        endTime: exam.endTime,
        vmConfig: {
            ip: allocatedVm.ip,
            username: allocatedVm.username,
            password: allocatedVm.password,
            port: allocatedVm.port || 3389,
            protocol: 'rdp'
        }
    };
  }

  // ==========================================================
  // HÀM RỜI PHÒNG THI (LEAVE EXAM)
  // ==========================================================
  async leaveExam(userId: number) {
    // 1. Tìm máy ảo đang gán cho user
    const vm = await this.vmRepo.findOne({ where: { allocatedToUserId: userId } });
    
    if (vm) {
        // Trả máy về trạng thái rảnh
        vm.isAllocated = false;
        vm.allocatedToUserId = null;
        await this.vmRepo.save(vm);
    }

    // 2. [LOGIC GỐC] Reset trạng thái User (Optional)
    // await this.userRepo.update(userId, { examId: null });

    return { message: 'Đã thoát thi và trả máy ảo thành công.' };
  }
}