import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token **capability** ngắn hạn để mở một tệp bài nộp bằng URL thường (route `@Public()`).
 *
 * **Vì sao cần:** `<a target="_blank">` không gửi header `Authorization`, nên nếu chỉ có route Bearer
 * thì trình duyệt không thể render tệp. **Vì sao không nhét access token vào `?token=`:** access token
 * là thẻ toàn quyền 15 phút cho mọi endpoint — lọt vào history/log là mất cả phiên. Token ở đây chỉ
 * mở được **đúng một `fileId`**, có hạn, và được ký HMAC trên `JWT_SECRET` với tiền tố `SCOPE`
 * (domain separation) nên không thể bị dùng lẫn với JWT.
 */

/**
 * Hạn của token: **15 phút**.
 *
 * Vì sao không ngắn hơn (5 phút): link được phát một lần lúc FE tải danh sách tệp, mà giảng viên có
 * thể mở danh sách rồi chấm một lúc mới bấm "Xem" — link hết hạn giữa phiên chấm là lỗi khó hiểu cho
 * người dùng. Vì sao không dài hơn: token **không thu hồi được** (không lưu DB), nên thời gian sống
 * chính là cửa sổ rò rỉ nếu URL lọt ra ngoài; 15 phút là mức đủ cho một phiên chấm bài.
 */
export const SUBMISSION_FILE_VIEW_TTL_SECONDS = 900;

/** Domain separation: chữ ký của tệp không bao giờ trùng với chữ ký JWT access/refresh. */
const SCOPE = 'submission-file:';

const signature = (secret: string, fileId: string, exp: number): string =>
	createHmac('sha256', secret)
		.update(`${SCOPE}${fileId}.${exp}`)
		.digest('base64url');

/** Sinh token dạng `<exp>.<hmac>` — không cần DB, chỉ cần secret và `fileId`. */
export const signSubmissionFileToken = (
	secret: string,
	fileId: string,
	ttlSeconds = SUBMISSION_FILE_VIEW_TTL_SECONDS,
	now = Date.now(),
): string => {
	const exp = Math.floor(now / 1000) + ttlSeconds;
	return `${exp}.${signature(secret, fileId, exp)}`;
};

/**
 * Kiểm token: đúng chữ ký, chưa hết hạn, và **đúng tệp**.
 *
 * Trả `false` cho **mọi** trường hợp sai — không ném — để nơi gọi tự đổi thành `401` và không bao giờ
 * lộ lý do cụ thể (kẻ dò token không phân biệt được "sai chữ ký" với "hết hạn").
 */
export const verifySubmissionFileToken = (
	secret: string,
	fileId: string,
	token: string,
	now = Date.now(),
): boolean => {
	// Query `?token=` là tuỳ chọn ở tầng route nên giá trị có thể rỗng/không có.
	if (!token) return false;

	const [rawExp, rawSig] = token.split('.');
	if (!rawExp || !rawSig) return false;
	const exp = Number(rawExp);
	if (!Number.isInteger(exp) || exp * 1000 <= now) return false;

	const expected = Buffer.from(signature(secret, fileId, exp));
	const actual = Buffer.from(rawSig);
	// Phải so sánh độ dài trước: `timingSafeEqual` ném lỗi khi hai buffer khác độ dài.
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
};
