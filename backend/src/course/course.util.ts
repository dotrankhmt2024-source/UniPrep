import { ConflictException } from '@nestjs/common';
import { type FindOperator, Not } from 'typeorm';
import { COURSE_MESSAGE } from './constants/course-message.constant';

/**
 * Phần tối thiểu của repository mà `resolveUniqueSlug` cần.
 *
 * **Vì sao không dùng `Repository<Course | Category>`:** `Repository<T>` bất biến ở `T` (tham số
 * xuất hiện trong cả tham số và kiểu trả về), nên `Repository<Course>` **không** gán được cho
 * `Repository<Course | Category>`. Một interface mô tả đúng ba thứ được dùng vừa tránh được vấn đề
 * đó, vừa giữ cho hàm không phụ thuộc vào entity nào của module.
 *
 * Kiểu của `id` phải là `FindOperator<string>` (không phải `FindOperator<unknown>`): bộ kiểm tra
 * kiểu của TypeORM đòi đúng `string | FindOperator<string>` cho một cột `uuid`.
 */
interface SlugLookupRepository {
	/** `null` khi không có bản ghi nào khớp — đúng hợp đồng `Repository.findOne` của TypeORM. */
	findOne(options: {
		where: { slug: string; id?: FindOperator<string> };
	}): Promise<{ id: string } | null>;
}

/**
 * Sinh `slug` từ tên hiển thị (danh mục hoặc khoá học).
 *
 * **Vì sao phải tách dấu bằng `normalize('NFD')` chứ không dùng bảng thay thế thủ công:** tên khoá
 * học/danh mục trong dự án là tiếng Việt có dấu, và bảng thay thế viết tay luôn thiếu vài tổ hợp
 * (``, `ơ`, `ư`, `đ`…). NFD tách nguyên âm thành ký tự gốc + dấu tổ hợp, rồi `\u0300-\u036f` xoá
 * toàn bộ dấu — đúng cho mọi nguyên âm tiếng Việt. Riêng `đ`/`Đ` là ký tự **dựng sẵn** (không
 * phải `d` + dấu) nên NFD không tách được, phải thay tường minh.
 *
 * Hàm thuần (không I/O) để kiểm thử độc lập với DB và để cùng một tên luôn cho cùng một slug.
 *
 * @example
 * slugify('Nhập môn Lập trình C++')  // 'nhap-mon-lap-trinh-c' (mọi ký tự không phải [a-z0-9] gộp thành một '-')
 * slugify('Đại số tuyến tính')      // 'dai-so-tuyen-tinh'     (đ → d, dấu bị NFD tách và xoá)
 * slugify('!!!')                    // 'khoa-hoc'             (fallback, không bao giờ trả chuỗi rỗng)
 */
export const slugify = (text: string): string => {
	const withoutDiacritics = text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[đĐ]/g, 'd');

	const slug = withoutDiacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug.length > 0 ? slug : 'khoa-hoc';
};

/**
 * Tìm `slug` chưa bị dùng, thêm hậu tố `-2`, `-3`, … khi trùng.
 *
 * Dừng sau 50 lần thử thay vì lặp vô hạn: tới đó mà vẫn trùng thì gần như chắc chắn là lỗi dữ liệu
 * (ví dụ một bản ghi đã chiếm đúng dải tên đó), và `409` là câu trả lời trung thực hơn một vòng lặp
 * treo request. `exceptId` để `PATCH` không tự coi bản ghi của chính nó là trùng.
 *
 * **Vì sao vẫn cần lưới an toàn ở tầng service:** đây là kiểm tra trước (giảm số lần chạm unique
 * index); hai request cùng tên chạy song song vẫn có thể cùng vượt qua và một trong hai nhận
 * `23505` — lỗi đó được dịch thành `409` cùng thông điệp ở `CourseService`/`CategoryService`.
 *
 * Tham số nhận interface `SlugLookupRepository` (không phải `Repository<T>`) vì lý do bất biến của
 * generic — xem ghi chú ở interface đó.
 */
export const resolveUniqueSlug = async (
	repository: SlugLookupRepository,
	base: string,
	exceptId?: string,
): Promise<string> => {
	for (let attempt = 1; attempt <= 50; attempt += 1) {
		const candidate = attempt === 1 ? base : `${base}-${attempt}`;

		const existing = await repository.findOne({
			where: exceptId
				? { slug: candidate, id: Not(exceptId) }
				: { slug: candidate },
		});

		if (!existing) {
			return candidate;
		}
	}

	throw new ConflictException(COURSE_MESSAGE.slugExists);
};
