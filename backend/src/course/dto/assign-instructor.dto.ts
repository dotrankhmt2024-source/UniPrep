import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
	COURSE_INSTRUCTOR_ROLE_LABEL,
	type CourseInstructorRole,
} from '../../common/types';

/**
 * Ba vai trò trong `course_instructors`, khai **theo thứ tự tự nhiên** của union
 * (`common/types/course.type.ts`).
 *
 * Vì sao không suy ra từ `Object.keys(COURSE_INSTRUCTOR_ROLE_LABEL)`: thứ tự khoá object là chi
 * tiết runtime, còn thông điệp lỗi `400` hiển thị danh sách này cho người dùng — thứ tự phải ổn
 * định và đọc được. `satisfies` bảo đảm không lệch khi union thay đổi.
 */
const COURSE_INSTRUCTOR_ROLE_VALUES = [
	'owner',
	'co_instructor',
	'assistant',
] as const satisfies readonly CourseInstructorRole[];

/**
 * `POST /api/courses/:id/instructors` (E3-T1) — phân công đồng giảng viên/trợ giảng.
 *
 * `cohortId` là **phạm vi lớp** của phân công: `null` = phụ trách cả khoá. DTO không kiểm tra lớp
 * có thuộc khoá này hay không (cần `id` trên đường dẫn) — `CourseService` làm việc đó và trả `404`
 * thay vì để FK chấp nhận một phân công chéo khoá.
 */
export class AssignInstructorDto {
	@ApiProperty({
		description: 'Người dùng được phân công (UUID v4, vai trò `teacher`).',
	})
	@IsUUID('4', { message: 'Giảng viên được phân công không hợp lệ.' })
	userId: string;

	@ApiPropertyOptional({
		enum: COURSE_INSTRUCTOR_ROLE_VALUES,
		default: 'co_instructor',
		description: COURSE_INSTRUCTOR_ROLE_VALUES.map(
			(role) => `${role}: ${COURSE_INSTRUCTOR_ROLE_LABEL[role]}`,
		).join(' · '),
	})
	@IsOptional()
	@IsIn(COURSE_INSTRUCTOR_ROLE_VALUES, {
		message: `Vai trò trong khoá học không hợp lệ (chỉ nhận: ${COURSE_INSTRUCTOR_ROLE_VALUES.join(', ')}).`,
	})
	roleInCourse?: CourseInstructorRole;

	@ApiPropertyOptional({
		nullable: true,
		description: 'Lớp phụ trách (UUID v4) hoặc `null` = phụ trách cả khoá.',
	})
	@IsOptional()
	@IsUUID('4', { message: 'Lớp phụ trách không hợp lệ.' })
	cohortId?: string | null;
}
