import {
	SUBMISSION_FILE_VIEW_TTL_SECONDS,
	signSubmissionFileToken,
	verifySubmissionFileToken,
} from './submission-file-token';

const SECRET = 'test-secret';
const FILE_A = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const FILE_B = 'ffffffff-1111-4222-8333-444444444444';

describe('submission file view token', () => {
	it('accepts a freshly signed token', () => {
		expect(
			verifySubmissionFileToken(
				SECRET,
				FILE_A,
				signSubmissionFileToken(SECRET, FILE_A),
			),
		).toBe(true);
	});

	it('rejects a token once its expiry has passed', () => {
		const now = Date.now();
		const token = signSubmissionFileToken(
			SECRET,
			FILE_A,
			SUBMISSION_FILE_VIEW_TTL_SECONDS,
			now,
		);
		const later = now + (SUBMISSION_FILE_VIEW_TTL_SECONDS + 1) * 1000;
		expect(verifySubmissionFileToken(SECRET, FILE_A, token, later)).toBe(false);
	});

	it('rejects a token issued for another file', () => {
		expect(
			verifySubmissionFileToken(
				SECRET,
				FILE_B,
				signSubmissionFileToken(SECRET, FILE_A),
			),
		).toBe(false);
	});

	it('rejects a token signed with a different secret', () => {
		expect(
			verifySubmissionFileToken(
				'other-secret',
				FILE_A,
				signSubmissionFileToken(SECRET, FILE_A),
			),
		).toBe(false);
	});

	it('rejects a tampered signature', () => {
		const [exp, sig] = signSubmissionFileToken(SECRET, FILE_A).split('.');
		const flipped = sig.endsWith('A') ? 'B' : 'A';
		expect(
			verifySubmissionFileToken(
				SECRET,
				FILE_A,
				`${exp}.${sig.slice(0, -1)}${flipped}`,
			),
		).toBe(false);
	});

	it('returns false instead of throwing on malformed input', () => {
		for (const bad of [
			'',
			'abc',
			'.',
			'123',
			'.sig',
			'123.',
			'abc.def',
			'123.!!!',
		]) {
			expect(() =>
				verifySubmissionFileToken(SECRET, FILE_A, bad),
			).not.toThrow();
			expect(verifySubmissionFileToken(SECRET, FILE_A, bad)).toBe(false);
		}
	});

	/**
	 * Case riêng cho nhánh **so sánh chữ ký**: các chuỗi ở test trên đều bị loại ngay ở bước kiểm
	 * `exp` (đã hết hạn / không phải số), nên nhánh này chưa từng được chạy. Dùng `exp` còn hạn để
	 * chắc chắn hàm đi tới `timingSafeEqual` rồi trả `false` (không ném vì lệch độ dài buffer).
	 */
	it('rejects a valid-looking expiry with a garbage signature', () => {
		const futureExp = Math.floor(Date.now() / 1000) + 60;
		expect(() =>
			verifySubmissionFileToken(SECRET, FILE_A, `${futureExp}.!!!`),
		).not.toThrow();
		expect(verifySubmissionFileToken(SECRET, FILE_A, `${futureExp}.!!!`)).toBe(
			false,
		);
		expect(verifySubmissionFileToken(SECRET, FILE_A, `${futureExp}.`)).toBe(
			false,
		);
	});
});
