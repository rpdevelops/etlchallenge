import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseService } from '../supabase/supabase.service';
import { MigrationsService } from '../repository/migrations/migrations.service';

function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
}

@Controller('file')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly supabaseService: SupabaseService,
    private readonly migrationsService: MigrationsService,
  ) {}

  @Post('unit')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUnitFile(@UploadedFile() file: Express.Multer.File) {
    const requiredHeaders = [
      'facilityName',
      'unitNumber',
      'unitSize',
      'unitType',
    ];
    const validation = this.fileService.validateFile(file, requiredHeaders);
    if (!validation.success) {
      throw new BadRequestException(validation.message);
    }

    const cleanName = sanitizeFilename(file.originalname);

    // Upload to supabase storage
    try {
      await this.supabaseService.uploadFile(
        'importedcsv',
        cleanName,
        file.buffer,
        file.mimetype,
      );
    } catch (err: any) {
      throw new BadRequestException(
        'Error to save file on Storage: ' + (err?.message || err),
      );
    }

    // register in migrationsControl table
    try {
      await this.migrationsService.createMigrationControl({
        filename: cleanName,
        filetype: 'unit',
      });
    } catch (err) {
      console.error('Error to register in migrationscontrol table:', err);
      throw new BadRequestException(
        'File saved on Storage, but could not register in migrationsControl table.',
      );
    }

    return { message: 'File Imported Successfuly!' };
  }

  @Post('rentroll')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRentRollFile(@UploadedFile() file: Express.Multer.File) {
    const requiredHeaders = [
      'facilityName',
      'unitNumber',
      'firstName',
      'lastName',
      'phone',
      'email',
      'rentStartDate',
      'rentEndDate',
      'monthlyRent',
      'currentRentOwed',
      'currentRentOwedDueDate',
    ];
    const validation = this.fileService.validateFile(file, requiredHeaders);
    if (!validation.success) {
      throw new BadRequestException(validation.message);
    }

    const cleanName = sanitizeFilename(file.originalname);

    // upload to supabase storage
    try {
      await this.supabaseService.uploadFile(
        'importedcsv',
        cleanName,
        file.buffer,
        file.mimetype,
      );
    } catch (err: any) {
      throw new BadRequestException(
        'Error to save file on Storage: ' + (err?.message || err),
      );
    }

    // load in migrationsControl table
    try {
      await this.migrationsService.createMigrationControl({
        filename: cleanName,
        filetype: 'rentRoll',
      });
    } catch (err) {
      console.error('Error to register in migrationscontrol table:', err);
      throw new BadRequestException(
        'File saved on Storage, but could not register in migrationsControl table.',
      );
    }

    return { message: 'File Imported Successfuly!' };
  }
}
