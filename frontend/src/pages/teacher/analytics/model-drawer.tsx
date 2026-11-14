import { useEffect, useState } from 'react';
import { Descriptions, Drawer, Spin, Table } from 'antd';
import { getRiskModelInfo } from '@/apis/analytics';
import type { RiskModelInfo } from '@/types';

const SIGNAL_LABEL: Record<string, string> = {
	never_active: 'Chưa từng hoạt động',
	inactive: 'Vắng mặt lâu',
	low_engagement: 'Ít tham gia',
	declining: 'Giảm nhịp học',
	missed_work: 'Bỏ lỡ bài đến hạn',
	late_work: 'Nộp trễ',
	low_score: 'Điểm thấp',
	score_drop: 'Điểm đi xuống',
};

const pct = (value?: number) =>
	value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;

/** Minh bạch về bộ cảnh báo: dữ liệu hiệu chỉnh ở đâu, ngưỡng/trọng số là gì, đo được bao nhiêu. */
const ModelDrawer = ({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) => {
	const [info, setInfo] = useState<RiskModelInfo | null>(null);

	useEffect(() => {
		if (open && !info) void getRiskModelInfo().then((res) => setInfo(res.data));
	}, [open, info]);

	const test = info?.metrics.test;
	const baseline = info?.metrics.baselineLogisticContinuous;
	const lead = info?.metrics.leadTime;

	return (
		<Drawer
			open={open}
			onClose={onClose}
			width={640}
			title="Bộ cảnh báo sớm: luật ASP hiệu chỉnh trên OULAD"
		>
			{!info ? (
				<div className="flex justify-center py-8">
					<Spin />
				</div>
			) : (
				<div className="space-y-space-md text-body-md">
					<p>
						Tín hiệu rủi ro được suy ra bằng chương trình Answer Set Programming
						(clingo) có ngoại lệ; ngưỡng của từng luật và trọng số gộp được hiệu
						chỉnh trên bộ dữ liệu mở <b>{info.source.dataset}</b> (
						{info.source.license}), không học từ dữ liệu của UniPrep.
					</p>
					<Descriptions size="small" bordered column={1}>
						<Descriptions.Item label="Phiên bản">
							{info.version}
						</Descriptions.Item>
						<Descriptions.Item label="Nhãn nguy cơ">
							{info.source.label}
						</Descriptions.Item>
						<Descriptions.Item label="Hiệu chỉnh / đánh giá">
							{info.source.trainPresentations.join(', ')} →{' '}
							{info.source.testPresentations.join(', ')}
						</Descriptions.Item>
						<Descriptions.Item label="Ngưỡng điểm">
							trung bình ≥ {info.cutoffs.medium.toFixed(3)}, cao ≥{' '}
							{info.cutoffs.high.toFixed(3)}
						</Descriptions.Item>
					</Descriptions>

					<h3 className="font-title-sm font-semibold">
						Số đo trên tập đánh giá ({test?.rows ?? '—'} dòng)
					</h3>
					<Table
						size="small"
						pagination={false}
						rowKey="name"
						dataSource={[
							{
								name: 'ASP (mức ≥ trung bình)',
								auc: test?.auc,
								...test?.medium,
							},
							{ name: 'ASP (chỉ mức cao)', auc: undefined, ...test?.high },
							{
								name: 'Tham chiếu: logistic trên feature liên tục',
								auc: baseline?.auc,
								...baseline?.medium,
							},
						]}
						columns={[
							{ title: 'Phương pháp', dataIndex: 'name' },
							{
								title: 'AUC',
								dataIndex: 'auc',
								render: (v?: number) => (v === undefined ? '—' : v.toFixed(3)),
							},
							{ title: 'Precision', dataIndex: 'precision', render: pct },
							{ title: 'Recall', dataIndex: 'recall', render: pct },
							{
								title: 'F1',
								dataIndex: 'f1',
								render: (v?: number) => (v === undefined ? '—' : v.toFixed(3)),
							},
						]}
					/>
					{lead && (
						<p className="text-on-surface-variant">
							Thời gian báo trước: {lead.flaggedBeforeWithdrawal}/
							{lead.withdrawnStudents} học viên rút môn được gắn cờ trước khi
							rút, trung vị {lead.medianDays ?? '—'} ngày.
						</p>
					)}

					<h3 className="font-title-sm font-semibold">Luật và trọng số</h3>
					<Table
						size="small"
						pagination={false}
						rowKey="signal"
						dataSource={Object.entries(info.model.weights).map(
							([signal, weight]) => ({ signal, weight }),
						)}
						columns={[
							{
								title: 'Tín hiệu',
								dataIndex: 'signal',
								render: (s: string) => SIGNAL_LABEL[s] ?? s,
							},
							{
								title: 'Trọng số (log-odds)',
								dataIndex: 'weight',
								render: (w: number) => w.toFixed(3),
							},
						]}
					/>
					<Descriptions size="small" bordered column={2} title="Ngưỡng luật">
						{Object.entries(info.thresholds).map(([key, value]) => (
							<Descriptions.Item key={key} label={key}>
								{value}
							</Descriptions.Item>
						))}
					</Descriptions>
				</div>
			)}
		</Drawer>
	);
};

export default ModelDrawer;
