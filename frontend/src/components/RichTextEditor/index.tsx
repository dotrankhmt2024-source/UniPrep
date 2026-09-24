import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/core';
import { Plugin as ProseMirrorPlugin } from '@tiptap/pm/state';
import { Button, Divider, Input, Select, Space, Tooltip } from 'antd';
import {
	AlignCenterOutlined,
	AlignLeftOutlined,
	AlignRightOutlined,
	BgColorsOutlined,
	BoldOutlined,
	ClearOutlined,
	CodeOutlined,
	DisconnectOutlined,
	EyeOutlined,
	FontColorsOutlined,
	ItalicOutlined,
	LinkOutlined,
	OrderedListOutlined,
	RedoOutlined,
	StrikethroughOutlined,
	UnderlineOutlined,
	UndoOutlined,
	UnorderedListOutlined,
} from '@ant-design/icons';
import '@/styles/rich-text-editor.css';

type CasingType = 'uppercase' | 'lowercase' | 'capitalize';

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		casing: {
			setCasing: (type: CasingType | null) => ReturnType;
		};
	}
}

/** Custom TipTap extension implementing the "smart case" (CHỮ HOA / chữ thường / Chữ Đầu) buttons. */
export const CasingExtension = Extension.create({
	name: 'casing',

	addStorage() {
		return { activeCase: null as CasingType | null };
	},

	addCommands() {
		return {
			setCasing:
				(type: CasingType | null) =>
				({ commands, editor }) => {
					(editor.storage as unknown as { casing: { activeCase: CasingType | null } }).casing.activeCase = type;

					const { from, to } = editor.state.selection;
					if (from !== to) {
						const selectedText = editor.state.doc.textBetween(from, to, ' ');
						let transformedText = selectedText;
						if (type === 'uppercase') transformedText = selectedText.toUpperCase();
						else if (type === 'lowercase') transformedText = selectedText.toLowerCase();
						else if (type === 'capitalize') {
							transformedText = selectedText
								.toLowerCase()
								.replace(/(^\w|\s\w)/g, (m: string) => m.toUpperCase());
						}
						return commands.insertContentAt({ from, to }, transformedText);
					}
					return true;
				},
		};
	},

	addProseMirrorPlugins() {
		return [
			new ProseMirrorPlugin({
				props: {
					// Arrow function so `this` still refers to the extension instance.
					handleTextInput: (view, from, to, text) => {
						const activeCase = (this.storage as unknown as { activeCase: CasingType | null }).activeCase;
						if (!activeCase) return false;

						let transformedText = text;
						if (activeCase === 'uppercase') {
							transformedText = text.toUpperCase();
						} else if (activeCase === 'lowercase') {
							transformedText = text.toLowerCase();
						} else if (activeCase === 'capitalize') {
							const charBefore = view.state.doc.textBetween(Math.max(0, from - 1), from, ' ');
							transformedText = !charBefore || /\s/.test(charBefore) ? text.toUpperCase() : text.toLowerCase();
						}

						view.dispatch(view.state.tr.insertText(transformedText, from, to));
						return true;
					},
				},
			}),
		];
	},
});

export interface RichTextEditorProps {
	value?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	minHeight?: number;
}

interface ToolbarBtnProps {
	active?: boolean;
	disabled?: boolean;
	title: string;
	icon: React.ReactNode;
	onClick: () => void;
	label?: string;
}

const ToolbarBtn = ({ active = false, disabled = false, title, icon, onClick, label }: ToolbarBtnProps) => (
	<Tooltip title={title}>
		<Button
			size="small"
			color={active ? 'primary' : 'default'}
			variant={active ? 'solid' : 'text'}
			disabled={disabled}
			icon={icon}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
		>
			{label}
		</Button>
	</Tooltip>
);

/**
 * Shared rich text editor (TipTap) used for syllabus / policy / announcement content.
 * Controlled: pass `value` (HTML string) and `onChange`. Works inside an antd `Form.Item`
 * because it accepts `value` / `onChange` props.
 */
const RichTextEditor = ({
	value = '',
	onChange,
	placeholder = 'Nhập nội dung chi tiết...',
	disabled = false,
	minHeight = 320,
}: RichTextEditorProps) => {
	const [isSourceMode, setIsSourceMode] = useState(false);
	const [sourceValue, setSourceValue] = useState('');
	const [wordCount, setWordCount] = useState(0);
	const [charCount, setCharCount] = useState(0);
	const textColorInputRef = useRef<HTMLInputElement>(null);
	const highlightColorInputRef = useRef<HTMLInputElement>(null);

	const editor = useEditor({
		extensions: [
			// StarterKit v3 already bundles link + underline, so they are configured here instead of
			// being registered a second time (duplicate extension names break the editor).
			StarterKit.configure({
				link: {
					openOnClick: false,
					HTMLAttributes: { class: 'rte-link' },
				},
				bulletList: { keepMarks: true, keepAttributes: false },
				orderedList: { keepMarks: true, keepAttributes: false },
			}),
			TextStyle,
			Color,
			Highlight.configure({ multicolor: true }),
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			Placeholder.configure({ placeholder }),
			CasingExtension,
		],
		content: value,
		editable: !disabled,
		onUpdate: ({ editor: currentEditor }) => {
			const html = currentEditor.getHTML();
			const text = currentEditor.getText();
			setCharCount(text.length);
			setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
			onChange?.(html === '<p></p>' ? '' : html);
		},
	});

	// Keep the editor in sync with external value changes without stealing the cursor on every keystroke.
	useEffect(() => {
		if (!editor) return;
		const currentHTML = editor.getHTML();
		const normalizedValue = value || '';
		const normalizedCurrent = currentHTML === '<p></p>' ? '' : currentHTML;
		if (normalizedValue !== normalizedCurrent) {
			editor.commands.setContent(normalizedValue);
		}
	}, [value, editor]);

	if (!editor) return null;

	const activeCasing =
		(editor.storage as unknown as { casing?: { activeCase: CasingType | null } }).casing?.activeCase ?? null;
	const lockWhileSource = disabled || isSourceMode;

	const handleCasingToggle = (type: CasingType) => {
		editor.commands.setCasing(activeCasing === type ? null : type);
	};

	const setLink = () => {
		const previousUrl = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('Nhập đường dẫn URL:', previousUrl);

		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	};

	const toggleSourceMode = () => {
		if (isSourceMode) {
			setIsSourceMode(false);
			return;
		}
		setSourceValue(editor.getHTML());
		setIsSourceMode(true);
	};

	const handleSourceChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const nextValue = event.target.value;
		setSourceValue(nextValue);
		onChange?.(nextValue);
		editor.commands.setContent(nextValue);
	};

	return (
		<div className={`rte-container ${disabled ? 'rte-disabled' : ''}`}>
			<div className="rte-toolbar">
				<Space size={2}>
					<ToolbarBtn
						disabled={lockWhileSource}
						title="Hoàn tác (Ctrl+Z)"
						icon={<UndoOutlined />}
						onClick={() => editor.chain().focus().undo().run()}
					/>
					<ToolbarBtn
						disabled={lockWhileSource}
						title="Làm lại (Ctrl+Shift+Z)"
						icon={<RedoOutlined />}
						onClick={() => editor.chain().focus().redo().run()}
					/>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Select
					size="small"
					style={{ width: 132 }}
					disabled={lockWhileSource}
					getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
					value={
						editor.isActive('heading', { level: 1 })
							? 'h1'
							: editor.isActive('heading', { level: 2 })
								? 'h2'
								: editor.isActive('heading', { level: 3 })
									? 'h3'
									: 'p'
					}
					onChange={(nextValue) => {
						if (nextValue === 'p') editor.chain().focus().setParagraph().run();
						else if (nextValue === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
						else if (nextValue === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
						else editor.chain().focus().toggleHeading({ level: 3 }).run();
					}}
					options={[
						{ value: 'p', label: 'Văn bản' },
						{ value: 'h1', label: 'Tiêu đề lớn' },
						{ value: 'h2', label: 'Tiêu đề vừa' },
						{ value: 'h3', label: 'Tiêu đề nhỏ' },
					]}
				/>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<ToolbarBtn
						active={editor.isActive('bold')}
						disabled={lockWhileSource}
						title="Chữ đậm (Ctrl+B)"
						icon={<BoldOutlined />}
						onClick={() => editor.chain().focus().toggleBold().run()}
					/>
					<ToolbarBtn
						active={editor.isActive('italic')}
						disabled={lockWhileSource}
						title="Chữ nghiêng (Ctrl+I)"
						icon={<ItalicOutlined />}
						onClick={() => editor.chain().focus().toggleItalic().run()}
					/>
					<ToolbarBtn
						active={editor.isActive('underline')}
						disabled={lockWhileSource}
						title="Gạch chân (Ctrl+U)"
						icon={<UnderlineOutlined />}
						onClick={() => editor.chain().focus().toggleUnderline().run()}
					/>
					<ToolbarBtn
						active={editor.isActive('strike')}
						disabled={lockWhileSource}
						title="Gạch ngang"
						icon={<StrikethroughOutlined />}
						onClick={() => editor.chain().focus().toggleStrike().run()}
					/>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<ToolbarBtn
						active={activeCasing === 'uppercase'}
						disabled={lockWhileSource}
						title="CHỮ HOA toàn bộ"
						icon={null}
						label="AB"
						onClick={() => handleCasingToggle('uppercase')}
					/>
					<ToolbarBtn
						active={activeCasing === 'lowercase'}
						disabled={lockWhileSource}
						title="chữ thường toàn bộ"
						icon={null}
						label="ab"
						onClick={() => handleCasingToggle('lowercase')}
					/>
					<ToolbarBtn
						active={activeCasing === 'capitalize'}
						disabled={lockWhileSource}
						title="Viết Hoa Chữ Đầu"
						icon={null}
						label="Ab"
						onClick={() => handleCasingToggle('capitalize')}
					/>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<div className="rte-color-swatch">
						<ToolbarBtn
							disabled={lockWhileSource}
							title="Màu chữ"
							icon={<FontColorsOutlined />}
							onClick={() => textColorInputRef.current?.click()}
						/>
						<input
							ref={textColorInputRef}
							type="color"
							aria-label="Màu chữ"
							onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
						/>
					</div>
					<div className="rte-color-swatch">
						<ToolbarBtn
							disabled={lockWhileSource}
							title="Tô sáng"
							icon={<BgColorsOutlined />}
							onClick={() => highlightColorInputRef.current?.click()}
						/>
						<input
							ref={highlightColorInputRef}
							type="color"
							aria-label="Màu nền chữ"
							onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}
						/>
					</div>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<ToolbarBtn
						active={editor.isActive({ textAlign: 'left' })}
						disabled={lockWhileSource}
						title="Căn lề trái"
						icon={<AlignLeftOutlined />}
						onClick={() => editor.chain().focus().setTextAlign('left').run()}
					/>
					<ToolbarBtn
						active={editor.isActive({ textAlign: 'center' })}
						disabled={lockWhileSource}
						title="Căn giữa"
						icon={<AlignCenterOutlined />}
						onClick={() => editor.chain().focus().setTextAlign('center').run()}
					/>
					<ToolbarBtn
						active={editor.isActive({ textAlign: 'right' })}
						disabled={lockWhileSource}
						title="Căn lề phải"
						icon={<AlignRightOutlined />}
						onClick={() => editor.chain().focus().setTextAlign('right').run()}
					/>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<ToolbarBtn
						active={editor.isActive('bulletList')}
						disabled={lockWhileSource}
						title="Danh sách không thứ tự"
						icon={<UnorderedListOutlined />}
						onClick={() => editor.chain().focus().toggleBulletList().run()}
					/>
					<ToolbarBtn
						active={editor.isActive('orderedList')}
						disabled={lockWhileSource}
						title="Danh sách có thứ tự"
						icon={<OrderedListOutlined />}
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
					/>
				</Space>

				<Divider type="vertical" style={{ height: 22 }} />

				<Space size={2}>
					<ToolbarBtn
						active={editor.isActive('link')}
						disabled={lockWhileSource}
						title="Thêm liên kết"
						icon={<LinkOutlined />}
						onClick={setLink}
					/>
					<ToolbarBtn
						disabled={lockWhileSource || !editor.isActive('link')}
						title="Gỡ liên kết"
						icon={<DisconnectOutlined />}
						onClick={() => editor.chain().focus().unsetLink().run()}
					/>
					<ToolbarBtn
						disabled={lockWhileSource}
						title="Xoá định dạng"
						icon={<ClearOutlined />}
						onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().setCasing(null).run()}
					/>
				</Space>

				<div className="rte-toolbar-end">
					<Tooltip title={isSourceMode ? 'Quay lại chế độ trực quan' : 'Xem / sửa mã nguồn HTML'}>
						<Button
							size="small"
							color={isSourceMode ? 'primary' : 'default'}
							variant={isSourceMode ? 'solid' : 'outlined'}
							disabled={disabled}
							icon={isSourceMode ? <EyeOutlined /> : <CodeOutlined />}
							onClick={toggleSourceMode}
						>
							{isSourceMode ? 'Trực quan' : 'Mã HTML'}
						</Button>
					</Tooltip>
				</div>
			</div>

			<div className="rte-body" style={{ minHeight }}>
				{isSourceMode ? (
					<Input.TextArea
						value={sourceValue}
						onChange={handleSourceChange}
						disabled={disabled}
						placeholder="Nhập mã nguồn HTML tại đây..."
						className="rte-source"
						style={{ minHeight }}
					/>
				) : (
					<div className="rte-content-scroll">
						<EditorContent editor={editor} className="rte-content" />
					</div>
				)}
			</div>

			<div className="rte-statusbar">
				<Space size="large">
					{activeCasing && (
						<span className="rte-casing-chip">
							Casing: {activeCasing === 'uppercase' ? 'CHỮ HOA' : activeCasing === 'lowercase' ? 'chữ thường' : 'Chữ Đầu'}
						</span>
					)}
					<span>
						Từ: <strong>{wordCount}</strong>
					</span>
					<span>
						Ký tự: <strong>{charCount}</strong>
					</span>
				</Space>
				<span>UniPrep Editor</span>
			</div>
		</div>
	);
};

export default RichTextEditor;
