import { courseRef, outcomeKey, skillKey, topicKey } from './catalog-ref';
import type {
	CatalogOutline,
	LocalizedText,
	RawAssessmentPart,
	RawOutlineContent,
	RawSession,
	SkillGraph,
	SkillGraphEdge,
	SkillGraphOutcome,
	SkillGraphSkill,
	SkillGraphTopic,
} from './catalog.types';

/**
 * Dựng đồ thị kỹ năng từ đề cương — **hàm thuần**, không gọi DB hay AI.
 *
 * Nguồn là `sessions[].content` (văn bản từng buổi học). Dữ liệu thật không đồng nhất, ví dụ:
 *
 *   CO1023:  "Chương 3. Mạch luận lý tổ hợp\n3.1. Các dạng chuẩn…\n3.4. Phương pháp bìa Karnaugh"
 *   CO2003:  "Cấu trúc cây cơ bản\n+ Kiến thức chung về cây\n++ Giới thiệu về cây…\n+ Bài tập"
 *   CO2017:  "Hệ thống tập tin\n- Giao diện…\nHệ thống lưu trữ thứ cấp\n- Giới thiệu…"
 *
 * Quy tắc:
 *   - Dòng "Chương N. …" hoặc dòng thường (không gạch đầu dòng) mở một **chủ đề** mới.
 *   - Dòng gạch đầu dòng (`-`, `+`, `++`, `•`…) hoặc đánh số (`3.4.`) là một **kỹ năng**.
 *     Mục có mục con sâu hơn (`+` có `++` theo sau) chỉ là nhóm — giữ các mục con.
 *   - Bỏ dòng hành chính: "Bài tập", "Ôn tập", "Kiểm tra giữa kỳ", "Sinh viên: …".
 *   - Khối "Bài thí nghiệm/thực hành …" bị bỏ qua tới chủ đề "Chương" kế tiếp (đó là hoạt
 *     động, không phải khái niệm để đo thành thạo).
 *   - Chủ đề không có mục con trở thành một kỹ năng duy nhất mang tên chủ đề.
 *
 * Điều kiện tiên quyết mặc định: chủ đề trước → chủ đề sau, và môn tiên quyết → chủ đề đầu.
 * Cạnh chi tiết hơn giữa các kỹ năng (vd "bìa Karnaugh" cần "SOP/POS") do UniPrep bổ sung sau.
 */

export type CatalogLanguage = 'vi' | 'en';

export interface ParsedTopic {
	title: string;
	items: { name: string; label: string | null }[];
}

const MAX_NAME_LENGTH = 300;

const NOISE_PATTERN =
	/^(bài tập|ôn tập|ôn thi|kiểm tra|thi giữa|thi cuối|giải đề|sinh viên\s*:|review|revision|exercises?\b|homework|midterm|mid-term|final exam|quiz\b)/i;
const LAB_PATTERN =
	/^((bài|buổi)\s+)?(thí nghiệm|thực hành)|^(lab|laboratory|practice)\b/i;
const CHAPTER_PATTERN =
	/^(chương|chapter|phần|part|bài|lesson|unit)\s*(\d+|[IVXLC]+)\b[\s.:)\-–]*(.*)$/i;
const BULLET_PATTERN = /^(\+{1,3}|[-–—•*●▪◦○])\s*(.+)$/;
const MULTI_NUMBER_PATTERN = /^(\d+(?:\.\d+)+)\.?\s+(.+)$/;
const SINGLE_NUMBER_PATTERN = /^(\d+|[a-z])[.)]\s+(.+)$/i;

function pickText(
	text: Partial<LocalizedText> | null | undefined,
	lang: CatalogLanguage,
): string {
	const primary = text?.[lang];
	const fallback = text?.[lang === 'vi' ? 'en' : 'vi'];
	return (primary && primary.trim()) || (fallback && fallback.trim()) || '';
}

function cleanName(text: string): string {
	const cleaned = text
		.replace(/\s+/g, ' ')
		.replace(/[\s.;:,]+$/, '')
		.trim();
	return cleaned.length > MAX_NAME_LENGTH
		? `${cleaned.slice(0, MAX_NAME_LENGTH - 1)}…`
		: cleaned;
}

function isNoise(text: string): boolean {
	return NOISE_PATTERN.test(text.trim());
}

interface RawItem {
	name: string;
	label: string | null;
	depth: number;
}

interface RawTopic {
	title: string;
	raw: RawItem[];
}

/** Tách văn bản một buổi học thành các chủ đề và mục con. */
export function parseSessionText(text: string): ParsedTopic[] {
	const topics: RawTopic[] = [];
	let current: RawTopic | null = null;
	let inLab = false;

	const openTopic = (title: string): RawTopic => {
		const topic = { title: cleanName(title), raw: [] };
		topics.push(topic);
		return topic;
	};

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		const chapter = CHAPTER_PATTERN.exec(line);
		// "Bài thí nghiệm 1" khớp cả CHAPTER lẫn LAB — LAB thắng.
		if (LAB_PATTERN.test(line) || (chapter && LAB_PATTERN.test(chapter[3]))) {
			inLab = true;
			current = null;
			continue;
		}
		if (chapter) {
			current = openTopic(chapter[3] ? chapter[3] : line);
			inLab = false;
			continue;
		}
		if (inLab) continue;

		const bullet = BULLET_PATTERN.exec(line);
		const multi = bullet ? null : MULTI_NUMBER_PATTERN.exec(line);
		const single =
			bullet || multi || !current ? null : SINGLE_NUMBER_PATTERN.exec(line);

		let item: RawItem | null = null;
		if (bullet) {
			const marker = bullet[1];
			item = {
				name: bullet[2],
				label: null,
				depth: marker.startsWith('+') ? marker.length : 1,
			};
		} else if (multi) {
			item = { name: multi[2], label: multi[1], depth: 1 };
		} else if (single) {
			item = { name: single[2], label: single[1], depth: 1 };
		}

		if (item) {
			if (isNoise(item.name)) continue;
			if (!current) {
				// Mục con xuất hiện trước mọi tiêu đề: coi chính nó là chủ đề.
				current = openTopic(item.name);
				continue;
			}
			current.raw.push(item);
			continue;
		}

		if (isNoise(line)) continue;
		current = openTopic(line);
	}

	return topics
		.filter((topic) => topic.title && !isNoise(topic.title))
		.map((topic) => ({ title: topic.title, items: flattenGroups(topic.raw) }));
}

/** Bỏ các mục chỉ đóng vai nhóm (có mục con sâu hơn ngay sau), loại trùng tên. */
function flattenGroups(raw: RawItem[]): ParsedTopic['items'] {
	const seen = new Set<string>();
	const result: ParsedTopic['items'] = [];
	raw.forEach((item, index) => {
		const next = raw[index + 1];
		if (next && next.depth > item.depth) return;
		const name = cleanName(item.name);
		const norm = name.toLowerCase();
		if (!name || seen.has(norm)) return;
		seen.add(norm);
		result.push({ name, label: item.label });
	});
	return result;
}

function sessionOutcomeCodes(
	session: RawSession,
	outcomeCodeByKey: Map<string, string>,
): string[] {
	const codes = new Set<string>();
	for (const item of session.items ?? []) {
		const raw = item.outcome_key?.trim();
		if (!raw) continue;
		// `outcome_key` có dạng `LO:L.O.1.1`; ánh xạ về `code` của chuẩn đầu ra.
		const code = outcomeCodeByKey.get(raw) ?? raw.replace(/^[A-Z]+:/, '');
		codes.add(code);
	}
	return [...codes];
}

function buildAssessment(content: RawOutlineContent): SkillGraph['assessment'] {
	const weights: Record<string, number> = {};
	for (const [key, value] of Object.entries(
		content.assessment?.weights ?? {},
	)) {
		if (typeof value === 'number' && Number.isFinite(value))
			weights[key] = value;
	}
	const part = (raw: RawAssessmentPart | null) =>
		raw
			? {
					format: raw.format?.name?.vi ?? raw.format?.code ?? null,
					durationMinutes:
						typeof raw.duration_minutes === 'number'
							? raw.duration_minutes
							: null,
				}
			: null;
	return {
		weights,
		midterm: part(content.assessment?.midterm ?? null),
		finalExam: part(content.assessment?.final_exam ?? null),
	};
}

/** Quan hệ giữa môn không dùng làm điều kiện tiên quyết (học song song). */
const NON_BLOCKING_RELATIONS = new Set(['corequisite']);

export function buildSkillGraph(
	outline: CatalogOutline,
	lang: CatalogLanguage = 'vi',
): SkillGraph {
	const ref = courseRef(outline.courseCode, outline.version);
	const content = outline.content;

	const outcomeCodeByKey = new Map<string, string>();
	const outcomes: SkillGraphOutcome[] = (content.learning_outcomes ?? [])
		.filter((lo) => lo && lo.code)
		.map((lo) => {
			outcomeCodeByKey.set(lo.key, lo.code);
			return {
				key: outcomeKey(ref, lo.code),
				code: lo.code,
				parentCode: lo.parent_code ?? null,
				level: typeof lo.level === 'number' ? lo.level : null,
				name:
					pickText(lo.name, lang) || pickText(lo.description, lang) || lo.code,
			};
		});
	const knownOutcomes = new Set(outcomes.map((lo) => lo.code));

	const sessions = [...(content.sessions ?? [])].sort(
		(a, b) => (a.order ?? 0) - (b.order ?? 0),
	);

	const topics: SkillGraphTopic[] = [];
	const skills: SkillGraphSkill[] = [];

	for (const session of sessions) {
		const outcomeKeys = sessionOutcomeCodes(session, outcomeCodeByKey)
			.filter((code) => knownOutcomes.has(code))
			.map((code) => outcomeKey(ref, code));

		for (const parsed of parseSessionText(pickText(session.content, lang))) {
			const index = topics.length + 1;
			const tKey = topicKey(ref, index);
			const items = parsed.items.length
				? parsed.items
				: [{ name: parsed.title, label: null }];
			const topicSkills = items.map((item, i) => ({
				key: skillKey(ref, index, i + 1),
				topicKey: tKey,
				order: i + 1,
				name: item.name,
				label: item.label,
				outcomeKeys,
			}));
			skills.push(...topicSkills);
			topics.push({
				key: tKey,
				index,
				title: parsed.title,
				sessionLabel: session.label?.trim() || null,
				outcomeKeys,
				skillKeys: topicSkills.map((skill) => skill.key),
			});
		}
	}

	const edges: SkillGraphEdge[] = [];
	for (let i = 1; i < topics.length; i += 1) {
		edges.push({
			from: topics[i - 1].key,
			to: topics[i].key,
			source: 'topic_order',
			relation: null,
		});
	}
	if (topics.length) {
		for (const prereq of outline.prerequisites) {
			if (prereq.type && NON_BLOCKING_RELATIONS.has(prereq.type)) continue;
			edges.push({
				from: prereq.courseCode,
				to: topics[0].key,
				source: 'cross_course',
				relation: prereq.type,
			});
		}
	}

	return {
		courseRef: ref,
		courseCode: outline.courseCode,
		version: outline.version,
		name: outline.name,
		outcomes,
		topics,
		skills,
		edges,
		prerequisites: outline.prerequisites,
		assessment: buildAssessment(content),
	};
}
