export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(rows: Record<string, string | number | undefined>[]): string {
  if (!rows.length) return '';
  const first = rows[0];
  if (!first) return '';
  const keys = Object.keys(first);
  return [
    keys.join(','),
    ...rows.map((row) => keys.map((k) => csvEscape(String(row[k] ?? ''))).join(',')),
  ].join('\n');
}
