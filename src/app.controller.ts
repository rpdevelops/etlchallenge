import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { MigrationsService } from './repository/migrations/migrations.service';
import { LogsService } from './repository/logs/logs.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly migrationsService: MigrationsService,
    private readonly logsService: LogsService,
  ) {}

  @Get('/api/get-all-migrations')
  async getAllFromDb() {
    return this.migrationsService.findAllFromDb();
  }

  @Get('/api/get-migrations-unit')
  async getMigrationsUnit() {
    return this.migrationsService.findByStatusAndFiletype(
      '',
      'unit',
    );
  }

  @Get('/api/get-migrations-rentroll')
  async getMigrationsRentRoll() {
    return this.migrationsService.findByStatusAndFiletype(
      '',
      'rentRoll',
    );
  }

  @Get('/api/logs')
  async getAllLogs() {
    return this.logsService.getAllLogs();
  }

  @Get('/api/logs/filter')
  async getLogsFiltered(
    @Query('level') level?: string,
    @Query('context') context?: string,
    @Query('hours') hours?: string,
  ) {
    return this.logsService.getLogsFiltered({
      level,
      context,
      hours: hours ? Number(hours) : undefined,
    });
  }
}
