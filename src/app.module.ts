import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { MigrationsModule } from './migrations/migrations.module';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    FileModule,
    MigrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
