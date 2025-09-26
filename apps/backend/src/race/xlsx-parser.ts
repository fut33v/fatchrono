import { inflateRawSync } from 'node:zlib';

type ZipEntryMeta = {
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type ParsedRow = {
  rowIndex: number;
  cells: Map<number, string>;
};

type WorkbookData = {
  sharedStrings: string[];
  sheetXml: string;
};

const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;

function readUInt32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function readUInt16LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function locateEndOfCentralDirectory(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIR_SIGNATURE) {
      return offset;
    }
  }
  throw new Error('Не удалось найти конец ZIP-архива');
}

function parseCentralDirectory(buffer: Buffer): Map<string, ZipEntryMeta> {
  const endOffset = locateEndOfCentralDirectory(buffer);
  const centralDirectorySize = readUInt32LE(buffer, endOffset + 12);
  const centralDirectoryOffset = readUInt32LE(buffer, endOffset + 16);

  const entries = new Map<string, ZipEntryMeta>();
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end) {
    const signature = readUInt32LE(buffer, offset);
    if (signature !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      break;
    }

    const compression = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8');

    entries.set(fileName, {
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function extractEntry(buffer: Buffer, meta: ZipEntryMeta): Buffer {
  const headerOffset = meta.localHeaderOffset;
  const signature = readUInt32LE(buffer, headerOffset);
  if (signature !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error('Некорректный заголовок ZIP-файла');
  }

  const fileNameLength = readUInt16LE(buffer, headerOffset + 26);
  const extraLength = readUInt16LE(buffer, headerOffset + 28);
  const dataStart = headerOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + meta.compressedSize;
  const slice = buffer.subarray(dataStart, dataEnd);

  if (meta.compression === 0) {
    return Buffer.from(slice);
  }

  if (meta.compression === 8) {
    return inflateRawSync(slice);
  }

  throw new Error(`Метод сжатия ${meta.compression} не поддерживается`);
}

function parseWorkbook(buffer: Buffer): WorkbookData {
  const entries = parseCentralDirectory(buffer);

  const sharedStringsEntry = entries.get('xl/sharedStrings.xml');
  const workbookEntry = entries.get('xl/workbook.xml');
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');

  if (!workbookEntry || !relsEntry) {
    throw new Error('Некорректный XLSX-файл: отсутствует workbook.xml');
  }

  const workbookXml = extractEntry(buffer, workbookEntry).toString('utf8');
  const relsXml = extractEntry(buffer, relsEntry).toString('utf8');

  const sheetTarget = resolveFirstSheetPath(workbookXml, relsXml);
  const sheetEntry = entries.get(sheetTarget);
  if (!sheetEntry) {
    throw new Error('Не удалось найти основной лист таблицы');
  }

  const sheetXml = extractEntry(buffer, sheetEntry).toString('utf8');
  const sharedStringsXml = sharedStringsEntry
    ? extractEntry(buffer, sharedStringsEntry).toString('utf8')
    : '';

  return {
    sharedStrings: parseSharedStrings(sharedStringsXml),
    sheetXml,
  };
}

function resolveFirstSheetPath(workbookXml: string, relsXml: string): string {
  const sheetMatch = /<sheet[^>]*r:id="([^"]+)"[^>]*>/i.exec(workbookXml);
  if (!sheetMatch) {
    throw new Error('Не удалось определить лист Excel');
  }
  const relId = sheetMatch[1];

  const relationships = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g)];
  for (const [, id, target] of relationships) {
    if (id === relId) {
      if (target.startsWith('/')) {
        return target.slice(1);
      }
      if (target.startsWith('..')) {
        const normalised = target.replace(/^\.\.\//, '');
        return `xl/${normalised}`;
      }
      if (target.startsWith('xl/')) {
        return target;
      }
      return `xl/${target}`;
    }
  }

  throw new Error('Не удалось найти путь к листу Excel');
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) {
    return [];
  }

  const entries: string[] = [];
  const siRegex = /<si[\s\S]*?>[\s\S]*?<\/si>/g;
  const matches = xml.match(siRegex);
  if (!matches) {
    return entries;
  }

  for (const si of matches) {
    let text = '';
    const textMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
    if (textMatches) {
      for (const t of textMatches) {
        const contentMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(t);
        if (!contentMatch) {
          continue;
        }
        text += decodeXml(contentMatch[1]);
      }
    } else {
      text += '';
    }
    entries.push(text);
  }

  return entries;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function columnIndexFromRef(ref: string | undefined): number | null {
  if (!ref) {
    return null;
  }
  const match = ref.match(/^[A-Z]+/i);
  if (!match) {
    return null;
  }
  const letters = match[0].toUpperCase();
  let result = 0;
  for (const char of letters) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowFullText = rowMatch[0];
    const rowInner = rowMatch[1];
    const attrsMatch = /^<row([^>]*)>/.exec(rowFullText);
    const attrs = attrsMatch?.[1] ?? '';
    const rowIndexMatch = attrs.match(/\sr="(\d+)"/);
    const rowIndex = rowIndexMatch ? Number.parseInt(rowIndexMatch[1], 10) : rows.length + 1;

    const cells = new Map<number, string>();
    const cellRegex = /<c([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      const cellAttrs = cellMatch[1];
      const cellContent = cellMatch[2];
      const cellRefMatch = cellAttrs.match(/\sr="([^"]+)"/);
      const colIndex = columnIndexFromRef(cellRefMatch?.[1]) ?? cells.size;
      const cellTypeMatch = cellAttrs.match(/\st="([^"]+)"/);
      const cellType = cellTypeMatch?.[1] ?? 'n';

      let text = '';
      if (cellType === 's') {
        const valueMatch = cellContent.match(/<v>([\s\S]*?)<\/v>/);
        if (valueMatch) {
          const sharedIndex = Number.parseInt(valueMatch[1], 10);
          text = sharedStrings[sharedIndex] ?? '';
        }
      } else if (cellType === 'inlineStr') {
        const inlineMatches = cellContent.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
        if (inlineMatches) {
          for (const inline of inlineMatches) {
            const inlineValue = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inline);
            if (inlineValue) {
              text += decodeXml(inlineValue[1]);
            }
          }
        }
      } else {
        const valueMatch = cellContent.match(/<v>([\s\S]*?)<\/v>/);
        if (valueMatch) {
          text = valueMatch[1];
        } else {
          const inlineMatches = cellContent.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
          if (inlineMatches) {
            for (const inline of inlineMatches) {
              const inlineValue = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inline);
              if (inlineValue) {
                text += decodeXml(inlineValue[1]);
              }
            }
          }
        }
      }

      cells.set(colIndex, text.trim());
    }

    rows.push({
      rowIndex,
      cells,
    });
  }

  return rows;
}

export type ParsedParticipantRow = {
  rowIndex: number;
  data: Record<string, string>;
};

export function extractParticipantRows(buffer: Buffer): ParsedParticipantRow[] {
  const workbook = parseWorkbook(buffer);
  const rows = parseSheetRows(workbook.sheetXml, workbook.sharedStrings);
  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0];
  const headers: string[] = [];
  const headerEntries = [...headerRow.cells.entries()].sort((a, b) => a[0] - b[0]);
  for (const [index, value] of headerEntries) {
    headers[index] = normaliseHeader(value);
  }

  const participantRows: ParsedParticipantRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const record: Record<string, string> = {};
    for (const [colIndex, value] of row.cells.entries()) {
      const header = headers[colIndex];
      if (!header) {
        continue;
      }
      if (value !== '') {
        record[header] = value;
      } else {
        record[header] = '';
      }
    }

    const hasValues = Object.values(record).some((val) => val && val.trim() !== '');
    if (!hasValues) {
      continue;
    }

    participantRows.push({
      rowIndex: row.rowIndex,
      data: record,
    });
  }

  return participantRows;
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function parseExcelSerialDate(serial: number): Date {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const millis = serial * 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + millis);
}

export function parseDateValue(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(trimmed)) {
    return parseExcelSerialDate(numeric);
  }

  const dotMatch = trimmed.match(/^(\d{2})[.](\d{2})[.](\d{4})$/);
  if (dotMatch) {
    const [, dd, mm, yyyy] = dotMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  const dashMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const [, dd, mm, yyyy] = dashMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}
