/**
 * Thông điệp trả về cho người dùng của `CourseModule` — tiếng Việt theo quy ước
 * `database-design.md` §1.1 mục 7. Gom về một chỗ để FE và e2e so khớp được chuỗi ổn định.
 */
export const COURSE_MESSAGE = {
	notFound: (id: string) => `Không tìm thấy khoá học với ID ${id}`,
	codeExists: 'Mã khoá học này đã được sử dụng.',
	slugExists: 'Đường dẫn (slug) này đã được sử dụng.',
	notManageable: 'Bạn không phụ trách khoá học này.',
	notViewable: 'Khoá học này chưa được công bố.',
	created: 'Tạo khoá học thành công',
	updated: 'Cập nhật khoá học thành công',
	deleted: 'Đã xoá khoá học',
	published: 'Đã công bố khoá học',
	unpublished: 'Đã ẩn khoá học',
	publishNeedsLesson: 'Khoá học phải có ít nhất một bài học trước khi công bố.',
	deleteHasEnrollment: 'Không thể xoá khoá học đã có học viên ghi danh.',
	categoryNotFound: (id: string) => `Không tìm thấy danh mục với ID ${id}`,
	categoryExists: 'Danh mục này đã tồn tại.',
	categoryHasCourses: 'Không thể xoá danh mục đang có khoá học.',
	categoryCreated: 'Tạo danh mục thành công',
	categoryUpdated: 'Cập nhật danh mục thành công',
	categoryDeleted: 'Đã xoá danh mục',
	cohortNotFound: (id: string) => `Không tìm thấy lớp với ID ${id}`,
	cohortClassExists: 'Mã lớp này đã tồn tại trong khoá học.',
	cohortCreated: 'Tạo lớp thành công',
	cohortUpdated: 'Cập nhật lớp thành công',
	cohortDeleted: 'Đã xoá lớp',
	instructorNotFound: 'Người dùng này không phải giảng viên.',
	instructorExists: 'Giảng viên này đã được phân công cho khoá học.',
	instructorAssigned: 'Phân công giảng viên thành công',
	instructorRemoved: 'Đã gỡ phân công giảng viên',
	instructorIsOwner:
		'Đây là giảng viên phụ trách chính, không thể gỡ phân công.',
	prerequisiteSelf: 'Khoá học không thể là điều kiện tiên quyết của chính nó.',
	prerequisiteNotFound: (id: string) =>
		`Không tìm thấy khoá học tiên quyết với ID ${id}`,
	prerequisiteUpdated: 'Cập nhật điều kiện tiên quyết thành công',
	ownerNotFound: 'Không tìm thấy giảng viên phụ trách.',
	/**
	 * Trường hợp **thiếu** `ownerId` khi admin tạo khoá học — cố ý tách khỏi `ownerNotFound`.
	 * Khi admin bỏ trống ô chọn giảng viên, câu "không tìm thấy giảng viên phụ trách" khiến người
	 * dùng tưởng mình đã chọn sai người, trong khi lỗi thật là chưa chọn ai.
	 */
	ownerRequired:
		'Quản trị viên phải chỉ định giảng viên phụ trách khi tạo khoá học.',
	ownerMustBeTeacher: 'Người phụ trách khoá học phải có vai trò giảng viên.',
	enrolled: 'Đăng ký khoá học thành công',
	alreadyEnrolled: 'Bạn đã đăng ký khoá học này.',
	enrollmentClosed: 'Khoá học này không mở đăng ký.',
	enrollmentFull: 'Khoá học đã đủ số lượng học viên.',
	prerequisiteMissing: (titles: string[]) =>
		`Bạn cần hoàn thành khoá học tiên quyết trước: ${titles.join(', ')}.`,
};
