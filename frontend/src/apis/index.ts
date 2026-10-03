/**
 * Barrel của tầng `apis/`.
 *
 * Module `student` (CRUD mẫu) đã bị xoá ở E0 vì bảng `students` là bảng legacy:
 * schema thật dùng `users` + `enrollments`. Barrel này để trống có chủ đích —
 * feature đầu tiên có API thật sẽ export ở đây (ví dụ `export * from './course'`
 * khi E3-T6 nối catalog thật thay cho `src/mocks/course.ts`).
 */
export {};
