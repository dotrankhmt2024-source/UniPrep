import type { CatalogOutline, RawOutlineContent } from './catalog.types';
import { buildSkillGraph, parseSessionText } from './skill-graph.builder';

function outline(
	content: Partial<RawOutlineContent>,
	extra: Partial<CatalogOutline> = {},
): CatalogOutline {
	return {
		ref: 'CO1023@9.1',
		courseCode: 'CO1023',
		version: '9.1',
		appliesFrom: '261',
		sourceCode: 'DCMH.CO1023.9.1',
		sourceUpdatedAt: null,
		contentHash: 'hash',
		name: { vi: 'Hệ thống số', en: 'Digital Systems' },
		credits: 3,
		prerequisites: [],
		content: { course_code: 'CO1023', version: '9.1', ...content },
		...extra,
	};
}

describe('parseSessionText', () => {
	it('đọc chương có mục đánh số và bỏ khối thí nghiệm (định dạng CO1023)', () => {
		const topics = parseSessionText(
			[
				'Chương 4. Flip-Flop và mạch tuần tự',
				'4.1. Mạch cài: NAND và NOR',
				'4.2. Tín hiệu xung clock - Flip-flop sử dụng xung clock',
				'',
				'Bài Thí nghiệm số 1',
				'Khảo sát, Thiết kế, tối giản và lắp ráp mạch dùng các IC 74LS/HC04',
				'Bài Thực hành số 1',
				'Luyện tập khả năng thiết kế mạch tổ hợp.',
			].join('\n'),
		);
		expect(topics).toEqual([
			{
				title: 'Flip-Flop và mạch tuần tự',
				items: [
					{ name: 'Mạch cài: NAND và NOR', label: '4.1' },
					{
						name: 'Tín hiệu xung clock - Flip-flop sử dụng xung clock',
						label: '4.2',
					},
				],
			},
		]);
	});

	it('bỏ dòng "Kiểm tra giữa kỳ" đứng trước chương', () => {
		const topics = parseSessionText(
			'Kiểm tra giữa kỳ\nChương 5. Các phép toán và mạch\n5.1. Phép cộng nhị phân',
		);
		expect(topics.map((t) => t.title)).toEqual(['Các phép toán và mạch']);
		expect(topics[0].items).toHaveLength(1);
	});

	it('giữ mục con "++" và bỏ mục nhóm, bỏ "Bài tập" (định dạng CO2003)', () => {
		const topics = parseSessionText(
			[
				'Cấu trúc cây cơ bản',
				'+ Kiến thức chung về cây',
				'++ Giới thiệu về cây và ứng dụng',
				'+ Cây nhị phân và cây tìm kiếm nhị phân',
				'++ Cây nhị phân',
				'++ Cây tìm kiếm nhị phân',
				'+ Bài tập',
			].join('\n'),
		);
		expect(topics).toHaveLength(1);
		expect(topics[0].items.map((i) => i.name)).toEqual([
			'Giới thiệu về cây và ứng dụng',
			'Cây nhị phân',
			'Cây tìm kiếm nhị phân',
		]);
	});

	it('dòng thường sau các gạch đầu dòng mở chủ đề mới (định dạng CO2017)', () => {
		const topics = parseSessionText(
			[
				'Hệ thống tập tin',
				'- Giao diện hệ thống tập tin',
				'- Hiện thực hệ thống tập tin',
				'Hệ thống lưu trữ thứ cấp',
				'- Giới thiệu về giải thuật định thời đĩa',
			].join('\n'),
		);
		expect(topics.map((t) => [t.title, t.items.length])).toEqual([
			['Hệ thống tập tin', 2],
			['Hệ thống lưu trữ thứ cấp', 1],
		]);
	});

	it('buổi chỉ có ôn tập không sinh chủ đề nào', () => {
		expect(parseSessionText('Ôn tập')).toEqual([]);
		expect(parseSessionText('Ôn thi')).toEqual([]);
	});

	it('loại mục trùng tên và bỏ dấu câu thừa cuối dòng', () => {
		const topics = parseSessionText('Danh sách\n- Mảng.\n- mảng\n- Liên kết;');
		expect(topics[0].items.map((i) => i.name)).toEqual(['Mảng', 'Liên kết']);
	});
});

describe('buildSkillGraph', () => {
	const content: Partial<RawOutlineContent> = {
		learning_outcomes: [
			{
				key: 'LO:L.O.1',
				code: 'L.O.1',
				level: 1,
				name: { vi: 'Nền tảng', en: null },
			},
			{
				key: 'LO:L.O.1.1',
				code: 'L.O.1.1',
				level: 2,
				parent_code: 'L.O.1',
				name: { vi: 'Hệ thống số đếm', en: 'Number systems' },
			},
			{
				key: 'LO:L.O.2.1',
				code: 'L.O.2.1',
				level: 2,
				name: { vi: 'Mạch tổ hợp' },
			},
		],
		sessions: [
			{
				label: '3,4',
				order: 3,
				content: {
					vi: 'Chương 3. Mạch tổ hợp\n3.1. SOP và POS\n3.4. Bìa Karnaugh',
				},
				items: [{ outcome_key: 'LO:L.O.2.1' }],
			},
			{
				label: '1',
				order: 1,
				content: { vi: 'Chương 1. Hệ thống số\n1.1. Số đếm\n1.2. Mã BCD' },
				items: [{ outcome_key: 'LO:L.O.1.1' }, { outcome_key: 'LO:L.O.9.9' }],
			},
			{ label: '15', order: 15, content: { vi: 'Ôn tập' }, items: [] },
			{ label: '2', order: 2, content: { vi: 'Đại số Boole' }, items: [] },
		],
		assessment: {
			weights: { lab: 30, midterm: 20, final_exam: 50, other: null },
			midterm: {
				format: { code: 'TN_TL', name: { vi: 'Trắc nghiệm và tự luận' } },
				duration_minutes: 50,
			},
			final_exam: null,
		},
	};

	it('đánh khoá chủ đề/kỹ năng theo thứ tự buổi học, gắn chuẩn đầu ra', () => {
		const graph = buildSkillGraph(outline(content));

		expect(graph.courseRef).toBe('CO1023@9.1');
		expect(graph.topics.map((t) => [t.key, t.title])).toEqual([
			['CO1023@9.1#T1', 'Hệ thống số'],
			['CO1023@9.1#T2', 'Đại số Boole'],
			['CO1023@9.1#T3', 'Mạch tổ hợp'],
		]);
		expect(graph.skills.map((s) => [s.key, s.name, s.label])).toEqual([
			['CO1023@9.1#1.1', 'Số đếm', '1.1'],
			['CO1023@9.1#1.2', 'Mã BCD', '1.2'],
			// Chủ đề không có mục con thành một kỹ năng mang tên chủ đề.
			['CO1023@9.1#2.1', 'Đại số Boole', null],
			['CO1023@9.1#3.1', 'SOP và POS', '3.1'],
			['CO1023@9.1#3.2', 'Bìa Karnaugh', '3.4'],
		]);
		// Chuẩn đầu ra không tồn tại (L.O.9.9) bị bỏ.
		expect(graph.topics[0].outcomeKeys).toEqual(['CO1023@9.1#L.O.1.1']);
		expect(graph.skills[4].outcomeKeys).toEqual(['CO1023@9.1#L.O.2.1']);
		expect(graph.outcomes.find((o) => o.code === 'L.O.1.1')).toMatchObject({
			key: 'CO1023@9.1#L.O.1.1',
			parentCode: 'L.O.1',
			level: 2,
			name: 'Hệ thống số đếm',
		});
	});

	it('nối chủ đề theo thứ tự và nối môn tiên quyết (trừ song hành) vào chủ đề đầu', () => {
		const graph = buildSkillGraph(
			outline(content, {
				prerequisites: [
					{ courseCode: 'CO1005', type: 'recommended', typeRaw: null },
					{ courseCode: 'CO1006', type: 'corequisite', typeRaw: null },
				],
			}),
		);
		expect(graph.edges).toEqual([
			{
				from: 'CO1023@9.1#T1',
				to: 'CO1023@9.1#T2',
				source: 'topic_order',
				relation: null,
			},
			{
				from: 'CO1023@9.1#T2',
				to: 'CO1023@9.1#T3',
				source: 'topic_order',
				relation: null,
			},
			{
				from: 'CO1005',
				to: 'CO1023@9.1#T1',
				source: 'cross_course',
				relation: 'recommended',
			},
		]);
	});

	it('lấy trọng số và hình thức thi, bỏ trọng số null', () => {
		const graph = buildSkillGraph(outline(content));
		expect(graph.assessment).toEqual({
			weights: { lab: 30, midterm: 20, final_exam: 50 },
			midterm: { format: 'Trắc nghiệm và tự luận', durationMinutes: 50 },
			finalExam: null,
		});
	});

	it('dùng tiếng Anh khi được yêu cầu, rơi về tiếng Việt nếu thiếu', () => {
		const graph = buildSkillGraph(outline(content), 'en');
		expect(graph.outcomes.find((o) => o.code === 'L.O.1.1')?.name).toBe(
			'Number systems',
		);
		expect(graph.outcomes.find((o) => o.code === 'L.O.2.1')?.name).toBe(
			'Mạch tổ hợp',
		);
		expect(graph.topics[0].title).toBe('Hệ thống số');
	});

	it('đề cương không có buổi học vẫn trả đồ thị rỗng hợp lệ', () => {
		const graph = buildSkillGraph(outline({}));
		expect(graph.topics).toEqual([]);
		expect(graph.skills).toEqual([]);
		expect(graph.edges).toEqual([]);
	});
});
