import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { QuestionType } from '../../common/types';
import { Quiz } from './quiz.entity';

/**
 * `pg` trả cột `numeric` về dạng string → ép về number để cộng điểm đúng
 * (database-design §8.7).
 */
const numericTransformer = {
	to: (value: number | null) => value,
	from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Câu hỏi thuộc một bài kiểm tra, giữ thứ tự và số điểm.
 * Xem `docs/02-specs/database-design.md` §3.3.4.
 */
@Entity('quiz_questions')
@Index('uq_quiz_questions_quiz_order', ['quizId', 'orderIndex'], {
	unique: true,
})
@Check(
	'chk_quiz_questions_question_type',
	`"question_type" IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')`,
)
@Check('chk_quiz_questions_points', '"points" >= 0')
export class QuizQuestion extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'quiz_id' })
	quizId: string;

	// CASCADE: câu hỏi thuộc quiz; xoá quiz là xoá đề của nó (§4.2).
	@ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'quiz_id' })
	quiz: Quiz;

	@Column({ type: 'varchar', name: 'question_type', length: 25 })
	questionType: QuestionType;

	// Nội dung câu hỏi ở dạng markdown.
	@Column({ type: 'text', name: 'content' })
	content: string;

	// Lời giải, chỉ trả cho học viên khi `quizzes.show_answers_after` cho phép (§6).
	@Column({ type: 'text', name: 'explanation', nullable: true })
	explanation: string | null;

	@Column({
		type: 'numeric',
		name: 'points',
		precision: 5,
		scale: 2,
		default: 1,
		transformer: numericTransformer,
	})
	points: number;

	// Cùng với `quiz_id` tạo UNIQUE `uq_quiz_questions_quiz_order` để thứ tự câu
	// hỏi luôn ổn định (§4.1).
	@Column({ type: 'integer', name: 'order_index' })
	orderIndex: number;
}
