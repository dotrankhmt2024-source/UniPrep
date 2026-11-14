/**
 * Kiểu dữ liệu của Catalog service — nguồn "nội dung môn học" bên ngoài UniPrep.
 *
 * Catalog là DB đề cương của trường (Supabase, schema `bk_uni`), UniPrep chỉ **đọc**. Mọi dữ
 * liệu người học (kỹ năng đã nắm, câu hỏi, lượt làm bài, phiên thi) nằm trong DB của UniPrep và
 * tham chiếu sang Catalog bằng khoá chuỗi (xem `catalog-ref.ts`), không có khoá ngoại xuyên DB.
 */

/** Chuỗi song ngữ như trong jsonb đề cương. Một trong hai có thể `null`. */
export interface LocalizedText {
	vi: string | null;
	en: string | null;
}

/** Phần `content` (jsonb) của `course_outlines` — chỉ khai báo các trường UniPrep dùng. */
export interface RawOutlineContent {
	course_code: string;
	version: string;
	name?: Partial<LocalizedText>;
	credits?: number | null;
	credits_ects?: number | null;
	objectives?: Partial<LocalizedText> | null;
	summary?: Partial<LocalizedText> | null;
	references?: Partial<LocalizedText> | null;
	study_guide?: Partial<LocalizedText> | null;
	faculty?: { code?: string; name?: Partial<LocalizedText> } | null;
	course_type?: { code?: string; name?: Partial<LocalizedText> } | null;
	hours?: {
		total_periods?: number | null;
		total_study_hours?: number | null;
		breakdown?: Record<string, number | null>;
	} | null;
	assessment?: RawAssessment | null;
	learning_outcomes?: RawLearningOutcome[];
	assessment_activities?: RawAssessmentActivity[];
	outcome_assessments?: { outcome_key: string; activity_codes?: string[] }[];
	sessions?: RawSession[];
}

export interface RawAssessmentPart {
	format?: { code?: string; name?: Partial<LocalizedText> } | null;
	duration_minutes?: number | null;
}

export interface RawAssessment {
	weights?: Record<string, number | null> | null;
	midterm?: RawAssessmentPart | null;
	final_exam?: RawAssessmentPart | null;
}

export interface RawLearningOutcome {
	key: string;
	code: string;
	name?: Partial<LocalizedText>;
	description?: Partial<LocalizedText> | null;
	level?: number | null;
	parent_code?: string | null;
}

export interface RawAssessmentActivity {
	code: string;
	name?: Partial<LocalizedText>;
	category?: { code?: string; name?: Partial<LocalizedText> } | null;
}

export interface RawSession {
	label?: string | null;
	order?: number | null;
	content?: Partial<LocalizedText> | null;
	items?: {
		outcome_key?: string | null;
		assessment_codes?: string[] | null;
	}[];
}

/** Một dòng tóm tắt môn học (danh sách / tìm kiếm). */
export interface CatalogCourseSummary {
	courseCode: string;
	/** Phiên bản mới nhất (theo học kỳ áp dụng rồi tới số phiên bản). */
	latestVersion: string;
	versions: string[];
	name: LocalizedText;
	credits: number | null;
	facultyCode: string | null;
}

export interface CatalogPrerequisite {
	courseCode: string;
	/** `prerequisite` | `prior` | `corequisite` | `recommended` | … — giữ nguyên giá trị nguồn. */
	type: string | null;
	typeRaw: string | null;
}

/** Đề cương đã được đọc từ Catalog, kèm định danh nguồn để truy vết. */
export interface CatalogOutline {
	/** `CO1023@9.1` */
	ref: string;
	courseCode: string;
	version: string;
	appliesFrom: string | null;
	sourceCode: string | null;
	sourceUpdatedAt: string | null;
	contentHash: string;
	name: LocalizedText;
	credits: number | null;
	prerequisites: CatalogPrerequisite[];
	content: RawOutlineContent;
}

export interface SkillGraphOutcome {
	/** `CO1023@9.1#L.O.2.1` */
	key: string;
	code: string;
	parentCode: string | null;
	level: number | null;
	name: string;
}

/** Một chủ đề (thường là một chương) — nút cấp trên của đồ thị. */
export interface SkillGraphTopic {
	/** `CO1023@9.1#T3` */
	key: string;
	index: number;
	title: string;
	sessionLabel: string | null;
	outcomeKeys: string[];
	skillKeys: string[];
}

/** Một kỹ năng/khái niệm — đơn vị mà UniPrep đo mức thành thạo và gắn câu hỏi. */
export interface SkillGraphSkill {
	/** `CO1023@9.1#3.4` = chủ đề thứ 3, mục thứ 4 (theo thứ tự xuất hiện, không theo số in sẵn). */
	key: string;
	topicKey: string;
	/** Thứ tự trong chủ đề, bắt đầu từ 1. */
	order: number;
	name: string;
	/** Số mục in trong đề cương (vd `3.4`) nếu có — chỉ để hiển thị. */
	label: string | null;
	outcomeKeys: string[];
}

export type SkillEdgeSource = 'topic_order' | 'cross_course';

export interface SkillGraphEdge {
	/** Nút phải học trước. */
	from: string;
	/** Nút học sau. */
	to: string;
	source: SkillEdgeSource;
	/** Với `cross_course`: loại quan hệ gốc (`prerequisite`, `prior`, `recommended`…). */
	relation: string | null;
}

export interface SkillGraph {
	courseRef: string;
	courseCode: string;
	version: string;
	name: LocalizedText;
	outcomes: SkillGraphOutcome[];
	topics: SkillGraphTopic[];
	skills: SkillGraphSkill[];
	/**
	 * Cạnh tiên quyết giữa các **chủ đề** (chương trước → chương sau) và từ **môn tiên quyết**
	 * (`from` là **mã môn** kia, không kèm phiên bản) tới chủ đề đầu tiên. Kỹ năng thừa hưởng điều kiện của
	 * chủ đề chứa nó; cạnh chi tiết giữa kỹ năng (do AI/giảng viên bổ sung) do UniPrep tự lưu.
	 */
	edges: SkillGraphEdge[];
	prerequisites: CatalogPrerequisite[];
	assessment: {
		weights: Record<string, number>;
		midterm: { format: string | null; durationMinutes: number | null } | null;
		finalExam: { format: string | null; durationMinutes: number | null } | null;
	};
}
