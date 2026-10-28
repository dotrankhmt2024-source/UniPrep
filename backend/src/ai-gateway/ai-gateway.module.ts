import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiGatewayService } from './ai-gateway.service';

@Module({
	imports: [ConfigModule],
	providers: [AiGatewayService],
	exports: [AiGatewayService],
})
export class AiGatewayModule {}