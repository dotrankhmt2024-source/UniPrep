import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mở một route/controller cho truy cập ẩn danh.
 *
 * Vì sao cần cờ "public" thay vì danh sách miễn trừ trong guard: `JwtAuthGuard` được đăng ký
 * **toàn cục** nên mặc định mọi route đều bị chặn; nếu guard phải tự biết route nào miễn trừ thì
 * mỗi lần thêm endpoint công khai lại phải sửa guard (dễ quên, và đó là lỗi bảo mật âm thầm).
 * Khai báo `@Public()` ngay tại handler giữ danh sách công khai nằm cạnh chính endpoint đó.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
