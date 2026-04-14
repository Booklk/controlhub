import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger as appLogger } from '../security-middleware';
const logger = { info: (m: string, d?: any) => appLogger.info(`[SmartAnalytics] ${m}`, d||{}), error: (m: string, d?: any) => appLogger.error(`[SmartAnalytics] ${m}`, d||{}) };

export async function detectAnomalies() {
  // Compare today's metrics with 7-day average
  const [r] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM it_tickets WHERE created_at::date = CURRENT_DATE) as tickets_today,
      (SELECT COALESCE(AVG(cnt), 0)::numeric(10,1) FROM (SELECT COUNT(*)::int as cnt FROM it_tickets WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY created_at::date) sub) as tickets_7d_avg,
      (SELECT COUNT(*)::int FROM tasks WHERE created_at::date = CURRENT_DATE AND deleted_at IS NULL) as tasks_today,
      (SELECT COALESCE(AVG(cnt), 0)::numeric(10,1) FROM (SELECT COUNT(*)::int as cnt FROM tasks WHERE created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL GROUP BY created_at::date) sub) as tasks_7d_avg,
      (SELECT COUNT(*)::int FROM security_incidents WHERE created_at::date = CURRENT_DATE) as incidents_today,
      (SELECT COUNT(*)::int FROM it_tickets WHERE sla_deadline < NOW() AND sla_deadline > NOW() - INTERVAL '24 hours' AND status NOT IN ('closed','resolved')) as new_sla_breaches
  `);
  const d = (r as any).rows?.[0] || (r as any)[0] || {};
  const anomalies: any[] = [];

  const ticketsToday = Number(d.tickets_today)||0;
  const ticketsAvg = Number(d.tickets_7d_avg)||1;
  if (ticketsToday > ticketsAvg * 1.5 && ticketsToday > 3) {
    anomalies.push({ type: 'spike', entity: 'tickets', severity: 'warning', message: `ارتفاع غير طبيعي في التذاكر: ${ticketsToday} اليوم مقابل معدل ${ticketsAvg} يومياً`, value: ticketsToday, average: ticketsAvg });
  }
  const tasksToday = Number(d.tasks_today)||0;
  const tasksAvg = Number(d.tasks_7d_avg)||1;
  if (tasksToday > tasksAvg * 1.5 && tasksToday > 3) {
    anomalies.push({ type: 'spike', entity: 'tasks', severity: 'warning', message: `ارتفاع غير طبيعي في المهام: ${tasksToday} مقابل معدل ${tasksAvg}`, value: tasksToday, average: tasksAvg });
  }
  if (Number(d.incidents_today) > 0) {
    anomalies.push({ type: 'security', entity: 'incidents', severity: 'critical', message: `${d.incidents_today} حادثة أمنية جديدة اليوم`, value: Number(d.incidents_today) });
  }
  if (Number(d.new_sla_breaches) > 0) {
    anomalies.push({ type: 'sla', entity: 'tickets', severity: 'high', message: `${d.new_sla_breaches} مخالفة SLA جديدة خلال 24 ساعة`, value: Number(d.new_sla_breaches) });
  }
  return anomalies;
}

export async function generatePredictions() {
  // Simple linear prediction based on last 4 weeks
  const [r] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::numeric FROM it_tickets WHERE created_at > NOW() - INTERVAL '7 days') as tickets_w1,
      (SELECT COUNT(*)::numeric FROM it_tickets WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days') as tickets_w2,
      (SELECT COUNT(*)::numeric FROM it_tickets WHERE created_at BETWEEN NOW() - INTERVAL '21 days' AND NOW() - INTERVAL '14 days') as tickets_w3,
      (SELECT COUNT(*)::numeric FROM tasks WHERE created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL) as tasks_w1,
      (SELECT COUNT(*)::numeric FROM tasks WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' AND deleted_at IS NULL) as tasks_w2
  `);
  const d = (r as any).rows?.[0] || (r as any)[0] || {};
  const tw1 = Number(d.tickets_w1)||0; const tw2 = Number(d.tickets_w2)||0; const tw3 = Number(d.tickets_w3)||0;
  const trend = ((tw1 - tw2) + (tw2 - tw3)) / 2;
  const predictedTickets = Math.max(0, Math.round(tw1 + trend));
  const taw1 = Number(d.tasks_w1)||0; const taw2 = Number(d.tasks_w2)||0;
  const taskTrend = taw1 - taw2;
  const predictedTasks = Math.max(0, Math.round(taw1 + taskTrend));

  return {
    nextWeek: {
      tickets: { predicted: predictedTickets, trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable', trendAr: trend > 0 ? 'متزايد' : trend < 0 ? 'متناقص' : 'مستقر', confidence: 70 },
      tasks: { predicted: predictedTasks, trend: taskTrend > 0 ? 'increasing' : 'stable', trendAr: taskTrend > 0 ? 'متزايد' : 'مستقر', confidence: 65 },
    },
    basedOn: 'تحليل آخر 3 أسابيع',
  };
}

export async function generateRecommendations() {
  const [r] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM it_tickets WHERE status IN ('open','assigned') AND created_at < NOW() - INTERVAL '48 hours') as stale_tickets,
      (SELECT COUNT(*)::int FROM tasks WHERE due_date < NOW() AND status NOT IN ('completed','cancelled') AND deleted_at IS NULL) as overdue_tasks,
      (SELECT COUNT(*)::int FROM it_tickets WHERE sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
      (SELECT COUNT(*)::int FROM security_vulnerabilities WHERE status IN ('open') AND severity IN ('critical','high')) as critical_vulns,
      (SELECT COUNT(*)::int FROM evidences WHERE status = 'pending' AND deleted_at IS NULL) as pending_evidence,
      (SELECT COUNT(*)::int FROM data_subject_requests WHERE status = 'pending') as pending_dsr,
      (SELECT COUNT(*)::int FROM escalations WHERE status = 'pending') as pending_escalations
  `);
  const d = (r as any).rows?.[0] || (r as any)[0] || {};
  const recs: any[] = [];

  if (Number(d.stale_tickets) > 0) recs.push({ priority: 'عالية', category: 'عمليات', icon: 'Ticket', message: `${d.stale_tickets} تذكرة مفتوحة أكثر من 48 ساعة — يُنصح بمراجعتها وإسنادها`, impact: 'تحسين وقت الاستجابة' });
  if (Number(d.overdue_tasks) > 0) recs.push({ priority: 'عالية', category: 'مهام', icon: 'Clock', message: `${d.overdue_tasks} مهمة متأخرة — يُنصح بإعادة جدولتها أو تصعيدها`, impact: 'تحسين نسبة الإنجاز' });
  if (Number(d.sla_breaches) > 0) recs.push({ priority: 'حرجة', category: 'SLA', icon: 'AlertTriangle', message: `${d.sla_breaches} مخالفة SLA نشطة — يلزم اتخاذ إجراء فوري`, impact: 'الحفاظ على مستوى الخدمة' });
  if (Number(d.critical_vulns) > 0) recs.push({ priority: 'حرجة', category: 'أمن', icon: 'Shield', message: `${d.critical_vulns} ثغرة أمنية حرجة/عالية مفتوحة — يلزم معالجتها فوراً`, impact: 'حماية الأصول الرقمية' });
  if (Number(d.pending_evidence) > 5) recs.push({ priority: 'متوسطة', category: 'امتثال', icon: 'FileCheck', message: `${d.pending_evidence} دليل بانتظار المراجعة — يُنصح بتسريع الاعتماد`, impact: 'رفع نسبة الامتثال' });
  if (Number(d.pending_dsr) > 0) recs.push({ priority: 'عالية', category: 'خصوصية', icon: 'Users', message: `${d.pending_dsr} طلب حقوق بيانات معلق — المدة النظامية 30 يوم`, impact: 'الامتثال لنظام PDPL' });
  if (Number(d.pending_escalations) > 0) recs.push({ priority: 'عالية', category: 'تصعيد', icon: 'ArrowUp', message: `${d.pending_escalations} تصعيد بانتظار المعالجة`, impact: 'رضا المستفيدين' });
  if (recs.length === 0) recs.push({ priority: 'معلومة', category: 'عام', icon: 'CheckCircle', message: 'لا توجد توصيات عاجلة — الأداء ضمن المعدل الطبيعي', impact: 'استمرار المراقبة' });
  return recs;
}
