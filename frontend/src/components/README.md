# Bộ component dùng chung — UniPrep Frontend

> Đọc file này trước khi viết bất kỳ page nào. **Không copy HTML từ `frontend/design/*.html`.**
> 4 file trong `design/` chỉ là mockup tham khảo về bố cục/màu sắc, không phải nguồn component.

## Nền tảng

- **Tailwind CSS v4** + token Material 3 khai báo trong `src/styles/theme.css` (`@theme { … }`).
  Dùng class như `bg-surface-container-lowest`, `text-on-surface-variant`, `border-outline-variant`,
  `font-headline-lg`, `text-body-md`, `p-gutter`, `space-y-space-lg`…
- **Ant Design v6** cho các control phức tạp (Form, Table, Modal, Select, DatePicker…).
  Theme M3 của antd nằm ở `src/config/antd-theme/index.ts` và được nạp 1 lần trong `src/App.tsx`
  qua `ConfigProvider`. Muốn đổi màu/bo góc toàn hệ thống → sửa ở đó, **không** sửa trong page.
- **@tiptap** cho rich text editor.
- **Scrollbar**: đã style lại toàn cục ở `src/styles/scrollbar.css` (thumb mảnh, màu theo token M3,
  tự đổi light/dark). Page **không** cần style lại scrollbar. Cần ẩn scrollbar nhưng vẫn cuộn được
  (dải tab/filter ngang) thì thêm class `scrollbar-hidden`.

## Layout

`src/layouts/private` sở hữu `Header` + `Sider` + `<Outlet />`. Page **chỉ render nội dung trang**:

```tsx
const SomePage = () => (
  <div className="p-gutter space-y-space-lg">
    {/* nội dung */}
  </div>
);
```

Không tự dựng header/sidebar/menu trong page. Muốn thêm mục menu → sửa `src/config/sider-options/index.tsx`.

## Danh sách component

| Component | Import | Dùng để làm gì |
|---|---|---|
| `ISolidBtn` | `@/components` | Nút chính (filled). `background="default" \| "primary" \| "error"` |
| `IOutLinedBtn` | `@/components` | Nút phụ (outlined). `mode="default" \| "primary" \| "error"` |
| `IconBtn` | `@/components` | Nút chỉ có icon (row action, đóng modal, toggle…) |
| `FormItem` | `@/components` | Field trong `<Form>`: `formItemProps` + `rules` + `inputProps`, hoặc truyền `children` là control khác |
| `ITable` | `@/components` | Bảng dữ liệu (bọc antd Table: STT tự động, scroll ngang, phân trang) |
| `PasswordInput` | `@/components` | Field "Mật khẩu" + policy 8–16 ký tự, hoa/thường/số/ký tự đặc biệt |
| `ConfirmPassword` | `@/components` | Field "Xác nhận mật khẩu", cần truyền `form` instance |
| `RichTextEditor` | `@/components` | Editor HTML (TipTap), controlled qua `value` / `onChange`, dùng được trong `Form.Item` |
| `Badge` | `@/components` | Pill trạng thái. `status="success" \| "warning" \| "error" \| "info" \| "neutral" \| "processing"` |
| `ErrorBadge` | `@/components` | `Badge` với `status="error"` — dùng để hiển thị lỗi validate/API |
| `Icon` | `@/components` | Wrapper Material Symbols: `<Icon name="school" size={18} />` |

`ITable` yêu cầu prop `pagination` (`{ total, pageSize, current, onChange }` hoặc `false`).

## Quy tắc

1. **Không** viết `<button className="…">` thủ công → dùng `ISolidBtn` / `IOutLinedBtn` / `IconBtn`.
   Ngoại lệ: với các biến thể mà wrapper không bao phủ (`variant="link"`, `variant="text"` trong bảng),
   được phép dùng thẳng `Button` của antd — vẫn là component thư viện, không phải HTML tự viết.
2. **Không** viết `<table>` / `<thead>` / `<tbody>` thủ công → dùng `ITable` + cột `TableProps<T>['columns']`.
3. **Không** viết `<label>` + `<input>` thủ công trong form → dùng `<Form>` của antd + `FormItem`.
4. **Không** viết `<span className="… rounded-full …">` cho trạng thái → dùng `Badge`.
5. **Không** viết `<span className="material-symbols-outlined">…</span>` → dùng `Icon`.
6. Error/lỗi API hiển thị bằng `ErrorBadge` (kèm `Icon name="error"`), không dùng div trần.
7. Luồng dữ liệu chuẩn của một module: `apis/<feature>` → `types/<feature>` → `pages/<feature>`.
   Xem ví dụ hoàn chỉnh ở `src/pages/student/index.tsx`.

## Ví dụ nhanh

```tsx
import { Form, Select, type TableProps } from 'antd';
import { Badge, ErrorBadge, FormItem, ITable, ISolidBtn, IOutLinedBtn } from '@/components';

const columns: TableProps<Student>['columns'] = [
  { title: 'Mã SV', dataIndex: 'studentCode' },
  {
    title: 'Trạng thái',
    dataIndex: 'isActive',
    render: (isActive: boolean) => <Badge status={isActive ? 'success' : 'neutral'} dot>{isActive ? 'Đang học' : 'Ngưng học'}</Badge>,
  },
];

<ITable<Student> columns={columns} dataSource={rows} loading={isLoading} pagination={false} rowKey="id" />

<Form layout="vertical">
  <FormItem formItemProps={{ label: 'Mã SV', name: 'studentCode' }} rules={[{ required: true }]} />
  <FormItem formItemProps={{ label: 'Ngành', name: 'major' }}>
    <Select size="large" options={majorOptions} />
  </FormItem>
</Form>

<ISolidBtn icon={<PlusOutlined />}>Thêm mới</ISolidBtn>
<IOutLinedBtn>Hủy bỏ</IOutLinedBtn>
```
