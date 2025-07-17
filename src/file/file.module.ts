import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RepositoryModule } from 'src/repository/repository.module';

@Module({
  imports: [ConfigModule, RepositoryModule],
  controllers: [FileController],
  providers: [FileService, SupabaseService],
  exports: [],
})
export class FileModule {}
