import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionInfo } from '../common/decorators/session-info.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { AUTH_MESSAGE } from './constants/auth-message.constant';
import { LocalUser } from './decorators/local-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { SessionContext } from './token.service';
import type { AuthUser } from './types/authenticated-user.type';
import type { User } from '../user/entities/user.entity';
import type {
	AuthSession,
	TokenPair,
	UserProfile,
} from './types/authenticated-user.type';

/**
 * Endpoint xác thực (§5.3).
 *
 * Danh sách **công khai** (đúng DoD E1-T3): `POST /api/auth/register`, `POST /api/auth/login`,
 * `POST /api/auth/refresh`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
 * Mọi endpoint khác trong file này yêu cầu access token; `GET /api/health` cũng được đánh dấu
 * `@Public()` ở `HealthController`.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('register')
	@Public()
	@ApiOperation({
		summary: 'Đăng ký tài khoản mới (mặc định vai trò học viên)',
	})
	@ApiCreatedResponse({ type: ApiResponseDto })
	async register(
		@Body() dto: RegisterDto,
		@SessionInfo() session: SessionContext,
	): Promise<ApiResponseDto<AuthSession>> {
		const data = await this.authService.register(dto, session);
		return buildSuccess(data, AUTH_MESSAGE.registerSuccess);
	}

	/**
	 * Vì sao dùng `AuthGuard('local')`: luồng đăng nhập đi qua Passport như architecture.md §3.2
	 * mô tả, và guard này ném lỗi 401/403 tiếng Việt từ `AuthService` (qua `LocalStrategy`).
	 */
	@Post('login')
	@Public()
	@UseGuards(AuthGuard('local'))
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Đăng nhập và nhận cặp access/refresh token' })
	@ApiOkResponse({ type: ApiResponseDto })
	async login(
		@Body() _dto: LoginDto,
		@LocalUser() user: User,
		@SessionInfo() session: SessionContext,
	): Promise<ApiResponseDto<AuthSession>> {
		const data = await this.authService.login(user, session);
		return buildSuccess(data, AUTH_MESSAGE.loginSuccess);
	}

	@Post('refresh')
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Làm mới access token bằng refresh token (rotation)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async refresh(
		@Body() dto: RefreshTokenDto,
		@SessionInfo() session: SessionContext,
	): Promise<ApiResponseDto<TokenPair>> {
		const data = await this.authService.refresh(dto.refreshToken, session);
		return buildSuccess(data);
	}

	@Post('logout')
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Thu hồi refresh token hiện tại (hoặc mọi phiên)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async logout(
		@CurrentUser() user: AuthUser,
		@Body() dto: LogoutDto,
	): Promise<ApiResponseDto<{ success: true }>> {
		const data = await this.authService.logout(user.id, dto?.refreshToken);
		return buildSuccess(data, AUTH_MESSAGE.logoutSuccess);
	}

	@Post('forgot-password')
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu (luôn trả cùng kết quả)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async forgotPassword(
		@Body() dto: ForgotPasswordDto,
		@SessionInfo() session: SessionContext,
	): Promise<ApiResponseDto<{ success: true }>> {
		const data = await this.authService.forgotPassword(dto.email, session);
		return buildSuccess(data, AUTH_MESSAGE.forgotPasswordNeutral);
	}

	@Post('reset-password')
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Đặt lại mật khẩu bằng token một lần' })
	@ApiOkResponse({ type: ApiResponseDto })
	async resetPassword(
		@Body() dto: ResetPasswordDto,
	): Promise<ApiResponseDto<{ success: true }>> {
		const data = await this.authService.resetPassword(dto);
		return buildSuccess(data, AUTH_MESSAGE.resetPasswordSuccess);
	}

	@Post('change-password')
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Đổi mật khẩu của người dùng đang đăng nhập' })
	@ApiOkResponse({ type: ApiResponseDto })
	async changePassword(
		@CurrentUser() user: AuthUser,
		@Body() dto: ChangePasswordDto,
	): Promise<ApiResponseDto<{ success: true }>> {
		const data = await this.authService.changePassword(user.id, dto);
		return buildSuccess(data, AUTH_MESSAGE.changePasswordSuccess);
	}

	@Get('me')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Hồ sơ người dùng đang đăng nhập' })
	@ApiOkResponse({ type: ApiResponseDto })
	async me(
		@CurrentUser() user: AuthUser,
	): Promise<ApiResponseDto<UserProfile>> {
		const data = await this.authService.getProfile(user.id);
		return buildSuccess(data);
	}
}
