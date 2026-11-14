import {
	compareVersions,
	courseRef,
	isValidCourseCode,
	parseCatalogKey,
	pickLatestVersion,
	skillKey,
} from './catalog-ref';

describe('catalog-ref', () => {
	it('dựng và tách khoá kỹ năng', () => {
		const ref = courseRef(' co1023 ', '9.1');
		expect(ref).toBe('CO1023@9.1');
		const key = skillKey(ref, 3, 4);
		expect(key).toBe('CO1023@9.1#3.4');
		expect(parseCatalogKey(key)).toEqual({
			courseCode: 'CO1023',
			version: '9.1',
			local: '3.4',
		});
		expect(parseCatalogKey('CO1023@9.1#L.O.2.1')?.local).toBe('L.O.2.1');
		expect(parseCatalogKey('CO1023@9.1')).toEqual({
			courseCode: 'CO1023',
			version: '9.1',
			local: null,
		});
	});

	it('từ chối khoá sai định dạng', () => {
		expect(parseCatalogKey('CO1023')).toBeNull();
		expect(parseCatalogKey('CO1023@abc#1.1')).toBeNull();
		expect(parseCatalogKey('CO1023@9.1#')).toBeNull();
		expect(isValidCourseCode("CO1023'; drop table x;--")).toBe(false);
	});

	it('so sánh phiên bản theo số, không theo chuỗi', () => {
		expect(compareVersions('10.1', '9.1')).toBeGreaterThan(0);
		expect(compareVersions('9.1', '9.10')).toBeLessThan(0);
		expect(compareVersions('2', '2.0')).toBe(0);
	});

	it('chọn bản hiện hành theo học kỳ áp dụng rồi tới số phiên bản', () => {
		const pick = (rows: { version: string; appliesFrom: string | null }[]) =>
			pickLatestVersion(rows)?.version;
		expect(
			pick([
				{ version: '10.1', appliesFrom: '241' },
				{ version: '9.1', appliesFrom: '251' },
			]),
		).toBe('9.1');
		expect(
			pick([
				{ version: '9.1', appliesFrom: '251' },
				{ version: '10.1', appliesFrom: '251' },
			]),
		).toBe('10.1');
		expect(
			pick([
				{ version: '11.1', appliesFrom: null },
				{ version: '3.1', appliesFrom: '201' },
			]),
		).toBe('3.1');
		expect(pickLatestVersion([])).toBeNull();
	});
});
