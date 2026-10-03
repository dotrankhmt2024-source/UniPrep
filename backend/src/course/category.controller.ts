import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FindCategoriesQueryDto } from './dto/find-categories-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { CategoryItem, PaginatedCategories } from './types/course.type';

/**
 * Danh mục khoá học (E3-T3).
 *
 * Không route nào có `@Public()`: mọi endpoint vẫn nằm sau `JwtAuthGuard` toàn cục (yêu cầu của
 * E3 — catalog chỉ dành cho người đã đăng nhập). `@Roles('admin')` chỉ đặt trên đường ghi.
 */
@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
	constructor(private readonly categoryService: CategoryService) {}

	@Get()
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Danh sách danh mục có tìm kiếm và phân trang',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async findAll(
		@Query() query: FindCategoriesQueryDto,
	): Promise<ApiResponseDto<PaginatedCategories>> {
		const data = await this.categoryService.findMany(query);
		return buildSuccess(data);
	}

	@Post()
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Tạo danh mục (chỉ admin)' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async create(
		@Body() dto: CreateCategoryDto,
	): Promise<ApiResponseDto<CategoryItem>> {
		const data = await this.categoryService.create(dto);
		return buildSuccess(data, COURSE_MESSAGE.categoryCreated);
	}

	@Get(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem chi tiết một danh mục' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findOne(
		@Param('id', UUID_V4_PIPE) id: string,
	): Promise<ApiResponseDto<CategoryItem>> {
		const data = await this.categoryService.findOne(id);
		return buildSuccess(data);
	}

	@Patch(':id')
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật danh mục (chỉ admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async update(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateCategoryDto,
	): Promise<ApiResponseDto<CategoryItem>> {
		const data = await this.categoryService.update(id, dto);
		return buildSuccess(data, COURSE_MESSAGE.categoryUpdated);
	}

	@Delete(':id')
	@Roles('admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xoá danh mục chưa có khoá học (chỉ admin)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		await this.categoryService.remove(id);
		return buildSuccess({ success: true }, COURSE_MESSAGE.categoryDeleted);
	}
}
