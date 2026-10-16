import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { MaterialType } from '../common/types';

/**
 * Bảng ánh xạ MIME → đuôi tệp + loại học liệu (E3-T4).
 *
 * Vì sao là **bảng đóng** thay vì suy đuôi từ `originalname`: tên tệp do client gửi, có thể là
 * `bai-giang.pdf.exe` hoặc `../../evil.php`. Ở đây đuôi tệp được tra từ MIME mà multer đọc được,
 * còn `originalname` chỉ dùng làm phương án dự phòng cuối cùng (xem `resolveExtension`). Đây cũng
 * là whitelist duy nhất: MIME không có trong bảng bị từ chối `415`, nên không có đường nào để ghi
 * một định dạng không mong muốn lên đĩa.
 */
export const UPLOAD_MIME_MAP: Record<
	string,
	{ ext: string; materialType: MaterialType }
> = {
	'application/pdf': { ext: '.pdf', materialType: 'slide' },
	'application/vnd.ms-powerpoint': { ext: '.ppt', materialType: 'slide' },
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
		ext: '.pptx',
		materialType: 'slide',
	},
	'application/msword': { ext: '.doc', materialType: 'file' },
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
		ext: '.docx',
		materialType: 'file',
	},
	'application/zip': { ext: '.zip', materialType: 'file' },
	'video/mp4': { ext: '.mp4', materialType: 'video' },
	'image/png': { ext: '.png', materialType: 'file' },
	'image/jpeg': { ext: '.jpg', materialType: 'file' },
};

/** Nhãn tiếng Việt của từng định dạng — dùng cho thông báo `415`/`413` và cho Swagger. */
export const UPLOAD_MIME_LABEL: Record<string, string> = {
	'application/pdf': 'PDF',
	'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation':
		'PowerPoint (.pptx)',
	'application/msword': 'Word (.doc)',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
		'Word (.docx)',
	'application/zip': 'ZIP',
	'video/mp4': 'Video MP4',
	'image/png': 'Ảnh PNG',
	'image/jpeg': 'Ảnh JPEG',
};

/** MIME hợp lệ, theo thứ tự khai báo ở `UPLOAD_MIME_MAP` (ổn định cho thông báo lỗi). */
export const ALLOWED_UPLOAD_MIME_TYPES: string[] = Object.keys(UPLOAD_MIME_MAP);

/**
 * Mẫu tin nhắn tệp không hợp lệ — dùng chung với `LessonService` để hai nơi không lệch câu chữ.
 */
export const INVALID_FILE_NAME_MESSAGE = 'Tên tệp không hợp lệ.';
export const MISSING_FILE_MESSAGE = 'Vui lòng chọn tệp để tải lên.';

/** Đuôi tệp hợp lệ để làm phương án dự phòng khi MIME không có trong bảng. */
const SAFE_EXTENSION = /\.[a-z0-9]{1,8}$/i;

export interface SaveBufferParams {
	folder: string;
	originalName: string;
	buffer: Buffer;
	mimeType: string;
}

export interface SavedFile {
	storageKey: string;
	fileUrl: string;
	sizeBytes: number;
}

/**
 * Lưu tệp học liệu lên đĩa cục bộ (E3-T4).
 *
 * **Vì sao tách thành module `@Global()` riêng:** `LessonModule` cần ghi tệp, và các module sau
 * (E12 xuất báo cáo, E4 import đề thi) cũng vậy. Nếu mỗi nơi tự `fs.writeFile` thì quy tắc an toàn
 * đường dẫn và giới hạn dung lượng sẽ bị chép lại nhiều bản, chỉ cần một bản quên là hở traversal.
 *
 * **Mọi thành phần đường dẫn đều do server sinh:** thư mục là tham số do code gọi (không phải
 * client), tên tệp là `randomUUID()` + đuôi tra từ MIME. `originalName` **không bao giờ** được nối
 * vào đường dẫn — đó là quy tắc chống path traversal ở tầng gốc.
 */
@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name);

	private readonly uploadDir: string;
	private readonly publicBaseUrl: string;
	private readonly maxUploadSizeMb: number;

	constructor(private readonly configService: ConfigService) {
		this.uploadDir =
			this.configService.get<string>('UPLOAD_DIR')?.trim() || './uploads';
		this.publicBaseUrl =
			this.configService.get<string>('PUBLIC_BASE_URL')?.trim() ||
			'http://localhost:3000';

		// `ConfigService.get` trả chuỗi thô từ `.env`, nên phải tự ép số và tự chặn giá trị vô lý:
		// `MAX_UPLOAD_SIZE_MB=abc` mà không kiểm tra sẽ cho ra `NaN`, và mọi so sánh `size > NaN`
		// đều là `false` ⇒ giới hạn dung lượng âm thầm biến mất.
		const parsed = Number(
			this.configService.get<string>('MAX_UPLOAD_SIZE_MB') ?? '',
		);
		this.maxUploadSizeMb = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
	}

	/** Giới hạn dung lượng một tệp, tính bằng byte (mặc định 50 MB). */
	get maxSizeBytes(): number {
		return this.maxUploadSizeMb * 1024 * 1024;
	}

	get maxSizeMb(): number {
		return this.maxUploadSizeMb;
	}

	async saveBuffer(params: SaveBufferParams): Promise<SavedFile> {
		const { folder, originalName, buffer, mimeType } = params;

		if (!this.isSafeName(originalName)) {
			throw new BadRequestException(INVALID_FILE_NAME_MESSAGE);
		}

		const extension = this.resolveExtension(originalName, mimeType);
		// Tên tệp do server sinh: cùng một tệp tải lên hai lần không ghi đè nhau, và không có tham
		// số nào của client ảnh hưởng tới đường dẫn ghi.
		const fileName = `${randomUUID()}${extension}`;
		const directory = join(this.uploadDir, folder);

		await mkdir(directory, { recursive: true });
		await writeFile(join(directory, fileName), buffer);

		const storageKey = `${folder}/${fileName}`;

		return {
			storageKey,
			fileUrl: `${this.cleanBaseUrl()}/uploads/${storageKey}`,
			sizeBytes: buffer.length,
		};
	}

	/**
	 * Xoá tệp theo `storageKey` — **best-effort**.
	 *
	 * Không ném lỗi khi tệp không còn: bản ghi trong DB là nguồn chân lý, còn tệp mồ côi chỉ tốn
	 * đĩa. Nếu ném lỗi ở đây thì một lần xoá học liệu có thể thất bại sau khi hàng DB đã bị xoá,
	 * để lại trạng thái nửa vời khó dọn hơn nhiều.
	 */
	async remove(storageKey: string): Promise<void> {
		if (!storageKey) return;

		if (isAbsolute(storageKey) || !this.isSafeRelativeKey(storageKey)) {
			// Phòng thủ nhiều lớp: khoá trong DB do server sinh, nhưng nếu dữ liệu bị sửa tay thì
			// tuyệt đối không được `unlink` một đường dẫn nằm ngoài `UPLOAD_DIR`.
			this.logger.warn(`Từ chối xoá tệp với khoá không hợp lệ: ${storageKey}`);
			return;
		}

		try {
			await unlink(join(this.uploadDir, storageKey));
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT') {
				this.logger.warn(`Không xoá được tệp ${storageKey}: ${String(error)}`);
			}
		}
	}

	/** Đuôi tệp lấy từ bảng MIME; chỉ khi MIME lạ mới dùng đuôi của tên gốc (và phải "trông" an toàn). */
	private resolveExtension(originalName: string, mimeType: string): string {
		const mapped = UPLOAD_MIME_MAP[mimeType];
		if (mapped) return mapped.ext;

		const matched = SAFE_EXTENSION.exec(originalName);
		return matched ? matched[0].toLowerCase() : '';
	}

	/** Chặn `../`, đường dẫn tuyệt đối, byte NUL — trước khi tên gốc được dùng vào bất cứ việc gì. */
	private isSafeName(name: string): boolean {
		if (!name || name.length > 255) return false;
		if (name.includes('\0')) return false;

		return !name.includes('/') && !name.includes('\\') && !name.includes('..');
	}

	/** Khoá lưu trữ phải là đường dẫn tương đối, không chứa `..`. */
	private isSafeRelativeKey(key: string): boolean {
		if (key.includes('\0') || key.includes('..')) return false;

		// Trên Windows cả `\` lẫn `/` đều là dấu phân cách, nên chặn cả hai.
		return !key.split(/[\\/]+/).some((segment) => segment === '');
	}

	private cleanBaseUrl(): string {
		return this.publicBaseUrl.replace(/\/+$/, '');
	}
}
