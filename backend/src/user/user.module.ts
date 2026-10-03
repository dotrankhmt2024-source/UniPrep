import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';

/**
 * `UserModule` (E1: một phần; E2-T1/E2-T2 mở rộng).
 *
 * Import `AuthModule` để dùng `TokenService` khi khoá tài khoản phải thu hồi phiên — chiều phụ
 * thuộc một chiều (`user → auth`), `AuthModule` không import ngược lại nên không có vòng.
 */
@Module({
	imports: [TypeOrmModule.forFeature([User]), AuthModule],
	controllers: [UserController],
	providers: [UserService],
	exports: [UserService],
})
export class UserModule {}
