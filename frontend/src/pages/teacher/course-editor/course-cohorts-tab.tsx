import { useCallback, useEffect, useState } from 'react';
import { DatePicker, Form, Modal, message, type TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
	createCohort,
	deleteCohort,
	getCohorts,
	updateCohort,
} from '@/apis/course';
import {
	ErrorBadge,
	FormItem,
	Icon,
	IOutLinedBtn,
	ISolidBtn,
	ITable,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type { CohortItem, CreateCohortPayload } from '@/types';

/**
 * Tab "Lớp học" của trang soạn thảo (E3-T9).
 *
 * Danh sách lớp (`getCohorts`) là endpoint trả **mảng phẳng** `{ items }` không phân trang — một
 * khoá học có vài lớp, không phải vài nghìn, nên bảng dùng `pagination={false}` như thiết kế.
 *
 * Ba thao tác ghi nằm ở hai endpoint khác nhau: `POST /api/courses/:id/cohorts` để tạo (lớp thuộc
 * khoá) và `PATCH|DELETE /api/cohorts/:id` để sửa/xoá (lớp đã có id riêng). Trùng `classCode`
 * trong cùng khoá trả `409` kèm câu tiếng Việt — hiện nguyên văn.
 *
 * `startsOn`/`endsOn` gửi dạng `YYYY-MM-DD` (`DatePicker` mặc định) đúng kiểu `@IsDateString` của
 * backend; `dayjs` chỉ dùng để hiển thị và để so sánh khoảng ngày ngay ở client.
 */
export interface CourseCohortsTabProps {
	courseId: string;
	/** Gọi sau mỗi lần ghi để trang cha nạp lại chi tiết khoá học. */
	onChanged: () => void;
}

interface CohortFormValues {
	name: string;
	classCode?: string;
	groupCode?: string;
	semester?: string;
	startsOn?: Dayjs;
	endsOn?: Dayjs;
}

const CourseCohortsTab = ({ courseId, onChanged }: CourseCohortsTabProps) => {
	const [cohortForm] = Form.useForm<CohortFormValues>();

	const [rows, setRows] = useState<CohortItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);

	/** `null` = modal đóng; `'create'` = tạo mới; một `CohortItem` = đang sửa lớp đó. */
	const [editing, setEditing] = useState<CohortItem | 'create' | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [modalError, setModalError] = useState('');
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const reload = () => setReloadKey((value) => value + 1);

	const load = useCallback(async () => {
		setIsLoading(true);
		setLoadError('');

		try {
			const response = await getCohorts(courseId);
			setRows(response.data?.items ?? []);
		} catch (error) {
			setRows([]);
			setLoadError(getApiErrorMessage(error, 'Không tải được danh sách lớp.'));
		} finally {
			setIsLoading(false);
		}
	}, [courseId]);

	useEffect(() => {
		void load();
	}, [load, reloadKey]);

	const openCreate = () => {
		setModalError('');
		setEditing('create');
	};

	const openEdit = (cohort: CohortItem) => {
		setModalError('');
		setEditing(cohort);
	};

	// Nạp giá trị vào form khi form đã mount: modal dùng `destroyOnHidden` nên `<Form>` chỉ tồn tại
	// lúc modal mở — gọi `setFieldsValue` trước đó sẽ bị antd cảnh báo "not connected".
	useEffect(() => {
		if (!editing) return;

		cohortForm.resetFields();

		if (editing !== 'create') {
			cohortForm.setFieldsValue({
				name: editing.name,
				classCode: editing.classCode ?? undefined,
				groupCode: editing.groupCode ?? undefined,
				semester: editing.semester ?? undefined,
				startsOn: editing.startsOn ? dayjs(editing.startsOn) : undefined,
				endsOn: editing.endsOn ? dayjs(editing.endsOn) : undefined,
			});
		}
	}, [editing, cohortForm]);

	const handleSubmit = async (values: CohortFormValues) => {
		const payload: CreateCohortPayload = {
			name: values.name.trim(),
			classCode: values.classCode?.trim() || null,
			groupCode: values.groupCode?.trim() || null,
			semester: values.semester?.trim() || null,
			startsOn: values.startsOn ? values.startsOn.format('YYYY-MM-DD') : null,
			endsOn: values.endsOn ? values.endsOn.format('YYYY-MM-DD') : null,
		};

		setIsSubmitting(true);
		setModalError('');

		try {
			if (editing === 'create') {
				const response = await createCohort(courseId, payload);
				message.success(response.message || 'Tạo lớp học thành công');
			} else if (editing) {
				const response = await updateCohort(editing.id, payload);
				message.success(response.message || 'Cập nhật lớp học thành công');
			}

			setEditing(null);
			reload();
			onChanged();
		} catch (error) {
			// 409 (trùng `classCode`) và 400 (`endsOn` trước `startsOn`) kèm câu tiếng Việt.
			setModalError(
				getApiErrorMessage(error, 'Lưu lớp học thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = (cohort: CohortItem) => {
		Modal.confirm({
			title: 'Xoá lớp học',
			content: `Xoá lớp "${cohort.classCode ? `${cohort.classCode} — ` : ''}${cohort.name}"? Ghi danh và phân công giảng viên của lớp vẫn được giữ lại.`,
			okText: 'Xoá lớp',
			cancelText: 'Huỷ bỏ',
			okButtonProps: { danger: true },
			onOk: async () => {
				setDeletingId(cohort.id);
				try {
					const response = await deleteCohort(cohort.id);
					message.success(response.message || 'Xoá lớp học thành công');
					reload();
					onChanged();
				} catch (error) {
					message.error(
						getApiErrorMessage(
							error,
							'Xoá lớp học thất bại, vui lòng thử lại.',
						),
					);
				} finally {
					setDeletingId(null);
				}
			},
		});
	};

	const columns: TableProps<CohortItem>['columns'] = [
		{
			title: 'Mã nhóm',
			dataIndex: 'groupCode',
			key: 'groupCode',
			width: 130,
			render: (value: string | null) =>
				value || <span className="text-on-surface-variant">—</span>,
		},
		{
			title: 'Mã lớp',
			dataIndex: 'classCode',
			key: 'classCode',
			width: 130,
			render: (value: string | null) =>
				value || <span className="text-on-surface-variant">—</span>,
		},
		{
			title: 'Tên lớp',
			dataIndex: 'name',
			key: 'name',
			render: (value: string) => (
				<span className="font-semibold text-on-surface">{value}</span>
			),
		},
		{
			title: 'Học kỳ',
			dataIndex: 'semester',
			key: 'semester',
			width: 140,
			render: (value: string | null) =>
				value || <span className="text-on-surface-variant">—</span>,
		},
		{
			title: 'Bắt đầu',
			dataIndex: 'startsOn',
			key: 'startsOn',
			width: 130,
			render: (value: string | null) =>
				value ? (
					dayjs(value).format('DD/MM/YYYY')
				) : (
					<span className="text-on-surface-variant">—</span>
				),
		},
		{
			title: 'Kết thúc',
			dataIndex: 'endsOn',
			key: 'endsOn',
			width: 130,
			render: (value: string | null) =>
				value ? (
					dayjs(value).format('DD/MM/YYYY')
				) : (
					<span className="text-on-surface-variant">—</span>
				),
		},
		{
			title: 'Sĩ số',
			dataIndex: 'memberCount',
			key: 'memberCount',
			width: 100,
			align: 'center',
		},
		{
			title: 'Thao tác',
			key: 'actions',
			width: 170,
			align: 'right',
			render: (_value, record) => (
				<div className="flex items-center justify-end gap-space-xs">
					<IOutLinedBtn
						size="small"
						mode="primary"
						onClick={() => openEdit(record)}
					>
						Sửa
					</IOutLinedBtn>
					<IOutLinedBtn
						size="small"
						mode="error"
						loading={deletingId === record.id}
						onClick={() => handleDelete(record)}
					>
						Xoá
					</IOutLinedBtn>
				</div>
			),
		},
	];

	const isCreate = editing === 'create';

	return (
		<div className="space-y-space-md">
			<div className="flex flex-wrap items-center justify-between gap-space-sm">
				<div className="space-y-1">
					<h2 className="font-title-lg font-title-lg text-on-surface">
						Lớp học
					</h2>
					<p className="font-body-sm font-body-sm text-on-surface-variant">
						Lớp/nhóm học viên của khoá. Lớp là phạm vi để ghi danh và để giới
						hạn phân công giảng viên.
					</p>
				</div>

				<ISolidBtn
					type="primary"
					background="primary"
					icon={<Icon name="add" size={18} />}
					onClick={openCreate}
				>
					Thêm lớp
				</ISolidBtn>
			</div>

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

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<CohortItem>
					columns={columns}
					dataSource={rows}
					rowKey="id"
					loading={isLoading}
					pagination={false}
				/>
			</div>

			<Modal
				open={!!editing}
				title={isCreate ? 'Thêm lớp học' : 'Sửa lớp học'}
				footer={null}
				destroyOnHidden
				onCancel={() => setEditing(null)}
			>
				<Form<CohortFormValues>
					form={cohortForm}
					layout="vertical"
					requiredMark={false}
					onFinish={handleSubmit}
					className="pt-space-sm"
				>
					{modalError && (
						<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
							{modalError}
						</ErrorBadge>
					)}

					<FormItem
						formItemProps={{ label: 'Tên lớp', name: 'name' }}
						inputProps={{ placeholder: 'Lớp K67-CS1' }}
						rules={[
							{ required: true, message: 'Tên lớp không được để trống' },
							{ max: 150, message: 'Tên lớp tối đa 150 ký tự' },
						]}
					/>

					<div className="grid grid-cols-1 gap-x-space-md md:grid-cols-2">
						<FormItem
							formItemProps={{ label: 'Mã lớp', name: 'classCode' }}
							inputProps={{ placeholder: 'L01' }}
							rules={[{ max: 50, message: 'Mã lớp tối đa 50 ký tự' }]}
						/>

						<FormItem
							formItemProps={{ label: 'Mã nhóm', name: 'groupCode' }}
							inputProps={{ placeholder: 'CQ_HK261' }}
							rules={[{ max: 50, message: 'Mã nhóm tối đa 50 ký tự' }]}
						/>
					</div>

					<FormItem
						formItemProps={{ label: 'Học kỳ', name: 'semester' }}
						inputProps={{ placeholder: '1/2026-2027' }}
						rules={[{ max: 20, message: 'Học kỳ tối đa 20 ký tự' }]}
					/>

					<div className="grid grid-cols-1 gap-x-space-md md:grid-cols-2">
						<FormItem
							formItemProps={{ label: 'Ngày bắt đầu', name: 'startsOn' }}
						>
							<DatePicker className="w-full" size="large" format="DD/MM/YYYY" />
						</FormItem>

						<FormItem
							formItemProps={{ label: 'Ngày kết thúc', name: 'endsOn' }}
							rules={[
								({ getFieldValue }) => ({
									validator(_rule, value: Dayjs | undefined) {
										const startsOn = getFieldValue('startsOn') as
											Dayjs | undefined;

										// Cùng quy tắc với backend (`endsOn >= startsOn`); chặn ở client
										// để không phải chờ một vòng request mới biết mình gõ sai.
										if (
											!value ||
											!startsOn ||
											!value.isBefore(startsOn, 'day')
										) {
											return Promise.resolve();
										}

										return Promise.reject(
											new Error(
												'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
											),
										);
									},
								}),
							]}
						>
							<DatePicker className="w-full" size="large" format="DD/MM/YYYY" />
						</FormItem>
					</div>

					<div className="flex justify-end gap-space-sm">
						<IOutLinedBtn onClick={() => setEditing(null)}>Huỷ bỏ</IOutLinedBtn>
						<ISolidBtn
							type="primary"
							background="primary"
							htmlType="submit"
							loading={isSubmitting}
						>
							{isCreate ? 'Thêm lớp' : 'Lưu thay đổi'}
						</ISolidBtn>
					</div>
				</Form>
			</Modal>
		</div>
	);
};

export default CourseCohortsTab;
