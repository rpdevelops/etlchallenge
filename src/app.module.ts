import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { SupabaseService } from './supabase/supabase.service';
import { ConfigModule } from '@nestjs/config';
import { KnexService } from './knex/knex.service';
import { DatabaseModule } from './database/database.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { RepositoryModule } from './repository/repository.module';
@Module({
  imports: [
    ConfigModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    FileModule,
    DatabaseModule,
    SchedulerModule,
    RepositoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, SupabaseService, KnexService],
})
export class AppModule {}
