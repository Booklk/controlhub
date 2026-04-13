/**
 * Data Warehouse ETL Pipeline - خط أنابيب مستودع البيانات
 * نادي سباقات الخيل (JCSA) - مركز التحكم
 *
 * يجمع البيانات من الجداول التشغيلية وينقلها لمستودع البيانات
 * يعمل يومياً تلقائياً + يدوياً عند الطلب
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger as appLogger } from '../security-middleware';

const logger = {
  info: (msg: string, meta?: any) => appLogger.info(`[DW-ETL] ${msg}`, meta || {}),
  error: (msg: string, meta?: any) => appLogger.error(`[DW-ETL] ${msg}`, meta || {}),
  warn: (msg: string, meta?: any) => appLogger.warn(`[DW-ETL] ${msg}`, meta || {}),
};

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DEPARTMENTS = [
  { id: 5, nameAr: 'مكتب إدارة البيانات', nameEn: 'DMO', code: 'DMO' },
  { id: 9, nameAr: 'البنية التحتية', nameEn: 'Infrastructure', code: 'INFRA' },
  { id: 10, nameAr: 'الأمن السيبراني', nameEn: 'Cybersecurity', code: 'CYBER' },
  { id: 11, nameAr: 'التحول الرقمي', nameEn: 'Digital Transformation', code: 'DT' },
  { id: 12, nameAr: 'الدعم الفني', nameEn: 'Support', code: 'SUPPORT' },
];

async function logETLRun(runType: string, status: string, records: number, error?: string, startTime?: number) {
  try {
    const duration = startTime ? Date.now() - startTime : null;
    await db.execute(sql`
      INSERT INTO dw_etl_log (run_type, status, records_processed, error_message, completed_at, duration_ms)
      VALUES (${runType}, ${status}, ${records}, ${error || null}, NOW(), ${duration})
    `);
  } catch (e) {
    logger.error('Failed to log ETL run', { error: (e as Error).message });
  }
}

// ==================== 1. تهيئة بُعد التاريخ ====================
export async function seedDateDimension(years: number = 3): Promise<number> {
  const start = Date.now();
  let count = 0;
  try {
    const startYear = new Date().getFullYear() - 1;
    const endYear = startYear + years;

    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          const dayOfWeek = date.getDay();
          const weekOfYear = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
          const quarter = Math.ceil((month + 1) / 3);

          await db.execute(sql`
            INSERT INTO dw_dim_date (full_date, day, month, month_ar, quarter, year, week_of_year, day_of_week, is_weekend, fiscal_quarter)
            VALUES (${date}, ${day}, ${month + 1}, ${ARABIC_MONTHS[month]}, ${quarter}, ${year}, ${weekOfYear}, ${dayOfWeek}, ${dayOfWeek === 5 || dayOfWeek === 6}, ${'Q' + quarter + '-' + year})
            ON CONFLICT (full_date) DO NOTHING
          `);
          count++;
        }
      }
    }

    logger.info(`Date dimension seeded: ${count} dates`, { years: `${startYear}-${endYear}` });
    await logETLRun('seed_dates', 'success', count, undefined, start);
    return count;
  } catch (error) {
    logger.error('Date dimension seed failed', { error: (error as Error).message });
    await logETLRun('seed_dates', 'failed', count, (error as Error).message, start);
    throw error;
  }
}

// ==================== 2. تهيئة بُعد الإدارات ====================
export async function seedDepartmentDimension(): Promise<number> {
  try {
    for (const dept of DEPARTMENTS) {
      await db.execute(sql`
        INSERT INTO dw_dim_department (dept_id, name_ar, name_en, code, type)
        VALUES (${dept.id}, ${dept.nameAr}, ${dept.nameEn}, ${dept.code}, 'it_department')
        ON CONFLICT (dept_id) DO UPDATE SET name_ar = ${dept.nameAr}, name_en = ${dept.nameEn}, code = ${dept.code}
      `);
    }
    logger.info('Department dimension seeded');
    return DEPARTMENTS.length;
  } catch (error) {
    logger.error('Department dimension seed failed', { error: (error as Error).message });
    throw error;
  }
}

// ==================== 3. ETL: التذاكر اليومية ====================
export async function etlTicketsDaily(): Promise<number> {
  const start = Date.now();
  let total = 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's date dimension
    const [dateRow] = await db.execute(sql`
      SELECT id FROM dw_dim_date WHERE full_date::date = ${today}::date LIMIT 1
    `);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) {
      await seedDateDimension(1);
      return etlTicketsDaily();
    }

    for (const dept of DEPARTMENTS) {
      const [r] = await db.execute(sql`
        SELECT
          COUNT(CASE WHEN created_at::date = ${today}::date THEN 1 END)::int as created_today,
          COUNT(CASE WHEN status IN ('resolved','closed') AND updated_at::date = ${today}::date THEN 1 END)::int as resolved_today,
          COUNT(CASE WHEN status IN ('open','assigned','in_progress') THEN 1 END)::int as open_now,
          COALESCE(AVG(CASE WHEN status IN ('resolved','closed') THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 END), 0)::numeric(10,1) as avg_res,
          COUNT(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved') THEN 1 END)::int as sla_breaches,
          COUNT(CASE WHEN priority IN ('high','critical') AND status IN ('open','assigned','in_progress') THEN 1 END)::int as high_priority
        FROM it_tickets WHERE department_id = ${dept.id}
      `);
      const row = (r as any).rows?.[0] || (r as any) || {};

      await db.execute(sql`
        INSERT INTO dw_fact_tickets_daily (date_id, dept_id, created_count, resolved_count, open_count, avg_resolution_hours, sla_breaches, high_priority_count)
        VALUES (${dateId}, ${dept.id}, ${Number(row.created_today)||0}, ${Number(row.resolved_today)||0}, ${Number(row.open_now)||0}, ${Number(row.avg_res)||0}, ${Number(row.sla_breaches)||0}, ${Number(row.high_priority)||0})
        ON CONFLICT DO NOTHING
      `);
      total++;
    }

    logger.info(`Tickets daily ETL completed: ${total} departments`);
    await logETLRun('tickets_daily', 'success', total, undefined, start);
    return total;
  } catch (error) {
    logger.error('Tickets daily ETL failed', { error: (error as Error).message });
    await logETLRun('tickets_daily', 'failed', total, (error as Error).message, start);
    return total;
  }
}

// ==================== 4. ETL: المهام اليومية ====================
export async function etlTasksDaily(): Promise<number> {
  const start = Date.now();
  let total = 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dateRow] = await db.execute(sql`SELECT id FROM dw_dim_date WHERE full_date::date = ${today}::date LIMIT 1`);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) return 0;

    for (const dept of DEPARTMENTS) {
      const [r] = await db.execute(sql`
        SELECT
          COUNT(CASE WHEN created_at::date = ${today}::date THEN 1 END)::int as created_today,
          COUNT(CASE WHEN status = 'completed' AND updated_at::date = ${today}::date THEN 1 END)::int as completed_today,
          COUNT(CASE WHEN due_date < NOW() AND status NOT IN ('completed','cancelled','archived') THEN 1 END)::int as overdue_now,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress_now,
          COALESCE(AVG(CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 END), 0)::numeric(10,1) as avg_completion
        FROM tasks WHERE department_id = ${dept.id} AND deleted_at IS NULL
      `);
      const row = (r as any).rows?.[0] || (r as any) || {};

      await db.execute(sql`
        INSERT INTO dw_fact_tasks_daily (date_id, dept_id, created_count, completed_count, overdue_count, in_progress_count, avg_completion_hours)
        VALUES (${dateId}, ${dept.id}, ${Number(row.created_today)||0}, ${Number(row.completed_today)||0}, ${Number(row.overdue_now)||0}, ${Number(row.in_progress_now)||0}, ${Number(row.avg_completion)||0})
        ON CONFLICT DO NOTHING
      `);
      total++;
    }

    logger.info(`Tasks daily ETL completed: ${total} departments`);
    await logETLRun('tasks_daily', 'success', total, undefined, start);
    return total;
  } catch (error) {
    logger.error('Tasks daily ETL failed', { error: (error as Error).message });
    await logETLRun('tasks_daily', 'failed', total, (error as Error).message, start);
    return total;
  }
}

// ==================== 5. ETL: المشاريع الشهرية ====================
export async function etlProjectsMonthly(): Promise<number> {
  const start = Date.now();
  let total = 0;
  try {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [dateRow] = await db.execute(sql`SELECT id FROM dw_dim_date WHERE full_date::date = ${firstOfMonth}::date LIMIT 1`);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) return 0;

    for (const dept of DEPARTMENTS) {
      const [r] = await db.execute(sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN status IN ('planning','in_progress') THEN 1 END)::int as active,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
          COUNT(CASE WHEN end_date < NOW() AND status NOT IN ('completed','cancelled') THEN 1 END)::int as delayed,
          COALESCE(AVG(progress), 0)::int as avg_progress,
          COALESCE(SUM(budget), 0)::numeric(15,2) as total_budget
        FROM it_projects WHERE it_department_id = ${dept.id} AND deleted_at IS NULL
      `);
      const row = (r as any).rows?.[0] || (r as any) || {};

      await db.execute(sql`
        INSERT INTO dw_fact_projects_monthly (date_id, dept_id, total_count, active_count, completed_count, delayed_count, avg_progress, total_budget)
        VALUES (${dateId}, ${dept.id}, ${Number(row.total)||0}, ${Number(row.active)||0}, ${Number(row.completed)||0}, ${Number(row.delayed)||0}, ${Number(row.avg_progress)||0}, ${Number(row.total_budget)||0})
        ON CONFLICT DO NOTHING
      `);
      total++;
    }

    await logETLRun('projects_monthly', 'success', total, undefined, start);
    return total;
  } catch (error) {
    logger.error('Projects monthly ETL failed', { error: (error as Error).message });
    await logETLRun('projects_monthly', 'failed', total, (error as Error).message, start);
    return total;
  }
}

// ==================== 6. ETL: الامتثال الشهري ====================
export async function etlComplianceMonthly(): Promise<number> {
  const start = Date.now();
  let total = 0;
  try {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [dateRow] = await db.execute(sql`SELECT id FROM dw_dim_date WHERE full_date::date = ${firstOfMonth}::date LIMIT 1`);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) return 0;

    const domainsResult = await db.execute(sql`SELECT id FROM domains WHERE is_active = true`);
    const domainRows = ((domainsResult as any).rows || domainsResult) as any[];

    for (const domain of domainRows) {
      const [r] = await db.execute(sql`
        SELECT
          COUNT(r.id)::int as total_reqs,
          COUNT(CASE WHEN r.compliance_status = 'compliant' THEN 1 END)::int as compliant,
          COUNT(CASE WHEN r.compliance_status = 'non_compliant' THEN 1 END)::int as non_compliant,
          COUNT(e.id)::int as total_evidences,
          COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::int as approved_evidences
        FROM requirements r
        LEFT JOIN evidences e ON e.requirement_id = r.id AND e.deleted_at IS NULL
        WHERE r.domain_id = ${domain.id} AND r.is_active = true AND r.deleted_at IS NULL
      `);
      const row = (r as any).rows?.[0] || (r as any) || {};
      const totalReqs = Number(row.total_reqs) || 1;
      const compliant = Number(row.compliant) || 0;

      await db.execute(sql`
        INSERT INTO dw_fact_compliance_monthly (date_id, domain_id, total_requirements, compliant_count, non_compliant_count, total_evidences, approved_evidences, compliance_rate)
        VALUES (${dateId}, ${domain.id}, ${Number(row.total_reqs)||0}, ${compliant}, ${Number(row.non_compliant)||0}, ${Number(row.total_evidences)||0}, ${Number(row.approved_evidences)||0}, ${Math.round((compliant / totalReqs) * 100)})
        ON CONFLICT DO NOTHING
      `);
      total++;
    }

    await logETLRun('compliance_monthly', 'success', total, undefined, start);
    return total;
  } catch (error) {
    logger.error('Compliance monthly ETL failed', { error: (error as Error).message });
    await logETLRun('compliance_monthly', 'failed', total, (error as Error).message, start);
    return total;
  }
}

// ==================== 7. ETL: الأمن اليومي ====================
export async function etlSecurityDaily(): Promise<number> {
  const start = Date.now();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dateRow] = await db.execute(sql`SELECT id FROM dw_dim_date WHERE full_date::date = ${today}::date LIMIT 1`);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) return 0;

    const [r] = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM security_incidents WHERE created_at::date = ${today}::date) as incidents_created,
        (SELECT COUNT(*)::int FROM security_incidents WHERE status IN ('resolved','closed') AND updated_at::date = ${today}::date) as incidents_resolved,
        (SELECT COUNT(*)::int FROM security_vulnerabilities WHERE status IN ('open','in_progress')) as vulns_open,
        (SELECT COUNT(*)::int FROM security_vulnerabilities WHERE status IN ('resolved','closed') AND updated_at::date = ${today}::date) as vulns_closed,
        (SELECT COUNT(*)::int FROM security_threats WHERE status = 'active') as threats,
        (SELECT GREATEST(0, 100 - COUNT(CASE WHEN severity = 'critical' THEN 1 END) * 15 - COUNT(CASE WHEN status IN ('open','investigating') THEN 1 END) * 5)::int FROM security_incidents) as risk_score
    `);
    const row = (r as any).rows?.[0] || (r as any) || {};

    await db.execute(sql`
      INSERT INTO dw_fact_security_daily (date_id, incidents_created, incidents_resolved, vulnerabilities_open, vulnerabilities_closed, threat_count, risk_score)
      VALUES (${dateId}, ${Number(row.incidents_created)||0}, ${Number(row.incidents_resolved)||0}, ${Number(row.vulns_open)||0}, ${Number(row.vulns_closed)||0}, ${Number(row.threats)||0}, ${Number(row.risk_score)||100})
      ON CONFLICT DO NOTHING
    `);

    await logETLRun('security_daily', 'success', 1, undefined, start);
    return 1;
  } catch (error) {
    logger.error('Security daily ETL failed', { error: (error as Error).message });
    await logETLRun('security_daily', 'failed', 0, (error as Error).message, start);
    return 0;
  }
}

// ==================== 8. ETL: حوكمة البيانات الشهرية ====================
export async function etlDataGovernanceMonthly(): Promise<number> {
  const start = Date.now();
  try {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [dateRow] = await db.execute(sql`SELECT id FROM dw_dim_date WHERE full_date::date = ${firstOfMonth}::date LIMIT 1`);
    const dateId = (dateRow as any).rows?.[0]?.id || (dateRow as any)[0]?.id;
    if (!dateId) return 0;

    const [r] = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM data_assets) as total_assets,
        (SELECT COUNT(*)::int FROM data_assets WHERE classification IS NOT NULL AND classification != 'public') as classified,
        (SELECT COUNT(*)::int FROM database_connections) as connections,
        (SELECT COUNT(*)::int FROM discovered_tables) as tables,
        (SELECT COUNT(*)::int FROM data_subject_requests) as dsr_total,
        (SELECT COUNT(*)::int FROM data_subject_requests WHERE status = 'completed') as dsr_completed,
        (SELECT COUNT(*)::int FROM data_breaches) as breaches,
        (SELECT COUNT(*)::int FROM consent_records WHERE is_active = true) as consents
    `);
    const row = (r as any).rows?.[0] || (r as any) || {};

    await db.execute(sql`
      INSERT INTO dw_fact_data_governance_monthly (date_id, total_assets, classified_assets, total_connections, discovered_tables, dsr_received, dsr_completed, breach_count, active_consents)
      VALUES (${dateId}, ${Number(row.total_assets)||0}, ${Number(row.classified)||0}, ${Number(row.connections)||0}, ${Number(row.tables)||0}, ${Number(row.dsr_total)||0}, ${Number(row.dsr_completed)||0}, ${Number(row.breaches)||0}, ${Number(row.consents)||0})
      ON CONFLICT DO NOTHING
    `);

    await logETLRun('data_governance_monthly', 'success', 1, undefined, start);
    return 1;
  } catch (error) {
    logger.error('Data governance monthly ETL failed', { error: (error as Error).message });
    await logETLRun('data_governance_monthly', 'failed', 0, (error as Error).message, start);
    return 0;
  }
}

// ==================== تشغيل ETL الكامل ====================
export async function runFullETL(): Promise<{ success: boolean; results: Record<string, number>; duration: number }> {
  const start = Date.now();
  logger.info('Starting full ETL pipeline...');

  try {
    // تهيئة الأبعاد
    await seedDateDimension(2);
    await seedDepartmentDimension();

    // تشغيل ETL
    const results = {
      ticketsDaily: await etlTicketsDaily(),
      tasksDaily: await etlTasksDaily(),
      projectsMonthly: await etlProjectsMonthly(),
      complianceMonthly: await etlComplianceMonthly(),
      securityDaily: await etlSecurityDaily(),
      dataGovernanceMonthly: await etlDataGovernanceMonthly(),
    };

    const duration = Date.now() - start;
    logger.info(`Full ETL completed in ${duration}ms`, results);
    return { success: true, results, duration };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Full ETL failed', { error: (error as Error).message, duration });
    return { success: false, results: {}, duration };
  }
}

// ==================== جدولة ETL تلقائية ====================
export function startETLScheduler() {
  // تشغيل أولي بعد 30 ثانية من بدء السيرفر
  setTimeout(async () => {
    try {
      await runFullETL();
    } catch (e) {
      logger.error('Initial ETL run failed', { error: (e as Error).message });
    }
  }, 30000);

  // تشغيل يومي كل 24 ساعة
  setInterval(async () => {
    try {
      await runFullETL();
    } catch (e) {
      logger.error('Scheduled ETL run failed', { error: (e as Error).message });
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('ETL scheduler started: runs daily + initial run in 30s');
}
