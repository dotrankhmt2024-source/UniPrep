import { IsOptional, IsUUID } from 'class-validator';

export class CourseProgressQueryDto {
	@IsOptional()
	@IsUUID('4', { message: 'Mã học viên không hợp lệ.' })
	userId?: string;
}
