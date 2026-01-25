import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vm } from '../../entities/vm.entity';
import { VdiService } from './vdi.service';
import { VdiController } from './vdi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vm])],
  controllers: [VdiController],
  providers: [VdiService],
  exports: [VdiService],
})
export class VdiModule {}