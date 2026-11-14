import { Space, Tag, Tooltip, type TableProps } from 'antd';
import { Badge, Icon, IOutLinedBtn, ITable } from '@/components';
import {
	INTERVENTION_ACTION_LABEL,
	RISK_LEVEL_LABEL,
	type LearnerRisk,
} from '@/types';
import { RISK_BADGE } from './viz';

/**
 * Bảng học viên theo mức rủi ro. Lý do hiển thị theo thứ tự trọng số (đóng góp vào điểm); ngoại lệ
 * (luật bị rút lại) hiện trong tooltip để giảng viên thấy cả lý do KHÔNG cảnh báo.
 */
const RiskTable = ({
	items,
	loading,
	onDetail,
	onIntervene,
}: {
	items: LearnerRisk[];
	loading: boolean;
	onDetail: (item: LearnerRisk) => void;
	onIntervene: (item: LearnerRisk) => void;
}) => {
	const columns: TableProps<LearnerRisk>['columns'] = [
		{
			title: 'Học viên',
			dataIndex: 'fullName',
			render: (_: string, item) => (
				<div>
					<div className="font-label-md text-on-surface">{item.fullName}</div>
					{item.studentCode && (
						<div className="text-body-sm text-on-surface-variant">
							{item.studentCode}
						</div>
					)}
				</div>
			),
		},
		{
			title: 'Mức rủi ro',
			dataIndex: 'level',
			width: 150,
			filters: (['high', 'medium', 'low'] as const).map((level) => ({
				text: RISK_LEVEL_LABEL[level],
				value: level,
			})),
			onFilter: (value, item) => item.level === value,
			render: (_: string, item) => (
				<Space size={4} direction="vertical">
					<Badge status={RISK_BADGE[item.level]} dot>
						{RISK_LEVEL_LABEL[item.level]}
					</Badge>
					<span className="text-body-sm text-on-surface-variant">
						điểm {item.score.toFixed(2)}
					</span>
				</Space>
			),
			sorter: (a, b) => a.score - b.score,
			defaultSortOrder: 'descend',
		},
		{
			title: 'Lý do (theo mức đóng góp)',
			dataIndex: 'reasons',
			render: (_: unknown, item) =>
				item.reasons.length ? (
					<div className="space-y-1">
						{item.reasons.slice(0, 3).map((reason) => (
							<div key={reason.signal} className="text-body-sm text-on-surface">
								<Tooltip
									title={`${reason.label} · +${reason.weight.toFixed(2)} log-odds`}
								>
									<span>• {reason.detail}</span>
								</Tooltip>
							</div>
						))}
						{item.reasons.length > 3 && (
							<div className="text-body-sm text-on-surface-variant">
								+{item.reasons.length - 3} lý do khác
							</div>
						)}
						{item.exceptions.length > 0 && (
							<Tooltip title={item.exceptions.map((e) => e.detail).join('\n')}>
								<Tag
									icon={<Icon name="info" size={12} />}
									style={{ marginTop: 2 }}
								>
									{item.exceptions.length} ngoại lệ đã áp dụng
								</Tag>
							</Tooltip>
						)}
					</div>
				) : (
					<span className="text-body-sm text-on-surface-variant">
						Không có tín hiệu rủi ro
						{item.exceptions.length > 0 &&
							` (${item.exceptions[0].detail.toLowerCase()})`}
					</span>
				),
		},
		{
			title: 'Đề xuất (ASP)',
			dataIndex: 'suggestedAction',
			width: 190,
			render: (_: unknown, item) => (
				<div className="space-y-1">
					{item.suggestedAction ? (
						<Tag color="blue">
							{INTERVENTION_ACTION_LABEL[item.suggestedAction]}
						</Tag>
					) : (
						<span className="text-body-sm text-on-surface-variant">—</span>
					)}
					{item.lastIntervention && (
						<div className="text-body-sm text-on-surface-variant">
							Lần trước:{' '}
							{INTERVENTION_ACTION_LABEL[item.lastIntervention.type] ??
								item.lastIntervention.type}
							{item.lastIntervention.status === 'acknowledged'
								? ' (đã đọc)'
								: ''}
						</div>
					)}
				</div>
			),
		},
		{
			title: '',
			key: 'actions',
			width: 210,
			render: (_: unknown, item) => (
				<Space size={4} wrap>
					<IOutLinedBtn
						size="small"
						icon={<Icon name="monitoring" size={14} />}
						onClick={() => onDetail(item)}
					>
						Chi tiết
					</IOutLinedBtn>
					{item.level !== 'low' && (
						<IOutLinedBtn
							size="small"
							mode="primary"
							icon={<Icon name="campaign" size={14} />}
							onClick={() => onIntervene(item)}
						>
							Can thiệp
						</IOutLinedBtn>
					)}
				</Space>
			),
		},
	];

	return (
		<ITable<LearnerRisk>
			rowKey="userId"
			loading={loading}
			columns={columns}
			dataSource={items}
			pagination={false}
		/>
	);
};

export default RiskTable;
