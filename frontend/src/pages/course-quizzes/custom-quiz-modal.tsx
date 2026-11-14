import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Button,
	Modal,
	Progress,
	Select,
	Skeleton,
	Space,
	Table,
	Tag,
	message,
	type TableProps,
} from 'antd';
import { useNavigate } from 'react-router';
import { createCustomQuiz, getQuizScope } from '@/apis/catalog-learning';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type { QuizScope } from '@/types';

/** Khớp `CUSTOM_QUIZ_MAX_LESSONS` ở backend. */
const MAX_LESSONS = 40;
const QUESTION_OPTIONS = [5, 10, 15, 20].map((value) => ({
	value,
	label: `${value} câu`,
}));

interface ScopeRow {
	key: string;
	kind: 'section' | 'lesson';
	title: string;
	completed?: boolean;
	hasContent?: boolean;
	lessonCount?: number;
	completedCount?: number;
	children?: ScopeRow[];
}

export interface CustomQuizModalProps {
	courseId: string;
	open: boolean;
	onClose: () => void;
}

/**
 * Tạo "quiz theo tiến độ": bảng mọi bài của khoá (nhóm theo chương), **tự chọn sẵn các bài học
 * viên đã hoàn thành**; học viên chỉnh lại rồi AI ra đề chỉ từ các bài đã chọn. Quiz tạo ra là quiz
 * cá nhân — chỉ người tạo thấy — và mở ngay trang làm bài.
 */
const CustomQuizModal = ({ courseId, open, onClose }: CustomQuizModalProps) => {
	const navigate = useNavigate();
	const [scope, setScope] = useState<QuizScope | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [selected, setSelected] = useState<string[]>([]);
	const [questionCount, setQuestionCount] = useState(10);
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setLoading(true);
		setLoadError('');
		void getQuizScope(courseId)
			.then((res) => {
				if (cancelled || !res.data) return;
				setScope(res.data);
				setSelected(
					res.data.sections.flatMap((section) =>
						section.lessons
							.filter((lesson) => lesson.completed)
							.map((lesson) => lesson.id),
					),
				);
			})
			.catch((error) => {
				if (!cancelled)
					setLoadError(
						getApiErrorMessage(error, 'Không tải được danh sách bài.'),
					);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [courseId, open]);

	const lessonIds = useMemo(
		() =>
			new Set(
				scope?.sections.flatMap((section) =>
					section.lessons.map((lesson) => lesson.id),
				) ?? [],
			),
		[scope],
	);
	const completedIds = useMemo(
		() =>
			scope?.sections.flatMap((section) =>
				section.lessons.filter((l) => l.completed).map((l) => l.id),
			) ?? [],
		[scope],
	);

	const rows: ScopeRow[] = useMemo(
		() =>
			scope?.sections.map((section) => ({
				key: `section:${section.id}`,
				kind: 'section',
				title: section.title,
				lessonCount: section.lessons.length,
				completedCount: section.lessons.filter((l) => l.completed).length,
				children: section.lessons.map((lesson) => ({
					key: lesson.id,
					kind: 'lesson',
					title: lesson.title,
					completed: lesson.completed,
					hasContent: lesson.hasContent,
				})),
			})) ?? [],
		[scope],
	);

	const selectedLessons = selected.filter((id) => lessonIds.has(id));
	const tooMany = selectedLessons.length > MAX_LESSONS;
	const percent = scope?.totalLessons
		? Math.round((scope.completedLessons / scope.totalLessons) * 100)
		: 0;

	const columns: TableProps<ScopeRow>['columns'] = [
		{
			title: 'Chương / bài học',
			dataIndex: 'title',
			key: 'title',
			render: (value: string, row) =>
				row.kind === 'section' ? (
					<span className="font-semibold text-on-surface">
						{value}{' '}
						<span className="font-body-sm font-normal text-on-surface-variant">
							({row.completedCount}/{row.lessonCount} bài đã học)
						</span>
					</span>
				) : (
					<span className="text-on-surface">{value}</span>
				),
		},
		{
			title: 'Tiến độ',
			key: 'completed',
			width: 120,
			render: (_value, row) =>
				row.kind === 'lesson' ? (
					row.completed ? (
						<Tag color="success">Đã học</Tag>
					) : (
						<Tag>Chưa học</Tag>
					)
				) : null,
		},
		{
			title: 'Nội dung',
			key: 'content',
			width: 150,
			render: (_value, row) =>
				row.kind === 'lesson' ? (
					row.hasContent ? (
						<span className="font-body-sm text-on-surface-variant">
							Đã có bài
						</span>
					) : (
						<span
							className="font-body-sm text-on-surface-variant"
							title="Bài chưa được mở nên chưa có nội dung — AI ra câu hỏi dựa trên tên bài."
						>
							Chỉ có tên bài
						</span>
					)
				) : null,
		},
	];

	const submit = async () => {
		if (!selectedLessons.length || tooMany) return;
		setCreating(true);
		try {
			const res = await createCustomQuiz(courseId, {
				lessonIds: selectedLessons,
				questionCount,
			});
			if (res.data?.quizId) {
				message.success('Đã tạo quiz theo tiến độ');
				navigate(`/quizzes/${res.data.quizId}`);
			}
		} catch (error) {
			message.error(
				getApiErrorMessage(error, 'Chưa tạo được quiz, thử lại sau.'),
			);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Modal
			open={open}
			title="Tạo quiz theo tiến độ"
			width={820}
			destroyOnHidden
			maskClosable={!creating}
			closable={!creating}
			onCancel={() => !creating && onClose()}
			footer={
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="font-body-sm text-on-surface-variant">
						Đã chọn <b>{selectedLessons.length}</b> bài
						{tooMany && ` — tối đa ${MAX_LESSONS} bài`}
					</span>
					<Space>
						<Button disabled={creating} onClick={onClose}>
							Huỷ
						</Button>
						<Button
							type="primary"
							loading={creating}
							disabled={!selectedLessons.length || tooMany || loading}
							onClick={() => void submit()}
						>
							{creating ? 'AI đang ra đề… (10–40 giây)' : 'Tạo quiz'}
						</Button>
					</Space>
				</div>
			}
		>
			{loading ? (
				<Skeleton active />
			) : loadError ? (
				<Alert type="error" showIcon message={loadError} />
			) : scope ? (
				<div className="space-y-space-md">
					<div className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
						<p className="font-body-md text-on-surface">
							Đây là tiến độ của bạn: đã học{' '}
							<b>
								{scope.completedLessons}/{scope.totalLessons}
							</b>{' '}
							bài. Chọn phần nội dung nằm trong quiz này.
						</p>
						<Progress percent={percent} size="small" className="!mb-0" />
						<p className="mt-1 font-body-sm text-on-surface-variant">
							Các bài đã học được chọn sẵn; bạn có thể thêm bài muốn ôn trước
							hoặc bỏ bài đã nắm chắc.
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2">
						<Space wrap>
							<Button size="small" onClick={() => setSelected(completedIds)}>
								Chọn bài đã học
							</Button>
							<Button size="small" onClick={() => setSelected([...lessonIds])}>
								Chọn tất cả
							</Button>
							<Button size="small" onClick={() => setSelected([])}>
								Bỏ chọn
							</Button>
						</Space>
						<Space>
							<span className="font-body-sm text-on-surface-variant">
								Số câu
							</span>
							<Select
								size="small"
								style={{ width: 100 }}
								value={questionCount}
								options={QUESTION_OPTIONS}
								onChange={setQuestionCount}
							/>
						</Space>
					</div>

					<Table<ScopeRow>
						size="small"
						rowKey="key"
						columns={columns}
						dataSource={rows}
						pagination={false}
						scroll={{ y: 360 }}
						expandable={{ defaultExpandAllRows: true }}
						rowSelection={{
							checkStrictly: false,
							selectedRowKeys: selected,
							onChange: (keys) =>
								setSelected(
									keys.map(String).filter((key) => !key.startsWith('section:')),
								),
						}}
					/>
				</div>
			) : null}
		</Modal>
	);
};

export default CustomQuizModal;
