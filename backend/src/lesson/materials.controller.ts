import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Query,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { LessonService, type UploadedFileLike } from './lesson.service';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { buildSuccess, ApiResponseDto } from '../common/dto/api-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UUID_V4_PIPE } from '../common/pipes/uuid-param.pipe';
import { LESSON_MESSAGE } from './constants/lesson-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { MaterialItem, PaginatedMaterials } from './types/lesson.type';

/**
 * Endpoint học liệu (E3-T4).
 *
 * `FileInterceptor('file')` **không** truyền tham số `storage` ⇒ multer giữ tệp trong bộ nhớ
 * (`file.buffer`). Đó là chủ đích: tệp phải qua whitelist MIME và giới hạn dung lượng **của ứng
 * dụng** trước khi chạm đĩa, và tên tệp trên đĩa do `StorageService` sinh (UUID) chứ không phải tên
 * client gửi — dùng `diskStorage` sẽ ghi tệp ngay khi request tới, trước mọi kiểm tra.
 *
 * Đánh đổi đã biết: tệp nằm trọn trong RAM một request, nên trần dung lượng (`MAX_UPLOAD_SIZE_MB`,
 * mặc định 50 MB) là hàng rào chống tự DoS — **không** được bỏ.
 */
@ApiTags('Materials')
@Controller()
export class MaterialsController {
	constructor(private readonly lessonService: LessonService) {}

	/**
	 * `POST /api/lessons/:id/materials` — multipart, field tệp tên `file`, field văn bản `title`.
	 *
	 * Mã lỗi theo đúng thứ tự kiểm tra trong service: `400` (không có tệp), `415` (MIME ngoài
	 * whitelist), `413` (quá dung lượng). `@Body()` ở đây **chỉ** chứa field văn bản — xem cảnh báo
	 * trong `UploadMaterialDto` về việc `whitelist: true` gỡ `file` khỏi body của multipart.
	 */
	@Post('lessons/:id/materials')
	@Roles('teacher', 'admin')
	@UseInterceptors(FileInterceptor('file'))
	@ApiBearerAuth()
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['file'],
			properties: {
				file: { type: 'string', format: 'binary' },
				title: { type: 'string', maxLength: 255 },
			},
		},
	})
	@ApiOperation({ summary: 'Tải học liệu lên bài học' })
	@ApiCreatedResponse({ type: ApiResponseDto })
	async upload(
		@Param('id', UUID_V4_PIPE) id: string,
		@UploadedFile() file: UploadedFileLike | undefined,
		@Body() dto: UploadMaterialDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<MaterialItem>> {
		const data = await this.lessonService.createMaterial(id, file, dto, actor);
		return buildSuccess(data, LESSON_MESSAGE.materialUploaded);
	}

	/**
	 * `GET /api/lessons/:id/materials` — **cùng** quy tắc hiển thị với `GET /api/lessons/:id` (service
	 * dùng chung một private method; không chép lại điều kiện ở controller).
	 */
	@Get('lessons/:id/materials')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Danh sách học liệu của bài học' })
	@ApiOkResponse({ type: ApiResponseDto })
	async findAll(
		@Param('id', UUID_V4_PIPE) id: string,
		@Query() query: PaginationQueryDto,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<PaginatedMaterials>> {
		const data = await this.lessonService.findMaterials(id, query, actor);
		return buildSuccess(data);
	}

	/**
	 * `DELETE /api/materials/:id` — xoá hàng DB rồi xoá tệp best-effort.
	 *
	 * Thiếu tệp trên đĩa **không** làm request thất bại: hàng DB là nguồn chân lý, còn một tệp mồ côi
	 * chỉ tốn đĩa — trong khi báo lỗi sau khi hàng đã xoá sẽ để lại trạng thái nửa vời cho người dùng.
	 */
	@Delete('materials/:id')
	@Roles('teacher', 'admin')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xoá học liệu (kèm tệp đã tải lên nếu có)' })
	@ApiOkResponse({ type: ApiResponseDto })
	async remove(
		@Param('id', UUID_V4_PIPE) id: string,
		@CurrentUser() actor: AuthUser,
	): Promise<ApiResponseDto<{ success: boolean }>> {
		const data = await this.lessonService.deleteMaterial(id, actor);
		return buildSuccess(data, LESSON_MESSAGE.materialDeleted);
	}
}
