import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { CohortService } from './cohort.service';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { CohortItem } from './types/course.type';

/**
 * Lớp/nhóm học viên (E3-T1) — đường dẫn riêng `/api/cohorts/:id`.
 *
 * Tách khỏi `/api/courses/:id/cohorts` vì lớp có định danh riêng: FE sửa một lớp sau khi đã có id
 * của nó, và lồng thêm `courseId` vào URL sẽ buộc client gọi hai API chỉ để lấy một id. Quyền vẫn
 * được kiểm tra qua khoá học chứa lớp (trong `CohortService`).
 *
 * Không route nào có `@Public()`; `@Roles('teacher','admin')` chặn `student` ở tầng route, phần
 * "đúng khoá học này hay không" do service quyết định.
 */
@ApiTags('Cohorts')
@Controller('cohorts')
export class CohortController {
	constructor(private readonly cohortService: CohortService) {}

	@Patch(':id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật lớp của khoá học mình phụ trách' })
	@ApiOkResponse({ type: ApiResponseDto })
	async update(
		@Param('id', UUID_V4_PIPE) id: string,
		@Body() dto: UpdateCohortDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<CohortItem>> {
		const data = await this.cohortService.update(id, dto, actor);
		return buildSuccess(data, COURSE_MESSAGE.cohortUpdated);
	}

	@Delete(':id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Xoá lớp (giữ nguyên ghi danh và phân công giảng viên)',
	})
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		await this.cohortService.remove(id, actor);
		return buildSuccess({ success: true }, COURSE_MESSAGE.cohortDeleted);
	}
}
