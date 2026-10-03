import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from './course.entity';

/**
 * Lớp/nhóm học viên trong một khoá học — `docs/02-specs/database-design.md` §3.2.4.
 *
 * Đây là bảng mà E2-T3 đã dời sang E3 (chốt 2026-10-03) vì `cohorts.course_id` là FK tới
 * `courses`, mà `courses` chỉ có API từ E3-T1. Vai trò của nó trong hệ thống:
 * (a) phạm vi dữ liệu của giảng viên theo lớp (`course_instructors.cohort_id`),
 * (b) đơn vị so sánh trên dashboard analytics (E8), (c) gắn học viên vào lớp qua
 * `enrollments.cohort_id`.
 *
 * Vì sao `group_code` và `class_code` tách rời: mockup hiển thị hai cấp (`CQ_HK261` là nhóm,
 * `L01` là lớp) và một nhóm có nhiều lớp; gộp thành một cột sẽ mất khả năng lọc theo nhóm.
 */
@Entity('cohorts')
@Check(
	'chk_cohorts_dates',
	`"ends_on" IS NULL OR "starts_on" IS NULL OR "ends_on" >= "starts_on"`,
)
export class Cohort extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	/** Lớp không tồn tại độc lập với khoá học → `CASCADE` (§4.2). */
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	/** Nhóm lớp, ví dụ `'CQ_HK261'`. */
	@Column({ type: 'varchar', name: 'group_code', length: 50, nullable: true })
	groupCode: string | null;

	/**
	 * Lớp, ví dụ `'L01'`. Cùng một khoá không được có hai lớp trùng mã.
	 *
	 * Index thật là **partial + unique** (`UNIQUE (course_id, class_code) WHERE class_code IS
	 * NOT NULL`) nên `@Index` chỉ là placeholder tài liệu hoá tên; DDL nằm trong migration
	 * `CreateCohortsInstructorsPrerequisites`. Không dùng `@Index(..., ['courseId','classCode'],
	 * { unique: true })` vì Postgres coi mỗi `NULL` là khác nhau — nhiều lớp không có mã sẽ không
	 * bị chặn trùng, đúng như thiết kế mong muốn.
	 */
	@Index('uq_cohorts_course_class', { synchronize: false })
	@Column({ type: 'varchar', name: 'class_code', length: 50, nullable: true })
	classCode: string | null;

	@Column({ type: 'varchar', name: 'name', length: 150 })
	name: string;

	@Column({ type: 'varchar', name: 'semester', length: 20, nullable: true })
	semester: string | null;

	@Column({ type: 'date', name: 'starts_on', nullable: true })
	startsOn: string | null;

	@Column({ type: 'date', name: 'ends_on', nullable: true })
	endsOn: string | null;
}
