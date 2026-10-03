import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Cohort } from './entities/cohort.entity';
import { CourseInstructor } from './entities/course-instructor.entity';
import { CoursePrerequisite } from './entities/course-prerequisite.entity';
import { CourseSection } from './entities/course-section.entity';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User } from '../user/entities/user.entity';
import { CourseAccessService } from './course-access.service';
import { CourseEligibilityService } from './course-eligibility.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CohortController } from './cohort.controller';
import { CohortService } from './cohort.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';

/**
 * `CourseModule` — danh mục, khoá học, phân công giảng viên, lớp và điều kiện tiên quyết
 * (`docs/architecture.md` §4; mã lỗi/endpoint ở `api-specification.md` §CourseModule).
 *
 * **Vì sao `CourseAccessService` và `CourseEligibilityService` được `exports`:** `LessonModule`
 * phải dùng **cùng** phép kiểm tra quyền và cùng định nghĩa "đủ điều kiện" — nếu nó tự viết lại
 * thì hai module có thể bất đồng (ví dụ chương hiện ra nhưng bấm vào bài lại 403).
 *
 * `User` nằm trong `forFeature` vì `CourseService` phải kiểm tra "chủ sở hữu được chỉ định có vai
 * trò `teacher`" — đọc thẳng repository thay vì import `UserModule` để tránh phụ thuộc vòng
 * (`UserModule` không biết gì về khoá học, nhưng `Course` đã trỏ tới `User` qua FK).
 *
 * `CourseSection` chỉ để đếm số chương; bảng `lessons` được đếm bằng truy vấn thô vì nó thuộc
 * `LessonModule` (xem ghi chú ở `CourseService.countLessons`).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			Course,
			Category,
			Cohort,
			CourseInstructor,
			CoursePrerequisite,
			CourseSection,
			Enrollment,
			User,
		]),
	],
	controllers: [
		CategoryController,
		CourseController,
		CohortController,
		// Ghi danh nằm cùng module vì nó là lát cắt tối thiểu của E4-T1 được kéo sang E3-T7 và dùng
		// chung `CourseEligibilityService` (xem `EnrollmentService`). E4 sẽ mở rộng chính service này.
		EnrollmentController,
	],
	providers: [
		CourseAccessService,
		CourseEligibilityService,
		CategoryService,
		CourseService,
		CohortService,
		EnrollmentService,
	],
	exports: [CourseAccessService, CourseEligibilityService],
})
export class CourseModule {}
