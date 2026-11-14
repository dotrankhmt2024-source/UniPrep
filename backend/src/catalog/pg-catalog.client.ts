import {
	Injectable,
	Logger,
	OnModuleDestroy,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';
import {
	CatalogClient,
	type CatalogOutlineVersion,
	type CatalogSearchQuery,
	type CatalogSearchResult,
} from './catalog.client';
import { courseRef, normalizeCourseCode } from './catalog-ref';
import type {
	CatalogOutline,
	CatalogPrerequisite,
	RawOutlineContent,
} from './catalog.types';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

interface VersionRow {
	id: string;
	course_code: string;
	version: string;
	applies_from: string | null;
	name_vi: string | null;
	name_en: string | null;
	credits: number | null;
	faculty_code: string | null;
}

interface OutlineRow extends VersionRow {
	source_code: string | null;
	source_updated_at: Date | null;
	content_hash: string;
	content: RawOutlineContent;
}

interface PrerequisiteRow {
	related_course_code: string;
	type: string | null;
	type_raw: string | null;
}

const VERSION_COLUMNS =
	'id, course_code, version, applies_from, name_vi, name_en, credits, faculty_code';

/** Thoát ký tự đại diện của LIKE để từ khoá của người dùng được so khớp nguyên văn. */
function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toVersion(row: VersionRow): CatalogOutlineVersion {
	return {
		id: row.id,
		courseCode: row.course_code,
		version: row.version,
		appliesFrom: row.applies_from,
		name: { vi: row.name_vi, en: row.name_en },
		credits: row.credits === null ? null : Number(row.credits),
		facultyCode: row.faculty_code,
	};
}

/**
 * Đọc trực tiếp DB đề cương của trường (Supabase, schema `bk_uni`) — **chỉ đọc**.
 *
 * - Mọi truy vấn chạy trong `BEGIN READ ONLY`: dù role DB có quyền ghi, server Postgres vẫn từ
 *   chối mọi lệnh ghi lọt vào. Chỉ đụng tới `course_outlines` và `course_outline_prerequisites`;
 *   dữ liệu sinh viên của DB kia không bao giờ được đọc.
 * - Pool được tạo lười ở lần gọi đầu, nên app vẫn khởi động bình thường khi chưa cấu hình
 *   `CATALOG_DB_*` (các endpoint Catalog trả 503).
 */
@Injectable()
export class PgCatalogClient extends CatalogClient implements OnModuleDestroy {
	private readonly logger = new Logger(PgCatalogClient.name);
	private pool: Pool | null = null;
	private readonly schema: string;

	constructor(private readonly config: ConfigService) {
		super();
		const schema = (
			this.config.get<string>('CATALOG_DB_SCHEMA') ?? 'bk_uni'
		).trim();
		if (!SCHEMA_PATTERN.test(schema)) {
			throw new Error(`CATALOG_DB_SCHEMA không hợp lệ: "${schema}"`);
		}
		this.schema = `"${schema}"`;
	}

	get isConfigured(): boolean {
		return Boolean(
			this.config.get<string>('CATALOG_DB_HOST') &&
			this.config.get<string>('CATALOG_DB_USERNAME') &&
			this.config.get<string>('CATALOG_DB_NAME'),
		);
	}

	async onModuleDestroy(): Promise<void> {
		await this.pool?.end();
		this.pool = null;
	}

	private getPool(): Pool {
		if (!this.isConfigured) {
			throw new ServiceUnavailableException(
				'Chưa cấu hình kết nối Catalog môn học (CATALOG_DB_*).',
			);
		}
		if (!this.pool) {
			const ssl = (
				this.config.get<string>('CATALOG_DB_SSL') ?? 'require'
			).toLowerCase();
			this.pool = new Pool({
				host: this.config.get<string>('CATALOG_DB_HOST'),
				port: Number(this.config.get<string>('CATALOG_DB_PORT') ?? 5432),
				user: this.config.get<string>('CATALOG_DB_USERNAME'),
				password: this.config.get<string>('CATALOG_DB_PASSWORD'),
				database: this.config.get<string>('CATALOG_DB_NAME'),
				// Supabase pooler dùng chứng chỉ không nằm trong CA mặc định của Node.
				ssl: ssl === 'disable' ? false : { rejectUnauthorized: false },
				max: Number(this.config.get<string>('CATALOG_DB_POOL_MAX') ?? 3),
				idleTimeoutMillis: 30_000,
				connectionTimeoutMillis: 10_000,
				query_timeout: 15_000,
				application_name: 'uniprep-catalog-reader',
			});
			this.pool.on('error', (error) =>
				this.logger.warn(`Kết nối Catalog bị đóng: ${error.message}`),
			);
		}
		return this.pool;
	}

	/** Chạy `work` trong một transaction chỉ đọc rồi trả kết nối về pool. */
	private async readOnly<T>(
		work: (client: PoolClient) => Promise<T>,
	): Promise<T> {
		let client: PoolClient;
		try {
			client = await this.getPool().connect();
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			this.logger.error(
				`Không kết nối được Catalog: ${(error as Error).message}`,
			);
			throw new ServiceUnavailableException(
				'Không kết nối được Catalog môn học.',
			);
		}
		try {
			await client.query('BEGIN READ ONLY');
			const result = await work(client);
			await client.query('COMMIT');
			return result;
		} catch (error) {
			await client.query('ROLLBACK').catch(() => undefined);
			this.logger.error(`Truy vấn Catalog lỗi: ${(error as Error).message}`);
			throw new ServiceUnavailableException(
				'Catalog môn học đang lỗi, thử lại sau.',
			);
		} finally {
			client.release();
		}
	}

	async searchCourses(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
		const keyword = query.q?.trim() ? escapeLike(query.q.trim()) : null;
		const faculty = query.facultyCode?.trim() || null;
		const filter = `
			($1::text is null
				or course_code ilike $1 || '%'
				or name_vi ilike '%' || $1 || '%'
				or name_en ilike '%' || $1 || '%')
			and ($2::text is null or faculty_code = $2)`;

		return this.readOnly(async (client) => {
			const total = await client.query<{ total: string }>(
				`select count(distinct course_code) as total
				 from ${this.schema}.course_outlines where ${filter}`,
				[keyword, faculty],
			);
			const rows = await client.query<VersionRow>(
				`with page as (
					select course_code from ${this.schema}.course_outlines
					where ${filter}
					group by course_code order by course_code
					limit $3 offset $4
				)
				select ${VERSION_COLUMNS} from ${this.schema}.course_outlines
				where course_code in (select course_code from page)
				order by course_code, applies_from desc nulls last, version desc`,
				[keyword, faculty, query.limit, query.offset],
			);
			return {
				versions: rows.rows.map(toVersion),
				totalCourses: Number(total.rows[0]?.total ?? 0),
			};
		});
	}

	async listVersions(courseCode: string): Promise<CatalogOutlineVersion[]> {
		return this.readOnly(async (client) => {
			const rows = await client.query<VersionRow>(
				`select ${VERSION_COLUMNS} from ${this.schema}.course_outlines
				 where course_code = $1 order by applies_from desc nulls last, version desc`,
				[normalizeCourseCode(courseCode)],
			);
			return rows.rows.map(toVersion);
		});
	}

	async getOutline(
		courseCode: string,
		version: string,
	): Promise<CatalogOutline | null> {
		return this.readOnly(async (client) => {
			const outline = await client.query<OutlineRow>(
				`select ${VERSION_COLUMNS}, source_code, source_updated_at, content_hash, content
				 from ${this.schema}.course_outlines
				 where course_code = $1 and version = $2`,
				[normalizeCourseCode(courseCode), version.trim()],
			);
			const row = outline.rows[0];
			if (!row) return null;

			const prereqs = await client.query<PrerequisiteRow>(
				`select related_course_code, type, type_raw
				 from ${this.schema}.course_outline_prerequisites
				 where outline_id = $1 order by related_course_code`,
				[row.id],
			);
			const base = toVersion(row);
			const prerequisites: CatalogPrerequisite[] = prereqs.rows.map((p) => ({
				courseCode: p.related_course_code,
				type: p.type,
				typeRaw: p.type_raw,
			}));
			return {
				ref: courseRef(base.courseCode, base.version),
				courseCode: base.courseCode,
				version: base.version,
				appliesFrom: base.appliesFrom,
				sourceCode: row.source_code,
				sourceUpdatedAt: row.source_updated_at
					? row.source_updated_at.toISOString()
					: null,
				contentHash: row.content_hash,
				name: base.name,
				credits: base.credits,
				prerequisites,
				content: row.content,
			};
		});
	}
}
