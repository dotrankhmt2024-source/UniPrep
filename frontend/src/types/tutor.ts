/** Kiểu dữ liệu của "Trợ giảng AI" (khớp `backend/src/tutor`). */

export type TutorStepRole =
	'system' | 'context' | 'user' | 'assistant' | 'tool' | 'answer' | 'error';

export interface TutorToolCall {
	id: string;
	name: string;
	arguments: string;
}

export interface TutorStep {
	id: string;
	createdAt: string;
	sessionId: string;
	turn: number;
	seq: number;
	role: TutorStepRole;
	content: string | null;
	reasoning: string | null;
	toolCalls: TutorToolCall[] | null;
	toolCallId: string | null;
	toolName: string | null;
	toolArgs: unknown;
	data: unknown;
	promptTokens: number | null;
	completionTokens: number | null;
	cacheHitTokens: number | null;
	durationMs: number | null;
}

export interface TutorSession {
	id: string;
	createdAt: string;
	updatedAt: string;
	courseId: string;
	title: string;
	model: string;
	contextLessonId: string | null;
}

export interface TutorSessionDetail extends TutorSession {
	steps: TutorStep[];
}

export interface TutorCitation {
	index: number;
	chunkId: string;
	lessonId: string;
	lessonKey: string;
	lessonTitle: string;
	heading: string;
	excerpt: string;
	sourceUrl: string | null;
}

export interface TutorAnswer {
	message: string;
	citations: TutorCitation[];
	grounded: boolean;
	suggestions: string[];
	notes: string[];
	source: 'tool' | 'json_mode';
}

export interface SendTutorMessagePayload {
	sessionId?: string;
	courseId: string;
	lessonId?: string;
	message: string;
}

export interface TutorTurnResult {
	session: TutorSession;
	steps: TutorStep[];
}
