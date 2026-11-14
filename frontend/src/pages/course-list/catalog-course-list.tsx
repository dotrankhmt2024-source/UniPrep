import { useCallback, useEffect, useState } from 'react';
import { Input, message, type TableProps } from 'antd';
import { useNavigate } from 'react-router';
import { getCatalogCourses, openCatalogCourse } from '@/apis/catalog-learning';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ITable } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useDebounce } from '@/hooks';
import {
	ENROLLMENT_STATUS_LABEL,
	type LearnerCatalogCourse,
	type PageMetaDto,
} from '@/types';
import { getEnrollmentStatusBadgeTone } from '@/utils/course';

const DEFAULT_TAKE = 20;

const Dash = () => <span className="text-on-surface-variant">—</span>;

/**
 * Danh sách khoá học của **học viên** = mọi môn trong Catalog (DB đề cương của trường).
 *
 * Bấm "Vào khoá học" gọi `POST /catalog/learning/courses/:code/open`: backend tạo khoá học UniPrep
 * cho môn đó nếu chưa có (chương = chủ đề, bài = kỹ năng, mỗi chủ đề một bài tập), rồi chuyển sang
 * trang chi tiết khoá học để ghi danh như bình thường. Nội dung bài và câu hỏi do AI sinh khi mở.
 */
interface CatalogCourseListProps {
	/** Nằm trong tab của trang khoá học: bỏ tiêu đề trang và lề ngoài. */
	embedded?: boolean;
}

const CatalogCourseList = ({ embedded = false }: CatalogCourseListProps) => {
	const navigate = useNavigate();
	const [keyword, setKeyword] = useState('');
	const debouncedKeyword = useDebounce(keyword, 400);
	const [page, setPage] = useState(1);
	const [take, setTake] = useState(DEFAULT_TAKE);
	const [rows, setRows] = useState<LearnerCatalogCourse[]>([]);
	const [meta, setMeta] = useState<PageMetaDto | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);
	const [openingCode, setOpeningCode] = useState<string | null>(null);

	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setIsLoading(true);
			setLoadError('');
			try {
				const response = await getCatalogCourses({
					page,
					take,
					search: debouncedKeyword.trim() || undefined,
				});
				if (cancelled) return;
				setRows(response.data?.items ?? []);
				setMeta(response.data?.meta ?? null);
			} catch (error) {
				if (cancelled) return;
				const errorMessage = getApiErrorMessage(
					error,
					'Không tải được danh sách môn học.',
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
	}, [page, take, debouncedKeyword, reloadKey]);

	const openCourse = async (record: LearnerCatalogCourse) => {
		if (record.course) {
			navigate(`/courses/${record.course.id}`);
			return;
		}
		setOpeningCode(record.courseCode);
		try {
			const response = await openCatalogCourse(record.courseCode);
			if (response.data?.courseId)
				navigate(`/courses/${response.data.courseId}`);
		} catch (error) {
			message.error(getApiErrorMessage(error, 'Không mở được khoá học.'));
		} finally {
			setOpeningCode(null);
		}
	};

	const columns: TableProps<LearnerCatalogCourse>['columns'] = [
		{
			title: 'Mã môn',
			dataIndex: 'courseCode',
			key: 'courseCode',
			width: 120,
			render: (value: string) => (
				<span className="font-semibold text-on-surface">{value}</span>
			),
		},
		{
			title: 'Môn học',
			key: 'name',
			render: (_value, record) => (
				<div className="space-y-1">
					<div className="font-semibold text-on-surface">
						{record.name.vi || record.name.en || record.courseCode}
					</div>
					{record.name.en && record.name.vi && (
						<div className="font-label-sm font-label-sm text-on-surface-variant">
							{record.name.en}
						</div>
					)}
				</div>
			),
		},
		{
			title: 'Tín chỉ',
			dataIndex: 'credits',
			key: 'credits',
			width: 90,
			align: 'center',
			render: (value: number | null) => value ?? <Dash />,
		},
		{
			title: 'Khoa',
			dataIndex: 'facultyCode',
			key: 'facultyCode',
			width: 90,
			render: (value: string | null) => value || <Dash />,
		},
		{
			title: 'Đề cương',
			dataIndex: 'latestVersion',
			key: 'latestVersion',
			width: 100,
			render: (value: string) => (
				<span className="text-on-surface-variant">v{value}</span>
			),
		},
		{
			title: 'Ghi danh',
			key: 'myEnrollment',
			width: 140,
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
			width: 150,
			align: 'right',
			render: (_value, record) => (
				<IOutLinedBtn
					size="small"
					mode="primary"
					loading={openingCode === record.courseCode}
					disabled={openingCode !== null && openingCode !== record.courseCode}
					onClick={() => void openCourse(record)}
				>
					{record.myEnrollment ? 'Vào học' : 'Xem khoá học'}
				</IOutLinedBtn>
			),
		},
	];

	return (
		<div
			className={embedded ? 'space-y-space-lg' : 'space-y-space-lg p-gutter'}
		>
			<div className="flex flex-wrap items-center gap-space-sm">
				{!embedded && (
					<h1 className="font-headline-lg font-headline-lg text-on-surface">
						Danh sách khoá học
					</h1>
				)}
				<Badge status="neutral" size="md">
					{meta?.itemCount ?? 0} môn học
				</Badge>
				{embedded && (
					<span className="font-body-sm font-body-sm text-on-surface-variant">
						Toàn bộ môn học theo đề cương của trường; bài học và bài tập được AI
						soạn từ đề cương khi bạn mở tới.
					</span>
				)}
			</div>

			{!embedded && (
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Toàn bộ môn học theo đề cương của trường. Chọn một môn để xem và đăng
					ký; bài học và bài tập được AI soạn từ đề cương khi bạn mở tới.
				</p>
			)}

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

			<Input
				allowClear
				size="large"
				className="max-w-xl"
				placeholder="Tìm theo mã môn hoặc tên môn (tiếng Việt/Anh)..."
				prefix={<Icon name="search" size={18} className="text-outline" />}
				value={keyword}
				onChange={(event) => {
					setKeyword(event.target.value);
					setPage(1);
				}}
			/>

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<LearnerCatalogCourse>
					columns={columns}
					dataSource={rows}
					rowKey="courseCode"
					loading={isLoading}
					pagination={{
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

export default CatalogCourseList;
