// CSV export for the datatables. Opens cleanly in Excel and Sheets, including
// Devanagari (the BOM is what tells Excel the file is UTF-8).

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);

  // A name or message someone typed into the app can start with `=`, and a
  // spreadsheet will run that as a formula. A leading apostrophe makes it text.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Reads CSV text into rows of cells: quoted cells, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellText = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cellText += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cellText += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cellText); cellText = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cellText); cellText = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cellText += ch;
  }
  row.push(cellText);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
