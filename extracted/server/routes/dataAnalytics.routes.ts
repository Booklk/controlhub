/**
 * Data Analytics Routes - أدوات التحليل المتقدمة
 * مركز التحكم - نادي سباقات الخيل (JCSA)
 * مسار مكتب إدارة البيانات
 */

import type { Express } from "express";
import {
  db, sql, authenticateToken, logger, cache,
  requirePortal, DMO_PORTALS, ADMIN_PORTALS, IT_DIRECTOR_PORTALS,
} from "./shared";
import { executeQuery, testConnection, type ConnectionConfig } from "../external-db";

export function registerDataAnalyticsRoutes(app: Express) {

  const ANALYTICS_PORTALS = [...new Set([...DMO_PORTALS, ...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS])];
  const ANALYST_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager', 'dmo_staff'];

  // ==================== 1. تنفيذ استعلام تحليلي على مصدر خارجي ====================
  app.post("/api/analytics/query", authenticateToken, requirePortal(ANALYTICS_PORTALS), async (req: any, res) => {
    try {
      if (!ANALYST_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية الاستعلام التحليلي مقتصرة على محللي البيانات' });
      }

      const { connectionId, query, maxRows = 500 } = req.body;
      if (!connectionId || !query) {
        return res.status(400).json({ error: 'معرف الاتصال والاستعلام مطلوبان' });
      }

      // حماية: منع أوامر التعديل
      const upperQuery = query.trim().toUpperCase();
      const FORBIDDEN = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE ', 'CREATE ', 'GRANT ', 'REVOKE '];
      if (FORBIDDEN.some((cmd: string) => upperQuery.startsWith(cmd))) {
        return res.status(403).json({ error: 'الاستعلامات التحليلية للقراءة فقط (SELECT)' });
      }

      // جلب اتصال من قاعدة البيانات
      const [connRow] = await db.execute(sql`
        SELECT id, database_type, host, port, database_name, username, encrypted_password
        FROM database_connections WHERE id = ${connectionId} AND deleted_at IS NULL
      `);
      const conn = (connRow as any).rows?.[0] || (connRow as any)[0];
      if (!conn) return res.status(404).json({ error: 'الاتصال غير موجود' });

      // فك تشفير كلمة المرور
      let password = '';
      try {
        const { decrypt: decryptPassword } = await import('../integrations/dataDiscoveryEngine');
        password = conn.encrypted_password ? decryptPassword(conn.encrypted_password) : '';
      } catch { /* use empty */ }

      const config: ConnectionConfig = {
        databaseType: conn.database_type,
        host: conn.host,
        port: conn.port || 3306,
        databaseName: conn.database_name,
        username: conn.username,
        password,
      };

      // إضافة LIMIT للحماية
      let safeQuery = query.trim();
      if (!upperQuery.includes('LIMIT') && maxRows > 0) {
        safeQuery = safeQuery.replace(/;?\s*$/, '') + ` LIMIT ${Math.min(maxRows, 1000)}`;
      }

      const startTime = Date.now();
      const rows = await executeQuery(config, safeQuery);
      const duration = Date.now() - startTime;

      // تسجيل الاستعلام
      await db.execute(sql`
        INSERT INTO dw_etl_log (run_type, status, records_processed, duration_ms, completed_at)
        VALUES (${'analytics_query'}, ${'success'}, ${rows.length}, ${duration}, NOW())
      `).catch(() => {});

      res.json({
        rows: rows.slice(0, maxRows),
        totalRows: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        duration,
        source: { name: conn.database_name, type: conn.database_type },
      });
    } catch (error) {
      logger.error('[Analytics] Query error:', { error: (error as Error).message });
      res.status(500).json({ error: `خطأ في تنفيذ الاستعلام: ${(error as Error).message}` });
    }
  });

  // ==================== 2. تحليل بروفايل جدول خارجي ====================
  app.post("/api/analytics/profile-table", authenticateToken, requirePortal(ANALYTICS_PORTALS), async (req: any, res) => {
    try {
      if (!ANALYST_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية' });
      }

      const { connectionId, tableName } = req.body;
      if (!connectionId || !tableName) {
        return res.status(400).json({ error: 'معرف الاتصال واسم الجدول مطلوبان' });
      }

      const [connRow] = await db.execute(sql`
        SELECT id, database_type, host, port, database_name, username, encrypted_password
        FROM database_connections WHERE id = ${connectionId} AND deleted_at IS NULL
      `);
      const conn = (connRow as any).rows?.[0] || (connRow as any)[0];
      if (!conn) return res.status(404).json({ error: 'الاتصال غير موجود' });

      let password = '';
      try {
        const { decrypt: decryptPassword } = await import('../integrations/dataDiscoveryEngine');
        password = conn.encrypted_password ? decryptPassword(conn.encrypted_password) : '';
      } catch { /* use empty */ }

      const config: ConnectionConfig = {
        databaseType: conn.database_type, host: conn.host,
        port: conn.port || 3306, databaseName: conn.database_name,
        username: conn.username, password,
      };

      // بناء استعلامات البروفايل حسب نوع قاعدة البيانات
      const safeTable = tableName.replace(/[^a-zA-Z0-9_.-]/g, '');
      const isPostgres = conn.database_type === 'postgresql';
      const isMysql = conn.database_type === 'mysql';

      // عدد الصفوف
      const countRows = await executeQuery(config, `SELECT COUNT(*) as total FROM ${safeTable}`);
      const totalRows = Number(countRows[0]?.total || countRows[0]?.count || 0);

      // أسماء وأنواع الأعمدة
      let columnsQuery = '';
      if (isPostgres) {
        columnsQuery = `SELECT column_name, data_type, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_name = '${safeTable}' ORDER BY ordinal_position`;
      } else if (isMysql) {
        columnsQuery = `SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable, CHARACTER_MAXIMUM_LENGTH as character_maximum_length FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${safeTable}' AND TABLE_SCHEMA = DATABASE() ORDER BY ORDINAL_POSITION`;
      } else {
        columnsQuery = `SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${safeTable}' ORDER BY ORDINAL_POSITION`;
      }
      const columns = await executeQuery(config, columnsQuery);

      // تحليل الأعمدة (أول 10 أعمدة)
      const columnProfiles = [];
      for (const col of columns.slice(0, 15)) {
        try {
          const colName = col.column_name;
          const profileQuery = `SELECT COUNT(*) as total, COUNT(${colName}) as non_null, COUNT(DISTINCT ${colName}) as distinct_values FROM ${safeTable}`;
          const [profile] = await executeQuery(config, profileQuery);
          columnProfiles.push({
            name: colName,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            totalRows,
            nonNull: Number(profile?.non_null || 0),
            nullCount: totalRows - Number(profile?.non_null || 0),
            nullPercent: totalRows > 0 ? Math.round(((totalRows - Number(profile?.non_null || 0)) / totalRows) * 100) : 0,
            distinctValues: Number(profile?.distinct_values || 0),
            uniqueness: totalRows > 0 ? Math.round((Number(profile?.distinct_values || 0) / totalRows) * 100) : 0,
          });
        } catch { /* skip column */ }
      }

      // عينة من البيانات
      const sampleRows = await executeQuery(config, `SELECT * FROM ${safeTable} LIMIT 5`);

      res.json({
        tableName: safeTable,
        source: { name: conn.database_name, type: conn.database_type, host: conn.host },
        totalRows,
        totalColumns: columns.length,
        columns: columnProfiles,
        sampleData: sampleRows,
        profiledAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Analytics] Profile error:', { error: (error as Error).message });
      res.status(500).json({ error: `خطأ في تحليل الجدول: ${(error as Error).message}` });
    }
  });

  // ==================== 3. مقارنة بين مصدرين ====================
  app.post("/api/analytics/compare-sources", authenticateToken, requirePortal(ANALYTICS_PORTALS), async (req: any, res) => {
    try {
      if (!ANALYST_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية' });
      }

      const { sourceA, sourceB } = req.body;
      if (!sourceA?.connectionId || !sourceB?.connectionId) {
        return res.status(400).json({ error: 'يجب تحديد مصدرين للمقارنة' });
      }

      const getSourceInfo = async (connectionId: number) => {
        const [r] = await db.execute(sql`
          SELECT dc.id, dc.name, dc.database_type, dc.host, dc.database_name,
            COUNT(DISTINCT dt.id)::int as tables_count,
            COALESCE(SUM(dt.row_count), 0)::bigint as total_rows,
            COUNT(DISTINCT dcol.id)::int as columns_count
          FROM database_connections dc
          LEFT JOIN discovered_tables dt ON dt.connection_id = dc.id
          LEFT JOIN discovered_columns dcol ON dcol.table_id = dt.id
          WHERE dc.id = ${connectionId}
          GROUP BY dc.id, dc.name, dc.database_type, dc.host, dc.database_name
        `);
        return (r as any).rows?.[0] || (r as any)[0] || null;
      };

      const [a, b] = await Promise.all([
        getSourceInfo(sourceA.connectionId),
        getSourceInfo(sourceB.connectionId),
      ]);

      if (!a || !b) return res.status(404).json({ error: 'أحد المصادر غير موجود' });

      res.json({
        sourceA: {
          name: a.name, type: a.database_type, host: a.host, database: a.database_name,
          tables: Number(a.tables_count) || 0, rows: Number(a.total_rows) || 0, columns: Number(a.columns_count) || 0,
        },
        sourceB: {
          name: b.name, type: b.database_type, host: b.host, database: b.database_name,
          tables: Number(b.tables_count) || 0, rows: Number(b.total_rows) || 0, columns: Number(b.columns_count) || 0,
        },
        comparison: {
          tablesDiff: (Number(a.tables_count) || 0) - (Number(b.tables_count) || 0),
          rowsDiff: (Number(a.total_rows) || 0) - (Number(b.total_rows) || 0),
          columnsDiff: (Number(a.columns_count) || 0) - (Number(b.columns_count) || 0),
          sameType: a.database_type === b.database_type,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في المقارنة' });
    }
  });

  // ==================== 4. تقرير جودة بيانات شامل ====================
  app.get("/api/analytics/quality-report", authenticateToken, requirePortal(ANALYTICS_PORTALS), async (req: any, res) => {
    try {
      const cacheKey = 'analytics_quality_report';
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          -- أصول البيانات
          (SELECT COUNT(*)::int FROM data_assets) as total_assets,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'top_secret') as top_secret,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'confidential') as confidential,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'restricted') as restricted_assets,
          (SELECT COUNT(*)::int FROM data_assets WHERE classification = 'public') as public_assets,
          (SELECT COUNT(*)::int FROM data_assets WHERE owner_id IS NOT NULL) as assets_with_owner,

          -- فهرس البيانات
          (SELECT COUNT(*)::int FROM database_connections WHERE deleted_at IS NULL) as total_connections,
          (SELECT COUNT(*)::int FROM database_connections WHERE status = 'connected') as connected,
          (SELECT COUNT(*)::int FROM discovered_tables) as discovered_tables,
          (SELECT COUNT(*)::int FROM discovered_columns) as discovered_columns,
          (SELECT COUNT(*)::int FROM data_flow_mappings) as data_flows,
          (SELECT COUNT(*)::int FROM data_lineage) as lineage_records,
          (SELECT COUNT(*)::int FROM data_dictionary) as dictionary_terms,

          -- المخاطر
          (SELECT COUNT(*)::int FROM data_risks) as total_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE risk_level = 'critical') as critical_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE risk_level = 'high') as high_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE risk_level = 'medium') as medium_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE risk_level = 'low') as low_risks,
          (SELECT COUNT(*)::int FROM data_risks WHERE mitigation_status = 'mitigated') as mitigated_risks,

          -- الاتفاقيات
          (SELECT COUNT(*)::int FROM data_agreements) as total_agreements,
          (SELECT COUNT(*)::int FROM data_agreements WHERE status = 'active') as active_agreements,
          (SELECT COUNT(*)::int FROM data_agreements WHERE status = 'expired') as expired_agreements,

          -- خصوصية
          (SELECT COUNT(*)::int FROM consent_records) as total_consents,
          (SELECT COUNT(*)::int FROM consent_records WHERE is_active = true) as active_consents,
          (SELECT COUNT(*)::int FROM data_breaches) as total_breaches,
          (SELECT COUNT(*)::int FROM data_breaches WHERE status IN ('open','investigating')) as active_breaches,
          (SELECT COUNT(*)::int FROM privacy_notices WHERE is_active = true) as active_notices,
          (SELECT COUNT(*)::int FROM processing_records) as processing_records
      `);
      const r = (result as any).rows?.[0] || (result as any)[0] || {};
      const totalAssets = Number(r.total_assets) || 1;
      const withOwner = Number(r.assets_with_owner) || 0;
      const totalRisks = Number(r.total_risks) || 1;
      const mitigated = Number(r.mitigated_risks) || 0;

      const data = {
        overallScore: Math.round(
          ((withOwner / totalAssets) * 25) +
          ((Number(r.discovered_tables) > 0 ? 25 : 0)) +
          ((mitigated / totalRisks) * 25) +
          ((Number(r.active_consents) > 0 ? 25 : 0))
        ),
        assets: {
          total: Number(r.total_assets) || 0,
          withOwner, ownershipRate: Math.round((withOwner / totalAssets) * 100),
          classification: {
            topSecret: Number(r.top_secret) || 0, confidential: Number(r.confidential) || 0,
            restricted: Number(r.restricted_assets) || 0, public: Number(r.public_assets) || 0,
          },
        },
        catalog: {
          connections: Number(r.total_connections) || 0, connected: Number(r.connected) || 0,
          tables: Number(r.discovered_tables) || 0, columns: Number(r.discovered_columns) || 0,
          flows: Number(r.data_flows) || 0, lineage: Number(r.lineage_records) || 0,
          dictionary: Number(r.dictionary_terms) || 0,
        },
        risks: {
          total: Number(r.total_risks) || 0,
          critical: Number(r.critical_risks) || 0, high: Number(r.high_risks) || 0,
          medium: Number(r.medium_risks) || 0, low: Number(r.low_risks) || 0,
          mitigated, mitigationRate: Math.round((mitigated / totalRisks) * 100),
        },
        agreements: {
          total: Number(r.total_agreements) || 0,
          active: Number(r.active_agreements) || 0, expired: Number(r.expired_agreements) || 0,
        },
        privacy: {
          consents: Number(r.total_consents) || 0, activeConsents: Number(r.active_consents) || 0,
          breaches: Number(r.total_breaches) || 0, activeBreaches: Number(r.active_breaches) || 0,
          notices: Number(r.active_notices) || 0, processingRecords: Number(r.processing_records) || 0,
        },
        generatedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      logger.error('[Analytics] Quality report error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تقرير الجودة' });
    }
  });

  // ==================== 5. إحصائيات الاستعلامات ====================
  app.get("/api/analytics/query-stats", authenticateToken, requirePortal(ANALYTICS_PORTALS), async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int as total_queries,
          COUNT(CASE WHEN status = 'success' THEN 1 END)::int as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed,
          COALESCE(AVG(duration_ms), 0)::int as avg_duration_ms,
          COALESCE(SUM(records_processed), 0)::bigint as total_records_processed
        FROM dw_etl_log
        WHERE run_type = 'analytics_query' AND started_at > NOW() - INTERVAL '30 days'
      `);
      const r = (result as any).rows?.[0] || (result as any)[0] || {};
      res.json({
        totalQueries: Number(r.total_queries) || 0,
        successful: Number(r.successful) || 0,
        failed: Number(r.failed) || 0,
        avgDurationMs: Number(r.avg_duration_ms) || 0,
        totalRecordsProcessed: Number(r.total_records_processed) || 0,
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

}
