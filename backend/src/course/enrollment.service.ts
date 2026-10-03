import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Cohort } from './entities/cohort.entity';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { CourseEligibilityService } from './course-eligibility.service';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { MyEnrollmentSummary } from './types/course.type';

/**
 * Ghi danh — **lát cắt tối thiểu của E4-T1 được kéo sang E3**.
 *
 * **Vì sao cần ở E3:** DoD của E3-T7 đòi "nút đăng ký gọi API thật và phản ánh trạng thái đã
 * đăng ký", mà trước E3 chưa có đường nào tạo dòng `enrollments`. Không có nó thì nút đăng ký chỉ
 * là giao diện giả, và `GET /api/lessons/:id` (E3-T2) không thể kiểm chứng quy tắc "học viên phải
 * đã ghi danh mới xem được bài".
 *
 * **Phần còn lại của E4-T1 vẫn thuộc E4:** danh sách khoá đã đăng ký, huỷ ghi danh, tính
 * `progress_percent`. Ở đây chỉ có `POST /api/enrollments`.
 */
@Injectable()
export class EnrollmentService {
	constructor(
		@InjectRepository(Enrollment)
		private readonly enrollmentRepository: Repository<Enrollment>,
		@InjectRepository(Course)
		private readonly courseRepository: Repository<Course>,
		@InjectRepository(Cohort)
		private readonly cohortRepository: Repository<Cohort>,
		private readonly courseEligibilityService: CourseEligibilityService,
	) {}

	/**
	 * Đăng ký khoá học cho **chính** người đang gọi.
	 *
	 * Thứ tự kiểm tra cố ý: rẻ → đắt, và mọi nhánh từ chối đều trả **lỗi nghiệp vụ nói rõ lý do**
	 * (không phải `500`), vì DoD E4-T1 yêu cầu "đăng ký trùng trả lỗi nghiệp vụ rõ ràng".
	 */
	async enroll(
		actor: AuthUser,
		dto: CreateEnrollmentDto,
	): Promise<MyEnrollmentSummary> {
		const course = await this.courseRepository.findOne({
			where: { id: dto.courseId, deletedAt: IsNull() },
		});

		if (!course) {
			throw new NotFoundException(COURSE_MESSAGE.notFound(dto.courseId));
		}

		// Học viên chỉ đăng ký được khoá đã publish và không phải khoá riêng tư; giảng viên/admin
		// cũng đi qua đúng cửa này để không có đường tắt nào bỏ qua vòng đời nội dung.
		if (course.status !== 'published' || course.visibility === 'private') {
			throw new BadRequestException(COURSE_MESSAGE.enrollmentClosed);
		}

		if (!course.enrollmentOpen) {
			throw new BadRequestException(COURSE_MESSAGE.enrollmentClosed);
		}

		if (dto.cohortId) {
			const cohort = await this.cohortRepository.findOne({
				where: { id: dto.cohortId },
			});

			// Lớp phải thuộc đúng khoá đang đăng ký: nếu không, một học viên có thể tự gắn mình vào
			// lớp của khoá khác và làm sai toàn bộ phạm vi dữ liệu của giảng viên (E8).
			if (!cohort || cohort.courseId !== course.id) {
				throw new NotFoundException(
					COURSE_MESSAGE.cohortNotFound(dto.cohortId),
				);
			}
		}

		if (course.maxStudents !== null) {
			// Học viên đã huỷ ghi danh không chiếm chỗ.
			const enrolledCount = await this.enrollmentRepository.count({
				where: { courseId: course.id, status: Not('dropped') },
			});

			if (enrolledCount >= course.maxStudents) {
				throw new BadRequestException(COURSE_MESSAGE.enrollmentFull);
			}
		}

		const existing = await this.enrollmentRepository.findOne({
			where: { userId: actor.id, courseId: course.id },
		});

		if (existing) {
			// Ghi danh đã huỷ thì mở lại thay vì tạo dòng thứ hai — bảng có UNIQUE (user_id,
			// course_id) nên tạo dòng mới là bất khả thi, và mở lại giữ được lịch sử học.
			if (existing.status === 'dropped') {
				existing.status = 'active';
				existing.droppedAt = null;
				existing.cohortId = dto.cohortId ?? existing.cohortId;
				const reopened = await this.enrollmentRepository.save(existing);

				return this.toSummary(reopened);
			}

			throw new ConflictException(COURSE_MESSAGE.alreadyEnrolled);
		}

		// Điều kiện tiên quyết kiểm tra sau cùng vì đây là phép kiểm tra đắt nhất (join 3 bảng) và
		// là điều kiện duy nhất cần dữ liệu học tập của người gọi.
		await this.courseEligibilityService.assertEligible(course.id, actor.id);

		const enrollment = this.enrollmentRepository.create({
			userId: actor.id,
			courseId: course.id,
			cohortId: dto.cohortId ?? null,
			status: 'active',
			source: 'self',
			progressPercent: 0,
		});

		try {
			return this.toSummary(await this.enrollmentRepository.save(enrollment));
		} catch (error) {
			// Hai request ghi danh song song cùng vượt qua bước `findOne` ở trên; ràng buộc
			// UNIQUE (user_id, course_id) là chốt chặn cuối. Dịch mã lỗi Postgres thành cùng
			// thông điệp nghiệp vụ thay vì để lộ `500`.
			if (this.isUniqueViolation(error)) {
				throw new ConflictException(COURSE_MESSAGE.alreadyEnrolled);
			}

			throw error;
		}
	}

	private toSummary(enrollment: Enrollment): MyEnrollmentSummary {
		return {
			id: enrollment.id,
			status: enrollment.status,
			progressPercent: Number(enrollment.progressPercent ?? 0),
			enrolledAt: enrollment.enrolledAt,
			completedAt: enrollment.completedAt,
		};
	}

	private isUniqueViolation(error: unknown): boolean {
		const driverError = (error as { driverError?: { code?: string } })
			?.driverError;

		return driverError?.code === '23505';
	}
}
