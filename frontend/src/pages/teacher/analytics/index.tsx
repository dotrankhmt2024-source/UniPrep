import { useCallback, useEffect, useState } from 'react';
import { InputNumber, Select, Space, Spin, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { Link, useParams } from 'react-router';
import {
	getCourseDashboard,
	getCourseRisks,
	runRiskPrediction,
} from '@/apis/analytics';
import { getCourseById } from '@/apis/course';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	INTERVENTION_ACTION_LABEL,
	type CourseDashboard,
	type CourseDetail,
	type CourseRisks,
	type LearnerRisk,
} from '@/types';
import {
	ChartCard,
	LessonFunnel,
	RiskStack,
	WeeklyBars,
	WeeklyLine,
} from './charts';
import InterventionModal from './intervention-modal';
import LearnerDrawer from './learner-drawer';
import ModelDrawer from './model-drawer';
import RiskTable from './risk-table';

const OUTCOME_LABEL: Record<string, string> = {
	improved: 'Tiến bộ',
	no_change: 'Không đổi',
	worsened: 'Xấu đi',
	unknown: 'Chưa rõ',
	pending: 'Đang chờ đánh giá',
};

const Kpi = ({
	label,
	value,
	hint,
}: {
	label: string;
	value: string | number;
	hint?: string;
}) => (
	<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
		<div className="text-body-sm text-on-surface-variant">{label}</div>
		<div className="font-headline-sm font-bold text-on-surface">{value}</div>
		{hint && <div className="text-body-sm text-on-surface-variant">{hint}</div>}
	</div>
);

/**
 * Learning Analytics & cảnh báo sớm của một khoá — route `/teacher/courses/:courseId/analytics`.
 *
 * Ba khối đúng theo yêu cầu đề bài: (1) dashboard hành vi/kết quả theo thời gian, (2) danh sách học
 * viên có nguy cơ do luật ASP suy ra (hiệu chỉnh trên OULAD), (3) giải thích + hành động can thiệp do
 * ASP lập kế hoạch, giảng viên duyệt rồi gửi; kết quả can thiệp được tự chấm sau 7 ngày.
 */
const CourseAnalyticsPage = () => {
	const { courseId = '' } = useParams<{ courseId: string }>();
	const [course, setCourse] = useState<CourseDetail | null>(null);
	const [cohortId, setCohortId] = useState<string | undefined>();
	const [weeks, setWeeks] = useState(10);
	const [capacity, setCapacity] = useState(10);
	const [dashboard, setDashboard] = useState<CourseDashboard | null>(null);
	const [risks, setRisks] = useState<CourseRisks | null>(null);
	const [loading, setLoading] = useState(true);
	const [risksLoading, setRisksLoading] = useState(true);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState('');
	const [detail, setDetail] = useState<LearnerRisk | null>(null);
	const [intervene, setIntervene] = useState<LearnerRisk | null>(null);
	const [modelOpen, setModelOpen] = useState(false);

	useEffect(() => {
		void getCourseById(courseId)
			.then((res) => setCourse(res.data))
			.catch(() => setCourse(null));
	}, [courseId]);

	const loadDashboard = useCallback(async () => {
		setLoading(true);
		try {
			const res = await getCourseDashboard(courseId, { cohortId, weeks });
			setDashboard(res.data);
			setError('');
		} catch (err) {
			setError(getApiErrorMessage(err, 'Không tải được số liệu phân tích.'));
		} finally {
			setLoading(false);
		}
	}, [courseId, cohortId, weeks]);

	const loadRisks = useCallback(async () => {
		setRisksLoading(true);
		try {
			const res = await getCourseRisks(courseId, { cohortId, capacity });
			setRisks(res.data);
		} catch (err) {
			message.error(
				getApiErrorMessage(err, 'Không tải được danh sách rủi ro.'),
			);
		} finally {
			setRisksLoading(false);
		}
	}, [courseId, cohortId, capacity]);

	useEffect(() => {
		void loadDashboard();
	}, [loadDashboard]);
	useEffect(() => {
		void loadRisks();
	}, [loadRisks]);

	const rerun = async () => {
		setRunning(true);
		try {
			const res = await runRiskPrediction(courseId);
			if (res.data)
				message.success(
					`Đã đánh giá ${res.data.evaluated} học viên: ${res.data.byLevel.high} cao, ${res.data.byLevel.medium} trung bình (${res.data.durationMs} ms)`,
				);
			await Promise.all([loadDashboard(), loadRisks()]);
		} catch (err) {
			message.error(getApiErrorMessage(err));
		} finally {
			setRunning(false);
		}
	};

	const overview = dashboard?.overview;
	const planned = (risks?.items ?? []).filter((item) => item.suggestedAction);

	return (
		<div className="p-gutter space-y-space-lg">
			<div className="flex flex-wrap items-start justify-between gap-space-md">
				<div className="space-y-1">
					<Link
						to={`/teacher/courses/${courseId}`}
						className="text-body-sm text-secondary"
					>
						←{' '}
						{course ? `${course.code} · ${course.title}` : 'Quay lại khoá học'}
					</Link>
					<h1 className="font-headline-md font-headline-md text-on-surface">
						Phân tích học tập & cảnh báo sớm
					</h1>
					<p className="text-body-md text-on-surface-variant">
						Dự đoán lúc{' '}
						{risks?.computedAt
							? dayjs(risks.computedAt).format('DD/MM/YYYY HH:mm')
							: '—'}{' '}
						·{' '}
						<button
							type="button"
							className="text-secondary underline"
							onClick={() => setModelOpen(true)}
						>
							luật ASP hiệu chỉnh trên OULAD
						</button>
						{risks && (
							<>
								{' '}
								· ngưỡng{' '}
								{risks.cutoffs.source === 'course_setting'
									? 'theo cấu hình khoá'
									: 'hiệu chỉnh'}
								: trung bình ≥ {risks.cutoffs.medium.toFixed(2)}, cao ≥{' '}
								{risks.cutoffs.high.toFixed(2)}
							</>
						)}
					</p>
				</div>
				<Space wrap>
					<Select
						allowClear
						placeholder="Tất cả lớp"
						style={{ width: 180 }}
						value={cohortId}
						onChange={setCohortId}
						options={(dashboard?.cohorts ?? []).map((cohort) => ({
							value: cohort.id,
							label: `${cohort.name} (${cohort.learners})`,
						}))}
					/>
					<Select
						style={{ width: 130 }}
						value={weeks}
						onChange={setWeeks}
						options={[6, 10, 16, 26].map((n) => ({
							value: n,
							label: `${n} tuần`,
						}))}
					/>
					<ISolidBtn
						background="primary"
						icon={<Icon name="model_training" size={16} />}
						loading={running}
						onClick={() => void rerun()}
					>
						Chạy lại dự đoán
					</ISolidBtn>
				</Space>
			</div>

			{error && (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{error}
				</ErrorBadge>
			)}

			{loading && !dashboard ? (
				<div className="flex min-h-[30vh] items-center justify-center">
					<Spin size="large" />
				</div>
			) : (
				overview && (
					<>
						<div className="grid grid-cols-2 gap-space-md md:grid-cols-3 xl:grid-cols-6">
							<Kpi label="Học viên đang học" value={overview.learners} />
							<Kpi
								label="Hoạt động 7 ngày qua"
								value={overview.activeLearners7d}
								hint={
									overview.learners
										? `${Math.round((overview.activeLearners7d / overview.learners) * 100)}% học viên`
										: undefined
								}
							/>
							<Kpi
								label="Tiến độ trung bình"
								value={`${overview.avgProgressPercent}%`}
							/>
							<Kpi
								label="Điểm trung bình"
								value={
									overview.avgScorePercent === null
										? '—'
										: `${overview.avgScorePercent}/100`
								}
							/>
							<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
								<div className="text-body-sm text-on-surface-variant">
									Nguy cơ hiện tại
								</div>
								<Space direction="vertical" size={2} className="mt-1">
									<Badge status="error" dot>
										Cao: {overview.risk.byLevel.high}
									</Badge>
									<Badge status="warning" dot>
										Trung bình: {overview.risk.byLevel.medium}
									</Badge>
									<Badge status="success" dot>
										Thấp: {overview.risk.byLevel.low}
									</Badge>
								</Space>
							</div>
							<Kpi
								label="Can thiệp 30 ngày"
								value={overview.interventions30d}
							/>
						</div>

						<div className="grid grid-cols-1 gap-space-md xl:grid-cols-2">
							<ChartCard
								title="Học viên hoạt động mỗi tuần"
								hint="Số học viên có ít nhất một hoạt động trong tuần"
							>
								<WeeklyLine
									data={dashboard.timeseries}
									dataKey="activeLearners"
									name="Học viên hoạt động"
								/>
							</ChartCard>
							<ChartCard
								title="Số học viên theo mức rủi ro"
								hint="Kết quả dự đoán cuối cùng của mỗi học viên trong tuần"
							>
								<RiskStack data={dashboard.timeseries} />
							</ChartCard>
							<ChartCard
								title="Bài học hoàn thành mỗi tuần"
								hint="Tổng số lượt hoàn thành bài học"
							>
								<WeeklyBars
									data={dashboard.timeseries}
									dataKey="lessonsCompleted"
									name="Bài hoàn thành"
								/>
							</ChartCard>
							<ChartCard
								title="Điểm trung bình bài kiểm tra mỗi tuần (thang 100)"
								hint="Chỉ tính bài đã chấm"
							>
								<WeeklyLine
									data={dashboard.timeseries}
									dataKey="avgScorePercent"
									name="Điểm trung bình"
									unit="/100"
									domain={[0, 100]}
								/>
							</ChartCard>
						</div>
						<ChartCard
							title="Phễu theo bài học"
							hint="Số học viên đã mở và đã hoàn thành từng bài, theo thứ tự lộ trình"
							height={260}
						>
							<LessonFunnel data={dashboard.lessons} />
						</ChartCard>
					</>
				)
			)}

			<section className="space-y-space-md">
				<div className="flex flex-wrap items-end justify-between gap-space-md">
					<div>
						<h2 className="font-title-lg font-bold text-on-surface">
							Học viên cần theo dõi
						</h2>
						<p className="text-body-md text-on-surface-variant">
							ASP chọn tối đa{' '}
							<Tooltip title="Sức xử lý của giảng viên trong lượt này: ASP tối ưu để xử lý được nhiều điểm rủi ro nhất trong giới hạn này, không nhắc lại học viên vừa được can thiệp trong 7 ngày.">
								<InputNumber
									size="small"
									min={0}
									max={200}
									value={capacity}
									onChange={(v) => setCapacity(v ?? 0)}
									style={{ width: 70 }}
								/>
							</Tooltip>{' '}
							lượt can thiệp — đang đề xuất {planned.length} học viên
							{planned.length > 0 &&
								` (${Object.entries(
									planned.reduce<Record<string, number>>((acc, item) => {
										const key =
											INTERVENTION_ACTION_LABEL[item.suggestedAction!];
										acc[key] = (acc[key] ?? 0) + 1;
										return acc;
									}, {}),
								)
									.map(([label, n]) => `${n} ${label.toLowerCase()}`)
									.join(', ')})`}
							.
						</p>
					</div>
					{dashboard?.outcomes.length ? (
						<Space wrap size={4}>
							<span className="text-body-sm text-on-surface-variant">
								Kết quả can thiệp:
							</span>
							{Object.entries(
								dashboard.outcomes.reduce<Record<string, number>>(
									(acc, row) => {
										acc[row.outcome] = (acc[row.outcome] ?? 0) + row.n;
										return acc;
									},
									{},
								),
							).map(([outcome, n]) => (
								<Tag key={outcome}>
									{OUTCOME_LABEL[outcome] ?? outcome}: {n}
								</Tag>
							))}
						</Space>
					) : null}
				</div>
				<RiskTable
					items={risks?.items ?? []}
					loading={risksLoading}
					onDetail={setDetail}
					onIntervene={setIntervene}
				/>
				<div className="flex justify-end">
					<IOutLinedBtn
						size="small"
						icon={<Icon name="info" size={14} />}
						onClick={() => setModelOpen(true)}
					>
						Bộ cảnh báo hoạt động thế nào?
					</IOutLinedBtn>
				</div>
			</section>

			<LearnerDrawer
				courseId={courseId}
				learner={detail}
				onClose={() => setDetail(null)}
			/>
			<InterventionModal
				courseId={courseId}
				learner={intervene}
				onClose={() => setIntervene(null)}
				onSent={() => {
					setIntervene(null);
					void loadRisks();
					void loadDashboard();
				}}
			/>
			<ModelDrawer open={modelOpen} onClose={() => setModelOpen(false)} />
		</div>
	);
};

export default CourseAnalyticsPage;
