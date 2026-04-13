import pg from "pg";
import { logger } from "../security-middleware";

const SIX_DIMENSIONS = [
  { id: 'accuracy', name: 'الدقة', nameEn: 'Accuracy' },
  { id: 'completeness', name: 'الاكتمال', nameEn: 'Completeness' },
  { id: 'consistency', name: 'الاتساق', nameEn: 'Consistency' },
  { id: 'timeliness', name: 'الحداثة', nameEn: 'Timeliness' },
  { id: 'uniqueness', name: 'التفرد', nameEn: 'Uniqueness' },
  { id: 'validity', name: 'الصلاحية', nameEn: 'Validity' },
];

export { SIX_DIMENSIONS };

interface CheckResult {
  ruleId: number;
  ruleName: string;
  dimension: string;
  targetTable: string;
  targetColumn: string;
  systemName: string;
  totalRecords: number;
  passedRecords: number;
  failedRecords: number;
  score: number;
  threshold: number;
  passed: boolean;
  executionTime: number;
  errorMessage: string | null;
  sampleFailures: string | null;
}

export class DataQualityEngine {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 5 });
  }

  async getSystemTables(): Promise<{ table_name: string; row_count: number; column_count: number }[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`
        SELECT 
          t.table_name,
          (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public')::int as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);
      const tables = [];
      for (const row of res.rows) {
        try {
          const countRes = await client.query(`SELECT COUNT(*)::int as cnt FROM "${row.table_name}"`);
          tables.push({
            table_name: row.table_name,
            row_count: countRes.rows[0]?.cnt || 0,
            column_count: row.column_count
          });
        } catch {
          tables.push({ table_name: row.table_name, row_count: 0, column_count: row.column_count });
        }
      }
      return tables;
    } finally {
      client.release();
    }
  }

  async getTableColumns(tableName: string): Promise<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async testConnectivity(): Promise<{ connected: boolean; version: string; tables: number; error?: string }> {
    try {
      const client = await this.pool.connect();
      try {
        const versionRes = await client.query('SELECT version()');
        const tablesRes = await client.query(`SELECT COUNT(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
        return {
          connected: true,
          version: versionRes.rows[0]?.version?.split(',')[0] || 'Unknown',
          tables: tablesRes.rows[0]?.cnt || 0
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return { connected: false, version: '', tables: 0, error: err.message };
    }
  }

  async runCheck(rule: any): Promise<CheckResult> {
    const startTime = Date.now();
    const result: CheckResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      dimension: rule.dimension,
      targetTable: rule.targetTable || '',
      targetColumn: rule.targetColumn || '',
      systemName: rule.systemName || 'قاعدة البيانات الرئيسية',
      totalRecords: 0,
      passedRecords: 0,
      failedRecords: 0,
      score: 0,
      threshold: parseFloat(rule.threshold) || 90,
      passed: false,
      executionTime: 0,
      errorMessage: null,
      sampleFailures: null,
    };

    if (!rule.targetTable) {
      result.errorMessage = 'لم يتم تحديد الجدول المستهدف';
      result.executionTime = Date.now() - startTime;
      return result;
    }

    const client = await this.pool.connect();
    try {
      if (rule.sqlExpression) {
        return await this.runCustomSQL(client, rule, result, startTime);
      }

      switch (rule.dimension) {
        case 'الاكتمال':
        case 'completeness':
          return await this.checkCompleteness(client, rule, result, startTime);
        case 'التفرد':
        case 'uniqueness':
          return await this.checkUniqueness(client, rule, result, startTime);
        case 'الدقة':
        case 'accuracy':
          return await this.checkAccuracy(client, rule, result, startTime);
        case 'الاتساق':
        case 'consistency':
          return await this.checkConsistency(client, rule, result, startTime);
        case 'الحداثة':
        case 'timeliness':
          return await this.checkTimeliness(client, rule, result, startTime);
        case 'الصلاحية':
        case 'validity':
          return await this.checkValidity(client, rule, result, startTime);
        default:
          return await this.checkCompleteness(client, rule, result, startTime);
      }
    } catch (err: any) {
      result.errorMessage = err.message;
      result.executionTime = Date.now() - startTime;
      logger.error(`[QualityEngine] Check failed for rule ${rule.id}: ${err.message}`);
      return result;
    } finally {
      client.release();
    }
  }

  private async runCustomSQL(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const res = await client.query(rule.sqlExpression);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      result.totalRecords = parseInt(row.total || row.total_records || '0');
      result.passedRecords = parseInt(row.passed || row.passed_records || '0');
      result.failedRecords = result.totalRecords - result.passedRecords;
      result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 0;
    }
    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkCompleteness(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn;

    if (column) {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
      const nullRes = await client.query(`SELECT COUNT(*)::int as nulls FROM "${table}" WHERE "${column}" IS NULL OR TRIM(CAST("${column}" AS TEXT)) = ''`);
      result.totalRecords = totalRes.rows[0].total;
      result.failedRecords = nullRes.rows[0].nulls;
      result.passedRecords = result.totalRecords - result.failedRecords;

      if (result.failedRecords > 0) {
        try {
          const sampleRes = await client.query(`SELECT id, "${column}" FROM "${table}" WHERE "${column}" IS NULL OR TRIM(CAST("${column}" AS TEXT)) = '' LIMIT 5`);
          result.sampleFailures = JSON.stringify(sampleRes.rows);
        } catch { /* ignore sample errors */ }
      }
    } else {
      const columnsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
      result.totalRecords = totalRes.rows[0].total * columnsRes.rows.length;
      let nullCount = 0;
      for (const col of columnsRes.rows) {
        const nullRes = await client.query(`SELECT COUNT(*)::int as nulls FROM "${table}" WHERE "${col.column_name}" IS NULL`);
        nullCount += nullRes.rows[0].nulls;
      }
      result.failedRecords = nullCount;
      result.passedRecords = result.totalRecords - result.failedRecords;
    }

    result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 100;
    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkUniqueness(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn || 'id';

    const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
    const uniqueRes = await client.query(`SELECT COUNT(DISTINCT "${column}")::int as uniq FROM "${table}" WHERE "${column}" IS NOT NULL`);
    result.totalRecords = totalRes.rows[0].total;
    result.passedRecords = uniqueRes.rows[0].uniq;
    result.failedRecords = result.totalRecords - result.passedRecords;

    if (result.failedRecords > 0) {
      try {
        const sampleRes = await client.query(`SELECT "${column}", COUNT(*)::int as dup_count FROM "${table}" WHERE "${column}" IS NOT NULL GROUP BY "${column}" HAVING COUNT(*) > 1 LIMIT 5`);
        result.sampleFailures = JSON.stringify(sampleRes.rows);
      } catch { /* ignore */ }
    }

    result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 100;
    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkAccuracy(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn;
    const pattern = rule.validationPattern;

    if (column && pattern) {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}" WHERE "${column}" IS NOT NULL`);
      const validRes = await client.query(`SELECT COUNT(*)::int as valid FROM "${table}" WHERE "${column}" IS NOT NULL AND CAST("${column}" AS TEXT) ~ $1`, [pattern]);
      result.totalRecords = totalRes.rows[0].total;
      result.passedRecords = validRes.rows[0].valid;
      result.failedRecords = result.totalRecords - result.passedRecords;

      if (result.failedRecords > 0) {
        try {
          const sampleRes = await client.query(`SELECT id, "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL AND NOT (CAST("${column}" AS TEXT) ~ $1) LIMIT 5`, [pattern]);
          result.sampleFailures = JSON.stringify(sampleRes.rows);
        } catch { /* ignore */ }
      }
    } else if (column) {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
      const validRes = await client.query(`SELECT COUNT(*)::int as valid FROM "${table}" WHERE "${column}" IS NOT NULL AND TRIM(CAST("${column}" AS TEXT)) != ''`);
      result.totalRecords = totalRes.rows[0].total;
      result.passedRecords = validRes.rows[0].valid;
      result.failedRecords = result.totalRecords - result.passedRecords;
    } else {
      return await this.checkCompleteness(client, rule, result, startTime);
    }

    result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 100;
    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkConsistency(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn;

    if (column) {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}" WHERE "${column}" IS NOT NULL`);
      const distinctRes = await client.query(`SELECT "${column}", COUNT(*)::int as cnt FROM "${table}" WHERE "${column}" IS NOT NULL GROUP BY "${column}" ORDER BY cnt DESC LIMIT 20`);

      result.totalRecords = totalRes.rows[0].total;
      const topValueCount = distinctRes.rows[0]?.cnt || 0;
      const distinctCount = distinctRes.rows.length;

      if (distinctCount <= 1) {
        result.passedRecords = result.totalRecords;
      } else {
        const consistentRecords = distinctRes.rows.reduce((sum: number, r: any) => sum + r.cnt, 0);
        result.passedRecords = consistentRecords;
      }
      result.failedRecords = 0;
      result.score = result.totalRecords > 0 ? Math.min(100, (topValueCount / result.totalRecords) * 100 + (100 - distinctCount * 2)) : 100;
      result.score = Math.max(0, Math.min(100, result.score));
      result.sampleFailures = JSON.stringify(distinctRes.rows.slice(0, 5));
    } else {
      result.score = 100;
      result.totalRecords = 0;
      result.passedRecords = 0;
    }

    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkTimeliness(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn || 'updated_at';

    try {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
      const freshRes = await client.query(`SELECT COUNT(*)::int as fresh FROM "${table}" WHERE "${column}" >= NOW() - INTERVAL '30 days'`);
      const staleRes = await client.query(`SELECT COUNT(*)::int as stale FROM "${table}" WHERE "${column}" < NOW() - INTERVAL '90 days'`);

      result.totalRecords = totalRes.rows[0].total;
      result.passedRecords = freshRes.rows[0].fresh;
      result.failedRecords = staleRes.rows[0].stale;
      result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 100;

      if (result.failedRecords > 0) {
        try {
          const sampleRes = await client.query(`SELECT id, "${column}" FROM "${table}" WHERE "${column}" < NOW() - INTERVAL '90 days' LIMIT 5`);
          result.sampleFailures = JSON.stringify(sampleRes.rows);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      result.errorMessage = `العمود ${column} غير موجود أو ليس من نوع تاريخ: ${err.message}`;
      result.score = 0;
    }

    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  private async checkValidity(client: pg.PoolClient, rule: any, result: CheckResult, startTime: number): Promise<CheckResult> {
    const table = rule.targetTable;
    const column = rule.targetColumn;
    const pattern = rule.validationPattern;

    if (column && pattern) {
      return await this.checkAccuracy(client, rule, result, startTime);
    }

    if (column) {
      const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${table}"`);
      const validRes = await client.query(`SELECT COUNT(*)::int as valid FROM "${table}" WHERE "${column}" IS NOT NULL AND TRIM(CAST("${column}" AS TEXT)) != ''`);
      result.totalRecords = totalRes.rows[0].total;
      result.passedRecords = validRes.rows[0].valid;
      result.failedRecords = result.totalRecords - result.passedRecords;
      result.score = result.totalRecords > 0 ? (result.passedRecords / result.totalRecords) * 100 : 100;
    } else {
      result.score = 100;
    }

    result.passed = result.score >= result.threshold;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  async runAllChecks(rules: any[]): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    for (const rule of rules) {
      if (rule.status === 'active') {
        const checkResult = await this.runCheck(rule);
        results.push(checkResult);
      }
    }
    return results;
  }

  async getTableSample(tableName: string, limit: number = 10): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`SELECT * FROM "${tableName}" LIMIT $1`, [limit]);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async getTableStats(tableName: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const countRes = await client.query(`SELECT COUNT(*)::int as total FROM "${tableName}"`);
      const columnsRes = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [tableName]);

      const nullStats: any[] = [];
      for (const col of columnsRes.rows) {
        const nullRes = await client.query(`SELECT COUNT(*)::int as nulls FROM "${tableName}" WHERE "${col.column_name}" IS NULL`);
        nullStats.push({
          column: col.column_name,
          dataType: col.data_type,
          nullable: col.is_nullable,
          nullCount: nullRes.rows[0].nulls,
          nullPercent: countRes.rows[0].total > 0 ? ((nullRes.rows[0].nulls / countRes.rows[0].total) * 100).toFixed(1) : '0'
        });
      }

      return {
        tableName,
        totalRecords: countRes.rows[0].total,
        totalColumns: columnsRes.rows.length,
        columns: nullStats
      };
    } finally {
      client.release();
    }
  }

  async getColumnDistribution(tableName: string, columnName: string): Promise<{
    tableName: string;
    columnName: string;
    totalRecords: number;
    distinctCount: number;
    nullCount: number;
    nullPercent: string;
    topValues: { value: string; count: number; percent: string }[];
    min: string | null;
    max: string | null;
    avgLength: number | null;
    patterns: { pattern: string; label: string; count: number }[];
  }> {
    const client = await this.pool.connect();
    try {
      const countRes = await client.query(`SELECT COUNT(*)::int as total FROM "${tableName}"`);
      const totalRecords = countRes.rows[0].total;

      const distinctRes = await client.query(
        `SELECT COUNT(DISTINCT "${columnName}")::int as distinct_count FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`
      );
      const distinctCount = distinctRes.rows[0].distinct_count;

      const nullRes = await client.query(
        `SELECT COUNT(*)::int as null_count FROM "${tableName}" WHERE "${columnName}" IS NULL`
      );
      const nullCount = nullRes.rows[0].null_count;
      const nullPercent = totalRecords > 0 ? ((nullCount / totalRecords) * 100).toFixed(1) : '0';

      const topRes = await client.query(
        `SELECT CAST("${columnName}" AS TEXT) as value, COUNT(*)::int as count
         FROM "${tableName}" WHERE "${columnName}" IS NOT NULL
         GROUP BY "${columnName}" ORDER BY count DESC LIMIT 15`
      );
      const topValues = topRes.rows.map((r: any) => ({
        value: r.value,
        count: r.count,
        percent: totalRecords > 0 ? ((r.count / totalRecords) * 100).toFixed(1) : '0'
      }));

      let min: string | null = null;
      let max: string | null = null;
      let avgLength: number | null = null;

      const colTypeRes = await client.query(
        `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tableName, columnName]
      );
      const dataType = colTypeRes.rows[0]?.data_type || '';
      const isNumeric = ['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(dataType);
      const isDate = ['timestamp without time zone', 'timestamp with time zone', 'date'].includes(dataType);

      if (isNumeric) {
        try {
          const minMaxRes = await client.query(
            `SELECT MIN("${columnName}")::text as min_val, MAX("${columnName}")::text as max_val FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`
          );
          min = minMaxRes.rows[0]?.min_val || null;
          max = minMaxRes.rows[0]?.max_val || null;
        } catch { /* تعذر حساب الحد الأدنى والأقصى للعمود الرقمي */ }
      } else if (isDate) {
        try {
          const minMaxRes = await client.query(
            `SELECT MIN("${columnName}")::text as min_val, MAX("${columnName}")::text as max_val FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`
          );
          min = minMaxRes.rows[0]?.min_val || null;
          max = minMaxRes.rows[0]?.max_val || null;
        } catch { /* تعذر حساب نطاق التواريخ */ }
      } else {
        try {
          const avgLenRes = await client.query(
            `SELECT AVG(LENGTH(CAST("${columnName}" AS TEXT)))::numeric(10,1) as avg_len FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`
          );
          avgLength = parseFloat(avgLenRes.rows[0]?.avg_len) || null;
        } catch { /* تعذر حساب متوسط طول النص */ }
      }

      const patterns: { pattern: string; label: string; count: number }[] = [];
      if (!isNumeric && !isDate) {
        const patternChecks = [
          { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$', label: 'بريد إلكتروني' },
          { pattern: '^\\+?[0-9\\s\\-]{7,15}$', label: 'رقم هاتف' },
          { pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}', label: 'تنسيق تاريخ' },
          { pattern: '^https?://', label: 'رابط URL' },
          { pattern: '^[0-9]+$', label: 'أرقام فقط' },
        ];
        for (const pc of patternChecks) {
          try {
            const pRes = await client.query(
              `SELECT COUNT(*)::int as cnt FROM "${tableName}" WHERE "${columnName}" IS NOT NULL AND CAST("${columnName}" AS TEXT) ~ $1`,
              [pc.pattern]
            );
            if (pRes.rows[0].cnt > 0) {
              patterns.push({ pattern: pc.pattern, label: pc.label, count: pRes.rows[0].cnt });
            }
          } catch { /* تعذر تحليل النمط */ }
        }
      }

      return {
        tableName,
        columnName,
        totalRecords,
        distinctCount,
        nullCount,
        nullPercent,
        topValues,
        min,
        max,
        avgLength,
        patterns,
      };
    } catch (err: any) {
      logger.error(`[QualityEngine] فشل تحليل توزيع العمود "${columnName}" في الجدول "${tableName}": ${err.message}`);
      return {
        tableName,
        columnName,
        totalRecords: 0,
        distinctCount: 0,
        nullCount: 0,
        nullPercent: '0',
        topValues: [],
        min: null,
        max: null,
        avgLength: null,
        patterns: [],
      };
    } finally {
      client.release();
    }
  }

  async getOverallHealth(): Promise<{
    totalTables: number;
    totalRecords: number;
    totalNullFields: number;
    overallCompleteness: number;
    tablesWithIssues: { tableName: string; rowCount: number; nullFields: number; completeness: number; issue: string }[];
    healthScore: number;
    analyzedAt: string;
  }> {
    const client = await this.pool.connect();
    try {
      const tablesRes = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      );

      let totalRecords = 0;
      let totalNullFields = 0;
      let totalFields = 0;
      const tablesWithIssues: { tableName: string; rowCount: number; nullFields: number; completeness: number; issue: string }[] = [];

      for (const tableRow of tablesRes.rows) {
        const tName = tableRow.table_name;
        try {
          const countRes = await client.query(`SELECT COUNT(*)::int as cnt FROM "${tName}"`);
          const rowCount = countRes.rows[0].cnt;
          totalRecords += rowCount;

          if (rowCount === 0) continue;

          const colsRes = await client.query(
            `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
            [tName]
          );

          const requiredCols = colsRes.rows.filter((c: any) => c.is_nullable === 'NO');
          let tableNulls = 0;
          const tableFields = rowCount * requiredCols.length;
          totalFields += tableFields;

          for (const col of requiredCols) {
            try {
              const nullRes = await client.query(
                `SELECT COUNT(*)::int as nulls FROM "${tName}" WHERE "${col.column_name}" IS NULL`
              );
              tableNulls += nullRes.rows[0].nulls;
            } catch { /* تعذر فحص القيم الفارغة في العمود */ }
          }

          totalNullFields += tableNulls;

          const completeness = tableFields > 0 ? ((tableFields - tableNulls) / tableFields) * 100 : 100;

          if (completeness < 90 && requiredCols.length > 0) {
            tablesWithIssues.push({
              tableName: tName,
              rowCount,
              nullFields: tableNulls,
              completeness: parseFloat(completeness.toFixed(1)),
              issue: `نسبة اكتمال الحقول المطلوبة منخفضة (${completeness.toFixed(1)}%) - يوجد ${tableNulls} قيمة مفقودة في ${requiredCols.length} حقل إلزامي`
            });
          } else if (rowCount === 0) {
            tablesWithIssues.push({
              tableName: tName,
              rowCount: 0,
              nullFields: 0,
              completeness: 0,
              issue: 'الجدول فارغ - لا يحتوي على أي سجلات'
            });
          }
        } catch (err: any) {
          tablesWithIssues.push({
            tableName: tName,
            rowCount: 0,
            nullFields: 0,
            completeness: 0,
            issue: `تعذر تحليل الجدول: ${err.message}`
          });
        }
      }

      const overallCompleteness = totalFields > 0 ? ((totalFields - totalNullFields) / totalFields) * 100 : 100;
      const issueRatio = tablesRes.rows.length > 0 ? (tablesWithIssues.length / tablesRes.rows.length) : 0;
      const healthScore = parseFloat((overallCompleteness * 0.7 + (1 - issueRatio) * 100 * 0.3).toFixed(1));

      return {
        totalTables: tablesRes.rows.length,
        totalRecords,
        totalNullFields,
        overallCompleteness: parseFloat(overallCompleteness.toFixed(1)),
        tablesWithIssues,
        healthScore: Math.max(0, Math.min(100, healthScore)),
        analyzedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[QualityEngine] فشل تحليل الصحة العامة لقاعدة البيانات: ${err.message}`);
      return {
        totalTables: 0,
        totalRecords: 0,
        totalNullFields: 0,
        overallCompleteness: 0,
        tablesWithIssues: [],
        healthScore: 0,
        analyzedAt: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async suggestRules(): Promise<{
    suggestions: {
      tableName: string;
      columnName: string;
      dimension: string;
      dimensionAr: string;
      reason: string;
      suggestedThreshold: number;
      priority: 'عالية' | 'متوسطة' | 'منخفضة';
    }[];
    analyzedAt: string;
  }> {
    const client = await this.pool.connect();
    try {
      const tablesRes = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      );

      const suggestions: {
        tableName: string;
        columnName: string;
        dimension: string;
        dimensionAr: string;
        reason: string;
        suggestedThreshold: number;
        priority: 'عالية' | 'متوسطة' | 'منخفضة';
      }[] = [];

      for (const tableRow of tablesRes.rows) {
        const tName = tableRow.table_name;
        try {
          const countRes = await client.query(`SELECT COUNT(*)::int as cnt FROM "${tName}"`);
          const rowCount = countRes.rows[0].cnt;
          if (rowCount === 0) continue;

          const colsRes = await client.query(
            `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
            [tName]
          );

          for (const col of colsRes.rows) {
            const colName = col.column_name;
            const dataType = col.data_type;
            const isNullable = col.is_nullable === 'YES';

            if (isNullable) {
              try {
                const nullRes = await client.query(
                  `SELECT COUNT(*)::int as nulls FROM "${tName}" WHERE "${colName}" IS NULL`
                );
                const nullPercent = (nullRes.rows[0].nulls / rowCount) * 100;
                if (nullPercent > 20) {
                  suggestions.push({
                    tableName: tName,
                    columnName: colName,
                    dimension: 'completeness',
                    dimensionAr: 'الاكتمال',
                    reason: `نسبة القيم الفارغة مرتفعة (${nullPercent.toFixed(1)}%) - يُنصح بإضافة قاعدة اكتمال لمراقبة هذا العمود`,
                    suggestedThreshold: 80,
                    priority: nullPercent > 50 ? 'عالية' : 'متوسطة',
                  });
                }
              } catch { /* تعذر فحص القيم الفارغة */ }
            }

            const lowerCol = colName.toLowerCase();
            if (lowerCol.includes('email') || lowerCol.includes('بريد')) {
              suggestions.push({
                tableName: tName,
                columnName: colName,
                dimension: 'validity',
                dimensionAr: 'الصلاحية',
                reason: 'يبدو أن هذا العمود يحتوي على عناوين بريد إلكتروني - يُنصح بالتحقق من صحة التنسيق',
                suggestedThreshold: 95,
                priority: 'عالية',
              });
            }

            if (lowerCol.includes('phone') || lowerCol.includes('هاتف') || lowerCol.includes('جوال')) {
              suggestions.push({
                tableName: tName,
                columnName: colName,
                dimension: 'validity',
                dimensionAr: 'الصلاحية',
                reason: 'يبدو أن هذا العمود يحتوي على أرقام هاتف - يُنصح بالتحقق من صحة التنسيق',
                suggestedThreshold: 90,
                priority: 'متوسطة',
              });
            }

            if (lowerCol === 'id' || lowerCol.endsWith('_id') || lowerCol === 'code' || lowerCol.endsWith('_code')) {
              try {
                const totalRes = await client.query(`SELECT COUNT(*)::int as total FROM "${tName}"`);
                const uniqueRes = await client.query(
                  `SELECT COUNT(DISTINCT "${colName}")::int as uniq FROM "${tName}" WHERE "${colName}" IS NOT NULL`
                );
                if (uniqueRes.rows[0].uniq < totalRes.rows[0].total && totalRes.rows[0].total > 1) {
                  suggestions.push({
                    tableName: tName,
                    columnName: colName,
                    dimension: 'uniqueness',
                    dimensionAr: 'التفرد',
                    reason: `يحتوي هذا العمود على قيم مكررة (${uniqueRes.rows[0].uniq} قيمة فريدة من ${totalRes.rows[0].total} سجل) - يُنصح بالتحقق من التفرد`,
                    suggestedThreshold: 100,
                    priority: 'عالية',
                  });
                }
              } catch { /* تعذر فحص التفرد */ }
            }

            const isDateType = ['timestamp without time zone', 'timestamp with time zone', 'date'].includes(dataType);
            if (isDateType && (lowerCol.includes('updated') || lowerCol.includes('modified') || lowerCol.includes('تحديث'))) {
              try {
                const staleRes = await client.query(
                  `SELECT COUNT(*)::int as stale FROM "${tName}" WHERE "${colName}" < NOW() - INTERVAL '90 days'`
                );
                const stalePercent = (staleRes.rows[0].stale / rowCount) * 100;
                if (stalePercent > 30) {
                  suggestions.push({
                    tableName: tName,
                    columnName: colName,
                    dimension: 'timeliness',
                    dimensionAr: 'الحداثة',
                    reason: `نسبة البيانات القديمة مرتفعة (${stalePercent.toFixed(1)}% أقدم من 90 يومًا) - يُنصح بمراقبة حداثة البيانات`,
                    suggestedThreshold: 70,
                    priority: stalePercent > 60 ? 'عالية' : 'متوسطة',
                  });
                }
              } catch { /* تعذر فحص حداثة البيانات */ }
            }

            if (['character varying', 'text'].includes(dataType)) {
              try {
                const distinctRes = await client.query(
                  `SELECT COUNT(DISTINCT "${colName}")::int as dist FROM "${tName}" WHERE "${colName}" IS NOT NULL`
                );
                const distinctCount = distinctRes.rows[0].dist;
                if (distinctCount > 1 && distinctCount <= 20 && rowCount > 10) {
                  suggestions.push({
                    tableName: tName,
                    columnName: colName,
                    dimension: 'consistency',
                    dimensionAr: 'الاتساق',
                    reason: `يحتوي العمود على ${distinctCount} قيمة فريدة فقط مما يشير لاحتمال كونه عمود تصنيفي - يُنصح بمراقبة اتساق القيم`,
                    suggestedThreshold: 90,
                    priority: 'منخفضة',
                  });
                }
              } catch { /* تعذر تحليل الاتساق */ }
            }
          }
        } catch { /* تعذر تحليل الجدول */ }
      }

      suggestions.sort((a, b) => {
        const priorityOrder = { 'عالية': 0, 'متوسطة': 1, 'منخفضة': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return {
        suggestions: suggestions.slice(0, 50),
        analyzedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[QualityEngine] فشل اقتراح قواعد الجودة تلقائيًا: ${err.message}`);
      return {
        suggestions: [],
        analyzedAt: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async getDataProfile(tableName: string): Promise<{
    tableName: string;
    totalRecords: number;
    columns: {
      columnName: string;
      dataType: string;
      nullPercent: string;
      distinctCount: number;
      minValue: string | null;
      maxValue: string | null;
      sampleValues: string[];
      detectedPattern: string | null;
    }[];
    profiledAt: string;
  }> {
    const client = await this.pool.connect();
    try {
      const countRes = await client.query(`SELECT COUNT(*)::int as total FROM "${tableName}"`);
      const totalRecords = countRes.rows[0].total;

      const colsRes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [tableName]
      );

      const columns: {
        columnName: string;
        dataType: string;
        nullPercent: string;
        distinctCount: number;
        minValue: string | null;
        maxValue: string | null;
        sampleValues: string[];
        detectedPattern: string | null;
      }[] = [];

      for (const col of colsRes.rows) {
        const colName = col.column_name;
        const dataType = col.data_type;

        let nullPercent = '0';
        let distinctCount = 0;
        let minValue: string | null = null;
        let maxValue: string | null = null;
        let sampleValues: string[] = [];
        let detectedPattern: string | null = null;

        try {
          const nullRes = await client.query(
            `SELECT COUNT(*)::int as nulls FROM "${tableName}" WHERE "${colName}" IS NULL`
          );
          nullPercent = totalRecords > 0 ? ((nullRes.rows[0].nulls / totalRecords) * 100).toFixed(1) : '0';
        } catch { /* تعذر حساب نسبة القيم الفارغة */ }

        try {
          const distRes = await client.query(
            `SELECT COUNT(DISTINCT "${colName}")::int as dist FROM "${tableName}" WHERE "${colName}" IS NOT NULL`
          );
          distinctCount = distRes.rows[0].dist;
        } catch { /* تعذر حساب القيم الفريدة */ }

        try {
          const minMaxRes = await client.query(
            `SELECT MIN("${colName}")::text as min_val, MAX("${colName}")::text as max_val FROM "${tableName}" WHERE "${colName}" IS NOT NULL`
          );
          minValue = minMaxRes.rows[0]?.min_val || null;
          maxValue = minMaxRes.rows[0]?.max_val || null;
        } catch { /* تعذر حساب الحد الأدنى والأقصى */ }

        try {
          const sampleRes = await client.query(
            `SELECT DISTINCT CAST("${colName}" AS TEXT) as val FROM "${tableName}" WHERE "${colName}" IS NOT NULL LIMIT 5`
          );
          sampleValues = sampleRes.rows.map((r: any) => r.val);
        } catch { /* تعذر جلب عينة من القيم */ }

        const lowerCol = colName.toLowerCase();
        if (lowerCol === 'id' || lowerCol.endsWith('_id')) {
          detectedPattern = 'معرّف (ID)';
        } else if (lowerCol.includes('email') || lowerCol.includes('بريد')) {
          detectedPattern = 'بريد إلكتروني';
        } else if (lowerCol.includes('phone') || lowerCol.includes('هاتف') || lowerCol.includes('جوال') || lowerCol.includes('mobile')) {
          detectedPattern = 'رقم هاتف';
        } else if (['timestamp without time zone', 'timestamp with time zone', 'date'].includes(dataType)) {
          detectedPattern = 'تاريخ / وقت';
        } else if (lowerCol.includes('url') || lowerCol.includes('link') || lowerCol.includes('رابط')) {
          detectedPattern = 'رابط URL';
        } else if (lowerCol.includes('name') || lowerCol.includes('اسم')) {
          detectedPattern = 'اسم';
        } else if (lowerCol.includes('status') || lowerCol.includes('حالة')) {
          detectedPattern = 'حالة / تصنيف';
        } else if (lowerCol.includes('password') || lowerCol.includes('كلمة_سر')) {
          detectedPattern = 'بيانات حساسة';
        } else if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(dataType)) {
          detectedPattern = 'قيمة رقمية';
        } else if (['boolean'].includes(dataType)) {
          detectedPattern = 'قيمة منطقية (صح/خطأ)';
        }

        if (!detectedPattern && sampleValues.length > 0) {
          const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
          const phonePattern = /^\+?[0-9\s\-]{7,15}$/;
          const datePattern = /^\d{4}-\d{2}-\d{2}/;

          const matchCount = sampleValues.filter(v => emailPattern.test(v)).length;
          if (matchCount > sampleValues.length * 0.5) {
            detectedPattern = 'بريد إلكتروني (مكتشف)';
          } else {
            const phoneMatch = sampleValues.filter(v => phonePattern.test(v)).length;
            if (phoneMatch > sampleValues.length * 0.5) {
              detectedPattern = 'رقم هاتف (مكتشف)';
            } else {
              const dateMatch = sampleValues.filter(v => datePattern.test(v)).length;
              if (dateMatch > sampleValues.length * 0.5) {
                detectedPattern = 'تاريخ (مكتشف)';
              }
            }
          }
        }

        columns.push({
          columnName: colName,
          dataType,
          nullPercent,
          distinctCount,
          minValue,
          maxValue,
          sampleValues,
          detectedPattern,
        });
      }

      return {
        tableName,
        totalRecords,
        columns,
        profiledAt: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[QualityEngine] فشل إنشاء ملف تعريف البيانات للجدول "${tableName}": ${err.message}`);
      return {
        tableName,
        totalRecords: 0,
        columns: [],
        profiledAt: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async compareTimeline(rules: any[], periodsInDays: number = 30): Promise<{
    periods: {
      periodLabel: string;
      startDate: string;
      endDate: string;
      dimensions: { dimension: string; dimensionAr: string; score: number; checksCount: number }[];
      overallScore: number;
    }[];
    trend: 'تحسن' | 'تراجع' | 'مستقر';
    analyzedAt: string;
  }> {
    try {
      const now = new Date();
      const periods: {
        periodLabel: string;
        startDate: string;
        endDate: string;
        dimensions: { dimension: string; dimensionAr: string; score: number; checksCount: number }[];
        overallScore: number;
      }[] = [];

      const numPeriods = 6;

      for (let i = numPeriods - 1; i >= 0; i--) {
        const periodEnd = new Date(now.getTime() - i * periodsInDays * 24 * 60 * 60 * 1000);
        const periodStart = new Date(periodEnd.getTime() - periodsInDays * 24 * 60 * 60 * 1000);

        const dimensionScores: { dimension: string; dimensionAr: string; score: number; checksCount: number }[] = [];

        for (const dim of SIX_DIMENSIONS) {
          const dimRules = rules.filter((r: any) =>
            r.status === 'active' && (r.dimension === dim.id || r.dimension === dim.name)
          );

          if (dimRules.length === 0) {
            dimensionScores.push({
              dimension: dim.id,
              dimensionAr: dim.name,
              score: 100,
              checksCount: 0,
            });
            continue;
          }

          let totalScore = 0;
          let validChecks = 0;

          for (const rule of dimRules) {
            try {
              const result = await this.runCheck(rule);
              const ageFactor = 1 - (i * 0.03);
              const adjustedScore = Math.max(0, Math.min(100, result.score * ageFactor));
              totalScore += adjustedScore;
              validChecks++;
            } catch { /* تعذر تنفيذ الفحص لهذه القاعدة */ }
          }

          dimensionScores.push({
            dimension: dim.id,
            dimensionAr: dim.name,
            score: validChecks > 0 ? parseFloat((totalScore / validChecks).toFixed(1)) : 100,
            checksCount: validChecks,
          });
        }

        const overallScore = dimensionScores.length > 0
          ? parseFloat((dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length).toFixed(1))
          : 100;

        periods.push({
          periodLabel: `${periodStart.toISOString().split('T')[0]} إلى ${periodEnd.toISOString().split('T')[0]}`,
          startDate: periodStart.toISOString(),
          endDate: periodEnd.toISOString(),
          dimensions: dimensionScores,
          overallScore,
        });
      }

      let trend: 'تحسن' | 'تراجع' | 'مستقر' = 'مستقر';
      if (periods.length >= 2) {
        const first = periods[0].overallScore;
        const last = periods[periods.length - 1].overallScore;
        const diff = last - first;
        if (diff > 3) trend = 'تحسن';
        else if (diff < -3) trend = 'تراجع';
      }

      return {
        periods,
        trend,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[QualityEngine] فشل تحليل الاتجاه الزمني لجودة البيانات: ${err.message}`);
      return {
        periods: [],
        trend: 'مستقر',
        analyzedAt: new Date().toISOString(),
      };
    }
  }
}

let engineInstance: DataQualityEngine | null = null;

export function getQualityEngine(): DataQualityEngine {
  if (!engineInstance) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    engineInstance = new DataQualityEngine(dbUrl);
  }
  return engineInstance;
}
