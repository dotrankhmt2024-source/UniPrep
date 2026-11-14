import {
	RISK_SIGNALS,
	type RiskSignal,
	type RiskThresholds,
} from './risk-features';

/**
 * Gộp các tín hiệu ASP thành điểm rủi ro 0–1 bằng hồi quy logistic trên **biến nhị phân "tín hiệu
 * có bật không"**: `score = σ(b + Σ w_r)`. Hệ số `w_r` được ước lượng trên OULAD và cũng chính là
 * **mức đóng góp** của từng lý do khi giải thích (log-odds cộng thêm), nên giải thích khớp đúng với
 * cách tính điểm, không phải một lớp giải thích gắn thêm sau.
 */
export interface RiskCalibration {
	version: string;
	createdAt: string;
	source: {
		dataset: string;
		url: string;
		license: string;
		trainPresentations: string[];
		testPresentations: string[];
		checkpoints: number[];
		label: string;
	};
	thresholds: RiskThresholds;
	model: {
		intercept: number;
		weights: Record<RiskSignal, number>;
	};
	/** Ngưỡng điểm đề xuất (chọn trên tập train), dùng khi `alert_settings` chưa cấu hình. */
	cutoffs: { medium: number; high: number };
	/** Số đo trên tập test — chép từ báo cáo đánh giá, không sửa tay. */
	metrics: Record<string, unknown>;
}

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export const scoreSignals = (
	signals: readonly RiskSignal[],
	model: RiskCalibration['model'],
): number =>
	sigmoid(
		model.intercept +
			signals.reduce((sum, signal) => sum + (model.weights[signal] ?? 0), 0),
	);

/** Vector nhị phân theo thứ tự `RISK_SIGNALS` (đầu vào của hồi quy). */
export const signalVector = (signals: readonly RiskSignal[]): number[] =>
	RISK_SIGNALS.map((signal) => (signals.includes(signal) ? 1 : 0));

export interface LogisticFit {
	intercept: number;
	weights: number[];
}

/**
 * Hồi quy logistic có điều chuẩn L2, giải bằng gradient descent theo lô đầy đủ. Đủ cho vài chục
 * nghìn dòng × chục feature; viết tay để không kéo thêm thư viện ML vào backend.
 */
export const fitLogistic = (
	rows: number[][],
	labels: number[],
	options: { iterations?: number; learningRate?: number; l2?: number } = {},
): LogisticFit => {
	const iterations = options.iterations ?? 600;
	const learningRate = options.learningRate ?? 0.5;
	const l2 = options.l2 ?? 1e-3;
	const dims = rows[0]?.length ?? 0;
	const weights = new Array<number>(dims).fill(0);
	let intercept = 0;
	const n = rows.length;

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const gradient = new Array<number>(dims).fill(0);
		let gradientIntercept = 0;
		for (let i = 0; i < n; i += 1) {
			const row = rows[i];
			let z = intercept;
			for (let j = 0; j < dims; j += 1) z += weights[j] * row[j];
			const error = sigmoid(z) - labels[i];
			gradientIntercept += error;
			for (let j = 0; j < dims; j += 1) gradient[j] += error * row[j];
		}
		intercept -= (learningRate * gradientIntercept) / n;
		for (let j = 0; j < dims; j += 1)
			weights[j] -= learningRate * (gradient[j] / n + l2 * weights[j]);
	}
	return { intercept, weights };
};

export const predictLogistic = (fit: LogisticFit, row: number[]): number => {
	let z = fit.intercept;
	for (let j = 0; j < row.length; j += 1) z += fit.weights[j] * row[j];
	return sigmoid(z);
};
