export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => unknown;
};

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = value instanceof Date ? value.toISOString() : String(value);

  // Guard against spreadsheet formula injection when opened in Excel/Sheets.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }

  return guarded;
}

export function buildCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  );

  return [header, ...lines].join('\r\n');
}

export function downloadCsv<Row>(
  filename: string,
  rows: Row[],
  columns: CsvColumn<Row>[],
) {
  const csv = buildCsv(rows, columns);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function csvTimestamp(): string {
  return new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
}
