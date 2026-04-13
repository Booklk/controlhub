/**
 * Export Service - Professional Excel/PDF Export
 * Control Hub - JCSA
 * نادي سباقات الخيل — نظام مركز التحكم
 */

import ExcelJS from 'exceljs';

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  title?: string;
  subtitle?: string;
  rtl?: boolean;
  dateFormat?: string;
  department?: string;
  summaryStats?: { label: string; value: string | number }[];
}

// ── Color palette ──────────────────────────────────────────────────────────────
const C = {
  NAVY:       'FF1A3A6B',  // #1a3a6b
  NAVY_DARK:  'FF0F2248',  // #0f2248
  NAVY_MID:   'FF254A8F',  // lighter navy for alternating header
  GOLD:       'FFC9A227',  // #c9a227
  GOLD_PALE:  'FFFFF8E8',  // pale gold for alt rows
  GOLD_LIGHT: 'FFFFF3CC',  // light gold stats row
  WHITE:      'FFFFFFFF',
  GRAY_50:    'FFF8FAFC',
  GRAY_100:   'FFF1F5F9',
  GRAY_200:   'FFE2E8F0',
  GRAY_500:   'FF64748B',
  GRAY_700:   'FF334155',
  TEXT_DARK:  'FF0F172A',
  TEXT_MUTED: 'FF94A3B8',
  // Status colors (background ARGB)
  STATUS_GREEN:  'FFDCFCE7',
  STATUS_BLUE:   'FFDBEAFE',
  STATUS_YELLOW: 'FFFEF9C3',
  STATUS_RED:    'FFFEE2E2',
  STATUS_GRAY:   'FFF1F5F9',
  STATUS_ORANGE: 'FFFFF7ED',
};

const FONT_NAME = 'Arial';

function statusFill(val: string): { bg: string; fg: string } | null {
  const v = String(val || '').toLowerCase();
  if (['مفتوح', 'open', 'نشط', 'active', 'نشطة', 'مفتوحة', 'معتمد', 'approved'].includes(v))
    return { bg: C.STATUS_GREEN, fg: 'FF15803D' };
  if (['قيد التنفيذ', 'in_progress', 'جاري', 'جارية', 'تحت التنفيذ'].includes(v))
    return { bg: C.STATUS_BLUE, fg: 'FF1D4ED8' };
  if (['تم الحل', 'resolved', 'مكتمل', 'completed', 'مكتملة'].includes(v))
    return { bg: C.STATUS_GREEN, fg: 'FF166534' };
  if (['معلق', 'pending', 'بانتظار', 'معلقة'].includes(v))
    return { bg: C.STATUS_YELLOW, fg: 'FF854D0E' };
  if (['مغلق', 'closed', 'archived', 'مغلقة'].includes(v))
    return { bg: C.STATUS_GRAY, fg: 'FF475569' };
  if (['حرج', 'critical', 'مرتفع', 'high', 'حرجة', 'عالية', 'عالي'].includes(v))
    return { bg: C.STATUS_RED, fg: 'FF991B1B' };
  if (['متوسط', 'medium', 'متوسطة'].includes(v))
    return { bg: C.STATUS_ORANGE, fg: 'FF9A3412' };
  if (['منخفض', 'low', 'منخفضة'].includes(v))
    return { bg: C.STATUS_GREEN, fg: 'FF15803D' };
  if (['مرفوض', 'rejected'].includes(v))
    return { bg: C.STATUS_RED, fg: 'FF991B1B' };
  return null;
}

function isStatusKey(key: string): boolean {
  return ['status', 'priority', 'severity', 'level', 'state', 'criticality',
    'statusar', 'priorityar', 'statusarabic'].some(k => key.toLowerCase() === k);
}

// ── Core export function ───────────────────────────────────────────────────────
export async function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions = {}
): Promise<Buffer> {
  const { title = 'تقرير', subtitle, rtl = true, department, summaryStats } = options;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Control Hub — JCSA';
  workbook.created = now;
  workbook.modified = now;
  workbook.company = 'نادي سباقات الخيل';
  workbook.subject = title;

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 1 — SUMMARY (ملخص التقرير)
  // ════════════════════════════════════════════════════════════════════════════
  const sumSheet = workbook.addWorksheet('ملخص التقرير', {
    views: [{ rightToLeft: rtl }],
    properties: { defaultColWidth: 20 },
  });

  sumSheet.columns = [
    { key: 'A', width: 35 },
    { key: 'B', width: 12 },
    { key: 'C', width: 40 },
  ];

  let r = 1;

  // Row 1: org banner
  sumSheet.mergeCells(r, 1, r, 3);
  const orgCell = sumSheet.getCell(r, 1);
  orgCell.value = 'نادي سباقات الخيل — JCSA Control Hub';
  orgCell.font = { name: FONT_NAME, size: 18, bold: true, color: { argb: C.WHITE } };
  orgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_DARK } };
  orgCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  sumSheet.getRow(r).height = 42;
  r++;

  // Row 2: gold accent strip
  sumSheet.mergeCells(r, 1, r, 3);
  const goldStrip = sumSheet.getCell(r, 1);
  goldStrip.value = `إدارة تقنية المعلومات${department ? ' — ' + department : ''}`;
  goldStrip.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: C.NAVY_DARK } };
  goldStrip.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GOLD } };
  goldStrip.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  sumSheet.getRow(r).height = 22;
  r++;

  // Row 3: blank
  sumSheet.getRow(r).height = 10;
  r++;

  // Row 4: report title
  sumSheet.mergeCells(r, 1, r, 3);
  const titleCell = sumSheet.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { name: FONT_NAME, size: 22, bold: true, color: { argb: C.NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  sumSheet.getRow(r).height = 36;
  r++;

  if (subtitle) {
    sumSheet.mergeCells(r, 1, r, 3);
    const subCell = sumSheet.getCell(r, 1);
    subCell.value = subtitle;
    subCell.font = { name: FONT_NAME, size: 12, color: { argb: C.GRAY_500 } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
    sumSheet.getRow(r).height = 22;
    r++;
  }

  r++; // blank

  // Metadata block
  const metaRows = [
    ['رقم التقرير', '', reportId],
    ['تاريخ الإصدار', '', dateStr],
    ['وقت الإصدار', '', timeStr],
    ['إجمالي السجلات', '', data.length],
    ['عدد الحقول', '', columns.length],
    ['الجهة المصدِرة', '', 'إدارة تقنية المعلومات — نادي سباقات الخيل'],
    ['درجة السرية', '', 'سري — للاستخدام الداخلي فقط'],
  ];

  // Metadata header
  sumSheet.mergeCells(r, 1, r, 3);
  const metaHdr = sumSheet.getCell(r, 1);
  metaHdr.value = 'معلومات التقرير';
  metaHdr.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: C.WHITE } };
  metaHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY } };
  metaHdr.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl' };
  sumSheet.getRow(r).height = 26;
  r++;

  metaRows.forEach(([label, , value], i) => {
    const row = sumSheet.getRow(r);
    row.height = 22;
    const labelCell = sumSheet.getCell(r, 1);
    labelCell.value = label;
    labelCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: C.NAVY } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? C.GOLD_PALE : C.WHITE } };
    labelCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl' };
    labelCell.border = { bottom: { style: 'thin', color: { argb: C.GRAY_200 } } };

    const valCell = sumSheet.getCell(r, 3);
    valCell.value = value;
    valCell.font = { name: FONT_NAME, size: 11, color: { argb: C.TEXT_DARK } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? C.GOLD_PALE : C.WHITE } };
    valCell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
    valCell.border = { bottom: { style: 'thin', color: { argb: C.GRAY_200 } } };
    r++;
  });

  r++;

  // Summary stats (if provided)
  if (summaryStats && summaryStats.length > 0) {
    sumSheet.mergeCells(r, 1, r, 3);
    const statsHdr = sumSheet.getCell(r, 1);
    statsHdr.value = 'الإحصاءات التفصيلية';
    statsHdr.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: C.WHITE } };
    statsHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY } };
    statsHdr.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, readingOrder: 'rtl' };
    sumSheet.getRow(r).height = 26;
    r++;

    summaryStats.forEach((s, i) => {
      const statRow = sumSheet.getRow(r);
      statRow.height = 22;
      const lbl = sumSheet.getCell(r, 1);
      lbl.value = s.label;
      lbl.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: C.NAVY } };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? C.GOLD_PALE : C.WHITE } };
      lbl.alignment = { horizontal: 'right', indent: 1, readingOrder: 'rtl' };
      lbl.border = { bottom: { style: 'thin', color: { argb: C.GRAY_200 } } };

      const val = sumSheet.getCell(r, 3);
      val.value = s.value;
      val.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: C.GOLD.replace('FF', '') === C.GOLD ? C.NAVY : C.NAVY } };
      val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? C.GOLD_PALE : C.WHITE } };
      val.alignment = { horizontal: 'right', readingOrder: 'rtl' };
      val.border = { bottom: { style: 'thin', color: { argb: C.GRAY_200 } } };
      r++;
    });

    r++;
  }

  // Footer note
  sumSheet.mergeCells(r, 1, r, 3);
  const noteCell = sumSheet.getCell(r, 1);
  noteCell.value = `⚠ هذا التقرير سري ومخصص للاستخدام الداخلي فقط — نادي سباقات الخيل © ${now.getFullYear()}`;
  noteCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: C.GRAY_500 } };
  noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GRAY_100 } };
  noteCell.alignment = { horizontal: 'center', readingOrder: 'rtl' };
  sumSheet.getRow(r).height = 24;

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 2 — DATA (البيانات)
  // ════════════════════════════════════════════════════════════════════════════
  const dataSheet = workbook.addWorksheet('البيانات', {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 5 }],
    properties: { defaultColWidth: 16 },
  });

  // Set column definitions
  dataSheet.columns = columns.map(col => ({
    key: col.key,
    width: col.width || 16,
  }));

  // Row D1: org header
  dataSheet.mergeCells(1, 1, 1, columns.length);
  const dOrg = dataSheet.getCell(1, 1);
  dOrg.value = 'نادي سباقات الخيل — JCSA Control Hub';
  dOrg.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: C.WHITE } };
  dOrg.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_DARK } };
  dOrg.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  dataSheet.getRow(1).height = 32;

  // Row D2: gold title bar
  dataSheet.mergeCells(2, 1, 2, columns.length);
  const dTitle = dataSheet.getCell(2, 1);
  dTitle.value = title;
  dTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: C.NAVY_DARK } };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GOLD } };
  dTitle.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  dataSheet.getRow(2).height = 26;

  // Row D3: subtitle / meta info
  dataSheet.mergeCells(3, 1, 3, columns.length);
  const dMeta = dataSheet.getCell(3, 1);
  dMeta.value = `${dateStr}  |  ${reportId}  |  إجمالي: ${data.length} سجل${subtitle ? '  |  ' + subtitle : ''}`;
  dMeta.font = { name: FONT_NAME, size: 10, color: { argb: C.GRAY_500 } };
  dMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GRAY_100 } };
  dMeta.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  dataSheet.getRow(3).height = 20;

  // Row D4: blank separator
  dataSheet.mergeCells(4, 1, 4, columns.length);
  dataSheet.getCell(4, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY } };
  dataSheet.getRow(4).height = 3;

  const HEADER_ROW = 5;

  // Row D5: column headers
  const headerRow = dataSheet.getRow(HEADER_ROW);
  headerRow.height = 30;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: C.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl', wrapText: false };
    cell.border = {
      top: { style: 'medium', color: { argb: C.GOLD } },
      bottom: { style: 'medium', color: { argb: C.GOLD } },
      left: { style: 'thin', color: { argb: C.NAVY_MID } },
      right: { style: 'thin', color: { argb: C.NAVY_MID } },
    };
  });

  // Enable auto-filter on header row
  dataSheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length },
  };

  // Data rows
  data.forEach((item, rowIndex) => {
    const dataRow = dataSheet.getRow(HEADER_ROW + 1 + rowIndex);
    dataRow.height = 22;
    const isEven = rowIndex % 2 === 0;

    columns.forEach((col, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      let value = item[col.key];

      // Format values
      if (value === null || value === undefined) {
        value = '—';
      } else if (typeof value === 'boolean') {
        value = value ? 'نعم' : 'لا';
      } else if (value instanceof Date) {
        value = value.toLocaleDateString('ar-SA');
      } else if (typeof value === 'number' && String(col.key).toLowerCase().includes('budget')) {
        value = value.toLocaleString('ar-SA') + ' ر.س';
      }

      cell.value = value;
      cell.font = { name: FONT_NAME, size: 10.5, color: { argb: C.TEXT_DARK } };
      cell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl', wrapText: false };

      // Status cell coloring
      const sf = isStatusKey(col.key) && value !== '—' ? statusFill(String(value)) : null;
      if (sf) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sf.bg } };
        cell.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: sf.fg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
      } else {
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: isEven ? C.WHITE : C.GOLD_PALE },
        };
      }

      cell.border = {
        top: { style: 'hair', color: { argb: C.GRAY_200 } },
        bottom: { style: 'hair', color: { argb: C.GRAY_200 } },
        left: { style: 'hair', color: { argb: C.GRAY_200 } },
        right: { style: 'hair', color: { argb: C.GRAY_200 } },
      };
    });
  });

  // If no data: add a placeholder
  if (data.length === 0) {
    const emptyRow = dataSheet.getRow(HEADER_ROW + 1);
    dataSheet.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, columns.length);
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = 'لا توجد بيانات لعرضها في هذا التقرير';
    emptyCell.font = { name: FONT_NAME, size: 12, italic: true, color: { argb: C.GRAY_500 } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
    emptyRow.height = 50;
  }

  // Summary row at bottom
  if (data.length > 0) {
    const lastDataRow = HEADER_ROW + data.length;
    const sumRow = dataSheet.getRow(lastDataRow + 2);
    sumRow.height = 22;
    dataSheet.mergeCells(lastDataRow + 2, 1, lastDataRow + 2, columns.length);
    const sumCell = sumRow.getCell(1);
    sumCell.value = `إجمالي السجلات: ${data.length}  |  ${reportId}  |  تم الإصدار: ${dateStr}`;
    sumCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: C.NAVY } };
    sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GOLD_LIGHT } };
    sumCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
    sumCell.border = {
      top: { style: 'medium', color: { argb: C.NAVY } },
      bottom: { style: 'medium', color: { argb: C.NAVY } },
    };
  }

  // Auto-fit columns (cap at 50)
  dataSheet.columns.forEach((column: Partial<ExcelJS.Column>) => {
    if (column.eachCell) {
      let maxLength = 8;
      column.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell) => {
        const v = cell.value?.toString() || '';
        if (v.length > maxLength) maxLength = v.length;
      });
      column.width = Math.min(maxLength + 3, 50);
    }
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ── Individual export helpers (unchanged API) ──────────────────────────────────

export async function exportAuditLogs(logs: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'التاريخ',   key: 'createdAt',  width: 22 },
    { header: 'المستخدم', key: 'userName',    width: 26 },
    { header: 'الإجراء',  key: 'action',      width: 22 },
    { header: 'الكيان',   key: 'entityType',  width: 22 },
    { header: 'التفاصيل', key: 'details',     width: 45 },
    { header: 'عنوان IP', key: 'ipAddress',   width: 16 },
  ];
  return exportToExcel(logs, columns, {
    title: 'سجل التدقيق والأنشطة',
    subtitle: `إجمالي ${logs.length} سجل تدقيق`,
    rtl: true,
    department: 'الإدارة العليا',
    summaryStats: [
      { label: 'إجمالي السجلات', value: logs.length },
    ],
  });
}

export async function exportUsers(users: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'الاسم الكامل',      key: 'name',           width: 28 },
    { header: 'البريد الإلكتروني', key: 'email',          width: 32 },
    { header: 'الدور',             key: 'role',           width: 22 },
    { header: 'البوابة',           key: 'portal',         width: 18 },
    { header: 'القسم',             key: 'departmentName', width: 22 },
    { header: 'الحالة',            key: 'statusAr',       width: 14 },
    { header: 'تاريخ الإنشاء',    key: 'createdAt',      width: 20 },
  ];
  const active = users.filter(u => u.isActive).length;
  const formatted = users.map(u => ({ ...u, statusAr: u.isActive ? 'نشط' : 'غير نشط' }));
  return exportToExcel(formatted, columns, {
    title: 'قائمة المستخدمين',
    subtitle: `إجمالي ${users.length} مستخدم`,
    rtl: true,
    department: 'إدارة النظام',
    summaryStats: [
      { label: 'إجمالي المستخدمين', value: users.length },
      { label: 'المستخدمون النشطون', value: active },
      { label: 'غير النشطين', value: users.length - active },
    ],
  });
}

export async function exportTickets(tickets: any[]): Promise<Buffer> {
  const priorityLabels: Record<string, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة', urgent: 'عاجلة' };
  const statusLabels: Record<string, string> = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', pending: 'معلقة', resolved: 'محلولة', closed: 'مغلقة' };
  const columns: ExportColumn[] = [
    { header: 'رقم التذكرة',    key: 'id',             width: 14 },
    { header: 'العنوان',        key: 'title',          width: 38 },
    { header: 'الأولوية',       key: 'priorityAr',     width: 14 },
    { header: 'الحالة',         key: 'statusAr',       width: 16 },
    { header: 'القسم',          key: 'departmentName', width: 22 },
    { header: 'المسؤول',        key: 'assigneeName',   width: 22 },
    { header: 'تاريخ الإنشاء', key: 'createdAt',      width: 20 },
  ];
  const formatted = tickets.map(t => ({
    ...t,
    priorityAr: priorityLabels[t.priority] || t.priority,
    statusAr:   statusLabels[t.status]    || t.status,
  }));
  const open = tickets.filter(t => t.status === 'open').length;
  const inProg = tickets.filter(t => t.status === 'in_progress').length;
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
  return exportToExcel(formatted, columns, {
    title: 'تقرير تذاكر الدعم الفني',
    subtitle: `إجمالي ${tickets.length} تذكرة`,
    rtl: true,
    department: 'الدعم الفني',
    summaryStats: [
      { label: 'إجمالي التذاكر',   value: tickets.length },
      { label: 'مفتوحة',          value: open },
      { label: 'قيد التنفيذ',     value: inProg },
      { label: 'تم الحل/مغلقة',   value: resolved },
    ],
  });
}

export async function exportProjects(projects: any[]): Promise<Buffer> {
  const statusLabels: Record<string, string> = {
    planning: 'التخطيط', in_progress: 'قيد التنفيذ', on_hold: 'معلق', completed: 'مكتمل', cancelled: 'ملغي',
  };
  const columns: ExportColumn[] = [
    { header: 'اسم المشروع',    key: 'name',           width: 32 },
    { header: 'الحالة',         key: 'statusAr',       width: 16 },
    { header: 'القسم',          key: 'departmentName', width: 22 },
    { header: 'المدير',         key: 'managerName',    width: 22 },
    { header: 'تاريخ البدء',   key: 'startDate',      width: 16 },
    { header: 'تاريخ الانتهاء', key: 'endDate',        width: 16 },
    { header: 'الميزانية',      key: 'budgetFmt',      width: 18 },
  ];
  const formatted = projects.map(p => ({
    ...p,
    statusAr:  statusLabels[p.status] || p.status,
    budgetFmt: p.budget ? `${Number(p.budget).toLocaleString('ar-SA')} ر.س` : '—',
  }));
  const active = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  return exportToExcel(formatted, columns, {
    title: 'تقرير المشاريع',
    subtitle: `إجمالي ${projects.length} مشروع`,
    rtl: true,
    department: 'إدارة المشاريع',
    summaryStats: [
      { label: 'إجمالي المشاريع',  value: projects.length },
      { label: 'قيد التنفيذ',     value: active },
      { label: 'مكتملة',          value: completed },
    ],
  });
}

export async function exportTasks(tasks: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',             key: 'id',           width: 10 },
    { header: 'العنوان',        key: 'title',        width: 36 },
    { header: 'الحالة',         key: 'status',       width: 16 },
    { header: 'الأولوية',       key: 'priority',     width: 14 },
    { header: 'البوابة',        key: 'portal',       width: 16 },
    { header: 'المسؤول',        key: 'assigneeName', width: 22 },
    { header: 'تاريخ الإنشاء', key: 'createdAt',    width: 20 },
  ];
  return exportToExcel(tasks, columns, {
    title: 'تقرير المهام',
    subtitle: `إجمالي ${tasks.length} مهمة`,
    rtl: true,
    summaryStats: [{ label: 'إجمالي المهام', value: tasks.length }],
  });
}

export async function exportKPIs(kpis: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'المؤشر',           key: 'name',           width: 32 },
    { header: 'القيمة الحالية',   key: 'currentValue',   width: 16 },
    { header: 'القيمة المستهدفة', key: 'targetValue',    width: 18 },
    { header: 'الوحدة',           key: 'unit',           width: 12 },
    { header: 'القسم',            key: 'departmentName', width: 22 },
    { header: 'الحالة',           key: 'status',         width: 16 },
  ];
  return exportToExcel(kpis, columns, {
    title: 'تقرير مؤشرات الأداء',
    subtitle: `إجمالي ${kpis.length} مؤشر`,
    rtl: true,
    summaryStats: [{ label: 'إجمالي المؤشرات', value: kpis.length }],
  });
}

export async function exportSecurityIncidents(incidents: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',      key: 'id',        width: 10 },
    { header: 'العنوان',  key: 'title',     width: 32 },
    { header: 'النوع',    key: 'type',      width: 16 },
    { header: 'الخطورة',  key: 'severity',  width: 14 },
    { header: 'الحالة',   key: 'status',    width: 16 },
    { header: 'التاريخ',  key: 'createdAt', width: 20 },
  ];
  const critical = incidents.filter(i => i.severity === 'critical').length;
  return exportToExcel(incidents, columns, {
    title: 'تقرير البلاغات الأمنية',
    subtitle: `إجمالي ${incidents.length} بلاغ`,
    rtl: true,
    department: 'الأمن السيبراني',
    summaryStats: [
      { label: 'إجمالي البلاغات', value: incidents.length },
      { label: 'البلاغات الحرجة', value: critical },
    ],
  });
}

export async function exportVulnerabilities(vulns: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',             key: 'id',             width: 10 },
    { header: 'العنوان',        key: 'title',          width: 32 },
    { header: 'الخطورة',        key: 'severity',       width: 14 },
    { header: 'الحالة',         key: 'status',         width: 16 },
    { header: 'النظام المتأثر', key: 'affectedSystem', width: 22 },
    { header: 'التاريخ',        key: 'createdAt',      width: 20 },
  ];
  return exportToExcel(vulns, columns, {
    title: 'تقرير الثغرات الأمنية',
    subtitle: `إجمالي ${vulns.length} ثغرة`,
    rtl: true,
    department: 'الأمن السيبراني',
    summaryStats: [{ label: 'إجمالي الثغرات', value: vulns.length }],
  });
}

export async function exportThreats(threats: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',     key: 'id',        width: 10 },
    { header: 'العنوان', key: 'title',     width: 32 },
    { header: 'النوع',   key: 'type',      width: 16 },
    { header: 'الخطورة', key: 'severity',  width: 14 },
    { header: 'الحالة',  key: 'status',    width: 16 },
    { header: 'المصدر',  key: 'source',    width: 22 },
    { header: 'التاريخ', key: 'createdAt', width: 20 },
  ];
  return exportToExcel(threats, columns, {
    title: 'تقرير التهديدات الأمنية',
    subtitle: `إجمالي ${threats.length} تهديد`,
    rtl: true,
    department: 'الأمن السيبراني',
    summaryStats: [{ label: 'إجمالي التهديدات', value: threats.length }],
  });
}

export async function exportServers(servers: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'اسم الخادم',    key: 'name',      width: 26 },
    { header: 'نظام التشغيل', key: 'os',        width: 22 },
    { header: 'عنوان IP',     key: 'ipAddress', width: 18 },
    { header: 'الحالة',       key: 'status',    width: 16 },
    { header: 'المعالج',      key: 'cpu',       width: 16 },
    { header: 'الذاكرة',      key: 'ram',       width: 14 },
    { header: 'التخزين',      key: 'storage',   width: 14 },
  ];
  const active = servers.filter(s => s.status === 'active').length;
  return exportToExcel(servers, columns, {
    title: 'تقرير الخوادم',
    subtitle: `إجمالي ${servers.length} خادم`,
    rtl: true,
    department: 'البنية التحتية',
    summaryStats: [
      { label: 'إجمالي الخوادم',  value: servers.length },
      { label: 'الخوادم النشطة',  value: active },
    ],
  });
}

export async function exportNetworks(networks: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'اسم الشبكة', key: 'name',     width: 26 },
    { header: 'النوع',      key: 'type',     width: 16 },
    { header: 'النطاق',     key: 'subnet',   width: 22 },
    { header: 'الحالة',     key: 'status',   width: 16 },
    { header: 'الموقع',     key: 'location', width: 22 },
  ];
  return exportToExcel(networks, columns, {
    title: 'تقرير الشبكات',
    subtitle: `إجمالي ${networks.length} شبكة`,
    rtl: true,
    department: 'البنية التحتية',
    summaryStats: [{ label: 'إجمالي الشبكات', value: networks.length }],
  });
}

export async function exportStorage(storageItems: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'الاسم',    key: 'name',     width: 26 },
    { header: 'النوع',    key: 'type',     width: 16 },
    { header: 'السعة',    key: 'capacity', width: 16 },
    { header: 'المستخدم', key: 'used',     width: 16 },
    { header: 'الحالة',   key: 'status',   width: 16 },
  ];
  return exportToExcel(storageItems, columns, {
    title: 'تقرير التخزين',
    subtitle: `إجمالي ${storageItems.length} وحدة تخزين`,
    rtl: true,
    department: 'البنية التحتية',
    summaryStats: [{ label: 'إجمالي وحدات التخزين', value: storageItems.length }],
  });
}

export async function exportITAssets(assets: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',            key: 'id',             width: 10 },
    { header: 'الاسم',          key: 'name',           width: 28 },
    { header: 'النوع',          key: 'type',           width: 16 },
    { header: 'الموقع',         key: 'location',       width: 22 },
    { header: 'الحالة',         key: 'status',         width: 16 },
    { header: 'القسم',          key: 'departmentName', width: 22 },
    { header: 'تاريخ الشراء',   key: 'purchaseDate',   width: 16 },
  ];
  const active = assets.filter(a => a.status === 'active').length;
  return exportToExcel(assets, columns, {
    title: 'تقرير أصول تقنية المعلومات',
    subtitle: `إجمالي ${assets.length} أصل`,
    rtl: true,
    department: 'إدارة الأصول',
    summaryStats: [
      { label: 'إجمالي الأصول',  value: assets.length },
      { label: 'الأصول النشطة',  value: active },
    ],
  });
}

export async function exportDataAssets(assets: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',      key: 'id',             width: 10 },
    { header: 'الاسم',    key: 'name',           width: 32 },
    { header: 'التصنيف',  key: 'classification', width: 16 },
    { header: 'المالك',   key: 'ownerName',      width: 22 },
    { header: 'القسم',    key: 'department',     width: 22 },
    { header: 'الحالة',   key: 'status',         width: 16 },
  ];
  return exportToExcel(assets, columns, {
    title: 'تقرير الأصول البيانية',
    subtitle: `إجمالي ${assets.length} أصل بياني`,
    rtl: true,
    department: 'حوكمة البيانات',
    summaryStats: [{ label: 'إجمالي الأصول البيانية', value: assets.length }],
  });
}

export async function exportDataDictionary(terms: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'المصطلح',  key: 'term',       width: 26 },
    { header: 'التعريف',  key: 'definition', width: 45 },
    { header: 'النوع',    key: 'dataType',   width: 16 },
    { header: 'المصدر',   key: 'source',     width: 22 },
    { header: 'المسؤول',  key: 'owner',      width: 22 },
  ];
  return exportToExcel(terms, columns, {
    title: 'تقرير قاموس البيانات',
    subtitle: `إجمالي ${terms.length} مصطلح`,
    rtl: true,
    department: 'حوكمة البيانات',
    summaryStats: [{ label: 'إجمالي المصطلحات', value: terms.length }],
  });
}

export async function exportDataRisks(risks: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',          key: 'id',         width: 10 },
    { header: 'العنوان',      key: 'title',      width: 32 },
    { header: 'المستوى',      key: 'level',      width: 14 },
    { header: 'الاحتمالية',   key: 'likelihood', width: 14 },
    { header: 'التأثير',      key: 'impact',     width: 14 },
    { header: 'خطة التخفيف',  key: 'mitigation', width: 32 },
    { header: 'الحالة',       key: 'status',     width: 16 },
  ];
  const high = risks.filter(r => ['high', 'critical'].includes(r.level)).length;
  return exportToExcel(risks, columns, {
    title: 'تقرير سجل المخاطر',
    subtitle: `إجمالي ${risks.length} مخاطرة`,
    rtl: true,
    department: 'حوكمة البيانات',
    summaryStats: [
      { label: 'إجمالي المخاطر',      value: risks.length },
      { label: 'المخاطر العالية/الحرجة', value: high },
    ],
  });
}

export async function exportDataAgreements(agreements: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',           key: 'id',           width: 10 },
    { header: 'العنوان',       key: 'title',        width: 32 },
    { header: 'الجهة',         key: 'organization', width: 26 },
    { header: 'النوع',         key: 'type',         width: 16 },
    { header: 'الحالة',        key: 'status',       width: 16 },
    { header: 'تاريخ البدء',   key: 'startDate',    width: 16 },
    { header: 'تاريخ الانتهاء', key: 'endDate',      width: 16 },
  ];
  return exportToExcel(agreements, columns, {
    title: 'تقرير اتفاقيات مشاركة البيانات',
    subtitle: `إجمالي ${agreements.length} اتفاقية`,
    rtl: true,
    department: 'حوكمة البيانات',
    summaryStats: [{ label: 'إجمالي الاتفاقيات', value: agreements.length }],
  });
}

export async function exportDataStewards(stewards: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',    key: 'id',         width: 10 },
    { header: 'الاسم',  key: 'name',       width: 26 },
    { header: 'الدور',  key: 'role',       width: 22 },
    { header: 'القسم',  key: 'department', width: 22 },
    { header: 'البريد', key: 'email',      width: 28 },
    { header: 'الحالة', key: 'status',     width: 16 },
  ];
  return exportToExcel(stewards, columns, {
    title: 'تقرير ممثلي البيانات',
    subtitle: `إجمالي ${stewards.length} ممثل بيانات`,
    rtl: true,
    department: 'حوكمة البيانات',
    summaryStats: [{ label: 'إجمالي الممثلين', value: stewards.length }],
  });
}

export async function exportDigitalInitiatives(initiatives: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',       key: 'id',        width: 10 },
    { header: 'الاسم',     key: 'name',      width: 32 },
    { header: 'الحالة',    key: 'status',    width: 16 },
    { header: 'التقدم %',  key: 'progress',  width: 14 },
    { header: 'المسؤول',   key: 'ownerName', width: 22 },
    { header: 'تاريخ البدء', key: 'startDate', width: 16 },
  ];
  const completed = initiatives.filter(i => i.status === 'completed').length;
  return exportToExcel(initiatives, columns, {
    title: 'تقرير مبادرات التحول الرقمي',
    subtitle: `إجمالي ${initiatives.length} مبادرة`,
    rtl: true,
    department: 'التحول الرقمي',
    summaryStats: [
      { label: 'إجمالي المبادرات', value: initiatives.length },
      { label: 'المكتملة',         value: completed },
    ],
  });
}

export async function exportDigitalApplications(apps: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',       key: 'id',       width: 10 },
    { header: 'الاسم',     key: 'name',     width: 26 },
    { header: 'المنصة',    key: 'platform', width: 16 },
    { header: 'المورد',    key: 'vendor',   width: 22 },
    { header: 'الحالة',    key: 'status',   width: 16 },
    { header: 'التكلفة',   key: 'cost',     width: 16 },
  ];
  return exportToExcel(apps, columns, {
    title: 'تقرير التطبيقات الرقمية',
    subtitle: `إجمالي ${apps.length} تطبيق`,
    rtl: true,
    department: 'التحول الرقمي',
    summaryStats: [{ label: 'إجمالي التطبيقات', value: apps.length }],
  });
}

export async function exportCloudServices(services: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',              key: 'id',          width: 10 },
    { header: 'الاسم',            key: 'name',        width: 26 },
    { header: 'المزود',           key: 'provider',    width: 22 },
    { header: 'النوع',            key: 'type',        width: 16 },
    { header: 'التكلفة الشهرية', key: 'monthlyCost', width: 20 },
    { header: 'الحالة',           key: 'status',      width: 16 },
  ];
  return exportToExcel(services, columns, {
    title: 'تقرير الخدمات السحابية',
    subtitle: `إجمالي ${services.length} خدمة سحابية`,
    rtl: true,
    department: 'التحول الرقمي',
    summaryStats: [{ label: 'إجمالي الخدمات السحابية', value: services.length }],
  });
}

export async function exportCommitteeDecisions(decisions: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',           key: 'id',           width: 10 },
    { header: 'العنوان',       key: 'title',        width: 32 },
    { header: 'الأولوية',      key: 'priority',     width: 14 },
    { header: 'الحالة',        key: 'status',       width: 16 },
    { header: 'أصوات مع',      key: 'votesFor',     width: 14 },
    { header: 'أصوات ضد',      key: 'votesAgainst', width: 14 },
    { header: 'التاريخ',       key: 'createdAt',    width: 20 },
  ];
  const approved = decisions.filter(d => d.status === 'approved').length;
  return exportToExcel(decisions, columns, {
    title: 'تقرير قرارات اللجان',
    subtitle: `إجمالي ${decisions.length} قرار`,
    rtl: true,
    department: 'إدارة اللجان',
    summaryStats: [
      { label: 'إجمالي القرارات',   value: decisions.length },
      { label: 'القرارات المعتمدة', value: approved },
    ],
  });
}

export async function exportCommitteeMeetings(meetings: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',     key: 'id',       width: 10 },
    { header: 'العنوان', key: 'title',    width: 32 },
    { header: 'التاريخ', key: 'date',     width: 16 },
    { header: 'الوقت',   key: 'time',     width: 14 },
    { header: 'الموقع',  key: 'location', width: 22 },
    { header: 'الحالة',  key: 'status',   width: 16 },
  ];
  return exportToExcel(meetings, columns, {
    title: 'تقرير اجتماعات اللجان',
    subtitle: `إجمالي ${meetings.length} اجتماع`,
    rtl: true,
    department: 'إدارة اللجان',
    summaryStats: [{ label: 'إجمالي الاجتماعات', value: meetings.length }],
  });
}

export async function exportEscalations(escalations: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',      key: 'id',        width: 10 },
    { header: 'العنوان',  key: 'title',     width: 32 },
    { header: 'السبب',    key: 'reason',    width: 28 },
    { header: 'الأولوية', key: 'priority',  width: 14 },
    { header: 'الحالة',   key: 'status',    width: 16 },
    { header: 'التاريخ',  key: 'createdAt', width: 20 },
  ];
  return exportToExcel(escalations, columns, {
    title: 'تقرير التصعيدات',
    subtitle: `إجمالي ${escalations.length} تصعيد`,
    rtl: true,
    department: 'الدعم الفني',
    summaryStats: [{ label: 'إجمالي التصعيدات', value: escalations.length }],
  });
}

export async function exportVendors(vendorsList: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',      key: 'id',     width: 10 },
    { header: 'الاسم',    key: 'name',   width: 26 },
    { header: 'النوع',    key: 'type',   width: 16 },
    { header: 'التقييم',  key: 'rating', width: 14 },
    { header: 'البريد',   key: 'email',  width: 28 },
    { header: 'الهاتف',   key: 'phone',  width: 18 },
    { header: 'الحالة',   key: 'status', width: 16 },
  ];
  return exportToExcel(vendorsList, columns, {
    title: 'تقرير الموردين',
    subtitle: `إجمالي ${vendorsList.length} مورد`,
    rtl: true,
    department: 'إدارة الموردين',
    summaryStats: [{ label: 'إجمالي الموردين', value: vendorsList.length }],
  });
}

export async function exportSLA(slaList: any[]): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'رقم',              key: 'id',      width: 10 },
    { header: 'الاسم',            key: 'name',    width: 32 },
    { header: 'الخدمة',           key: 'service', width: 22 },
    { header: 'القيمة المستهدفة', key: 'target',  width: 20 },
    { header: 'القيمة الفعلية',   key: 'actual',  width: 18 },
    { header: 'الحالة',           key: 'status',  width: 16 },
  ];
  const compliant = slaList.filter(s => s.status === 'compliant').length;
  return exportToExcel(slaList, columns, {
    title: 'تقرير اتفاقيات مستوى الخدمة (SLA)',
    subtitle: `إجمالي ${slaList.length} اتفاقية`,
    rtl: true,
    department: 'جودة الخدمة',
    summaryStats: [
      { label: 'إجمالي الاتفاقيات', value: slaList.length },
      { label: 'الملتزمة',          value: compliant },
    ],
  });
}

export async function exportComplianceReport(data: any): Promise<Buffer> {
  const columns: ExportColumn[] = [
    { header: 'المجال',              key: 'domainName',        width: 32 },
    { header: 'إجمالي المتطلبات',   key: 'totalRequirements', width: 20 },
    { header: 'مكتمل',              key: 'completed',         width: 14 },
    { header: 'قيد التنفيذ',        key: 'inProgress',        width: 14 },
    { header: 'غير مكتمل',          key: 'notStarted',        width: 14 },
    { header: 'نسبة الامتثال %',    key: 'complianceRateFmt', width: 18 },
  ];
  const formatted = (data.domains || []).map((d: any) => ({
    ...d,
    complianceRateFmt: `${d.complianceRate}%`,
  }));
  return exportToExcel(formatted, columns, {
    title: 'تقرير الامتثال التنظيمي',
    subtitle: `نسبة الامتثال الإجمالية: ${data.overallCompliance}%`,
    rtl: true,
    department: 'الامتثال والحوكمة',
    summaryStats: [
      { label: 'نسبة الامتثال الإجمالية', value: `${data.overallCompliance}%` },
      { label: 'إجمالي المجالات',          value: formatted.length },
    ],
  });
}

export async function exportReferrals(referrals: any[]): Promise<Buffer> {
  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', accepted: 'مقبولة', in_progress: 'قيد التنفيذ',
    completed: 'مكتملة', rejected: 'مرفوضة', escalated: 'متصعّدة',
  };
  const priorityLabels: Record<string, string> = {
    low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة', critical: 'حرجة',
  };
  const formatted = referrals.map(r => ({
    ...r,
    status: statusLabels[r.status] || r.status,
    priority: priorityLabels[r.priority] || r.priority,
    slaHours: r.slaHours ? `${r.slaHours} ساعة` : '-',
  }));
  const columns: ExportColumn[] = [
    { header: 'رقم الإحالة',       key: 'referralNumber',   width: 18 },
    { header: 'العنوان',            key: 'title',            width: 36 },
    { header: 'الأولوية',           key: 'priority',         width: 14 },
    { header: 'الحالة',             key: 'status',           width: 16 },
    { header: 'SLA المعالجة',       key: 'slaHours',         width: 16 },
    { header: 'الإدارة المُرسِلة',  key: 'fromDepartmentId', width: 20 },
    { header: 'الإدارة المستقبِلة', key: 'toDepartmentId',   width: 20 },
    { header: 'تاريخ الإنشاء',      key: 'createdAt',        width: 22 },
  ];
  const pending   = referrals.filter(r => r.status === 'pending').length;
  const completed = referrals.filter(r => r.status === 'completed').length;
  const escalated = referrals.filter(r => r.status === 'escalated').length;
  return exportToExcel(formatted, columns, {
    title: 'تقرير الإحالات البينية',
    subtitle: `إجمالي ${referrals.length} إحالة`,
    rtl: true,
    department: 'مدير تقنية المعلومات',
    summaryStats: [
      { label: 'إجمالي الإحالات',    value: referrals.length },
      { label: 'قيد الانتظار',       value: pending },
      { label: 'مكتملة',             value: completed },
      { label: 'متصعّدة',            value: escalated },
    ],
  });
}
