import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Notification])],
	providers: [NotificationService],
	exports: [NotificationService],
	controllers: [NotificationController],
})
export class NotificationModule {}
