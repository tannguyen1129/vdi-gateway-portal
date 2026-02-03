import { Controller, Get, Post, Body, Param, Patch, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { VdiService } from '../vdi/vdi.service';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly vdiService: VdiService,
  ) {}

  // 1. Lấy danh sách kỳ thi (Cho cả Admin xem list và SV xem bài thi đang mở)
  @Get()
  async findAll() { 
    return this.examsService.findAll(); 
  }

  @Post()
  create(@Body() body: any) { return this.examsService.create(body); }

  @Get(':id') // <--- QUAN TRỌNG: Định nghĩa route GET /exams/:id
async findOne(@Param('id') id: string) {
  const exam = await this.examsService.findOne(+id);
  if (!exam) throw new HttpException('Kỳ thi không tồn tại', HttpStatus.NOT_FOUND);
  return exam;
}

  // 2. [QUAN TRỌNG] API SINH VIÊN JOIN VÀO KỲ THI
  @Post(':id/join')
async joinExam(
  @Param('id') examId: string, 
  @Body() body: { userId: number, accessCode?: string }
) {
  // BƯỚC 1: Gọi Service để Validate (Check access code, user...)
  // Lưu ý: Dùng 'await' nhưng KHÔNG 'return' ngay.
  // Nếu sai code, hàm này sẽ ném lỗi (throw Exception) và code sẽ dừng tại đây.
  await this.examsService.joinExam(+examId, body.userId, body.accessCode);

  // BƯỚC 2: Nếu qua được bước 1, tiến hành cấp máy ảo
  const vm = await this.vdiService.allocateVm(body.userId);
  const token = this.vdiService.generateGuacamoleToken(vm);

  // BƯỚC 3: Trả về kết quả đầy đủ cho Frontend
  return {
    status: 'success',
    connectionToken: token, // Frontend cần cái này để kết nối socket
    vm: {
      id: vm.id,
      username: vm.username, // Frontend cần cái này để hiện tên máy
      ip: vm.ip
    }
  };
}

  // API THOÁT THI
  @Post('leave')
  async leaveExam(@Body() body: { userId: number }) {
    return this.examsService.leaveExam(body.userId);
  }

  @Patch(':id') // Dùng để sửa tên, mô tả, bật/tắt
  update(@Param('id') id: string, @Body() body: any) {
    return this.examsService.update(+id, body);
  }

  @Delete(':id') // Dùng để xóa
  remove(@Param('id') id: string) {
    return this.examsService.remove(+id);
  }
}