import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PageMeta } from '../common/dto/page-meta.dto';
import { buildPageMeta, toSkip } from '../common/utils/pagination.util';
import { CatalogClient, type CatalogOutlineVersion } from './catalog.client';
import {
	isValidCourseCode,
	isValidOutlineVersion,
	normalizeCourseCode,
	parseCatalogKey,
	pickLatestVersion,
} from './catalog-ref';
import type {
	CatalogCourseSummary,
	CatalogOutline,
	SkillGraph,
	SkillGraphSkill,
	SkillGraphTopic,
} from './catalog.types';
import { buildSkillGraph, type CatalogLanguage } from './skill-graph.builder';
import { TtlCache } from './ttl-cache';

export interface CatalogSearchParams {
	q?: string;
	facultyCode?: string;
	page: number;
	take: number;
}

export interface ResolvedSkill {
	skill: SkillGraphSkill;
	topic: SkillGraphTopic;
	graph: SkillGraph;
}

/**
 * Cổng duy nhất để các module khác của UniPrep lấy nội dung môn học.
 *
 * Dữ liệu luôn đọc trực tiếp từ Catalog; cache chỉ giữ vài phút (`CATALOG_CACHE_TTL_SECONDS`,
 * mặc định 300, đặt 0 để tắt) cho đề cương và đồ thị kỹ năng đã dựng.
 */
@Injectable()
export class CatalogService {
	private readonly versionsCache: TtlCache<CatalogOutlineVersion[]>;
	private readonly outlineCache: TtlCache<CatalogOutline | null>;
	private readonly graphCache: TtlCache<SkillGraph>;

	constructor(
		private readonly client: CatalogClient,
		config: ConfigService,
	) {
		const raw = Number(config.get<string>('CATALOG_CACHE_TTL_SECONDS') ?? 300);
		const ttlMs = Number.isFinite(raw) && raw > 0 ? raw * 1000 : 0;
		this.versionsCache = new TtlCache(ttlMs);
		this.outlineCache = new TtlCache(ttlMs, 200);
		this.graphCache = new TtlCache(ttlMs, 200);
	}

	get isConfigured(): boolean {
		return this.client.isConfigured;
	}

	async searchCourses(
		params: CatalogSearchParams,
	): Promise<{ items: CatalogCourseSummary[]; meta: PageMeta }> {
		const { versions, totalCourses } = await this.client.searchCourses({
			q: params.q,
			facultyCode: params.facultyCode,
			limit: params.take,
			offset: toSkip(params.page, params.take),
		});

		const byCode = new Map<string, CatalogOutlineVersion[]>();
		for (const version of versions) {
			const list = byCode.get(version.courseCode) ?? [];
			list.push(version);
			byCode.set(version.courseCode, list);
		}
		const items: CatalogCourseSummary[] = [];
		for (const [courseCode, list] of byCode) {
			const latest = pickLatestVersion(list);
			if (!latest) continue;
			items.push({
				courseCode,
				latestVersion: latest.version,
				versions: list.map((v) => v.version),
				name: latest.name,
				credits: latest.credits,
				facultyCode: latest.facultyCode,
			});
		}
		return {
			items,
			meta: buildPageMeta(totalCourses, params.page, params.take),
		};
	}

	async listVersions(courseCode: string): Promise<CatalogOutlineVersion[]> {
		const code = this.assertCourseCode(courseCode);
		const versions = await this.versionsCache.getOrLoad(code, () =>
			this.client.listVersions(code),
		);
		if (!versions.length) {
			throw new NotFoundException(`Không tìm thấy đề cương môn ${code}.`);
		}
		return versions;
	}

	/** Đề cương của một phiên bản; bỏ trống `version` để lấy bản hiện hành. */
	async getOutline(
		courseCode: string,
		version?: string,
	): Promise<CatalogOutline> {
		const code = this.assertCourseCode(courseCode);
		const resolved = await this.resolveVersion(code, version);
		const outline = await this.outlineCache.getOrLoad(
			`${code}@${resolved}`,
			() => this.client.getOutline(code, resolved),
		);
		if (!outline) {
			throw new NotFoundException(
				`Không tìm thấy đề cương môn ${code} phiên bản ${resolved}.`,
			);
		}
		return outline;
	}

	async getSkillGraph(
		courseCode: string,
		version?: string,
		lang: CatalogLanguage = 'vi',
	): Promise<SkillGraph> {
		const outline = await this.getOutline(courseCode, version);
		return this.graphCache.getOrLoad(
			`${outline.ref}|${lang}|${outline.contentHash}`,
			() => Promise.resolve(buildSkillGraph(outline, lang)),
		);
	}

	/**
	 * Tra một kỹ năng theo khoá (`CO1023@9.1#3.4`) — dùng cho các module lưu khoá kỹ năng
	 * (mức thành thạo, ngân hàng câu hỏi) khi cần tên/chủ đề/chuẩn đầu ra của kỹ năng.
	 */
	async resolveSkill(
		key: string,
		lang: CatalogLanguage = 'vi',
	): Promise<ResolvedSkill> {
		const parsed = parseCatalogKey(key);
		if (!parsed?.local)
			throw new BadRequestException('Khoá kỹ năng không hợp lệ.');
		const graph = await this.getSkillGraph(
			parsed.courseCode,
			parsed.version,
			lang,
		);
		const skill = graph.skills.find((s) => s.key === key);
		const topic = skill && graph.topics.find((t) => t.key === skill.topicKey);
		if (!skill || !topic)
			throw new NotFoundException(`Không tìm thấy kỹ năng ${key}.`);
		return { skill, topic, graph };
	}

	private assertCourseCode(courseCode: string): string {
		if (!isValidCourseCode(courseCode)) {
			throw new BadRequestException('Mã môn học không hợp lệ.');
		}
		return normalizeCourseCode(courseCode);
	}

	private async resolveVersion(
		code: string,
		version?: string,
	): Promise<string> {
		if (version !== undefined && version.trim() !== '') {
			if (!isValidOutlineVersion(version)) {
				throw new BadRequestException('Phiên bản đề cương không hợp lệ.');
			}
			return version.trim();
		}
		const latest = pickLatestVersion(await this.listVersions(code));
		if (!latest)
			throw new NotFoundException(`Không tìm thấy đề cương môn ${code}.`);
		return latest.version;
	}
}
