import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { Exam } from '../../entities/exam.entity';
import { Vm } from '../../entities/vm.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exam, Vm, User]) // Đủ 3 món ăn chơi là chạy ngon
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}