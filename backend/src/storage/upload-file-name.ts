/**
 * Giải mã tên tệp nhận từ `multipart/form-data`.
 *
 * **Vì sao cần:** busboy (bộ phân tích mà multer dùng) đọc tham số `filename` trong
 * `Content-Disposition` theo **latin1** (giá trị mặc định của `defParamCharset`), trong khi trình
 * duyệt gửi tên tệp bằng **UTF-8**. Hệ quả thực tế với dự án này: học viên tải lên "Báo cáo.pdf"
 * nhưng `original_name` lưu vào DB là "BÃ¡o cÃ¡o.pdf", rồi hiện nguyên như vậy ở tên tệp khi giảng
 * viên tải xuống. Lỗi này chỉ lộ ra khi tên tệp có dấu — tức là gần như mọi bài nộp tiếng Việt.
 *
 * **Cách nhận biết để không phá tên đúng:** chỉ giải mã khi chuỗi **toàn ký tự latin1**
 * (`<= U+00FF`). Nếu tên đã là Unicode đúng (có ký tự `> U+00FF`) thì đó không phải trường hợp bị
 * hiểu nhầm, giữ nguyên. Sau khi giải mã, sự xuất hiện của `U+FFFD` nghĩa là chuỗi gốc không phải
 * UTF-8 hợp lệ ⇒ trả lại bản gốc thay vì trả một tên đã hỏng.
 */
export const decodeUploadFileName = (name: string): string => {
	if (!name) return name;
	// eslint-disable-next-line no-control-regex
	if (/[^\u0000-\u00ff]/.test(name)) return name;

	const decoded = Buffer.from(name, 'latin1').toString('utf8');
	return decoded.includes('\uFFFD') ? name : decoded;
};
