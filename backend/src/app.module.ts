import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { CourseModule } from './course/course.module';
import { LessonModule } from './lesson/lesson.module';
import { StorageModule } from './storage/storage.module';
import { ExerciseModule } from './exercise/exercise.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				type: 'postgres',
				host: config.get<string>('DB_HOST'),
				port: config.get<number>('DB_PORT'),
				username: config.get<string>('DB_USERNAME'),
				password: config.get<string>('DB_PASSWORD'),
				database: config.get<string>('DB_NAME'),
				uuidExtension: 'pgcrypto',
				autoLoadEntities: true,
				// Schema chỉ được đổi qua migration (xem src/database/data-source.ts và
				// docs/02-specs/database-design.md §9) — bật synchronize ở bất kỳ môi
				// trường nào cũng có thể xoá cột/dữ liệu ngoài ý muốn.
				synchronize: false,
				migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
				migrationsTableName: 'typeorm_migrations',
				migrationsRun: false,
				logging: false,
			}),
		}),
		AuthModule,
		UserModule,
		// E3: nội dung khoá học. `CourseModule` đứng trước `LessonModule` vì module sau dùng
		// `CourseAccessService` do module trước `exports` (thứ tự này chỉ để đọc dễ hiểu — Nest
		// tự giải phụ thuộc, không phụ thuộc thứ tự trong mảng).
		CourseModule,
		LessonModule,
		StorageModule,
		ExerciseModule,
		HealthModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		// Thứ tự trong mảng là thứ tự chạy: xác thực trước, phân quyền sau — `RolesGuard` và
		// `OwnershipGuard` đều dựa vào `request.user` do `JwtAuthGuard` gắn vào (E1-T3).
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule {}
