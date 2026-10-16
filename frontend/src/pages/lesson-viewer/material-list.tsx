import { Badge, Icon } from '@/components';
import {
	formatDuration,
	formatFileSize,
	getMaterialTypeBadgeTone,
} from '@/utils/course';
import {
	MATERIAL_TYPE_LABEL,
	type MaterialItem,
	type MaterialType,
} from '@/types';

/**
 * Khối "Học liệu" của trang xem bài học (E3-T8).
 *
 * Mỗi `materialType` có một cách hiển thị khác nhau vì bản chất dữ liệu khác nhau: `video` cần
 * thẻ `<video>` (xem ngay trong trang), `slide`/`file` là tệp để tải/mở, `link` là URL ngoài, còn
 * `text` là văn bản thuần do giảng viên gõ **không** qua trình soạn thảo HTML.
 */

/** Icon Material Symbols cho từng loại học liệu. */
const MATERIAL_ICON: Record<MaterialType, string> = {
	video: 'smart_display',
	slide: 'slideshow',
	file: 'description',
	link: 'link',
	text: 'article',
};

/**
 * Thân của một học liệu.
 *
 * `text` render bằng `whitespace-pre-wrap` trên `{material.content}` — **không** qua
 * `dangerouslySetInnerHTML`: trường này là văn bản thuần (khác `lesson.content` do TipTap sinh ra),
 * nên nếu dựng thành HTML thì một dấu `<` trong ghi chú cũng bị hiểu là thẻ.
 */
const MaterialBody = ({ material }: { material: MaterialItem }) => {
	if (material.materialType === 'video') {
		return material.url ? (
			<div className="space-y-1">
				{/* `preload="metadata"` để chỉ tải phần đầu lấy thời lượng, không kéo cả tệp video. */}
				<video
					controls
					preload="metadata"
					src={material.url}
					className="w-full rounded-lg"
				/>
				{material.durationSeconds !== null && (
					<p className="font-label-sm font-label-sm text-on-surface-variant">
						{formatDuration(material.durationSeconds)}
					</p>
				)}
			</div>
		) : (
			<p className="font-body-sm font-body-sm text-on-surface-variant">
				Video này chưa có đường dẫn phát.
			</p>
		);
	}

	if (material.materialType === 'slide' || material.materialType === 'file') {
		const meta = [
			material.fileSizeBytes !== null
				? formatFileSize(material.fileSizeBytes)
				: null,
			material.mimeType,
		].filter((value): value is string => Boolean(value));

		return material.url ? (
			<div className="flex flex-wrap items-center gap-space-sm">
				<a
					href={material.url}
					target="_blank"
					rel="noopener noreferrer"
					download={
						material.materialType === 'file' ? material.title : undefined
					}
					className="inline-flex items-center gap-2 font-label-lg font-label-lg text-secondary hover:underline"
				>
					<Icon name={MATERIAL_ICON[material.materialType]} size={20} />
					{material.materialType === 'file' ? 'Tải tệp' : 'Mở slide'}
				</a>
				{meta.length > 0 && (
					<p className="font-label-sm font-label-sm text-on-surface-variant">
						{meta.join(' • ')}
					</p>
				)}
			</div>
		) : (
			<p className="font-body-sm font-body-sm text-on-surface-variant">
				Học liệu này chưa có đường dẫn tệp.
			</p>
		);
	}

	if (material.materialType === 'link') {
		return material.url ? (
			<a
				href={material.url}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-2 font-label-lg font-label-lg text-secondary hover:underline"
			>
				<Icon name="open_in_new" size={20} />
				Mở liên kết
			</a>
		) : (
			<p className="font-body-sm font-body-sm text-on-surface-variant">
				Liên kết này chưa có địa chỉ.
			</p>
		);
	}

	return material.content ? (
		<p className="whitespace-pre-wrap font-body-md font-body-md text-on-surface">
			{material.content}
		</p>
	) : (
		<p className="font-body-sm font-body-sm text-on-surface-variant">
			Học liệu chưa có nội dung.
		</p>
	);
};

const MaterialList = ({ materials }: { materials: MaterialItem[] }) => (
	<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
		<div className="flex flex-wrap items-center gap-space-sm">
			<h2 className="font-title-lg font-title-lg text-on-surface">Học liệu</h2>
			<Badge status="neutral">{materials.length}</Badge>
		</div>

		<ul className="space-y-space-sm">
			{materials.map((material) => (
				<li
					key={material.id}
					className="space-y-space-sm rounded-lg border border-outline-variant/60 p-space-md"
				>
					<div className="flex flex-wrap items-start justify-between gap-space-sm">
						<div className="flex min-w-0 items-center gap-2">
							<Icon
								name={MATERIAL_ICON[material.materialType]}
								size={20}
								className="shrink-0 text-secondary"
							/>
							<span className="font-body-md font-body-md font-semibold text-on-surface">
								{material.title}
							</span>
						</div>
						<Badge status={getMaterialTypeBadgeTone(material.materialType)}>
							{MATERIAL_TYPE_LABEL[material.materialType]}
						</Badge>
					</div>

					<MaterialBody material={material} />
				</li>
			))}
		</ul>
	</section>
);

export default MaterialList;
