/**
 * Đọc OULAD (Open University Learning Analytics Dataset, CC BY 4.0) và tính `RiskFeatures` cho từng
 * lượt học (sinh viên × lượt mở môn) tại các mốc ngày `CHECKPOINTS`.
 *
 * Chạy: `npm run oulad:features -- <thư mục OULAD đã giải nén>`
 * Ra: `<thư mục OULAD>/features.jsonl` — dữ liệu dẫn xuất, KHÔNG commit (giữ ngoài repo như dữ liệu gốc).
 *
 * Quy tắc chống rò rỉ dữ liệu: tại mốc `t` chỉ dùng hoạt động có `date <= t` và bài nộp có
 * `date_submitted <= t`. Lượt học đã rút trước `t` (hoặc chưa đăng ký tới `t`) bị loại khỏi mốc đó
 * vì không còn gì để dự đoán.
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { RiskFeatures } from '../risk/risk-features';

export const CHECKPOINTS = [28, 56, 84, 112];
const AT_RISK_RESULTS = new Set(['Withdrawn', 'Fail']);

export interface OuladRow {
	module: string;
	presentation: string;
	student: string;
	t: number;
	label: 0 | 1;
	finalResult: string;
	/** Ngày rút môn (tính từ đầu kỳ); `null` nếu không rút. Dùng để đo thời gian báo trước. */
	unregistered: number | null;
	features: RiskFeatures;
}

const parseLine = (line: string): string[] =>
	line.split(',').map((cell) => cell.replace(/^"|"$/g, ''));

const readCsv = (dir: string, name: string): string[][] =>
	readFileSync(join(dir, name), 'utf8')
		.split(/\r?\n/)
		.slice(1)
		.filter(Boolean)
		.map(parseLine);

const num = (value: string): number | null =>
	value === '?' || value === '' ? null : Number(value);

interface Assessment {
	id: string;
	key: string;
	type: string;
	deadline: number | null;
}

interface Submission {
	assessment: string;
	submitted: number;
	banked: boolean;
	score: number | null;
}

const main = async () => {
	const dir = process.argv[2];
	if (!dir) throw new Error('Thiếu đường dẫn thư mục OULAD');

	const assessments = new Map<string, Assessment>();
	const assessmentsByPresentation = new Map<string, Assessment[]>();
	for (const [module, presentation, id, type, date] of readCsv(
		dir,
		'assessments.csv',
	)) {
		const key = `${module}|${presentation}`;
		const item: Assessment = { id, key, type, deadline: num(date) };
		assessments.set(id, item);
		// Bài thi cuối kỳ (Exam) diễn ra sau mọi mốc dự đoán, không phải "bài đến hạn" trong kỳ.
		if (type === 'Exam' || item.deadline === null) continue;
		const list = assessmentsByPresentation.get(key) ?? [];
		list.push(item);
		assessmentsByPresentation.set(key, list);
	}

	const submissions = new Map<string, Submission[]>();
	for (const [assessment, student, submitted, banked, score] of readCsv(
		dir,
		'studentAssessment.csv',
	)) {
		const meta = assessments.get(assessment);
		if (!meta) continue;
		const key = `${meta.key}|${student}`;
		const list = submissions.get(key) ?? [];
		list.push({
			assessment,
			submitted: Number(submitted),
			banked: banked === '1',
			score: num(score),
		});
		submissions.set(key, list);
	}

	const registration = new Map<
		string,
		{ registered: number | null; unregistered: number | null }
	>();
	for (const [
		module,
		presentation,
		student,
		registered,
		unregistered,
	] of readCsv(dir, 'studentRegistration.csv')) {
		registration.set(`${module}|${presentation}|${student}`, {
			registered: num(registered),
			unregistered: num(unregistered),
		});
	}

	console.log('Đọc studentVle.csv (10,6 triệu dòng)…');
	const activeDays = new Map<string, Set<number>>();
	const reader = createInterface({
		input: createReadStream(join(dir, 'studentVle.csv')),
		crlfDelay: Infinity,
	});
	let lines = 0;
	for await (const line of reader) {
		lines += 1;
		if (lines === 1 || !line) continue;
		const [module, presentation, student, , date] = parseLine(line);
		const key = `${module}|${presentation}|${student}`;
		let days = activeDays.get(key);
		if (!days) {
			days = new Set();
			activeDays.set(key, days);
		}
		days.add(Number(date));
	}
	console.log(`  ${lines - 1} dòng, ${activeDays.size} lượt học có hoạt động`);

	const rows: OuladRow[] = [];
	for (const [module, presentation, student, ...rest] of readCsv(
		dir,
		'studentInfo.csv',
	)) {
		const finalResult = rest.at(-1) as string;
		const key = `${module}|${presentation}|${student}`;
		const reg = registration.get(key);
		const days = [...(activeDays.get(key) ?? [])].sort((a, b) => a - b);
		const due =
			assessmentsByPresentation.get(`${module}|${presentation}`) ?? [];
		const subs = submissions.get(key) ?? [];
		const banked = new Set(
			subs.filter((s) => s.banked).map((s) => s.assessment),
		);
		const ownSubs = subs
			.filter((s) => !s.banked)
			.sort((a, b) => a.submitted - b.submitted);

		for (const t of CHECKPOINTS) {
			if (
				reg?.unregistered !== null &&
				reg?.unregistered !== undefined &&
				reg.unregistered <= t
			)
				continue;
			if (
				reg?.registered !== null &&
				reg?.registered !== undefined &&
				reg.registered > t
			)
				continue;

			const past = days.filter((day) => day <= t);
			const last = past.at(-1);
			const activeDays14 = past.filter((day) => day > t - 14).length;
			const activeDaysPrev14 = past.filter(
				(day) => day > t - 28 && day <= t - 14,
			).length;

			const dueNow = due.filter(
				(a) => (a.deadline as number) <= t && !banked.has(a.id),
			);
			const submittedNow = ownSubs.filter((s) => s.submitted <= t);
			const submittedIds = new Set(submittedNow.map((s) => s.assessment));
			const dueMissed = dueNow.filter((a) => !submittedIds.has(a.id)).length;

			let lateCount = 0;
			let lastOnTime: number | null = null;
			for (const s of submittedNow) {
				const deadline = assessments.get(s.assessment)?.deadline ?? null;
				if (deadline === null) continue;
				if (s.submitted > deadline) lateCount += 1;
				else lastOnTime = s.submitted;
			}

			const scores = submittedNow
				.map((s) => s.score)
				.filter((score): score is number => score !== null);
			const avgScore = scores.length
				? scores.reduce((sum, score) => sum + score, 0) / scores.length
				: null;
			const scoreTrend =
				scores.length >= 2
					? (scores.at(-1) as number) -
						scores.slice(0, -1).reduce((sum, score) => sum + score, 0) /
							(scores.length - 1)
					: null;

			rows.push({
				module,
				presentation,
				student,
				t,
				label: AT_RISK_RESULTS.has(finalResult) ? 1 : 0,
				finalResult,
				unregistered: reg?.unregistered ?? null,
				features: {
					recencyDays: last === undefined ? null : t - last,
					activeDays14,
					activeDaysPrev14,
					dueTotal: dueNow.length,
					dueMissed,
					lateCount,
					avgScore,
					scoreTrend,
					daysSinceOnTimeSubmission:
						lastOnTime === null ? null : t - lastOnTime,
				},
			});
		}
	}

	const out = join(dir, 'features.jsonl');
	writeFileSync(out, rows.map((row) => JSON.stringify(row)).join('\n'));
	const positives = rows.filter((row) => row.label === 1).length;
	console.log(
		`Ghi ${rows.length} dòng vào ${out} (nguy cơ: ${positives}, ${((positives / rows.length) * 100).toFixed(1)}%)`,
	);
	for (const t of CHECKPOINTS) {
		const atT = rows.filter((row) => row.t === t);
		console.log(
			`  t=${t}: ${atT.length} lượt, nguy cơ ${((atT.filter((r) => r.label).length / atT.length) * 100).toFixed(1)}%`,
		);
	}
};

if (require.main === module) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
