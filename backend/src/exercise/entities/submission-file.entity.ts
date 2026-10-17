import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { User } from '../../user/entities/user.entity';
import { Submission } from './submission.entity';

/**
 * Một tệp học viên đính kèm cho một lượt làm bài — cơ sở của "bài tập nộp tệp"
 * (`docs/02-specs/database-design.md` §3.3.11).
 *
 * **Vì sao là bảng riêng thay vì cột `file_url` trên `submissions`:** một bài nộp thực tế
 * thường gồm nhiều tệp (báo cáo + slide + mã nguồn); cột đơn sẽ phải đổi schema ngay lần thứ hai.
 *
 * **Vì sao `uploaded_by` tách khỏi `submissions.user_id`:** học viên là người nộp, nhưng giữ
 * cột này cho phép giảng viên đính kèm tệp nhận xét sau này mà vẫn truy vết được ai ghi tệp nào.
 */
@Entity('submission_files')
@Index('uq_submission_files_storage_key', ['storageKey'], { unique: true })
@Index('idx_submission_files_submission', ['submissionId'])
@Check('chk_submission_files_file_size_bytes', '"file_size_bytes" >= 0')
export class SubmissionFile extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'submission_id' })
	submissionId: string;

	// CASCADE: tệp là dữ liệu con của bài nộp, cùng quy tắc với `submission_answers` (§4.2).
	@ManyToOne(() => Submission, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'submission_id' })
	submission: Submission;

	@Column({ type: 'uuid', name: 'uploaded_by', nullable: true })
	uploadedBy: string | null;

	// SET NULL: dữ liệu tham chiếu — giữ tệp kể cả khi người tải lên bị xoá (§4.2).
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'uploaded_by' })
	uploader: User | null;

	/** Tên gốc để hiển thị khi tải xuống. **Không** bao giờ dùng làm đường dẫn trên đĩa. */
	@Column({ type: 'varchar', name: 'original_name', length: 255 })
	originalName: string;

	/** Khoá lưu trữ do server sinh (`submissions/<submissionId>/<uuid><ext>`), không lộ ra API. */
	@Column({ type: 'varchar', name: 'storage_key', length: 512 })
	storageKey: string;

	@Column({ type: 'varchar', name: 'mime_type', length: 100 })
	mimeType: string;

	/**
	 * `bigint` bị driver `pg` trả về **string** (như `numeric`), nên cần transformer để tầng
	 * service cộng tổng dung lượng mà không bị nối chuỗi (§8.7).
	 */
	@Column({
		type: 'bigint',
		name: 'file_size_bytes',
		transformer: {
			to: (value: number) => value,
			from: (value: string | null) => (value === null ? null : Number(value)),
		},
	})
	fileSizeBytes: number;
}
