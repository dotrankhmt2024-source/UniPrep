import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@ApiTags('Student')
@Controller('students')
export class StudentController {
	constructor(private readonly studentService: StudentService) {}

	@Post()
	@ApiOperation({ summary: 'Tạo sinh viên mới' })
	create(@Body() dto: CreateStudentDto) {
		return this.studentService.create(dto);
	}

	@Get()
	@ApiOperation({ summary: 'Danh sách sinh viên' })
	findAll() {
		return this.studentService.findAll();
	}

	@Get(':id')
	@ApiOperation({ summary: 'Chi tiết sinh viên' })
	findOne(@Param('id') id: string) {
		return this.studentService.findOne(id);
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Cập nhật thông tin sinh viên' })
	update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
		return this.studentService.update(id, dto);
	}

	@Delete(':id')
	@ApiOperation({ summary: 'Xóa sinh viên' })
	remove(@Param('id') id: string) {
		return this.studentService.remove(id);
	}
}
