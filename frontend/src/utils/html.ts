import DOMPurify from 'dompurify';

/**
 * Làm sạch HTML trước khi hiển thị bằng `dangerouslySetInnerHTML` (E3-T8).
 *
 * **Vì sao bắt buộc:** nội dung bài học được giảng viên soạn bằng `RichTextEditor` (TipTap) và lưu
 * nguyên chuỗi HTML vào `lessons.content`. `RichTextEditor` trả HTML **thô** — kể cả chế độ "Mã
 * HTML" cho phép gõ tay — nên nếu render thẳng thì một tài khoản giảng viên có thể đặt
 * `<img onerror=...>`/`<script>` và đoạn mã đó chạy trong phiên của **mọi học viên** mở bài
 * (stored XSS). Lọc ở đây là chốt chặn phía người xem.
 *
 * **Vì sao allowlist chứ không blocklist:** chỉ cho phép đúng những thẻ/ thuộc tính mà TipTap sinh
 * ra. Thẻ mới lạ (kể cả thẻ của tương lai) mặc định bị loại — an toàn theo hướng ngược lại với
 * blocklist, vốn luôn thiếu một trường hợp.
 *
 * `DOMPurify` cũng chặn sẵn các scheme nguy hiểm (`javascript:`, `data:` trong `href`/`src`) nên
 * không cần tự kiểm tra URL.
 */
const ALLOWED_TAGS = [
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'strong',
	'b',
	'em',
	'i',
	'u',
	's',
	'strike',
	'ul',
	'ol',
	'li',
	'blockquote',
	'code',
	'pre',
	'a',
	'span',
	'mark',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
];

const ALLOWED_ATTR = [
	'href',
	'target',
	'rel',
	'class',
	'style',
	// TipTap Highlight lưu màu ở `data-color`.
	'data-color',
	'colspan',
	'rowspan',
];

/** Bỏ qua hoàn toàn nội dung của các thẻ này thay vì chỉ bỏ thẻ. */
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form'];

export const sanitizeHtml = (html: string | null | undefined): string => {
	if (!html) return '';

	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		FORBID_TAGS,
		// Không cho `target="_blank"` thiếu `rel` (tabnabbing) — DOMPurify thêm `noopener` khi bật.
		ADD_ATTR: ['rel'],
	});
};

/**
 * Rút trích văn bản thuần để hiển thị tóm tắt/danh sách mà không cần render HTML.
 *
 * Dùng `DOMParser` (không phải regex) vì regex trên HTML là cách chắc chắn sai; hàm này chỉ để
 * hiển thị nên không cần bảo toàn cấu trúc.
 */
export const htmlToPlainText = (html: string | null | undefined): string => {
	if (!html) return '';
	const document = new DOMParser().parseFromString(html, 'text/html');

	return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};
