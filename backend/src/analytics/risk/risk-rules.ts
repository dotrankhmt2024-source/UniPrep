import type { RiskFeatures, RiskSignal, RiskThresholds } from './risk-features';

/**
 * Chương trình Answer Set Programming (clingo) của bộ cảnh báo sớm.
 *
 * Phần 1 — **suy tín hiệu**: mỗi tín hiệu là một luật có ngưỡng (hiệu chỉnh trên OULAD) và có thể
 * có **ngoại lệ** viết bằng phủ định mặc định (`not`): kết luận bị rút lại khi có bằng chứng ngược
 * (ví dụ vắng lâu *nhưng* vừa nộp bài đúng hạn). Luật cụ thể hơn chặn luật chung hơn (vắng lâu thì
 * không tính thêm "ít tham gia"/"giảm nhịp" để một nguyên nhân không bị đếm ba lần).
 *
 * Phần 2 — **lập kế hoạch can thiệp** (chỉ dùng khi chạy thật): chọn tối đa một hành động cho mỗi
 * học viên có nguy cơ, dưới các ràng buộc (sức xử lý của giảng viên, không nhắc lại học viên vừa
 * được can thiệp, chỉ giao mentor khi có nhiều tín hiệu), tối ưu theo thứ tự ưu tiên: (1) xử lý được
 * nhiều điểm rủi ro nhất, (2) hành động khớp nhiều tín hiệu nhất. Đây là bài toán tổ hợp mà if-else
 * không giải được một cách tổng quát.
 *
 * Giữ ở dạng chuỗi TS (thay vì tệp `.lp`) để đi cùng bản build `dist/` và container mà không cần cấu
 * hình copy asset.
 */
export const SIGNAL_RULES = `
% ---------- Dữ kiện đầu vào (mỗi học viên S) ----------
% student(S). recency(S,D). active14(S,N). active_prev14(S,N). due_total(S,N). missed(S,N).
% late(S,N). avg_score(S,X). score_trend(S,X). ontime_age(S,A).

has_activity(S) :- recency(S,_).
recent_submission(S) :- ontime_age(S,A), A <= t_recent_submission_days.
efficient(S) :- due_total(S,T), T > 0, missed(S,0), late(S,0), avg_score(S,X), X >= t_good_score.

signal(S,never_active) :- student(S), not has_activity(S).

signal(S,inactive) :- recency(S,D), D >= t_inactive_days, not recent_submission(S).
exception(S,inactive,recent_submission) :- recency(S,D), D >= t_inactive_days, recent_submission(S).

signal(S,low_engagement) :- active14(S,N), N < t_low_active_days, has_activity(S),
    not efficient(S), not signal(S,inactive).
exception(S,low_engagement,efficient) :- active14(S,N), N < t_low_active_days, efficient(S).

signal(S,declining) :- active14(S,N), active_prev14(S,P), P >= t_decline_min_prev,
    N*100 <= P*t_decline_percent, not signal(S,inactive).

signal(S,missed_work) :- missed(S,N), N >= t_missed_min.
signal(S,late_work)   :- late(S,N), N >= t_late_min.
signal(S,low_score)   :- avg_score(S,X), X < t_low_score.
signal(S,score_drop)  :- score_trend(S,X), X <= -t_score_drop.

#show signal/2.
#show exception/3.
`;

export const PLANNING_RULES = `
% ---------- Lập kế hoạch can thiệp ----------
% risk(S,W,L): học viên cần theo dõi, W = điểm rủi ro x100, L = 1 (trung bình) | 2 (cao).
% recent_intervention(S). capacity(C).

suits(never_active,in_app_message). suits(inactive,in_app_message).
suits(low_engagement,in_app_message). suits(declining,in_app_message).
suits(missed_work,recommended_lesson). suits(late_work,recommended_lesson).
suits(low_score,recommended_lesson). suits(score_drop,recommended_lesson).
suits(R,mentor_assignment) :- signal(_,R).

candidate(S,A) :- risk(S,_,_), signal(S,R), suits(R,A), not recent_intervention(S).
{ plan(S,A) : candidate(S,A) } 1 :- risk(S,_,_).
planned(S) :- plan(S,_).

nsignals(S,K) :- risk(S,_,_), K = #count { R : signal(S,R) }.
:- plan(S,mentor_assignment), not risk(S,_,2).
:- plan(S,mentor_assignment), nsignals(S,K), K < 3.
:- capacity(C), #count { S : planned(S) } > C.

match(S,A,M) :- candidate(S,A), M = #count { R : signal(S,R), suits(R,A) }.
:~ risk(S,W,_), not planned(S). [W@2,S]
:~ plan(S,A), match(S,A,M). [-M@1,S,A]

#show plan/2.
`;

/** Tên nguyên tử ASP phải là hằng hợp lệ: dùng chỉ số thay vì UUID/mã sinh viên. */
const atom = (index: number) => `s${index}`;
const int = (value: number) => Math.round(value);

/** Hằng ngưỡng mang tiền tố `t_` để không trùng tên tín hiệu (`#const low_score=…` sẽ thay cả
 * nguyên tử `low_score` trong `signal(S,low_score)`). */
export const thresholdConstants = (t: RiskThresholds): string =>
	[
		`#const t_inactive_days=${int(t.inactiveDays)}.`,
		`#const t_low_active_days=${int(t.lowActiveDays)}.`,
		`#const t_decline_percent=${int(t.declinePercent)}.`,
		`#const t_decline_min_prev=${int(t.declineMinPrev)}.`,
		`#const t_missed_min=${int(t.missedMin)}.`,
		`#const t_late_min=${int(t.lateMin)}.`,
		`#const t_low_score=${int(t.lowScore)}.`,
		`#const t_score_drop=${int(t.scoreDrop)}.`,
		`#const t_recent_submission_days=${int(t.recentSubmissionDays)}.`,
		`#const t_good_score=${int(t.goodScore)}.`,
	].join('\n');

export const featureFacts = (features: RiskFeatures[]): string => {
	const lines: string[] = [];
	features.forEach((f, index) => {
		const s = atom(index);
		lines.push(`student(${s}).`);
		if (f.recencyDays !== null)
			lines.push(`recency(${s},${int(f.recencyDays)}).`);
		lines.push(`active14(${s},${int(f.activeDays14)}).`);
		lines.push(`active_prev14(${s},${int(f.activeDaysPrev14)}).`);
		lines.push(`due_total(${s},${int(f.dueTotal)}).`);
		lines.push(`missed(${s},${int(f.dueMissed)}).`);
		lines.push(`late(${s},${int(f.lateCount)}).`);
		if (f.avgScore !== null) lines.push(`avg_score(${s},${int(f.avgScore)}).`);
		if (f.scoreTrend !== null)
			lines.push(`score_trend(${s},${int(f.scoreTrend)}).`);
		if (f.daysSinceOnTimeSubmission !== null)
			lines.push(`ontime_age(${s},${int(f.daysSinceOnTimeSubmission)}).`);
	});
	return lines.join('\n');
};

export interface SignalResult {
	signals: RiskSignal[];
	/** Luật bị rút lại nhờ ngoại lệ, ví dụ `{ signal: 'inactive', reason: 'recent_submission' }`. */
	exceptions: { signal: RiskSignal; reason: string }[];
}

/** Đọc `signal(sI,R)` / `exception(sI,R,W)` của answer set về theo thứ tự học viên đầu vào. */
export const parseSignals = (
	atoms: string[],
	count: number,
): SignalResult[] => {
	const results: SignalResult[] = Array.from({ length: count }, () => ({
		signals: [],
		exceptions: [],
	}));
	for (const value of atoms) {
		const signal = value.match(/^signal\(s(\d+),(\w+)\)$/);
		if (signal) {
			results[Number(signal[1])]?.signals.push(signal[2] as RiskSignal);
			continue;
		}
		const exception = value.match(/^exception\(s(\d+),(\w+),(\w+)\)$/);
		if (exception)
			results[Number(exception[1])]?.exceptions.push({
				signal: exception[2] as RiskSignal,
				reason: exception[3],
			});
	}
	return results;
};

export const atomIndex = (value: string): number | null => {
	const match = value.match(/^s(\d+)$/);
	return match ? Number(match[1]) : null;
};
