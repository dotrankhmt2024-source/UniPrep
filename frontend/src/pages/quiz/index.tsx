import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Radio, Skeleton, message } from 'antd';
import { useNavigate, useParams } from 'react-router';
import {
	getQuiz,
	getQuizAttempt,
	getSubmissionReview,
	startQuizAttempt,
	submitQuizAttempt,
} from '@/apis/assessment';
import { ErrorBadge, Icon, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type {
	AssessmentQuiz,
	QuizAttempt,
	QuizSubmissionResult,
	SubmissionReview,
} from '@/types';

const savedAttemptKey = (quizId: string) => `uniprep:quiz:${quizId}:attempt`;
const savedAnswersKey = (attemptId: string) =>
	`uniprep:quiz:${attemptId}:answers`;

const QuizPage = () => {
	const { quizId = '' } = useParams<{ quizId: string }>();
	const navigate = useNavigate();
	const [quiz, setQuiz] = useState<AssessmentQuiz | null>(null);
	const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
	const [selected, setSelected] = useState<Record<string, string[]>>({});
	const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
	const [result, setResult] = useState<QuizSubmissionResult | null>(null);
	const [review, setReview] = useState<SubmissionReview | null>(null);
	const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
	const [timeExpired, setTimeExpired] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			setError('');
			setQuiz(null);
			setAttempt(null);
			setSelected({});
			setActiveQuestionIndex(0);
			setResult(null);
			setReview(null);
			setRemainingSeconds(null);
			setTimeExpired(false);
			try {
				const response = await getQuiz(quizId);
				if (cancelled || !response.data) return;
				setQuiz(response.data);
				const attemptId = localStorage.getItem(savedAttemptKey(quizId));
				if (!attemptId) return;
				const resumed = await getQuizAttempt(attemptId);
				if (cancelled) return;
				if (resumed.data?.status === 'in_progress') {
					setAttempt(resumed.data);
					const saved = localStorage.getItem(savedAnswersKey(attemptId));
					if (saved) setSelected(JSON.parse(saved) as Record<string, string[]>);
				} else {
					localStorage.removeItem(savedAttemptKey(quizId));
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						getApiErrorMessage(loadError, 'Không tải được bài kiểm tra.'),
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [quizId]);

	useEffect(() => {
		if (!attempt?.expiresAt || result || attempt.status !== 'in_progress')
			return;
		let expiryHandled = false;
		const tick = () => {
			const seconds = Math.max(
				0,
				Math.ceil((new Date(attempt.expiresAt!).getTime() - Date.now()) / 1000),
			);
			setRemainingSeconds(seconds);
			if (seconds === 0 && !expiryHandled) {
				expiryHandled = true;
				setTimeExpired(true);
				void getQuizAttempt(attempt.id).then((response) => {
					if (response.data) {
						setAttempt(response.data);
						localStorage.removeItem(savedAttemptKey(quizId));
					}
				});
			}
		};
		tick();
		const interval = window.setInterval(tick, 1000);
		return () => window.clearInterval(interval);
	}, [attempt, quizId, result]);

	useEffect(() => {
		if (attempt) {
			localStorage.setItem(
				savedAnswersKey(attempt.id),
				JSON.stringify(selected),
			);
		}
	}, [attempt, selected]);

	useEffect(() => {
		if (!attempt || attempt.status !== 'in_progress' || timeExpired || result)
			return;
		const warnBeforeLeave = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', warnBeforeLeave);
		return () => window.removeEventListener('beforeunload', warnBeforeLeave);
	}, [attempt, result, timeExpired]);

	const handleSubmit = async () => {
		if (!attempt || busy || timeExpired || attempt.status !== 'in_progress')
			return;
		setBusy(true);
		try {
			const response = await submitQuizAttempt({
				attemptId: attempt.id,
				answers: attempt.questions.map((question) => ({
					questionId: question.id,
					selectedOptionIds: selected[question.id] ?? [],
				})),
			});
			if (!response.data) throw new Error('Không nhận được kết quả bài làm.');
			setResult(response.data);
			localStorage.removeItem(savedAttemptKey(quizId));
			localStorage.removeItem(savedAnswersKey(attempt.id));
			try {
				const reviewResponse = await getSubmissionReview(response.data.id);
				setReview(reviewResponse.data);
			} catch {
				setReview(null);
			}
		} catch (submitError) {
			message.error(getApiErrorMessage(submitError, 'Không nộp được bài.'));
		} finally {
			setBusy(false);
		}
	};

	const beginAttempt = async () => {
		setBusy(true);
		try {
			const response = await startQuizAttempt(quizId);
			if (!response.data) throw new Error('Không tạo được lượt làm bài.');
			setAttempt(response.data);
			setSelected({});
			setActiveQuestionIndex(0);
			setTimeExpired(false);
			localStorage.setItem(savedAttemptKey(quizId), response.data.id);
		} catch (startError) {
			message.error(
				getApiErrorMessage(startError, 'Không thể bắt đầu bài kiểm tra.'),
			);
		} finally {
			setBusy(false);
		}
	};

	if (loading) {
		return (
			<div className="p-gutter">
				<Skeleton active />
			</div>
		);
	}
	if (error || !quiz) {
		return (
			<div className="p-gutter">
				<ErrorBadge icon={<Icon name="error" size={14} />}>
					{error || 'Không tìm thấy bài kiểm tra.'}
				</ErrorBadge>
			</div>
		);
	}

	const formatTime = (seconds: number) =>
		`${Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
	const activeQuestion = attempt?.questions[activeQuestionIndex];

	return (
		<div className="mx-auto max-w-4xl space-y-space-lg p-gutter">
			<button
				className="font-label-md text-secondary hover:underline"
				onClick={() => void navigate(`/courses/${quiz.courseId}/quizzes`)}
			>
				← Danh sách bài kiểm tra
			</button>
			<header className="space-y-space-xs border-b border-outline-variant pb-space-md">
				<p className="font-label-md text-primary">KIỂM TRA & ĐÁNH GIÁ</p>
				<h1 className="font-headline-md text-on-surface">{quiz.title}</h1>
				{quiz.description && (
					<p className="font-body-md text-on-surface-variant">
						{quiz.description}
					</p>
				)}
				<p className="font-body-sm text-on-surface-variant">
					{quiz.questionCount} câu · {quiz.totalPoints} điểm ·{' '}
					{quiz.timeLimitMinutes
						? `${quiz.timeLimitMinutes} phút`
						: 'Không giới hạn thời gian'}
				</p>
			</header>

			{result ? (
				<section className="space-y-space-md border-y border-outline-variant py-space-lg">
					<h2 className="font-headline-sm text-on-surface">
						Kết quả: {result.score} / {result.maxScore}
					</h2>
					<p className="font-body-md text-on-surface-variant">
						Đúng {result.correctCount}/{result.totalQuestions} câu ·{' '}
						{result.durationSeconds} giây
						{result.passed === null
							? ''
							: result.passed
								? ' · Đạt'
								: ' · Chưa đạt'}
					</p>
					{review ? (
						<div className="space-y-space-md">
							{review.items.map((item, index) => (
								<article
									key={item.questionId}
									className="space-y-space-sm border-t border-outline-variant pt-space-md"
								>
									<h3 className="font-title-md text-on-surface">
										{index + 1}. {item.content}
									</h3>
									<p
										className={
											item.isCorrect ? 'text-green-700' : 'text-red-700'
										}
									>
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
					) : (
						<Alert
							type="info"
							showIcon
							message="Đã lưu kết quả"
							description="Đáp án chi tiết sẽ được mở theo cài đặt của giảng viên."
						/>
					)}
				</section>
			) : !attempt ? (
				<div className="border-y border-outline-variant py-space-lg">
					<Alert
						type="info"
						showIcon
						message="Sẵn sàng bắt đầu?"
						description={`Số lượt đã dùng: ${quiz.myAttemptCount ?? 0}${quiz.maxAttempts ? ` / ${quiz.maxAttempts}` : ''}. Đồng hồ bắt đầu khi bạn chọn bắt đầu.`}
					/>
					<div className="mt-space-md">
						<ISolidBtn
							type="primary"
							background="primary"
							loading={busy}
							onClick={() => void beginAttempt()}
						>
							Bắt đầu làm bài
						</ISolidBtn>
					</div>
				</div>
			) : (
				<div className="space-y-space-lg">
					<div className="sticky top-0 z-10 flex items-center justify-between border-y border-outline-variant bg-surface-container-lowest py-space-sm">
						<span className="font-label-md text-on-surface">
							Lượt {attempt.attemptNo}
						</span>
						{remainingSeconds !== null && (
							<span className="font-title-lg tabular-nums text-primary">
								{formatTime(remainingSeconds)}
							</span>
						)}
					</div>
					{timeExpired && (
						<Alert
							type="error"
							showIcon
							message="Thời gian làm bài đã hết. Lượt làm đã được khoá."
						/>
					)}
					{activeQuestion && (
						<section
							key={activeQuestion.id}
							className="space-y-space-md border-b border-outline-variant pb-space-lg"
						>
							<h2 className="font-title-lg text-on-surface">
								{activeQuestionIndex + 1}. {activeQuestion.content}{' '}
								<span className="font-body-sm text-on-surface-variant">
									({activeQuestion.points} điểm)
								</span>
							</h2>
							{activeQuestion.type === 'multiple_choice' ? (
								<Checkbox.Group
									className="flex flex-col gap-space-sm"
									value={selected[activeQuestion.id] ?? []}
									options={activeQuestion.options.map((option) => ({
										label: option.content,
										value: option.id,
									}))}
									onChange={(ids) =>
										setSelected((current) => ({
											...current,
											[activeQuestion.id]: ids as string[],
										}))
									}
								/>
							) : (
								<Radio.Group
									className="flex flex-col gap-space-sm"
									value={selected[activeQuestion.id]?.[0]}
									onChange={(event) =>
										setSelected((current) => ({
											...current,
											[activeQuestion.id]: [event.target.value],
										}))
									}
								>
									{activeQuestion.options.map((option) => (
										<Radio key={option.id} value={option.id}>
											{option.content}
										</Radio>
									))}
								</Radio.Group>
							)}
						</section>
					)}
					<div className="flex items-center justify-between gap-space-sm">
						<Button
							disabled={activeQuestionIndex === 0}
							onClick={() => setActiveQuestionIndex((index) => index - 1)}
						>
							Câu trước
						</Button>
						<span className="font-body-sm text-on-surface-variant">
							Câu {activeQuestionIndex + 1} / {attempt.questions.length}
						</span>
						<Button
							disabled={activeQuestionIndex >= attempt.questions.length - 1}
							onClick={() => setActiveQuestionIndex((index) => index + 1)}
						>
							Câu tiếp theo
						</Button>
					</div>
					<div className="flex justify-end">
						<Button
							type="primary"
							size="large"
							loading={busy}
							disabled={timeExpired || attempt.status !== 'in_progress'}
							onClick={() => void handleSubmit()}
						>
							Nộp bài
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuizPage;
