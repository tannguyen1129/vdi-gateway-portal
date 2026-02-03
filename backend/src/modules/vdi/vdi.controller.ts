import { Controller, Get, Query, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { VdiService } from './vdi.service';

@Controller('vdi')
export class VdiController {
  constructor(private readonly vdiService: VdiService) {}

  @Get('connect')
  async connect(@Query('userId') userId: string) {
    if (!userId) throw new HttpException('Thiếu UserId', HttpStatus.BAD_REQUEST);

    // 1. Cấp phát VM
    const vm = await this.vdiService.allocateVm(Number(userId));
    
    // 2. Tạo token
    const token = this.vdiService.generateGuacamoleToken(vm);

    // 3. Trả về đúng định dạng Frontend cần
    return { 
        connectionToken: token, // Frontend đang đợi biến này
        vm: {
            id: vm.id,
            username: vm.username, // Đây sẽ là tên hiển thị trên thanh Header
            ip: vm.ip,
            port: vm.port
        }
    };
  }

  @Post('release')
  async release(@Body() body: { userId: number }) {
      await this.vdiService.releaseVm(body.userId);
      return { status: 'released' };
  }
}