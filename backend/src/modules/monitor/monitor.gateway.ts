import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamLog, LogType } from '../../entities/exam-log.entity';

// CẤU HÌNH QUAN TRỌNG: CORS & TRANSPORTS
@WebSocketGateway({ 
  cors: {
    origin: '*', // Cho phép kết nối từ Frontend (port 80)
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Hỗ trợ cả 2 giao thức để đảm bảo kết nối
})
export class MonitorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(ExamLog)
    private logRepo: Repository<ExamLog>,
  ) {}

  // Lưu danh sách user đang online: { socketId: { userId, examId, fullName } }
  private connectedClients = new Map<string, any>();

  handleConnection(client: Socket) {
    // Log ra console khi có client kết nối thành công (giúp debug)
    console.log(`✅ Socket Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const data = this.connectedClients.get(client.id);
    if (data) {
      console.log(`❌ Socket Client Disconnected: ${client.id} (User: ${data.fullName})`);
      
      // Báo cho giám thị là thí sinh này đã mất kết nối (Offline)
      this.server.to(`admin_room_${data.examId}`).emit('student_status', {
        userId: data.userId,
        status: 'OFFLINE',
        lastSeen: new Date()
      });
      this.connectedClients.delete(client.id);
    }
  }

  // 1. Thí sinh join phòng thi (để giám thị biết đang Online)
  @SubscribeMessage('join_exam_room')
  async handleJoinExam(client: Socket, payload: { examId: number, userId: number, fullName: string }) {
    // Join socket vào room riêng của kỳ thi này
    client.join(`exam_room_${payload.examId}`);
    
    // Lưu thông tin mapping để dùng khi disconnect
    this.connectedClients.set(client.id, payload);

    console.log(`📢 User ${payload.fullName} joined Exam ${payload.examId}`);

    // Gửi log vào DB (Lịch sử)
    await this.saveLog(payload.examId, payload.userId, LogType.INFO, 'JOIN', 'Thí sinh đã vào phòng thi');

    // Báo ngay cho Admin đang soi phòng này (Real-time)
    this.server.to(`admin_room_${payload.examId}`).emit('student_status', {
        userId: payload.userId,
        fullName: payload.fullName,
        status: 'ONLINE'
    });
  }

  // 2. Admin join phòng giám sát
  @SubscribeMessage('join_monitor_room')
  handleAdminMonitor(client: Socket, payload: { examId: number }) {
    client.join(`admin_room_${payload.examId}`);
    console.log(`🛡️ Admin joined monitor room for Exam ${payload.examId}`);
  }

  // 3. Nhận báo cáo VI PHẠM từ Frontend
  @SubscribeMessage('report_violation')
  async handleViolation(client: Socket, payload: { examId: number, userId: number, violation: string }) {
    console.warn(`🚨 VIOLATION REPORT: User ${payload.userId} - ${payload.violation}`);

    // 1. Lưu Log vào DB
    const log = await this.saveLog(payload.examId, payload.userId, LogType.VIOLATION, payload.violation, `Phát hiện vi phạm: ${payload.violation}`);

    // 2. Bắn tin khẩn cấp cho Admin (để hiện Ting Ting hoặc Log đỏ)
    this.server.to(`admin_room_${payload.examId}`).emit('new_violation', {
        logId: log.id,
        userId: payload.userId,
        details: log.details,
        timestamp: log.createdAt
    });
  }

  // Helper lưu DB
  private async saveLog(examId: number, userId: number, type: LogType, action: string, details: string) {
    try {
      const log = this.logRepo.create({ examId, userId, type, action, details });
      return await this.logRepo.save(log);
    } catch (error) {
      console.error('Error saving exam log:', error);
      return { id: 0, details: details, createdAt: new Date() }; // Fallback nếu DB lỗi
    }
  }
}