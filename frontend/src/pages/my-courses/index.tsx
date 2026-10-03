import { useCallback, useEffect, useState } from 'react';
import { Empty, Modal, Pagination, Progress, Spin, message } from 'antd';
import {
	BookOutlined,
	CheckCircleOutlined,
	PlayCircleOutlined,
	StopOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router';
import { cancelEnrollment, getMyEnrollments } from '@/apis/enrollment';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	ENROLLMENT_STATUS_LABEL,
	type EnrollmentListItem,
	type PageMetaDto,
} from '@/types';
import { getEnrollmentStatusBadgeTone } from '@/utils/course';

const TAKE = 12;

const MyCoursesPage = () => {
	const navigate = useNavigate();
	const [items, setItems] = useState<EnrollmentListItem[]>([]);
	const [meta, setMeta] = useState<PageMetaDto | null>(null);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [busyId, setBusyId] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setIsLoading(true);
			setLoadError('');
			try {
				const response = await getMyEnrollments({
					page,
					take: TAKE,
					status: 'active,completed',
				});
				if (cancelled) return;
				setItems(response.data?.items ?? []);
				setMeta(response.data?.meta ?? null);
			} catch (error) {
				if (cancelled) return;
				setItems([]);
				setMeta(null);
				setLoadError(
					getApiErrorMessage(error, 'Không tải được khoá học đã đăng ký.'),
				);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [page, reloadKey]);

	const handleCancel = (item: EnrollmentListItem) => {
		Modal.confirm({
			title: 'Huỷ đăng ký khoá học?',
			content: `Tiến độ của bạn trong khoá ${item.course.code} vẫn được lưu, nhưng bạn sẽ không thể tiếp tục học cho đến khi đăng ký lại.`,
			okText: 'Huỷ đăng ký',
			cancelText: 'Giữ đăng ký',
			okButtonProps: { danger: true },
			onOk: async () => {
				setBusyId(item.id);
				try {
					await cancelEnrollment(item.id);
					message.success('Đã huỷ ghi danh khoá học.');
					reload();
				} catch (error) {
					message.error(getApiErrorMessage(error));
				} finally {
					setBusyId(null);
				}
			},
		});
	};

	return (
		<div className="space-y-space-lg p-gutter">
			<header className="flex flex-wrap items-end justify-between gap-space-md">
				<div>
					<p className="font-label-md font-label-md text-primary">HỌC TẬP</p>
					<h1 className="mt-1 font-headline-md font-headline-md text-on-surface">
						Khoá học của tôi
					</h1>
				</div>
				<Link to="/" className="font-label-md text-secondary hover:underline">
					Khám phá khoá học
				</Link>
			</header>

			{loadError && (
				<div className="flex flex-wrap items-center justify-between gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError}
					</ErrorBadge>
					<IOutLinedBtn onClick={reload}>Thử lại</IOutLinedBtn>
				</div>
			)}

			{isLoading ? (
				<div className="flex min-h-[35vh] items-center justify-center">
					<Spin size="large" />
				</div>
			) : items.length === 0 && !loadError ? (
				<div className="border-y border-outline-variant py-space-xl">
					<Empty description="Bạn chưa có khoá học đang học." />
					<div className="mt-space-md text-center">
						<ISolidBtn
							type="primary"
							background="primary"
							icon={<BookOutlined />}
							onClick={() => void navigate('/')}
						>
							Tìm khoá học
						</ISolidBtn>
					</div>
				</div>
			) : (
				<div className="divide-y divide-outline-variant border-y border-outline-variant">
					{items.map((item) => {
						const isCompleted = item.status === 'completed';
						const lessonHref = item.resumeLessonId
							? `/courses/${item.courseId}/learn/${item.resumeLessonId}`
							: `/courses/${item.courseId}/learn`;
						return (
							<article
								key={item.id}
								className="grid gap-space-md py-space-lg md:grid-cols-[minmax(0,1fr)_14rem] md:items-center"
							>
								<div className="min-w-0 space-y-space-sm">
									<div className="flex flex-wrap items-center gap-2">
										<Badge status="info">{item.course.code}</Badge>
										<Badge
											status={getEnrollmentStatusBadgeTone(item.status)}
											dot
										>
											{ENROLLMENT_STATUS_LABEL[item.status]}
										</Badge>
									</div>
									<Link
										to={`/courses/${item.courseId}`}
										className="block truncate font-title-lg text-on-surface hover:text-primary"
									>
										{item.course.title}
									</Link>
									{item.course.summary && (
										<p className="line-clamp-2 font-body-sm text-on-surface-variant">
											{item.course.summary}
										</p>
									)}
									<div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-on-surface-variant">
										<span>
											{item.completedLessons} / {item.totalLessons} bài hoàn
											thành
										</span>
										<span>
											Đăng ký{' '}
											{new Date(item.enrolledAt).toLocaleDateString('vi-VN')}
										</span>
									</div>
									<Progress
										percent={item.progressPercent}
										showInfo
										status={isCompleted ? 'success' : 'active'}
									/>
								</div>

								<div className="flex flex-wrap gap-space-sm md:flex-col">
									<ISolidBtn
										type="primary"
										background="primary"
										block
										icon={
											isCompleted ? (
												<CheckCircleOutlined />
											) : (
												<PlayCircleOutlined />
											)
										}
										onClick={() => void navigate(lessonHref)}
									>
										{isCompleted ? 'Xem lại bài học' : 'Tiếp tục học'}
									</ISolidBtn>
									{!isCompleted && (
										<IOutLinedBtn
											block
											loading={busyId === item.id}
											danger
											icon={<StopOutlined />}
											onClick={() => handleCancel(item)}
										>
											Huỷ đăng ký
										</IOutLinedBtn>
									)}
								</div>
							</article>
						);
					})}
				</div>
			)}

			{meta && meta.itemCount > meta.take && (
				<div className="flex justify-end">
					<Pagination
						current={meta.page}
						pageSize={meta.take}
						total={meta.itemCount}
						showSizeChanger={false}
						onChange={setPage}
					/>
				</div>
			)}
		</div>
	);
};

export default MyCoursesPage;
