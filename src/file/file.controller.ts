import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('unit')
  @UseInterceptors(FileInterceptor('file'))
  uploadUnitFile(@UploadedFile() file: Express.Multer.File) {
    const validation = this.fileService.validateUnitFile(file);
    if (!validation.success) {
      throw new BadRequestException(validation.message);
    }
    return { message: 'Arquivo validado com sucesso!' };
  }
}
