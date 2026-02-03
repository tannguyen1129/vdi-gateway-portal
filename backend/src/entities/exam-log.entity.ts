import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Exam } from './exam.entity';

export enum LogType {
  INFO = 'INFO',       // Vào thi, Nộp bài, Kết nối lại
  WARNING = 'WARNING', // Mạng yếu, mất kết nối tạm thời
  VIOLATION = 'VIOLATION' // Thoát Fullscreen, Chuyển Tab
}

@Entity()
export class ExamLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  examId: number;

  @Column()
  userId: number;

  @Column({
    type: 'enum',
    enum: LogType,
    default: LogType.INFO
  })
  type: LogType;

  @Column()
  action: string; // VD: "EXIT_FULLSCREEN", "JOIN_EXAM"

  @Column({ type: 'text', nullable: true })
  details: string; // VD: "Thí sinh thoát màn hình lúc 10:05"

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Exam)
  @JoinColumn({ name: 'examId' })
  exam: Exam;
}