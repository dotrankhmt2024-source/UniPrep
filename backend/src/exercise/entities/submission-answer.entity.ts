import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { QuizQuestion } from './quiz-question.entity';
import { Submission } from './submission.entity';

/**
 * `pg` trả cột `numeric` về dạng string → ép về number để tính điểm từng câu
 * đúng (database-design §8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Câu trả lời của từng câu hỏi trong một lần làm bài — cần để chấm lại, thống kê
 * độ khó câu hỏi và phát hiện `duration_seconds` bất thường ở mức câu hỏi.
 * Xem `docs/02-specs/database-design.md` §3.3.7.
 */
@Entity('submission_answers')
@Index('uq_submission_answers_question', ['submissionId', 'questionId'], {
	unique: true,
})
export class SubmissionAnswer extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'submission_id' })
	submissionId: string;

	// CASCADE: câu trả lời thuộc bài nộp; xoá bài nộp là xoá câu trả lời (§4.2).
	@ManyToOne(() => Submission, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'submission_id' })
	submission: Submission;

	@Column({ type: 'uuid', name: 'question_id' })
	questionId: string;

	@ManyToOne(() => QuizQuestion, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'question_id' })
	question: QuizQuestion;

	// Một dòng cho mỗi câu hỏi (`uq_submission_answers_question`), các lựa chọn
	// nhiều đáp án nằm trong mảng này: 1 phần tử cho `single_choice`/`true_false`,
	// n phần tử cho `multiple_choice`.
	//
	// KHÔNG có FK cho phần tử mảng — Postgres không hỗ trợ; toàn vẹn do tầng
	// service/DTO kiểm tra trước khi ghi (§4.5).
	@Column({
		type: 'uuid',
		name: 'selected_option_ids',
		array: true,
		nullable: true,
	})
	selectedOptionIds: string[] | null;

	// Dùng cho `short_answer`/`essay`.
	@Column({ type: 'text', name: 'answer_text', nullable: true })
	answerText: string | null;

	// NULL = chưa chấm (bài tự luận chờ giảng viên) — không được coi NULL là sai.
	@Column({ type: 'boolean', name: 'is_correct', nullable: true })
	isCorrect: boolean | null;

	@Column({
		type: 'numeric',
		name: 'points_awarded',
		precision: 5,
		scale: 2,
		nullable: true,
		transformer: numericTransformer,
	})
	pointsAwarded: number | null;

	@Column({ type: 'integer', name: 'time_spent_seconds', nullable: true })
	timeSpentSeconds: number | null;

	@Column({ type: 'text', name: 'feedback', nullable: true })
	feedback: string | null;
}
