import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types';

export const ROLES_KEY = 'roles';

/**
 * Giới hạn route cho một tập vai trò (`docs/02-specs/api-specification.md` §6).
 *
 * Không khai báo `@Roles()` = mọi vai trò đã đăng nhập đều gọi được; `admin` **không** tự động
 * vượt qua `@Roles('student')` — muốn admin đi qua thì phải ghi rõ trong danh sách, vì có những
 * endpoint chỉ dành cho chính chủ dữ liệu (ví dụ `lesson_progress` của học viên).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
