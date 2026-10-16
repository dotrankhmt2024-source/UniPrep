import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import {
	ContentReportReason,
	ContentReportStatus,
	ContentReportTargetType,
} from '../../common/types';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Báo cáo vi phạm nội dung để admin kiểm duyệt — bảng `content_reports`
 * (database-design.md §3.3.10).
 *
 * Phục vụ tiêu chí "moderate reported content" của Admin (proposal §3.1). Unique
 * index bộ phận `uq_content_reports_open` chặn một người báo cáo trùng cùng một
 * đối tượng khi báo cáo cũ còn đang mở.
 */
@Entity('content_reports')
@Check(
	'chk_content_reports_target_type',
	`"target_type" IN ('discussion_thread', 'discussion_post', 'lesson', 'lesson_material', 'course')`,
)
@Check(
	'chk_content_reports_reason',
	`"reason" IN ('spam', 'harassment', 'inappropriate', 'copyright', 'misinformation', 'other')`,
)
@Check(
	'chk_content_reports_status',
	`"status" IN ('pending', 'reviewing', 'resolved', 'rejected')`,
)
@Index('idx_content_reports_target', ['targetType', 'targetId'])
@Index('uq_content_reports_open', ['reporterId', 'targetType', 'targetId'], {
	unique: true,
	where: `"status" IN ('pending', 'reviewing')`,
})
export class ContentReport extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'reporter_id' })
	reporterId: string;

	/**
	 * §3.3.10 quy định CASCADE (khác nhóm dữ liệu tham chiếu như `reviewed_by`):
	 * báo cáo là dữ liệu do người dùng tạo nên phải xoá theo khi xoá cứng tài khoản (§4.2).
	 */
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'reporter_id' })
	reporter: User;

	/** Loại đối tượng bị báo cáo; quyết định bảng mà `target_id` trỏ tới. */
	@Column({ type: 'varchar', name: 'target_type', length: 25 })
	targetType: ContentReportTargetType;

	/**
	 * Tham chiếu đa hình tới 5 bảng khác nhau (`discussion_threads`,
	 * `discussion_posts`, `lessons`, `lesson_materials`, `courses`) nên **cố ý** không
	 * có FK; toàn vẹn do tầng service đảm bảo (§4.5 #1).
	 */
	@Column({ type: 'uuid', name: 'target_id' })
	targetId: string;

	@Column({ type: 'uuid', name: 'course_id', nullable: true })
	courseId: string | null;

	/**
	 * Denormalize để lọc báo cáo theo khoá mà không phải join bảng đích (đa hình).
	 * Dữ liệu tham chiếu ⇒ SET NULL, giữ lại báo cáo để còn vết kiểm duyệt (§4.2).
	 */
	@ManyToOne(() => Course, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'course_id' })
	course: Course | null;

	@Column({ type: 'varchar', name: 'reason', length: 30 })
	reason: ContentReportReason;

	/** Mô tả của người báo cáo (tiếng Việt). */
	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	/**
	 * DDL thủ công (index có `DESC`):
	 * `CREATE INDEX "idx_content_reports_status_time" ON "content_reports" ("status", "created_at" DESC);`
	 */
	@Index('idx_content_reports_status_time', { synchronize: false })
	@Column({ type: 'varchar', name: 'status', length: 20, default: 'pending' })
	status: ContentReportStatus;

	@Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
	reviewedById: string | null;

	/** Dữ liệu tham chiếu ⇒ SET NULL: báo cáo vẫn còn giá trị kiểm toán khi admin bị xoá (§4.2). */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'reviewed_by' })
	reviewedBy: User | null;

	@Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
	reviewedAt: Date | null;

	@Column({ type: 'text', name: 'resolution_note', nullable: true })
	resolutionNote: string | null;
}
