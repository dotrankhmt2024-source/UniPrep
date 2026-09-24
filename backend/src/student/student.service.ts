import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentService {
	constructor(
		@InjectRepository(Student)
		private readonly studentRepo: Repository<Student>,
	) {}

	async create(dto: CreateStudentDto): Promise<Student> {
		const student = this.studentRepo.create(dto);
		return this.studentRepo.save(student);
	}

	async findAll(): Promise<Student[]> {
		return this.studentRepo.find({ order: { createdAt: 'DESC' } });
	}

	async findOne(id: string): Promise<Student> {
		const student = await this.studentRepo.findOne({ where: { id } });
		if (!student) {
			throw new NotFoundException(`Không tìm thấy sinh viên với ID ${id}`);
		}
		return student;
	}

	async update(id: string, dto: UpdateStudentDto): Promise<Student> {
		const student = await this.findOne(id);
		this.studentRepo.merge(student, dto);
		return this.studentRepo.save(student);
	}

	async remove(id: string): Promise<{ success: boolean }> {
		const student = await this.findOne(id);
		await this.studentRepo.remove(student);
		return { success: true };
	}
}
