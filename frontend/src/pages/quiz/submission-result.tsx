import { Alert, Tag } from 'antd';
import { SUBMISSION_MODE_LABEL } from '@/types';
import type { QuizSubmissionResult, SubmissionReview } from '@/types';
import SubmissionFilePanel from './submission-file-panel';

interface SubmissionResultProps {
	review: SubmissionReview;
	/** Có khi vừa nộp xong: bổ sung số câu đúng và thời gian làm bài. */
	summary?: QuizSubmissionResult | null;
}

/**
 * Kết quả một lượt làm bài (yêu cầu 4.4 — "học viên xem kết quả").
 *
 * Dùng cho **cả hai** đường vào: vừa nộp xong và xem lại từ lịch sử làm bài — nhờ vậy cách hiển thị
 * điểm tạm/điểm đã chốt chỉ được định nghĩa một lần, không lệch nhau giữa hai màn hình.
 */
const SubmissionResult = ({ review, summary }: SubmissionResultProps) => {
	const provisional = review.awaitingManualGrading;
	const scoreText =
		review.score === null
			? 'Chưa có điểm'
			: `${review.score}/${review.maxScore ?? '—'}`;

	return (
		<div className="space-y-space-md">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h2 className="font-headline-sm text-on-surface">
					{provisional ? 'Điểm tạm' : 'Điểm'}: {scoreText}
				</h2>
				<Tag>{SUBMISSION_MODE_LABEL[review.submissionMode]}</Tag>
				{review.isLate && <Tag color="orange">Nộp muộn</Tag>}
			</div>

			{summary && (
				<p className="font-body-md text-on-surface-variant">
					{summary.correctCount !== null &&
						`Đúng ${summary.correctCount}/${summary.totalQuestions} câu · `}
					{summary.durationSeconds} giây
					{summary.passed === null
						? ''
						: summary.passed
							? ' · Đạt'
							: ' · Chưa đạt'}
				</p>
			)}

			{provisional && (
				<Alert
					type="info"
					showIcon
					message="Bài đã được nộp và đang chờ giảng viên chấm."
					description="Điểm hiển thị (nếu có) chỉ là điểm tự động của phần trắc nghiệm; giảng viên sẽ chốt điểm cuối cùng và gửi phản hồi."
				/>
			)}

			{review.teacherFeedback && (
				<div className="rounded-lg border border-outline-variant p-space-sm">
					<p className="font-label-md text-primary">Phản hồi của giảng viên</p>
					<p className="font-body-md text-on-surface">
						{review.teacherFeedback}
					</p>
				</div>
			)}

			{review.files.length > 0 && (
				<SubmissionFilePanel
					submissionId={review.submissionId}
					files={review.files}
					maxFiles={review.files.length}
					readOnly
					onFilesChange={() => undefined}
				/>
			)}

			{review.items.length > 0 && (
				<div className="space-y-space-md">
					{review.items.map((item, index) => (
						<article
							key={item.questionId}
							className="space-y-space-sm border-t border-outline-variant pt-space-md"
						>
							<h3 className="font-title-md text-on-surface">
								{index + 1}. {item.content}
							</h3>
							<p className={item.isCorrect ? 'text-green-700' : 'text-red-700'}>
								{item.isCorrect ? 'Chính xác' : 'Chưa chính xác'} ·{' '}
								{item.earnedPoints}/{item.points} điểm
							</p>
							{item.options.map((option) => (
								<p
									key={option.id}
									className="font-body-sm text-on-surface-variant"
								>
									{item.correctOptionIds.includes(option.id) ? '✓ ' : ''}
									{item.selectedOptionIds.includes(option.id)
										? 'Đã chọn: '
										: ''}
									{option.content}
								</p>
							))}
							{item.explanation && (
								<p className="font-body-sm text-on-surface-variant">
									{item.explanation}
								</p>
							)}
						</article>
					))}
				</div>
			)}
		</div>
	);
};

export default SubmissionResult;
