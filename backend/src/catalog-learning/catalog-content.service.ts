import {
	BadGatewayException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { parseCatalogKey } from '../catalog/catalog-ref';
import { CatalogService } from '../catalog/catalog.service';
import type { SkillGraph } from '../catalog/catalog.types';
import { QuizOption } from '../exercise/entities/quiz-option.entity';
import { QuizQuestion } from '../exercise/entities/quiz-question.entity';
import type { Quiz } from '../exercise/entities/quiz.entity';
import { Lesson } from '../lesson/entities/lesson.entity';
import { DeepSeekClient, type ChatMessage } from '../tutor/deepseek.client';
import {
	buildLessonMessages,
	buildQuizMessages,
} from './catalog-content.prompt';
import {
	parseGeneratedQuestions,
	type GeneratedQuestion,
} from './generated-question.parser';

const QUIZ_QUESTION_COUNT = 8;
const MIN_VALID_QUESTIONS = 3;
const LESSON_EXCERPT_CHARS = 1500;
const QUIZ_CONTEXT_CHARS = 9000;

/**
 * AI sinh nội dung cho khoá học mở từ Catalog — **lười**: chỉ sinh khi người học mở tới, sinh
 * một lần rồi lưu vào DB của UniPrep (`lessons.content`, `quiz_questions`). Vì lưu như học liệu
 * thường nên trợ giảng AI (RAG trên bài đã công bố) tự dùng được nội dung này.
 *
 * Mỗi bài/bài tập có khoá chống sinh trùng trong tiến trình: hai request cùng lúc chờ chung một
 * lần gọi model.
 */
@Injectable()
export class CatalogContentService {
	private readonly logger = new Logger(CatalogContentService.name);
	private readonly inflight = new Map<string, Promise<void>>();

	constructor(
		private readonly catalog: CatalogService,
		private readonly deepseek: DeepSeekClient,
		private readonly dataSource: DataSource,
		@InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
		@InjectRepository(QuizQuestion)
		private readonly questions: Repository<QuizQuestion>,
	) {}

	/** Bài cần sinh nội dung: tạo từ Catalog và chưa có nội dung. */
	needsLessonContent(lesson: Pick<Lesson, 'catalogKey' | 'content'>): boolean {
		return Boolean(lesson.catalogKey) && !lesson.content?.trim();
	}

	/** Sinh nội dung bài (nếu cần) và trả bài đã cập nhật. */
	async ensureLessonContent(lesson: Lesson): Promise<Lesson> {
		if (!this.needsLessonContent(lesson)) return lesson;
		await this.once(`lesson:${lesson.id}`, () =>
			this.generateLesson(lesson.id),
		);
		return (await this.lessons.findOne({ where: { id: lesson.id } })) ?? lesson;
	}

	/** Sinh câu hỏi cho bài tập của chủ đề nếu bài tập chưa có câu nào. */
	async ensureQuizQuestions(quiz: Quiz): Promise<void> {
		if (!quiz.catalogKey) return;
		if (await this.questions.exists({ where: { quizId: quiz.id } })) return;
		await this.once(`quiz:${quiz.id}`, () => this.generateQuiz(quiz));
	}

	private once(key: string, work: () => Promise<void>): Promise<void> {
		let pending = this.inflight.get(key);
		if (!pending) {
			pending = work().finally(() => this.inflight.delete(key));
			this.inflight.set(key, pending);
		}
		return pending;
	}

	private assertConfigured() {
		if (!this.deepseek.isConfigured) {
			throw new ServiceUnavailableException(
				'Chưa cấu hình DeepSeek (DEEPSEEK_API_KEY) nên chưa sinh được nội dung bài học.',
			);
		}
	}

	private async generateLesson(lessonId: string): Promise<void> {
		const lesson = await this.lessons.findOne({ where: { id: lessonId } });
		if (!lesson || !this.needsLessonContent(lesson)) return;
		this.assertConfigured();

		const { skill, topic, graph } = await this.catalog.resolveSkill(
			lesson.catalogKey!,
		);
		const outline = await this.catalog.getOutline(
			graph.courseCode,
			graph.version,
		);
		const messages = buildLessonMessages({
			courseCode: graph.courseCode,
			courseName: graph.name.vi ?? graph.name.en ?? graph.courseCode,
			objectives:
				outline.content.objectives?.vi ??
				outline.content.objectives?.en ??
				null,
			references:
				outline.content.references?.vi ??
				outline.content.references?.en ??
				null,
			topicTitle: topic.title,
			skillName: skill.name,
			siblingSkills: graph.skills
				.filter((s) => s.topicKey === topic.key && s.key !== skill.key)
				.map((s) => s.name),
			outcomes: this.outcomeTexts(graph, skill.outcomeKeys),
		});

		const result = await this.deepseek.chat({
			messages,
			thinking: false,
			maxTokens: 4096,
		});
		const content = result.content?.trim();
		if (!content)
			throw new BadGatewayException(
				'AI không trả về nội dung bài học, thử lại sau.',
			);

		const words = content.split(/\s+/).length;
		await this.lessons.update(
			{ id: lesson.id, content: IsNull() },
			{
				content,
				contentFormat: 'markdown',
				estimatedMinutes: Math.max(5, Math.round(words / 150)),
			},
		);
		this.logger.log(
			`Sinh bài ${lesson.catalogKey} (${words} từ, ${result.durationMs} ms, ${result.completionTokens ?? '?'} token)`,
		);
	}

	private async generateQuiz(quiz: Quiz): Promise<void> {
		if (await this.questions.exists({ where: { quizId: quiz.id } })) return;
		this.assertConfigured();

		const parsed = parseCatalogKey(quiz.catalogKey!);
		if (!parsed) return;
		const graph = await this.catalog.getSkillGraph(
			parsed.courseCode,
			parsed.version,
		);
		const topic = graph.topics.find((t) => t.key === quiz.catalogKey);
		if (!topic) return;

		const lessons = await this.lessons.find({
			where: {
				courseId: quiz.courseId,
				sectionId: quiz.sectionId ?? undefined,
			},
			order: { orderIndex: 'ASC' },
		});
		let excerpts = '';
		for (const lesson of lessons) {
			if (!lesson.content || excerpts.length >= QUIZ_CONTEXT_CHARS) continue;
			excerpts += `\n### ${lesson.title}\n${lesson.content.slice(0, LESSON_EXCERPT_CHARS)}\n`;
		}

		const messages = buildQuizMessages({
			courseCode: graph.courseCode,
			courseName: graph.name.vi ?? graph.name.en ?? graph.courseCode,
			topicTitle: topic.title,
			skills: graph.skills
				.filter((s) => s.topicKey === topic.key)
				.map((s) => s.name),
			outcomes: this.outcomeTexts(graph, topic.outcomeKeys),
			lessonExcerpts: excerpts.slice(0, QUIZ_CONTEXT_CHARS),
			questionCount: QUIZ_QUESTION_COUNT,
		});

		const { questions: generated, durationMs } = await this.generateQuestions(
			messages,
			QUIZ_QUESTION_COUNT,
		);

		await this.dataSource.transaction(async (manager) => {
			// Kiểm tra lại trong transaction: một request khác (tiến trình khác) có thể vừa tạo xong.
			if (await manager.exists(QuizQuestion, { where: { quizId: quiz.id } }))
				return;
			await this.insertQuestions(manager, quiz.id, generated);
		});
		this.logger.log(
			`Sinh ${generated.length} câu hỏi cho ${quiz.catalogKey} (${durationMs} ms)`,
		);
	}

	/** Gọi model ra đề và giữ lại các câu đúng luật; ít hơn `MIN_VALID_QUESTIONS` câu thì báo lỗi. */
	async generateQuestions(
		messages: ChatMessage[],
		limit: number,
	): Promise<{ questions: GeneratedQuestion[]; durationMs: number }> {
		this.assertConfigured();
		const result = await this.deepseek.chat({
			messages,
			json: true,
			thinking: false,
			maxTokens: 8000,
		});
		const questions = parseGeneratedQuestions(result.content, limit);
		if (questions.length < MIN_VALID_QUESTIONS) {
			throw new BadGatewayException(
				'AI tạo câu hỏi chưa hợp lệ, vui lòng thử lại.',
			);
		}
		return { questions, durationMs: result.durationMs };
	}

	/** Ghi câu hỏi + phương án vào một quiz (gọi trong transaction của nơi dùng). */
	async insertQuestions(
		manager: EntityManager,
		quizId: string,
		generated: GeneratedQuestion[],
	): Promise<void> {
		for (const [index, item] of generated.entries()) {
			const question = await manager.save(
				manager.create(QuizQuestion, {
					quizId,
					questionType: item.type,
					content: item.content,
					explanation: item.explanation,
					points: 1,
					orderIndex: index + 1,
				}),
			);
			await manager.save(
				item.options.map((option, optionIndex) =>
					manager.create(QuizOption, {
						questionId: question.id,
						content: option.content,
						isCorrect: option.correct,
						orderIndex: optionIndex,
					}),
				),
			);
		}
	}

	private outcomeTexts(graph: SkillGraph, keys: string[]): string[] {
		const byKey = new Map(graph.outcomes.map((o) => [o.key, o]));
		return keys
			.map((key) => byKey.get(key))
			.filter((o) => o !== undefined)
			.map((o) => `${o.code}: ${o.name}`);
	}
}
