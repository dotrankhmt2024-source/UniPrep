import { createHash } from 'node:crypto';

/**
 * Sinh số ngẫu nhiên **tái lập được** cho seed.
 *
 * Vì sao không dùng `Math.random()`: yêu cầu của database-design.md §9.4 là cùng
 * một `--seed` phải sinh ra cùng một bộ dữ liệu, để so sánh kết quả model giữa
 * các lần chạy và giữa các máy. `mulberry32` là PRNG 32-bit đủ tốt cho dữ liệu
 * mô phỏng và chỉ vài dòng code (không cần thêm dependency).
 */
export const createRandom = (seed: number) => {
	let state = seed >>> 0;

	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	return {
		/** Số thực trong [0, 1). */
		next,
		/** Số nguyên trong [min, max]. */
		int: (min: number, max: number) =>
			min + Math.floor(next() * (max - min + 1)),
		/** Chọn ngẫu nhiên một phần tử (mảng phải không rỗng). */
		pick: <T>(items: readonly T[]): T =>
			items[Math.floor(next() * items.length)],
		/** `true` với xác suất `probability`. */
		chance: (probability: number) => next() < probability,
	};
};

export type SeededRandom = ReturnType<typeof createRandom>;

/**
 * UUID xác định từ một khoá tự nhiên (`seed:<bảng>:<khoá>`).
 *
 * Vì sao cần: `id` là UUID sinh ngẫu nhiên, nên chạy seed lần hai sẽ tạo bản ghi
 * trùng nếu chỉ dựa vào `id`. Sinh `id` từ khoá tự nhiên biến mọi lần chạy thành
 * `ON CONFLICT (id) DO UPDATE` ⇒ seed **idempotent** mà không cần bảng tra cứu.
 */
export const seededUuid = (key: string): string => {
	const hash = createHash('sha256').update(`uniprep-seed:${key}`).digest('hex');
	// Đặt nibble version = 4 và variant = 8..b để UUID hợp lệ về hình thức.
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		`4${hash.slice(13, 16)}`,
		`a${hash.slice(17, 20)}`,
		hash.slice(20, 32),
	].join('-');
};
