import type { UserRole, UserStatus } from '../../common/types';

/**
 * Kiểu dữ liệu xác thực dùng chung giữa `AuthModule`, các guard và `UserModule`.
 *
 * Không khai báo trong `common/types/*.type.ts`: đây **không** phải union type miền nghiệp vụ
 * (những type đó là nguồn chân lý cho cả DB lẫn FE) mà là hợp đồng nội bộ của tầng HTTP.
 */

/** Người dùng đã xác thực, được `JwtStrategy` gắn vào `request.user`. */
export interface AuthUser {
	id: string;
	email: string;
	role: UserRole;
	status: UserStatus;
}

/** Claims của access token (§5.1: `sub`, `email`, `role`, `iat`, `exp`). */
export interface AccessTokenPayload {
	sub: string;
	email: string;
	role: UserRole;
	type: 'access';
	iat?: number;
	exp?: number;
}

/**
 * Claims của refresh token. Khác access token ở `type` và ở `familyId` — cả chuỗi rotation dùng
 * chung một `family_id` để khi phát hiện token cũ bị dùng lại thì thu hồi được **toàn bộ** phiên
 * của người dùng đó (§5.2 "Refresh").
 *
 * `jti` là **bắt buộc**, không phải trang trí: `refresh_tokens.token_hash` là UNIQUE, mà hai lần
 * xoay token trong cùng một giây sẽ cho ra chuỗi JWT y hệt nhau (payload giống nhau, `iat` giống
 * nhau) ⇒ vi phạm UNIQUE ngay ở lần refresh thứ hai. Đã gặp lỗi này khi kiểm thử E1-T2.
 */
export interface RefreshTokenPayload {
	sub: string;
	familyId: string;
	jti: string;
	type: 'refresh';
	iat?: number;
	exp?: number;
}

export type JwtPayload = AccessTokenPayload | RefreshTokenPayload;

/** Cặp token trả về cho client (§5.3). */
export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	tokenType: 'Bearer';
	expiresIn: number;
}

/** Hồ sơ rút gọn của người dùng trong response auth (§5.3 — đúng 8 trường, không có `passwordHash`). */
export interface UserProfile {
	id: string;
	email: string;
	fullName: string;
	role: UserRole;
	status: UserStatus;
	avatarUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/** `data` của `POST /auth/register` và `POST /auth/login`. */
export interface AuthSession extends TokenPair {
	user: UserProfile;
}
