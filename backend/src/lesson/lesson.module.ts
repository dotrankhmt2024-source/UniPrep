import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseSection } from '../course/entities/course-section.entity';
import { Enrollment } from '../course/entities/enrollment.entity';
import { Quiz } from '../exercise/entities/quiz.entity';
import { Submission } from '../exercise/entities/submission.entity';
import { CourseModule } from '../course/course.module';
import { StorageModule } from '../storage/storage.module';
import { LessonMaterial } from './entities/lesson-material.entity';
import { LessonProgress } from './entities/lesson-progress.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonService } from './lesson.service';
import { LessonsController } from './lessons.controller';
import { MaterialsController } from './materials.controller';
import { SectionsController } from './sections.controller';

/**
 * `LessonModule` (E3-T2 chương/bài học, E3-T4 học liệu).
 *
 * **Vì sao import `CourseModule`:** quyền trên chương/bài học là quyền **suy ra từ khoá học chứa
 * chúng**. `CourseAccessService` là nguồn chân lý duy nhất cho câu hỏi đó (và `CourseModule` đã
 * `exports` nó sẵn) — nếu `LessonModule` tự viết lại điều kiện "chủ sở hữu hoặc `course_instructors`"
 * thì hai module có thể bất đồng: chương hiện ra nhưng bấm vào bài lại `403`.
 *
 * **Vì sao `forFeature` liệt kê cả `Quiz`/`Submission`/`Enrollment`:** ba bảng này thuộc module khác
 * nhưng service chỉ **đọc** chúng để trả lời hai câu hỏi nghiệp vụ của E3-T2 — "bài/chương này đã có
 * dữ liệu học tập chưa" (chặn xoá) và "học viên này đã ghi danh chưa" (quy tắc hiển thị). Chỉ `read`,
 * không ghi, không sửa entity, nên không tạo phụ thuộc vòng: `ExerciseModule`/`CourseModule` không
 * import ngược `LessonModule`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			CourseSection,
			Lesson,
			LessonMaterial,
			LessonProgress,
			Quiz,
			Submission,
			Enrollment,
		]),
		CourseModule,
		// `StorageModule` là `@Global()` nhưng vẫn import tường minh: phụ thuộc hiện ra ngay trong
		// `imports` giúp đọc module là biết nó ghi tệp lên đĩa (và không phụ thuộc vào thứ tự nạp
		// module toàn cục).
		StorageModule,
	],
	controllers: [SectionsController, LessonsController, MaterialsController],
	providers: [LessonService],
	exports: [LessonService],
})
export class LessonModule {}
