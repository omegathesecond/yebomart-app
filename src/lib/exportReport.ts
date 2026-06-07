// Client-side report export helpers.
//
// CSV is produced in-browser as a Blob and downloaded — no backend round-trip.
// PDF reuses the app's existing print-to-PDF path (the `@media print` rule in
// index.css + a `#report-print` element), so we don't pull in a heavy PDF
// library: `window.print()` lets the browser "Save as PDF".

/** RFC-4180-ish field escaping: wrap in quotes and double any embedded quotes. */
function escapeCsvField(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Turn a header row + data rows into a CSV string and trigger a download.
 * Rows are arrays of primitives in column order.
 */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>): void {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(','));
  // Prepend a UTF-8 BOM so Excel opens accented characters (é, È…) correctly.
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Build a filename-safe slug from a shop name + report label + period. */
export function reportFilename(shopName: string, label: string, period: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug(shopName || 'yebomart')}-${slug(label)}-${slug(period)}`;
}
