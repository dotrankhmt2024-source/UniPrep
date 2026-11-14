/**
 * Feature rủi ro **không phụ thuộc môn học** — cùng một định nghĩa được tính từ OULAD (để hiệu chỉnh
 * và đánh giá) và từ dữ liệu UniPrep (để chạy thật). Xem `docs/03-architecture/risk-asp-oulad.md`.
 *
 * Vì sao không dùng số click/số sự kiện: click trên VLE của Open University và sự kiện của UniPrep
 * không cùng thang đo, nên chỉ dùng đại lượng theo **ngày** và theo **bài đến hạn** — hai thứ có
 * nghĩa như nhau ở mọi nền tảng.
 */
export interface RiskFeatures {
	/** Số ngày từ lần hoạt động gần nhất tới mốc dự đoán; `null` nếu chưa từng hoạt động. */
	recencyDays: number | null;
	/** Số ngày có hoạt động trong 14 ngày gần nhất. */
	activeDays14: number;
	/** Số ngày có hoạt động trong 14 ngày trước đó (ngày 15–28 tính ngược). */
	activeDaysPrev14: number;
	/** Số bài (có hạn) đã đến hạn tính tới mốc dự đoán. */
	dueTotal: number;
	/** Số bài đã đến hạn mà chưa nộp/chưa hoàn thành. */
	dueMissed: number;
	/** Số bài nộp sau hạn. */
	lateCount: number;
	/** Điểm trung bình (0–100) các bài đã chấm; `null` nếu chưa có điểm. */
	avgScore: number | null;
	/** Điểm bài gần nhất trừ trung bình các bài trước đó; `null` nếu có dưới 2 điểm. */
	scoreTrend: number | null;
	/** Số ngày từ lần nộp bài đúng hạn gần nhất; `null` nếu chưa có. */
	daysSinceOnTimeSubmission: number | null;
}

/** Các tín hiệu mà luật ASP có thể suy ra. Thứ tự cố định vì là thứ tự trọng số của model gộp. */
export const RISK_SIGNALS = [
	'never_active',
	'inactive',
	'low_engagement',
	'declining',
	'missed_work',
	'late_work',
	'low_score',
	'score_drop',
] as const;
export type RiskSignal = (typeof RISK_SIGNALS)[number];

/** Ngưỡng của từng luật — hiệu chỉnh trên OULAD, lưu ở `risk-calibration.json`. */
export interface RiskThresholds {
	/** `inactive`: số ngày không hoạt động tối thiểu. */
	inactiveDays: number;
	/** `low_engagement`: số ngày hoạt động trong 14 ngày dưới mức này. */
	lowActiveDays: number;
	/** `declining`: hoạt động 14 ngày gần nhất ≤ x% của 14 ngày trước đó. */
	declinePercent: number;
	/** `declining`: chỉ xét khi 14 ngày trước đó có ít nhất ngần này ngày hoạt động. */
	declineMinPrev: number;
	/** `missed_work`: số bài đến hạn chưa nộp tối thiểu. */
	missedMin: number;
	/** `late_work`: số bài nộp trễ tối thiểu. */
	lateMin: number;
	/** `low_score`: điểm trung bình dưới mức này. */
	lowScore: number;
	/** `score_drop`: điểm gần nhất thấp hơn trung bình trước đó ít nhất ngần này. */
	scoreDrop: number;
	/** Ngoại lệ của `inactive`: vừa nộp bài đúng hạn trong ngần này ngày thì không coi là bỏ học. */
	recentSubmissionDays: number;
	/** Ngoại lệ của `low_engagement`: không trễ bài nào và điểm từ mức này trở lên thì là "học hiệu quả". */
	goodScore: number;
}

/** Nhãn hiển thị + mẫu câu giải thích (tiếng Việt ở tầng hiển thị, khoá giữ tiếng Anh). */
export const SIGNAL_TEXT: Record<
	RiskSignal,
	{ label: string; explain: (f: RiskFeatures) => string }
> = {
	never_active: {
		label: 'Chưa từng hoạt động',
		explain: () => 'Chưa có hoạt động học tập nào trong khoá học',
	},
	inactive: {
		label: 'Vắng mặt lâu',
		explain: (f) => `Không hoạt động ${f.recencyDays ?? '?'} ngày`,
	},
	low_engagement: {
		label: 'Ít tham gia',
		explain: (f) => `Chỉ học ${f.activeDays14}/14 ngày gần nhất`,
	},
	declining: {
		label: 'Giảm nhịp học',
		explain: (f) =>
			`Số ngày học giảm từ ${f.activeDaysPrev14} xuống ${f.activeDays14} (so với 2 tuần trước)`,
	},
	missed_work: {
		label: 'Bỏ lỡ bài đến hạn',
		explain: (f) =>
			`${f.dueMissed}/${f.dueTotal} bài đã đến hạn chưa hoàn thành`,
	},
	late_work: {
		label: 'Nộp trễ',
		explain: (f) => `${f.lateCount} bài nộp sau hạn`,
	},
	low_score: {
		label: 'Điểm thấp',
		explain: (f) => `Điểm trung bình ${f.avgScore?.toFixed(0) ?? '?'}/100`,
	},
	score_drop: {
		label: 'Điểm đi xuống',
		explain: (f) =>
			`Bài gần nhất thấp hơn trung bình trước đó ${Math.abs(f.scoreTrend ?? 0).toFixed(0)} điểm`,
	},
};
