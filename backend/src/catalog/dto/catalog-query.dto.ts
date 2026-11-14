import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import {
	DEFAULT_PAGE,
	DEFAULT_TAKE,
	MAX_TAKE,
} from '../../common/dto/pagination-query.dto';
import { trimString } from '../../common/transformers/trim.transformer';
import { OUTLINE_VERSION_PATTERN } from '../catalog-ref';

export class SearchCatalogCoursesQueryDto {
	@ApiPropertyOptional({
		description: 'Mã môn (khớp tiền tố) hoặc một phần tên môn tiếng Việt/Anh.',
		example: 'CO10',
		maxLength: 100,
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi.' })
	@MaxLength(100, { message: 'Từ khoá tìm kiếm tối đa 100 ký tự.' })
	search?: string;

	@ApiPropertyOptional({
		description: 'Mã khoa trong Catalog, ví dụ MT.',
		example: 'MT',
	})
	@IsOptional()
	@Transform(trimString)
	@IsString({ message: 'Mã khoa phải là chuỗi.' })
	@MaxLength(20, { message: 'Mã khoa tối đa 20 ký tự.' })
	faculty?: string;

	@ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số trang phải là số nguyên.' })
	@Min(1, { message: 'Số trang phải lớn hơn hoặc bằng 1.' })
	page: number = DEFAULT_PAGE;

	@ApiPropertyOptional({ default: DEFAULT_TAKE, minimum: 1, maximum: MAX_TAKE })
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên.' })
	@Min(1, { message: 'Số bản ghi mỗi trang phải lớn hơn hoặc bằng 1.' })
	@Max(MAX_TAKE, { message: `Số bản ghi mỗi trang tối đa là ${MAX_TAKE}.` })
	take: number = DEFAULT_TAKE;
}

export class CatalogVersionQueryDto {
	@ApiPropertyOptional({
		description: 'Phiên bản đề cương; bỏ trống để lấy bản hiện hành.',
		example: '9.1',
	})
	@IsOptional()
	@Transform(trimString)
	@Matches(OUTLINE_VERSION_PATTERN, {
		message: 'Phiên bản đề cương không hợp lệ.',
	})
	version?: string;
}

export class CatalogSkillGraphQueryDto extends CatalogVersionQueryDto {
	@ApiPropertyOptional({ enum: ['vi', 'en'], default: 'vi' })
	@IsOptional()
	@IsIn(['vi', 'en'], { message: 'Ngôn ngữ chỉ nhận vi hoặc en.' })
	lang: 'vi' | 'en' = 'vi';
}
