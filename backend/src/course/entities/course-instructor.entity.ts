import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { CourseInstructorRole } from '../../common/types';
import { User } from '../../user/entities/user.entity';
import { Cohort } from './cohort.entity';
import { Course } from './course.entity';

/**
 * Phân công giảng viên vào khoá học — `docs/02-specs/database-design.md` §3.2.3.
 *
 * Đây là **nguồn chân lý cho RBAC tầng truy vấn**: "giảng viên chỉ thấy dữ liệu khoá mình phụ
 * trách" (`docs/architecture.md` §8) được kiểm tra bằng bảng này, không phải bằng một cột trên
 * `courses`. `courses.owner_id` vẫn là chủ sở hữu chính (dùng cho hiển thị catalog và luôn được
 * coi là có quyền), còn bảng này bổ sung đồng giảng viên/trợ giảng và phạm vi theo lớp.
 *
 * `cohort_id IS NULL` = phụ trách cả khoá; có giá trị = chỉ phụ trách lớp đó.
 */
@Entity('course_instructors')
@Index('idx_course_instructors_user', ['userId'])
@Index('idx_course_instructors_cohort', ['cohortId'])
@Check(
	'chk_course_instructors_role',
	`"role_in_course" IN ('owner', 'co_instructor', 'assistant')`,
)
export class CourseInstructor extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'user_id' })
	userId: string;

	/** Phân công là dữ liệu thuộc sở hữu người dùng → `CASCADE` khi xoá cứng (§4.2). */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User;

	/**
	 * `NULL` = phụ trách cả khoá; có giá trị = chỉ phụ trách lớp đó.
	 *
	 * Ràng buộc chống phân công trùng là **index biểu thức**:
	 * `UNIQUE (course_id, user_id, COALESCE(cohort_id, '000…0'::uuid))` — không dùng UNIQUE ba cột
	 * thô vì Postgres coi mỗi `NULL` là khác nhau, nên `(course_id, user_id, NULL)` chèn được
	 * nhiều lần. Postgres 14 (mức tối thiểu README yêu cầu) chưa có `NULLS NOT DISTINCT` nên
	 * `COALESCE` là cách an toàn. DDL nằm trong migration; `@Index` dưới đây chỉ để tài liệu hoá.
	 */
	@Index('uq_course_instructors_course_user_cohort', { synchronize: false })
	@Column({ type: 'uuid', name: 'cohort_id', nullable: true })
	cohortId: string | null;

	/** Xoá lớp không được xoá phân công — phân công chỉ thu hẹp về "cả khoá" (§4.2). */
	@ManyToOne(() => Cohort, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'cohort_id' })
	cohort: Cohort | null;

	@Column({
		type: 'varchar',
		name: 'role_in_course',
		length: 20,
		default: 'co_instructor',
	})
	roleInCourse: CourseInstructorRole;

	@Column({ type: 'uuid', name: 'assigned_by', nullable: true })
	assignedBy: string | null;

	/** Người phân công có thể bị xoá mà phân công vẫn còn giá trị nghiệp vụ (§4.2). */
	@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'assigned_by' })
	assignedByUser: User | null;

	@Column({ type: 'timestamptz', name: 'assigned_at', default: () => 'now()' })
	assignedAt: Date;
}
