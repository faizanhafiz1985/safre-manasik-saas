import * as XLSX from 'xlsx';

// Export an array of plain row objects to a downloaded .xlsx file.
// Keys of the first row become the column headers. Reuses the SheetJS
// dependency already bundled for bulk import.
export function exportToXlsx(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel caps sheet names at 31 chars
  XLSX.writeFile(wb, filename);
}
