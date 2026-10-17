import { useEffect, useState } from 'react';
import { Empty, Skeleton } from 'antd';
import { Link, useParams } from 'react-router';
import { getQuizzes } from '@/apis/assessment';
import { Badge, ErrorBadge, Icon } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAuth } from '@/contexts/auth-context';
import type { AssessmentQuiz } from '@/types';

const CourseQuizzesPage = () => {
	const { courseId = '' } = useParams<{ courseId: string }>();
	const { user } = useAuth();
	const [items, setItems] = useState<AssessmentQuiz[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	/**
	 * Giảng viên/admin **không** làm bài ở đây (`startQuizAttempt` yêu cầu role `student`), nên thay vì
	 * mời họ bấm "Bắt đầu" rồi vào một trang làm bài vô nghĩa, trang này đưa thẳng họ sang khu chấm
	 * điểm. Điều kiện là "chắc chắn không phải student" để lúc phiên đang nạp (`user === null`) học
	 * viên thật vẫn thấy đúng giao diện của mình.
	 */
	const canManage = !!user && user.role !== 'student';

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			try {
				const response = await getQuizzes({ courseId, page: 1, take: 100 });
				if (!cancelled) setItems(response.data?.items ?? []);
			} catch (loadError) {
				if (!cancelled)
					setError(
						getApiErrorMessage(
							loadError,
							'Không tải được danh sách bài kiểm tra.',
						),
					);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [courseId]);

	return (
		<div className="mx-auto max-w-5xl space-y-space-lg p-gutter">
			<Link
				to={`/courses/${courseId}`}
				className="font-label-md text-secondary hover:underline"
			>
				← Về khoá học
			</Link>
			<header>
				<p className="font-label-md text-primary">
					{canManage ? 'GIẢNG DẠY' : 'HỌC TẬP'}
				</p>
				<h1 className="mt-1 font-headline-md text-on-surface">Bài kiểm tra</h1>
			</header>
			{error && (
				<ErrorBadge icon={<Icon name="error" size={14} />}>{error}</ErrorBadge>
			)}
			{loading ? (
				<Skeleton active />
			) : items.length === 0 ? (
				<div className="border-y border-outline-variant py-space-xl">
					<Empty description="Khoá học chưa có bài kiểm tra." />
				</div>
			) : (
				<div className="divide-y divide-outline-variant border-y border-outline-variant">
					{items.map((quiz) => (
						<article
							key={quiz.id}
							className="flex flex-wrap items-center justify-between gap-space-md py-space-lg"
						>
							<div className="min-w-0 space-y-2">
								<div className="flex flex-wrap gap-2">
									<Badge
										status={
											quiz.status === 'published'
												? 'success'
												: quiz.status === 'closed'
													? 'warning'
													: 'neutral'
										}
										dot
									>
										{quiz.status === 'published'
											? 'Đang mở'
											: quiz.status === 'closed'
												? 'Đã đóng'
												: 'Bản nháp'}
									</Badge>
									<Badge status="info">{quiz.questionCount} câu</Badge>
								</div>
								<h2 className="font-title-lg text-on-surface">{quiz.title}</h2>
								<p className="font-body-sm text-on-surface-variant">
									{quiz.timeLimitMinutes
										? `${quiz.timeLimitMinutes} phút`
										: 'Không giới hạn thời gian'}{' '}
									· {quiz.maxAttempts ?? 'Không giới hạn'} lượt ·{' '}
									{quiz.totalPoints} điểm
								</p>
							</div>
							{canManage ? (
								<Link
									to={`/teacher/courses/${courseId}/quizzes`}
									className="inline-flex items-center gap-2 font-label-md text-secondary hover:underline"
								>
									<Icon name="grading" size={18} />
									Chấm bài &amp; quản lý
								</Link>
							) : quiz.status === 'published' ? (
								<Link
									to={`/quizzes/${quiz.id}`}
									className="inline-flex items-center gap-2 font-label-md text-secondary hover:underline"
								>
									<Icon name="play_arrow" size={18} />
									{quiz.myAttemptCount ? 'Tiếp tục / xem kết quả' : 'Bắt đầu'}
								</Link>
							) : (
								<span className="font-body-sm text-on-surface-variant">
									{quiz.status === 'closed'
										? 'Đã đóng với học viên'
										: 'Chưa mở cho học viên'}
								</span>
							)}
						</article>
					))}
				</div>
			)}
		</div>
	);
};

export default CourseQuizzesPage;
