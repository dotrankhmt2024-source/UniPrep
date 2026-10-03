import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CourseService } from './course.service';
import { Cohort } from './entities/cohort.entity';
import { Enrollment } from './entities/enrollment.entity';
import { COURSE_MESSAGE } from './constants/course-message.constant';
import { toCohortItem } from './course.mapper';
import type { UpdateCohortDto } from './dto/update-cohort.dto';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import type { CohortItem } from './types/course.type';

const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Nghiệp vụ lớp/nhóm học viên (E3-T1) — hai route `/api/cohorts/:id`.
 *
 * **Vì sao tách khỏi `CourseService`:** lớp được sửa/xoá qua `id` của chính nó, không qua khoá học
 * chứa nó. Nhưng quyền thì **vẫn** thuộc khoá học, nên service này mượn
 * `CourseService.assertCanManageCourse` thay vì tự suy luận — nếu tự viết lại điều kiện
 * `owner_id`/`course_instructors` thì hai module sẽ có hai định nghĩa "được sửa khoá học" khác nhau.
 *
 * **Xoá lớp là an toàn:** các FK đã là `ON DELETE SET NULL`
 * (`course_instructors.cohort_id`, `enrollments.cohort_id`), nên học viên vẫn giữ ghi danh và giảng
 * viên vẫn giữ phân công — cả hai chỉ thu hẹp phạm vi về "cả khoá". Không cần dọn tay, và việc
 * dọn tay ở đây sẽ là chỗ dễ sai (xoá quá tay mất phân công của lớp khác).
 */
@Injectable()
export class CohortService {
	constructor(
		@InjectRepository(Cohort)
		private readonly cohorts: Repository<Cohort>,
		@InjectRepository(Enrollment)
		private readonly enrollments: Repository<Enrollment>,
		private readonly courseService: CourseService,
	) {}

	/** `PATCH /api/cohorts/:id` (E3-T1) — `teacher` (được phân công)/`admin`. */
	async update(
		id: string,
		dto: UpdateCohortDto,
		actor: AuthUser,
	): Promise<CohortItem> {
		const cohort = await this.findOrFail(id);
		await this.courseService.assertCanManageCourse(cohort.courseId, actor);

		// Ghép giá trị mới với giá trị hiện có **trước** khi kiểm tra: client có thể chỉ gửi `endsOn`,
		// và khi đó quy tắc `endsOn >= startsOn` vẫn phải đúng với `startsOn` đang lưu trong DB.
		const startsOn =
			dto.startsOn !== undefined ? dto.startsOn : cohort.startsOn;
		const endsOn = dto.endsOn !== undefined ? dto.endsOn : cohort.endsOn;
		this.courseService.assertDateRange(startsOn, endsOn);

		if (dto.classCode !== undefined) {
			await this.courseService.assertClassCodeAvailable(
				cohort.courseId,
				dto.classCode,
				id,
			);
		}

		const changes: Partial<Cohort> = {};
		if (dto.name !== undefined) changes.name = dto.name;
		if (dto.classCode !== undefined) changes.classCode = dto.classCode;
		if (dto.groupCode !== undefined) changes.groupCode = dto.groupCode;
		if (dto.semester !== undefined) changes.semester = dto.semester;
		if (dto.startsOn !== undefined) changes.startsOn = dto.startsOn;
		if (dto.endsOn !== undefined) changes.endsOn = dto.endsOn;

		if (Object.keys(changes).length > 0) {
			try {
				await this.cohorts.update({ id }, changes);
			} catch (error) {
				this.rethrowDuplicate(error);
				throw error;
			}
		}

		const updated = await this.findOrFail(id);

		return toCohortItem(updated, await this.countMembers(id));
	}

	/** `DELETE /api/cohorts/:id` (E3-T1) — xoá cứng lớp; xem ghi chú `SET NULL` ở đầu class. */
	async remove(id: string, actor: AuthUser): Promise<void> {
		const cohort = await this.findOrFail(id);
		await this.courseService.assertCanManageCourse(cohort.courseId, actor);

		await this.cohorts.delete({ id });
	}

	private async findOrFail(id: string): Promise<Cohort> {
		const cohort = await this.cohorts.findOne({ where: { id } });

		if (!cohort) {
			throw new NotFoundException(COURSE_MESSAGE.cohortNotFound(id));
		}

		return cohort;
	}

	private async countMembers(cohortId: string): Promise<number> {
		// Lớp chưa có học viên vẫn phải trả `0` — hợp đồng `memberCount: number` với FE, không phải
		// `undefined`.
		return this.enrollments.count({ where: { cohortId } });
	}

	/**
	 * Dịch vi phạm ràng buộc duy nhất thành `409`.
	 *
	 * Ràng buộc thật là index **partial + unique** `uq_cohorts_course_class`
	 * (`course_id, class_code) WHERE class_code IS NOT NULL`; `assertClassCodeAvailable` đã kiểm tra
	 * trước, đây là lưới an toàn cho hai request sửa song song.
	 *
	 * `driverError` của `pg` chỉ được khai là `Error`, nên `code` phải đọc qua kiểu giao.
	 */
	private rethrowDuplicate(error: unknown): void {
		if (!(error instanceof QueryFailedError)) return;

		const driver = error.driverError as Error & { code?: string };
		if (driver.code === UNIQUE_VIOLATION_CODE) {
			throw new ConflictException(COURSE_MESSAGE.cohortClassExists);
		}
	}
}
