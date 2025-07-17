import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MigrationsService } from './repository/migrations/migrations.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
    private readonly migrationsService: MigrationsService
  ) {}

  @Get('/api/get-all-migrations')
  async getAllFromDb() {
    return this.migrationsService.findAllFromDb();
  }
}
