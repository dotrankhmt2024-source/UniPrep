/**
 * Cache trong bộ nhớ có hạn sống, giới hạn số mục (bỏ mục cũ nhất khi đầy).
 *
 * Chỉ để tránh gọi lặp sang Catalog trong vài phút — **không** phải bản sao dữ liệu: hết TTL là
 * đọc lại từ nguồn. Lưu cả Promise để nhiều request đồng thời cho cùng một khoá chỉ gọi một lần.
 */
export class TtlCache<V> {
	private readonly entries = new Map<
		string,
		{ value: Promise<V>; expiresAt: number }
	>();

	constructor(
		private readonly ttlMs: number,
		private readonly maxEntries = 500,
		private readonly now: () => number = Date.now,
	) {}

	getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
		if (this.ttlMs <= 0) return load();
		const hit = this.entries.get(key);
		if (hit && hit.expiresAt > this.now()) return hit.value;

		const value = load();
		this.entries.delete(key);
		this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
		// Lỗi không được cache: lần sau phải thử lại nguồn.
		value.catch(() => {
			if (this.entries.get(key)?.value === value) this.entries.delete(key);
		});
		// Map giữ thứ tự chèn: duyệt từ đầu là đi từ mục cũ nhất.
		for (const oldest of this.entries.keys()) {
			if (this.entries.size <= this.maxEntries) break;
			this.entries.delete(oldest);
		}
		return value;
	}

	clear(): void {
		this.entries.clear();
	}
}
