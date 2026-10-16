# Quy ước lập trình — UniPrep

> Phiên bản: v0.1 — Ngày: 2026-09-19
> Áp dụng cho: `UniPrep/backend` (NestJS), `UniPrep/frontend` (React), và service `ai-service` (FastAPI) khi được thêm vào.

Tài liệu này là quy ước **bắt buộc**. Mục đích: để ba người viết ba module khác nhau mà code vẫn
trông như một người viết, và để review PR chỉ tập trung vào logic chứ không tranh luận về style.

Đọc kèm: `../UniPrep/README.md` (quy ước đã có trong repo), `../UniPrep/frontend/src/components/README.md`
(bộ component dùng chung), `02-specs/api-specification.md` (hợp đồng API), `02-specs/database-design.md`
(thiết kế dữ liệu).

---

## 1. Nguyên tắc nền

1. **Một module làm một việc.** NestJS module tách theo nghiệp vụ (`AuthModule`, `CourseModule`…),
   không tách theo loại file.
2. **Ranh giới rõ giữa các tầng.** Controller không chứa logic nghiệp vụ; Service không biết về
   HTTP; Repository không chứa quy tắc nghiệp vụ.
3. **Kiểm tra quyền ở server.** Ẩn nút trên UI không phải bảo mật. Mọi ràng buộc "ai được xem gì"
   phải nằm trong guard/query ở backend.
4. **Không phá vỡ hợp đồng API.** Đổi hình dạng response là thay đổi phá vỡ (breaking change) —
   phải sửa tài liệu và báo frontend.
5. **Code đọc được quan trọng hơn code ngắn.** Ưu tiên tên rõ nghĩa, hàm nhỏ, sớm return.
6. **Không tối ưu sớm.** Làm đúng trước, đo sau, chỉ tối ưu chỗ được đo là chậm.
7. **Viết test cho logic có rẽ nhánh.** Không cần phủ 100%, nhưng quy tắc nghiệp vụ thì phải có test.

---

## 2. Quy ước chung cho mọi ngôn ngữ

### 2.1 Ngôn ngữ của định danh và của văn bản

Đây là quy ước quan trọng nhất của dự án và dễ vi phạm nhất.

| Loại | Ngôn ngữ | Ví dụ |
|---|---|---|
| Tên bảng, cột trong Postgres | Tiếng Anh, snake_case | `learning_events`, `occurred_at` |
| Tên class, biến, hàm trong code | Tiếng Anh | `LearningActivityService`, `riskScore` |
| Tên file, thư mục | Tiếng Anh, kebab-case (FE) / nest convention (BE) | `analytics-ai-design.md`, `transform-response.interceptor.ts` |
| Endpoint API, field JSON | Tiếng Anh, camelCase cho JSON | `POST /api/learning-events`, `{"riskScore": 0.72}` |
| **Text hiển thị cho người dùng** | **Tiếng Việt có dấu** | `'Không tìm thấy sinh viên với ID …'` |
| **Message lỗi API trả về** | **Tiếng Việt có dấu** | `'Email đã được sử dụng'` |
| Comment giải thích "vì sao" | Tiếng Việt hoặc tiếng Anh đều được — **nhất quán trong cùng một file** | Xem §2.5 |
| Commit message | Tiếng Anh (Conventional Commits) | `feat(auth): add refresh token rotation` |

Lý do: định danh tiếng Anh để không phải đổi tên khi copy snippet, đọc thư viện, hoặc khi có thành
viên không thạo tiếng Việt; text người dùng tiếng Việt vì sản phẩm phục vụ sinh viên Việt Nam.

```ts
// ✅ Đúng
throw new NotFoundException(`Không tìm thấy học viên với ID ${id}`);

// ❌ Sai — định danh tiếng Việt
const danhSachHocVien = await this.hocVienRepo.find();

// ❌ Sai — text người dùng tiếng Anh
throw new NotFoundException(`Learner with ID ${id} not found`);
```

### 2.2 Không dùng `enum` của TypeScript

Dùng **union type**. Lý do: cột trong Postgres là `varchar`, union type khớp trực tiếp với giá trị
lưu trong DB và không sinh thêm mã JavaScript khi biên dịch.

```ts
// ✅ Đúng
export type UserRole = 'student' | 'teacher' | 'admin';
export type RiskLevel = 'low' | 'medium' | 'high';

// ❌ Sai
export enum UserRole {
	Student = 'student',
	Teacher = 'teacher',
}
```

Kèm theo đó, mọi union type dùng để hiển thị phải có **bảng nhãn tiếng Việt**, theo đúng mẫu đã có
trong `frontend/src/types/course.ts`:

```ts
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
	'in-progress': 'Đang học',
	future: 'Sắp tới',
	past: 'Đã kết thúc',
};
```

Không viết `status === 'in-progress' ? 'Đang học' : …` rải rác trong page — nhãn là dữ liệu, không
phải logic giao diện.

### 2.3 Định dạng file

| | Backend | Frontend |
|---|---|---|
| Thụt lề | **Tab** (`useTabs: true` trong `.prettierrc`) | Tab |
| Dấu nháy | Nháy đơn `'` | Nháy đơn `'` |
| Dấu phẩy cuối | Có (`trailingComma: "all"`) | Có |
| Cuối dòng | `auto` | `auto` |
| Dấu chấm phẩy | Có | Có |

Chạy `npm run lint` (backend: `eslint "src/**/*.ts" --fix`; frontend: `eslint .`) trước khi commit.
Trước khi mở PR, chạy thêm bản không `--fix` đúng như CI (`npx eslint "src/**/*.ts"` ở backend) —
CI báo lỗi chứ không tự sửa, nên lint ở máy tự sửa không chứng minh được CI sẽ xanh.

Không sửa file chỉ để đổi định dạng — làm loãng diff và gây xung đột merge.

### 2.4 Đặt tên

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Class, interface, type, component React | `PascalCase` | `CourseService`, `RiskPrediction`, `ITable` |
| Biến, hàm, tham số, field | `camelCase` | `riskScore`, `findAllByCourse` |
| Hằng số cấp module | `SCREAMING_SNAKE_CASE` | `MAX_EVENT_BATCH_SIZE` |
| File NestJS | `<tên>.<loại>.ts` | `course.service.ts`, `create-course.dto.ts` |
| Thư mục NestJS | kebab-case, một thư mục một module | `learning-activity/` |
| Thư mục React feature | kebab-case | `course-list/`, `risk-dashboard/` |
| Component React | `PascalCase`, mỗi component một thư mục có `index.tsx` | `components/Badge/index.tsx` |
| Hook React | `use` + `PascalCase` | `useDebounce`, `useMutation` |
| Bảng/cột Postgres | `snake_case`, bảng số nhiều | `learning_events.occurred_at` |

Tiền tố `I` (như `ITable`, `ISolidBtn`) là quy ước **đã có sẵn** trong bộ component dùng chung —
giữ nguyên khi thêm component mới vào `frontend/src/components/`. Không dùng tiền tố `I` cho
interface thông thường (`Course`, không phải `ICourse`).

### 2.5 Comment

- Comment giải thích **vì sao**, không giải thích **cái gì**. Code đã nói cái gì.
  ```ts
  // ❌ Vô nghĩa
  // Tăng i lên 1
  i++;

  // ✅ Có giá trị — giải thích lý do của một quyết định không hiển nhiên
  // BullMQ chỉ nhận payload JSON nên ngày phải chuyển sang ISO string ở đây,
  // worker Python parse lại bằng datetime.fromisoformat.
  occurredAt: event.occurredAt.toISOString(),
  ```
- Comment trên **cùng một file** phải cùng ngôn ngữ. File mới: viết tiếng Việt (khớp với
  `frontend/src/components/README.md` và đa số file hiện có).
- Không để lại comment `// TODO` vô chủ. Ghi kèm mã task: `// TODO(E7-T2): thêm rate limit theo user_id`.
- Không commit code đã bị comment-out. Dùng Git.

---

## 3. Quy ước Backend (NestJS)

### 3.1 Cấu trúc thư mục

Mỗi module nghiệp vụ là một thư mục trong `backend/src/`. Cấu trúc chuẩn **đã có sẵn ở các module
entity của E0** (ví dụ `backend/src/user/`, `backend/src/exercise/`): hiện mới có `entities/`, các epic
tương ứng thêm `dto/`, service, controller, module.

```
backend/src/<module>/
├── dto/
│   ├── create-<entity>.dto.ts     # DTO cho POST
│   ├── update-<entity>.dto.ts     # DTO cho PATCH — PartialType(CreateDto)
│   └── <action>-query.dto.ts       # DTO cho query params (lọc/phân trang), nếu dài
├── entities/
│   └── <entity>.entity.ts
├── <module>.controller.ts         # chỉ khai báo route, gọi service
├── <module>.service.ts            # logic nghiệp vụ
└── <module>.module.ts             # đăng ký controller/provider/imports
```

Quy ước chung trong `backend/src/common/`:

- `dto/api-response.dto.ts` — khuôn dạng envelope (`buildSuccess`, `ApiResponseDto`).
- `entities/base-custom.entity.ts` — `BaseEntityCustom` (`id`, `createdAt`, `updatedAt`).
- `filters/all-exceptions.filter.ts` — bắt mọi exception, trả envelope lỗi.
- `interceptors/transform-response.interceptor.ts` — bọc response thành công vào envelope.
- `decorators/` (**cần thêm**) — `@CurrentUser()`, `@Roles()`.
- `guards/` (**cần thêm**) — `JwtAuthGuard`, `RolesGuard`.
- `constants/` (**cần thêm**) — hằng số dùng chung.

### 3.2 Entity

Quy tắc:

1. Kế thừa `BaseEntityCustom` để có `id` (UUID), `createdAt`, `updatedAt`.
2. `@Entity('tên_bảng_snake_case_số_nhiều')`.
3. **Mọi `@Column` ghi rõ `name`** là snake_case.
4. Kiểu nullable khai báo `| null` và `nullable: true`.
5. Quan hệ ghi rõ `onDelete` — không để mặc định.
6. Không dùng `enum` — cột union type là `varchar`.
7. Không trả entity thô ra ngoài nếu entity chứa trường nhạy cảm (`passwordHash`,
   `refreshTokenHash`) — dùng mapper hoặc `@Exclude()`.

> ### ⚠️ Lỗi cần sửa TRƯỚC migration đầu tiên: `BaseEntityCustom` chưa snake_case
>
> `backend/src/common/entities/base-custom.entity.ts` hiện khai báo:
>
> ```ts
> @PrimaryGeneratedColumn('uuid') id: string;
> @CreateDateColumn() createdAt: Date;   // ← KHÔNG có name
> @UpdateDateColumn() updatedAt: Date;   // ← KHÔNG có name
> ```
>
> Vì không ghi `name` và dự án **không** cấu hình `SnakeNamingStrategy`, TypeORM 0.3 dùng
> `DefaultNamingStrategy` → tên cột sinh ra là **`createdAt` / `updatedAt` (camelCase)**, không phải
> `created_at` / `updated_at`. Trong khi mọi `@Column` khác đều ghi rõ `name` là snake_case, kết quả
> là một schema **trộn hai kiểu đặt tên** — đúng loại lỗi rất khó phát hiện bằng mắt và rất tốn công
> sửa sau khi đã có dữ liệu.
>
> **Bắt buộc chọn một trong hai cách và làm ngay ở task E0-T4/E0-T5 (trước migration baseline):**
>
> - **Cách A (khuyến nghị):** ghi rõ `name` trong entity cơ sở —
>   `@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })` và
>   `@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })`. Ít thay đổi nhất, không ảnh
>   hưởng tới các entity đã viết.
> - **Cách B:** cấu hình `namingStrategy: new SnakeNamingStrategy()` trong `TypeOrmModule.forRootAsync`
>   (cần cài `typeorm-naming-strategies`). Khi đó **bỏ** `name:` ở mọi `@Column` để tránh khai báo
>   trùng, tức là phải sửa lại toàn bộ entity đã viết.
>
> Ngoài ra `id` của `BaseEntityCustom` cũng nên khai báo `@PrimaryGeneratedColumn('uuid', { name: 'id' })`
> cho nhất quán (giá trị mặc định đã đúng nên đây chỉ là việc ghi rõ).
>
> **Trước khi sửa, kiểm tra lại bằng thực nghiệm** — đừng suy đoán: tạo một bảng tạm bằng
> `synchronize` trên DB dev rồi chạy `\d <tên_bảng>` trong `psql` để xem tên cột thật. Ghi kết luận
> vào `02-specs/database-design.md` §1.2 (mục đã nêu phát hiện này) và chốt cách A hay B.


```ts
// backend/src/course/entities/course.entity.ts
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { Category } from '../../category/entities/category.entity';
import { User } from '../../user/entities/user.entity';
import { CourseSection } from './course-section.entity';

export type CourseStatus = 'draft' | 'published' | 'archived';

@Entity('courses')
export class Course extends BaseEntityCustom {
	@Column({ type: 'varchar', name: 'code', length: 50, unique: true })
	code: string;

	@Column({ type: 'varchar', name: 'name', length: 255 })
	name: string;

	@Column({ type: 'text', name: 'description', nullable: true })
	description: string | null;

	@Column({ type: 'varchar', name: 'status', length: 20, default: 'draft' })
	status: CourseStatus;

	@Column({ type: 'boolean', name: 'is_published', default: false })
	isPublished: boolean;

	@Column({ name: 'category_id', type: 'uuid', nullable: true })
	categoryId: string | null;

	@ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'category_id' })
	category: Category | null;

	@Column({ name: 'teacher_id', type: 'uuid' })
	teacherId: string;

	@ManyToOne(() => User, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'teacher_id' })
	teacher: User;

	@OneToMany(() => CourseSection, (section) => section.course)
	sections: CourseSection[];
}
```

> Lưu ý về tên cột: khai báo `@Column({ name: 'category_id' })` **và** `@JoinColumn({ name: 'category_id' })`
> là cố ý — cách này cho phép truy vấn bằng `categoryId` mà không phải join, đồng thời TypeORM hiểu
> đúng khoá ngoại. Đây là mẫu chuẩn cho mọi quan hệ `ManyToOne` trong dự án.

### 3.3 DTO và validation

Mọi input từ client đi qua DTO có `class-validator`. `ValidationPipe` toàn cục đã bật `whitelist`,
nên field lạ tự động bị loại — nhưng **vẫn phải** ghi decorator validate cho field hợp lệ.

```ts
// backend/src/course/dto/create-course.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';

export class CreateCourseDto {
	@ApiProperty({ example: 'CO2004', description: 'Mã khoá học' })
	@IsString()
	@IsNotEmpty({ message: 'Mã khoá học không được để trống' })
	@MaxLength(50, { message: 'Mã khoá học tối đa 50 ký tự' })
	code: string;

	@ApiProperty({ example: 'Cấu trúc dữ liệu và Giải thuật' })
	@IsString()
	@IsNotEmpty({ message: 'Tên khoá học không được để trống' })
	name: string;

	@ApiPropertyOptional({ description: 'ID danh mục' })
	@IsUUID('4', { message: 'ID danh mục không hợp lệ' })
	@IsOptional()
	categoryId?: string;
}
```

Quy tắc:

1. **Mọi field có `@ApiProperty` / `@ApiPropertyOptional`** để Swagger hiển thị đúng. Đây là cách
   frontend và service AI đọc hợp đồng — không có nó thì Swagger vô dụng.
2. **Message lỗi bằng tiếng Việt**, ghi rõ trong `message:` khi thông báo mặc định của thư viện
   không đủ rõ. Thông báo mặc định của `class-validator` là tiếng Anh ("should not be empty"); nhóm
   chấp nhận dạng `"field: should not be empty"` do `flattenValidationErrors` sinh ra, nhưng field
   quan trọng với người dùng thì nên có message tiếng Việt.
3. DTO cập nhật dùng `PartialType`:
   ```ts
   import { PartialType } from '@nestjs/swagger';
   export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
   ```
4. **Không** đưa field chỉ-hệ-thống vào DTO tạo/sửa (`id`, `createdAt`, `isPublished` nếu việc
   publish có endpoint riêng). Không bao giờ nhận `role` từ client trong `RegisterDto` — vai trò
   do server quyết định.

**Phân trang (chốt ở E2, 2026-10-03).** Mọi endpoint danh sách kế thừa
`PaginationQueryDto` (`backend/src/common/dto/pagination-query.dto.ts`) rồi khai thêm bộ lọc và
`sortBy` của riêng mình, và trả `{ items, meta }` với `meta` dựng bằng
`buildPageMeta(total, page, take)` (`common/utils/pagination.util.ts`, `total` lấy từ
`getManyAndCount`):

- `take` **có trần** (`MAX_TAKE = 100`); `page ≥ 1`; vi phạm → `400` chứ không âm thầm cắt bớt. Query
  string luôn là chuỗi nên phải có `@Type(() => Number)` (repo không bật `enableImplicitConversion`).
- `sortBy` là **danh sách trắng** (`@IsIn([...])` + bảng ánh xạ sang tên cột): tên cột trong `ORDER BY`
  không tham số hoá được, nhận chuỗi tự do là lỗ hổng SQL injection.
- `ORDER BY` luôn có khoá phụ `id` — thiếu nó thì hai trang có thể lặp hoặc sót bản ghi khi giá trị
  sắp xếp trùng nhau.
- `meta.itemCount` là **TỔNG số bản ghi khớp điều kiện** (không phải số dòng của trang) và
  `pageCount = max(1, ceil(itemCount / take))` — đúng §3.4 của `api-specification.md`. Frontend truyền
  thẳng `itemCount` vào `pagination.total` của `ITable`; hiểu sai chỗ này thì bảng chỉ có một trang.
- Hình dạng `meta` khớp **nguyên văn** `PageMetaDto` của frontend (`frontend/src/types/index.ts`) —
  đổi một trường là vỡ `ITable`.

### 3.4 Controller

Controller chỉ: khai báo route, khai báo quyền, gọi service. Không `if/else` nghiệp vụ, không
truy cập repository.

```ts
@ApiTags('Course')
@ApiBearerAuth()
@Controller('courses')
export class CourseController {
	constructor(private readonly courseService: CourseService) {}

	@Post()
	@Roles('teacher', 'admin')
	@ApiOperation({ summary: 'Tạo khoá học' })
	create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCourseDto) {
		return this.courseService.create(dto, user);
	}

	@Get()
	@ApiOperation({ summary: 'Danh sách khoá học (tìm kiếm, lọc, phân trang)' })
	findAll(@Query() query: FindCoursesQueryDto) {
		return this.courseService.findAll(query);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Chi tiết khoá học' })
	findOne(@Param('id', ParseUUIDPipe) id: string) {
		return this.courseService.findOne(id);
	}

	@Patch(':id')
	@Roles('teacher', 'admin')
	@ApiOperation({ summary: 'Cập nhật khoá học' })
	update(
		@Param('id', ParseUUIDPipe) id: string,
		@CurrentUser() user: JwtPayload,
		@Body() dto: UpdateCourseDto,
	) {
		return this.courseService.update(id, dto, user);
	}

	@Delete(':id')
	@Roles('admin')
	@ApiOperation({ summary: 'Xoá khoá học' })
	remove(@Param('id', ParseUUIDPipe) id: string) {
		return this.courseService.remove(id);
	}
}
```

Quy tắc:

1. `@ApiTags` + `@ApiOperation` với **summary tiếng Việt** — Swagger là tài liệu sống của dự án.
2. `@Param` UUID phải dùng `ParseUUIDPipe` để trả 400 thay vì lỗi 500 từ Postgres.
3. `@Roles(...)` khai báo vai trò được phép; mặc định (không có decorator) là **mọi người dùng đã
   đăng nhập**, trừ route được đánh `@Public()`.
4. `@CurrentUser()` là nguồn duy nhất để biết "ai đang gọi". **Không** lấy `userId` từ body hay
   query — đó là lỗ hổng leo thang quyền.
5. Trả về trực tiếp dữ liệu; `TransformResponseInterceptor` bọc envelope. Không tự bọc
   `{ error, data, message }` trong controller.
6. Controller mỏng: nếu một action dài hơn ~15 dòng thì logic đang đặt sai chỗ.

### 3.5 Service

Service chứa quy tắc nghiệp vụ và là nơi duy nhất truy cập repository.

```ts
@Injectable()
export class CourseService {
	constructor(
		@InjectRepository(Course)
		private readonly courseRepo: Repository<Course>,
	) {}

	async findOne(id: string): Promise<Course> {
		const course = await this.courseRepo.findOne({
			where: { id },
			relations: { sections: true, teacher: true },
		});
		if (!course) {
			throw new NotFoundException(`Không tìm thấy khoá học với ID ${id}`);
		}
		return course;
	}

	async create(dto: CreateCourseDto, user: JwtPayload): Promise<Course> {
		const duplicated = await this.courseRepo.findOne({ where: { code: dto.code } });
		if (duplicated) {
			throw new ConflictException(`Mã khoá học "${dto.code}" đã tồn tại`);
		}

		const course = this.courseRepo.create({ ...dto, teacherId: user.sub, status: 'draft' });
		return this.courseRepo.save(course);
	}
}
```

Quy tắc:

1. **Ném exception có sẵn của NestJS**, không trả `null` rồi để controller xử lý:
   `NotFoundException` (404), `ConflictException` (409), `ForbiddenException` (403),
   `BadRequestException` (400), `UnauthorizedException` (401).
2. **Message tiếng Việt, có ngữ cảnh** (kèm ID/mã cụ thể) để người dùng và log đều hiểu.
3. Kiểm tra tồn tại **trước** khi cập nhật/xoá — dùng lại `findOne` thay vì viết lại truy vấn
   (xem `student.service.ts` làm mẫu).
4. Kiểm tra quyền sở hữu ở service, không chỉ ở guard: guard biết *vai trò*, service mới biết
   *tài nguyên này có thuộc về người gọi không*.
   ```ts
   private assertCanManage(course: Course, user: JwtPayload) {
   	if (user.role !== 'admin' && course.teacherId !== user.sub) {
   		throw new ForbiddenException('Bạn không phụ trách khoá học này');
   	}
   }
   ```
5. Ghi audit log cho hành động quan trọng (`AuditService.log(...)`) ngay trong cùng transaction
   với thay đổi dữ liệu, để không có hành động nào bị thay đổi mà thiếu log.

### 3.6 Phân quyền (RBAC)

Cấu trúc dự kiến (**cần thêm**):

```
backend/src/auth/
├── decorators/current-user.decorator.ts
├── decorators/public.decorator.ts
├── decorators/roles.decorator.ts
├── guards/jwt-auth.guard.ts      # đăng ký global, đọc metadata @Public
├── guards/roles.guard.ts
├── strategies/jwt.strategy.ts
└── dto/{login,register,refresh,reset-password}.dto.ts
```

`JwtAuthGuard` đăng ký **global** (mặc định đóng), route công khai đánh dấu `@Public()`:

```ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

Quy tắc bắt buộc:

1. Mặc định **đóng** (deny by default). Thêm route mới là mặc định cần đăng nhập.
2. Chỉ `@Public()` cho: `POST /api/auth/register`, `POST /api/auth/login`,
   `POST /api/auth/refresh`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`,
   `GET /api/health`.
3. Payload JWT chứa `sub` (userId), `role`, `email`. Không chứa dữ liệu nhạy cảm.
4. Thời gian sống của token lấy từ biến môi trường (`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`) —
   không hardcode.
5. Refresh token lưu **hash** trong DB, thu hồi khi logout. Xem `02-specs/database-design.md`.

### 3.7 Tầng truy vấn analytics

Các truy vấn phục vụ dashboard **không** đặt trong service nghiệp vụ của course/lesson. Chúng thuộc
`AnalyticsModule` và tuân theo:

1. Dùng `QueryBuilder` hoặc `repository.query()` có tham số — **không** nối chuỗi SQL từ input người
   dùng (SQL injection).
2. Truy vấn nặng đọc từ bảng tổng hợp/materialized view, không quét `learning_events` thô trên mỗi
   request (xem `02-specs/database-design.md` §chiến lược dữ liệu chuỗi thời gian).
3. Mọi endpoint dashboard **giới hạn khoảng thời gian** (`from`/`to`, mặc định 30 ngày) và **giới hạn
   số bản ghi** trả về. Không có endpoint analytics nào trả "tất cả".
4. Kết quả tổng hợp nặng có thể cache trong Redis với TTL ngắn; ghi rõ TTL trong code.

### 3.8 Job nền và tích hợp AI

1. NestJS **không** gọi FastAPI ở luồng request/response cho job nặng. Luồng chuẩn:
   tạo bản ghi `ai_jobs` (trạng thái `queued`) → đẩy job vào BullMQ → trả ngay `jobId` cho client →
   client polling `GET /api/ai/jobs/:id` (hoặc nhận qua WebSocket).
2. Mỗi job type có DTO payload có kiểu rõ ràng và một hằng số tên job dùng chung giữa hai phía
   (xem `02-specs/api-specification.md` §hợp đồng tích hợp).
3. Job handler phải **idempotent**: chạy lại cùng một payload cho kết quả như nhau (dùng khoá
   nghiệp vụ `(user_id, course_id, week_start_date, model_version_id)` và `upsert` — xem
   `02-specs/database-design.md` §4.1).
4. Mọi lần gọi FastAPI phải có timeout, retry giới hạn (có backoff) và ghi lỗi vào `ai_jobs.error`.
5. Không log payload chứa dữ liệu cá nhân ở mức `debug` trong production.

### 3.9 Test backend

- Thư viện: **Jest** (đã cấu hình trong `package.json`; E4 hiện có 4 unit tests progress và 1 HTTP e2e suite).
- Đặt tên: `<tên>.service.spec.ts` cạnh file nguồn; e2e trong `backend/test/`.
- **Bắt buộc có test** cho: logic chấm điểm quiz, tính feature, ánh xạ `risk_score` → `risk_level`,
  guard phân quyền, và mọi hàm có từ 3 nhánh rẽ trở lên.
- Test gọi service với repository giả (`jest.fn()`), không cần DB thật cho unit test.
- Không test những thứ thuộc về framework (NestJS tự test `@Get`).
- Test phải chạy được mà không cần Postgres đang sống.

```ts
describe('CourseService.create', () => {
	it('ném ConflictException khi mã khoá học đã tồn tại', async () => {
		repo.findOne.mockResolvedValue({ id: 'existing' } as Course);
		await expect(service.create({ code: 'CO2004', name: 'X' }, teacher))
			.rejects.toThrow(ConflictException);
	});
});
```

---

## 4. Quy ước Frontend (React)

### 4.1 Luồng dữ liệu bắt buộc

Đây là quy ước số một của frontend, đã có sẵn trong repo:

```
apis/<feature>  →  types/<feature>  →  pages/<feature>
```

- `apis/<feature>/index.ts` — chỉ khai báo hàm gọi API, mỗi hàm trả `DefaultResponseType<T>`.
- `types/<feature>.ts` — khai báo interface/union type + bảng nhãn tiếng Việt.
- `pages/<feature>/index.tsx` — chỉ render UI, tiêu thụ hàm từ `apis/`.

Trang tham chiếu đầy đủ: `frontend/src/pages/student/index.tsx`. Đọc file đó trước khi viết page đầu tiên.

```ts
// frontend/src/apis/course/index.ts
import { queryMethod } from '@/config';
import type { Course, DefaultResponseType, PageMetaDto } from '@/types';

export interface FindCoursesParams {
	search?: string;
	categoryId?: string;
	page?: number;
	take?: number;
}

export const getCourses = async (params?: FindCoursesParams) => {
	return (await queryMethod.get('courses', { params })) as DefaultResponseType<{
		items: Course[];
		meta: PageMetaDto;
	}>;
};

export const getCourseById = async (id: string) => {
	return (await queryMethod.get(`courses/${id}`)) as DefaultResponseType<Course>;
};
```

Quy tắc:

1. **Không gọi `axios`/`queryMethod` trực tiếp trong page.** Mọi lời gọi API đi qua `apis/<feature>`.
2. **Không khai báo interface trong page.** Type dùng chung nằm ở `types/`; type chỉ dùng nội bộ
   một page (ví dụ `StudentFormValues`) được phép khai báo trong page.
3. `queryMethod` đã trả về **body** (interceptor đã bóc `response.data`), nên hàm API trả về
   envelope `{ error, data, message }` — page đọc `res.data`.
4. Đường dẫn API **không** có tiền tố `/api` trong `apis/` (base URL đã chứa `/api`).
5. Khi backend chưa xong: dùng mock trong `mocks/` và **giữ nguyên chữ ký hàm** trong `apis/`, kèm
   ghi chú ngày sẽ thay. Không hardcode dữ liệu giả trong page.

### 4.2 Component và UI

**Bắt buộc** dùng bộ component chung trong `frontend/src/components/` (chi tiết đầy đủ ở
`frontend/src/components/README.md` — đọc trước khi viết page):

| Cần gì | Dùng gì | Không được viết |
|---|---|---|
| Nút | `ISolidBtn`, `IOutLinedBtn`, `IconBtn` | `<button className="…">` |
| Bảng | `ITable` | `<table>`, `<thead>`, `<tbody>` |
| Field trong form | `FormItem` + `<Form>` của antd | `<label>` + `<input>` |
| Trạng thái | `Badge` (`status="success" \| "warning" \| "error" \| "info" \| "neutral" \| "processing"`) | `<span className="rounded-full …">` |
| Lỗi | `ErrorBadge` | `<div className="…">` trần |
| Icon | `Icon` (`<Icon name="school" size={18} />`) | `<span className="material-symbols-outlined">` |
| Editor nội dung | `RichTextEditor` (TipTap) | contenteditable tự chế |
| Mật khẩu | `PasswordInput`, `ConfirmPassword` | input type=password tự chế |

Quy tắc bổ sung:

1. **Không copy HTML từ `frontend/design/*.html`.** Bốn file đó là mockup tham khảo về bố cục/màu
   sắc, không phải nguồn component.
2. **Page chỉ render nội dung trang.** Header, Sider và `<Outlet />` thuộc `layouts/private`. Muốn
   thêm mục menu → sửa `config/sider-options/index.tsx` (nguồn duy nhất của điều hướng).
3. Ngoại lệ của quy tắc 1: được dùng component antd trực tiếp (`Button variant="link"`, `Modal`,
   `Select`, `DatePicker`, `Tabs`…) khi wrapper không bao phủ. Nhưng **không** viết HTML thô.
4. Component dùng ở từ 2 page trở lên → tách vào `components/` và export qua `components/index.ts`,
   kèm một dòng trong `components/README.md`.
5. Mỗi page một thư mục, file vào là `index.tsx`, export default. Route khai báo trong
   `routes/index.tsx` qua helper `lazy` (`@/utils/lazy`) để tách gói theo route.

### 4.3 Theme, màu sắc, khoảng cách

- Token Material 3 khai báo trong `src/styles/theme.css` (`@theme { … }`), dùng dưới dạng class
  Tailwind: `bg-surface-container-lowest`, `text-on-surface-variant`, `border-outline-variant`,
  `font-headline-lg`, `text-body-md`, `p-gutter`, `space-y-space-lg`.
- **Không dùng mã màu trực tiếp** (`bg-[#1a73e8]`, `text-gray-500`) trừ khi là bảng màu dữ liệu của
  biểu đồ. Muốn đổi màu toàn hệ thống → sửa `src/config/antd-theme/index.ts` và `theme.css`.
- Scrollbar đã được style toàn cục. Cần ẩn scrollbar mà vẫn cuộn được → thêm class `scrollbar-hidden`.
- Dark mode đã có sẵn qua context theme — dùng token, không hardcode `bg-white` / `text-black`.

### 4.4 State và gọi API

Stack state management đã chốt theo `proposal.md` §5.1: **Redux** (triển khai bằng `@reduxjs/toolkit`
+ `react-redux`). Đã cài trong `frontend/package.json` ngày 2026-09-26; `zustand` đã được gỡ.

| Loại state | Cách làm |
|---|---|
| State cục bộ của một page/component | `useState`, `useReducer` |
| State dùng chung nhiều page (phiên đăng nhập, người dùng hiện tại, thông báo chưa đọc) | **Redux Toolkit slice** + `useSelector` / `useDispatch` |
| Theme sáng/tối | React context hiện có (`contexts/theme-context.tsx`) — **không** đưa theme vào Redux |
| Dữ liệu từ server | `apis/` + `createAsyncThunk` của Redux Toolkit, hoặc `useState`/`useEffect` cho dữ liệu chỉ dùng trong một page |
| Hành động ghi (POST/PATCH/DELETE) | `createAsyncThunk` (khi cần cập nhật store) hoặc hook `useMutation` đã có trong `hooks/` |

Quy tắc:

1. **Dùng Redux Toolkit, không dùng Redux thuần và không dùng Zustand.** Luôn dùng
   `configureStore` + `createSlice`; **không** viết reducer/action creator thủ công và **không**
   thêm `redux-thunk`/`redux-saga` (RTK đã có sẵn `createAsyncThunk`).
2. **Một slice cho một mảng nghiệp vụ**, đặt trong `src/store/<feature>Slice.ts`; store gốc ở
   `src/store/index.ts` và bọc app bằng `<Provider>` trong `src/main.tsx` hoặc `src/App.tsx`.
   (Cấu trúc này **đã có từ E1** — slice `authSlice` trong `frontend/src/store/`, `AuthProvider`
   trong `src/contexts/auth-provider.tsx` lo việc nạp/ghi phiên với `localStorage`.)
3. **Không nhét mọi thứ vào Redux.** Dữ liệu chỉ dùng trong một page thì để `useState`; đưa vào store
   chỉ khi có ≥ 2 page/component không liên quan cùng cần.
4. Mọi lời gọi API trong page phải có **ba trạng thái**: `loading`, `error`, `data` — không có
   ngoại lệ. Dùng `ITable loading={…}` và `ErrorBadge` để hiển thị.
5. Hiển thị lỗi bằng **message tiếng Việt lấy từ `message` của envelope** khi có, chỉ dùng câu
   chung ("Không kết nối được máy chủ") khi không có phản hồi.
6. Hàm/hook dùng chung tách vào `hooks/`, export qua `hooks/index.ts`.
7. **Token được lưu trong `localStorage`** (khoá `uniprep.auth`) — chốt ở E1 (2026-10-03) theo phương
   án Bearer token trong header như tài liệu API; chưa dùng cookie httpOnly nên **chưa có CSRF token**
   (ghi nhận là hạn chế đã biết). Đọc/ghi token chỉ qua `frontend/src/utils/token-storage.ts`.

### 4.5 Component React — quy tắc viết

```tsx
// ✅ Mẫu: component nhỏ, props có kiểu, không nhận `any`
interface RiskBadgeProps {
	level: RiskLevel;
	score?: number;
}

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
	low: 'Bình thường',
	medium: 'Cần chú ý',
	high: 'Nguy cơ cao',
};

export const RiskBadge = ({ level, score }: RiskBadgeProps) => (
	<Badge status={level === 'high' ? 'error' : level === 'medium' ? 'warning' : 'success'} dot>
		{RISK_LEVEL_LABEL[level]}
		{score !== undefined && ` (${(score * 100).toFixed(0)}%)`}
	</Badge>
);

export default RiskBadge;
```

1. Component là **hàm**, không dùng class.
2. Props khai báo bằng `interface` đặt ngay trên component.
3. **Không dùng `any`.** Nếu kiểu chưa xác định, dùng `unknown` và thu hẹp kiểu.
4. Component trên ~150 dòng nên tách nhỏ. Page trên ~300 dòng nên tách thành các phần con.
5. Ưu tiên component **không trạng thái** và nhận dữ liệu qua props; chỉ page mới gọi API.
6. Nội dung text tiếng Việt viết trực tiếp trong JSX (dự án không dùng thư viện i18n; nếu cần thì
   chốt với nhóm trước).

### 4.6 TypeScript frontend

- `strict` đang bật — không dùng `@ts-ignore`. Nếu buộc phải né kiểu, dùng `@ts-expect-error` kèm
  comment giải thích lý do.
- Không dùng `as` để ép kiểu dữ liệu API thành công; validate/kiểm tra trước (`if (res.data)`).
- Type dùng chung đặt trong `types/` và export qua `types/index.ts`.
- Mọi union type hiển thị cho người dùng phải có bảng nhãn (xem §2.2).

---

## 5. Quy ước Service AI (FastAPI)

Áp dụng khi service `ai-service/` được thêm vào repo (**hiện chưa có**).

1. **Cấu trúc**: `app/main.py`, `app/routers/`, `app/services/`, `app/schemas/` (Pydantic),
   `app/workers/`, `app/core/config.py`. Cấu hình qua biến môi trường bằng `pydantic-settings`.
2. **Pydantic model cho mọi payload vào/ra** — không nhận `dict` tự do. Tên field **camelCase**
   để khớp JSON với NestJS (`alias_generator`), giá trị nội bộ snake_case.
3. **Service này không expose ra internet.** Chỉ nhận request nội bộ, có xác thực
   service-to-service (API key/JWT nội bộ qua header). Health check riêng cho nội bộ.
4. **Chỉ đọc** dữ liệu cần thiết để tính feature; **chỉ ghi** bảng kết quả (`risk_predictions`,
   `ai_jobs`). Không ghi vào bảng nghiệp vụ.
5. **Model và feature phải được phiên bản hoá.** Không load model mới mà không có bản ghi
   `model_versions`. Mọi kết quả trả về kèm `modelVersion`.
6. **Không log dữ liệu cá nhân** ở mức INFO. Log chỉ ghi `userId` dạng đã ẩn danh nếu cần.
7. Thời gian xử lý job phải có timeout và ghi lỗi rõ ràng vào `ai_jobs.error` để NestJS hiển thị.
8. Seed/script sinh dữ liệu mô phỏng đặt trong `scripts/` và chạy được độc lập với API server.
9. Code Python: `snake_case`, type hint cho mọi hàm, format bằng `black` + `ruff` (đề xuất) —
   chốt với nhóm khi tạo service.

---

## 6. Xử lý lỗi và response

### 6.1 Envelope — không được phá vỡ

Mọi response, thành công hay thất bại, đều có dạng:

```jsonc
// thành công
{ "error": false, "data": { /* payload */ }, "message": "Thành công" }

// thất bại — giữ nguyên HTTP status thật
{ "error": true, "data": null, "message": "Không tìm thấy khoá học với ID 3f2b…" }
```

Việc bọc đã được làm tự động bởi `TransformResponseInterceptor` và `AllExceptionsFilter`. Do đó:

1. **Không** tự tạo object `{ error, data, message }` trong controller/service.
2. Interceptor bỏ qua object đã có đủ ba khoá `error`/`message`/`data` — chỉ dùng khi thật sự cần
   trả một envelope tuỳ biến, và phải có comment giải thích.
3. Lỗi validate trả 400. `ValidationPipe` sinh ra **mảng** chuỗi dạng `"<field>: <thông báo>"`
   (bởi `flattenValidationErrors` trong `main.ts`), nhưng `AllExceptionsFilter` **nối mảng đó lại
   thành một chuỗi duy nhất** bằng `'; '` trước khi trả về. Vì vậy **trên đường truyền `message` luôn
   là `string`**, ví dụ:

   ```jsonc
   {
     "error": true,
     "data": null,
     "message": "email: email must be an email; password: Mật khẩu tối thiểu 8 ký tự"
   }
   ```

   Hệ quả cho frontend: **không cần** xử lý `string[]` — chỉ cần hiển thị `message` như một chuỗi.
   Đây là hành vi đã có trong repo (`all-exceptions.filter.ts`, nhánh `Array.isArray(msg)`), không
   phải quy ước mới.

### 6.2 Quy tắc chọn mã lỗi

| Tình huống | Exception | HTTP |
|---|---|---|
| Dữ liệu vào sai định dạng/thiếu | `BadRequestException` | 400 |
| Chưa đăng nhập / token hết hạn | `UnauthorizedException` | 401 |
| Đã đăng nhập nhưng không đủ quyền, hoặc không sở hữu tài nguyên | `ForbiddenException` | 403 |
| Không tìm thấy tài nguyên | `NotFoundException` | 404 |
| Trùng dữ liệu duy nhất (email, mã khoá học) | `ConflictException` | 409 |
| Quá nhiều request | `ThrottlerException` (khi thêm rate limit) | 429 |
| Lỗi không lường trước | để filter xử lý | 500 |

Không bao giờ trả 200 kèm `error: true` cho một thao tác thất bại.

### 6.3 Bảo mật khi trả lỗi

- Thông báo lỗi **không** tiết lộ chi tiết hệ thống (tên bảng, câu SQL, stack trace) cho client.
  Chi tiết kỹ thuật ghi vào log server.
- Với tài nguyên của người khác, trả **404** thay vì 403 khi việc tồn tại tài nguyên là thông tin
  nhạy cảm (ví dụ bài nộp riêng tư). Quy ước cụ thể: tài nguyên trong cùng khoá học → 403; tài
  nguyên riêng tư của người khác → 404. Ghi rõ trong tài liệu API cho từng endpoint.

---

## 7. Bảo mật — checklist bắt buộc khi code

| # | Quy tắc |
|---|---|
| S-1 | Không hardcode bí mật. Mọi secret đọc từ biến môi trường; `.env` không commit. |
| S-2 | Mọi input qua DTO có validate; query DB dùng tham số, không nối chuỗi. |
| S-3 | Kiểm tra quyền ở server cho **mọi** endpoint (mặc định đóng). |
| S-4 | Không lấy danh tính người dùng từ body/query — chỉ từ token. |
| S-5 | Không trả `passwordHash`, `refreshTokenHash` hoặc dữ liệu nội bộ ra API. |
| S-6 | Upload tệp: kiểm tra loại và dung lượng, không dùng tên tệp người dùng làm đường dẫn lưu. |
| S-7 | Rate limit cho đăng nhập, refresh token và endpoint nhận telemetry. |
| S-8 | HTML do người dùng nhập (bài học, thảo luận) phải được làm sạch trước khi render. |
| S-9 | Log không chứa mật khẩu, token, hay dữ liệu cá nhân không cần thiết. |
| S-10 | Dữ liệu hành vi dùng cho huấn luyện/đánh giá model phải được ẩn danh. |

---

## 8. Rà soát mã nguồn (code review) — người review kiểm gì

Người review **không** kiểm định dạng (lint/CI lo việc đó). Kiểm:

1. **Đúng yêu cầu**: PR này ứng với yêu cầu nào trong `01-product/requirements.md`? Có mã `FR-…`
   trong mô tả PR không?
2. **Phân quyền**: endpoint mới có `@Roles`/guard đúng chưa? Có lỗ hổng IDOR không (người dùng A
   đọc dữ liệu B)?
3. **Hợp đồng API**: response có đúng envelope và đúng tên field trong tài liệu API không? Nếu
   khác, tài liệu đã được cập nhật trong cùng PR chưa?
4. **Tầng**: logic nghiệp vụ có nằm đúng service không? Controller có mỏng không?
5. **Hiệu năng**: có truy vấn N+1 không? Endpoint danh sách có phân trang không? Có quét
   `learning_events` thô trên mỗi request không?
6. **Bảo mật**: theo checklist §7.
7. **Test**: logic rẽ nhánh đã có test chưa? Test có thật sự kiểm tra hành vi (không phải chỉ gọi
   hàm cho có)?
8. **Tiếng Việt**: text hiển thị có dấu, đúng chính tả, không lộ chuỗi tiếng Anh ra UI.
9. **Khả năng đọc**: tên biến/hàm có nghĩa? Có code chết, `console.log`, hay `TODO` vô chủ không?

Nhận xét phải cụ thể và kèm đề xuất. Không chặn PR vì sở thích cá nhân khi quy ước không quy định.

---

## 9. Câu hỏi mở

| # | Câu hỏi | Ảnh hưởng |
|---|---|---|
| CQ-1 | ~~Token lưu ở `localStorage` (Bearer header) hay cookie httpOnly?~~ **Đã chốt ở E1 (2026-10-03): `localStorage` + Bearer header** (`frontend/src/utils/token-storage.ts`); cookie httpOnly + CSRF để sau nếu cần | Cách viết `queryMethod`, chống XSS/CSRF — nay chỉ còn rủi ro XSS, đã ghi ở mục "Known limitations" của README |
| CQ-2 | Có thêm React Query/TanStack Query không, hay tiếp tục `useState` + `useEffect`? | Khối lượng refactor, cách viết page |
| CQ-3 | Thư viện biểu đồ cụ thể cho dashboard? (antd không có chart đầy đủ) | Toàn bộ `pages/analytics` |
| CQ-4 | Dùng thư viện làm sạch HTML nào (DOMPurify?) cho nội dung người dùng nhập? | S-8 |
| CQ-5 | Lưu tệp upload ở đâu (thư mục local, S3-compatible, Cloudflare R2)? | FR-2.6, FR-2.11, deploy |
| CQ-6 | Có thống nhất chuyển toàn bộ comment cũ tiếng Anh sang tiếng Việt không? | Khối lượng diff, ưu tiên thấp |
| CQ-7 | Ngưỡng phủ test tối thiểu mà nhóm tự đặt? | NFR-13 |

---

*Tài liệu này được soạn từ `docs/proposal.md`, `docs/architecture.md` và quy ước thực tế đang có
trong repo `UniPrep/` (đặc biệt `backend/.prettierrc`, `backend/src/student/*`,
`frontend/src/pages/student/index.tsx`, `frontend/src/components/README.md`). Khi quy ước trong repo
thay đổi, cập nhật lại tài liệu này trong cùng PR.*
