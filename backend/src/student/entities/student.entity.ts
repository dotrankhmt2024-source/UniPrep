import { Column, Entity } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';

@Entity('students')
export class Student extends BaseEntityCustom {
	@Column({ type: 'varchar', name: 'full_name', length: 255 })
	fullName: string;

	@Column({ type: 'varchar', name: 'student_code', length: 50, unique: true })
	studentCode: string;

	@Column({ type: 'varchar', name: 'email', length: 255, unique: true })
	email: string;

	@Column({ type: 'varchar', name: 'phone', length: 20, nullable: true })
	phone: string | null;

	@Column({ type: 'varchar', name: 'major', length: 255, nullable: true })
	major: string | null;

	@Column({ type: 'boolean', name: 'is_active', default: true })
	isActive: boolean;
}
