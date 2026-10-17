import { downloadSubmissionFile } from '@/apis/assessment';
import type { SubmissionFile } from '@/types';

/**
 * Tiện ích dùng chung cho tệp bài nộp (yêu cầu 4.4) — học viên và giảng viên cùng dùng, nên định
 * nghĩa một lần ở đây thay vì chép lại ở hai trang.
 */

/** Dung lượng dạng người đọc được: `2,4 MB`, `512 KB`. */
export const formatFileSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Tải tệp bài nộp xuống máy.
 *
 * Đi qua axios + blob URL (không dùng `<a href="/api/submission-files/:id/download">`) vì endpoint
 * này **yêu cầu token**: mở bằng thẻ `<a>` sẽ là một request không có header `Authorization` và
 * nhận `401` — khác học liệu, vốn được phục vụ tĩnh công khai.
 */
export const downloadSubmissionFileToDisk = async (
	file: SubmissionFile,
): Promise<void> => {
	const blob = await downloadSubmissionFile(file.id);
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = file.originalName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Thu hồi URL sau khi trình duyệt đã bắt đầu tải; giữ lại sẽ rò rỉ bộ nhớ theo mỗi lần tải.
	URL.revokeObjectURL(objectUrl);
};
