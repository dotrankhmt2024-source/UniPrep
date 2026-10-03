import { useCallback, useEffect, useState } from 'react';
import { Input, Modal, Select, message, type TableProps } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router';
import {
	deleteCourse,
	getCourses,
	publishCourse,
	unpublishCourse,
} from '@/apis/course';
import {
	Badge,
	ErrorBadge,
	Icon,
	IOutLinedBtn,
	ISolidBtn,
	ITable,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useDebounce } from '@/hooks';
import {
	COURSE_PUBLISH_STATUS_LABEL,
	type CourseListItem,
	type CoursePublishStatus,
} from '@/types';
import { getCourseStatusBadgeTone } from '@/utils/course';
import CreateCourseModal from './create-course-modal';

/**
 * Danh sách khoá học của khu giảng viên (E3-T9) — route `/teacher/courses`.
 *
 * **Phạm vi dữ liệu do backend quyết định:** `GET /api/courses` trả về khoá đã publish **cộng**
 * khoá mà người đang đăng nhập sở hữu hoặc được phân công. Vì vậy trang này **không** lọc lại
 * theo `owner.id` ở client — làm thế sẽ giấu mất các khoá đã publish của giảng viên khác mà
 * giảng viên vẫn cần thấy (và tiêu đề trang đã nói rõ điều đó).
 *
 * Mọi thao tác ghi (công bố / ẩn / xoá) đều gọi API thật rồi nạp lại đúng trang + bộ lọc đang
 * xem qua `reloadKey`, không sửa mảng `rows` tại chỗ: `enrolledCount`/`lessonCount`/`updatedAt`
 * đều do backend tính nên chỉ backend mới có con số đúng sau khi ghi.
 */
const DEFAULT_TAKE = 20;

const STATUS_VALUES = Object.keys(
	COURSE_PUBLISH_STATUS_LABEL,
) as CoursePublishStatus[];

const STATUS_OPTIONS = STATUS_VALUES.map((status) => ({
	value: status,
	label: COURSE_PUBLISH_STATUS_LABEL[status],
}));

/**
 * Ô lọc "Trạng thái" hiển thị từng nhãn (dễ đọc) nhưng giá trị lại là chuỗi nhãn nối bằng dấu
 * phẩy — nếu truyền mảng xuống axios thì querystring thành `status[]=draft`, còn backend chờ
 * `status=draft,published` (`FindCoursesParams.status` ghi rõ "phân tách bằng dấu phẩy").
 */
const EMPTY_STATUS = '__all__';

const statusToParam = (statuses: string[]): string | undefined => {
	const selected = statuses.filter((status) => status !== EMPTY_STATUS);

	return selected.length > 0 ? selected.join(',') : undefined;
};

const TeacherCourseListPage = () => {
	const navigate = useNavigate();

	const [keyword, setKeyword] = useState('');
	// Gõ tới đâu gọi API tới đó sẽ bắn một request cho mỗi ký tự — chờ 400ms mới chốt.
	const debouncedKeyword = useDebounce(keyword, 400);
	const [statusFilter, setStatusFilter] = useState<string[]>([EMPTY_STATUS]);
	const [page, setPage] = useState(1);
	const [take, setTake] = useState(DEFAULT_TAKE);

	const [rows, setRows] = useState<CourseListItem[]>([]);
	const [itemCount, setItemCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	/** Id khoá đang chạy thao tác công bố/ẩn/xoá — chỉ khoá đúng hàng đó, không khoá cả bảng. */
	const [busyCourseId, setBusyCourseId] = useState<string | null>(null);

	/** Nạp lại đúng trang/bộ lọc đang xem sau mỗi thao tác ghi. */
	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	const statusParam = statusToParam(statusFilter);

	useEffect(() => {
		// Cờ `cancelled`: gõ nhanh trong ô tìm kiếm làm nhiều request chồng nhau, chỉ request cuối
		// được ghi vào state — nếu không, kết quả cũ về muộn sẽ đè kết quả mới.
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			setLoadError('');

			try {
				const response = await getCourses({
					page,
					take,
					search: debouncedKeyword.trim() || undefined,
					status: statusParam,
					sortBy: 'createdAt',
					order: 'desc',
				});

				if (cancelled) return;

				setRows(response.data?.items ?? []);
				setItemCount(response.data?.meta?.itemCount ?? 0);
			} catch (error) {
				if (cancelled) return;

				setRows([]);
				setItemCount(0);
				setLoadError(
					getApiErrorMessage(error, 'Không tải được danh sách khoá học.'),
				);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [page, take, debouncedKeyword, statusParam, reloadKey]);

	// Đổi từ khoá/bộ lọc thì quay về trang 1: trang 4 của kết quả cũ có thể không còn bản ghi nào.
	const handleKeywordChange = (value: string) => {
		setKeyword(value);
		setPage(1);
	};

	const handleStatusChange = (values: string[]) => {
		// Bỏ hết lựa chọn = không lọc gì, nên luôn giữ lại mục "Tất cả trạng thái".
		setStatusFilter(values.length > 0 ? values : [EMPTY_STATUS]);
		setPage(1);
	};

	const handlePublish = async (course: CourseListItem) => {
		setBusyCourseId(course.id);
		try {
			const response = await publishCourse(course.id);
			message.success(response.message || 'Công bố khoá học thành công');
			reload();
		} catch (error) {
			// 400 ở đây hầu như luôn là "khoá học chưa có bài học nào" — hiện nguyên văn câu của backend.
			message.error(
				getApiErrorMessage(
					error,
					'Công bố khoá học thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setBusyCourseId(null);
		}
	};

	const handleUnpublish = async (course: CourseListItem) => {
		setBusyCourseId(course.id);
		try {
			const response = await unpublishCourse(course.id);
			message.success(response.message || 'Đã ẩn khoá học');
			reload();
		} catch (error) {
			message.error(
				getApiErrorMessage(error, 'Ẩn khoá học thất bại, vui lòng thử lại.'),
			);
		} finally {
			setBusyCourseId(null);
		}
	};

	const handleDelete = (course: CourseListItem) => {
		Modal.confirm({
			title: 'Xoá khoá học',
			content: `Khoá "${course.code} — ${course.title}" sẽ bị xoá khỏi danh sách. Thao tác này không khôi phục được.`,
			okText: 'Xoá khoá học',
			cancelText: 'Huỷ bỏ',
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					const response = await deleteCourse(course.id);
					message.success(response.message || 'Xoá khoá học thành công');
					reload();
				} catch (error) {
					// 409: khoá đã có học viên ghi danh — backend trả câu tiếng Việt, hiện nguyên văn.
					message.error(
						getApiErrorMessage(
							error,
							'Xoá khoá học thất bại, vui lòng thử lại.',
						),
					);
				}
			},
		});
	};

	const columns: TableProps<CourseListItem>['columns'] = [
		{
			title: 'Mã môn',
			dataIndex: 'code',
			key: 'code',
			width: 140,
			render: (value: string, record) => (
				<Link
					to={`/teacher/courses/${record.id}`}
					className="font-semibold text-secondary hover:underline"
				>
					{value}
				</Link>
			),
		},
		{
			title: 'Tên khoá học',
			dataIndex: 'title',
			key: 'title',
			render: (value: string, record) => (
				<div className="space-y-1">
					<Link
						to={`/teacher/courses/${record.id}`}
						className="font-semibold text-on-surface hover:text-secondary"
					>
						{value}
					</Link>
					{record.summary && (
						<div className="line-clamp-1 max-w-md font-label-sm font-label-sm text-on-surface-variant">
							{record.summary}
						</div>
					)}
				</div>
			),
		},
		{
			title: 'Phụ trách',
			dataIndex: ['owner', 'fullName'],
			key: 'owner',
			width: 180,
			render: (_value, record) => (
				<div className="space-y-1">
					<div className="text-on-surface">{record.owner.fullName}</div>
					<div className="font-label-sm font-label-sm text-on-surface-variant">
						{record.owner.email}
					</div>
				</div>
			),
		},
		{
			title: 'Trạng thái',
			dataIndex: 'status',
			key: 'status',
			width: 150,
			render: (value: CoursePublishStatus) => (
				<Badge status={getCourseStatusBadgeTone(value)} dot>
					{COURSE_PUBLISH_STATUS_LABEL[value]}
				</Badge>
			),
		},
		{
			title: 'Nội dung',
			key: 'content',
			width: 140,
			align: 'center',
			render: (_value, record) => (
				<span className="text-on-surface-variant">
					{record.sectionCount} chương · {record.lessonCount} bài
				</span>
			),
		},
		{
			title: 'Học viên',
			dataIndex: 'enrolledCount',
			key: 'enrolledCount',
			width: 110,
			align: 'center',
		},
		{
			title: 'Cập nhật',
			dataIndex: 'updatedAt',
			key: 'updatedAt',
			width: 150,
			render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
		},
		{
			title: 'Thao tác',
			key: 'actions',
			width: 240,
			align: 'right',
			render: (_value, record) => {
				const isBusy = busyCourseId === record.id;
				// `published` → ẩn; mọi trạng thái khác (`draft`/`hidden`/`archived`) → công bố lại.
				const isPublished = record.status === 'published';

				return (
					<div className="flex items-center justify-end gap-space-xs">
						<IOutLinedBtn
							size="small"
							mode="primary"
							onClick={() => navigate(`/teacher/courses/${record.id}`)}
						>
							Sửa
						</IOutLinedBtn>

						{isPublished ? (
							<IOutLinedBtn
								size="small"
								loading={isBusy}
								onClick={() => void handleUnpublish(record)}
							>
								Ẩn
							</IOutLinedBtn>
						) : (
							<IOutLinedBtn
								size="small"
								loading={isBusy}
								onClick={() => void handlePublish(record)}
							>
								Công bố
							</IOutLinedBtn>
						)}

						<IOutLinedBtn
							size="small"
							mode="error"
							onClick={() => handleDelete(record)}
						>
							Xoá
						</IOutLinedBtn>
					</div>
				);
			},
		},
	];

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center justify-between gap-space-sm">
				<div className="flex flex-wrap items-center gap-space-sm">
					<h1 className="font-headline-lg font-headline-lg text-on-surface">
						Khoá học tôi phụ trách
					</h1>
					<Badge status="neutral" size="md">
						{itemCount} khoá học
					</Badge>
				</div>

				<ISolidBtn
					type="primary"
					background="primary"
					icon={<Icon name="add" size={18} />}
					onClick={() => setIsCreateOpen(true)}
				>
					Tạo khoá học
				</ISolidBtn>
			</div>

			<p className="font-body-sm font-body-sm text-on-surface-variant">
				Danh sách gồm các khoá bạn sở hữu hoặc được phân công giảng dạy, cùng
				với mọi khoá <strong>đã xuất bản</strong> của giảng viên khác. Chỉ khoá
				bạn phụ trách mới sửa được nội dung.
			</p>

			{loadError && (
				<div className="flex flex-wrap items-center gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError}
					</ErrorBadge>
					<IOutLinedBtn size="small" onClick={reload}>
						Thử lại
					</IOutLinedBtn>
				</div>
			)}

			<div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
				<Input
					allowClear
					size="large"
					className="md:col-span-2"
					placeholder="Tìm theo mã môn hoặc tên khoá học..."
					prefix={<Icon name="search" size={18} className="text-outline" />}
					value={keyword}
					onChange={(event) => handleKeywordChange(event.target.value)}
				/>

				<Select
					mode="multiple"
					allowClear
					size="large"
					placeholder="Trạng thái"
					options={[
						{ value: EMPTY_STATUS, label: 'Tất cả trạng thái' },
						...STATUS_OPTIONS,
					]}
					value={statusFilter}
					onChange={handleStatusChange}
				/>
			</div>

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<CourseListItem>
					columns={columns}
					dataSource={rows}
					rowKey="id"
					loading={isLoading}
					pagination={{
						// `meta.itemCount` là TỔNG số bản ghi khớp bộ lọc (không phải số dòng của
						// trang hiện tại) — đúng thứ antd cần cho `total` để tính số trang.
						total: itemCount,
						pageSize: take,
						current: page,
						showSizeChanger: true,
						showQuickJumper: true,
						onChange: (nextPage, nextTake) => {
							setPage(nextPage);
							setTake(nextTake);
						},
					}}
				/>
			</div>

			<CreateCourseModal
				open={isCreateOpen}
				onCancel={() => setIsCreateOpen(false)}
				onCreated={(courseId) => {
					setIsCreateOpen(false);
					reload();
					if (courseId) navigate(`/teacher/courses/${courseId}`);
				}}
			/>
		</div>
	);
};

export default TeacherCourseListPage;
