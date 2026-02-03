import { Controller, Get, Param } from '@nestjs/common';
import { MonitorService } from './monitor.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get(':examId/init')
  async getInitialData(@Param('examId') examId: string) {
    const [logs, students] = await Promise.all([
      this.monitorService.getExamLogs(+examId),
      this.monitorService.getStudentStatus(+examId)
    ]);
    
    return { logs, students };
  }
}