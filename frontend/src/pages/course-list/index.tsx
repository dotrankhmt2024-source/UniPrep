import { useCallback, useEffect, useState } from 'react';
import { Input, Select, Tooltip, message, type TableProps } from 'antd';
import { Link, useNavigate } from 'react-router';
import { getCategories } from '@/apis/category';
import { getCourses } from '@/apis/course';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ITable } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useDebounce } from '@/hooks';
import { useAppSelector } from '@/store/hooks';
import {
	COURSE_LEVEL_LABEL,
	COURSE_PUBLISH_STATUS_LABEL,
	ENROLLMENT_STATUS_LABEL,
	type Category,
	type CourseLevel,
	type CourseListItem,
	type CoursePublishStatus,
	type CourseSortField,
	type PageMetaDto,
	type PageOrder,
} from '@/types';
import {
	COURSE_LEVEL_TONE,
	getCourseStatusBadgeTone,
	getEnrollmentStatusBadgeTone,
} from '@/utils/course';

/**
 * Trang catalog khoá học (E3-T6) — route `/`, thay hoàn toàn `src/mocks/course.ts`.
 *
 * **Hợp đồng với backend (`GET /api/courses`):** tìm kiếm, lọc và phân trang đều chạy ở server.
 * Trang chỉ giữ bộ lọc trong state rồi gửi lại nguyên vẹn (`page`, `take`, `search`, `categoryId`,
 * `status`, `level`, `sortBy`, `order`) — **không** `useMemo` lọc trên mảng đã tải, vì như vậy chỉ
 * đúng với trang đang xem chứ không đúng với toàn bộ dữ liệu.
 *
 * `status` là bộ lọc nhiều giá trị nhưng backend chờ **một chuỗi phân tách bằng dấu phẩy**
 * (`FindCoursesParams.status`), nên mảng của antd được `join(',')` trước khi gửi; gửi thẳng mảng
 * xuống axios sẽ thành `status[]=draft&status[]=published` và bị validate pipe trả 400.
 *
 * **Ba tính năng giả của bản mock đã bị xoá ở E3-T6** vì backend chưa có dữ liệu cho chúng:
 * 1. nút gắn sao `starred` (chỉ là `useState` cục bộ, mất khi F5 — không có API nào lưu);
 * 2. bộ lọc `Segmented` theo trạng thái người học (`'in-progress' | 'future' | 'past'`) — trạng
 *    thái này suy ra từ `enrollments` + lịch của lớp, sẽ có ở E4 (`LearnerCourseStatus` đã khai
 *    sẵn trong `@/types` nhưng chưa endpoint nào trả về);
 * 3. `sortBy` cục bộ (`'name' | 'code' | 'semester'`) — sắp xếp giờ do server làm theo
 *    `createdAt | title | code | enrolledCount`, và `semester` không nằm trong danh sách đó.
 *
 * Trang **không** import `@/mocks/course` (Definition of Done của epic E3).
 */
const DEFAULT_TAKE = 20;

/** `take` tối đa mà `PaginationQueryDto` của backend cho phép — dùng để nạp đủ danh mục một lần. */
const CATEGORY_TAKE = 100;

const STATUS_OPTIONS = (
	Object.keys(COURSE_PUBLISH_STATUS_LABEL) as CoursePublishStatus[]
).map((status) => ({
	value: status,
	label: COURSE_PUBLISH_STATUS_LABEL[status],
}));

const LEVEL_OPTIONS = (Object.keys(COURSE_LEVEL_LABEL) as CourseLevel[]).map(
	(level) => ({ value: level, label: COURSE_LEVEL_LABEL[level] }),
);

const SORT_OPTIONS: { value: CourseSortField; label: string }[] = [
	{ value: 'createdAt', label: 'Sắp xếp: Ngày tạo' },
	{ value: 'title', label: 'Sắp xếp: Tên khoá học' },
	{ value: 'code', label: 'Sắp xếp: Mã môn' },
	{ value: 'enrolledCount', label: 'Sắp xếp: Số học viên' },
];

const ORDER_OPTIONS: { value: PageOrder; label: string }[] = [
	{ value: 'desc', label: 'Giảm dần' },
	{ value: 'asc', label: 'Tăng dần' },
];

/**
 * Ô rỗng trong bảng: hiện gạch ngang thay vì để trắng, để người đọc phân biệt "không có dữ liệu"
 * với "lỗi hiển thị".
 */
const Dash = () => <span className="text-on-surface-variant">—</span>;

const CourseListPage = () => {
	const navigate = useNavigate();
	const role = useAppSelector((state) => state.auth.user?.role);

	const [keyword, setKeyword] = useState('');
	// Gõ tới đâu gọi API tới đó sẽ bắn một request cho mỗi ký tự — chờ 400ms mới chốt từ khoá.
	const debouncedKeyword = useDebounce(keyword, 400);
	const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
	const [level, setLevel] = useState<CourseLevel | undefined>(undefined);
	const [statuses, setStatuses] = useState<CoursePublishStatus[]>([]);
	const [sortBy, setSortBy] = useState<CourseSortField>('createdAt');
	const [order, setOrder] = useState<PageOrder>('desc');
	const [page, setPage] = useState(1);
	const [take, setTake] = useState(DEFAULT_TAKE);

	const [rows, setRows] = useState<CourseListItem[]>([]);
	const [meta, setMeta] = useState<PageMetaDto | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);

	const [categories, setCategories] = useState<Category[]>([]);
	const [categoryError, setCategoryError] = useState('');

	/** Nạp lại đúng trang + bộ lọc đang xem (nút "Thử lại" sau khi request hỏng). */
	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	/**
	 * Danh mục chỉ nạp **một lần** cho mỗi lần bấm "Thử lại" (`reloadKey`): gần như không đổi trong
	 * một phiên và không phụ thuộc bộ lọc, nên gọi lại theo mỗi lần đổi trang chỉ tốn thêm một
	 * request vô ích. Vẫn phải nghe `reloadKey` — nếu không, khi server chết rồi sống lại, ô lọc
	 * danh mục sẽ kẹt ở trạng thái "Không tải được danh mục" cho tới khi người dùng F5.
	 */
	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			try {
				const response = await getCategories({
					take: CATEGORY_TAKE,
					sortBy: 'name',
					order: 'asc',
				});
				if (cancelled) return;

				setCategories(response.data?.items ?? []);
				setCategoryError('');
			} catch (error) {
				if (cancelled) return;

				// Hỏng danh mục **không** làm hỏng catalog: chỉ khoá ô lọc danh mục lại và nói lý do
				// ngay trên placeholder, còn bảng khoá học vẫn tải bình thường.
				setCategories([]);
				setCategoryError(getApiErrorMessage(error, 'Không tải được danh mục.'));
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [reloadKey]);

	const statusParam = statuses.length > 0 ? statuses.join(',') : undefined;

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
					categoryId,
					level,
					status: statusParam,
					sortBy,
					order,
				});

				if (cancelled) return;

				setRows(response.data?.items ?? []);
				setMeta(response.data?.meta ?? null);
			} catch (error) {
				if (cancelled) return;

				// Bảng rỗng vì lỗi mạng trông **giống hệt** bảng rỗng vì hết dữ liệu, nên lỗi phải
				// được nói ra hai lần: một toast để không bỏ sót, một ErrorBadge kèm nút thử lại
				// để người dùng còn lối thoát ngay trên trang.
				const errorMessage = getApiErrorMessage(
					error,
					'Không tải được danh sách khoá học.',
				);

				setRows([]);
				setMeta(null);
				setLoadError(errorMessage);
				message.error(errorMessage);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [
		page,
		take,
		debouncedKeyword,
		categoryId,
		level,
		statusParam,
		sortBy,
		order,
		reloadKey,
	]);

	// Đổi từ khoá/bộ lọc thì quay về trang 1: trang 4 của kết quả cũ có thể không còn bản ghi nào.
	const handleKeywordChange = (value: string) => {
		setKeyword(value);
		setPage(1);
	};

	const handleCategoryChange = (value: string | undefined) => {
		setCategoryId(value);
		setPage(1);
	};

	const handleLevelChange = (value: CourseLevel | undefined) => {
		setLevel(value);
		setPage(1);
	};

	const handleStatusChange = (values: CoursePublishStatus[]) => {
		setStatuses(values);
		setPage(1);
	};

	const handleSortByChange = (value: CourseSortField) => {
		setSortBy(value);
		setPage(1);
	};

	const handleOrderChange = (value: PageOrder) => {
		setOrder(value);
		setPage(1);
	};

	/**
	 * Backend luôn ép `status = 'published'` (và bỏ `private`) với học viên trong
	 * `CourseAccessService.applyVisibilityScope`, nên với họ ô lọc trạng thái không thu hẹp được
	 * gì thêm: mọi trạng thái khác chắc chắn trả về rỗng. Giữ ô lọc ở dạng **bị khoá** kèm lý do
	 * thay vì ẩn đi, để người dùng hiểu vì sao mình không thấy khoá `draft`/`archived`.
	 */
	const canFilterByStatus = role !== 'student';

	const columns: TableProps<CourseListItem>['columns'] = [
		{
			title: 'Mã môn',
			dataIndex: 'code',
			key: 'code',
			width: 130,
			render: (value: string) => (
				<span className="font-semibold text-on-surface">{value}</span>
			),
		},
		{
			title: 'Khoá học',
			dataIndex: 'title',
			key: 'title',
			width: 360,
			render: (_value, record) => (
				<div className="space-y-1">
					<Link
						to={`/courses/${record.id}`}
						className="font-semibold text-on-surface hover:text-secondary"
					>
						{record.title}
					</Link>
					{record.summary && (
						// Cắt bằng CSS (`line-clamp-2`) chứ không cắt chuỗi: nội dung đầy đủ vẫn nằm
						// trong DOM cho trình đọc màn hình và cho tooltip của trình duyệt.
						<div
							className="line-clamp-2 font-label-sm font-label-sm text-on-surface-variant"
							title={record.summary}
						>
							{record.summary}
						</div>
					)}
				</div>
			),
		},
		{
			title: 'Danh mục',
			key: 'category',
			width: 180,
			render: (_value, record) =>
				record.category ? record.category.name : <Dash />,
		},
		{
			title: 'Giảng viên',
			key: 'owner',
			width: 190,
			render: (_value, record) => (
				<span className="text-on-surface">{record.owner.fullName}</span>
			),
		},
		{
			title: 'Học kỳ',
			dataIndex: 'semester',
			key: 'semester',
			width: 130,
			render: (value: string | null) => value || <Dash />,
		},
		{
			title: 'Trình độ',
			key: 'level',
			width: 130,
			render: (_value, record) =>
				record.level ? (
					<Badge status={COURSE_LEVEL_TONE[record.level]}>
						{COURSE_LEVEL_LABEL[record.level]}
					</Badge>
				) : (
					<Dash />
				),
		},
		{
			title: 'Trạng thái',
			dataIndex: 'status',
			key: 'status',
			width: 165,
			render: (value: CoursePublishStatus) => (
				<Badge status={getCourseStatusBadgeTone(value)} dot>
					{COURSE_PUBLISH_STATUS_LABEL[value]}
				</Badge>
			),
		},
		{
			title: 'Nội dung',
			key: 'content',
			width: 150,
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
			width: 120,
			align: 'center',
			render: (value: number) => (
				// `title` trên Tooltip thay vì chỉ trên ô: con số nằm giữa ô nên vùng rê chuột chỉ
				// là một ký tự, tooltip của trình duyệt gần như không bao giờ hiện.
				<Tooltip title="Số học viên đã ghi danh">
					<span className="cursor-default">{value}</span>
				</Tooltip>
			),
		},
		{
			title: 'Ghi danh',
			key: 'myEnrollment',
			width: 145,
			render: (_value, record) =>
				record.myEnrollment ? (
					<Badge
						status={getEnrollmentStatusBadgeTone(record.myEnrollment.status)}
						dot
						title={ENROLLMENT_STATUS_LABEL[record.myEnrollment.status]}
					>
						Đã đăng ký
					</Badge>
				) : (
					<Dash />
				),
		},
		{
			title: 'Thao tác',
			key: 'actions',
			width: 140,
			align: 'right',
			render: (_value, record) => (
				// Điều hướng bằng `navigate` thay vì bọc `IOutLinedBtn` trong `<Link>`: `<button>`
				// lồng trong `<a>` là HTML không hợp lệ và làm hỏng thao tác bàn phím.
				<IOutLinedBtn
					size="small"
					mode="primary"
					onClick={() => navigate(`/courses/${record.id}`)}
				>
					Xem chi tiết
				</IOutLinedBtn>
			),
		},
	];

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Danh sách khoá học
				</h1>
				<Badge status="neutral" size="md">
					{meta?.itemCount ?? 0} khoá học
				</Badge>
			</div>

			<p className="font-body-sm font-body-sm text-on-surface-variant">
				Dùng ô tìm kiếm và các bộ lọc bên dưới để thu hẹp danh sách; bấm vào tên
				khoá học để xem chi tiết.
			</p>

			{loadError && (
				<div className="flex flex-wrap items-center gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError}
					</ErrorBadge>
					<IOutLinedBtn size="small" loading={isLoading} onClick={reload}>
						Thử lại
					</IOutLinedBtn>
				</div>
			)}

			<div className="grid grid-cols-1 gap-space-sm md:grid-cols-2 xl:grid-cols-3">
				<Input
					allowClear
					size="large"
					className="md:col-span-2 xl:col-span-1"
					placeholder="Tìm theo mã môn, tên hoặc mô tả khoá học..."
					prefix={<Icon name="search" size={18} className="text-outline" />}
					value={keyword}
					onChange={(event) => handleKeywordChange(event.target.value)}
				/>

				<Select<string>
					allowClear
					size="large"
					placeholder={categoryError ? 'Không tải được danh mục' : 'Danh mục'}
					disabled={!!categoryError}
					options={categories.map((category) => ({
						value: category.id,
						label: category.name,
					}))}
					value={categoryId}
					onChange={handleCategoryChange}
				/>

				<Select<CourseLevel>
					allowClear
					size="large"
					placeholder="Trình độ"
					options={LEVEL_OPTIONS}
					value={level}
					onChange={handleLevelChange}
				/>

				<Select<CoursePublishStatus[]>
					mode="multiple"
					allowClear
					size="large"
					placeholder="Trạng thái"
					options={STATUS_OPTIONS}
					value={statuses}
					disabled={!canFilterByStatus}
					title={
						canFilterByStatus
							? undefined
							: 'Học viên chỉ thấy khoá học đã xuất bản.'
					}
					onChange={handleStatusChange}
				/>

				<div className="flex gap-space-sm">
					<Select<CourseSortField>
						size="large"
						className="flex-1"
						options={SORT_OPTIONS}
						value={sortBy}
						onChange={handleSortByChange}
					/>
					<Select<PageOrder>
						size="large"
						className="w-36"
						options={ORDER_OPTIONS}
						value={order}
						onChange={handleOrderChange}
					/>
				</div>
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
						total: meta?.itemCount ?? 0,
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
		</div>
	);
};

export default CourseListPage;
