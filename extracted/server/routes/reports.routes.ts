/**
 * نظام التقارير والتحليلات - Report System
 * مركز التحكم - نادي سباقات الخيل (JCSA)
 * تقارير موثقة بأرقام مرجعية وأطر امتثال سعودية
 */

import type { Express } from "express";
import { db, sql, authenticateToken, logger, cache, requirePortal, DMO_PORTALS, ADMIN_PORTALS, IT_DIRECTOR_PORTALS } from "./shared";

const REPORT_PORTALS = [...new Set([...DMO_PORTALS, ...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS])];
const REPORT_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager'];

const REPORT_TYPES: Record<string, { nameAr: string; category: string }> = {
  executive_summary: { nameAr: 'الملخص التنفيذي', category: 'إداري' },
  compliance_status: { nameAr: 'حالة الامتثال', category: 'امتثال' },
  department_performance: { nameAr: 'أداء الإدارات', category: 'أداء' },
  security_posture: { nameAr: 'الوضع الأمني', category: 'أمني' },
  data_governance: { nameAr: 'حوكمة البيانات', category: 'بيانات' },
  ndmo_assessment: { nameAr: 'تقييم NDMO', category: 'امتثال' },
  pdpl_status: { nameAr: 'حالة نظام حماية البيانات الشخصية', category: 'خصوصية' },
  quarterly_review: { nameAr: 'المراجعة الربعية', category: 'إداري' },
};

async function generateReportNumber(type: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type.toUpperCase().replace(/_/g, '-');
  try {
    const [r] = await db.execute(sql`
      SELECT COUNT(*)::int + 1 as next_num FROM dw_etl_log
      WHERE run_type LIKE ${'report_%'} AND started_at >= ${`${year}-01-01`}::date
    `);
    const num = Number((r as any).rows?.[0]?.next_num || (r as any)[0]?.next_num || 1);
    return `RPT-${prefix}-${year}-${String(num).padStart(4, '0')}`;
  } catch {
    return `RPT-${prefix}-${year}-${String(Date.now() % 10000).padStart(4, '0')}`;
  }
}

export function registerReportRoutes(app: Express) {

  // ==================== قوالب التقارير ====================
  app.get("/api/reports/templates", authenticateToken, requirePortal(REPORT_PORTALS), async (_req, res) => {
    res.json(Object.entries(REPORT_TYPES).map(([key, val]) => ({
      id: key, ...val,
      periods: key === 'quarterly_review' ? ['quarterly'] : ['monthly', 'quarterly', 'yearly'],
    })));
  });

  // ==================== توليد تقرير ====================
  app.post("/api/reports/generate", authenticateToken, requirePortal(REPORT_PORTALS), async (req: any, res) => {
    try {
      if (!REPORT_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية إصدار التقارير مقتصرة على المدراء' });
      }

      const { reportType, period = 'monthly', departmentId } = req.body;
      if (!reportType || !REPORT_TYPES[reportType]) {
        return res.status(400).json({ error: 'نوع التقرير غير صالح' });
      }

      const startTime = Date.now();
      const reportNumber = await generateReportNumber(reportType);
      const reportMeta = REPORT_TYPES[reportType];
      const now = new Date();

      const periodLabels: Record<string, string> = { monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي' };
      const currentMonth = now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
      const currentQuarter = `الربع ${Math.ceil((now.getMonth() + 1) / 3)} - ${now.getFullYear()}`;

      // بيانات أساسية لكل التقارير
      const [base] = await db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE is_active = true AND deleted_at IS NULL) as users,
          (SELECT COUNT(*)::int FROM it_projects WHERE deleted_at IS NULL) as projects,
          (SELECT COUNT(*)::int FROM it_projects WHERE status IN ('planning','in_progress') AND deleted_at IS NULL) as active_projects,
          (SELECT COUNT(*)::int FROM it_tickets) as tickets,
          (SELECT COUNT(*)::int FROM it_tickets WHERE status IN ('resolved','closed')) as resolved_tickets,
          (SELECT COUNT(*)::int FROM it_tickets WHERE sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
          (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600),0)::numeric(10,1) FROM it_tickets WHERE status IN ('resolved','closed')) as avg_resolution,
          (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL) as tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE status = 'completed' AND deleted_at IS NULL) as completed_tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE due_date < NOW() AND status NOT IN ('completed','cancelled') AND deleted_at IS NULL) as overdue_tasks,
          (SELECT COUNT(*)::int FROM security_incidents WHERE status IN ('open','investigating')) as active_incidents,
          (SELECT COUNT(*)::int FROM security_vulnerabilities WHERE status IN ('open','in_progress')) as open_vulns,
          (SELECT COUNT(*)::int FROM domains WHERE is_active = true) as domains,
          (SELECT COUNT(*)::int FROM requirements WHERE is_active = true AND deleted_at IS NULL) as requirements,
          (SELECT COUNT(*)::int FROM evidences WHERE deleted_at IS NULL) as evidences,
          (SELECT COUNT(*)::int FROM evidences WHERE status = 'approved' AND deleted_at IS NULL) as approved_evidences,
          (SELECT COUNT(*)::int FROM data_assets) as data_assets,
          (SELECT COUNT(*)::int FROM data_subject_requests WHERE status = 'pending') as pending_dsr,
          (SELECT COUNT(*)::int FROM consent_records WHERE is_active = true) as active_consents,
          (SELECT COUNT(*)::int FROM data_breaches) as breaches,
          (SELECT COUNT(*)::int FROM committee_decisions WHERE deleted_at IS NULL) as decisions,
          (SELECT COUNT(*)::int FROM committee_decisions WHERE status = 'approved' AND deleted_at IS NULL) as approved_decisions
      `);
      const d = (base as any).rows?.[0] || (base as any)[0] || {};
      const totalTickets = Number(d.tickets) || 1;
      const resolvedTickets = Number(d.resolved_tickets) || 0;
      const totalTasks = Number(d.tasks) || 1;
      const completedTasks = Number(d.completed_tasks) || 0;
      const totalReqs = Number(d.requirements) || 1;
      const approvedEvs = Number(d.approved_evidences) || 0;
      const totalEvs = Number(d.evidences) || 1;

      // بناء التقرير
      const report: any = {
        metadata: {
          reportNumber,
          title: reportMeta.nameAr,
          category: reportMeta.category,
          organization: 'نادي سباقات الخيل',
          organizationEn: 'Jockey Club of Saudi Arabia (JCSA)',
          department: 'إدارة تقنية المعلومات',
          generatedBy: req.user.name || req.user.email,
          generatedAt: now.toISOString(),
          period: periodLabels[period] || period,
          periodCovered: period === 'quarterly' ? currentQuarter : currentMonth,
          classification: 'سري - للاستخدام الداخلي',
          version: '1.0',
        },
        sections: [],
        summary: {},
        recommendations: [],
      };

      // ==================== بناء الأقسام حسب نوع التقرير ====================

      if (['executive_summary', 'quarterly_review'].includes(reportType)) {
        report.sections.push({
          title: 'نظرة عامة على العمليات',
          data: {
            المستخدمون_النشطون: Number(d.users) || 0,
            المشاريع_الكلية: Number(d.projects) || 0,
            المشاريع_النشطة: Number(d.active_projects) || 0,
            التذاكر_الكلية: totalTickets,
            نسبة_حل_التذاكر: `${Math.round((resolvedTickets / totalTickets) * 100)}%`,
            متوسط_وقت_الحل: `${Number(d.avg_resolution) || 0} ساعة`,
            المهام_المكتملة: `${completedTasks} / ${totalTasks} (${Math.round((completedTasks / totalTasks) * 100)}%)`,
            المهام_المتأخرة: Number(d.overdue_tasks) || 0,
            مخالفات_SLA: Number(d.sla_breaches) || 0,
          },
        });
      }

      if (['compliance_status', 'ndmo_assessment', 'quarterly_review'].includes(reportType)) {
        const compResult = await db.execute(sql`
          SELECT d.code, d.name_ar, COUNT(r.id)::int as reqs,
            COUNT(CASE WHEN r.compliance_status = 'compliant' THEN 1 END)::int as compliant
          FROM domains d LEFT JOIN requirements r ON r.domain_id = d.id AND r.is_active = true AND r.deleted_at IS NULL
          WHERE d.is_active = true GROUP BY d.id, d.code, d.name_ar ORDER BY d.sort_order
        `);
        const compRows = ((compResult as any).rows || compResult) as any[];
        report.sections.push({
          title: 'حالة الامتثال - نطاقات NDMO',
          framework: 'NDMO',
          data: compRows.map((r: any) => ({
            النطاق: `${r.code} - ${r.name_ar}`,
            المتطلبات: Number(r.reqs) || 0,
            الممتثل: Number(r.compliant) || 0,
            نسبة_الامتثال: `${Number(r.reqs) > 0 ? Math.round((Number(r.compliant) / Number(r.reqs)) * 100) : 0}%`,
          })),
          summary: {
            إجمالي_النطاقات: Number(d.domains) || 0,
            إجمالي_المتطلبات: totalReqs,
            تغطية_الأدلة: `${Math.round((approvedEvs / totalEvs) * 100)}%`,
          },
        });
      }

      if (['department_performance', 'quarterly_review'].includes(reportType)) {
        const DEPTS = [
          { id: 5, name: 'مكتب إدارة البيانات' }, { id: 9, name: 'البنية التحتية' },
          { id: 10, name: 'الأمن السيبراني' }, { id: 11, name: 'التحول الرقمي' }, { id: 12, name: 'الدعم الفني' },
        ];
        const deptData = await Promise.all(DEPTS.map(async (dept) => {
          const [r] = await db.execute(sql`
            SELECT
              (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND status IN ('open','assigned','in_progress')) as open_tickets,
              (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL) as total_tasks,
              (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND status = 'completed' AND deleted_at IS NULL) as done_tasks,
              (SELECT COUNT(*)::int FROM users WHERE it_department_id = ${dept.id} AND is_active = true AND deleted_at IS NULL) as staff
          `);
          const row = (r as any).rows?.[0] || (r as any)[0] || {};
          const tt = Number(row.total_tasks) || 1;
          const dt = Number(row.done_tasks) || 0;
          return { الإدارة: dept.name, الموظفون: Number(row.staff)||0, التذاكر_المفتوحة: Number(row.open_tickets)||0, نسبة_إنجاز_المهام: `${Math.round((dt/tt)*100)}%` };
        }));
        report.sections.push({ title: 'أداء الإدارات', data: deptData });
      }

      if (['security_posture', 'quarterly_review'].includes(reportType)) {
        report.sections.push({
          title: 'الوضع الأمني',
          framework: 'NCA ECC-1:2018',
          data: {
            الحوادث_النشطة: Number(d.active_incidents) || 0,
            الثغرات_المفتوحة: Number(d.open_vulns) || 0,
            خروقات_البيانات: Number(d.breaches) || 0,
            درجة_المخاطر: Math.max(0, 100 - (Number(d.active_incidents)*15) - (Number(d.open_vulns)*5)),
          },
        });
      }

      if (['data_governance', 'quarterly_review'].includes(reportType)) {
        report.sections.push({
          title: 'حوكمة البيانات',
          data: {
            أصول_البيانات: Number(d.data_assets) || 0,
            طلبات_حقوق_البيانات_المعلقة: Number(d.pending_dsr) || 0,
            الموافقات_النشطة: Number(d.active_consents) || 0,
            خروقات_البيانات: Number(d.breaches) || 0,
            قرارات_اللجنة: `${Number(d.approved_decisions)||0} معتمدة من ${Number(d.decisions)||0}`,
          },
        });
      }

      if (['pdpl_status', 'quarterly_review'].includes(reportType)) {
        const [pdpl] = await db.execute(sql`
          SELECT
            (SELECT COUNT(*)::int FROM consent_records) as total_consents,
            (SELECT COUNT(*)::int FROM consent_records WHERE is_active = true) as active_consents,
            (SELECT COUNT(*)::int FROM consent_records WHERE is_active = false) as withdrawn,
            (SELECT COUNT(*)::int FROM data_breaches) as breaches,
            (SELECT COUNT(*)::int FROM privacy_notices WHERE is_active = true) as notices,
            (SELECT COUNT(*)::int FROM processing_records) as processing,
            (SELECT COUNT(*)::int FROM data_subject_requests) as dsr_total,
            (SELECT COUNT(*)::int FROM data_subject_requests WHERE status = 'completed') as dsr_done,
            (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400),0)::numeric(10,1) FROM data_subject_requests WHERE status = 'completed') as avg_dsr_days
        `);
        const p = (pdpl as any).rows?.[0] || (pdpl as any)[0] || {};
        report.sections.push({
          title: 'حالة الامتثال لنظام حماية البيانات الشخصية (PDPL)',
          framework: 'PDPL - SDAIA',
          data: {
            سجلات_الموافقة: `${Number(p.active_consents)||0} نشطة / ${Number(p.total_consents)||0} إجمالي`,
            الموافقات_المسحوبة: Number(p.withdrawn) || 0,
            إشعارات_الخصوصية_النشطة: Number(p.notices) || 0,
            سجلات_المعالجة: Number(p.processing) || 0,
            طلبات_حقوق_البيانات: `${Number(p.dsr_done)||0} مكتملة / ${Number(p.dsr_total)||0}`,
            متوسط_معالجة_الطلب: `${Number(p.avg_dsr_days)||0} يوم`,
            خروقات_البيانات: Number(p.breaches) || 0,
          },
        });
      }

      // ==================== التوصيات التلقائية ====================
      if (Number(d.sla_breaches) > 0) report.recommendations.push({ priority: 'عالية', text: `معالجة ${d.sla_breaches} مخالفة SLA عبر مراجعة آليات التصعيد وتوزيع الأحمال` });
      if (Number(d.overdue_tasks) > 5) report.recommendations.push({ priority: 'عالية', text: `متابعة ${d.overdue_tasks} مهمة متأخرة وإعادة جدولتها أو تصعيدها` });
      if (Number(d.active_incidents) > 0) report.recommendations.push({ priority: 'حرجة', text: `معالجة ${d.active_incidents} حادثة أمنية نشطة وفق إجراءات الاستجابة` });
      if (Number(d.open_vulns) > 5) report.recommendations.push({ priority: 'عالية', text: `إغلاق ${d.open_vulns} ثغرة أمنية مفتوحة حسب الأولوية` });
      if (Number(d.pending_dsr) > 0) report.recommendations.push({ priority: 'متوسطة', text: `معالجة ${d.pending_dsr} طلب حقوق بيانات معلق خلال المدة النظامية` });
      if (approvedEvs / totalEvs < 0.7) report.recommendations.push({ priority: 'متوسطة', text: `رفع تغطية الأدلة المعتمدة من ${Math.round((approvedEvs/totalEvs)*100)}% إلى 80% على الأقل` });

      report.summary = {
        نسبة_حل_التذاكر: `${Math.round((resolvedTickets / totalTickets) * 100)}%`,
        نسبة_إنجاز_المهام: `${Math.round((completedTasks / totalTasks) * 100)}%`,
        تغطية_الأدلة: `${Math.round((approvedEvs / totalEvs) * 100)}%`,
        عدد_التوصيات: report.recommendations.length,
        التصنيف_الأمني: Number(d.active_incidents) === 0 && Number(d.open_vulns) < 3 ? 'مستقر' : 'يحتاج متابعة',
      };

      // تسجيل التقرير
      await db.execute(sql`
        INSERT INTO dw_etl_log (run_type, status, records_processed, duration_ms, completed_at)
        VALUES (${'report_' + reportType}, 'success', ${report.sections.length}, ${Date.now() - startTime}, NOW())
      `).catch(() => {});

      res.json(report);
    } catch (error) {
      logger.error('[Reports] Generate error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في إصدار التقرير' });
    }
  });

  // ==================== سجل التقارير ====================
  app.get("/api/reports/history", authenticateToken, requirePortal(REPORT_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, run_type, status, records_processed, duration_ms, started_at, completed_at
        FROM dw_etl_log WHERE run_type LIKE 'report_%'
        ORDER BY started_at DESC LIMIT 50
      `);
      const rows = ((result as any).rows || result) as any[];
      res.json(rows.map((r: any) => ({
        ...r,
        reportType: r.run_type.replace('report_', ''),
        reportTitle: REPORT_TYPES[r.run_type.replace('report_', '')]?.nameAr || r.run_type,
      })));
    } catch {
      // الجدول ممكن ما يكون موجود بعد - ارجع قائمة فارغة
      res.json([]);
    }
  });

  // ==================== جدولة التقارير ====================
  app.post("/api/reports/schedule", authenticateToken, requirePortal(REPORT_PORTALS), async (req: any, res) => {
    try {
      if (!REPORT_ROLES.includes(req.user?.role)) return res.status(403).json({ error: 'صلاحية غير كافية' });
      const { reportType, frequency, email } = req.body;
      if (!reportType || !frequency) return res.status(400).json({ error: 'نوع التقرير والتكرار مطلوبان' });
      // Store schedule
      await db.execute(sql`
        INSERT INTO dw_etl_log (run_type, status, records_processed, completed_at)
        VALUES (${'schedule_' + reportType + '_' + frequency}, 'scheduled', 0, NOW())
      `);
      res.json({ success: true, message: `تم جدولة تقرير ${REPORT_TYPES[reportType]?.nameAr || reportType} (${frequency === 'weekly' ? 'أسبوعياً' : frequency === 'monthly' ? 'شهرياً' : 'ربع سنوي'})` });
    } catch (error) { res.status(500).json({ error: 'خطأ في جدولة التقرير' }); }
  });

  app.get("/api/reports/schedules", authenticateToken, requirePortal(REPORT_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, run_type, status, started_at FROM dw_etl_log
        WHERE run_type LIKE 'schedule_%' ORDER BY started_at DESC LIMIT 20
      `);
      res.json((result as any).rows || result);
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
  });

}
