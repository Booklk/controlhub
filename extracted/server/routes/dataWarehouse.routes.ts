/**
 * Data Warehouse Routes - مستودع البيانات التحليلي
 * مركز التحكم - نادي سباقات الخيل (JCSA)
 *
 * يوفر تحليلات شاملة من قاعدة بيانات PostgreSQL
 * بدون أي بيانات وهمية - كل شي حقيقي
 */

import type { Express } from "express";
import {
  db, sql, authenticateToken, logger, cache, TTL,
  requirePortal, DMO_PORTALS, ADMIN_PORTALS, IT_DIRECTOR_PORTALS,
} from "./shared";
import { runFullETL, startETLScheduler } from "../services/dataWarehouseETL";

export function registerDataWarehouseRoutes(app: Express) {

  const DW_ALLOWED_PORTALS = [...new Set([...DMO_PORTALS, ...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS])];

  // ==================== 1. ملخص تنفيذي شامل ====================
  app.get("/api/data-warehouse/executive-summary", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = `dw_executive_${req.user?.portal}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          -- المستخدمون
          (SELECT COUNT(*)::int FROM users WHERE is_active = true AND deleted_at IS NULL) as active_users,
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) as total_users,

          -- المشاريع
          (SELECT COUNT(*)::int FROM it_projects WHERE deleted_at IS NULL) as total_projects,
          (SELECT COUNT(*)::int FROM it_projects WHERE status IN ('planning','in_progress') AND deleted_at IS NULL) as active_projects,
          (SELECT COUNT(*)::int FROM it_projects WHERE status = 'completed' AND deleted_at IS NULL) as completed_projects,
          (SELECT COALESCE(AVG(progress), 0)::int FROM it_projects WHERE deleted_at IS NULL) as avg_project_progress,

          -- التذاكر
          (SELECT COUNT(*)::int FROM it_tickets) as total_tickets,
          (SELECT COUNT(*)::int FROM it_tickets WHERE status IN ('open','assigned','in_progress')) as open_tickets,
          (SELECT COUNT(*)::int FROM it_tickets WHERE status IN ('resolved','closed')) as resolved_tickets,
          (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 0)::numeric(10,1) FROM it_tickets WHERE status IN ('resolved','closed')) as avg_resolution_hours,
          (SELECT COUNT(*)::int FROM it_tickets WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,

          -- المهام
          (SELECT COUNT(*)::int FROM tasks WHERE deleted_at IS NULL) as total_tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE status = 'completed' AND deleted_at IS NULL) as completed_tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE due_date < NOW() AND status NOT IN ('completed','cancelled','archived') AND deleted_at IS NULL) as overdue_tasks,

          -- الإحالات
          (SELECT COUNT(*)::int FROM it_referrals) as total_referrals,
          (SELECT COUNT(*)::int FROM it_referrals WHERE status IN ('pending','in_progress')) as active_referrals,

          -- الأمن
          (SELECT COUNT(*)::int FROM security_incidents WHERE status IN ('open','investigating')) as active_incidents,
          (SELECT COUNT(*)::int FROM security_vulnerabilities WHERE status IN ('open','in_progress')) as open_vulnerabilities,

          -- الامتثال
          (SELECT COUNT(*)::int FROM domains WHERE is_active = true) as total_domains,
          (SELECT COUNT(*)::int FROM requirements WHERE is_active = true AND deleted_at IS NULL) as total_requirements,
          (SELECT COUNT(*)::int FROM evidences WHERE deleted_at IS NULL) as total_evidences,
          (SELECT COUNT(*)::int FROM evidences WHERE status = 'approved' AND deleted_at IS NULL) as approved_evidences,
          (SELECT COUNT(*)::int FROM compliance_reports) as total_compliance_reports,

          -- حوكمة البيانات
          (SELECT COUNT(*)::int FROM data_assets) as total_data_assets,
          (SELECT COUNT(*)::int FROM data_subject_requests) as total_dsr,
          (SELECT COUNT(*)::int FROM data_subject_requests WHERE status = 'pending') as pending_dsr,
          (SELECT COUNT(*)::int FROM data_breaches) as total_breaches,
          (SELECT COUNT(*)::int FROM consent_records WHERE is_active = true) as active_consents,

          -- اللجنة
          (SELECT COUNT(*)::int FROM committee_decisions WHERE deleted_at IS NULL) as total_decisions,
          (SELECT COUNT(*)::int FROM committee_decisions WHERE status = 'approved' AND deleted_at IS NULL) as approved_decisions,
          (SELECT COUNT(*)::int FROM committee_meetings) as total_meetings
      `);

      const r = (result as any).rows?.[0] || (result as any)[0] || {};
      const totalTickets = Number(r.total_tickets) || 1;
      const resolvedTickets = Number(r.resolved_tickets) || 0;
      const totalTasks = Number(r.total_tasks) || 1;
      const completedTasks = Number(r.completed_tasks) || 0;
      const totalReqs = Number(r.total_requirements) || 1;
      const approvedEvs = Number(r.approved_evidences) || 0;
      const totalEvs = Number(r.total_evidences) || 1;

      const data = {
        overview: {
          activeUsers: Number(r.active_users) || 0,
          totalProjects: Number(r.total_projects) || 0,
          activeProjects: Number(r.active_projects) || 0,
          totalTickets: Number(r.total_tickets) || 0,
          openTickets: Number(r.open_tickets) || 0,
          totalTasks: Number(r.total_tasks) || 0,
          overdueTasks: Number(r.overdue_tasks) || 0,
        },
        performance: {
          ticketResolutionRate: Math.round((resolvedTickets / totalTickets) * 100),
          taskCompletionRate: Math.round((completedTasks / totalTasks) * 100),
          avgResolutionHours: Number(r.avg_resolution_hours) || 0,
          slaBreaches: Number(r.sla_breaches) || 0,
          slaComplianceRate: Math.round(((totalTickets - Number(r.sla_breaches || 0)) / totalTickets) * 100),
          avgProjectProgress: Number(r.avg_project_progress) || 0,
        },
        compliance: {
          domains: Number(r.total_domains) || 0,
          requirements: totalReqs,
          evidences: Number(r.total_evidences) || 0,
          evidenceCoverage: Math.round((approvedEvs / totalEvs) * 100),
          complianceReports: Number(r.total_compliance_reports) || 0,
        },
        dataGovernance: {
          dataAssets: Number(r.total_data_assets) || 0,
          dsrTotal: Number(r.total_dsr) || 0,
          dsrPending: Number(r.pending_dsr) || 0,
          breaches: Number(r.total_breaches) || 0,
          activeConsents: Number(r.active_consents) || 0,
        },
        security: {
          activeIncidents: Number(r.active_incidents) || 0,
          openVulnerabilities: Number(r.open_vulnerabilities) || 0,
        },
        referrals: {
          total: Number(r.total_referrals) || 0,
          active: Number(r.active_referrals) || 0,
        },
        committee: {
          decisions: Number(r.total_decisions) || 0,
          approved: Number(r.approved_decisions) || 0,
          meetings: Number(r.total_meetings) || 0,
        },
      };

      cache.set(cacheKey, data, 3 * 60 * 1000);
      res.json(data);
    } catch (error) {
      logger.error('[DataWarehouse] Executive summary error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في جلب الملخص التنفيذي' });
    }
  });

  // ==================== 2. تحليل أداء الإدارات ====================
  app.get("/api/data-warehouse/department-analytics", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'dw_dept_analytics';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const DEPTS = [
        { id: 5, name: 'مكتب إدارة البيانات', code: 'DMO' },
        { id: 9, name: 'البنية التحتية', code: 'INFRA' },
        { id: 10, name: 'الأمن السيبراني', code: 'CYBER' },
        { id: 11, name: 'التحول الرقمي', code: 'DT' },
        { id: 12, name: 'الدعم الفني', code: 'SUPPORT' },
      ];

      const departments = await Promise.all(DEPTS.map(async (dept) => {
        const [r] = await db.execute(sql`
          SELECT
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id}) as total_tickets,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND status IN ('open','assigned','in_progress')) as open_tickets,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND status IN ('resolved','closed')) as resolved_tickets,
            (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 0)::numeric(10,1) FROM it_tickets WHERE department_id = ${dept.id} AND status IN ('resolved','closed')) as avg_resolution,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL) as total_tasks,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL AND status = 'completed') as completed_tasks,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled','archived')) as overdue_tasks,
            (SELECT COUNT(*)::int FROM it_projects WHERE it_department_id = ${dept.id} AND deleted_at IS NULL) as total_projects,
            (SELECT COUNT(*)::int FROM it_projects WHERE it_department_id = ${dept.id} AND status = 'completed' AND deleted_at IS NULL) as completed_projects,
            (SELECT COUNT(*)::int FROM users WHERE it_department_id = ${dept.id} AND is_active = true AND deleted_at IS NULL) as staff_count,
            (SELECT COUNT(*)::int FROM it_referrals WHERE from_department_id = ${dept.id} OR to_department_id = ${dept.id}) as referrals
        `);
        const row = (r as any).rows?.[0] || (r as any) || {};
        const totalT = Number(row.total_tickets) || 1;
        const resolvedT = Number(row.resolved_tickets) || 0;
        const totalTasks = Number(row.total_tasks) || 1;
        const completedTasks = Number(row.completed_tasks) || 0;
        const healthScore = Math.round(
          ((resolvedT / totalT) * 30) +
          ((completedTasks / totalTasks) * 30) +
          (Number(row.sla_breaches) === 0 ? 40 : Math.max(0, 40 - Number(row.sla_breaches) * 5))
        );

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          staffCount: Number(row.staff_count) || 0,
          tickets: { total: Number(row.total_tickets) || 0, open: Number(row.open_tickets) || 0, resolved: resolvedT, avgResolutionHours: Number(row.avg_resolution) || 0, slaBreaches: Number(row.sla_breaches) || 0 },
          tasks: { total: Number(row.total_tasks) || 0, completed: completedTasks, overdue: Number(row.overdue_tasks) || 0, completionRate: Math.round((completedTasks / totalTasks) * 100) },
          projects: { total: Number(row.total_projects) || 0, completed: Number(row.completed_projects) || 0 },
          referrals: Number(row.referrals) || 0,
          healthScore: Math.min(100, Math.max(0, healthScore)),
        };
      }));

      cache.set(cacheKey, departments, 3 * 60 * 1000);
      res.json(departments);
    } catch (error) {
      logger.error('[DataWarehouse] Department analytics error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تحليل أداء الإدارات' });
    }
  });

  // ==================== 3. تحليل الاتجاهات الزمنية ====================
  app.get("/api/data-warehouse/trends", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'dw_trends';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const arabicMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

      // Tickets trend - last 6 months
      const ticketTrend = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          EXTRACT(MONTH FROM created_at)::int as month_num,
          COUNT(*)::int as created,
          COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END)::int as resolved
        FROM it_tickets
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), EXTRACT(MONTH FROM created_at)
        ORDER BY month ASC
      `);

      // Tasks trend - last 6 months
      const taskTrend = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          EXTRACT(MONTH FROM created_at)::int as month_num,
          COUNT(*)::int as created,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed
        FROM tasks
        WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), EXTRACT(MONTH FROM created_at)
        ORDER BY month ASC
      `);

      // Projects trend - last 6 months
      const projectTrend = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          EXTRACT(MONTH FROM created_at)::int as month_num,
          COUNT(*)::int as created,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed
        FROM it_projects
        WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM'), EXTRACT(MONTH FROM created_at)
        ORDER BY month ASC
      `);

      const formatTrend = (rows: any) => {
        const data = ((rows as any).rows || rows) as any[];
        return data.map((r: any) => ({
          month: arabicMonths[(Number(r.month_num) - 1)] || r.month,
          created: Number(r.created) || 0,
          resolved: Number(r.resolved) || Number(r.completed) || 0,
        }));
      };

      const data = {
        tickets: formatTrend(ticketTrend),
        tasks: formatTrend(taskTrend),
        projects: formatTrend(projectTrend),
      };

      cache.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      logger.error('[DataWarehouse] Trends error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في جلب الاتجاهات' });
    }
  });

  // ==================== 4. تحليل الامتثال ====================
  app.get("/api/data-warehouse/compliance-analytics", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'dw_compliance';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      // Domain compliance breakdown
      const domainCompliance = await db.execute(sql`
        SELECT
          d.id, d.code, d.name_ar as name,
          COUNT(r.id)::int as total_requirements,
          COUNT(CASE WHEN r.compliance_status = 'compliant' THEN 1 END)::int as compliant,
          COUNT(CASE WHEN r.compliance_status = 'non_compliant' THEN 1 END)::int as non_compliant,
          COUNT(CASE WHEN r.compliance_status = 'partially_compliant' THEN 1 END)::int as partial,
          COUNT(e.id)::int as total_evidences,
          COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::int as approved_evidences
        FROM domains d
        LEFT JOIN requirements r ON r.domain_id = d.id AND r.is_active = true AND r.deleted_at IS NULL
        LEFT JOIN evidences e ON e.requirement_id = r.id AND e.deleted_at IS NULL
        WHERE d.is_active = true
        GROUP BY d.id, d.code, d.name_ar
        ORDER BY d.sort_order ASC
      `);

      // PDPL compliance
      const pdplData = await db.execute(sql`
        SELECT
          COUNT(*)::int as total_consents,
          COUNT(CASE WHEN is_active = true THEN 1 END)::int as active_consents,
          COUNT(CASE WHEN is_active = false THEN 1 END)::int as withdrawn_consents
        FROM consent_records
      `);

      // DSR analytics
      const dsrData = await db.execute(sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
          COALESCE(AVG(CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 END), 0)::numeric(10,1) as avg_days
        FROM data_subject_requests
      `);

      const dcRows = ((domainCompliance as any).rows || domainCompliance) as any[];
      const pdplRow = (pdplData as any).rows?.[0] || (pdplData as any)[0] || {};
      const dsrRow = (dsrData as any).rows?.[0] || (dsrData as any)[0] || {};

      const data = {
        domainBreakdown: dcRows.map((d: any) => {
          const totalReqs = Number(d.total_requirements) || 0;
          const compliant = Number(d.compliant) || 0;
          return {
            id: d.id, code: d.code, name: d.name,
            requirements: totalReqs,
            compliant, nonCompliant: Number(d.non_compliant) || 0, partial: Number(d.partial) || 0,
            complianceRate: totalReqs > 0 ? Math.round((compliant / totalReqs) * 100) : 0,
            evidences: Number(d.total_evidences) || 0,
            approvedEvidences: Number(d.approved_evidences) || 0,
          };
        }),
        pdpl: {
          totalConsents: Number(pdplRow.total_consents) || 0,
          activeConsents: Number(pdplRow.active_consents) || 0,
          withdrawnConsents: Number(pdplRow.withdrawn_consents) || 0,
        },
        dsr: {
          total: Number(dsrRow.total) || 0,
          pending: Number(dsrRow.pending) || 0,
          inProgress: Number(dsrRow.in_progress) || 0,
          completed: Number(dsrRow.completed) || 0,
          avgResolutionDays: Number(dsrRow.avg_days) || 0,
        },
      };

      cache.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      logger.error('[DataWarehouse] Compliance analytics error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تحليلات الامتثال' });
    }
  });

  // ==================== 5. تحليل جودة البيانات ====================
  app.get("/api/data-warehouse/data-quality-summary", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'dw_quality';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM data_assets) as total_assets,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'top_secret') as top_secret,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'confidential') as confidential,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'restricted') as restricted,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'public') as public_assets,
          (SELECT COUNT(*)::int FROM database_connections) as total_connections,
          (SELECT COUNT(*)::int FROM database_connections WHERE status = 'connected') as active_connections,
          (SELECT COUNT(*)::int FROM discovered_tables) as discovered_tables,
          (SELECT COUNT(*)::int FROM discovered_columns) as discovered_columns,
          (SELECT COUNT(*)::int FROM data_flow_mappings) as data_flows,
          (SELECT COUNT(*)::int FROM data_lineage) as lineage_records,
          (SELECT COUNT(*)::int FROM data_dictionary) as dictionary_terms,
          (SELECT COUNT(*)::int FROM data_risks) as total_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE risk_level IN ('high','critical')) as high_risks,
          (SELECT COUNT(*)::int FROM data_agreements) as total_agreements,
          (SELECT COUNT(*)::int FROM data_agreements WHERE status = 'active') as active_agreements
      `);

      const r = (result as any).rows?.[0] || (result as any)[0] || {};

      const data = {
        assets: {
          total: Number(r.total_assets) || 0,
          byClassification: {
            topSecret: Number(r.top_secret) || 0,
            confidential: Number(r.confidential) || 0,
            restricted: Number(r.restricted) || 0,
            public: Number(r.public_assets) || 0,
          },
        },
        catalog: {
          connections: Number(r.total_connections) || 0,
          activeConnections: Number(r.active_connections) || 0,
          discoveredTables: Number(r.discovered_tables) || 0,
          discoveredColumns: Number(r.discovered_columns) || 0,
          dataFlows: Number(r.data_flows) || 0,
          lineageRecords: Number(r.lineage_records) || 0,
          dictionaryTerms: Number(r.dictionary_terms) || 0,
        },
        risks: {
          total: Number(r.total_risks) || 0,
          highCritical: Number(r.high_risks) || 0,
        },
        agreements: {
          total: Number(r.total_agreements) || 0,
          active: Number(r.active_agreements) || 0,
        },
      };

      cache.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      logger.error('[DataWarehouse] Data quality error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تحليلات جودة البيانات' });
    }
  });

  // ==================== 6. تشغيل ETL يدوياً ====================
  app.post("/api/data-warehouse/etl/run", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const adminRoles = ['system_admin', 'admin', 'dmo_manager'];
      if (!adminRoles.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية تشغيل ETL مقتصرة على المدراء' });
      }
      logger.info(`[DW-ETL] Manual run triggered by ${req.user.name || req.user.email}`);
      const result = await runFullETL();
      res.json(result);
    } catch (error) {
      logger.error('[DataWarehouse] ETL run error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تشغيل ETL' });
    }
  });

  // ==================== 7. حالة ETL ====================
  app.get("/api/data-warehouse/etl/status", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, run_type, status, records_processed, error_message, started_at, completed_at, duration_ms
        FROM dw_etl_log ORDER BY started_at DESC LIMIT 20
      `);
      const rows = (result as any).rows || result;
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب حالة ETL' });
    }
  });

  // ==================== 8. تحليلات تاريخية من المستودع ====================
  app.get("/api/data-warehouse/historical/tickets", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const { months = '6', deptId } = req.query;
      const monthsNum = Math.min(parseInt(months as string) || 6, 24);

      let query;
      if (deptId) {
        query = sql`
          SELECT d.month_ar as month, d.year, d.month as month_num,
            SUM(f.created_count)::int as created, SUM(f.resolved_count)::int as resolved,
            AVG(f.open_count)::int as avg_open, AVG(f.avg_resolution_hours)::numeric(10,1) as avg_resolution,
            SUM(f.sla_breaches)::int as sla_breaches
          FROM dw_fact_tickets_daily f
          JOIN dw_dim_date d ON f.date_id = d.id
          WHERE f.dept_id = ${parseInt(deptId as string)}
            AND d.full_date >= NOW() - (${monthsNum} || ' months')::interval
          GROUP BY d.month_ar, d.year, d.month
          ORDER BY d.year, d.month
        `;
      } else {
        query = sql`
          SELECT d.month_ar as month, d.year, d.month as month_num,
            SUM(f.created_count)::int as created, SUM(f.resolved_count)::int as resolved,
            AVG(f.open_count)::int as avg_open, AVG(f.avg_resolution_hours)::numeric(10,1) as avg_resolution,
            SUM(f.sla_breaches)::int as sla_breaches
          FROM dw_fact_tickets_daily f
          JOIN dw_dim_date d ON f.date_id = d.id
          WHERE d.full_date >= NOW() - (${monthsNum} || ' months')::interval
          GROUP BY d.month_ar, d.year, d.month
          ORDER BY d.year, d.month
        `;
      }

      const result = await db.execute(query);
      res.json((result as any).rows || result);
    } catch (error) {
      logger.error('[DW] Historical tickets error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في التحليلات التاريخية' });
    }
  });

  app.get("/api/data-warehouse/historical/compliance", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT d.month_ar as month, d.year, d.month as month_num,
          SUM(f.total_requirements)::int as requirements,
          SUM(f.compliant_count)::int as compliant,
          AVG(f.compliance_rate)::numeric(5,1) as avg_compliance_rate,
          SUM(f.total_evidences)::int as evidences,
          SUM(f.approved_evidences)::int as approved_evidences
        FROM dw_fact_compliance_monthly f
        JOIN dw_dim_date d ON f.date_id = d.id
        WHERE d.full_date >= NOW() - INTERVAL '12 months'
        GROUP BY d.month_ar, d.year, d.month
        ORDER BY d.year, d.month
      `);
      res.json((result as any).rows || result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحليلات الامتثال التاريخية' });
    }
  });

  // ==================== 9. تحليلات المصادر الخارجية ====================
  app.get("/api/data-warehouse/external-sources", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'dw_external_sources';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          s.id, s.source_name, s.source_type, s.host, s.database_name, s.is_active, s.last_sync_at,
          f.tables_count, f.total_rows, f.columns_count, f.connection_status, f.response_time_ms, f.data_quality_score,
          f.snapshot_at
        FROM dw_dim_source s
        LEFT JOIN LATERAL (
          SELECT * FROM dw_fact_external_source
          WHERE source_id = s.id
          ORDER BY snapshot_at DESC LIMIT 1
        ) f ON true
        WHERE s.is_active = true
        ORDER BY s.source_name
      `);
      const rows = (result as any).rows || result;
      cache.set(cacheKey, rows, 3 * 60 * 1000);
      res.json(rows);
    } catch (error) {
      logger.error('[DW] External sources error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات المصادر الخارجية' });
    }
  });

  // ==================== 10. تاريخ مصدر خارجي محدد ====================
  app.get("/api/data-warehouse/external-sources/:sourceId/history", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const sourceId = parseInt(req.params.sourceId);
      if (isNaN(sourceId)) return res.status(400).json({ error: 'معرف المصدر غير صالح' });

      const result = await db.execute(sql`
        SELECT
          d.full_date, d.month_ar, d.year,
          f.tables_count, f.total_rows, f.columns_count,
          f.connection_status, f.response_time_ms, f.data_quality_score
        FROM dw_fact_external_source f
        JOIN dw_dim_date d ON f.date_id = d.id
        WHERE f.source_id = ${sourceId}
        ORDER BY d.full_date DESC
        LIMIT 90
      `);
      res.json((result as any).rows || result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب تاريخ المصدر' });
    }
  });

  // ==================== 11. ملخص كل المصادر ====================
  app.get("/api/data-warehouse/sources-summary", authenticateToken, requirePortal(DW_ALLOWED_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM dw_dim_source WHERE is_active = true) as total_sources,
          (SELECT COUNT(DISTINCT source_type) FROM dw_dim_source WHERE is_active = true) as source_types,
          (SELECT COUNT(*)::int FROM dw_fact_external_source WHERE connection_status = 'connected' AND snapshot_at > NOW() - INTERVAL '1 day') as connected_today,
          (SELECT COUNT(*)::int FROM dw_fact_external_source WHERE connection_status IN ('disconnected','error') AND snapshot_at > NOW() - INTERVAL '1 day') as failed_today,
          (SELECT COALESCE(SUM(tables_count), 0)::int FROM dw_fact_external_source f WHERE f.id IN (SELECT MAX(id) FROM dw_fact_external_source GROUP BY source_id)) as total_external_tables,
          (SELECT COALESCE(SUM(total_rows), 0)::bigint FROM dw_fact_external_source f WHERE f.id IN (SELECT MAX(id) FROM dw_fact_external_source GROUP BY source_id)) as total_external_rows,
          (SELECT COALESCE(SUM(columns_count), 0)::int FROM dw_fact_external_source f WHERE f.id IN (SELECT MAX(id) FROM dw_fact_external_source GROUP BY source_id)) as total_external_columns,
          (SELECT COUNT(*)::int FROM dw_etl_log WHERE status = 'success' AND started_at > NOW() - INTERVAL '7 days') as successful_runs_7d,
          (SELECT COUNT(*)::int FROM dw_etl_log WHERE status = 'failed' AND started_at > NOW() - INTERVAL '7 days') as failed_runs_7d
      `);
      const r = (result as any).rows?.[0] || (result as any)[0] || {};
      res.json({
        sources: { total: Number(r.total_sources)||0, types: Number(r.source_types)||0, connectedToday: Number(r.connected_today)||0, failedToday: Number(r.failed_today)||0 },
        data: { tables: Number(r.total_external_tables)||0, rows: Number(r.total_external_rows)||0, columns: Number(r.total_external_columns)||0 },
        etl: { successfulRuns7d: Number(r.successful_runs_7d)||0, failedRuns7d: Number(r.failed_runs_7d)||0 },
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في ملخص المصادر' });
    }
  });

  // Smart Analytics
  app.get("/api/smart/anomalies", authenticateToken, async (req: any, res) => {
    try { const { detectAnomalies } = await import("../services/smartAnalytics"); res.json(await detectAnomalies()); } catch(e) { res.status(500).json({ error: (e as Error).message }); }
  });
  app.get("/api/smart/predictions", authenticateToken, async (req: any, res) => {
    try { const { generatePredictions } = await import("../services/smartAnalytics"); res.json(await generatePredictions()); } catch(e) { res.status(500).json({ error: (e as Error).message }); }
  });
  app.get("/api/smart/recommendations", authenticateToken, async (req: any, res) => {
    try { const { generateRecommendations } = await import("../services/smartAnalytics"); res.json(await generateRecommendations()); } catch(e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // SLA Analytics for IT Director
  app.get("/api/director/sla-analytics", authenticateToken, async (req: any, res) => {
    try {
      const allowedRoles = ['system_admin', 'admin', 'it_director'];
      if (!allowedRoles.includes(req.user?.role)) return res.status(403).json({ error: 'غير مصرح' });

      const DEPTS = [
        { id: 5, name: 'مكتب إدارة البيانات' },
        { id: 9, name: 'البنية التحتية' },
        { id: 10, name: 'الأمن السيبراني' },
        { id: 11, name: 'التحول الرقمي' },
        { id: 12, name: 'الدعم الفني' },
      ];

      const departments = await Promise.all(DEPTS.map(async (dept) => {
        const [r] = await db.execute(sql`
          SELECT
            COUNT(*)::int as total_tickets,
            COUNT(CASE WHEN sla_deadline IS NOT NULL THEN 1 END)::int as tickets_with_sla,
            COUNT(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved') THEN 1 END)::int as breaches,
            COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END)::int as resolved,
            COALESCE(AVG(CASE WHEN status IN ('resolved','closed') THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 END), 0)::numeric(10,1) as avg_resolution_hours,
            COUNT(CASE WHEN priority IN ('high','critical') AND status NOT IN ('closed','resolved') THEN 1 END)::int as high_priority_open
          FROM it_tickets WHERE department_id = ${dept.id}
        `);
        const row = (r as any).rows?.[0] || (r as any)[0] || {};
        const withSLA = Number(row.tickets_with_sla) || 1;
        const breaches = Number(row.breaches) || 0;
        return {
          id: dept.id, name: dept.name,
          totalTickets: Number(row.total_tickets) || 0,
          ticketsWithSLA: withSLA,
          slaBreaches: breaches,
          slaComplianceRate: Math.round(((withSLA - breaches) / withSLA) * 100),
          resolved: Number(row.resolved) || 0,
          avgResolutionHours: Number(row.avg_resolution_hours) || 0,
          highPriorityOpen: Number(row.high_priority_open) || 0,
        };
      }));

      const totalBreaches = departments.reduce((s, d) => s + d.slaBreaches, 0);
      const totalWithSLA = departments.reduce((s, d) => s + d.ticketsWithSLA, 0) || 1;
      const overallCompliance = Math.round(((totalWithSLA - totalBreaches) / totalWithSLA) * 100);

      res.json({ overallCompliance, totalBreaches, departments });
    } catch (error) {
      logger.error('[Director] SLA analytics error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  // Manager Scorecards
  app.get("/api/director/manager-scorecards", authenticateToken, async (req: any, res) => {
    try {
      const allowedRoles = ['system_admin', 'admin', 'it_director'];
      if (!allowedRoles.includes(req.user?.role)) return res.status(403).json({ error: 'غير مصرح' });

      const DEPTS = [
        { id: 5, name: 'مكتب إدارة البيانات', role: 'dmo_manager' },
        { id: 9, name: 'البنية التحتية', role: 'infrastructure_manager' },
        { id: 10, name: 'الأمن السيبراني', role: 'cybersecurity_manager' },
        { id: 11, name: 'التحول الرقمي', role: 'digital_transformation_manager' },
        { id: 12, name: 'الدعم الفني', role: 'support_manager' },
      ];

      const scorecards = await Promise.all(DEPTS.map(async (dept) => {
        const [r] = await db.execute(sql`
          SELECT
            (SELECT COUNT(*)::int FROM users WHERE it_department_id = ${dept.id} AND is_active = true AND deleted_at IS NULL) as staff_count,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND status IN ('resolved','closed')) as resolved_tickets,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id}) as total_tickets,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND status = 'completed' AND deleted_at IS NULL) as completed_tasks,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL) as total_tasks,
            (SELECT COUNT(*)::int FROM tasks WHERE department_id = ${dept.id} AND due_date < NOW() AND status NOT IN ('completed','cancelled') AND deleted_at IS NULL) as overdue_tasks,
            (SELECT COUNT(*)::int FROM it_projects WHERE it_department_id = ${dept.id} AND status = 'completed' AND deleted_at IS NULL) as completed_projects,
            (SELECT COUNT(*)::int FROM it_projects WHERE it_department_id = ${dept.id} AND deleted_at IS NULL) as total_projects,
            (SELECT COUNT(*)::int FROM it_tickets WHERE department_id = ${dept.id} AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
            (SELECT COUNT(*)::int FROM escalations WHERE department_id = ${dept.id} AND status = 'pending') as pending_escalations
        `);
        const row = (r as any).rows?.[0] || (r as any)[0] || {};
        const totalT = Number(row.total_tickets) || 1;
        const resolvedT = Number(row.resolved_tickets) || 0;
        const totalTasks = Number(row.total_tasks) || 1;
        const completedTasks = Number(row.completed_tasks) || 0;
        const totalProjects = Number(row.total_projects) || 1;
        const completedProjects = Number(row.completed_projects) || 0;

        const ticketScore = Math.round((resolvedT / totalT) * 100);
        const taskScore = Math.round((completedTasks / totalTasks) * 100);
        const projectScore = Math.round((completedProjects / totalProjects) * 100);
        const overallScore = Math.round((ticketScore * 0.3) + (taskScore * 0.4) + (projectScore * 0.3));

        return {
          department: dept.name, departmentId: dept.id,
          staffCount: Number(row.staff_count) || 0,
          metrics: {
            ticketResolution: ticketScore,
            taskCompletion: taskScore,
            projectDelivery: projectScore,
            slaBreaches: Number(row.sla_breaches) || 0,
            overdueItems: Number(row.overdue_tasks) || 0,
            pendingEscalations: Number(row.pending_escalations) || 0,
          },
          overallScore,
          rating: overallScore >= 85 ? 'ممتاز' : overallScore >= 70 ? 'جيد جداً' : overallScore >= 55 ? 'جيد' : 'يحتاج تحسين',
        };
      }));

      res.json(scorecards.sort((a, b) => b.overallScore - a.overallScore));
    } catch (error) {
      logger.error('[Director] Manager scorecards error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  // بدء جدولة ETL
  startETLScheduler();

}
