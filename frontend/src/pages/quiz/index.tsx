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
import { useAuth } from '@/contexts/auth-context';
import { SUBMISSION_MODE_LABEL } from '@/types';
import type {
	AssessmentQuiz,
	QuizAttempt,
	QuizSubmissionResult,
	SubmissionFile,
	SubmissionReview,
} from '@/types';
import AttemptHistory from './attempt-history';
import SubmissionFilePanel from './submission-file-panel';
import SubmissionResult from './submission-result';

const savedAttemptKey = (quizId: string) => `uniprep:quiz:${quizId}:attempt`;
const savedAnswersKey = (attemptId: string) =>
	`uniprep:quiz:${attemptId}:answers`;

const QuizPage = () => {
	const { quizId = '' } = useParams<{ quizId: string }>();
	const { user } = useAuth();
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
	/** Tệp đã tải lên của lượt đang làm — nguồn sự thật cho nút "Nộp bài" ở chế độ nộp tệp. */
	const [files, setFiles] = useState<SubmissionFile[]>([]);
	/** Bump sau mỗi lần nộp để lịch sử làm bài tự tải lại. */
	const [historyKey, setHistoryKey] = useState(0);
	/** Kết quả của một lượt **đã nộp** được mở từ lịch sử (khác `review` của lượt vừa nộp). */
	const [historyReview, setHistoryReview] = useState<SubmissionReview | null>(
		null,
	);

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
			setFiles([]);
			setHistoryReview(null);
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
					setFiles(resumed.data.files ?? []);
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
		// Chế độ nộp tệp: chặn ở client cho phản hồi nhanh, nhưng backend vẫn là nơi thực thi —
		// `POST /api/submissions` trả `400` nếu chưa có tệp nào.
		if (attempt.submissionMode !== 'quiz' && files.length === 0) {
			message.warning('Vui lòng đính kèm ít nhất một tệp trước khi nộp bài.');
			return;
		}
		setBusy(true);
		try {
			const response = await submitQuizAttempt({
				attemptId: attempt.id,
				// Không gửi `answers` rỗng: bài nộp tệp thuần không có câu hỏi nào, và backend từ chối
				// mảng đáp án chứa câu hỏi không thuộc bài.
				...(attempt.questions.length > 0
					? {
							answers: attempt.questions.map((question) => ({
								questionId: question.id,
								selectedOptionIds: selected[question.id] ?? [],
							})),
						}
					: {}),
			});
			if (!response.data) throw new Error('Không nhận được kết quả bài làm.');
			setResult(response.data);
			localStorage.removeItem(savedAttemptKey(quizId));
			localStorage.removeItem(savedAnswersKey(attempt.id));
			setHistoryKey((key) => key + 1);
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

	/** Mở lại kết quả của một lượt đã nộp từ lịch sử làm bài. */
	const handleViewHistoryResult = async (submissionId: string) => {
		setBusy(true);
		try {
			const response = await getSubmissionReview(submissionId);
			if (!response.data) throw new Error('Không có dữ liệu kết quả.');
			setHistoryReview(response.data);
		} catch (viewError) {
			message.error(
				getApiErrorMessage(viewError, 'Không xem được kết quả của lượt này.'),
			);
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
			setFiles(response.data.files ?? []);
			setHistoryReview(null);
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

	/**
	 * Trang này là **luồng làm bài của học viên** (`startQuizAttempt` còn yêu cầu role `student` ở
	 * server). Giảng viên/admin vẫn mở được URL `/quizzes/:quizId`, nhưng nếu để họ thấy nguyên giao
	 * diện làm bài thì:
	 * - nút "Bắt đầu làm bài" luôn thất bại `403`,
	 * - khối "Lịch sử làm bài" gọi `GET /api/submissions?quizId=…` và với giảng viên endpoint đó trả
	 *   bài nộp **của học viên khác** — hiển thị như thể là lịch sử của chính họ.
	 * Vì vậy người không phải học viên chỉ thấy lời chỉ dẫn sang khu chấm điểm.
	 *
	 * Điều kiện là "chắc chắn **không** phải student" (không phải "không phải student" theo nghĩa
	 * `!isStudent`): lúc phiên đang được nạp, `user` có thể là `null` và học viên thật không được
	 * rơi vào nhánh này.
	 */
	const isNonStudent = !!user && user.role !== 'student';

	const formatTime = (seconds: number) =>
		`${Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
	const activeQuestion = attempt?.questions[activeQuestionIndex];

	if (isNonStudent) {
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
				</header>
				<Alert
					type="info"
					showIcon
					message="Đây là trang làm bài của học viên."
					description="Tài khoản giảng viên không làm bài tại đây. Bài nộp của học viên được xem, tải tệp, cho điểm và phản hồi trong khu giảng viên."
				/>
				<ISolidBtn
					type="primary"
					background="primary"
					onClick={() =>
						void navigate(`/teacher/courses/${quiz.courseId}/quizzes`)
					}
				>
					Đi tới khu chấm điểm
				</ISolidBtn>
			</div>
		);
	}

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
					{SUBMISSION_MODE_LABEL[quiz.submissionMode]}
					{quiz.questionCount > 0 ? ` · ${quiz.questionCount} câu` : ''} ·{' '}
					{quiz.totalPoints} điểm ·{' '}
					{quiz.timeLimitMinutes
						? `Làm trong ${quiz.timeLimitMinutes} phút`
						: 'Không giới hạn thời gian'}
					{quiz.closeAt
						? ` · Hạn nộp: ${new Date(quiz.closeAt).toLocaleString('vi-VN')}`
						: ''}
				</p>
			</header>

			{result ? (
				<section className="space-y-space-md border-y border-outline-variant py-space-lg">
					{review ? (
						<SubmissionResult review={review} summary={result} />
					) : (
						<>
							<h2 className="font-headline-sm text-on-surface">
								Kết quả: {result.score ?? '—'} / {result.maxScore}
							</h2>
							<Alert
								type="info"
								showIcon
								message="Đã lưu kết quả"
								description="Đáp án chi tiết sẽ được mở theo cài đặt của giảng viên."
							/>
						</>
					)}
				</section>
			) : !attempt ? (
				<div className="border-y border-outline-variant py-space-lg">
					<Alert
						type="info"
						showIcon
						message="Sẵn sàng bắt đầu?"
						description={`Số lượt đã dùng: ${quiz.myAttemptCount ?? 0}${quiz.maxAttempts ? ` / ${quiz.maxAttempts}` : ''}. Đồng hồ bắt đầu khi bạn chọn bắt đầu.${
							quiz.submissionMode === 'quiz'
								? ''
								: ' Bài tập này yêu cầu nộp tệp trước khi nộp bài.'
						}`}
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
					{/* Khu vực nộp tệp: có ở chế độ `file`/`mixed`, và chỉ cho ghi khi lượt còn đang mở. */}
					{attempt.submissionMode !== 'quiz' && (
						<SubmissionFilePanel
							submissionId={attempt.id}
							files={files}
							maxFiles={attempt.maxFiles}
							readOnly={
								attempt.status !== 'in_progress' || timeExpired || !!result
							}
							onFilesChange={setFiles}
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
					{attempt.questions.length > 0 && (
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
					)}
					<div className="flex justify-end">
						<Button
							type="primary"
							size="large"
							loading={busy}
							disabled={
								timeExpired ||
								attempt.status !== 'in_progress' ||
								(attempt.submissionMode !== 'quiz' && files.length === 0)
							}
							onClick={() => void handleSubmit()}
						>
							Nộp bài
						</Button>
					</div>
				</div>
			)}

			{/* Lịch sử làm bài: học viên xem lại kết quả của các lượt đã nộp (yêu cầu 4.4). */}
			<section className="space-y-space-sm border-t border-outline-variant pt-space-lg">
				<h2 className="font-headline-sm text-on-surface">Lịch sử làm bài</h2>
				<AttemptHistory
					quizId={quizId}
					refreshKey={historyKey}
					onViewResult={(submissionId) =>
						void handleViewHistoryResult(submissionId)
					}
				/>
			</section>

			{historyReview && (
				<section className="space-y-space-md border-t border-outline-variant pt-space-lg">
					<h2 className="font-headline-sm text-on-surface">
						Kết quả lượt đã nộp
					</h2>
					<SubmissionResult review={historyReview} />
				</section>
			)}
		</div>
	);
};

export default QuizPage;
