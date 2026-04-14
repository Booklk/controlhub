import type { Express } from "express";
import { db, sql, authenticateToken, logger, requirePortal, ADMIN_PORTALS } from "./shared";

export function registerSystemMonitorRoutes(app: Express) {
  app.get("/api/system/health", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const start = Date.now();
      // Test DB connection
      const [dbTest] = await db.execute(sql`SELECT 1 as ok, NOW() as server_time, version() as pg_version`);
      const dbLatency = Date.now() - start;
      const dbRow = (dbTest as any).rows?.[0] || (dbTest as any)[0] || {};

      // System stats from DB
      const [stats] = await db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE is_active = true) as active_users,
          (SELECT COUNT(*)::int FROM sessions WHERE is_active = true) as active_sessions,
          (SELECT pg_database_size(current_database())::bigint) as db_size_bytes,
          (SELECT COUNT(*)::int FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour') as logs_last_hour,
          (SELECT COUNT(*)::int FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours') as logs_last_24h,
          (SELECT COUNT(*)::int FROM notifications WHERE is_read = false) as unread_notifications,
          (SELECT COUNT(*)::int FROM it_tickets WHERE status IN ('open','assigned','in_progress')) as open_tickets,
          (SELECT COUNT(*)::int FROM tasks WHERE status IN ('pending','in_progress') AND deleted_at IS NULL) as active_tasks,
          (SELECT COUNT(*)::int FROM dw_etl_log WHERE status = 'success' AND started_at > NOW() - INTERVAL '24 hours') as etl_runs_24h,
          (SELECT COUNT(*)::int FROM database_connections WHERE status = 'connected') as connected_sources
      `);
      const s = (stats as any).rows?.[0] || (stats as any)[0] || {};
      const dbSizeBytes = Number(s.db_size_bytes) || 0;
      const dbSizeMB = Math.round(dbSizeBytes / (1024 * 1024));

      res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: { status: 'connected', latencyMs: dbLatency, version: dbRow.pg_version?.split(' ')[1] || 'unknown', sizeMB: dbSizeMB, serverTime: dbRow.server_time },
        activity: { activeUsers: Number(s.active_users)||0, activeSessions: Number(s.active_sessions)||0, logsLastHour: Number(s.logs_last_hour)||0, logsLast24h: Number(s.logs_last_24h)||0, unreadNotifications: Number(s.unread_notifications)||0 },
        workload: { openTickets: Number(s.open_tickets)||0, activeTasks: Number(s.active_tasks)||0, etlRuns24h: Number(s.etl_runs_24h)||0, connectedSources: Number(s.connected_sources)||0 },
        uptime: process.uptime(),
        memory: { used: Math.round(process.memoryUsage().heapUsed / (1024*1024)), total: Math.round(process.memoryUsage().heapTotal / (1024*1024)) },
      });
    } catch (error) {
      res.status(500).json({ status: 'error', error: (error as Error).message });
    }
  });

  // Table sizes
  app.get("/api/system/table-sizes", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT tablename as name, pg_total_relation_size(quote_ident(tablename))::bigint as size_bytes,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.tablename)::int as columns
        FROM pg_tables t WHERE schemaname = 'public' ORDER BY size_bytes DESC LIMIT 30
      `);
      const rows = ((result as any).rows || result) as any[];
      res.json(rows.map((r: any) => ({ name: r.name, sizeMB: Math.round(Number(r.size_bytes)/(1024*1024)*100)/100, columns: Number(r.columns)||0 })));
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
  });

  // Error log
  app.get("/api/system/recent-errors", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, action, entity_type, error_message, outcome, severity, created_at
        FROM audit_logs WHERE outcome IN ('failure','error','denied') AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC LIMIT 50
      `);
      res.json((result as any).rows || result);
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
  });
}
