import React, { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box,
  Alert, CircularProgress, List, ListItem, ListItemText, Chip, Divider,
} from '@mui/material';
import { UploadFile, Download } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { toast } from 'react-toastify';
import { buildCsv, parseCsv } from '../utils/csv';

// Coerce one spreadsheet cell to the string form the CSV pipeline expects.
// Dates (Excel stores them as serials → JS Date when cellDates:true) are
// emitted as YYYY-MM-DD using LOCAL parts, matching what the user typed.
function cellToString(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

// Parse the first sheet of an .xlsx/.xls workbook into records keyed by the
// header row — the exact shape parseCsv() returns, so the rest of the flow
// (and the backend) is format-agnostic.
function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: '' });
  if (!aoa.length) return [];
  const headers = (aoa[0] || []).map((h) => String(h == null ? '' : h).trim());
  const records = [];
  for (let r = 1; r < aoa.length; r++) {
    const cells = aoa[r] || [];
    if (cells.every((c) => c == null || String(c).trim() === '')) continue;
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cellToString(cells[i]); });
    records.push(obj);
  }
  return records;
}

// Reusable "Import" button + dialog. Download a template, fill it, upload it.
//   <BulkImport entity="customers" label="Customers" onDone={fetchList} />
export default function BulkImport({ entity, label, onDone, size = 'small', variant = 'outlined' }) {
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState(null);

  const loadTemplate = async () => {
    const r = await api.get(`/import/${entity}/template`);
    setCols(r.data.columns);
    return r.data.columns;
  };

  const openDialog = async () => {
    setResult(null); setRows(null); setFileName(''); setCols(null);
    setOpen(true);
    try { await loadTemplate(); } catch { /* interceptor toasts */ }
  };

  const downloadTemplate = async () => {
    try {
      const columns = cols || (await loadTemplate());
      const headers = columns.map((c) => c.header);
      const example = columns.map((c) => c.example || '');
      const csv = buildCsv(headers, [example]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}-template.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Could not build template'); }
  };

  const onPick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name); setResult(null); setRows(null);
    const name = (file.name || '').toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = isExcel
          ? parseWorkbook(reader.result)
          : parseCsv(String(reader.result || '')).records;
        setRows(records);
        if (!records.length) toast.warn('No data rows found below the header');
      } catch {
        toast.error('Could not read the file — please upload a .csv or .xlsx');
        setRows(null);
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'utf-8');
    e.target.value = ''; // allow re-picking the same file after edits
  };

  const doUpload = async () => {
    if (!rows || !rows.length) { toast.error('No data rows to upload'); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api.post(`/import/${entity}`, { rows });
      setResult(r.data);
      if (r.data.created > 0) { toast.success(`Imported ${r.data.created} record(s)`); onDone && onDone(); }
      else if (r.data.failed > 0) toast.error('No rows imported — see errors below');
    } catch { /* interceptor toasts */ } finally { setBusy(false); }
  };

  const sev = result ? (result.failed === 0 ? 'success' : (result.created ? 'warning' : 'error')) : 'info';

  return (
    <>
      <Button variant={variant} size={size} startIcon={<UploadFile />} onClick={openDialog}>Import</Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import {label}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Step 1</strong> — Download the template. <strong>Step 2</strong> — Fill one row per record,
            keeping the header row unchanged. <strong>Step 3</strong> — Save and upload it — <strong>CSV or Excel
            (.xlsx)</strong> both work.
          </Alert>

          <Button startIcon={<Download />} onClick={downloadTemplate} variant="contained" sx={{ mb: 2 }}>
            Download template
          </Button>

          {cols && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Columns (required marked with *):</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {cols.map((c) => (
                  <Chip key={c.key} size="small" variant="outlined"
                    color={c.required ? 'primary' : 'default'}
                    label={c.required ? `${c.header} *` : c.header} />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Button variant="outlined" component="label" startIcon={<UploadFile />}>
            Choose CSV or Excel file
            <input hidden type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={onPick} />
          </Button>
          {fileName && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {fileName} — {rows ? `${rows.length} row(s) ready to upload` : 'reading…'}
            </Typography>
          )}

          {result && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={sev}>
                Imported <strong>{result.created}</strong> of {result.total}.
                {result.failed > 0 ? ` ${result.failed} row(s) failed.` : ' All rows imported.'}
              </Alert>
              {result.errors && result.errors.length > 0 && (
                <List dense sx={{ maxHeight: 220, overflow: 'auto', mt: 1, bgcolor: '#fff7f7', borderRadius: 1 }}>
                  {result.errors.map((er, i) => (
                    <ListItem key={i} sx={{ py: 0.25 }}>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }}
                        primary={`Row ${er.row}: ${er.error}`} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>Close</Button>
          <Button variant="contained" onClick={doUpload} disabled={busy || !(rows && rows.length)}>
            {busy ? <CircularProgress size={20} /> : `Upload${rows && rows.length ? ` ${rows.length} row(s)` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
