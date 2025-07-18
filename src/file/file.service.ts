import { Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as csvParse from 'csv-parse/sync';

@Injectable()
export class FileService {
  validateFile(
    file: Express.Multer.File,
    requiredHeaders: string[],
  ): {
    success: boolean;
    message: string;
  } {
    if (!file) {
      return { success: false, message: 'File not sent.' };
    }

    // verify if the file is empty
    if (!file.buffer || file.buffer.length === 0) {
      return { success: false, message: 'File is empty.' };
    }

    // try to decode the file with multiple encodings
    const encodings = ['utf-8', 'latin1', 'ascii'];
    let content: string | null = null;

    for (const encoding of encodings) {
      try {
        content = iconv.decode(file.buffer, encoding);
        break; // if successful, break the loop
      } catch {
        content = null; // keep trying with the next encoding
      }
    }

    if (!content) {
      return {
        success: false,
        message: 'Error decoding the file. Encoding not supported.',
      };
    }

    // read the CSV content
    let records: Record<string, any>[];
    let headerLength = 0; // variable to store the number of columns in the header
    try {
      records = csvParse.parse(content, {
        columns: (header) => {
          // Limpa colunas vazias no header
          const cleanedHeader = header.filter((col) => col.trim() !== '');
          headerLength = cleanedHeader.length; // store the number of columns
          return cleanedHeader;
        },
        skip_empty_lines: true,
        delimiter: ';', // define the delimiter as semicolon
        on_record: (record) => {
          // limita the number of columns in each record to the header length
          const limitedRecord = Object.fromEntries(
            Object.entries(record).slice(0, headerLength),
          );
          return limitedRecord;
        },
        relax_column_count: true, // allow to have more columns in the records than in the header
      });
    } catch (error) {
      return {
        success: false,
        message: 'Error to read the csv file.: ' + error,
      };
    }

    // verify if the file has only headers and no data
    if (
      records.length === 0 ||
      records.every((record) =>
        Object.values(record).every((value) => value === ''),
      )
    ) {
      return {
        success: false,
        message: 'The file has only headers and no data.',
      };
    }

    const fileHeaders = records.length > 0 ? Object.keys(records[0]) : [];
    const missingHeaders = requiredHeaders.filter(
      (h) => !fileHeaders.includes(h),
    );
    if (missingHeaders.length > 0) {
      return {
        success: false,
        message: `Missing headers: ${missingHeaders.join(', ')}`,
      };
    }

    return { success: true, message: 'Valid File.' };
  }
}
