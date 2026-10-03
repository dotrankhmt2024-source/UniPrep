import { useCallback, useEffect, useState } from 'react';
import { Alert, Input, Modal, Select, message, type TableProps } from 'antd';
import dayjs from 'dayjs';
import { getUsers, updateUserRole, updateUserStatus } from '@/apis/user';
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
import { useAppSelector } from '@/store/hooks';
import { USER_ROLE_LABEL, USER_STATUS_LABEL } from '@/types';
import type {
	PageMetaDto,
	PageOrder,
	UserListItem,
	UserRole,
	UserSortField,
	UserStatus,
} from '@/types';
import { getRoleBadgeTone, getStatusBadgeTone } from '@/utils/user';

/**
 * Trang quản lý người dùng (E2-T5) — **chỉ admin**, route `/admin/users`.
 *
 * Phân trang / tìm kiếm / lọc đều gọi API thật (`GET /api/users`), không lọc trên mảng đã tải:
 * bảng có thể có hàng nghìn người dùng nên lọc phía client sẽ chỉ đúng với trang đang xem.
 *
 * Hai thao tác nguy hiểm (đổi vai trò, khoá/mở tài khoản) đều phải **xác nhận** trước khi gọi API
 * vì cả hai đều thu hồi mọi phiên đăng nhập của người bị tác động. Hàng của chính admin đang đăng
 * nhập bị khoá nút (backend trả 400 cho hai trường hợp đó) — vẫn hiển thị lỗi tiếng Việt của backend
 * nếu vì lý do nào đó request lọt qua.
 */
const DEFAULT_TAKE = 20;

const ROLE_OPTIONS = (Object.keys(USER_ROLE_LABEL) as UserRole[]).map(
	(role) => ({ value: role, label: USER_ROLE_LABEL[role] }),
);

const STATUS_OPTIONS = (Object.keys(USER_STATUS_LABEL) as UserStatus[]).map(
	(status) => ({ value: status, label: USER_STATUS_LABEL[status] }),
);

const SORT_OPTIONS: { value: UserSortField; label: string }[] = [
	{ value: 'createdAt', label: 'Ngày tạo' },
	{ value: 'fullName', label: 'Họ và tên' },
	{ value: 'email', label: 'Email' },
];

const ORDER_OPTIONS: { value: PageOrder; label: string }[] = [
	{ value: 'desc', label: 'Giảm dần' },
	{ value: 'asc', label: 'Tăng dần' },
];

const AdminUsersPage = () => {
	const currentUserId = useAppSelector((state) => state.auth.user?.id);

	const [keyword, setKeyword] = useState('');
	// Tìm kiếm gõ tới đâu gọi API tới đó sẽ bắn một request cho mỗi ký tự — chờ 400ms mới chốt.
	const debouncedKeyword = useDebounce(keyword, 400);
	const [role, setRole] = useState<UserRole | undefined>(undefined);
	const [status, setStatus] = useState<UserStatus | undefined>(undefined);
	const [sortBy, setSortBy] = useState<UserSortField>('createdAt');
	const [order, setOrder] = useState<PageOrder>('desc');
	const [page, setPage] = useState(1);
	const [take, setTake] = useState(DEFAULT_TAKE);

	const [rows, setRows] = useState<UserListItem[]>([]);
	const [meta, setMeta] = useState<PageMetaDto | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);

	const [roleTarget, setRoleTarget] = useState<UserListItem | null>(null);
	const [nextRole, setNextRole] = useState<UserRole>('student');
	const [statusTarget, setStatusTarget] = useState<UserListItem | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	/** Nạp lại đúng trang/bộ lọc đang xem sau mỗi thao tác ghi. */
	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	useEffect(() => {
		// Cờ `cancelled`: gõ nhanh trong ô tìm kiếm làm nhiều request chồng nhau, chỉ request cuối
		// được ghi vào state — nếu không, kết quả cũ về muộn sẽ đè kết quả mới.
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			setLoadError('');

			try {
				const response = await getUsers({
					page,
					take,
					search: debouncedKeyword.trim() || undefined,
					role,
					status,
					sortBy,
					order,
				});

				if (cancelled) return;

				setRows(response.data?.items ?? []);
				setMeta(response.data?.meta ?? null);
			} catch (error) {
				if (cancelled) return;

				setRows([]);
				setMeta(null);
				setLoadError(
					getApiErrorMessage(error, 'Không tải được danh sách người dùng.'),
				);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [page, take, debouncedKeyword, role, status, sortBy, order, reloadKey]);

	// Đổi từ khoá/bộ lọc thì quay về trang 1: trang 4 của kết quả cũ có thể không còn bản ghi nào.
	const handleKeywordChange = (value: string) => {
		setKeyword(value);
		setPage(1);
	};

	const handleRoleFilterChange = (value: UserRole | undefined) => {
		setRole(value);
		setPage(1);
	};

	const handleStatusFilterChange = (value: UserStatus | undefined) => {
		setStatus(value);
		setPage(1);
	};

	const handleSortByChange = (value: UserSortField) => {
		setSortBy(value);
		setPage(1);
	};

	const handleOrderChange = (value: PageOrder) => {
		setOrder(value);
		setPage(1);
	};

	const openRoleModal = (record: UserListItem) => {
		setRoleTarget(record);
		setNextRole(record.role);
	};

	const handleConfirmRole = async () => {
		if (!roleTarget) return;

		setIsSubmitting(true);
		try {
			const response = await updateUserRole(roleTarget.id, {
				role: nextRole,
			});
			message.success(response.message || 'Cập nhật vai trò thành công');
			setRoleTarget(null);
			reload();
		} catch (error) {
			// 400 (vai trò không hợp lệ / tự hạ chính mình) và 404 đều kèm câu tiếng Việt.
			message.error(
				getApiErrorMessage(
					error,
					'Cập nhật vai trò thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	/** Đang hoạt động → khoá tạm; mọi trạng thái khác → mở lại (về `active`). */
	const nextStatus: UserStatus =
		statusTarget?.status === 'active' ? 'suspended' : 'active';
	const isUnlocking = nextStatus === 'active';

	const handleConfirmStatus = async () => {
		if (!statusTarget) return;

		setIsSubmitting(true);
		try {
			const response = await updateUserStatus(statusTarget.id, {
				status: nextStatus,
			});
			message.success(
				response.message || 'Cập nhật trạng thái tài khoản thành công',
			);
			setStatusTarget(null);
			reload();
		} catch (error) {
			message.error(
				getApiErrorMessage(
					error,
					'Cập nhật trạng thái tài khoản thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const columns: TableProps<UserListItem>['columns'] = [
		{
			title: 'Người dùng',
			dataIndex: 'fullName',
			key: 'fullName',
			render: (_value, record) => (
				<div className="space-y-1">
					<div className="font-semibold text-on-surface">{record.fullName}</div>
					<div className="font-label-sm font-label-sm text-on-surface-variant">
						{record.email}
					</div>
				</div>
			),
		},
		{
			title: 'Mã sinh viên',
			dataIndex: 'studentCode',
			key: 'studentCode',
			width: 150,
			render: (value: string | null) =>
				value || <span className="text-on-surface-variant">—</span>,
		},
		{
			title: 'Vai trò',
			dataIndex: 'role',
			key: 'role',
			width: 160,
			render: (value: UserRole) => (
				<Badge status={getRoleBadgeTone(value)} dot>
					{USER_ROLE_LABEL[value]}
				</Badge>
			),
		},
		{
			title: 'Trạng thái',
			dataIndex: 'status',
			key: 'status',
			width: 175,
			render: (value: UserStatus) => (
				<Badge status={getStatusBadgeTone(value)} dot>
					{USER_STATUS_LABEL[value]}
				</Badge>
			),
		},
		{
			title: 'Ngày tạo',
			dataIndex: 'createdAt',
			key: 'createdAt',
			width: 130,
			render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
		},
		{
			title: 'Thao tác',
			key: 'actions',
			width: 230,
			align: 'right',
			render: (_value, record) => {
				const isSelf = record.id === currentUserId;
				// Tự khoá chính mình là 400 chắc chắn (backend chặn), còn tự "mở khoá" thì hợp lệ.
				const isSelfLock = isSelf && record.status === 'active';
				const willUnlock = record.status !== 'active';

				return (
					<div className="flex items-center justify-end gap-space-xs">
						<IOutLinedBtn
							size="small"
							mode="primary"
							disabled={isSelf}
							title={
								isSelf
									? 'Không thể tự đổi vai trò của chính mình'
									: 'Đổi vai trò người dùng'
							}
							onClick={() => openRoleModal(record)}
						>
							Đổi vai trò
						</IOutLinedBtn>

						<IOutLinedBtn
							size="small"
							mode={willUnlock ? 'default' : 'error'}
							disabled={isSelfLock}
							title={
								isSelfLock
									? 'Không thể tự khoá tài khoản của chính mình'
									: undefined
							}
							onClick={() => setStatusTarget(record)}
						>
							{willUnlock ? 'Mở khoá' : 'Khoá'}
						</IOutLinedBtn>
					</div>
				);
			},
		},
	];

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Quản lý người dùng
				</h1>
				<Badge status="neutral" size="md">
					{meta?.itemCount ?? 0} người dùng
				</Badge>
			</div>

			{loadError && (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{loadError}
				</ErrorBadge>
			)}

			<div className="grid grid-cols-1 gap-space-sm md:grid-cols-2 xl:grid-cols-4">
				<Input
					allowClear
					size="large"
					placeholder="Tìm theo email, họ tên hoặc mã sinh viên..."
					prefix={<Icon name="search" size={18} className="text-outline" />}
					value={keyword}
					onChange={(event) => handleKeywordChange(event.target.value)}
				/>

				<Select<UserRole>
					allowClear
					size="large"
					placeholder="Vai trò"
					options={ROLE_OPTIONS}
					value={role}
					onChange={handleRoleFilterChange}
				/>

				<Select<UserStatus>
					allowClear
					size="large"
					placeholder="Trạng thái"
					options={STATUS_OPTIONS}
					value={status}
					onChange={handleStatusFilterChange}
				/>

				<div className="flex gap-space-sm">
					<Select<UserSortField>
						size="large"
						className="flex-1"
						options={SORT_OPTIONS}
						value={sortBy}
						onChange={handleSortByChange}
					/>
					<Select<PageOrder>
						size="large"
						className="w-32"
						options={ORDER_OPTIONS}
						value={order}
						onChange={handleOrderChange}
					/>
				</div>
			</div>

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<UserListItem>
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

			<Modal
				open={!!roleTarget}
				title="Đổi vai trò người dùng"
				footer={null}
				onCancel={() => setRoleTarget(null)}
			>
				<div className="space-y-space-md pt-space-sm">
					<p className="font-body-md font-body-md text-on-surface">
						{roleTarget?.fullName}{' '}
						<span className="text-on-surface-variant">
							({roleTarget?.email})
						</span>
					</p>

					<div className="space-y-space-xs">
						<span className="font-label-md font-label-md text-on-surface-variant">
							Vai trò mới
						</span>
						<Select<UserRole>
							size="large"
							className="w-full"
							options={ROLE_OPTIONS}
							value={nextRole}
							onChange={setNextRole}
						/>
					</div>

					<Alert
						type="warning"
						showIcon
						message="Đổi vai trò sẽ thu hồi mọi phiên đăng nhập của người dùng này; họ phải đăng nhập lại để nhận quyền mới."
					/>

					<div className="flex justify-end gap-space-sm">
						<IOutLinedBtn onClick={() => setRoleTarget(null)}>
							Huỷ bỏ
						</IOutLinedBtn>
						<ISolidBtn
							background="error"
							loading={isSubmitting}
							disabled={nextRole === roleTarget?.role}
							onClick={handleConfirmRole}
						>
							Xác nhận đổi vai trò
						</ISolidBtn>
					</div>
				</div>
			</Modal>

			<Modal
				open={!!statusTarget}
				title={isUnlocking ? 'Mở khoá tài khoản' : 'Khoá tài khoản'}
				footer={null}
				onCancel={() => setStatusTarget(null)}
			>
				<div className="space-y-space-md pt-space-sm">
					<p className="font-body-md font-body-md text-on-surface">
						{statusTarget?.fullName}{' '}
						<span className="text-on-surface-variant">
							({statusTarget?.email})
						</span>
					</p>

					<Alert
						type={isUnlocking ? 'info' : 'error'}
						showIcon
						message={
							isUnlocking
								? 'Tài khoản sẽ được mở lại ở trạng thái "Đang hoạt động".'
								: 'Tài khoản sẽ bị tạm khoá và mọi phiên đăng nhập bị thu hồi ngay lập tức.'
						}
					/>

					<div className="flex justify-end gap-space-sm">
						<IOutLinedBtn onClick={() => setStatusTarget(null)}>
							Huỷ bỏ
						</IOutLinedBtn>

						{isUnlocking ? (
							<ISolidBtn
								type="primary"
								loading={isSubmitting}
								onClick={handleConfirmStatus}
							>
								Mở khoá tài khoản
							</ISolidBtn>
						) : (
							<ISolidBtn
								background="error"
								loading={isSubmitting}
								onClick={handleConfirmStatus}
							>
								Khoá tài khoản
							</ISolidBtn>
						)}
					</div>
				</div>
			</Modal>
		</div>
	);
};

export default AdminUsersPage;
