import type { TransformFnParams } from 'class-transformer';

/**
 * `@Transform(trimString)` — cắt khoảng trắng đầu/cuối của dữ liệu client gửi lên.
 *
 * Vì sao là hàm dùng chung thay vì arrow function trong từng DTO: `class-transformer` truyền
 * `value` kiểu `any`, nên arrow function trả thẳng `value` bị ESLint bắt lỗi
 * `no-unsafe-return`; gom vào một chỗ thì chỉ cần một điểm ép kiểu có kiểm soát, và mọi DTO trim
 * theo cùng một quy tắc (dán email kèm space là lỗi rất thường gặp khi copy từ trình duyệt).
 */
export const trimString = ({ value }: TransformFnParams): unknown => {
	if (typeof value !== 'string') return value as unknown;
	return value.trim();
};
