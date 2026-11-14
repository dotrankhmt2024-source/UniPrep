import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Card,
	Empty,
	Input,
	Popconfirm,
	Select,
	Space,
	Spin,
	Tabs,
	Tag,
	Typography,
	message as toast,
} from 'antd';
import { Link, useSearchParams } from 'react-router';
import { getCourses } from '@/apis/course';
import { getLessonById } from '@/apis/lesson';
import {
	deleteTutorSession,
	getTutorSession,
	getTutorStatus,
	listTutorSessions,
	sendTutorMessage,
} from '@/apis/tutor';
import { Icon, IOutLinedBtn, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type {
	CourseListItem,
	LessonDetail,
	TutorAnswer,
	TutorSession,
	TutorStep,
} from '@/types';
import { AnswerView } from './components/AnswerView';
import { Trajectory } from './components/Trajectory';
import '@/styles/tutor.css';

const { Text, Paragraph } = Typography;

const STARTERS = [
	'Khoá học này gồm những nội dung gì, nên học theo thứ tự nào?',
	'Giải thích các khái niệm quan trọng nhất của khoá học',
];
const LESSON_STARTER = 'Tóm tắt giúp mình bài đang xem';

/**
 * Trợ giảng AI có căn cứ — route `/tutor?course=&lesson=&session=`, mọi vai trò đã đăng nhập.
 *
 * Giao diện port từ trang "Tư vấn với AI" của DACN2: tab Trò chuyện (câu trả lời kèm trích dẫn tới
 * đoạn học liệu) và tab Trajectory (từng bước agent: suy luận, tool call, kết quả, token).
 *
 * Trạng thái nằm trên URL để link "Hỏi trợ giảng AI" từ trang bài học mở đúng khoá + bài, và để tải
 * lại trang vẫn giữ cuộc trò chuyện đang xem.
 */
const TutorPage = () => {
	const [params, setParams] = useSearchParams();
	const courseId = params.get('course');
	const lessonId = params.get('lesson');
	const sessionId = params.get('session');

	const [configured, setConfigured] = useState<boolean | null>(null);
	const [courses, setCourses] = useState<CourseListItem[]>([]);
	const [coursesLoading, setCoursesLoading] = useState(true);
	const [sessions, setSessions] = useState<TutorSession[]>([]);
	const [sessionsLoading, setSessionsLoading] = useState(false);
	const [session, setSession] = useState<TutorSession | null>(null);
	const [steps, setSteps] = useState<TutorStep[]>([]);
	const [sessionLoading, setSessionLoading] = useState(false);
	const [lesson, setLesson] = useState<LessonDetail | null>(null);
	const [draft, setDraft] = useState('');
	const [pending, setPending] = useState<string | null>(null);
	const [removing, setRemoving] = useState(false);
	const [tab, setTab] = useState('chat');
	const bottomRef = useRef<HTMLDivElement>(null);

	const updateParams = useCallback(
		(patch: Record<string, string | null>) => {
			setParams((current) => {
				const next = new URLSearchParams(current);
				Object.entries(patch).forEach(([key, value]) =>
					value ? next.set(key, value) : next.delete(key),
				);
				return next;
			});
		},
		[setParams],
	);

	useEffect(() => {
		void getTutorStatus()
			.then((res) => setConfigured(Boolean(res.data?.configured)))
			.catch(() => setConfigured(null));
		void getCourses({ take: 100, status: 'published' })
			.then((res) => setCourses(res.data?.items ?? []))
			.catch((error) => toast.error(getApiErrorMessage(error)))
			.finally(() => setCoursesLoading(false));
	}, []);

	// Chưa chọn khoá học: chọn sẵn khoá đầu tiên để trang không trống.
	useEffect(() => {
		if (!courseId && !sessionId && courses.length)
			updateParams({ course: courses[0].id });
	}, [courseId, sessionId, courses, updateParams]);

	const loadSessions = useCallback(async () => {
		if (!courseId) return setSessions([]);
		setSessionsLoading(true);
		try {
			const res = await listTutorSessions(courseId);
			setSessions(res.data ?? []);
		} catch (error) {
			toast.error(getApiErrorMessage(error));
		} finally {
			setSessionsLoading(false);
		}
	}, [courseId]);

	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	useEffect(() => {
		if (!sessionId) {
			setSession(null);
			setSteps([]);
			return;
		}
		// Vừa gửi tin nhắn đầu tiên: state đã có sẵn từ kết quả, không cần tải lại.
		if (session?.id === sessionId) return;
		let cancelled = false;
		setSessionLoading(true);
		getTutorSession(sessionId)
			.then((res) => {
				if (cancelled || !res.data) return;
				const { steps: loaded, ...rest } = res.data;
				setSession(rest);
				setSteps(loaded);
				if (rest.courseId !== courseId) updateParams({ course: rest.courseId });
			})
			.catch((error) => {
				if (cancelled) return;
				toast.error(getApiErrorMessage(error));
				updateParams({ session: null });
			})
			.finally(() => !cancelled && setSessionLoading(false));
		return () => {
			cancelled = true;
		};
		// `session` cố ý không nằm trong deps: chỉ tải lại khi id trên URL đổi.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId]);

	useEffect(() => {
		if (!lessonId) return setLesson(null);
		let cancelled = false;
		getLessonById(lessonId)
			.then((res) => !cancelled && setLesson(res.data ?? null))
			.catch(() => !cancelled && setLesson(null));
		return () => {
			cancelled = true;
		};
	}, [lessonId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [steps.length, pending]);

	const course = useMemo(
		() => courses.find((item) => item.id === courseId) ?? null,
		[courses, courseId],
	);
	const lessonInCourse = lesson && lesson.courseId === courseId ? lesson : null;
	const busy = pending !== null;
	const canAsk = Boolean(courseId) && configured !== false && !busy;

	const ask = async (text: string) => {
		const question = text.trim();
		if (!question || !courseId || busy) return;
		setPending(question);
		setDraft('');
		try {
			const res = await sendTutorMessage({
				sessionId: sessionId ?? undefined,
				courseId,
				lessonId: lessonInCourse?.id,
				message: question,
			});
			if (!res.data) return;
			setSession(res.data.session);
			setSteps((old) =>
				res.data!.session.id === sessionId
					? [...old, ...res.data!.steps]
					: res.data!.steps,
			);
			if (res.data.session.id !== sessionId)
				updateParams({ session: res.data.session.id });
			void loadSessions();
		} catch (error) {
			setDraft(question);
			toast.error(getApiErrorMessage(error, 'Trợ giảng chưa trả lời được.'));
		} finally {
			setPending(null);
		}
	};

	const remove = async () => {
		if (!sessionId) return;
		setRemoving(true);
		try {
			await deleteTutorSession(sessionId);
			toast.success('Đã xoá cuộc trò chuyện');
			setSession(null);
			updateParams({ session: null });
			void loadSessions();
		} catch (error) {
			toast.error(getApiErrorMessage(error));
		} finally {
			setRemoving(false);
		}
	};

	const lastAnswerId = [...steps]
		.reverse()
		.find((step) => step.role === 'answer' || step.role === 'error')?.id;
	const starters = lessonInCourse ? [LESSON_STARTER, ...STARTERS] : STARTERS;

	const chat = (
		<div className="tutor-chat">
			<div className="tutor-thread">
				{!steps.length && !pending && (
					<div className="tutor-empty">
						<Icon name="smart_toy" size={32} />
						<Paragraph style={{ margin: 0 }}>
							Hỏi trợ giảng về nội dung khoá học
							{course ? ` "${course.title}"` : ''}. Trợ giảng tìm trong học liệu
							của khoá rồi trả lời kèm trích dẫn tới đúng đoạn tài liệu; nếu học
							liệu không đề cập, trợ giảng sẽ nói rõ thay vì đoán.
						</Paragraph>
						<Space size={[8, 8]} wrap style={{ justifyContent: 'center' }}>
							{starters.map((starter) => (
								<IOutLinedBtn
									key={starter}
									size="small"
									disabled={!canAsk}
									onClick={() => void ask(starter)}
								>
									{starter}
								</IOutLinedBtn>
							))}
						</Space>
					</div>
				)}
				{steps.map((step) => {
					if (step.role === 'user')
						return (
							<div key={step.id} className="tutor-msg is-user">
								<div className="tutor-bubble">{step.content}</div>
							</div>
						);
					if (step.role === 'error')
						return (
							<div key={step.id} className="tutor-msg">
								<Alert
									type="error"
									showIcon
									message="Trợ giảng chưa trả lời được"
									description={step.content}
								/>
							</div>
						);
					if (step.role !== 'answer') return null;
					return (
						<div key={step.id} className="tutor-msg">
							<div className="tutor-bubble is-ai">
								<AnswerView
									answer={step.data as TutorAnswer}
									stepId={step.id}
									courseId={session?.courseId ?? courseId ?? ''}
									interactive={step.id === lastAnswerId && !busy}
									onAsk={(question) => void ask(question)}
								/>
							</div>
						</div>
					);
				})}
				{pending && (
					<>
						<div className="tutor-msg is-user">
							<div className="tutor-bubble">{pending}</div>
						</div>
						<div className="tutor-msg">
							<div className="tutor-bubble is-ai">
								<Space>
									<Spin size="small" />
									<Text type="secondary">
										Trợ giảng đang tìm trong học liệu… có thể mất 10–60 giây.
									</Text>
								</Space>
							</div>
						</div>
					</>
				)}
				<div ref={bottomRef} />
			</div>

			<div className="tutor-composer">
				<Input.TextArea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onPressEnter={(event) => {
						if (event.shiftKey || event.nativeEvent.isComposing) return;
						event.preventDefault();
						void ask(draft);
					}}
					placeholder={
						courseId
							? 'Nhập câu hỏi (Enter để gửi, Shift+Enter xuống dòng)'
							: 'Chọn khoá học trước'
					}
					autoSize={{ minRows: 1, maxRows: 6 }}
					maxLength={2000}
					disabled={!courseId || configured === false}
				/>
				<ISolidBtn
					background="primary"
					icon={<Icon name="send" size={16} />}
					loading={busy}
					disabled={!canAsk || !draft.trim()}
					onClick={() => void ask(draft)}
				>
					Gửi
				</ISolidBtn>
			</div>
		</div>
	);

	return (
		<div className="p-gutter space-y-space-lg">
			<div className="flex flex-wrap items-start justify-between gap-space-md">
				<div className="space-y-1">
					<h1 className="font-headline-md font-headline-md text-on-surface">
						Trợ giảng AI
					</h1>
					<p className="font-body-md text-on-surface-variant">
						Trả lời dựa trên học liệu của khoá học, có trích dẫn nguồn. AI vẫn
						có thể sai, hãy mở đoạn trích để kiểm tra.
					</p>
				</div>
				<Space wrap>
					<Select
						style={{ width: 260 }}
						placeholder="Chọn khoá học"
						value={courseId ?? undefined}
						loading={coursesLoading}
						disabled={busy}
						showSearch
						optionFilterProp="label"
						onChange={(id) =>
							updateParams({ course: id, session: null, lesson: null })
						}
						options={courses.map((item) => ({
							value: item.id,
							label: `${item.code} · ${item.title}`,
						}))}
					/>
					<Select
						style={{ width: 240 }}
						placeholder="Cuộc trò chuyện trước"
						value={sessionId ?? undefined}
						loading={sessionsLoading}
						disabled={busy}
						onChange={(id) => updateParams({ session: id })}
						options={sessions.map((item) => ({
							value: item.id,
							label: item.title,
						}))}
						notFoundContent={
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description="Chưa có cuộc trò chuyện"
							/>
						}
					/>
					<IOutLinedBtn
						icon={<Icon name="add_comment" size={16} />}
						disabled={busy}
						onClick={() => {
							setSession(null);
							updateParams({ session: null });
							setTab('chat');
						}}
					>
						Mới
					</IOutLinedBtn>
					{sessionId && (
						<Popconfirm
							title="Xoá cuộc trò chuyện này?"
							okText="Xoá"
							cancelText="Huỷ"
							onConfirm={() => void remove()}
						>
							<IOutLinedBtn
								mode="error"
								icon={<Icon name="delete" size={16} />}
								disabled={busy}
								loading={removing}
							>
								Xoá
							</IOutLinedBtn>
						</Popconfirm>
					)}
				</Space>
			</div>

			{configured === false && (
				<Alert
					type="warning"
					showIcon
					message="Backend chưa cấu hình DEEPSEEK_API_KEY nên chưa dùng được Trợ giảng AI."
				/>
			)}

			{lessonInCourse && (
				<Alert
					type="info"
					showIcon
					message={
						<span>
							Đang xem bài <Text strong>{lessonInCourse.title}</Text>, trợ giảng
							sẽ ưu tiên tìm trong bài này.{' '}
							<Link to={`/courses/${courseId}/learn/${lessonInCourse.id}`}>
								Quay lại bài học
							</Link>
						</span>
					}
					closable
					onClose={() => updateParams({ lesson: null })}
				/>
			)}

			<Card size="small" styles={{ body: { paddingTop: 0 } }}>
				{sessionLoading ? (
					<div className="flex min-h-[360px] items-center justify-center">
						<Spin />
					</div>
				) : (
					<Tabs
						activeKey={tab}
						onChange={setTab}
						tabBarExtraContent={session?.model && <Tag>{session.model}</Tag>}
						items={[
							{ key: 'chat', label: 'Trò chuyện', children: chat },
							{
								key: 'trace',
								label: `Trajectory (${steps.length})`,
								children: <Trajectory steps={steps} />,
							},
						]}
					/>
				)}
			</Card>
		</div>
	);
};

export default TutorPage;
