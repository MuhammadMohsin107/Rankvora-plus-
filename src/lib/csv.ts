export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/**
 * Parses CSV text (RFC 4180): quoted fields, doubled quotes, commas and line
 * breaks inside quotes, CRLF or LF line ends, and an optional UTF-8 BOM.
 * Rows that are completely empty are skipped.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    row.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.trim() !== "" || fieldWasQuoted) {
        throw new CsvError(
          `Unexpected quote in the middle of a value (row ${rows.length + 1}).`,
        );
      }
      field = "";
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i += 1;
      endRow();
    } else if (char === "\n") {
      endRow();
    } else if (fieldWasQuoted && char.trim() !== "") {
      throw new CsvError(
        `Unexpected text after a closing quote (row ${rows.length + 1}).`,
      );
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new CsvError("A quoted value is never closed.");
  if (field !== "" || row.length > 0 || fieldWasQuoted) endRow();
  return rows;
}

/**
 * Parses CSV with a header row into objects keyed by the lower-cased,
 * trimmed header. Duplicate or empty headers are rejected.
 */
export function parseCsvObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (headers.some((header) => header === "")) {
    throw new CsvError("The header row contains an empty column name.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new CsvError("The header row contains a duplicate column name.");
  }

  return rows.slice(1).map((cells, index) => {
    if (cells.length > headers.length) {
      throw new CsvError(
        `Row ${index + 2} has more values than the ${headers.length} columns in the header.`,
      );
    }
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      record[header] = (cells[column] ?? "").trim();
    });
    return record;
  });
}
