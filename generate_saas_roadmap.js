const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, ExternalHyperlink
} = require('C:/nvm4w/nodejs/node_modules/docx');
const fs = require('fs');

// ─── Colour palette ──────────────────────────────────────────────────────────
const C = {
  teal:      '0D7377',
  tealLight: 'E6F4F4',
  tealMid:   '14A085',
  navy:      '1B2A4A',
  gray:      '5A6475',
  lightGray: 'F2F4F7',
  medGray:   'D0D5DD',
  white:     'FFFFFF',
  red:       'C0392B',
  orange:    'E67E22',
  green:     '27AE60',
  blue:      '2980B9',
  yellow:    'F39C12',
};

// ─── Reusable border set ─────────────────────────────────────────────────────
function cellBorder(color = C.medGray) {
  const b = { style: BorderStyle.SINGLE, size: 1, color };
  return { top: b, bottom: b, left: b, right: b };
}
function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: C.white };
  return { top: b, bottom: b, left: b, right: b };
}

// ─── Helper: plain paragraph ─────────────────────────────────────────────────
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80 },
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts.bold ?? false,
      italics: opts.italic ?? false,
      size: opts.size ?? 22,
      color: opts.color ?? C.navy,
      font: 'Arial',
    })],
  });
}

// ─── Helper: heading ─────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 34, color: C.teal, font: 'Arial' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 4 } },
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: C.navy, font: 'Arial' })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 23, color: C.tealMid, font: 'Arial' })],
  });
}

// ─── Helper: bullet ──────────────────────────────────────────────────────────
function bullet(text, level = 0, bold = false) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, color: C.navy, font: 'Arial', bold })],
  });
}
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'numbers', level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, color: C.navy, font: 'Arial' })],
  });
}

// ─── Helper: labelled line ───────────────────────────────────────────────────
function labelLine(label, value) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: label + ': ', bold: true, size: 22, color: C.navy, font: 'Arial' }),
      new TextRun({ text: value, size: 22, color: C.gray, font: 'Arial' }),
    ],
  });
}

// ─── Helper: divider ─────────────────────────────────────────────────────────
function divider() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.medGray, space: 1 } },
    children: [],
  });
}

// ─── Helper: spacer ──────────────────────────────────────────────────────────
function spacer(pts = 120) {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
}

// ─── Helper: info box ────────────────────────────────────────────────────────
function infoBox(lines, color = C.tealLight, borderColor = C.teal) {
  const rows = lines.map(line =>
    new TableRow({
      children: [new TableCell({
        borders: noBorder(),
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
        width: { size: 9360, type: WidthType.DXA },
        children: Array.isArray(line) ? line : [para(line, { before: 20, after: 20 })],
      })],
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      left: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
      insideH: { style: BorderStyle.NONE, size: 0, color: C.white },
      insideV: { style: BorderStyle.NONE, size: 0, color: C.white },
    },
    rows,
  });
}

// ─── Helper: code block ──────────────────────────────────────────────────────
function codeBlock(lines) {
  const rows = lines.map(line =>
    new TableRow({
      children: [new TableCell({
        borders: noBorder(),
        shading: { fill: '1E2837', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 200, right: 200 },
        width: { size: 9360, type: WidthType.DXA },
        children: [new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [new TextRun({ text: line || ' ', size: 18, color: '7EC8A0', font: 'Courier New' })],
        })],
      })],
    })
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: '3A4A5C' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: '3A4A5C' },
      left: { style: BorderStyle.SINGLE, size: 2, color: '3A4A5C' },
      right: { style: BorderStyle.SINGLE, size: 2, color: '3A4A5C' },
      insideH: { style: BorderStyle.NONE, size: 0, color: '1E2837' },
      insideV: { style: BorderStyle.NONE, size: 0, color: '1E2837' },
    },
    rows,
  });
}

// ─── Helper: generic table ───────────────────────────────────────────────────
function dataTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        borders: cellBorder(C.teal),
        shading: { fill: C.teal, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        width: { size: colWidths[i], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: h, bold: true, size: 20, color: C.white, font: 'Arial' })],
        })],
      })
    ),
  });
  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          borders: cellBorder(),
          shading: { fill: ri % 2 === 0 ? C.white : C.lightGray, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          width: { size: colWidths[ci], type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: typeof cell === 'string'
            ? [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: C.navy, font: 'Arial' })] })]
            : cell,
        })
      ),
    })
  );
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ─── Helper: priority badge ───────────────────────────────────────────────────
function priorityCell(text, colWidth) {
  const colorMap = { 'Critical': C.red, 'High': C.orange, 'Medium': C.blue, 'Low': C.gray };
  const fill = colorMap[text] || C.gray;
  return new TableCell({
    borders: cellBorder(),
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    width: { size: colWidth, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, color: C.white, font: 'Arial' })],
    })],
  });
}

function gapTableRow(feature, description, priority, effort, timeline, ri) {
  const colorMap = { 'Critical': C.red, 'High': C.orange, 'Medium': C.blue, 'Low': C.gray };
  const fill = colorMap[priority] || C.gray;
  const bg = ri % 2 === 0 ? C.white : C.lightGray;
  function tc(text, w) {
    return new TableCell({
      borders: cellBorder(),
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, size: 19, color: C.navy, font: 'Arial' })] })],
    });
  }
  return new TableRow({
    children: [
      tc(feature, 1900),
      tc(description, 2700),
      new TableCell({
        borders: cellBorder(),
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        width: { size: 900, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: priority, bold: true, size: 18, color: C.white, font: 'Arial' })] })],
      }),
      tc(effort, 1000),
      tc(timeline, 1660),
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ════════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 320 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1000, hanging: 320 } } } },
        ],
      },
      {
        reference: 'numbers',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 320 } } } },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22, color: C.navy } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: 'Arial', color: C.teal },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: C.navy },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: 'Arial', color: C.tealMid },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [
    // ══════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ══════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        spacer(1200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: 'SAFRE MANASIK', bold: true, size: 64, color: C.teal, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 0 },
          children: [new TextRun({ text: 'SaaS Transformation & Feature Roadmap', bold: true, size: 36, color: C.navy, font: 'Arial' })],
        }),
        spacer(60),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.teal, space: 4 } },
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: 'Umrah Travel Management Platform — Multi-Tenant Architecture Plan', size: 24, color: C.gray, font: 'Arial' })],
        }),
        spacer(600),
        infoBox([
          [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Document Details', bold: true, size: 26, color: C.teal, font: 'Arial' })] })],
          [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Version 1.0  |  May 2026  |  Confidential', size: 22, color: C.gray, font: 'Arial' })] })],
          [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Prepared for: Safre Manasik Travel Management Team', size: 22, color: C.navy, font: 'Arial' })] })],
        ]),
        spacer(800),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ══════════════════════════════════════════════════════════════════════
    // MAIN CONTENT
    // ══════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              spacing: { before: 0, after: 80 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.teal, space: 2 } },
              children: [
                new TextRun({ text: 'Safre Manasik  |  SaaS Transformation & Feature Roadmap', size: 18, color: C.gray, font: 'Arial' }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.medGray, space: 2 } },
              spacing: { before: 80, after: 0 },
              children: [
                new TextRun({ text: 'Confidential — Internal Document  |  ', size: 18, color: C.gray, font: 'Arial' }),
                new TextRun({ text: 'Page ', size: 18, color: C.gray, font: 'Arial' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.teal, font: 'Arial' }),
              ],
            }),
          ],
        }),
      },
      children: [

        // ── EXECUTIVE SUMMARY ───────────────────────────────────────────────
        h1('Executive Summary'),
        para('Safre Manasik is a fully operational, locally-hosted Umrah Travel Management System covering bookings, transport, catering, hotels, payments, invoices, and role-based user access. This document defines the architecture, strategy, and phased roadmap required to transform the application into a multi-tenant SaaS product competitive with platforms such as WETravel.'),
        spacer(60),
        infoBox([
          [new Paragraph({ children: [
            new TextRun({ text: 'Current Stack: ', bold: true, size: 22, color: C.navy, font: 'Arial' }),
            new TextRun({ text: 'Node.js + Express + Prisma ORM + PostgreSQL  |  React 18 + Material UI v5', size: 22, color: C.gray, font: 'Arial' }),
          ]})],
          [new Paragraph({ children: [
            new TextRun({ text: 'Target Model: ', bold: true, size: 22, color: C.navy, font: 'Arial' }),
            new TextRun({ text: 'Multi-tenant SaaS with tenant-isolated databases, CRM, reporting, and customer portal', size: 22, color: C.gray, font: 'Arial' }),
          ]})],
          [new Paragraph({ children: [
            new TextRun({ text: 'Timeline: ', bold: true, size: 22, color: C.navy, font: 'Arial' }),
            new TextRun({ text: 'Phase 1 — 8 weeks  |  Phase 2 — 10 weeks  |  Phase 3 — 12 weeks', size: 22, color: C.gray, font: 'Arial' }),
          ]})],
        ]),
        spacer(120),

        // ── SECTION 1 ────────────────────────────────────────────────────────
        h1('1. Multi-Tenancy Architecture Plan'),

        h2('1.1 Design Approach'),
        para('The recommended approach is a Hybrid Multi-Tenancy model — a single application instance with per-tenant PostgreSQL schemas (schema isolation). This balances operational simplicity with strong data segregation.'),
        spacer(80),
        dataTable(
          ['Model', 'Description', 'Pros', 'Cons', 'Recommendation'],
          [
            ['Shared Database', 'One schema, tenant_id on every row', 'Cheapest to operate', 'Risk of data leakage; complex queries', ''],
            ['Schema Isolation', 'Separate PostgreSQL schema per tenant', 'Strong isolation; easy backup per tenant', 'Schema migrations run N times', 'RECOMMENDED'],
            ['Database Isolation', 'Separate PostgreSQL database per tenant', 'Maximum isolation', 'High cost; complex pooling', 'Enterprise tier only'],
          ],
          [1500, 2200, 1700, 2000, 1760]
        ),
        spacer(120),

        h2('1.2 Schema Isolation Architecture'),
        para('Each tenant receives a dedicated PostgreSQL schema (e.g., tenant_abc). The public schema holds only the global tenants registry. Prisma\'s multi-schema preview flag enables schema-prefixed queries per request.'),
        spacer(80),
        codeBlock([
          '-- Global tenants registry (public schema)',
          'CREATE TABLE public.tenants (',
          '  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
          '  slug        VARCHAR(63) UNIQUE NOT NULL,   -- subdomain key',
          '  name        VARCHAR(255) NOT NULL,',
          '  plan        VARCHAR(50) DEFAULT \'starter\',',
          '  status      VARCHAR(20) DEFAULT \'active\',',
          '  db_schema   VARCHAR(63) NOT NULL,          -- e.g. "tenant_abc"',
          '  created_at  TIMESTAMPTZ DEFAULT NOW()',
          ');',
          '',
          '-- Per-tenant schema provisioning (Node.js migration runner)',
          'CREATE SCHEMA IF NOT EXISTS tenant_<slug>;',
          'SET search_path TO tenant_<slug>;',
          '-- Then run full Prisma migration for this schema',
        ]),
        spacer(100),

        h2('1.3 Request-Level Tenant Resolution'),
        para('Every API request resolves the tenant from the subdomain (e.g., alrashidi.safremanasik.com) and sets the PostgreSQL search_path before executing any query. A middleware handles this transparently.'),
        spacer(80),
        codeBlock([
          '// backend/src/middleware/tenant.js',
          'const tenantMiddleware = async (req, res, next) => {',
          '  const host = req.hostname;   // e.g. alrashidi.safremanasik.com',
          '  const slug = host.split(\'.\')[0];',
          '  const tenant = await getTenantBySlug(slug);   // cached in Redis',
          '  if (!tenant) return res.status(404).json({ error: \'Tenant not found\' });',
          '  req.tenantSchema = tenant.db_schema;',
          '  await prisma.$executeRaw`SET search_path TO ${tenant.db_schema}`;',
          '  next();',
          '};',
        ]),
        spacer(120),

        h2('1.4 Infrastructure & Cost Model'),
        para('The following estimates are based on a starter deployment on AWS (ap-southeast-1 or me-south-1 for Saudi Arabia proximity).'),
        spacer(80),
        dataTable(
          ['Component', 'Service', 'Starter (1-10 tenants)', 'Growth (10-50 tenants)', 'Scale (50+ tenants)'],
          [
            ['Database', 'AWS RDS PostgreSQL', '$50/mo (db.t3.medium)', '$150/mo (db.r6g.large)', '$400/mo (Multi-AZ)'],
            ['Backend API', 'AWS ECS / App Runner', '$30/mo (1 task)', '$80/mo (2 tasks)', '$200/mo (auto-scale)'],
            ['Frontend CDN', 'CloudFront + S3', '$5/mo', '$15/mo', '$40/mo'],
            ['Cache', 'ElastiCache Redis', '$20/mo', '$40/mo', '$80/mo'],
            ['Storage', 'S3 (PDFs, uploads)', '$5/mo', '$20/mo', '$60/mo'],
            ['TOTAL', '', '~$110/mo', '~$305/mo', '~$780/mo'],
          ],
          [1600, 1800, 1960, 1960, 1840]
        ),
        spacer(120),

        h2('1.5 Subdomain & DNS Strategy'),
        para('Each tenant receives a subdomain: {tenant-slug}.safremanasik.com. A wildcard SSL certificate (*.safremanasik.com via AWS ACM) covers all tenants. An Nginx reverse proxy or AWS ALB routes traffic to the single application cluster.'),

        infoBox([
          [new Paragraph({ children: [
            new TextRun({ text: 'Architecture Diagram (logical):', bold: true, size: 22, color: C.teal, font: 'Arial' }),
          ]})],
          [new Paragraph({ children: [new TextRun({ text: 'Tenant Request  -->  Wildcard DNS (*.safremanasik.com)', size: 20, color: C.navy, font: 'Courier New' })] })],
          [new Paragraph({ children: [new TextRun({ text: '                -->  AWS ALB  -->  ECS API Cluster', size: 20, color: C.navy, font: 'Courier New' })] })],
          [new Paragraph({ children: [new TextRun({ text: '                -->  TenantMiddleware (resolve schema from slug)', size: 20, color: C.navy, font: 'Courier New' })] })],
          [new Paragraph({ children: [new TextRun({ text: '                -->  PostgreSQL (search_path = tenant_<slug>)', size: 20, color: C.navy, font: 'Courier New' })] })],
          [new Paragraph({ children: [new TextRun({ text: '                -->  Redis Cache (per-tenant JWT + config)', size: 20, color: C.navy, font: 'Courier New' })] })],
        ]),
        spacer(120),

        // ── SECTION 2 ────────────────────────────────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1('2. Feature Gap Analysis'),
        para('The following features are present in WETravel but missing or incomplete in the current Safre Manasik application. Items are prioritised by business impact and estimated development effort.'),
        spacer(100),

        // Gap table header row
        new Table({
          width: { size: 8160, type: WidthType.DXA },
          columnWidths: [1900, 2700, 900, 1000, 1660],
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['Feature', 'Description', 'Priority', 'Effort', 'Timeline'].map((h, i) =>
                new TableCell({
                  borders: cellBorder(C.teal),
                  shading: { fill: C.teal, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  width: { size: [1900,2700,900,1000,1660][i], type: WidthType.DXA },
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: C.white, font: 'Arial' })] })],
                })
              ),
            }),
            gapTableRow('CRM & Lead Mgmt', 'Lead pipeline, follow-up automation, customer interaction history', 'Critical', '6 weeks', 'Phase 1', 0),
            gapTableRow('Customer Portal', 'Self-service portal: view booking, pay online, download voucher', 'Critical', '4 weeks', 'Phase 1', 1),
            gapTableRow('Itinerary Builder', 'Branded, shareable itinerary with maps, photos, daily schedule', 'High', '4 weeks', 'Phase 2', 2),
            gapTableRow('Multi-Currency', 'Accept SAR, USD, EUR; display local currency per customer', 'High', '2 weeks', 'Phase 2', 3),
            gapTableRow('Email Campaigns', 'Drip campaigns, booking reminders, promotional emails', 'High', '3 weeks', 'Phase 2', 4),
            gapTableRow('Online Payments', 'Stripe/Moyasar gateway; installment plans; refunds', 'Critical', '3 weeks', 'Phase 1', 5),
            gapTableRow('Advanced Analytics', 'Revenue by package/agent, conversion funnel, occupancy rate', 'High', '3 weeks', 'Phase 2', 6),
            gapTableRow('Activity Module', 'Excursions, Ziyarat tours, extras booking per passenger', 'Medium', '3 weeks', 'Phase 3', 7),
            gapTableRow('Supplier Network', 'Connect with verified hotels, transport, catering vendors', 'Medium', '6 weeks', 'Phase 3', 8),
            gapTableRow('Mobile App', 'React Native app for agents and travelers', 'Low', '12 weeks', 'Phase 4', 9),
            gapTableRow('AI Recommendations', 'AI-suggested packages, upsell prompts, churn alerts', 'Low', '8 weeks', 'Phase 4', 10),
            gapTableRow('Multi-language UI', 'Arabic (RTL), English, Urdu, Bahasa', 'Medium', '2 weeks', 'Phase 2', 11),
          ],
        }),
        spacer(80),
        para('Effort estimates assume a 2-person full-stack team (1 backend, 1 frontend). Critical items should be included in the Phase 1 MVP for SaaS launch readiness.', { italic: true, color: C.gray }),
        spacer(120),

        // ── SECTION 3 ────────────────────────────────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1('3. New Reporting Features — Detailed Specification'),

        // ── Report A ─────────────────────────────────────────────────────────
        h2('3.1 Report A — Daily Check-In / Check-Out & Transport Schedule'),

        h3('3.1.1 Business Purpose'),
        para('This report is the primary daily planning tool for ground operations staff. It consolidates all passenger arrivals, hotel check-ins, hotel check-outs, and assigned transport runs into a single chronological view for a given date. Dispatchers use it to allocate drivers; hotel liaisons use it to prepare rooms; agents use it to brief customers.'),
        spacer(80),

        h3('3.1.2 Data Inputs'),
        dataTable(
          ['Source Table', 'Fields Used', 'Join Condition'],
          [
            ['bookings', 'id, booking_ref, travel_start, travel_end, total_pax, status', 'Primary table'],
            ['passengers', 'full_name, passport_no, nationality, gender, phone', 'booking_id = bookings.id'],
            ['transport_bookings', 'transport_id, pickup_time, dropoff_time, route_from, route_to', 'booking_id = bookings.id'],
            ['vehicles', 'vehicle_type, plate_no, capacity, driver_name, driver_phone', 'id = transport_bookings.transport_id'],
            ['booking_hotels', 'hotel_id, check_in, check_out, room_type, nights', 'booking_id = bookings.id'],
            ['hotels', 'name, city, star_rating, address', 'id = booking_hotels.hotel_id'],
            ['users', 'name (agent)', 'agent_id = bookings.agent_id'],
          ],
          [2000, 3200, 3960]
        ),
        spacer(120),

        h3('3.1.3 Output Fields'),
        dataTable(
          ['Column', 'Source', 'Format'],
          [
            ['Date', 'Parameter', 'DD/MM/YYYY'],
            ['Event Type', 'Derived', 'CHECK-IN / CHECK-OUT / TRANSPORT PICKUP / TRANSPORT DROP-OFF'],
            ['Time', 'pickup_time or check_in / check_out', 'HH:MM (24hr)'],
            ['Booking Ref', 'bookings.booking_ref', 'SM-XXXXXX'],
            ['Passenger Names', 'passengers (aggregated)', 'Comma-separated or count'],
            ['Pax Count', 'bookings.total_pax', 'Integer'],
            ['Hotel', 'hotels.name + city', 'Text'],
            ['Vehicle / Driver', 'vehicles.plate_no + driver_name', 'Text'],
            ['Route', 'route_from → route_to', 'Text'],
            ['Agent', 'users.name', 'Text'],
            ['Status', 'bookings.status', 'CONFIRMED / TENTATIVE'],
          ],
          [2000, 3200, 3960]
        ),
        spacer(120),

        h3('3.1.4 Filters & Sorting'),
        bullet('Date (required): defaults to today; accepts any calendar date'),
        bullet('Event Type: CHECK-IN, CHECK-OUT, TRANSPORT, or ALL'),
        bullet('City: Makkah, Madinah, or ALL'),
        bullet('Vehicle Type: BUS, CAR, VIP, or ALL'),
        bullet('Agent: filter by responsible agent'),
        bullet('Status: CONFIRMED only (default), TENTATIVE, or ALL'),
        bullet('Sort by: Time ASC (default), Booking Ref, Hotel Name, Pax Count DESC'),
        spacer(120),

        h3('3.1.5 SQL Query'),
        codeBlock([
          '-- Report A: Daily Check-In/Check-Out & Transport Schedule',
          '-- Parameters: :report_date (DATE), :tenant_schema (TEXT)',
          '',
          'WITH check_events AS (',
          '  SELECT',
          '    bh.check_in::date          AS event_date,',
          '    \'CHECK-IN\'                 AS event_type,',
          '    bh.check_in::time          AS event_time,',
          '    b.booking_ref,',
          '    b.total_pax,',
          '    h.name                     AS hotel_name,',
          '    h.city,',
          '    NULL::text                 AS vehicle_plate,',
          '    NULL::text                 AS driver_name,',
          '    NULL::text                 AS route_from,',
          '    NULL::text                 AS route_to,',
          '    u.name                     AS agent_name,',
          '    b.status',
          '  FROM booking_hotels bh',
          '  JOIN bookings   b ON b.id = bh.booking_id',
          '  JOIN hotels     h ON h.id = bh.hotel_id',
          '  JOIN users      u ON u.id = b.agent_id',
          '  WHERE bh.check_in::date = :report_date',
          '    AND b.status IN (\'CONFIRMED\', \'TENTATIVE\')',
          '',
          '  UNION ALL',
          '',
          '  SELECT',
          '    bh.check_out::date, \'CHECK-OUT\', bh.check_out::time,',
          '    b.booking_ref, b.total_pax, h.name, h.city,',
          '    NULL, NULL, NULL, NULL, u.name, b.status',
          '  FROM booking_hotels bh',
          '  JOIN bookings b ON b.id = bh.booking_id',
          '  JOIN hotels   h ON h.id = bh.hotel_id',
          '  JOIN users    u ON u.id = b.agent_id',
          '  WHERE bh.check_out::date = :report_date',
          '    AND b.status IN (\'CONFIRMED\', \'TENTATIVE\')',
          '',
          '  UNION ALL',
          '',
          '  SELECT',
          '    tb.pickup_time::date, \'TRANSPORT\', tb.pickup_time::time,',
          '    b.booking_ref, b.total_pax, NULL, NULL,',
          '    v.plate_no, v.driver_name, tb.route_from, tb.route_to,',
          '    u.name, b.status',
          '  FROM transport_bookings tb',
          '  JOIN bookings b ON b.id = tb.booking_id',
          '  JOIN vehicles v ON v.id = tb.transport_id',
          '  JOIN users    u ON u.id = b.agent_id',
          '  WHERE tb.pickup_time::date = :report_date',
          '    AND b.status IN (\'CONFIRMED\', \'TENTATIVE\')',
          ')',
          'SELECT * FROM check_events',
          'ORDER BY event_time ASC, event_type ASC;',
          '',
          '-- Index recommendations:',
          '-- CREATE INDEX idx_booking_hotels_checkin  ON booking_hotels (check_in::date);',
          '-- CREATE INDEX idx_booking_hotels_checkout ON booking_hotels (check_out::date);',
          '-- CREATE INDEX idx_transport_pickup        ON transport_bookings (pickup_time::date);',
        ]),
        spacer(120),

        h3('3.1.6 Performance Considerations'),
        bullet('Add partial indexes on check_in::date and check_out::date (WHERE status != \'CANCELLED\') to avoid scanning historical cancelled bookings'),
        bullet('Cache the daily report in Redis with a 10-minute TTL; invalidate on any booking or transport update affecting that date'),
        bullet('For tenants with >500 daily movements, paginate at 100 rows and offer async CSV export via a background job queue'),
        spacer(120),

        // ── Report B ─────────────────────────────────────────────────────────
        h2('3.2 Report B — Transport Details by Date'),

        h3('3.2.1 Business Purpose'),
        para('This report gives the logistics team a vehicle-centric view of all transport runs on a given date or date range. It answers: which vehicles are running, what routes, with how many passengers, at what times, and who the driver is. Used for driver briefings, fleet utilisation analysis, and fuel/cost tracking.'),
        spacer(80),

        h3('3.2.2 Output Fields'),
        dataTable(
          ['Field', 'Description', 'Source'],
          [
            ['Run Date', 'Date of the transport run', 'pickup_time::date'],
            ['Vehicle Type', 'BUS / CAR / VIP', 'vehicles.vehicle_type'],
            ['Plate Number', 'Vehicle registration', 'vehicles.plate_no'],
            ['Capacity', 'Max passenger seats', 'vehicles.capacity'],
            ['Driver Name', 'Full name', 'vehicles.driver_name'],
            ['Driver Phone', 'Contact number', 'vehicles.driver_phone'],
            ['Route From', 'Departure location', 'transport_bookings.route_from'],
            ['Route To', 'Destination location', 'transport_bookings.route_to'],
            ['Departure Time', 'Scheduled pickup', 'transport_bookings.pickup_time'],
            ['Arrival Time', 'Expected dropoff', 'transport_bookings.dropoff_time'],
            ['Passenger Count', 'Total pax on this run', 'SUM(bookings.total_pax)'],
            ['Occupancy %', 'passenger_count / capacity * 100', 'Derived'],
            ['Booking Refs', 'All booking refs on this run', 'STRING_AGG'],
            ['Status', 'CONFIRMED / TENTATIVE / MIXED', 'Derived'],
          ],
          [2200, 3000, 3960]
        ),
        spacer(120),

        h3('3.2.3 SQL Query'),
        codeBlock([
          '-- Report B: Transport Details by Date (or Date Range)',
          '-- Parameters: :start_date (DATE), :end_date (DATE)',
          '',
          'SELECT',
          '  tb.pickup_time::date                                  AS run_date,',
          '  v.vehicle_type,',
          '  v.plate_no,',
          '  v.capacity,',
          '  v.driver_name,',
          '  v.driver_phone,',
          '  tb.route_from,',
          '  tb.route_to,',
          '  tb.pickup_time::time                                  AS departure_time,',
          '  tb.dropoff_time::time                                 AS arrival_time,',
          '  SUM(b.total_pax)                                      AS passenger_count,',
          '  ROUND(SUM(b.total_pax)::numeric / v.capacity * 100, 1) AS occupancy_pct,',
          '  STRING_AGG(b.booking_ref, \', \' ORDER BY b.booking_ref) AS booking_refs,',
          '  CASE',
          '    WHEN COUNT(*) FILTER (WHERE b.status = \'CONFIRMED\') = COUNT(*) THEN \'CONFIRMED\'',
          '    WHEN COUNT(*) FILTER (WHERE b.status = \'TENTATIVE\') = COUNT(*) THEN \'TENTATIVE\'',
          '    ELSE \'MIXED\'',
          '  END                                                   AS run_status',
          'FROM transport_bookings tb',
          'JOIN vehicles v ON v.id = tb.transport_id',
          'JOIN bookings b ON b.id = tb.booking_id',
          'WHERE tb.pickup_time::date BETWEEN :start_date AND :end_date',
          '  AND b.status != \'CANCELLED\'',
          'GROUP BY',
          '  run_date, v.id, v.vehicle_type, v.plate_no, v.capacity,',
          '  v.driver_name, v.driver_phone,',
          '  tb.route_from, tb.route_to, tb.pickup_time, tb.dropoff_time',
          'ORDER BY run_date ASC, departure_time ASC, v.vehicle_type ASC;',
          '',
          '-- Optional: fleet utilisation summary',
          'SELECT',
          '  vehicle_type,',
          '  COUNT(*)                        AS total_runs,',
          '  ROUND(AVG(occupancy_pct), 1)    AS avg_occupancy_pct,',
          '  SUM(passenger_count)            AS total_passengers',
          'FROM (...above query...) AS runs',
          'GROUP BY vehicle_type;',
        ]),
        spacer(120),

        h3('3.2.4 Date Parameter Functionality'),
        bullet('Single date mode: start_date = end_date = selected date (default: today)'),
        bullet('Date range mode: custom start/end via calendar pickers; max 31-day range for performance'),
        bullet('Quick filters: Today, Tomorrow, This Week, Next Week, Custom Range'),
        bullet('Export: CSV and PDF (Puppeteer HTML template, same pattern as existing voucher service)'),
        spacer(80),

        h3('3.2.5 Performance Considerations'),
        bullet('Composite index: CREATE INDEX idx_transport_vehicle_date ON transport_bookings (transport_id, pickup_time::date)'),
        bullet('Materialised view for fleet utilisation summary, refreshed nightly via pg_cron'),
        bullet('For date ranges > 7 days, run query asynchronously and notify user when export is ready'),
        spacer(120),

        // ── SECTION 4 ────────────────────────────────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1('4. Testing & Quality Assurance Strategy'),

        h2('4.1 Unit Testing'),
        bullet('Framework: Jest (already in Node.js ecosystem)'),
        bullet('Coverage target: 80% for all new service files (reportService.js, tenantService.js, crmService.js)'),
        bullet('Test report query functions with mocked Prisma client using jest-mock-extended'),
        bullet('Test tenant middleware: correct schema resolution, 404 on unknown slug, Redis cache hit/miss'),
        bullet('Test date parameter validation: invalid dates, future dates, range > 31 days'),
        spacer(80),

        h2('4.2 Integration Testing'),
        bullet('Use a dedicated test PostgreSQL instance with two test tenant schemas (tenant_test_a, tenant_test_b)'),
        bullet('Verify data isolation: records written in tenant_test_a are NOT visible in tenant_test_b'),
        bullet('Test full booking-to-report pipeline: create booking + transport → run Report A → assert record appears'),
        bullet('Test Report B date range: seed 5 days of transport data, query 3-day range, assert correct row count'),
        bullet('Framework: Supertest (HTTP integration tests against live Express server)'),
        spacer(80),

        h2('4.3 Performance Testing'),
        dataTable(
          ['Metric', 'Target Threshold', 'Test Tool'],
          [
            ['Report A query (50 daily movements)', '< 200ms p95', 'k6 or Artillery'],
            ['Report B query (7-day range, 20 vehicles)', '< 500ms p95', 'k6'],
            ['API response time (general endpoints)', '< 300ms p95', 'k6'],
            ['Concurrent tenants', '50 simultaneous, no cross-contamination', 'k6 multi-VU'],
            ['Database connection pool exhaustion', 'Graceful queue, no 500 errors', 'pgbouncer stress test'],
          ],
          [3000, 2800, 3360]
        ),
        spacer(120),

        h2('4.4 Production Readiness Checklist'),
        numbered('Tenant onboarding script tested end-to-end: schema creation, seed admin user, JWT secret per tenant'),
        numbered('Environment variables migrated to AWS Secrets Manager (no .env files in production)'),
        numbered('Database connection pooling configured (PgBouncer, max 10 connections per tenant)'),
        numbered('Redis cache deployed with eviction policy allkeys-lru'),
        numbered('Wildcard SSL certificate issued and auto-renewed via AWS ACM'),
        numbered('OWASP Top 10 audit completed (SQLi, XSS, broken access control, insecure JWT)'),
        numbered('Rate limiting applied: 100 req/min per tenant IP, 10 req/min on auth endpoints'),
        numbered('Automated nightly PostgreSQL backups to S3 (per-schema pg_dump)'),
        numbered('Error monitoring configured (Sentry or AWS CloudWatch Alarms)'),
        numbered('Load test completed at 2× expected peak traffic before launch'),
        spacer(120),

        // ── SECTION 5 ────────────────────────────────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1('5. Implementation Roadmap'),

        h2('5.1 Phase 1 — SaaS MVP (Weeks 1–8)'),
        infoBox([
          [new Paragraph({ children: [
            new TextRun({ text: 'Goal: ', bold: true, size: 22, color: C.teal, font: 'Arial' }),
            new TextRun({ text: 'A working multi-tenant version of the existing application, plus Report A and online payment foundation', size: 22, color: C.navy, font: 'Arial' }),
          ]})],
        ]),
        spacer(80),
        dataTable(
          ['Week', 'Task', 'Owner', 'Deliverable'],
          [
            ['1–2', 'Multi-tenancy middleware + schema provisioning', 'Backend', 'Tenant resolver, schema migration runner, test isolation'],
            ['2–3', 'Tenant admin portal (signup, billing, config)', 'Full-stack', 'New tenant onboards via web form'],
            ['3–4', 'JWT scoped to tenant; role-based access refactor', 'Backend', 'Tokens carry tenant_id; no cross-tenant access possible'],
            ['4–5', 'Report A — backend query + REST endpoint', 'Backend', 'GET /api/reports/daily-schedule?date=YYYY-MM-DD'],
            ['5–6', 'Report A — frontend page (filter UI + table)', 'Frontend', 'Daily Schedule page in React with export buttons'],
            ['6–7', 'Online payment gateway integration (Moyasar)', 'Backend', 'Payment links, webhook handlers, receipt generation'],
            ['7–8', 'QA, security audit, staging deployment', 'Both', 'All Phase 1 tests passing; staging URL live'],
          ],
          [800, 3400, 1200, 3760]
        ),
        spacer(120),

        h2('5.2 Phase 2 — Growth Features (Weeks 9–18)'),
        infoBox([
          [new Paragraph({ children: [
            new TextRun({ text: 'Goal: ', bold: true, size: 22, color: C.teal, font: 'Arial' }),
            new TextRun({ text: 'Report B, CRM basics, itinerary builder, multi-currency, and analytics dashboard', size: 22, color: C.navy, font: 'Arial' }),
          ]})],
        ]),
        spacer(80),
        dataTable(
          ['Week', 'Task', 'Owner', 'Deliverable'],
          [
            ['9–10', 'Report B — transport fleet report with date range', 'Backend + Frontend', 'Fleet report page with CSV/PDF export'],
            ['10–12', 'CRM module: lead capture, pipeline, follow-ups', 'Full-stack', 'Leads list, status board, activity log'],
            ['12–14', 'Customer self-service portal (read + pay)', 'Full-stack', 'Customers log in, view booking, make payments'],
            ['14–15', 'Multi-currency display (SAR base, show in USD/EUR)', 'Backend', 'Currency config per tenant; FX rate API integration'],
            ['15–16', 'Itinerary builder (day-by-day, PDF export)', 'Full-stack', 'Itinerary creation page; branded PDF output'],
            ['16–17', 'Advanced analytics dashboard', 'Full-stack', 'Revenue charts, occupancy heatmap, agent KPIs'],
            ['17–18', 'Multi-language support (Arabic RTL + English)', 'Frontend', 'i18n with react-i18next; RTL layout toggle'],
          ],
          [800, 3400, 1800, 3160]
        ),
        spacer(120),

        h2('5.3 Phase 3 — Expansion (Weeks 19–30)'),
        infoBox([
          [new Paragraph({ children: [
            new TextRun({ text: 'Goal: ', bold: true, size: 22, color: C.teal, font: 'Arial' }),
            new TextRun({ text: 'Activity module, supplier network, email marketing, and enterprise billing tiers', size: 22, color: C.navy, font: 'Arial' }),
          ]})],
        ]),
        spacer(80),
        bullet('Weeks 19–21: Activity / Ziyarat excursion module — book and assign activities per passenger'),
        bullet('Weeks 22–24: Supplier directory — vetted hotels, transport companies, caterers with direct booking'),
        bullet('Weeks 24–26: Email marketing — drip campaigns, booking confirmations, reminder automation'),
        bullet('Weeks 27–28: Billing & subscription — Stripe subscription plans (Starter / Pro / Enterprise)'),
        bullet('Weeks 29–30: Performance optimisation, SOC2-readiness review, enterprise pilot launch'),
        spacer(120),

        // ── SECTION 6 ────────────────────────────────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1('6. Technical Debt & Risk Mitigation'),

        h2('6.1 Migration Risks'),
        dataTable(
          ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
          [
            ['Data leakage between tenants', 'Low', 'Critical', 'Schema isolation + automated cross-tenant query test in CI pipeline'],
            ['Schema migration downtime', 'Medium', 'High', 'Run migrations per-tenant in background worker; zero-downtime with expand-contract pattern'],
            ['JWT token cross-tenant replay', 'Low', 'High', 'Include tenant_id in JWT payload; validate on every request in middleware'],
            ['PostgreSQL search_path injection', 'Low', 'Critical', 'Whitelist slugs against [a-z0-9_] regex; never interpolate raw user input into search_path'],
            ['Single DB becoming a bottleneck', 'Medium', 'Medium', 'PgBouncer pooling + read replica for report queries after 30 tenants'],
            ['Frontend bundle size growth', 'Medium', 'Low', 'Code-split by module (React.lazy); target <200KB initial bundle per tenant'],
            ['Existing demo data conflicts', 'High', 'Low', 'Migrate existing local data into a dedicated tenant schema (tenant_demo)'],
          ],
          [2200, 1100, 1000, 4860]
        ),
        spacer(120),

        h2('6.2 Backward Compatibility'),
        bullet('All existing API routes remain functional under the tenant middleware — no breaking changes'),
        bullet('The existing .env DATABASE_URL becomes the default schema; a migration script wraps it as tenant_default'),
        bullet('Frontend routes are unchanged; the tenant subdomain is resolved before reaching the React app'),
        bullet('Existing bookings, packages, and users are migrated to tenant_default during Phase 1 cutover'),
        spacer(80),

        h2('6.3 Data Migration Strategy'),
        numbered('Run pg_dump on the current single-schema database to capture all existing data'),
        numbered('Create schema tenant_default in the new multi-tenant PostgreSQL instance'),
        numbered('Restore dump into tenant_default using pg_restore with --schema flag'),
        numbered('Register tenant_default in the public.tenants table (slug = "demo" or client name)'),
        numbered('Verify all existing reports, bookings, and users are accessible via the new subdomain'),
        numbered('Keep original single-tenant instance running in read-only mode for 30 days as rollback option'),
        spacer(80),

        h2('6.4 Current Technical Debt to Address'),
        bullet('server.js (line 60): Single Express listen without graceful shutdown — add process.on(SIGTERM) handler before SaaS launch'),
        bullet('seed.js: Hardcoded to Makkah/Madinah — refactor to accept city as parameter for multi-destination support'),
        bullet('voucherService.js: Chromium dependency via Puppeteer — add HTML fallback already coded, but standardise on it for serverless environments'),
        bullet('No request validation middleware (express-validator or Zod) — add at all /api/auth and booking mutation routes to prevent injection'),
        bullet('JWT secret is a static string in .env — rotate to per-tenant secrets stored in AWS Secrets Manager'),
        spacer(120),

        divider(),
        spacer(60),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({ text: 'Safre Manasik SaaS Roadmap  |  Version 1.0  |  May 2026', size: 20, color: C.gray, font: 'Arial', italics: true }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: 'This document is confidential and intended solely for the Safre Manasik development and management team.', size: 18, color: C.medGray, font: 'Arial' }),
          ],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('Safre_Manasik_SaaS_Roadmap.docx', buffer);
  console.log('SUCCESS: Safre_Manasik_SaaS_Roadmap.docx written (' + (buffer.length / 1024).toFixed(0) + ' KB)');
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
