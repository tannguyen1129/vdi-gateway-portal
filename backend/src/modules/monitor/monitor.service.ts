import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamLog } from '../../entities/exam-log.entity';

@Injectable()
export class MonitorService {
  constructor(
    @InjectRepository(ExamLog)
    private logRepo: Repository<ExamLog>,
  ) {}

  // Lấy toàn bộ log của kỳ thi (để hiển thị list bên phải)
  async getExamLogs(examId: number) {
    return this.logRepo.find({
      where: { examId },
      order: { createdAt: 'DESC' }, // Mới nhất lên đầu
      relations: ['user'], // Join bảng User để lấy tên
      take: 100 // Lấy 100 log gần nhất thôi cho nhẹ
    });
  }

  // Lấy trạng thái hiện tại của tất cả sinh viên (để tô màu Grid)
  async getStudentStatus(examId: number) {
    // Logic: Lấy log mới nhất của từng user trong kỳ thi này
    const logs = await this.logRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.examId = :examId', { examId })
      .orderBy('log.createdAt', 'DESC')
      .getMany();

    // Group lại để lấy trạng thái cuối cùng của từng user
    const statusMap = new Map();
    logs.forEach(log => {
        if (!statusMap.has(log.userId)) {
            statusMap.set(log.userId, {
                userId: log.userId,
                fullName: log.user.fullName || log.user.username,
                lastStatus: log.type, // INFO, VIOLATION...
                lastAction: log.action,
                lastSeen: log.createdAt
            });
        }
    });

    return Array.from(statusMap.values());
  }
}