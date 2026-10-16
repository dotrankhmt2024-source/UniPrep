import type { CourseLevel } from '../../common/types';

/**
 * Nội dung mẫu cho seed (E0-T6). Ví dụ dùng môn trung tính ("Giải tích 1",
 * "Vật lý đại cương") đúng gợi ý của database-design.md §1 — sản phẩm không gắn
 * với một môn cụ thể.
 *
 * Số lượng phải thoả DoD E0-T6: 2 khoá học, ≥ 10 bài học, ≥ 1 quiz mỗi khoá.
 * Ở đây 2 khoá × (4+3) chương × 4 bài = 28 bài, mỗi khoá 1 quiz 5 câu.
 */

export interface LessonFixture {
	title: string;
	summary: string;
	/** Nội dung HTML (TipTap xuất ra HTML) — sanitize ở tầng hiển thị (E3-T8). */
	content: string;
	estimatedMinutes: number;
	hasVideo: boolean;
}

export interface SectionFixture {
	title: string;
	description: string;
	lessons: LessonFixture[];
}

export interface QuestionFixture {
	content: string;
	explanation: string;
	options: string[];
	/** Chỉ số (0-based) của đáp án đúng trong `options`. */
	correctIndex: number;
}

export interface CourseFixture {
	code: string;
	title: string;
	slug: string;
	summary: string;
	description: string;
	level: CourseLevel;
	estimatedHours: number;
	categorySlug: string;
	sections: SectionFixture[];
	quiz: {
		title: string;
		description: string;
		timeLimitSeconds: number;
		maxAttempts: number;
		passScore: number;
		questions: QuestionFixture[];
	};
}

export const CATEGORY_FIXTURES = [
	{
		slug: 'toan-hoc',
		name: 'Toán học',
		description: 'Các học phần về giải tích, đại số và xác suất thống kê.',
		parentSlug: null as string | null,
		orderIndex: 1,
	},
	{
		slug: 'toan-hoc-co-so',
		name: 'Toán cơ sở',
		description: 'Học phần toán nền tảng cho năm thứ nhất.',
		parentSlug: 'toan-hoc',
		orderIndex: 1,
	},
	{
		slug: 'vat-ly',
		name: 'Vật lý',
		description: 'Các học phần vật lý đại cương và thí nghiệm.',
		parentSlug: null,
		orderIndex: 2,
	},
];

const lesson = (
	title: string,
	summary: string,
	estimatedMinutes: number,
	hasVideo = false,
): LessonFixture => ({
	title,
	summary,
	content:
		`<h2>${title}</h2>` +
		`<p>${summary}</p>` +
		'<h3>Mục tiêu</h3><ul><li>Hiểu khái niệm trọng tâm của bài.</li>' +
		'<li>Áp dụng được vào bài tập cơ bản.</li></ul>' +
		'<h3>Nội dung</h3><p>Nội dung chi tiết của bài học được giảng viên soạn bằng trình soạn thảo.</p>' +
		'<h3>Bài tập tự luyện</h3><ol><li>Bài tập mức cơ bản.</li><li>Bài tập mức vận dụng.</li></ol>',
	estimatedMinutes,
	hasVideo,
});

const section = (
	title: string,
	description: string,
	lessons: LessonFixture[],
): SectionFixture => ({ title, description, lessons });

export const COURSE_FIXTURES: CourseFixture[] = [
	{
		code: 'MATH101',
		title: 'Giải tích 1',
		slug: 'giai-tich-1',
		summary:
			'Giới hạn, đạo hàm, tích phân và ứng dụng cho sinh viên năm thứ nhất.',
		description:
			'Học phần cung cấp nền tảng giải tích một biến: giới hạn – liên tục, đạo hàm và vi phân, ' +
			'tích phân xác định, chuỗi số. Sinh viên làm bài kiểm tra luyện tập sau mỗi chương.',
		level: 'beginner',
		estimatedHours: 45,
		categorySlug: 'toan-hoc-co-so',
		sections: [
			section(
				'Chương 1 — Giới hạn và liên tục',
				'Làm quen với giới hạn dãy số và hàm số.',
				[
					lesson(
						'Giới hạn dãy số',
						'Định nghĩa giới hạn, các phép toán và tiêu chuẩn hội tụ.',
						45,
					),
					lesson(
						'Giới hạn hàm số',
						'Giới hạn một phía, giới hạn vô cực và dạng vô định.',
						50,
						true,
					),
					lesson(
						'Hàm số liên tục',
						'Phân loại điểm gián đoạn và tính chất hàm liên tục trên đoạn.',
						45,
					),
					lesson(
						'Vô cùng bé và vô cùng lớn',
						'So sánh bậc vô cùng bé, ứng dụng tính giới hạn.',
						40,
					),
				],
			),
			section(
				'Chương 2 — Đạo hàm và vi phân',
				'Quy tắc tính đạo hàm và ứng dụng khảo sát hàm số.',
				[
					lesson(
						'Định nghĩa đạo hàm',
						'Đạo hàm tại một điểm, ý nghĩa hình học và vật lý.',
						45,
					),
					lesson(
						'Quy tắc tính đạo hàm',
						'Đạo hàm hàm hợp, hàm ẩn, hàm ngược.',
						55,
						true,
					),
					lesson(
						'Vi phân và xấp xỉ',
						'Vi phân cấp một, ứng dụng xấp xỉ tuyến tính.',
						40,
					),
					lesson(
						'Khảo sát và vẽ đồ thị',
						'Cực trị, tiệm cận, tính lồi lõm.',
						60,
					),
				],
			),
			section(
				'Chương 3 — Tích phân',
				'Nguyên hàm, tích phân xác định và kỹ thuật tính.',
				[
					lesson(
						'Nguyên hàm cơ bản',
						'Bảng nguyên hàm và tính chất tuyến tính.',
						45,
					),
					lesson(
						'Phương pháp đổi biến',
						'Đổi biến số trong tích phân bất định và xác định.',
						50,
					),
					lesson(
						'Tích phân từng phần',
						'Công thức tích phân từng phần và cách chọn thành phần.',
						50,
						true,
					),
					lesson(
						'Ứng dụng hình học',
						'Diện tích, thể tích vật thể tròn xoay, độ dài cung.',
						55,
					),
				],
			),
			section(
				'Chương 4 — Chuỗi số',
				'Chuỗi số dương, chuỗi đan dấu và tiêu chuẩn hội tụ.',
				[
					lesson(
						'Chuỗi số và tổng riêng',
						'Định nghĩa hội tụ của chuỗi số.',
						45,
					),
					lesson(
						'Tiêu chuẩn so sánh',
						'Tiêu chuẩn so sánh, tỉ số, căn thức.',
						50,
					),
					lesson(
						'Chuỗi đan dấu',
						'Tiêu chuẩn Leibniz và hội tụ tuyệt đối.',
						45,
					),
					lesson(
						'Ôn tập học phần',
						'Hệ thống kiến thức và đề luyện tổng hợp.',
						60,
					),
				],
			),
		],
		quiz: {
			title: 'Kiểm tra luyện tập — Giải tích 1',
			description: 'Bài luyện tập 5 câu cho chương 1 và 2.',
			timeLimitSeconds: 900,
			maxAttempts: 3,
			passScore: 5,
			questions: [
				{
					content: 'Giới hạn của dãy số (1/n) khi n → +∞ bằng bao nhiêu?',
					explanation: 'Dãy 1/n giảm và bị chặn dưới bởi 0 nên hội tụ về 0.',
					options: ['0', '1', '+∞', 'Không tồn tại'],
					correctIndex: 0,
				},
				{
					content: 'Hàm số y = x² có đạo hàm tại x = 0 bằng bao nhiêu?',
					explanation: "y' = 2x nên tại x = 0 đạo hàm bằng 0.",
					options: ['0', '1', '2', 'Không xác định'],
					correctIndex: 0,
				},
				{
					content: 'Nguyên hàm của hàm số f(x) = cos x là:',
					explanation: 'Đạo hàm của sin x là cos x.',
					options: ['sin x + C', '−sin x + C', 'cos x + C', '−cos x + C'],
					correctIndex: 0,
				},
				{
					content: 'Điều kiện để hàm số liên tục tại một điểm x₀ là:',
					explanation:
						'Liên tục tại x₀ khi giới hạn hai phía tồn tại, bằng nhau và bằng giá trị hàm số.',
					options: [
						'Hàm số xác định tại x₀',
						'Giới hạn tại x₀ tồn tại',
						'Giới hạn tại x₀ bằng giá trị hàm số tại x₀',
						'Đạo hàm tại x₀ tồn tại',
					],
					correctIndex: 2,
				},
				{
					content:
						'Tích phân xác định của hàm hằng f(x) = 3 trên đoạn [0, 2] bằng:',
					explanation: 'Diện tích hình chữ nhật 3 × 2 = 6.',
					options: ['3', '6', '9', '0'],
					correctIndex: 1,
				},
			],
		},
	},
	{
		code: 'PHY101',
		title: 'Vật lý đại cương',
		slug: 'vat-ly-dai-cuong',
		summary: 'Cơ học, nhiệt học và điện từ cơ bản cho sinh viên khối kỹ thuật.',
		description:
			'Học phần trình bày các định luật cơ bản của cơ học Newton, nhiệt động lực học và điện trường, ' +
			'kèm bài tập vận dụng và thí nghiệm mô phỏng.',
		level: 'beginner',
		estimatedHours: 40,
		categorySlug: 'vat-ly',
		sections: [
			section(
				'Chương 1 — Động học chất điểm',
				'Mô tả chuyển động bằng các đại lượng động học.',
				[
					lesson(
						'Chuyển động thẳng đều',
						'Vận tốc, quãng đường và phương trình chuyển động.',
						40,
					),
					lesson(
						'Chuyển động thẳng biến đổi đều',
						'Gia tốc, công thức vận tốc và quãng đường.',
						50,
						true,
					),
					lesson(
						'Chuyển động tròn đều',
						'Tốc độ góc, chu kỳ, gia tốc hướng tâm.',
						45,
					),
					lesson(
						'Bài tập tổng hợp động học',
						'Phân tích đồ thị vận tốc – thời gian.',
						45,
					),
				],
			),
			section(
				'Chương 2 — Động lực học',
				'Ba định luật Newton và các lực cơ bản.',
				[
					lesson(
						'Ba định luật Newton',
						'Phát biểu và ý nghĩa của từng định luật.',
						50,
					),
					lesson(
						'Lực ma sát và lực đàn hồi',
						'Hệ số ma sát, định luật Hooke.',
						45,
						true,
					),
					lesson(
						'Động lượng và xung lượng',
						'Định luật bảo toàn động lượng.',
						45,
					),
					lesson(
						'Công và năng lượng',
						'Định lý động năng, thế năng và bảo toàn cơ năng.',
						55,
					),
				],
			),
			section(
				'Chương 3 — Nhiệt học',
				'Nhiệt độ, nhiệt lượng và các nguyên lý nhiệt động.',
				[
					lesson(
						'Nhiệt độ và thang đo',
						'Thang Celsius, Kelvin và sự giãn nở nhiệt.',
						40,
					),
					lesson(
						'Nhiệt lượng và nhiệt dung',
						'Phương trình cân bằng nhiệt.',
						45,
					),
					lesson(
						'Nguyên lý I nhiệt động lực học',
						'Nội năng, công và nhiệt.',
						50,
					),
					lesson(
						'Ôn tập học phần',
						'Hệ thống công thức và đề luyện tổng hợp.',
						55,
					),
				],
			),
		],
		quiz: {
			title: 'Kiểm tra luyện tập — Vật lý đại cương',
			description: 'Bài luyện tập 5 câu cho phần cơ học.',
			timeLimitSeconds: 900,
			maxAttempts: 2,
			passScore: 5,
			questions: [
				{
					content: 'Đơn vị của gia tốc trong hệ SI là:',
					explanation: 'Gia tốc = Δv/Δt nên đơn vị là m/s².',
					options: ['m/s', 'm/s²', 'N', 'J'],
					correctIndex: 1,
				},
				{
					content: 'Một vật chuyển động thẳng đều thì:',
					explanation:
						'Chuyển động thẳng đều có vận tốc không đổi nên gia tốc bằng 0.',
					options: [
						'Gia tốc không đổi khác 0',
						'Gia tốc bằng 0',
						'Vận tốc tăng đều',
						'Vận tốc giảm đều',
					],
					correctIndex: 1,
				},
				{
					content: 'Định luật II Newton được biểu diễn bằng công thức:',
					explanation:
						'Định luật II Newton: vectơ lực bằng khối lượng nhân gia tốc.',
					options: ['F = m.a', 'F = m/a', 'F = a/m', 'F = m.v'],
					correctIndex: 0,
				},
				{
					content: 'Động lượng của một vật được tính bằng:',
					explanation: 'Động lượng p = m.v.',
					options: ['m.v', 'm.v²', '½m.v²', 'm.g.h'],
					correctIndex: 0,
				},
				{
					content: 'Nhiệt độ 0 °C tương ứng với bao nhiêu Kelvin?',
					explanation: 'T(K) = t(°C) + 273,15.',
					options: ['0 K', '100 K', '273,15 K', '373,15 K'],
					correctIndex: 2,
				},
			],
		},
	},
];

/**
 * Kịch bản hành vi của học viên ảo — lấy từ database-design.md §9.4.
 *
 * Mỗi kịch bản quyết định: số sự kiện mỗi tuần, số ngày gần nhất còn hoạt động
 * (`recencyDays`), mục tiêu tỉ lệ hoàn thành bài và khoảng điểm quiz. Nhờ đó seed
 * có sẵn dữ liệu cho các feature `recency`, `completion_rate`, `avg_score`.
 *
 * Điểm quiz tính theo thang điểm của đề mẫu: mỗi đề 5 câu × 1 điểm.
 */
export interface BehaviorProfile {
	key: string;
	label: string;
	eventsPerWeek: number;
	recencyDays: number;
	completionRatio: number;
	quizScoreRange: [number, number];
	/** Xác suất học dồn (nhiều sự kiện trong một buổi) thay vì rải đều. */
	cramChance: number;
}

export const BEHAVIOR_PROFILES: BehaviorProfile[] = [
	{
		key: 'steady',
		label: 'Chăm chỉ ổn định',
		eventsPerWeek: 9,
		recencyDays: 1,
		completionRatio: 0.9,
		quizScoreRange: [4, 5],
		cramChance: 0,
	},
	{
		key: 'declining',
		label: 'Giảm dần',
		eventsPerWeek: 6,
		recencyDays: 6,
		completionRatio: 0.5,
		quizScoreRange: [3, 4],
		cramChance: 0.1,
	},
	{
		key: 'dropped',
		label: 'Bỏ học giữa kỳ',
		eventsPerWeek: 3,
		recencyDays: 20,
		completionRatio: 0.15,
		quizScoreRange: [0, 2],
		cramChance: 0,
	},
	{
		key: 'crammer',
		label: 'Học dồn',
		eventsPerWeek: 12,
		recencyDays: 3,
		completionRatio: 0.6,
		quizScoreRange: [2, 3],
		cramChance: 0.55,
	},
	{
		key: 'low_score',
		label: 'Chăm chỉ nhưng điểm thấp',
		eventsPerWeek: 10,
		recencyDays: 2,
		completionRatio: 0.75,
		quizScoreRange: [1, 2],
		cramChance: 0.05,
	},
];

export const DEMO_ACCOUNTS = [
	{
		key: 'admin',
		email: 'admin@uniprep.test',
		fullName: 'Quản trị viên UniPrep',
		role: 'admin' as const,
	},
	{
		key: 'teacher-1',
		email: 'giangvien1@uniprep.test',
		fullName: 'Nguyễn Văn An',
		role: 'teacher' as const,
	},
	{
		key: 'teacher-2',
		email: 'giangvien2@uniprep.test',
		fullName: 'Trần Thị Bình',
		role: 'teacher' as const,
	},
	{
		key: 'student-demo',
		email: 'hocvien@uniprep.test',
		fullName: 'Lê Minh Châu',
		role: 'student' as const,
	},
];
