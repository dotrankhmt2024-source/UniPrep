import { useEffect, useState } from 'react';
import { Form, Modal, Select, type TableProps } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getStudents } from '@/apis/student';
import type { Student } from '@/types';
import { Badge, ErrorBadge, FormItem, Icon, ITable, ISolidBtn, IOutLinedBtn } from '@/components';

/**
 * Reference module page — the pattern every future module should follow:
 *
 *   apis/<feature>  ->  types/<feature>  ->  pages/<feature>  (UI lấy từ components/ dùng chung)
 *
 * The page composes shared components only: `ITable` for the list, `Badge` for statuses,
 * `ErrorBadge` for errors, `FormItem` + antd `Form`/`Modal` for the create form.
 * It never renders its own header/sidebar — `layouts/private` owns those.
 */
const MOCK_STUDENTS: Student[] = [
	{
		id: 'mock-1',
		fullName: 'Nguyễn Văn An',
		studentCode: 'SV2026001',
		email: 'an.nv2026001@uniprep.edu.vn',
		major: 'Khoa học Máy tính',
		isActive: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: 'mock-2',
		fullName: 'Trần Thị Bích',
		studentCode: 'SV2026002',
		email: 'bich.tt2026002@uniprep.edu.vn',
		major: 'Kỹ thuật Phần mềm',
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
];

interface StudentFormValues {
	studentCode: string;
	fullName: string;
	email: string;
	major: string;
}

const StudentPage = () => {
	const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [form] = Form.useForm<StudentFormValues>();

	const loadStudents = () => {
		setIsLoading(true);
		getStudents()
			.then((res) => {
				if (res.data) setStudents(res.data);
				setErrorMessage(null);
			})
			.catch(() => {
				setErrorMessage('Không kết nối được backend, đang hiển thị dữ liệu mẫu.');
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		loadStudents();
	}, []);

	const columns: TableProps<Student>['columns'] = [
		{
			title: 'Mã SV',
			dataIndex: 'studentCode',
			key: 'studentCode',
			render: (value: string) => <span className="font-semibold text-on-surface">{value}</span>,
		},
		{ title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
		{ title: 'Email', dataIndex: 'email', key: 'email' },
		{
			title: 'Ngành',
			dataIndex: 'major',
			key: 'major',
			render: (value: string | null | undefined) => value || '-',
		},
		{
			title: 'Trạng thái',
			dataIndex: 'isActive',
			key: 'isActive',
			align: 'right',
			render: (isActive: boolean) => (
				<Badge status={isActive ? 'success' : 'neutral'} dot>
					{isActive ? 'Đang học' : 'Ngưng học'}
				</Badge>
			),
		},
	];

	return (
		<div className="p-gutter space-y-space-lg">
			<div className="flex flex-col justify-between gap-space-md md:flex-row md:items-center">
				<div>
					<h1 className="font-headline-lg font-headline-lg text-on-surface">Sinh viên (module mẫu)</h1>
					<p className="mt-1 font-body-md font-body-md text-on-surface-variant">
						Trang minh hoạ luồng chuẩn: <code className="text-secondary">apis/student</code> →{' '}
						<code className="text-secondary">types/student</code> → <code className="text-secondary">pages/student</code>, UI dùng bộ
						component chung trong <code className="text-secondary">components/</code>.
					</p>
				</div>
				<div className="flex items-center gap-space-sm">
					<IOutLinedBtn icon={<ReloadOutlined />} onClick={loadStudents}>
						Tải lại
					</IOutLinedBtn>
					<ISolidBtn icon={<PlusOutlined />} onClick={() => setIsFormOpen(true)}>
						Thêm sinh viên
					</ISolidBtn>
				</div>
			</div>

			{errorMessage && (
				<div className="flex items-center gap-space-sm rounded-lg border border-error/30 bg-error-container/40 p-space-md">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{errorMessage}
					</ErrorBadge>
				</div>
			)}

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<Student>
					columns={columns}
					dataSource={students}
					loading={isLoading}
					pagination={false}
					rowKey="id"
				/>
			</div>

			<Modal
				open={isFormOpen}
				title="Thêm sinh viên"
				okText="Lưu"
				cancelText="Hủy bỏ"
				centered
				onCancel={() => setIsFormOpen(false)}
				onOk={() => {
					form.resetFields();
					setIsFormOpen(false);
				}}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" requiredMark="optional" className="pt-space-sm">
					<FormItem
						formItemProps={{ label: 'Mã sinh viên', name: 'studentCode' }}
						rules={[{ required: true, message: 'Mã sinh viên không được để trống' }]}
						inputProps={{ placeholder: 'vd: SV2026003' }}
					/>
					<FormItem
						formItemProps={{ label: 'Họ và tên', name: 'fullName' }}
						rules={[{ required: true, message: 'Họ và tên không được để trống' }]}
						inputProps={{ placeholder: 'vd: Nguyễn Văn An' }}
					/>
					<FormItem
						formItemProps={{ label: 'Email', name: 'email' }}
						rules={[
							{ required: true, message: 'Email không được để trống' },
							{ type: 'email', message: 'Email không hợp lệ' },
						]}
						inputProps={{ placeholder: 'vd: an.nv@uniprep.edu.vn' }}
					/>
					<FormItem formItemProps={{ label: 'Ngành', name: 'major' }}>
						<Select
							size="large"
							placeholder="Chọn ngành"
							options={[
								{ value: 'Khoa học Máy tính', label: 'Khoa học Máy tính' },
								{ value: 'Kỹ thuật Phần mềm', label: 'Kỹ thuật Phần mềm' },
								{ value: 'Hệ thống Thông tin', label: 'Hệ thống Thông tin' },
							]}
						/>
					</FormItem>
				</Form>
			</Modal>
		</div>
	);
};

export default StudentPage;
