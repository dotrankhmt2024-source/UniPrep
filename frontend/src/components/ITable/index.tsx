import { useCallback, useEffect, useMemo } from 'react';
import { Empty, Table, type TableProps } from 'antd';
import { useLocation, useNavigate } from 'react-router';
import '@/styles/ITable.css';

/**
 * Shared table for the whole repo. Always use this instead of raw `<table>` markup in pages.
 *
 * Extras over antd's `Table`:
 * - responsive horizontal scroll wrapper (`.i-table-responsive-wrap`)
 * - auto "STT" (row number) column, aware of the current page
 * - `pagination` is required (or `false` to disable) so every table renders a consistent pager
 * - optional two-way URL sync of `page` / `pageSize` / filter params (`syncLocation`)
 */
export interface ITablePagination {
	total: number;
	pageSize: number;
	current?: number;
	onChange?: (page: number, pageSize: number) => void;
	showSizeChanger?: boolean;
	showQuickJumper?: boolean;
}

export interface ITableProps<T> extends Omit<TableProps<T>, 'pagination'> {
	pagination: ITablePagination | false;
	/** Extra filter params mirrored into the URL when `syncLocation` is enabled. */
	filters?: Record<string, unknown>;
	/** Mirror pagination + filters into the query string. Defaults to `false`. */
	syncLocation?: boolean;
	/** Prepend the automatic "STT" column. Defaults to `true`. */
	showSTT?: boolean;
}

const ITable = <T extends object>({
	columns,
	dataSource,
	pagination,
	filters = {},
	syncLocation = false,
	showSTT = true,
	...restProps
}: ITableProps<T>) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { scroll, ...tableProps } = restProps;

	const mergedColumns = useMemo(() => {
		if (!columns) return columns;
		if (!showSTT) return columns;

		const sttColumn = {
			title: 'STT',
			key: '__stt',
			width: 70,
			align: 'center' as const,
			render: (_value: unknown, _record: T, index: number) => {
				const current = pagination ? pagination.current || 1 : 1;
				const pageSize = pagination ? pagination.pageSize || 10 : 10;
				return (current - 1) * pageSize + index + 1;
			},
		};

		return [sttColumn, ...columns] as TableProps<T>['columns'];
	}, [columns, showSTT, pagination]);

	const mergedScroll = useMemo(
		() => ({
			x: 'max-content' as const,
			...(scroll || {}),
		}),
		[scroll],
	);

	const buildFilterParams = useCallback(() => {
		const params = new URLSearchParams(location.search);
		params.delete('page');
		params.delete('pageSize');

		Object.entries(filters).forEach(([key, value]) => {
			if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
				params.delete(key);
				return;
			}
			if (Array.isArray(value)) {
				params.set(key, value.join(','));
				return;
			}
			params.set(key, String(value));
		});

		return params;
	}, [filters, location.search]);

	const handlePaginationChange = (page: number, currentPageSize: number) => {
		if (pagination) pagination.onChange?.(page, currentPageSize);

		if (syncLocation) {
			const params = buildFilterParams();
			params.set('page', String(page));
			params.set('pageSize', String(currentPageSize));
			navigate(`?${params.toString()}`, { state: filters });
		}
	};

	useEffect(() => {
		if (!syncLocation) return;

		const params = buildFilterParams();
		if (pagination !== false) {
			params.set('page', String(pagination?.current || 1));
			params.set('pageSize', String(pagination?.pageSize || 10));
		}

		const nextSearch = params.toString();
		const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
		if (nextSearch !== currentSearch) {
			navigate(nextSearch ? `?${nextSearch}` : '', { replace: true, state: filters });
		}
	}, [buildFilterParams, filters, location.search, navigate, pagination, syncLocation]);

	return (
		<div className="i-table-responsive-wrap">
			<Table<T>
				columns={mergedColumns}
				dataSource={dataSource}
				scroll={mergedScroll}
				pagination={
					pagination === false
						? false
						: {
								total: pagination.total || 0,
								pageSize: pagination.pageSize || 10,
								current: pagination.current,
								className: 'i-table-pagination',
								showSizeChanger: pagination.showSizeChanger ?? false,
								showQuickJumper: pagination.showQuickJumper ?? false,
								onChange: handlePaginationChange,
							}
				}
				locale={{ emptyText: <Empty description="Không có dữ liệu phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
				rowHoverable
				size="middle"
				{...tableProps}
			/>
		</div>
	);
};

export default ITable;
