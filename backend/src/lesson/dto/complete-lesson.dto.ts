import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CompleteLessonDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Thời gian học phải là số nguyên.' })
	@Min(0, { message: 'Thời gian học không được âm.' })
	@Max(86400, { message: 'Thời gian học tối đa là 86400 giây.' })
	timeSpentSeconds = 0;
}
