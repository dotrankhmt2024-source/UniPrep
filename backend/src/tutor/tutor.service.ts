import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseAccessService } from '../course/course-access.service';
import type { AuthUser } from '../auth/types/authenticated-user.type';
import {
	ANSWER_JSON_EXAMPLE,
	ANSWER_SCHEMA,
	normalizeAnswer,
	parseJsonObject,
	SUBMIT_ANSWER_TOOL,
	type RawAnswer,
	type TutorAnswer,
} from './tutor.answer';
import {
	DeepSeekClient,
	type ChatMessage,
	type ChatResult,
} from './deepseek.client';
import { SendTutorMessageDto } from './dto/send-tutor-message.dto';
import { TutorSession } from './entities/tutor-session.entity';
import { TutorStep } from './entities/tutor-step.entity';
import {
	buildLessonContext,
	buildSystemPrompt,
	withContext,
} from './tutor.prompt';
import { TOOL_DEFINITIONS, TutorTools, type TurnContext } from './tutor.tools';
import { TutorKnowledgeService } from './tutor-knowledge.service';

/** Số vòng gọi model tối đa trong một lượt (mỗi vòng có thể gọi nhiều tool). */
const MAX_ROUNDS = 8;
const TOOL_RESULT_LIMIT = 16_000;

type StepInput = Partial<
	Omit<TutorStep, 'id' | 'session' | 'sessionId' | 'turn' | 'seq'>
> &
	Pick<TutorStep, 'role'>;

export interface TutorTurnResult {
	session: TutorSession;
	steps: TutorStep[];
}

/**
 * Agent trợ giảng AI — port vòng lặp tool call + trajectory từ `DACN2/Backend/src/advisor`.
 *
 * Mỗi lượt: dựng lại hội thoại từ các bước đã lưu → gọi model với tool → chạy tool → lặp tới khi
 * model gọi `submit_answer` (hoặc hết vòng thì ép JSON mode). Mọi bước đều được ghi vào
 * `tutor_steps` ngay khi xảy ra, nên lượt lỗi giữa chừng vẫn xem lại được trajectory.
 */
@Injectable()
export class TutorService {
	private readonly logger = new Logger(TutorService.name);
	/** Chặn hai lượt chạy song song trên cùng cuộc trò chuyện (thứ tự bước sẽ lẫn lộn). */
	private readonly running = new Set<string>();

	constructor(
		@InjectRepository(TutorSession)
		private readonly sessions: Repository<TutorSession>,
		@InjectRepository(TutorStep) private readonly steps: Repository<TutorStep>,
		private readonly courseAccess: CourseAccessService,
		private readonly knowledge: TutorKnowledgeService,
		private readonly deepseek: DeepSeekClient,
		private readonly tools: TutorTools,
	) {}

	get isConfigured(): boolean {
		return this.deepseek.isConfigured;
	}

	listSessions(userId: string, courseId?: string): Promise<TutorSession[]> {
		return this.sessions.find({
			where: courseId ? { userId, courseId } : { userId },
			order: { updatedAt: 'DESC' },
			take: 50,
		});
	}

	async getSession(
		userId: string,
		id: string,
	): Promise<TutorSession & { steps: TutorStep[] }> {
		const session = await this.owned(userId, id);
		const steps = await this.steps.find({
			where: { sessionId: id },
			order: { seq: 'ASC' },
		});
		return { ...session, steps };
	}

	async deleteSession(userId: string, id: string): Promise<null> {
		await this.owned(userId, id);
		if (this.running.has(id))
			throw new ConflictException(
				'Cuộc trò chuyện đang được trả lời, thử lại sau',
			);
		await this.sessions.delete({ id });
		return null;
	}

	async sendMessage(
		actor: AuthUser,
		dto: SendTutorMessageDto,
	): Promise<TutorTurnResult> {
		if (!this.deepseek.isConfigured) {
			throw new ServiceUnavailableException(
				'Backend chưa cấu hình DEEPSEEK_API_KEY nên chưa dùng được Trợ giảng AI',
			);
		}
		const course = await this.courseAccess.assertCanView(dto.courseId, actor);

		let session = dto.sessionId
			? await this.owned(actor.id, dto.sessionId)
			: null;
		if (session && session.courseId !== course.id)
			throw new BadRequestException(
				'Cuộc trò chuyện này thuộc khoá học khác, hãy mở cuộc trò chuyện mới',
			);

		if (!session) {
			session = await this.sessions.save(
				this.sessions.create({
					userId: actor.id,
					courseId: course.id,
					title: dto.message.trim().slice(0, 80) || 'Cuộc trò chuyện mới',
					model: this.deepseek.model,
					contextLessonId: null,
				}),
			);
		}
		if (this.running.has(session.id))
			throw new ConflictException(
				'Trợ giảng đang trả lời tin nhắn trước, hãy đợi một chút',
			);
		this.running.add(session.id);
		try {
			return await this.runTurn(session, course, dto, actor.id);
		} finally {
			this.running.delete(session.id);
		}
	}

	/* ------------------------------- Một lượt ------------------------------- */

	private async runTurn(
		session: TutorSession,
		course: {
			id: string;
			code: string;
			title: string;
			summary: string | null;
			language: string;
		},
		dto: SendTutorMessageDto,
		userId: string,
	): Promise<TutorTurnResult> {
		const previous = await this.steps.find({
			where: { sessionId: session.id },
			order: { seq: 'ASC' },
		});
		let seq = previous.at(-1)?.seq ?? 0;
		const turn = (previous.at(-1)?.turn ?? 0) + 1;
		const created: TutorStep[] = [];
		const record = async (input: StepInput): Promise<TutorStep> => {
			seq += 1;
			const step = await this.steps.save(
				this.steps.create({ ...input, sessionId: session.id, turn, seq }),
			);
			created.push(step);
			return step;
		};

		const index = await this.knowledge.getIndex(course.id);
		const messages = this.replay(previous);
		if (!previous.some((step) => step.role === 'system')) {
			const system = buildSystemPrompt(course, index.lessons, new Date());
			await record({
				role: 'system',
				content: system,
				data: { lessons: index.lessons.length, chunks: index.chunks.length },
			});
			messages.unshift({ role: 'system', content: system });
		}

		// Context chỉ gửi khi bài đang xem đổi so với lượt trước (model vẫn nhớ bản cũ trong lịch sử).
		let context: string | null = null;
		const lessonId = dto.lessonId ?? null;
		if (lessonId && lessonId !== session.contextLessonId) {
			const lesson = index.lessons.find((item) => item.lessonId === lessonId);
			if (lesson) {
				context = buildLessonContext(lesson);
				await record({
					role: 'context',
					content: context,
					data: { lessonId, lessonKey: lesson.key },
				});
				session.contextLessonId = lessonId;
			}
		}
		const userContent = dto.message.trim();
		await record({ role: 'user', content: userContent });
		this.pushUser(messages, withContext(context, userContent));

		session.updatedAt = new Date();
		await this.sessions.save(session);

		const ctx: TurnContext = { courseId: course.id };
		try {
			const answer = await this.agentLoop(
				messages,
				ctx,
				record,
				userContent,
				created,
			);
			await record({ role: 'answer', content: answer.message, data: answer });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Tutor turn failed (${session.id}): ${message}`);
			await record({ role: 'error', content: message });
		}

		return { session: await this.owned(userId, session.id), steps: created };
	}

	private async agentLoop(
		messages: ChatMessage[],
		ctx: TurnContext,
		record: (input: StepInput) => Promise<TutorStep>,
		userContent: string,
		created: TutorStep[],
	): Promise<TutorAnswer> {
		let rejectedOnce = false;
		let draft: string | null = null;

		for (let round = 0; round < MAX_ROUNDS; round += 1) {
			const result = await this.deepseek.chat({
				messages,
				tools: TOOL_DEFINITIONS,
			});
			await record({
				role: 'assistant',
				content: result.content,
				reasoning: result.reasoning,
				toolCalls: result.toolCalls.length
					? result.toolCalls.map((call) => ({
							id: call.id,
							name: call.function.name,
							arguments: call.function.arguments,
						}))
					: null,
				...this.usage(result),
				data: { finishReason: result.finishReason },
			});
			messages.push(
				this.assistantMessage(
					result.content,
					result.reasoning,
					result.toolCalls,
				),
			);

			if (!result.toolCalls.length) {
				// Model trả lời bằng văn bản thay vì gọi submit_answer: định dạng lại bằng JSON mode.
				draft = result.content;
				break;
			}

			let final: TutorAnswer | null = null;
			for (const call of result.toolCalls) {
				const name = call.function.name;
				const args = parseJsonObject(call.function.arguments);
				const started = Date.now();
				let output: unknown;

				if (name === SUBMIT_ANSWER_TOOL) {
					const checked = await this.checkAnswer(args, ctx, rejectedOnce);
					if (checked.answer) {
						final = { ...checked.answer, source: 'tool' };
						output = { ok: true };
					} else {
						rejectedOnce = true;
						output = {
							ok: false,
							errors: checked.errors,
							hint: `Sửa các lỗi trên rồi gọi lại ${SUBMIT_ANSWER_TOOL}.`,
						};
					}
				} else if (!args) {
					output = { error: 'Tham số không phải JSON hợp lệ' };
				} else {
					try {
						output = await this.tools.execute(name, args, ctx);
					} catch (error) {
						this.logger.warn(
							`Tool ${name} failed: ${error instanceof Error ? error.stack : String(error)}`,
						);
						output = { error: 'Lỗi khi truy vấn học liệu' };
					}
				}

				const content = this.truncate(JSON.stringify(output));
				await record({
					role: 'tool',
					toolCallId: call.id,
					toolName: name,
					toolArgs: args ?? call.function.arguments,
					content,
					data: output,
					durationMs: Date.now() - started,
				});
				messages.push({ role: 'tool', tool_call_id: call.id, content });
			}
			if (final) return final;
		}

		return this.formatWithJsonMode(draft, userContent, ctx, record, created);
	}

	/**
	 * Kiểm tra tham số submit_answer. Lần đầu có lỗi thì trả lỗi cho model sửa; lần sau chấp nhận phần
	 * hợp lệ và ghi chú phần đã bỏ, để một lỗi nhỏ không làm hỏng cả lượt.
	 */
	private async checkAnswer(
		args: Record<string, unknown> | null,
		ctx: TurnContext,
		lenient: boolean,
	): Promise<{
		answer: Omit<TutorAnswer, 'source'> | null;
		errors: string[];
	}> {
		const { answer, errors } = normalizeAnswer(args);
		if (!answer) return { answer: null, errors };
		const enriched = await this.tools.enrichCitations(answer, ctx);
		if (enriched.unknown.length)
			errors.push(
				`Mã đoạn không tồn tại: ${enriched.unknown.join(', ')}. Chỉ dùng chunk_id lấy từ kết quả tool.`,
			);
		if (errors.length && !lenient) return { answer: null, errors };
		return {
			answer: {
				message: answer.message,
				citations: enriched.citations,
				grounded: answer.grounded && enriched.citations.length > 0,
				suggestions: answer.suggestions,
				notes: errors.length
					? [`Backend đã bỏ phần không hợp lệ: ${errors.join(' ')}`]
					: [],
			},
			errors,
		};
	}

	/** Dự phòng: ép JSON bằng `response_format: json_object` dựa trên bản nháp và kết quả tool của lượt. */
	private async formatWithJsonMode(
		draft: string | null,
		userContent: string,
		ctx: TurnContext,
		record: (input: StepInput) => Promise<TutorStep>,
		created: TutorStep[],
	): Promise<TutorAnswer> {
		const evidence = created
			.filter(
				(step) => step.role === 'tool' && step.toolName !== SUBMIT_ANSWER_TOOL,
			)
			.map(
				(step) =>
					`${step.toolName} ${JSON.stringify(step.toolArgs)}:\n${(step.content ?? '').slice(0, 4000)}`,
			)
			.join('\n\n')
			.slice(0, 24_000);
		const messages: ChatMessage[] = [
			{
				role: 'system',
				content:
					'Bạn chuyển câu trả lời của trợ giảng thành đúng một JSON object (json) theo schema sau, tiếng Việt, ' +
					`chỉ trích chunk_id xuất hiện trong dữ liệu đã tra cứu:\n${JSON.stringify(ANSWER_SCHEMA)}\n\nVí dụ json:\n${ANSWER_JSON_EXAMPLE}`,
			},
			{
				role: 'user',
				content:
					`Câu hỏi của người học:\n${userContent}\n\nDữ liệu đã tra cứu:\n${evidence || '(không có)'}\n\n` +
					`Bản nháp câu trả lời:\n${draft?.trim() || '(không có, hãy tự viết câu trả lời ngắn dựa trên dữ liệu)'}`,
			},
		];

		for (let attempt = 0; attempt < 2; attempt += 1) {
			const result = await this.deepseek.chat({
				messages,
				json: true,
				thinking: false,
				maxTokens: 4096,
			});
			await record({
				role: 'assistant',
				content: result.content,
				reasoning: result.reasoning,
				...this.usage(result),
				// Bước định dạng không thuộc hội thoại chính nên không gửi lại cho model ở lượt sau.
				data: {
					finishReason: result.finishReason,
					formatter: true,
					attempt: attempt + 1,
				},
			});
			const checked = await this.checkAnswer(
				parseJsonObject(result.content),
				ctx,
				true,
			);
			if (checked.answer) return { ...checked.answer, source: 'json_mode' };
		}

		const fallback: RawAnswer = {
			message:
				draft?.trim() ||
				'Xin lỗi, mình chưa tạo được câu trả lời. Bạn thử hỏi lại nhé.',
			citations: [],
			grounded: false,
			suggestions: [],
		};
		return {
			...fallback,
			citations: [],
			notes: ['Không định dạng được câu trả lời thành JSON.'],
			source: 'json_mode',
		};
	}

	/* ------------------------------- Lịch sử ------------------------------- */

	/**
	 * Dựng lại danh sách tin nhắn cho model từ các bước đã lưu. Giữ nguyên `reasoning_content`
	 * (DeepSeek bắt buộc khi dùng thinking + tools) và bù kết quả cho tool call bị gián đoạn.
	 */
	private replay(steps: TutorStep[]): ChatMessage[] {
		const messages: ChatMessage[] = [];
		let context: string | null = null;
		let pendingCalls: string[] = [];
		const closePending = () => {
			pendingCalls.forEach((id) =>
				messages.push({
					role: 'tool',
					tool_call_id: id,
					content: JSON.stringify({ error: 'Bị gián đoạn' }),
				}),
			);
			pendingCalls = [];
		};

		for (const step of steps) {
			if (step.role === 'tool') {
				if (!step.toolCallId || !pendingCalls.includes(step.toolCallId))
					continue;
				pendingCalls = pendingCalls.filter((id) => id !== step.toolCallId);
				messages.push({
					role: 'tool',
					tool_call_id: step.toolCallId,
					content: step.content ?? '',
				});
				continue;
			}
			if (['system', 'context', 'user', 'assistant'].includes(step.role))
				closePending();

			if (step.role === 'system')
				messages.push({ role: 'system', content: step.content ?? '' });
			if (step.role === 'context') context = step.content;
			if (step.role === 'user') {
				this.pushUser(messages, withContext(context, step.content ?? ''));
				context = null;
			}
			if (step.role === 'assistant') {
				if ((step.data as { formatter?: boolean } | null)?.formatter) continue;
				const calls = (step.toolCalls ?? []).map((call) => ({
					id: call.id,
					type: 'function' as const,
					function: { name: call.name, arguments: call.arguments },
				}));
				messages.push(
					this.assistantMessage(step.content, step.reasoning, calls),
				);
				pendingCalls = calls.map((call) => call.id);
			}
		}
		closePending();
		return messages;
	}

	/** Hai tin nhắn `user` liền nhau (lượt trước lỗi) được gộp lại. */
	private pushUser(messages: ChatMessage[], content: string) {
		const last = messages.at(-1);
		if (last?.role === 'user')
			last.content = `${last.content ?? ''}\n\n${content}`;
		else messages.push({ role: 'user', content });
	}

	private assistantMessage(
		content: string | null,
		reasoning: string | null,
		toolCalls: ChatResult['toolCalls'],
	): ChatMessage {
		const message: ChatMessage = { role: 'assistant', content: content ?? '' };
		if (reasoning) message.reasoning_content = reasoning;
		if (toolCalls.length) message.tool_calls = toolCalls;
		return message;
	}

	private usage(result: ChatResult) {
		return {
			promptTokens: result.promptTokens,
			completionTokens: result.completionTokens,
			cacheHitTokens: result.cacheHitTokens,
			durationMs: result.durationMs,
		};
	}

	private truncate(text: string): string {
		return text.length > TOOL_RESULT_LIMIT
			? `${text.slice(0, TOOL_RESULT_LIMIT)}…(đã cắt bớt)`
			: text;
	}

	private async owned(userId: string, id: string): Promise<TutorSession> {
		const session = await this.sessions.findOne({ where: { id, userId } });
		if (!session) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
		return session;
	}
}
