/**
 * Thông điệp trả về cho người dùng của `LessonModule` (E3-T2/E3-T4) — tiếng Việt theo quy ước
 * `database-design.md` §1.1 mục 7 và cách làm của `USER_MESSAGE`/`COURSE_MESSAGE`.
 *
 * Gom về một chỗ vì e2e (`test/`) và FE so khớp **nguyên văn** chuỗi: nếu service tự viết chuỗi thì
 * chỉ cần một lần sửa câu chữ ở một nhánh là test đỏ trong khi hành vi vẫn đúng.
 */
export const LESSON_MESSAGE = {
	// ----- Lỗi -----
	sectionNotFound: (id: string) => `Không tìm thấy chương với ID ${id}`,
	lessonNotFound: (id: string) => `Không tìm thấy bài học với ID ${id}`,
	materialNotFound: (id: string) => `Không tìm thấy học liệu với ID ${id}`,
	/** Xoá chương còn dấu vết học tập của học viên = mất dữ liệu analytics (E3-T2 DoD). */
	sectionHasSubmissions:
		'Không thể xoá chương vì đã có bài làm hoặc tiến độ học tập của học viên.',
	lessonHasSubmissions:
		'Không thể xoá bài học vì đã có bài làm hoặc tiến độ học tập của học viên.',
	/** Dùng chung cho học liệu: quy tắc hiển thị phải khớp `GET /api/lessons/:id`. */
	notAccessible: 'Bạn không có quyền truy cập bài học này.',
	invalidFileName: 'Tên tệp không hợp lệ.',
	missingFile: 'Vui lòng chọn tệp để tải lên.',

	// ----- Sắp xếp lại -----
	reorderInvalidPayload:
		'Danh sách sắp xếp không hợp lệ: các mục phải khớp đúng và đủ tập bản ghi hiện có.',
	reorderDuplicateIds: 'Danh sách sắp xếp không được có ID trùng nhau.',
	reorderDuplicateOrder: 'Danh sách sắp xếp không được có thứ tự trùng nhau.',
	reorderNotContiguous:
		'Thứ tự sắp xếp phải là dãy liên tục bắt đầu từ 1 (1, 2, 3, …).',
	reorderMissingIds:
		'Danh sách sắp xếp phải bao gồm mọi bản ghi hiện có, không được thiếu mục nào.',
	reorderUnknownIds:
		'Danh sách sắp xếp chứa bản ghi không thuộc phạm vi cho phép.',

	// ----- Thành công: chương -----
	sectionCreated: 'Tạo chương thành công',
	sectionUpdated: 'Cập nhật chương thành công',
	sectionDeleted: 'Đã xoá chương',
	sectionsReordered: 'Đã cập nhật thứ tự chương',

	// ----- Thành công: bài học -----
	lessonCreated: 'Tạo bài học thành công',
	lessonUpdated: 'Cập nhật bài học thành công',
	lessonDeleted: 'Đã xoá bài học',
	lessonsReordered: 'Đã cập nhật thứ tự bài học',
	lessonPublished: 'Đã công bố bài học',
	lessonHidden: 'Đã ẩn bài học',

	// ----- Thành công: học liệu -----
	materialUploaded: 'Tải học liệu lên thành công',
	materialDeleted: 'Đã xoá học liệu',
} as const;
