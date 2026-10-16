## Task

- **Mã task:** `E…-T…` (hoặc "Không thuộc WBS" kèm lý do)
- **Epic:**
- Closes #

## Đã làm gì

<!-- 2–5 gạch đầu dòng, mô tả thay đổi chứ không mô tả file. -->

-

## Bằng chứng (DoD của task)

<!-- Lệnh đã chạy + kết quả thật. Không viết "đã hoạt động". -->

- [ ] `npm run lint:ci` xanh (backend + frontend)
- [ ] `npm run build` xanh (backend + frontend)
- [ ] Nếu có đổi schema: đã thêm migration và chạy `npm run migration:run` + `npm run seed` trên DB sạch
- [ ] Nếu có đổi API: `docs/02-specs/api-specification.md` đã cập nhật trong cùng PR

## Ảnh hưởng

- **Phá vỡ tương thích?** (đổi tên cột/endpoint, đổi kiểu dữ liệu trả về)
- **Cần làm gì khi deploy?** (biến môi trường mới, chạy migration, seed lại)
- **Rủi ro đã biết / việc còn nợ:**

## Checklist của người mở PR

- [ ] Đã tự đọc lại diff của chính mình
- [ ] Không commit `.env`, `node_modules`, file build, dữ liệu upload
- [ ] Comment giải thích "vì sao" (không lặp lại code), `TODO` có kèm mã task
- [ ] Text hiển thị cho người dùng là tiếng Việt có dấu; định danh code là tiếng Anh
- [ ] Không dùng TS `enum` (dùng union type)
