import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Course } from './course.entity';

/**
 * Điều kiện tiên quyết giữa hai khoá học (E3-T5).
 *
 * **Vì sao bảng này không có trong `database-design.md` bản gốc:** tài liệu đó (§3.2.2, cột
 * `description`) coi "điều kiện tiên quyết" là *văn bản* nằm trong đề cương, nên không mô hình
 * hoá được. DoD của E3-T5 lại đòi API trả cờ `eligible: false` **kèm lý do**, tức phải có dữ
 * liệu có cấu trúc để đối chiếu. Nhóm đã chốt (2026-10-03) bổ sung bảng này và ghi vào
 * `database-design.md` §3.2.8; `courses.description` vẫn giữ vai trò đề cương văn bản.
 *
 * **Định nghĩa "đã đạt" ở E3:** người gọi có một dòng `enrollments` với
 * `status = 'completed'` cho khoá tiên quyết. Bảng `enrollments` đã có từ baseline E0 nên quy
 * tắc này kiểm chứng được ngay ở E3, trước khi `EnrollmentModule` (E4) hoàn thiện.
 */
@Entity('course_prerequisites')
@Index('uq_course_prerequisites_pair', ['courseId', 'prerequisiteCourseId'], {
	unique: true,
})
@Check(
	'chk_course_prerequisites_not_self',
	`"course_id" <> "prerequisite_course_id"`,
)
export class CoursePrerequisite extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'course_id' })
	courseId: string;

	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'course_id' })
	course: Course;

	@Column({ type: 'uuid', name: 'prerequisite_course_id' })
	prerequisiteCourseId: string;

	/** Xoá khoá tiên quyết thì quan hệ tiên quyết cũng hết nghĩa → `CASCADE`. */
	@ManyToOne(() => Course, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'prerequisite_course_id' })
	prerequisiteCourse: Course;
}
