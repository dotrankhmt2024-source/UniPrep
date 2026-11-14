import { Controller, Get, Param, Query } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto, buildSuccess } from '../common/dto/api-response.dto';
import type { PageMeta } from '../common/dto/page-meta.dto';
import type { CatalogOutlineVersion } from './catalog.client';
import { CatalogService } from './catalog.service';
import type {
	CatalogCourseSummary,
	CatalogOutline,
	SkillGraph,
} from './catalog.types';
import {
	CatalogSkillGraphQueryDto,
	CatalogVersionQueryDto,
	SearchCatalogCoursesQueryDto,
} from './dto/catalog-query.dto';

/**
 * Catalog — nội dung môn học từ DB đề cương của trường (chỉ đọc). Mọi vai trò đã đăng nhập đều
 * xem được: đây là thông tin công khai về môn học, không chứa dữ liệu người học.
 */
@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
	constructor(private readonly catalog: CatalogService) {}

	@Get('status')
	@ApiOperation({ summary: 'Catalog đã được cấu hình kết nối hay chưa' })
	@ApiOkResponse({ type: ApiResponseDto })
	status(): ApiResponseDto<{ configured: boolean }> {
		return buildSuccess({ configured: this.catalog.isConfigured });
	}

	@Get('courses')
	@ApiOperation({ summary: 'Tìm môn học trong Catalog (theo mã hoặc tên)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async search(
		@Query() query: SearchCatalogCoursesQueryDto,
	): Promise<
		ApiResponseDto<{ items: CatalogCourseSummary[]; meta: PageMeta }>
	> {
		return buildSuccess(
			await this.catalog.searchCourses({
				q: query.search,
				facultyCode: query.faculty,
				page: query.page,
				take: query.take,
			}),
		);
	}

	@Get('courses/:code/versions')
	@ApiOperation({ summary: 'Các phiên bản đề cương của một môn' })
	@ApiParam({ name: 'code', example: 'CO1023' })
	@ApiOkResponse({ type: ApiResponseDto })
	async versions(
		@Param('code') code: string,
	): Promise<ApiResponseDto<CatalogOutlineVersion>> {
		return buildSuccess(await this.catalog.listVersions(code));
	}

	@Get('courses/:code/outline')
	@ApiOperation({ summary: 'Đề cương đầy đủ (mặc định bản hiện hành)' })
	@ApiParam({ name: 'code', example: 'CO1023' })
	@ApiOkResponse({ type: ApiResponseDto })
	async outline(
		@Param('code') code: string,
		@Query() query: CatalogVersionQueryDto,
	): Promise<ApiResponseDto<CatalogOutline>> {
		return buildSuccess(await this.catalog.getOutline(code, query.version));
	}

	@Get('courses/:code/skill-graph')
	@ApiOperation({
		summary:
			'Đồ thị kỹ năng dựng từ đề cương (chủ đề, kỹ năng, chuẩn đầu ra, tiên quyết)',
	})
	@ApiParam({ name: 'code', example: 'CO1023' })
	@ApiOkResponse({ type: ApiResponseDto })
	async skillGraph(
		@Param('code') code: string,
		@Query() query: CatalogSkillGraphQueryDto,
	): Promise<ApiResponseDto<SkillGraph>> {
		return buildSuccess(
			await this.catalog.getSkillGraph(code, query.version, query.lang),
		);
	}
}
