import { useEffect, useState } from 'react';
import {
	Alert,
	Button,
	Checkbox,
	Input,
	InputNumber,
	Modal,
	Radio,
	Select,
	Skeleton,
	message,
} from 'antd';
import { Link, useParams } from 'react-router';
import {
	addQuestion,
	createQuiz,
	deleteQuestion,
	getQuizSubmissions,
	getQuizzes,
	getQuizQuestions,
	publishQuiz,
	updateQuestion,
	updateSubmissionFeedback,
} from '@/apis/assessment';
import { Badge, ErrorBadge, Icon, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type {
	AssessmentQuestion,
	AssessmentQuiz,
	AssessmentSubmission,
	QuestionType,
} from '@/types';

const DEFAULT_OPTIONS = ['', '', '', ''];

const TeacherQuizManagerPage = () => {
	const { courseId = '' } = useParams<{ courseId: string }>();
	const [quizzes, setQuizzes] = useState<AssessmentQuiz[]>([]);
	const [activeQuiz, setActiveQuiz] = useState<AssessmentQuiz | null>(null);
	const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
	const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
	const [title, setTitle] = useState('');
	const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(30);
	const [maxAttempts, setMaxAttempts] = useState(1);
	const [question, setQuestion] = useState('');
	const [questionType, setQuestionType] =
		useState<QuestionType>('single_choice');
	const [options, setOptions] = useState(DEFAULT_OPTIONS);
	const [correct, setCorrect] = useState<number[]>([0]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
		null,
	);
	const [editQuestionText, setEditQuestionText] = useState('');
	const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
		{},
	);
	const [scoreDrafts, setScoreDrafts] = useState<Record<string, number | null>>(
		{},
	);

	const loadQuizzes = async () => {
		const response = await getQuizzes({ courseId, page: 1, take: 100 });
		setQuizzes(response.data?.items ?? []);
	};
	useEffect(() => {
		let cancelled = false;
		void getQuizzes({ courseId, page: 1, take: 100 })
			.then((response) => {
				if (!cancelled) setQuizzes(response.data?.items ?? []);
			})
			.catch((loadError: unknown) => {
				if (!cancelled)
					setError(
						getApiErrorMessage(loadError, 'Không tải được bài kiểm tra.'),
					);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [courseId]);

	const selectQuiz = async (quiz: AssessmentQuiz) => {
		setActiveQuiz(quiz);
		try {
			const [questionResponse, submissionResponse] = await Promise.all([
				getQuizQuestions(quiz.id),
				getQuizSubmissions(quiz.id),
			]);
			setQuestions(questionResponse.data?.items ?? []);
			setSubmissions(submissionResponse.data?.items ?? []);
		} catch (loadError) {
			message.error(
				getApiErrorMessage(loadError, 'Không tải được ngân hàng câu hỏi.'),
			);
		}
	};

	const handleUpdateQuestion = async (questionId: string) => {
		setBusy(true);
		try {
			await updateQuestion(questionId, { content: editQuestionText.trim() });
			setQuestions((current) =>
				current.map((item) =>
					item.id === questionId
						? { ...item, content: editQuestionText.trim() }
						: item,
				),
			);
			setEditingQuestionId(null);
			message.success('Đã cập nhật câu hỏi.');
		} catch (saveError) {
			message.error(
				getApiErrorMessage(saveError, 'Không cập nhật được câu hỏi.'),
			);
		} finally {
			setBusy(false);
		}
	};

	const handleDeleteQuestion = (item: AssessmentQuestion) => {
		Modal.confirm({
			title: 'Xoá câu hỏi?',
			content: 'Câu hỏi sẽ bị xoá khỏi bản nháp bài kiểm tra.',
			okText: 'Xoá câu hỏi',
			cancelText: 'Huỷ',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await deleteQuestion(item.id);
					setQuestions((current) =>
						current.filter((questionItem) => questionItem.id !== item.id),
					);
					message.success('Đã xoá câu hỏi.');
				} catch (deleteError) {
					message.error(
						getApiErrorMessage(deleteError, 'Không xoá được câu hỏi.'),
					);
				}
			},
		});
	};

	const handleFeedback = async (submission: AssessmentSubmission) => {
		setBusy(true);
		try {
			await updateSubmissionFeedback(submission.id, {
				teacherFeedback: feedbackDrafts[submission.id] ?? '',
				...(scoreDrafts[submission.id] == null
					? {}
					: { score: scoreDrafts[submission.id]! }),
			});
			const response = await getQuizSubmissions(submission.quiz.id);
			setSubmissions(response.data?.items ?? []);
			message.success('Đã lưu điểm và phản hồi.');
		} catch (feedbackError) {
			message.error(
				getApiErrorMessage(feedbackError, 'Không lưu được phản hồi.'),
			);
		} finally {
			setBusy(false);
		}
	};

	const handleCreate = async () => {
		if (!title.trim()) return;
		setBusy(true);
		try {
			const response = await createQuiz({
				courseId,
				title: title.trim(),
				timeLimitMinutes,
				maxAttempts,
			});
			if (!response.data) throw new Error('Không tạo được bài kiểm tra.');
			setTitle('');
			setActiveQuiz(response.data);
			setQuestions([]);
			await loadQuizzes();
			message.success('Đã tạo bản nháp bài kiểm tra.');
		} catch (createError) {
			message.error(
				getApiErrorMessage(createError, 'Không tạo được bài kiểm tra.'),
			);
		} finally {
			setBusy(false);
		}
	};

	const handleAddQuestion = async () => {
		if (
			!activeQuiz ||
			!question.trim() ||
			options.filter((value) => value.trim()).length < 2
		)
			return;
		setBusy(true);
		try {
			const response = await addQuestion(activeQuiz.id, {
				content: question.trim(),
				type: questionType,
				points: 1,
				options: options
					.map((content, index) => ({
						content: content.trim(),
						isCorrect: correct.includes(index),
					}))
					.filter((option) => option.content),
			});
			if (response.data)
				setQuestions((current) => [...current, response.data!]);
			setQuestion('');
			setOptions(DEFAULT_OPTIONS);
			setCorrect([0]);
		} catch (saveError) {
			message.error(getApiErrorMessage(saveError, 'Không lưu được câu hỏi.'));
		} finally {
			setBusy(false);
		}
	};

	const handlePublish = async () => {
		if (!activeQuiz) return;
		setBusy(true);
		try {
			await publishQuiz(activeQuiz.id);
			await loadQuizzes();
			setActiveQuiz({ ...activeQuiz, status: 'published' });
			message.success('Đã công bố bài kiểm tra.');
		} catch (publishError) {
			message.error(
				getApiErrorMessage(publishError, 'Không thể công bố bài kiểm tra.'),
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-space-lg p-gutter">
			<Link
				to={`/teacher/courses/${courseId}`}
				className="font-label-md text-secondary hover:underline"
			>
				← Về trang soạn khoá học
			</Link>
			<header>
				<p className="font-label-md text-primary">KHU GIẢNG VIÊN</p>
				<h1 className="mt-1 font-headline-md text-on-surface">
					Ngân hàng câu hỏi & bài kiểm tra
				</h1>
			</header>
			{error && (
				<ErrorBadge icon={<Icon name="error" size={14} />}>{error}</ErrorBadge>
			)}
			<div className="grid gap-space-xl lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.5fr)]">
				<aside className="space-y-space-lg">
					<section className="space-y-space-md border-y border-outline-variant py-space-md">
						<h2 className="font-title-lg text-on-surface">Tạo bài kiểm tra</h2>
						<Input
							aria-label="Tên bài kiểm tra"
							placeholder="Tên bài kiểm tra"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							maxLength={200}
						/>
						<div className="grid grid-cols-2 gap-space-sm">
							<label className="space-y-1 font-label-sm text-on-surface-variant">
								Thời lượng
								<InputNumber
									className="w-full"
									min={1}
									max={300}
									addonAfter="phút"
									value={timeLimitMinutes}
									onChange={setTimeLimitMinutes}
								/>
							</label>
							<label className="space-y-1 font-label-sm text-on-surface-variant">
								Số lượt tối đa
								<InputNumber
									className="w-full"
									min={1}
									max={10}
									value={maxAttempts}
									onChange={(value) => setMaxAttempts(value ?? 1)}
								/>
							</label>
						</div>
						<ISolidBtn
							type="primary"
							background="primary"
							block
							loading={busy}
							onClick={() => void handleCreate()}
						>
							Tạo bản nháp
						</ISolidBtn>
					</section>
					<section className="space-y-space-sm">
						<h2 className="font-title-lg text-on-surface">
							Bài kiểm tra đã tạo
						</h2>
						{loading ? (
							<Skeleton active />
						) : (
							quizzes.map((quiz) => (
								<button
									key={quiz.id}
									className={`w-full border-b border-outline-variant py-space-sm text-left ${activeQuiz?.id === quiz.id ? 'text-primary' : 'text-on-surface'}`}
									onClick={() => void selectQuiz(quiz)}
								>
									<span className="block font-title-md">{quiz.title}</span>
									<span className="mt-1 flex items-center gap-2">
										<Badge
											status={
												quiz.status === 'published' ? 'success' : 'neutral'
											}
										>
											{quiz.status === 'published' ? 'Đã công bố' : 'Bản nháp'}
										</Badge>
										<span className="font-body-sm text-on-surface-variant">
											{quiz.questionCount} câu
										</span>
									</span>
								</button>
							))
						)}
					</section>
				</aside>
				<main className="min-w-0 space-y-space-lg">
					{activeQuiz ? (
						<>
							<div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant pb-space-md">
								<div>
									<h2 className="font-title-lg text-on-surface">
										{activeQuiz.title}
									</h2>
									<p className="font-body-sm text-on-surface-variant">
										{questions.length} câu đã lưu
									</p>
								</div>
								{activeQuiz.status !== 'published' && (
									<ISolidBtn
										type="primary"
										background="primary"
										loading={busy}
										disabled={questions.length === 0}
										onClick={() => void handlePublish()}
									>
										Công bố
									</ISolidBtn>
								)}
							</div>
							{questions.map((item, index) => (
								<article
									key={item.id}
									className="border-b border-outline-variant py-space-sm"
								>
									{editingQuestionId === item.id ? (
										<div className="space-y-space-sm">
											<Input.TextArea
												value={editQuestionText}
												onChange={(event) =>
													setEditQuestionText(event.target.value)
												}
												rows={3}
											/>
											<div className="flex gap-space-sm">
												<Button
													type="primary"
													loading={busy}
													onClick={() => void handleUpdateQuestion(item.id)}
												>
													Lưu
												</Button>
												<Button onClick={() => setEditingQuestionId(null)}>
													Huỷ
												</Button>
											</div>
										</div>
									) : (
										<div className="flex flex-wrap items-start justify-between gap-space-sm">
											<div>
												<p className="font-title-md text-on-surface">
													{index + 1}. {item.content}
												</p>
												<p className="font-body-sm text-on-surface-variant">
													{item.options.length} phương án · {item.points} điểm
												</p>
											</div>
											{activeQuiz.status !== 'published' && (
												<div className="flex gap-space-xs">
													<Button
														onClick={() => {
															setEditingQuestionId(item.id);
															setEditQuestionText(item.content);
														}}
													>
														Sửa
													</Button>
													<Button
														danger
														onClick={() => handleDeleteQuestion(item)}
													>
														Xoá
													</Button>
												</div>
											)}
										</div>
									)}
								</article>
							))}
							{activeQuiz.status !== 'published' ? (
								<section className="space-y-space-md border-y border-outline-variant py-space-md">
									<h3 className="font-title-lg text-on-surface">
										Thêm câu hỏi
									</h3>
									<Input.TextArea
										aria-label="Nội dung câu hỏi"
										rows={3}
										placeholder="Nhập nội dung câu hỏi"
										value={question}
										onChange={(event) => setQuestion(event.target.value)}
									/>
									<Select
										className="w-full"
										value={questionType}
										onChange={(value: QuestionType) => {
											setQuestionType(value);
											setCorrect([]);
										}}
										options={[
											{ value: 'single_choice', label: 'Một đáp án đúng' },
											{ value: 'multiple_choice', label: 'Nhiều đáp án đúng' },
											{ value: 'true_false', label: 'Đúng / Sai' },
										]}
									/>
									{options.map((value, index) => (
										<div key={index} className="flex items-center gap-space-sm">
											<Input
												aria-label={`Phương án ${index + 1}`}
												placeholder={`Phương án ${index + 1}`}
												value={value}
												onChange={(event) =>
													setOptions((current) =>
														current.map((item, itemIndex) =>
															itemIndex === index ? event.target.value : item,
														),
													)
												}
											/>
											{questionType === 'multiple_choice' ? (
												<Checkbox
													checked={correct.includes(index)}
													onChange={(event) =>
														setCorrect((current) =>
															event.target.checked
																? [...current, index]
																: current.filter((item) => item !== index),
														)
													}
												>
													Đúng
												</Checkbox>
											) : (
												<Radio
													checked={correct.includes(index)}
													onChange={() => setCorrect([index])}
												>
													Đúng
												</Radio>
											)}
										</div>
									))}
									{questionType === 'multiple_choice' &&
										correct.length === 0 && (
											<Alert
												type="warning"
												showIcon
												message="Chọn ít nhất một đáp án đúng."
											/>
										)}
									<ISolidBtn
										type="primary"
										background="primary"
										loading={busy}
										onClick={() => void handleAddQuestion()}
									>
										Lưu câu hỏi
									</ISolidBtn>
								</section>
							) : (
								<Alert
									type="info"
									showIcon
									message="Bài kiểm tra đã công bố."
									description="Để bảo toàn lượt làm và điểm đã ghi nhận, cấu trúc câu hỏi hiện đã khoá."
								/>
							)}
							{activeQuiz.status === 'published' && (
								<section className="space-y-space-md border-t border-outline-variant pt-space-lg">
									<h3 className="font-title-lg text-on-surface">
										Bài nộp & phản hồi
									</h3>
									{submissions.length === 0 ? (
										<p className="font-body-sm text-on-surface-variant">
											Chưa có học viên nộp bài.
										</p>
									) : (
										submissions.map((submission) => (
											<article
												key={submission.id}
												className="space-y-space-sm border-b border-outline-variant py-space-md"
											>
												<div className="flex flex-wrap items-center justify-between gap-space-sm">
													<div>
														<p className="font-title-md text-on-surface">
															{submission.student.fullName}
														</p>
														<p className="font-body-sm text-on-surface-variant">
															Lượt {submission.attemptNo} ·{' '}
															{submission.submittedAt
																? new Date(
																		submission.submittedAt,
																	).toLocaleString('vi-VN')
																: 'Đang làm'}
														</p>
													</div>
													<Badge
														status={
															submission.status === 'graded'
																? 'success'
																: 'warning'
														}
													>
														{submission.score ?? 'Chưa chấm'} /{' '}
														{submission.maxScore ?? '—'}
													</Badge>
												</div>
												<InputNumber
													className="w-full"
													min={0}
													max={submission.maxScore ?? undefined}
													placeholder="Điểm (tuỳ chọn)"
													value={scoreDrafts[submission.id] ?? submission.score}
													onChange={(value) =>
														setScoreDrafts((current) => ({
															...current,
															[submission.id]: value,
														}))
													}
												/>
												<Input.TextArea
													rows={2}
													placeholder="Phản hồi cho học viên"
													value={feedbackDrafts[submission.id] ?? ''}
													onChange={(event) =>
														setFeedbackDrafts((current) => ({
															...current,
															[submission.id]: event.target.value,
														}))
													}
												/>
												<div className="flex justify-end">
													<Button
														type="primary"
														loading={busy}
														onClick={() => void handleFeedback(submission)}
													>
														Lưu phản hồi
													</Button>
												</div>
											</article>
										))
									)}
								</section>
							)}
						</>
					) : (
						<div className="border-y border-outline-variant py-space-xl">
							<Alert
								type="info"
								showIcon
								message="Chọn một bài kiểm tra"
								description="Hoặc tạo bản nháp mới để bắt đầu xây dựng ngân hàng câu hỏi."
							/>
						</div>
					)}
				</main>
			</div>
		</div>
	);
};

export default TeacherQuizManagerPage;
