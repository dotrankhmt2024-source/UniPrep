import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(private readonly healthService: HealthService) {}

	/**
	 * `GET /api/health` **phải** công khai (DoD E1-T3): đây là endpoint cho giám sát/uptime check,
	 * không có token nên nếu bị `JwtAuthGuard` chặn thì hệ thống giám sát luôn thấy service "chết".
	 */
	@Get()
	@Public()
	@ApiOperation({ summary: 'Kiểm tra tình trạng service và kết nối database' })
	check() {
		return this.healthService.check();
	}
}
