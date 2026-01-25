import { Test, TestingModule } from '@nestjs/testing';
import { VdiGateway } from './vdi.gateway';

describe('VdiGateway', () => {
  let gateway: VdiGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VdiGateway],
    }).compile();

    gateway = module.get<VdiGateway>(VdiGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
