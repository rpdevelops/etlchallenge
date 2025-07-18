import { Injectable, Logger } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly knexService: KnexService) {}

  async createLog(level: string, context: string, message: string) {
    this.logger.log(`Creating log: ${level} - ${context} - ${message}`);
    try {
      await this.knexService.db('logs').insert({
        level,
        context,
        message,
        createdat: new Date(),
      });
    } catch (err) {
      this.logger.error(`Error inserting log on database: ${err?.message || err}`);
    }
  }

  async getAllLogs() {
    return this.knexService.db('logs').orderBy('createdat', 'desc');
  }

  async getLogsByLastHours(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.knexService
      .db('logs')
      .where('createdat', '>=', since)
      .orderBy('createdat', 'desc');
  }

  async getLogsFiltered({
    level,
    context,
    hours,
  }: { level?: string; context?: string; hours?: number }) {
    let query = this.knexService.db('logs');
    if (level) query = query.where('level', level);
    if (context) query = query.where('context', context);
    if (hours) {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      query = query.where('createdat', '>=', since);
    }
    return query.orderBy('createdat', 'desc');
  }
}
