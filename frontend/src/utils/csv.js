// Tiny dependency-free CSV helpers for the bulk-import feature.
// buildCsv → an Excel-friendly CSV string (UTF-8 BOM so Arabic renders).
// parseCsv → { headers, records } where each record is keyed by header.

const BOM = '﻿';

export function buildCsv(headers, rows) {
  const esc = (val) => {
    const s = val == null ? '' : String(val);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const row of rows) lines.push(row.map(esc).join(','));
  // Prepend BOM so Excel opens UTF-8 (Arabic names) correctly.
  return BOM + lines.join('\r\n');
}

// RFC4180-ish parser: handles quoted fields, embedded commas/newlines, and
// doubled quotes. Tolerates both CRLF and LF line endings.
export function parseCsv(text) {
  if (!text) return { headers: [], records: [] };
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore — CRLF is handled by the \n branch
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => (h || '').trim());
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => c == null || String(c).trim() === '')) continue; // skip blank lines
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] != null ? cells[idx] : ''; });
    records.push(obj);
  }
  return { headers, records };
}
