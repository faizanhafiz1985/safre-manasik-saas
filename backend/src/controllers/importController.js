const prisma = require('../config/database');
const { IMPORT_SCHEMAS } = require('../config/importSchemas');

// Coerce one cell value against its column spec.
// Returns { value } on success (value === undefined means "leave unset"),
// or { error } with a human-readable message.
function coerceValue(col, raw) {
  let v = raw === undefined || raw === null ? '' : String(raw).trim();
  if (v === '') {
    if (col.required) return { error: `${col.header} is required` };
    if ('default' in col) return { value: col.default };
    return { value: undefined };
  }
  switch (col.type) {
    case 'int': {
      const n = parseInt(v.replace(/[,\s]/g, ''), 10);
      if (isNaN(n)) return { error: `${col.header} must be a whole number` };
      if (col.min != null && n < col.min) return { error: `${col.header} must be at least ${col.min}` };
      if (col.max != null && n > col.max) return { error: `${col.header} must be at most ${col.max}` };
      return { value: n };
    }
    case 'decimal': {
      const n = Number(v.replace(/[,\s]/g, ''));
      if (isNaN(n)) return { error: `${col.header} must be a number` };
      if (n < 0) return { error: `${col.header} cannot be negative` };
      return { value: n };
    }
    case 'bool': {
      const t = v.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(t)) return { value: true };
      if (['false', '0', 'no', 'n'].includes(t)) return { value: false };
      return { error: `${col.header} must be true or false` };
    }
    case 'enum': {
      const match = (col.enumValues || []).find((e) => e.toLowerCase() === v.toLowerCase());
      if (!match) return { error: `${col.header} must be one of: ${(col.enumValues || []).join(', ')}` };
      return { value: match };
    }
    case 'digits': {
      const d = v.replace(/\D/g, '');
      if (!d) return { error: `${col.header} must be numeric` };
      if (col.len && d.length !== col.len) return { error: `${col.header} must be exactly ${col.len} digits` };
      return { value: d };
    }
    case 'list': {
      return { value: v.split(/[;|]/).map((s) => s.trim()).filter(Boolean) };
    }
    default: {
      if (col.maxLen) v = v.slice(0, col.maxLen);
      return { value: v };
    }
  }
}

// Translate a Prisma/DB error into a short, user-facing message.
function dbErrorMessage(e) {
  if (e && e.code === 'P2002') {
    const f = e.meta && e.meta.target ? [].concat(e.meta.target).join(', ') : 'value';
    return `Duplicate ${f} — a record with this value already exists`;
  }
  if (e && e.code === 'P2003') return 'References a record that does not exist';
  return (e && e.message ? e.message.split('\n')[0] : 'Could not save row');
}

// GET /api/import/:entity/template — the column spec the frontend uses to build
// the downloadable template (headers + example row).
const getTemplate = (req, res) => {
  const schema = IMPORT_SCHEMAS[req.params.entity];
  if (!schema) return res.status(404).json({ error: `Unknown import type: ${req.params.entity}` });
  res.json({
    entity: req.params.entity,
    label: schema.label,
    columns: schema.columns.map((c) => ({
      key: c.key,
      header: c.header,
      required: !!c.required,
      type: c.type,
      enumValues: c.enumValues || null,
      example: c.example != null ? String(c.example) : '',
    })),
  });
};

// GET /api/import — list importable entities (for menus).
const listEntities = (req, res) => {
  const role = req.user && req.user.role;
  const list = Object.entries(IMPORT_SCHEMAS)
    .filter(([, s]) => !s.roles || s.roles.includes(role))
    .map(([key, s]) => ({ entity: key, label: s.label }));
  res.json(list);
};

// POST /api/import/:entity — bulk-create rows. Body: { rows: [ {header: value} ] }.
// tenantId is auto-injected by the Prisma tenant middleware on create.
const bulkImport = async (req, res, next) => {
  try {
    const key = req.params.entity;
    const schema = IMPORT_SCHEMAS[key];
    if (!schema) return res.status(404).json({ error: `Unknown import type: ${key}` });
    if (schema.roles && !schema.roles.includes(req.user.role)) {
      return res.status(403).json({ error: `You do not have permission to import ${schema.label}` });
    }

    const rows = req.body && Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: 'Body must include a "rows" array' });
    if (!rows.length) return res.status(400).json({ error: 'No rows found in the uploaded file' });
    if (rows.length > 1000) return res.status(400).json({ error: 'Too many rows — maximum 1000 per upload' });

    const errors = [];
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2; // sheet row number (row 1 is the header)
      const src = rows[i] || {};
      // Skip fully-blank rows (trailing empty lines from spreadsheets).
      if (Object.values(src).every((x) => x == null || String(x).trim() === '')) continue;

      const data = {};
      let rowErr = null;
      for (const col of schema.columns) {
        const raw = src[col.header] !== undefined ? src[col.header] : src[col.key];
        const { value, error } = coerceValue(col, raw);
        if (error) { rowErr = error; break; }
        if (value !== undefined) data[col.key] = col.transform ? col.transform(value) : value;
      }
      if (!rowErr && schema.validateRow) rowErr = schema.validateRow(data);
      if (rowErr) { errors.push({ row: rowNo, error: rowErr }); continue; }

      try {
        await prisma[schema.model].create({ data });
        created++;
      } catch (e) {
        errors.push({ row: rowNo, error: dbErrorMessage(e) });
      }
    }

    res.json({ entity: key, total: rows.length, created, failed: errors.length, errors });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTemplate, listEntities, bulkImport };
