import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * `PATCH /api/courses/:id/publish` (E3-T1).
 *
 * `publishLessons` mặc định là `false`: công bố khoá học **không** tự động công bố bài học, vì một
 * khoá có thể đang được công bố dần theo từng chương. FE bật cờ này khi muốn "công bố tất cả".
 */
export class PublishCourseDto {
	@ApiPropertyOptional({
		default: false,
		description:
			'Công bố luôn mọi chương và bài học chưa công bố của khoá này.',
	})
	@IsOptional()
	@IsBoolean({ message: 'Công bố bài học phải là true/false.' })
	publishLessons?: boolean;
}
