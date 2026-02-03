// backend/src/modules/monitor/monitor.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorGateway } from './monitor.gateway';
import { ExamLog } from '../../entities/exam-log.entity';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';

@Module({
  imports: [
    // Đăng ký Entity ExamLog để dùng được InjectRepository(ExamLog)
    TypeOrmModule.forFeature([ExamLog]) 
  ],
  controllers: [MonitorController],
  providers: [MonitorGateway, MonitorService],
  exports: [MonitorGateway], // Export nếu module khác cần dùng
})
export class MonitorModule {}