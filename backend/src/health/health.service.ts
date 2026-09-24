import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async check() {
		const uptimeSeconds = process.uptime();

		let database: 'up' | 'down' = 'down';
		try {
			await this.dataSource.query('SELECT 1');
			database = 'up';
		} catch {
			database = 'down';
		}

		return {
			status: database === 'up' ? 'ok' : 'error',
			uptimeSeconds,
			timestamp: new Date().toISOString(),
			database,
		};
	}
}
