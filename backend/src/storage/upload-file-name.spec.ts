import { decodeUploadFileName } from './upload-file-name';

describe('decodeUploadFileName', () => {
	it('recovers a UTF-8 Vietnamese name that busboy decoded as latin1', () => {
		// Đây đúng là chuỗi mà multer trả về khi trình duyệt gửi "Báo cáo đồ án.pdf".
		const mangled = Buffer.from('Báo cáo đồ án.pdf', 'utf8').toString('latin1');
		expect(decodeUploadFileName(mangled)).toBe('Báo cáo đồ án.pdf');
	});

	it('keeps an ASCII name untouched', () => {
		expect(decodeUploadFileName('report-final.pdf')).toBe('report-final.pdf');
	});

	it('keeps a name that already contains real Unicode outside latin1', () => {
		expect(decodeUploadFileName('báo-cáo-đồ-án.pdf')).toBe('báo-cáo-đồ-án.pdf');
		// Ký tự ngoài latin1 (U+0111) ⇒ tên đã đúng, không được giải mã lần nữa.
		expect(decodeUploadFileName('đồ-án.pdf')).toBe('đồ-án.pdf');
	});

	it('returns the original when the bytes are not valid UTF-8', () => {
		// Byte 0xE1 đứng một mình không tạo thành ký tự UTF-8 hợp lệ.
		expect(decodeUploadFileName('caf\u00e9\u00e1.pdf')).toBe(
			'caf\u00e9\u00e1.pdf',
		);
	});

	it('handles empty and undefined-like input safely', () => {
		expect(decodeUploadFileName('')).toBe('');
	});
});
