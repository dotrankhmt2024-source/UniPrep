/**
 * Khoá tham chiếu từ dữ liệu của UniPrep sang Catalog.
 *
 * Hai DB không có khoá ngoại với nhau, nên bảng của UniPrep (mức thành thạo, câu hỏi…) lưu một
 * chuỗi ổn định, **gắn phiên bản đề cương** để dữ liệu cũ vẫn khớp khi trường ra bản mới:
 *
 *   môn học      CO1023@9.1
 *   chủ đề       CO1023@9.1#T3
 *   kỹ năng      CO1023@9.1#3.4
 *   chuẩn đầu ra CO1023@9.1#L.O.2.1
 */

/** Mã môn của trường: chữ, số, `_` `-` `.`; 2–20 ký tự. */
export const COURSE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,19}$/;
/** Phiên bản đề cương: `9.1`, `14.1`, `2`… */
export const OUTLINE_VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/;

const COURSE_REF_PATTERN =
	/^([A-Za-z0-9][A-Za-z0-9_.-]{1,19})@(\d{1,4}(?:\.\d{1,4}){0,3})$/;

export interface ParsedCatalogKey {
	courseCode: string;
	version: string;
	/** Phần sau `#`; `null` khi đây là khoá của cả môn. */
	local: string | null;
}

export function normalizeCourseCode(code: string): string {
	return code.trim().toUpperCase();
}

export function isValidCourseCode(code: string): boolean {
	return COURSE_CODE_PATTERN.test(code.trim());
}

export function isValidOutlineVersion(version: string): boolean {
	return OUTLINE_VERSION_PATTERN.test(version.trim());
}

export function courseRef(courseCode: string, version: string): string {
	return `${normalizeCourseCode(courseCode)}@${version.trim()}`;
}

export function topicKey(ref: string, topicIndex: number): string {
	return `${ref}#T${topicIndex}`;
}

export function skillKey(
	ref: string,
	topicIndex: number,
	order: number,
): string {
	return `${ref}#${topicIndex}.${order}`;
}

export function outcomeKey(ref: string, outcomeCode: string): string {
	return `${ref}#${outcomeCode}`;
}

/** Tách một khoá Catalog; trả `null` nếu sai định dạng. */
export function parseCatalogKey(key: string): ParsedCatalogKey | null {
	const hash = key.indexOf('#');
	const refPart = hash === -1 ? key : key.slice(0, hash);
	const local = hash === -1 ? null : key.slice(hash + 1);
	const match = COURSE_REF_PATTERN.exec(refPart);
	if (!match || local === '') return null;
	return { courseCode: match[1].toUpperCase(), version: match[2], local };
}

/**
 * Chọn phiên bản đề cương "hiện hành": học kỳ áp dụng (`applies_from`, vd `261`) lớn nhất, rồi
 * tới số phiên bản lớn nhất. Học kỳ thiếu được xếp sau mọi học kỳ có giá trị.
 */
export function pickLatestVersion<
	T extends { version: string; appliesFrom: string | null },
>(versions: readonly T[]): T | null {
	const semester = (value: string | null) => {
		const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);
		return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
	};
	let best: T | null = null;
	for (const candidate of versions) {
		if (
			!best ||
			semester(candidate.appliesFrom) > semester(best.appliesFrom) ||
			(semester(candidate.appliesFrom) === semester(best.appliesFrom) &&
				compareVersions(candidate.version, best.version) > 0)
		) {
			best = candidate;
		}
	}
	return best;
}

/**
 * So sánh hai phiên bản theo từng phần số (`10.1` > `9.1`, khác với so sánh chuỗi).
 * Trả số âm nếu `a` cũ hơn `b`.
 */
export function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
	const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}
