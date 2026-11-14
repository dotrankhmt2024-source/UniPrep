/**
 * Chạy clingo (bản WebAssembly `clingo-wasm`) ngay trong tiến trình Node — không cần cài clingo hay
 * Python trong container.
 *
 * `clingo-wasm` là gói ESM-only còn backend biên dịch ra CommonJS: TypeScript sẽ đổi `import()` thành
 * `require()`, nên dùng `new Function` để giữ nguyên `import()` động của Node.
 */
interface ClingoWitness {
	Value: string[];
	Costs?: number[];
}

interface ClingoOk {
	Result: 'SATISFIABLE' | 'UNSATISFIABLE' | 'UNKNOWN' | 'OPTIMUM FOUND';
	Call: { Witnesses?: ClingoWitness[] }[];
	Time?: { Total: number };
}

interface ClingoFail {
	Result: 'ERROR';
	Error: string;
}

interface ClingoModule {
	run: (
		program: string,
		models?: number,
		options?: string[],
	) => Promise<ClingoOk | ClingoFail>;
}

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- chuỗi cố định, chỉ để giữ `import()` ESM khi build CommonJS
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
	specifier: string,
) => Promise<ClingoModule & { default?: ClingoModule }>;

let modulePromise: Promise<ClingoModule> | null = null;
/** clingo-wasm dùng một worker chung: xếp hàng để hai lần chạy không chen nhau. */
let queue: Promise<unknown> = Promise.resolve();

const load = (): Promise<ClingoModule> => {
	modulePromise ??= dynamicImport('clingo-wasm').then((mod) =>
		typeof mod.run === 'function' ? mod : (mod.default as ClingoModule),
	);
	return modulePromise;
};

export interface ClingoAnswer {
	atoms: string[];
	optimal: boolean;
	costs: number[];
	timeSeconds: number | null;
}

export class ClingoError extends Error {}

/**
 * Giải chương trình và trả answer set cuối cùng (với bài toán tối ưu, clingo in các model tốt dần nên
 * model cuối là model tối ưu nhất tìm được).
 */
export const solve = (
	program: string,
	options: string[] = [],
): Promise<ClingoAnswer> => {
	const task = queue.then(async () => {
		const clingo = await load();
		const result = await clingo.run(program, 0, options);
		if (result.Result === 'ERROR') throw new ClingoError(result.Error);
		if (result.Result === 'UNSATISFIABLE')
			throw new ClingoError('Chương trình ASP không có nghiệm (UNSATISFIABLE)');
		const witnesses = result.Call.flatMap((call) => call.Witnesses ?? []);
		const last = witnesses.at(-1);
		return {
			atoms: last?.Value ?? [],
			optimal: result.Result === 'OPTIMUM FOUND',
			costs: last?.Costs ?? [],
			timeSeconds: result.Time?.Total ?? null,
		};
	});
	queue = task.catch(() => undefined);
	return task;
};
