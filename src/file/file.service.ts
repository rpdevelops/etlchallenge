import { Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as csvParse from 'csv-parse/sync';

@Injectable()
export class FileService {
  validateUnitFile(file: Express.Multer.File): {
    success: boolean;
    message: string;
  } {
    if (!file) {
      return { success: false, message: 'Nenhum arquivo enviado.' };
    }

    // Verifica se está vazio
    if (!file.buffer || file.buffer.length === 0) {
      return { success: false, message: 'Arquivo está vazio.' };
    }

    // Tenta decodificar o conteúdo com os principais encodings
    const encodings = ['utf-8', 'latin1', 'ascii'];
    let content: string | null = null;

    for (const encoding of encodings) {
      try {
        content = iconv.decode(file.buffer, encoding);
        break; // Se decodificar com sucesso, sai do loop
      } catch {
        content = null; // Continua tentando com o próximo encoding
      }
    }

    if (!content) {
      return {
        success: false,
        message: 'Erro ao decodificar o arquivo. Encoding não suportado.',
      };
    }

    // Lê o conteúdo como CSV
    let records: Record<string, any>[];
    let headerLength = 0; // Variável para armazenar o número de colunas do header
    try {
      records = csvParse.parse(content, {
        columns: (header) => {
          // Limpa colunas vazias no header
          const cleanedHeader = header.filter((col) => col.trim() !== '');
          headerLength = cleanedHeader.length; // Armazena o número de colunas do header
          return cleanedHeader;
        },
        skip_empty_lines: true,
        delimiter: ';', // Define o delimitador como ponto e vírgula
        on_record: (record) => {
          // Limita o número de colunas das linhas subsequentes ao número de colunas do header
          const limitedRecord = Object.fromEntries(
            Object.entries(record).slice(0, headerLength),
          );
          return limitedRecord;
        },
        relax_column_count: true, // Permite que as linhas tenham mais colunas que o header
      });
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao ler o arquivo CSV.: ' + error,
      };
    }

    // Verifica se há apenas os headers e nenhuma linha de dados
    if (
      records.length === 0 ||
      records.every((record) =>
        Object.values(record).every((value) => value === ''),
      )
    ) {
      return {
        success: false,
        message: 'O arquivo contém apenas os headers e nenhuma linha de dados.',
      };
    }

    // Verifica headers
    const requiredHeaders = [
      'facilityName',
      'unitNumber',
      'unitSize',
      'unitType',
    ];
    const fileHeaders = records.length > 0 ? Object.keys(records[0]) : [];
    const missingHeaders = requiredHeaders.filter(
      (h) => !fileHeaders.includes(h),
    );
    if (missingHeaders.length > 0) {
      return {
        success: false,
        message: `Headers ausentes: ${missingHeaders.join(', ')}`,
      };
    }

    return { success: true, message: 'Arquivo válido.' };
  }
}
