import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { MaterialType } from '../../common/types';
import { Lesson } from './lesson.entity';

/**
 * Học liệu đính kèm bài học: text/slide/video/tệp/link
 * (`docs/02-specs/database-design.md` §3.2.7).
 *
 * Vì sao `duration_seconds` được lưu dù chỉ có nghĩa với video: đây là feature tiềm
 * năng "so sánh thời lượng xem thực tế với thời lượng video" (tỷ lệ xem hết).
 */
@Entity('lesson_materials')
@Check(
	'chk_lesson_materials_material_type',
	`"material_type" IN ('text', 'slide', 'video', 'file', 'link')`,
)
@Check(
	'chk_lesson_materials_file_size_bytes',
	'"file_size_bytes" IS NULL OR "file_size_bytes" >= 0',
)
@Check(
	'chk_lesson_materials_duration_seconds',
	'"duration_seconds" IS NULL OR "duration_seconds" >= 0',
)
@Check(
	'chk_lesson_materials_url_or_content',
	'"url" IS NOT NULL OR "content" IS NOT NULL',
)
export class LessonMaterial extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'lesson_id' })
	lessonId: string;

	/** Học liệu thuộc bài học → xoá bài là xoá học liệu (`CASCADE`, §4.2). */
	@ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'lesson_id' })
	lesson: Lesson;

	@Column({ type: 'varchar', name: 'material_type', length: 20 })
	materialType: MaterialType;

	@Column({ type: 'varchar', name: 'title', length: 255 })
	title: string;

	/** Bắt buộc khi `material_type = 'text'` (ràng buộc ở CHECK url/content). */
	@Column({ type: 'text', name: 'content', nullable: true })
	content: string | null;

	/** Bắt buộc với `slide`/`video`/`link`. */
	@Column({ type: 'varchar', name: 'url', length: 1024, nullable: true })
	url: string | null;

	/** Khoá trong object storage khi tệp được upload nội bộ (khác `url` công khai). */
	@Column({ type: 'varchar', name: 'storage_key', length: 512, nullable: true })
	storageKey: string | null;

	@Column({ type: 'varchar', name: 'mime_type', length: 100, nullable: true })
	mimeType: string | null;

	/**
	 * `bigint` cũng bị driver `pg` trả về **string** (như `numeric`), nên cần
	 * transformer để tầng service cộng/tổng dung lượng mà không bị nối chuỗi (§8.7).
	 */
	@Column({
		type: 'bigint',
		name: 'file_size_bytes',
		nullable: true,
		transformer: {
			to: (value: number | null) => value,
			from: (value: string | null) => (value === null ? null : Number(value)),
		},
	})
	fileSizeBytes: number | null;

	@Column({ type: 'integer', name: 'duration_seconds', nullable: true })
	durationSeconds: number | null;

	@Column({ type: 'integer', name: 'order_index', default: 0 })
	orderIndex: number;

	@Column({ type: 'boolean', name: 'is_published', default: true })
	isPublished: boolean;
}
