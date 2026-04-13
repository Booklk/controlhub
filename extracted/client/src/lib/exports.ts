declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  filename: string;
  orientation?: 'portrait' | 'landscape';
  summaryStats?: { label: string; value: string | number }[];
  department?: string;
}

const NAVY = '#1a3a6b';
const NAVY_DARK = '#0f2248';
const GOLD = '#c9a227';
const GOLD_LIGHT = '#f5e6b2';
const GOLD_PALE = '#fffdf0';

// ─── Status badge helpers ──────────────────────────────────────────────────────
function getStatusStyle(val: string): { bg: string; color: string; text: string } {
  const v = String(val).toLowerCase();
  if (['مفتوح', 'open', 'نشط', 'active'].includes(v))
    return { bg: '#dcfce7', color: '#15803d', text: val };
  if (['قيد التنفيذ', 'in_progress', 'جاري'].includes(v))
    return { bg: '#dbeafe', color: '#1d4ed8', text: val };
  if (['تم الحل', 'resolved', 'مكتمل', 'completed'].includes(v))
    return { bg: '#f0fdf4', color: '#166534', text: val };
  if (['مغلق', 'closed', 'archived'].includes(v))
    return { bg: '#f1f5f9', color: '#475569', text: val };
  if (['معلق', 'pending', 'بانتظار'].includes(v))
    return { bg: '#fef9c3', color: '#854d0e', text: val };
  if (['حرج', 'critical', 'مرتفع', 'high'].includes(v))
    return { bg: '#fee2e2', color: '#991b1b', text: val };
  if (['متوسط', 'medium'].includes(v))
    return { bg: '#fff7ed', color: '#9a3412', text: val };
  if (['منخفض', 'low'].includes(v))
    return { bg: '#f0fdf4', color: '#15803d', text: val };
  if (['معتمد', 'approved'].includes(v))
    return { bg: '#dcfce7', color: '#166534', text: val };
  return { bg: 'transparent', color: '#0f172a', text: val };
}

function isBadgeColumn(key: string): boolean {
  return ['status', 'priority', 'state', 'criticality', 'حالة', 'الحالة', 'الأولوية'].some(k =>
    key.toLowerCase().includes(k.toLowerCase())
  );
}

export async function exportToPDF(options: ExportOptions): Promise<void> {
  const { title, subtitle, columns, data, filename, orientation = 'portrait', summaryStats, department } = options;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  const tableRows = data.map((row, idx) => {
    const cells = columns.map(col => {
      const value = row[col.key];
      let display = '—';
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'boolean') display = value ? '✓ نعم' : '✗ لا';
        else if (value instanceof Date) display = value.toLocaleDateString('ar-SA');
        else display = String(value);
      }
      const badge = isBadgeColumn(col.key) && display !== '—';
      const style = badge ? getStatusStyle(display) : null;
      return `<td class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">${
        badge && style
          ? `<span class="badge-cell" style="background:${style.bg};color:${style.color}">${display}</span>`
          : display
      }</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  // Build summary stats cards
  const statsHtml = summaryStats && summaryStats.length > 0
    ? `<div class="stats-row">${summaryStats.map(s =>
        `<div class="stat-box">
          <div class="stat-val">${s.value}</div>
          <div class="stat-lbl">${s.label}</div>
        </div>`
      ).join('')}</div>`
    : `<div class="stats-row">
        <div class="stat-box">
          <div class="stat-val">${data.length}</div>
          <div class="stat-lbl">إجمالي السجلات</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${columns.length}</div>
          <div class="stat-lbl">عدد الحقول</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${dateStr}</div>
          <div class="stat-lbl">تاريخ الإصدار</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${reportId}</div>
          <div class="stat-lbl">رقم التقرير</div>
        </div>
      </div>`;

  const fontBase = window.location.origin + '/fonts/cairo';
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title} — Control Hub JCSA</title>
<style>
  /* Self-hosted Cairo font — no Google Fonts dependency */
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 800;
    font-display: block;
    src: url('${fontBase}/cairo-arabic.woff2') format('woff2');
    unicode-range: U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC;
  }
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 800;
    font-display: block;
    src: url('${fontBase}/cairo-latin-ext.woff2') format('woff2');
    unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF;
  }
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 800;
    font-display: block;
    src: url('${fontBase}/cairo-latin.woff2') format('woff2');
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+FEFF,U+FFFD;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Cairo','Segoe UI',Arial,sans-serif;
    direction:rtl;background:#f8fafc;color:#0f172a;
    font-size:12px;line-height:1.6;
  }

  /* ── Cover banner ── */
  .cover{
    background:linear-gradient(135deg,${NAVY_DARK} 0%,${NAVY} 60%,#254a8f 100%);
    color:#fff;padding:32px 36px 28px;position:relative;overflow:hidden;
    page-break-inside:avoid;
  }
  .cover::before{
    content:'';position:absolute;top:-40px;left:-40px;
    width:200px;height:200px;border-radius:50%;
    background:rgba(201,162,39,0.12);pointer-events:none;
  }
  .cover::after{
    content:'';position:absolute;bottom:-30px;right:60px;
    width:140px;height:140px;border-radius:50%;
    background:rgba(255,255,255,0.05);pointer-events:none;
  }
  .cover-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
  .org-brand{display:flex;align-items:center;gap:12px}
  .org-logo{
    width:48px;height:48px;border-radius:12px;
    background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.2);
    display:flex;align-items:center;justify-content:center;
    font-size:22px;font-weight:800;color:${GOLD};letter-spacing:-1px;
  }
  .org-name{font-size:13px;font-weight:700;color:#fff;opacity:0.95}
  .org-sub{font-size:10px;color:rgba(255,255,255,0.6);margin-top:1px}
  .report-meta{text-align:left;font-size:10px;color:rgba(255,255,255,0.65)}
  .report-meta strong{display:block;color:${GOLD};font-size:11px;margin-bottom:2px}
  .cover-title{position:relative;z-index:1}
  .report-label{
    display:inline-block;background:${GOLD};color:${NAVY_DARK};
    font-size:9px;font-weight:700;padding:3px 10px;border-radius:3px;
    letter-spacing:0.5px;margin-bottom:10px;text-transform:uppercase;
  }
  .cover-title h1{font-size:26px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:6px}
  .cover-title p{font-size:13px;color:rgba(255,255,255,0.7);font-weight:400}
  .gold-line{height:3px;background:linear-gradient(90deg,${GOLD},transparent);border-radius:2px;margin-top:22px}

  /* ── Stats ── */
  .stats-row{
    display:flex;gap:0;background:#fff;
    border-bottom:3px solid ${GOLD};
    page-break-inside:avoid;
  }
  .stat-box{
    flex:1;padding:16px 18px;border-left:1px solid #e2e8f0;text-align:center;
  }
  .stat-box:last-child{border-left:none}
  .stat-val{font-size:18px;font-weight:800;color:${NAVY};line-height:1}
  .stat-lbl{font-size:10px;color:#64748b;margin-top:4px;font-weight:500}

  /* ── Section ── */
  .section{padding:20px 28px}
  .section-header{
    display:flex;align-items:center;gap:10px;margin-bottom:14px;
    border-bottom:1.5px solid #e2e8f0;padding-bottom:10px;
  }
  .section-dot{width:4px;height:20px;background:${GOLD};border-radius:2px;flex-shrink:0}
  .section-title{font-size:14px;font-weight:700;color:${NAVY}}
  .record-count{
    margin-right:auto;background:${NAVY};color:#fff;
    font-size:9px;font-weight:600;padding:2px 10px;border-radius:99px;
  }

  /* ── Table ── */
  table{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
  thead tr{background:${NAVY}}
  thead th{
    padding:11px 14px;text-align:right;font-weight:600;color:#fff;
    border-left:1px solid rgba(255,255,255,0.1);font-size:11px;
    white-space:nowrap;
  }
  thead th:first-child{border-radius:0 8px 0 0}
  thead th:last-child{border-radius:8px 0 0 0;border-left:none}
  .row-even{background:#fff}
  .row-odd{background:#f8fafc}
  tbody td{
    padding:10px 14px;text-align:right;
    border-bottom:1px solid #f1f5f9;
    border-left:1px solid #f1f5f9;
    vertical-align:middle;word-break:break-word;max-width:220px;
    transition:background 0.1s;
  }
  tbody td:last-child{border-left:none}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:hover td{background:#fffcf0 !important}
  .badge-cell{
    display:inline-block;padding:3px 10px;border-radius:99px;
    font-size:10px;font-weight:600;white-space:nowrap;
  }
  .no-data{
    text-align:center;padding:60px 20px;color:#94a3b8;
    font-size:14px;
  }
  .no-data-icon{font-size:40px;margin-bottom:12px}

  /* ── Footer ── */
  .footer{
    margin:0 28px;border-top:1.5px solid #e2e8f0;
    padding:12px 0;display:flex;justify-content:space-between;align-items:center;
    color:#94a3b8;font-size:10px;
  }
  .footer-brand{display:flex;align-items:center;gap:6px}
  .footer-dot{width:5px;height:5px;border-radius:50%;background:${GOLD};display:inline-block}
  .confidential-tag{
    background:#fee2e2;color:#991b1b;font-size:9px;
    padding:2px 8px;border-radius:3px;font-weight:600;
  }

  /* ── Print buttons ── */
  .print-actions{
    padding:20px 28px;display:flex;justify-content:center;gap:12px;
    page-break-inside:avoid;
  }
  .btn-print{
    background:${NAVY};color:#fff;border:none;
    padding:12px 32px;font-family:Cairo,Arial,sans-serif;
    font-size:13px;font-weight:600;border-radius:8px;
    cursor:pointer;display:flex;align-items:center;gap:8px;
  }
  .btn-close{
    background:#fff;color:${NAVY};border:1.5px solid #e2e8f0;
    padding:12px 32px;font-family:Cairo,Arial,sans-serif;
    font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;
  }

  @media print{
    body{background:#fff}
    .print-actions{display:none!important}
    @page{
      size:${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin:10mm 12mm;
    }
    table{page-break-inside:auto}
    tr{page-break-inside:avoid;page-break-after:auto}
    thead{display:table-header-group}
    .cover{page-break-after:avoid}
  }
</style>
</head>
<body>

  <!-- Cover / Header -->
  <div class="cover">
    <div class="cover-top">
      <div class="org-brand">
        <div class="org-logo">JC</div>
        <div>
          <div class="org-name">نادي سباقات الخيل — JCSA</div>
          <div class="org-sub">إدارة تقنية المعلومات والتحول الرقمي${department ? ' — ' + department : ''}</div>
        </div>
      </div>
      <div class="report-meta">
        <strong>${dateStr}</strong>
        ${timeStr} &nbsp;|&nbsp; ${reportId}
      </div>
    </div>
    <div class="cover-title">
      <div class="report-label">تقرير رسمي &nbsp;·&nbsp; Control Hub</div>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    <div class="gold-line"></div>
  </div>

  <!-- Summary Stats -->
  ${statsHtml}

  <!-- Table Section -->
  <div class="section">
    <div class="section-header">
      <div class="section-dot"></div>
      <span class="section-title">تفاصيل البيانات</span>
      <span class="record-count">${data.length} سجل</span>
    </div>

    ${data.length === 0
      ? `<div class="no-data">
           <div class="no-data-icon">📋</div>
           <div>لا توجد بيانات لعرضها في هذا التقرير</div>
         </div>`
      : `<table>
          <thead>
            <tr>${columns.map(col => `<th>${col.header}</th>`).join('')}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>`
    }
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">
      <span class="footer-dot"></span>
      نادي سباقات الخيل — نظام مركز التحكم
      &nbsp;|&nbsp; ${reportId}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="confidential-tag">سري ومقيّد</span>
      <span>${dateStr}</span>
    </div>
  </div>

  <!-- Print Actions (hidden when printing) -->
  <div class="print-actions no-print" id="print-actions">
    <button class="btn-print" id="btn-print" onclick="doPrint()" disabled style="opacity:0.6;cursor:wait">
      ⏳ جاري تحميل الخط...
    </button>
    <button class="btn-close" onclick="window.close()">إغلاق</button>
  </div>

<script>
  // Wait for Cairo font to fully load before enabling print
  document.fonts.ready.then(function() {
    var btn = document.getElementById('btn-print');
    if (btn) {
      btn.removeAttribute('disabled');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = '🖨️ طباعة / تصدير PDF';
    }
    // Auto-print after fonts ready + brief delay
    setTimeout(function() { try { window.print(); } catch(e) {} }, 600);
  });
  function doPrint() {
    document.fonts.ready.then(function() { window.print(); });
  }
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(blobUrl, '_blank', 'width=1050,height=820,scrollbars=yes');
  if (!printWindow) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
    return;
  }
  printWindow.focus();
  // Cleanup blob URL after window is done (fonts already handled inside the window)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
}

// ─── Excel Export ──────────────────────────────────────────────────────────────
export async function exportToExcel(options: ExportOptions): Promise<void> {
  const XLSX = await import('xlsx');
  const { title, subtitle, columns, data, filename, summaryStats } = options;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────────
  const summaryData: any[][] = [
    ['نادي سباقات الخيل — JCSA Control Hub'],
    [''],
    [title],
    [subtitle || ''],
    [''],
    ['معلومات التقرير', '', 'القيمة'],
    ['رقم التقرير', '', reportId],
    ['تاريخ الإصدار', '', dateStr],
    ['إجمالي السجلات', '', data.length],
    ['عدد الحقول', '', columns.length],
    [''],
  ];

  if (summaryStats && summaryStats.length > 0) {
    summaryData.push(['الإحصاءات', '', '']);
    summaryStats.forEach(s => {
      summaryData.push([s.label, '', s.value]);
    });
    summaryData.push(['']);
  }

  summaryData.push(['ملاحظة: هذا التقرير سري ومخصص للاستخدام الداخلي فقط']);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 5 }, { wch: 40 }];
  summaryWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
  ];

  // ── Sheet 2: Data ─────────────────────────────────────────────────────────────
  const headerRow = columns.map(col => col.header);

  const dataRows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined || value === '') return '—';
      if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
      if (value instanceof Date) return value.toLocaleDateString('ar-SA');
      return value;
    })
  );

  // Info rows at top of data sheet
  const dataSheetRows: any[][] = [
    [title, ...Array(columns.length - 1).fill('')],
    [`تاريخ: ${dateStr} | رقم التقرير: ${reportId}`, ...Array(columns.length - 1).fill('')],
    Array(columns.length).fill(''),
    headerRow,
    ...dataRows,
    Array(columns.length).fill(''),
    [`إجمالي: ${data.length} سجل`, ...Array(columns.length - 1).fill('')],
  ];

  const dataWs = XLSX.utils.aoa_to_sheet(dataSheetRows);

  // Column widths: auto based on column definitions
  dataWs['!cols'] = columns.map(col => ({
    wch: col.width ? Math.round(col.width / 3.5) : 18,
  }));

  // Merge title row
  dataWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    { s: { r: columns.length > 1 ? dataSheetRows.length - 1 : 5, c: 0 }, e: { r: dataSheetRows.length - 1, c: columns.length - 1 } },
  ];

  // ── Workbook ──────────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص التقرير');
  XLSX.utils.book_append_sheet(wb, dataWs, 'البيانات');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── Formatters ────────────────────────────────────────────────────────────────
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    open: 'مفتوح',
    in_progress: 'قيد التنفيذ',
    resolved: 'تم الحل',
    closed: 'مغلق',
    pending: 'معلق',
    completed: 'مكتمل',
    active: 'نشط',
    inactive: 'غير نشط',
    planning: 'تخطيط',
    on_hold: 'متوقف',
    approved: 'معتمد',
    rejected: 'مرفوض',
    review: 'قيد المراجعة',
    voting: 'قيد التصويت',
    announced: 'معلن',
    draft: 'مسودة',
    assigned: 'مسند',
    breached: 'مخترق',
    compliant: 'ملتزم',
  };
  return statusMap[status] || status;
}

export function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    critical: 'حرج',
    urgent: 'عاجل',
  };
  return priorityMap[priority] || priority;
}
