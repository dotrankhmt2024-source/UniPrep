import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	/**
	 * `GET /api` — banner cho biết service đã sống. Công khai vì không trả dữ liệu nghiệp vụ nào;
	 * nằm trong danh sách route public của E1-T3 (`docs/04-plan/implementation-plan.md`).
	 */
	@Get()
	@Public()
	getHello(): string {
		return this.appService.getHello();
	}
}
