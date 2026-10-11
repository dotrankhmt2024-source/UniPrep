import { useMemo, useState } from 'react';
import { Input, Segmented, Select, type TableProps } from 'antd';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { MOCK_COURSES } from '@/mocks/course';
import { COURSE_STATUS_LABEL, type Course, type CourseStatus } from '@/types';
import { Badge, Icon, IconBtn, ITable } from '@/components';

type FilterKey = 'all' | CourseStatus | 'starred';

const FILTER_OPTIONS: { label: string; value: FilterKey }[] = [
	{ label: 'Tất cả', value: 'all' },
	{ label: 'Đang học', value: 'in-progress' },
	{ label: 'Sắp tới', value: 'future' },
	{ label: 'Đã kết thúc', value: 'past' },
	{ label: 'Đã gắn sao', value: 'starred' },
];

const SORT_OPTIONS = [
	{ label: 'Sắp xếp: Tên khoá học', value: 'name' },
	{ label: 'Sắp xếp: Mã môn', value: 'code' },
	{ label: 'Sắp xếp: Học kỳ', value: 'semester' },
];

/** Trang "Các khoá học của tôi" — dựng theo design/Course_list.html nhưng rút gọn tối đa. */
const CourseListPage = () => {
	const [keyword, setKeyword] = useState('');
	const [filter, setFilter] = useState<FilterKey>('all');
	const [sortBy, setSortBy] = useState('name');
	const [starred, setStarred] = useState<string[]>(
		MOCK_COURSES.filter((course) => course.starred).map((course) => course.id),
	);

	const courses = useMemo(() => {
		const normalizedKeyword = keyword.trim().toLowerCase();

		return MOCK_COURSES.filter((course) => {
			const matchesKeyword =
				!normalizedKeyword ||
				course.name.toLowerCase().includes(normalizedKeyword) ||
				course.code.toLowerCase().includes(normalizedKeyword) ||
				course.teacher.toLowerCase().includes(normalizedKeyword);

			const matchesFilter =
				filter === 'all' || (filter === 'starred' ? starred.includes(course.id) : course.status === filter);

			return matchesKeyword && matchesFilter;
		}).sort((a, b) => {
			if (sortBy === 'code') return a.code.localeCompare(b.code);
			if (sortBy === 'semester') return b.semester.localeCompare(a.semester);
			return a.name.localeCompare(b.name);
		});
	}, [keyword, filter, sortBy, starred]);

	const toggleStar = (id: string) => {
		setStarred((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
	};

	const columns: TableProps<Course>['columns'] = [
		{
			title: 'Tên khoá học',
			dataIndex: 'name',
			key: 'name',
			render: (_value, course) => (
				<div className="space-y-1">
					<Link to={`/courses/${course.id}`} className="font-semibold text-on-surface hover:text-secondary">
						{course.name}
					</Link>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-label-sm font-label-sm text-on-surface-variant">
							{course.code} • {course.group} {course.classes}
						</span>
						<Badge
							status={course.status === 'in-progress' ? 'success' : course.status === 'future' ? 'info' : 'neutral'}
							dot
						>
							{COURSE_STATUS_LABEL[course.status]}
						</Badge>
					</div>
				</div>
			),
		},
		{ title: 'Học kỳ', dataIndex: 'semester', key: 'semester', width: 140 },
		{
			title: 'Danh mục',
			dataIndex: 'category',
			key: 'category',
			render: (value: string) => <span className="text-on-surface-variant">{value}</span>,
		},
		{
			title: '',
			key: 'actions',
			width: 64,
			align: 'right',
			render: (_value, course) => (
				<IconBtn
					title={starred.includes(course.id) ? 'Bỏ gắn sao' : 'Gắn sao khoá học'}
					icon={starred.includes(course.id) ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
					onClick={() => toggleStar(course.id)}
				/>
			),
		},
	];

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">Các khoá học của tôi</h1>
				<Badge status="neutral" size="md">
					{courses.length} khoá học
				</Badge>
			</div>

			<Segmented
				options={FILTER_OPTIONS}
				value={filter}
				onChange={(value) => setFilter(value as FilterKey)}
				className="max-w-full overflow-x-auto"
			/>

			<div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
				<Input
					allowClear
					size="large"
					className="md:col-span-2"
					placeholder="Tìm khoá học theo tên, mã môn hoặc giảng viên..."
					prefix={<Icon name="search" size={18} className="text-outline" />}
					value={keyword}
					onChange={(event) => setKeyword(event.target.value)}
				/>
				<Select size="large" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
			</div>

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<Course> columns={columns} dataSource={courses} rowKey="id" pagination={false} />
			</div>
		</div>
	);
};

export default CourseListPage;
