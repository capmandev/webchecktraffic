import * as XLSX from 'xlsx';

export interface ExportRow {
  domain: string;
  monthly_traffic: number | null | undefined;
  is_starred?: boolean;
  checked_at?: string | null;
}

/**
 * Copy only domain names, one per line.
 */
export async function copyDomainsToClipboard(domains: string[]): Promise<boolean> {
  if (domains.length === 0) return false;
  const text = domains.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Copy data as Tab-Separated Values (TSV), ready to paste into Excel or Google Sheets.
 * Raw numbers without comma/dot thousands separators (e.g. 1250000) to prevent parsing errors.
 */
export async function copyTableToClipboard(rows: ExportRow[]): Promise<boolean> {
  if (rows.length === 0) return false;
  const header = 'Domain\tMonthly Traffic';
  const lines = rows.map((r) => {
    const traffic =
      r.monthly_traffic !== null && r.monthly_traffic !== undefined && !isNaN(r.monthly_traffic)
        ? Math.round(r.monthly_traffic)
        : 0;
    return `${r.domain}\t${traffic}`;
  });
  const text = [header, ...lines].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard table copy failed:', err);
    return false;
  }
}

/**
 * Export rows to an Excel (.xlsx) file.
 * Numbers are exported as raw pure integers (e.g. 1250000) without formatting separators.
 */
export function exportToExcel(rows: ExportRow[], filename = 'traffic_data.xlsx'): void {
  if (rows.length === 0) return;

  const data = rows.map((r) => ({
    Domain: r.domain,
    'Monthly Traffic':
      r.monthly_traffic !== null && r.monthly_traffic !== undefined && !isNaN(r.monthly_traffic)
        ? Math.round(r.monthly_traffic)
        : 0,
    'Đánh dấu sao': r.is_starred ? '⭐' : '',
    'Ngày check': r.checked_at ? new Date(r.checked_at).toLocaleDateString('vi-VN') : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Domain
    { wch: 18 }, // Monthly Traffic
    { wch: 14 }, // Star
    { wch: 16 }, // Checked date
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Traffic Check');

  XLSX.writeFile(workbook, filename);
}
