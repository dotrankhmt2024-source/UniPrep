/**
 * Hiệu chỉnh và đánh giá bộ cảnh báo sớm ASP trên OULAD.
 *
 * Chạy (sau `npm run oulad:features`): `npm run oulad:calibrate -- <thư mục OULAD>`
 *
 * 1. Chia theo thời gian: lượt mở 2013 (2013B, 2013J) để hiệu chỉnh, lượt mở 2014 (2014B, 2014J) để
 *    đánh giá — mô phỏng đúng tình huống dùng thật (học từ khoá trước, áp cho khoá sau).
 * 2. Ngưỡng từng luật: chọn trên tập hiệu chỉnh theo chỉ số Youden J = TPR − FPR của riêng luật đó.
 * 3. Chạy chương trình ASP thật (clingo-wasm) trên cả hai tập để lấy tín hiệu của từng lượt học.
 * 4. Hồi quy logistic trên tín hiệu nhị phân (tập hiệu chỉnh) → trọng số = mức đóng góp khi giải thích.
 * 5. Đánh giá trên tập 2014 + so sánh với hai mốc tham chiếu.
 *
 * Ra: `src/analytics/risk/risk-calibration.json` (runtime dùng) và
 * `docs/03-architecture/risk-evaluation-oulad.md` (báo cáo số đo, sinh tự động — không sửa tay).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { solve } from '../risk/clingo.runner';
import {
	RISK_SIGNALS,
	type RiskFeatures,
	type RiskSignal,
	type RiskThresholds,
} from '../risk/risk-features';
import {
	fitLogistic,
	predictLogistic,
	scoreSignals,
	signalVector,
	type RiskCalibration,
} from '../risk/risk-model';
import {
	featureFacts,
	parseSignals,
	SIGNAL_RULES,
	thresholdConstants,
} from '../risk/risk-rules';
import { CHECKPOINTS, type OuladRow } from './build-oulad-features';

const TRAIN = ['2013B', '2013J'];
const TEST = ['2014B', '2014J'];
const BATCH = 2000;
const HIGH_PRECISION_TARGET = 0.85;

/* ------------------------------- Số đo ------------------------------- */

interface Confusion {
	tp: number;
	fp: number;
	tn: number;
	fn: number;
}

const confusion = (labels: number[], predicted: boolean[]): Confusion => {
	const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
	labels.forEach((label, i) => {
		if (predicted[i]) {
			if (label) c.tp += 1;
			else c.fp += 1;
		} else if (label) c.fn += 1;
		else c.tn += 1;
	});
	return c;
};

const rates = (c: Confusion) => {
	const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0;
	const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0;
	const f1 =
		precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
	const fpr = c.fp + c.tn ? c.fp / (c.fp + c.tn) : 0;
	const accuracy = (c.tp + c.tn) / Math.max(1, c.tp + c.fp + c.tn + c.fn);
	return { precision, recall, f1, fpr, accuracy };
};

/** AUC ROC theo hạng (Mann–Whitney), xử lý điểm bằng nhau bằng hạng trung bình. */
const auc = (labels: number[], scores: number[]): number => {
	const order = scores
		.map((score, i) => ({ score, label: labels[i] }))
		.sort((a, b) => a.score - b.score);
	let rankSumPositive = 0;
	let i = 0;
	while (i < order.length) {
		let j = i;
		while (j + 1 < order.length && order[j + 1].score === order[i].score)
			j += 1;
		const rank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k += 1) if (order[k].label) rankSumPositive += rank;
		i = j + 1;
	}
	const positives = labels.filter(Boolean).length;
	const negatives = labels.length - positives;
	return (
		(rankSumPositive - (positives * (positives + 1)) / 2) /
		(positives * negatives)
	);
};

const youden = (labels: number[], fired: boolean[]): number => {
	const r = rates(confusion(labels, fired));
	return r.recall - r.fpr;
};

/* ------------------------- Hiệu chỉnh ngưỡng ------------------------- */

const pickBest = <T>(
	candidates: T[],
	evaluate: (candidate: T) => number,
): { value: T; score: number } => {
	let best = { value: candidates[0], score: -Infinity };
	for (const candidate of candidates) {
		const score = evaluate(candidate);
		if (score > best.score) best = { value: candidate, score };
	}
	return best;
};

const range = (from: number, to: number, step = 1) =>
	Array.from(
		{ length: Math.floor((to - from) / step) + 1 },
		(_, i) => from + i * step,
	);

/**
 * Mỗi ngưỡng được chọn độc lập theo Youden J của riêng luật đó (biểu thức dưới đây phản ánh đúng
 * vế điều kiện của luật trong `SIGNAL_RULES`; kết quả cuối vẫn được tính bằng clingo ở bước sau).
 */
const calibrateThresholds = (rows: OuladRow[]) => {
	const y = rows.map((row) => row.label);
	const f = rows.map((row) => row.features);
	const log: Record<string, { value: unknown; youdenJ: number }> = {};

	const inactive = pickBest(range(3, 35), (x) =>
		youden(
			y,
			f.map((r) => r.recencyDays !== null && r.recencyDays >= x),
		),
	);
	log.inactiveDays = { value: inactive.value, youdenJ: inactive.score };

	const recent = pickBest([0, 3, 5, 7, 10, 14], (x) =>
		youden(
			y,
			f.map(
				(r) =>
					r.recencyDays !== null &&
					r.recencyDays >= inactive.value &&
					!(
						x > 0 &&
						r.daysSinceOnTimeSubmission !== null &&
						r.daysSinceOnTimeSubmission <= x
					),
			),
		),
	);
	log.recentSubmissionDays = { value: recent.value, youdenJ: recent.score };

	const lowActive = pickBest(range(1, 8), (x) =>
		youden(
			y,
			f.map((r) => r.recencyDays !== null && r.activeDays14 < x),
		),
	);
	log.lowActiveDays = { value: lowActive.value, youdenJ: lowActive.score };

	const goodScore = pickBest([...range(60, 95, 5), 101], (x) =>
		youden(
			y,
			f.map(
				(r) =>
					r.recencyDays !== null &&
					r.activeDays14 < lowActive.value &&
					!(
						r.dueTotal > 0 &&
						r.dueMissed === 0 &&
						r.lateCount === 0 &&
						r.avgScore !== null &&
						r.avgScore >= x
					),
			),
		),
	);
	log.goodScore = { value: goodScore.value, youdenJ: goodScore.score };

	const decline = pickBest(
		[25, 33, 50, 66].flatMap((percent) =>
			[3, 4, 5, 6].map((minPrev) => ({ percent, minPrev })),
		),
		({ percent, minPrev }) =>
			youden(
				y,
				f.map(
					(r) =>
						r.activeDaysPrev14 >= minPrev &&
						r.activeDays14 * 100 <= r.activeDaysPrev14 * percent,
				),
			),
	);
	log.decline = { value: decline.value, youdenJ: decline.score };

	const missed = pickBest(range(1, 3), (x) =>
		youden(
			y,
			f.map((r) => r.dueMissed >= x),
		),
	);
	log.missedMin = { value: missed.value, youdenJ: missed.score };

	const late = pickBest(range(1, 3), (x) =>
		youden(
			y,
			f.map((r) => r.lateCount >= x),
		),
	);
	log.lateMin = { value: late.value, youdenJ: late.score };

	const lowScore = pickBest(range(30, 80, 5), (x) =>
		youden(
			y,
			f.map((r) => r.avgScore !== null && r.avgScore < x),
		),
	);
	log.lowScore = { value: lowScore.value, youdenJ: lowScore.score };

	const drop = pickBest(range(5, 40, 5), (x) =>
		youden(
			y,
			f.map((r) => r.scoreTrend !== null && r.scoreTrend <= -x),
		),
	);
	log.scoreDrop = { value: drop.value, youdenJ: drop.score };

	const thresholds: RiskThresholds = {
		inactiveDays: inactive.value,
		lowActiveDays: lowActive.value,
		declinePercent: decline.value.percent,
		declineMinPrev: decline.value.minPrev,
		missedMin: missed.value,
		lateMin: late.value,
		lowScore: lowScore.value,
		scoreDrop: drop.value,
		// 0 = không dùng ngoại lệ; ASP vẫn cần một số nguyên nên dùng -1 (không ngày nào thoả).
		recentSubmissionDays: recent.value === 0 ? -1 : recent.value,
		goodScore: goodScore.value,
	};
	return { thresholds, log };
};

/* ------------------------------ Chạy ASP ------------------------------ */

const runAsp = async (
	features: RiskFeatures[],
	thresholds: RiskThresholds,
): Promise<{
	signals: RiskSignal[][];
	exceptions: number;
	seconds: number;
}> => {
	const signals: RiskSignal[][] = [];
	let exceptions = 0;
	const started = Date.now();
	for (let offset = 0; offset < features.length; offset += BATCH) {
		const batch = features.slice(offset, offset + BATCH);
		const program = [
			thresholdConstants(thresholds),
			SIGNAL_RULES,
			featureFacts(batch),
		].join('\n');
		const answer = await solve(program);
		parseSignals(answer.atoms, batch.length).forEach((result) => {
			signals.push(result.signals);
			exceptions += result.exceptions.length;
		});
	}
	return { signals, exceptions, seconds: (Date.now() - started) / 1000 };
};

/* --------------------- Mốc tham chiếu: LR trên feature liên tục --------------------- */

const continuousVector = (f: RiskFeatures): number[] => [
	f.recencyDays === null ? 1 : 0,
	Math.min(f.recencyDays ?? 60, 60),
	f.activeDays14,
	f.activeDaysPrev14,
	f.dueTotal,
	f.dueMissed,
	f.lateCount,
	f.avgScore === null ? 1 : 0,
	f.avgScore ?? 0,
	f.scoreTrend ?? 0,
	f.daysSinceOnTimeSubmission === null ? 1 : 0,
	Math.min(f.daysSinceOnTimeSubmission ?? 120, 120),
];

const standardizer = (rows: number[][]) => {
	const dims = rows[0].length;
	const mean = new Array<number>(dims).fill(0);
	const std = new Array<number>(dims).fill(0);
	rows.forEach((row) => row.forEach((v, j) => (mean[j] += v / rows.length)));
	rows.forEach((row) =>
		row.forEach((v, j) => (std[j] += (v - mean[j]) ** 2 / rows.length)),
	);
	return (row: number[]) =>
		row.map((v, j) => (v - mean[j]) / (Math.sqrt(std[j]) || 1));
};

/* ------------------------------- Báo cáo ------------------------------- */

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const fixed = (value: number, digits = 3) => value.toFixed(digits);

interface EvalBlock {
	auc: number;
	medium: ReturnType<typeof rates> & Confusion;
	high: ReturnType<typeof rates> & Confusion;
}

const evaluate = (
	labels: number[],
	scores: number[],
	cutoffs: { medium: number; high: number },
): EvalBlock => {
	const medium = confusion(
		labels,
		scores.map((s) => s >= cutoffs.medium),
	);
	const high = confusion(
		labels,
		scores.map((s) => s >= cutoffs.high),
	);
	return {
		auc: auc(labels, scores),
		medium: { ...medium, ...rates(medium) },
		high: { ...high, ...rates(high) },
	};
};

const main = async () => {
	const dir = process.argv[2];
	if (!dir) throw new Error('Thiếu đường dẫn thư mục OULAD');
	const rows: OuladRow[] = readFileSync(join(dir, 'features.jsonl'), 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as OuladRow);
	const train = rows.filter((row) => TRAIN.includes(row.presentation));
	const test = rows.filter((row) => TEST.includes(row.presentation));
	console.log(`Train ${train.length} dòng, test ${test.length} dòng`);

	// 2. Ngưỡng luật
	const { thresholds, log: thresholdLog } = calibrateThresholds(train);
	console.log('Ngưỡng:', thresholds);

	// 3. ASP thật
	const aspTrain = await runAsp(
		train.map((r) => r.features),
		thresholds,
	);
	const aspTest = await runAsp(
		test.map((r) => r.features),
		thresholds,
	);
	console.log(`ASP: train ${aspTrain.seconds}s, test ${aspTest.seconds}s`);

	// 4. Gộp tín hiệu bằng hồi quy logistic
	const yTrain = train.map((r) => r.label);
	const yTest = test.map((r) => r.label);
	const fit = fitLogistic(aspTrain.signals.map(signalVector), yTrain, {
		iterations: 1500,
	});
	const model: RiskCalibration['model'] = {
		intercept: Number(fit.intercept.toFixed(4)),
		weights: Object.fromEntries(
			RISK_SIGNALS.map((signal, j) => [
				signal,
				Number(fit.weights[j].toFixed(4)),
			]),
		) as Record<RiskSignal, number>,
	};
	const trainScores = aspTrain.signals.map((s) => scoreSignals(s, model));
	const testScores = aspTest.signals.map((s) => scoreSignals(s, model));

	// Ngưỡng điểm: "trung bình" = tối đa F1 trên train; "cao" = điểm nhỏ nhất đạt precision mục tiêu.
	const candidates = [
		...new Set(trainScores.map((s) => Number(s.toFixed(4)))),
	].sort((a, b) => a - b);
	const medium = pickBest(
		candidates,
		(c) =>
			rates(
				confusion(
					yTrain,
					trainScores.map((s) => s >= c),
				),
			).f1,
	).value;
	const high =
		candidates.find(
			(c) =>
				c > medium &&
				rates(
					confusion(
						yTrain,
						trainScores.map((s) => s >= c),
					),
				).precision >= HIGH_PRECISION_TARGET,
		) ?? candidates.at(-1)!;
	const cutoffs = { medium, high };

	// 5. Đánh giá
	const aspEval = evaluate(yTest, testScores, cutoffs);
	const anySignal = rates(
		confusion(
			yTest,
			aspTest.signals.map((s) => s.length > 0),
		),
	);
	const anySignalAuc = auc(
		yTest,
		aspTest.signals.map((s) => s.length),
	);

	const scale = standardizer(train.map((r) => continuousVector(r.features)));
	const lr = fitLogistic(
		train.map((r) => scale(continuousVector(r.features))),
		yTrain,
		{ iterations: 1500 },
	);
	const lrTrain = train.map((r) =>
		predictLogistic(lr, scale(continuousVector(r.features))),
	);
	// Ngưỡng của mốc tham chiếu chọn trên chính phân phối điểm của nó (200 phân vị), cùng tiêu chí F1.
	const lrSorted = [...lrTrain].sort((a, b) => a - b);
	const lrCandidates = range(1, 199).map(
		(q) => lrSorted[Math.floor((q / 200) * lrSorted.length)],
	);
	const lrCut = pickBest(
		lrCandidates,
		(c) =>
			rates(
				confusion(
					yTrain,
					lrTrain.map((s) => s >= c),
				),
			).f1,
	).value;
	const lrTest = test.map((r) =>
		predictLogistic(lr, scale(continuousVector(r.features))),
	);
	const lrEval = evaluate(yTest, lrTest, { medium: lrCut, high: 2 });

	const perCheckpoint = CHECKPOINTS.map((t) => {
		const idx = test.map((r, i) => (r.t === t ? i : -1)).filter((i) => i >= 0);
		const y = idx.map((i) => yTest[i]);
		return {
			t,
			n: idx.length,
			positiveRate: y.filter(Boolean).length / idx.length,
			asp: evaluate(
				y,
				idx.map((i) => testScores[i]),
				cutoffs,
			),
			lr: evaluate(
				y,
				idx.map((i) => lrTest[i]),
				{ medium: lrCut, high: 2 },
			),
		};
	});

	const perSignal = RISK_SIGNALS.map((signal) => {
		const fired = aspTest.signals.map((s) => s.includes(signal));
		const c = confusion(yTest, fired);
		return {
			signal,
			coverage: (c.tp + c.fp) / yTest.length,
			precision: rates(c).precision,
			weight: model.weights[signal],
		};
	});

	// Thời gian báo trước: với học viên rút môn trong tập test, mốc sớm nhất bị gắn cờ (≥ trung bình).
	const flaggedAt = new Map<string, number>();
	test.forEach((r, i) => {
		const key = `${r.module}|${r.presentation}|${r.student}`;
		if (testScores[i] >= cutoffs.medium && !flaggedAt.has(key))
			flaggedAt.set(key, r.t);
	});
	const withdrawn = new Map<string, number>();
	test.forEach((r) => {
		if (r.finalResult === 'Withdrawn' && r.unregistered !== null)
			withdrawn.set(
				`${r.module}|${r.presentation}|${r.student}`,
				r.unregistered,
			);
	});
	const leads = [...withdrawn.entries()]
		.filter(
			([key, day]) =>
				flaggedAt.has(key) && (flaggedAt.get(key) as number) < day,
		)
		.map(([key, day]) => day - (flaggedAt.get(key) as number))
		.sort((a, b) => a - b);
	const leadTime = {
		withdrawnStudents: withdrawn.size,
		flaggedBeforeWithdrawal: leads.length,
		medianDays: leads.length ? leads[Math.floor(leads.length / 2)] : null,
	};

	const calibration: RiskCalibration = {
		version: 'asp-oulad-v1',
		createdAt: new Date().toISOString(),
		source: {
			dataset: 'Open University Learning Analytics Dataset (OULAD)',
			url: 'https://archive.ics.uci.edu/dataset/349/open+university+learning+analytics+dataset',
			license:
				'CC BY 4.0 — Kuzilek, Hlosta & Zdrahal (2017), Scientific Data 4:170171',
			trainPresentations: TRAIN,
			testPresentations: TEST,
			checkpoints: CHECKPOINTS,
			label: 'final_result ∈ {Withdrawn, Fail}',
		},
		thresholds,
		model,
		cutoffs: {
			medium: Number(cutoffs.medium.toFixed(4)),
			high: Number(cutoffs.high.toFixed(4)),
		},
		metrics: {
			test: {
				rows: test.length,
				auc: aspEval.auc,
				medium: aspEval.medium,
				high: aspEval.high,
			},
			baselineLogisticContinuous: { auc: lrEval.auc, medium: lrEval.medium },
			leadTime,
		},
	};
	writeFileSync(
		resolve(__dirname, '../risk/risk-calibration.json'),
		`${JSON.stringify(calibration, null, '\t')}\n`,
	);

	const report = `# Đánh giá bộ cảnh báo sớm ASP trên OULAD

> Tệp này được sinh tự động bởi \`npm run oulad:calibrate\` (${calibration.createdAt}). Không sửa tay — sửa
> script rồi chạy lại. Phương pháp: [risk-asp-oulad.md](./risk-asp-oulad.md).

## Dữ liệu

- Bộ dữ liệu: ${calibration.source.dataset} — ${calibration.source.license}.
- Nhãn "nguy cơ": \`${calibration.source.label}\`. Mốc dự đoán: ngày ${CHECKPOINTS.join(', ')} kể từ đầu kỳ.
- Hiệu chỉnh (train): lượt mở ${TRAIN.join(', ')} — ${train.length} dòng, tỉ lệ nguy cơ ${pct(yTrain.filter(Boolean).length / yTrain.length)}.
- Đánh giá (test): lượt mở ${TEST.join(', ')} — ${test.length} dòng, tỉ lệ nguy cơ ${pct(yTest.filter(Boolean).length / yTest.length)}.
- Thời gian chạy clingo-wasm: train ${aspTrain.seconds.toFixed(1)} s, test ${aspTest.seconds.toFixed(1)} s (lô ${BATCH} học viên/lần giải). Số lần ngoại lệ được áp dụng trên test: ${aspTest.exceptions}.

## Ngưỡng luật (chọn trên train theo Youden J)

| Tham số | Giá trị | Youden J |
|---|---|---|
${Object.entries(thresholdLog)
	.map(
		([key, { value, youdenJ }]) =>
			`| \`${key}\` | ${typeof value === 'object' ? JSON.stringify(value) : String(value as number)} | ${fixed(youdenJ)} |`,
	)
	.join('\n')}

## Trọng số gộp (hồi quy logistic trên tín hiệu, train)

Hệ số chặn: ${fixed(model.intercept)}. Ngưỡng điểm: trung bình ≥ ${fixed(cutoffs.medium)} (tối đa F1 trên train), cao ≥ ${fixed(cutoffs.high)} (precision train ≥ ${HIGH_PRECISION_TARGET}).

| Tín hiệu | Trọng số (log-odds) | Tỉ lệ bật trên test | Precision trên test |
|---|---|---|---|
${perSignal.map((s) => `| \`${s.signal}\` | ${fixed(s.weight)} | ${pct(s.coverage)} | ${pct(s.precision)} |`).join('\n')}

## Kết quả trên tập test (${TEST.join(', ')})

| Phương pháp | AUC | Precision | Recall | F1 |
|---|---|---|---|---|
| ASP + gộp logistic (mức ≥ trung bình) | ${fixed(aspEval.auc)} | ${pct(aspEval.medium.precision)} | ${pct(aspEval.medium.recall)} | ${fixed(aspEval.medium.f1)} |
| ASP + gộp logistic (chỉ mức cao) | — | ${pct(aspEval.high.precision)} | ${pct(aspEval.high.recall)} | ${fixed(aspEval.high.f1)} |
| ASP thuần, "có ít nhất một tín hiệu" (không học trọng số) | ${fixed(anySignalAuc)}¹ | ${pct(anySignal.precision)} | ${pct(anySignal.recall)} | ${fixed(anySignal.f1)} |
| Tham chiếu: hồi quy logistic trên 12 feature liên tục | ${fixed(lrEval.auc)} | ${pct(lrEval.medium.precision)} | ${pct(lrEval.medium.recall)} | ${fixed(lrEval.medium.f1)} |

¹ AUC tính theo số tín hiệu bật.

Ma trận nhầm lẫn (ASP, mức ≥ trung bình): TP ${aspEval.medium.tp}, FP ${aspEval.medium.fp}, FN ${aspEval.medium.fn}, TN ${aspEval.medium.tn}.

### Theo mốc dự đoán (càng sớm càng khó)

| Mốc (ngày) | Số dòng | Tỉ lệ nguy cơ | AUC ASP | F1 ASP | AUC tham chiếu | F1 tham chiếu |
|---|---|---|---|---|---|---|
${perCheckpoint.map((p) => `| ${p.t} | ${p.n} | ${pct(p.positiveRate)} | ${fixed(p.asp.auc)} | ${fixed(p.asp.medium.f1)} | ${fixed(p.lr.auc)} | ${fixed(p.lr.medium.f1)} |`).join('\n')}

### Thời gian báo trước

Trong ${leadTime.withdrawnStudents} lượt học rút môn (có ngày rút) của tập test, ${leadTime.flaggedBeforeWithdrawal} lượt
được gắn cờ ở một mốc **trước** ngày rút; trung vị thời gian báo trước là ${leadTime.medianDays ?? '—'} ngày.
`;
	writeFileSync(
		resolve(
			__dirname,
			'../../../../docs/03-architecture/risk-evaluation-oulad.md',
		),
		report,
	);
	console.log(report);
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
