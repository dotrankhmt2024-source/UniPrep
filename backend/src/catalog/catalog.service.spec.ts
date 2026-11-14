import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CatalogClient, type CatalogOutlineVersion } from './catalog.client';
import { CatalogService } from './catalog.service';
import type { CatalogOutline } from './catalog.types';
import { TtlCache } from './ttl-cache';

function version(v: string, appliesFrom: string): CatalogOutlineVersion {
	return {
		id: `id-${v}`,
		courseCode: 'CO1023',
		version: v,
		appliesFrom,
		name: { vi: 'Hệ thống số', en: 'Digital Systems' },
		credits: 3,
		facultyCode: 'MT',
	};
}

function outlineOf(v: string): CatalogOutline {
	return {
		ref: `CO1023@${v}`,
		courseCode: 'CO1023',
		version: v,
		appliesFrom: '261',
		sourceCode: null,
		sourceUpdatedAt: null,
		contentHash: `hash-${v}`,
		name: { vi: 'Hệ thống số', en: null },
		credits: 3,
		prerequisites: [],
		content: {
			course_code: 'CO1023',
			version: v,
			sessions: [
				{
					order: 1,
					content: { vi: 'Chương 1. Hệ thống số\n1.1. Số đếm' },
					items: [],
				},
			],
		},
	};
}

class FakeClient extends CatalogClient {
	listVersions = jest.fn((code: string) =>
		Promise.resolve(
			code === 'CO1023' ? [version('8.1', '231'), version('9.1', '261')] : [],
		),
	);
	getOutline = jest.fn((_code: string, v: string) =>
		Promise.resolve(v === '8.1' || v === '9.1' ? outlineOf(v) : null),
	);
	searchCourses = jest.fn(() =>
		Promise.resolve({
			versions: [version('8.1', '231'), version('9.1', '261')],
			totalCourses: 41,
		}),
	);
	get isConfigured() {
		return true;
	}
}

function makeService(ttlSeconds = '300') {
	const client = new FakeClient();
	const config = { get: () => ttlSeconds } as unknown as ConfigService;
	return { client, service: new CatalogService(client, config) };
}

describe('CatalogService', () => {
	it('không truyền version thì lấy bản hiện hành, và cache đề cương', async () => {
		const { client, service } = makeService();
		const first = await service.getOutline('co1023');
		const second = await service.getOutline('CO1023');
		expect(first.version).toBe('9.1');
		expect(second).toBe(first);
		expect(client.listVersions).toHaveBeenCalledTimes(1);
		expect(client.getOutline).toHaveBeenCalledTimes(1);
		expect(client.getOutline).toHaveBeenCalledWith('CO1023', '9.1');
	});

	it('TTL = 0 thì luôn đọc lại nguồn', async () => {
		const { client, service } = makeService('0');
		await service.getOutline('CO1023', '8.1');
		await service.getOutline('CO1023', '8.1');
		expect(client.getOutline).toHaveBeenCalledTimes(2);
	});

	it('báo 400 với mã môn/phiên bản sai và 404 khi không có', async () => {
		const { service } = makeService();
		await expect(service.getOutline('CO 1023')).rejects.toBeInstanceOf(
			BadRequestException,
		);
		await expect(service.getOutline('CO1023', 'x')).rejects.toBeInstanceOf(
			BadRequestException,
		);
		await expect(service.getOutline('CO9999')).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.getOutline('CO1023', '7.1')).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('tra kỹ năng theo khoá', async () => {
		const { service } = makeService();
		const resolved = await service.resolveSkill('CO1023@8.1#1.1');
		expect(resolved.skill.name).toBe('Số đếm');
		expect(resolved.topic.title).toBe('Hệ thống số');
		await expect(service.resolveSkill('CO1023@8.1#9.9')).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.resolveSkill('CO1023@8.1')).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it('gom các phiên bản thành một dòng mỗi môn và trả tổng số môn', async () => {
		const { service } = makeService();
		const result = await service.searchCourses({
			q: 'CO10',
			page: 2,
			take: 20,
		});
		expect(result.items).toEqual([
			{
				courseCode: 'CO1023',
				latestVersion: '9.1',
				versions: ['8.1', '9.1'],
				name: { vi: 'Hệ thống số', en: 'Digital Systems' },
				credits: 3,
				facultyCode: 'MT',
			},
		]);
		expect(result.meta).toMatchObject({ page: 2, itemCount: 41, pageCount: 3 });
	});
});

describe('TtlCache', () => {
	it('hết hạn thì tải lại, lỗi thì không bị cache', async () => {
		let now = 0;
		const cache = new TtlCache<number>(1000, 10, () => now);
		const load = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
		expect(await cache.getOrLoad('k', load)).toBe(1);
		expect(await cache.getOrLoad('k', load)).toBe(1);
		now = 1500;
		expect(await cache.getOrLoad('k', load)).toBe(2);

		const failing = jest
			.fn()
			.mockRejectedValueOnce(new Error('down'))
			.mockResolvedValueOnce(3);
		await expect(cache.getOrLoad('e', failing)).rejects.toThrow('down');
		expect(await cache.getOrLoad('e', failing)).toBe(3);
	});

	it('giới hạn số mục, bỏ mục cũ nhất', async () => {
		const cache = new TtlCache<string>(10_000, 2);
		const load = jest.fn(() => Promise.resolve('v'));
		await cache.getOrLoad('a', load);
		await cache.getOrLoad('b', load);
		await cache.getOrLoad('c', load);
		await cache.getOrLoad('a', load);
		expect(load).toHaveBeenCalledTimes(4);
	});
});
