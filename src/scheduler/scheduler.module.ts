/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { MigrationsService } from '../repository/migrations/migrations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RepositoryModule } from '../repository/repository.module';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ScheduleModule.forRoot(), RepositoryModule, DatabaseModule, ConfigModule],
  providers: [SchedulerService, MigrationsService, SupabaseService],
})
export class SchedulerModule {}
