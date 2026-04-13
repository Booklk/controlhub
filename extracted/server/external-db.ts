/**
 * External Database Connection Service
 * خدمة الاتصال بقواعد البيانات الخارجية
 * نادي سباقات الخيل
 */

import mysql from 'mysql2/promise';
import sql from 'mssql';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { Client as ElasticClient } from '@elastic/elasticsearch';

export interface ConnectionConfig {
  databaseType: 'mysql' | 'postgresql' | 'sqlserver' | 'oracle' | 'mongodb' | 'redis' | 'elasticsearch';
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslEnabled?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  serverVersion?: string;
  error?: string;
}

export interface TableInfo {
  tableName: string;
  tableType: string;
  estimatedRows: number;
  columns: ColumnInfo[];
  primaryKey?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

/**
 * Test connection to external database
 */
export async function testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  
  try {
    switch (config.databaseType) {
      case 'mysql':
        return await testMySQLConnection(config, startTime);
      case 'sqlserver':
        return await testSQLServerConnection(config, startTime);
      case 'postgresql':
        return await testPostgreSQLConnection(config, startTime);
      case 'oracle':
        return await testOracleConnection(config, startTime);
      case 'mongodb':
        return await testMongoDBConnection(config, startTime);
      case 'redis':
        return await testRedisConnection(config, startTime);
      case 'elasticsearch':
        return await testElasticsearchConnection(config, startTime);
      default:
        return { success: false, message: 'نوع قاعدة البيانات غير مدعوم', error: 'UNKNOWN_TYPE' };
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'فشل الاتصال',
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test MySQL connection
 */
async function testMySQLConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  let connection: mysql.Connection | null = null;
  
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.databaseName,
      user: config.username,
      password: config.password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000,
    });
    
    const [rows] = await connection.query('SELECT VERSION() as version');
    const version = (rows as any)[0]?.version || 'Unknown';
    
    await connection.end();
    
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: version,
    };
  } catch (error: any) {
    if (connection) {
      try { await connection.end(); } catch {}
    }
    
    let message = 'فشل الاتصال';
    if (error.code === 'ECONNREFUSED') {
      message = 'رفض الاتصال - تأكد من أن الخادم يعمل والمنفذ صحيح';
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      message = 'قاعدة البيانات غير موجودة';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'انتهت مهلة الاتصال - تأكد من إمكانية الوصول للخادم';
    }
    
    return {
      success: false,
      message,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test SQL Server connection
 */
async function testSQLServerConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  try {
    const sqlConfig: sql.config = {
      server: config.host,
      port: config.port,
      database: config.databaseName,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.sslEnabled || false,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    };
    
    const pool = await sql.connect(sqlConfig);
    const result = await pool.query`SELECT @@VERSION as version`;
    const version = result.recordset[0]?.version?.split('\n')[0] || 'Unknown';
    
    await pool.close();
    
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: version,
    };
  } catch (error: any) {
    let message = 'فشل الاتصال';
    if (error.code === 'ESOCKET') {
      message = 'رفض الاتصال - تأكد من أن الخادم يعمل والمنفذ صحيح';
    } else if (error.code === 'ELOGIN') {
      message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    }
    
    return {
      success: false,
      message,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Discover tables from external database
 */
export async function discoverTables(config: ConnectionConfig): Promise<TableInfo[]> {
  switch (config.databaseType) {
    case 'mysql':
      return await discoverMySQLTables(config);
    case 'postgresql':
      return await discoverPostgreSQLTables(config);
    case 'sqlserver':
      return await discoverSQLServerTables(config);
    case 'oracle':
      return await discoverOracleTables(config);
    case 'mongodb':
      return await discoverMongoDBCollections(config);
    case 'redis':
      return await discoverRedisKeys(config);
    case 'elasticsearch':
      return await discoverElasticsearchIndices(config);
    default:
      throw new Error('نوع قاعدة البيانات غير مدعوم للاكتشاف التلقائي');
  }
}

/**
 * Discover MySQL tables
 */
async function discoverMySQLTables(config: ConnectionConfig): Promise<TableInfo[]> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    const [tables] = await connection.query(`
      SELECT 
        TABLE_NAME as tableName,
        TABLE_TYPE as tableType,
        TABLE_ROWS as estimatedRows
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [config.databaseName]);
    
    const result: TableInfo[] = [];
    
    for (const table of tables as any[]) {
      const [columns] = await connection.query(`
        SELECT 
          COLUMN_NAME as name,
          DATA_TYPE as type,
          IS_NULLABLE as nullable,
          COLUMN_DEFAULT as defaultValue,
          COLUMN_KEY as columnKey
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [config.databaseName, table.tableName]);
      
      const [primaryKeys] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
      `, [config.databaseName, table.tableName]);
      
      result.push({
        tableName: table.tableName,
        tableType: table.tableType === 'BASE TABLE' ? 'table' : 'view',
        estimatedRows: table.estimatedRows || 0,
        columns: (columns as any[]).map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable === 'YES',
          defaultValue: col.defaultValue,
          isPrimaryKey: col.columnKey === 'PRI',
          isForeignKey: col.columnKey === 'MUL',
        })),
        primaryKey: (primaryKeys as any[])[0]?.COLUMN_NAME,
      });
    }
    
    await connection.end();
    return result;
    
  } catch (error) {
    await connection.end();
    throw error;
  }
}

/**
 * Discover SQL Server tables
 */
async function discoverSQLServerTables(config: ConnectionConfig): Promise<TableInfo[]> {
  const sqlConfig: sql.config = {
    server: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    options: {
      encrypt: config.sslEnabled || false,
      trustServerCertificate: true,
    },
  };
  
  const pool = await sql.connect(sqlConfig);
  
  try {
    const tablesResult = await pool.query`
      SELECT 
        t.TABLE_NAME as tableName,
        t.TABLE_TYPE as tableType,
        p.rows as estimatedRows
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.partitions p ON OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME) = p.object_id AND p.index_id IN (0,1)
      WHERE t.TABLE_SCHEMA = 'dbo'
      ORDER BY t.TABLE_NAME
    `;
    
    const result: TableInfo[] = [];
    
    for (const table of tablesResult.recordset) {
      const columnsResult = await pool.request()
        .input('tableName', sql.VarChar, table.tableName)
        .query(`
          SELECT 
            COLUMN_NAME as name,
            DATA_TYPE as type,
            IS_NULLABLE as nullable,
            COLUMN_DEFAULT as defaultValue
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `);
      
      result.push({
        tableName: table.tableName,
        tableType: table.tableType === 'BASE TABLE' ? 'table' : 'view',
        estimatedRows: table.estimatedRows || 0,
        columns: columnsResult.recordset.map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable === 'YES',
          defaultValue: col.defaultValue,
          isPrimaryKey: false,
          isForeignKey: false,
        })),
      });
    }
    
    await pool.close();
    return result;
    
  } catch (error) {
    await pool.close();
    throw error;
  }
}

/**
 * Test PostgreSQL connection
 */
async function testPostgreSQLConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    const version = result.rows[0]?.version?.split(',')[0] || 'Unknown';
    await client.end();

    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: version,
    };
  } catch (error: any) {
    try { await client.end(); } catch {}

    let message = 'فشل الاتصال';
    if (error.code === 'ECONNREFUSED') {
      message = 'رفض الاتصال - تأكد من أن الخادم يعمل والمنفذ صحيح';
    } else if (error.code === '28P01') {
      message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    } else if (error.code === '3D000') {
      message = 'قاعدة البيانات غير موجودة';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'انتهت مهلة الاتصال - تأكد من إمكانية الوصول للخادم';
    }

    return {
      success: false,
      message,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Discover PostgreSQL tables with columns, keys, and relationships
 */
async function discoverPostgreSQLTables(config: ConnectionConfig): Promise<TableInfo[]> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const schemaName = 'public';

    const tablesRes = await client.query(`
      SELECT
        t.table_name as "tableName",
        t.table_type as "tableType",
        COALESCE(s.n_live_tup, 0)::int as "estimatedRows"
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
      WHERE t.table_schema = $1 AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_name
    `, [schemaName]);

    const result: TableInfo[] = [];

    for (const table of tablesRes.rows) {
      const columnsRes = await client.query(`
        SELECT
          c.column_name as name,
          c.data_type as type,
          c.is_nullable as nullable,
          c.column_default as "defaultValue",
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPrimaryKey",
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as "isForeignKey"
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name FROM information_schema.key_column_usage ku
          JOIN information_schema.table_constraints tc
            ON ku.constraint_name = tc.constraint_name AND ku.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY' AND ku.table_name = $1 AND ku.table_schema = $2
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT ku.column_name FROM information_schema.key_column_usage ku
          JOIN information_schema.table_constraints tc
            ON ku.constraint_name = tc.constraint_name AND ku.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND ku.table_name = $1 AND ku.table_schema = $2
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1 AND c.table_schema = $2
        ORDER BY c.ordinal_position
      `, [table.tableName, schemaName]);

      const pkRes = await client.query(`
        SELECT ku.column_name
        FROM information_schema.key_column_usage ku
        JOIN information_schema.table_constraints tc
          ON ku.constraint_name = tc.constraint_name AND ku.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND ku.table_name = $1 AND ku.table_schema = $2
      `, [table.tableName, schemaName]);

      result.push({
        tableName: table.tableName,
        tableType: table.tableType === 'BASE TABLE' ? 'table' : 'view',
        estimatedRows: table.estimatedRows || 0,
        columns: columnsRes.rows.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable === 'YES',
          defaultValue: col.defaultValue,
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: col.isForeignKey,
        })),
        primaryKey: pkRes.rows[0]?.column_name,
      });
    }

    await client.end();
    return result;
  } catch (error) {
    try { await client.end(); } catch {}
    throw error;
  }
}

/**
 * Test Oracle DB connection (using JDBC-compatible approach via thin driver)
 */
async function testOracleConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  try {
    let oracledb: any;
    try {
      // @ts-ignore — oracledb is optional; installed only on servers with Oracle Instant Client
      oracledb = await import('oracledb');
    } catch {
      return {
        success: false,
        message: 'Oracle DB يتطلب تثبيت Oracle Instant Client — يرجى تثبيته على الخادم وإضافة مكتبة oracledb',
        error: 'ORACLE_CLIENT_MISSING',
        responseTime: Date.now() - startTime,
      };
    }
    oracledb.initOracleClient?.();
    const conn = await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectString: `${config.host}:${config.port}/${config.databaseName}`,
    });
    const result = await conn.execute('SELECT * FROM v$version WHERE ROWNUM = 1');
    const version = result?.rows?.[0]?.[0] || 'Oracle DB';
    await conn.close();
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: version,
    };
  } catch (error: any) {
    let message = 'فشل الاتصال بـ Oracle DB';
    if (error.message?.includes('ORA-01017')) message = 'اسم المستخدم أو كلمة المرور غير صحيحة (ORA-01017)';
    else if (error.message?.includes('ORA-12541')) message = 'الخادم غير متاح — تحقق من عنوان الخادم والمنفذ (ORA-12541)';
    else if (error.message?.includes('ORA-12154')) message = 'اسم خدمة Oracle غير صحيح (ORA-12154)';
    else if (error.code === 'ECONNREFUSED') message = 'رفض الاتصال — تأكد من أن Oracle Listener يعمل';
    return {
      success: false,
      message,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Discover Oracle tables
 */
async function discoverOracleTables(config: ConnectionConfig): Promise<TableInfo[]> {
  let oracledb: any;
  try {
    // @ts-ignore — oracledb is optional; installed only on servers with Oracle Instant Client
    oracledb = await import('oracledb');
  } catch {
    throw new Error('Oracle Instant Client غير مثبت — لا يمكن اكتشاف الجداول');
  }
  const conn = await oracledb.getConnection({
    user: config.username,
    password: config.password,
    connectString: `${config.host}:${config.port}/${config.databaseName}`,
  });
  try {
    const tablesResult = await conn.execute(
      `SELECT table_name, num_rows FROM user_tables ORDER BY table_name`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const tables: TableInfo[] = [];
    for (const row of tablesResult.rows || []) {
      const tableName = row.TABLE_NAME;
      const colResult = await conn.execute(
        `SELECT column_name, data_type, nullable, data_default,
           CASE WHEN column_name IN (SELECT column_name FROM user_cons_columns ucc
             JOIN user_constraints uc ON ucc.constraint_name = uc.constraint_name
             WHERE uc.constraint_type = 'P' AND ucc.table_name = :tn) THEN 1 ELSE 0 END as is_pk,
           CASE WHEN column_name IN (SELECT column_name FROM user_cons_columns ucc
             JOIN user_constraints uc ON ucc.constraint_name = uc.constraint_name
             WHERE uc.constraint_type = 'R' AND ucc.table_name = :tn) THEN 1 ELSE 0 END as is_fk
         FROM user_tab_columns WHERE table_name = :tn ORDER BY column_id`,
        { tn: tableName }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const columns: ColumnInfo[] = (colResult.rows || []).map((c: any) => ({
        name: c.COLUMN_NAME,
        type: c.DATA_TYPE,
        nullable: c.NULLABLE === 'Y',
        defaultValue: c.DATA_DEFAULT,
        isPrimaryKey: c.IS_PK === 1,
        isForeignKey: c.IS_FK === 1,
      }));
      tables.push({
        tableName,
        tableType: 'table',
        estimatedRows: row.NUM_ROWS || 0,
        columns,
        primaryKey: columns.find(c => c.isPrimaryKey)?.name,
      });
    }
    return tables;
  } finally {
    await conn.close();
  }
}

/**
 * Test MongoDB connection
 */
async function testMongoDBConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  let client: MongoClient | null = null;
  try {
    const authPart = config.username ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@` : '';
    const uri = `mongodb://${authPart}${config.host}:${config.port}/${config.databaseName}`;
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: config.sslEnabled || false,
    });
    await client.connect();
    const admin = client.db().admin();
    const info = await admin.serverInfo();
    await client.close();
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: `MongoDB ${info.version}`,
    };
  } catch (error: any) {
    if (client) try { await client.close(); } catch {}
    let message = 'فشل الاتصال بـ MongoDB';
    if (error.message?.includes('ECONNREFUSED')) message = 'رفض الاتصال — تأكد من أن MongoDB يعمل';
    else if (error.message?.includes('Authentication')) message = 'فشل المصادقة — تحقق من اسم المستخدم وكلمة المرور';
    else if (error.message?.includes('ETIMEDOUT')) message = 'انتهت مهلة الاتصال';
    return { success: false, message, error: error.message, responseTime: Date.now() - startTime };
  }
}

/**
 * Discover MongoDB collections and their fields
 */
async function discoverMongoDBCollections(config: ConnectionConfig): Promise<TableInfo[]> {
  const authPart = config.username ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@` : '';
  const uri = `mongodb://${authPart}${config.host}:${config.port}/${config.databaseName}`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, tls: config.sslEnabled || false });
  await client.connect();
  try {
    const db = client.db(config.databaseName);
    const collections = await db.listCollections().toArray();
    const tables: TableInfo[] = [];

    for (const coll of collections) {
      const collection = db.collection(coll.name);
      const count = await collection.estimatedDocumentCount();
      const sample = await collection.findOne();
      const columns: ColumnInfo[] = [];

      if (sample) {
        for (const [key, value] of Object.entries(sample)) {
          const mongoType = Array.isArray(value) ? 'Array' : value === null ? 'null' : typeof value === 'object' && value instanceof Date ? 'Date' : typeof value === 'object' ? 'Object' : typeof value;
          columns.push({
            name: key,
            type: mongoType,
            nullable: true,
            isPrimaryKey: key === '_id',
            isForeignKey: false,
          });
        }
      }

      tables.push({
        tableName: coll.name,
        tableType: coll.type === 'view' ? 'view' : 'collection',
        estimatedRows: count,
        columns,
        primaryKey: '_id',
      });
    }
    return tables;
  } finally {
    await client.close();
  }
}

/**
 * Test Redis connection
 */
async function testRedisConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  let redis: Redis | null = null;
  try {
    redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: parseInt(config.databaseName) || 0,
      connectTimeout: 10000,
      tls: config.sslEnabled ? {} : undefined,
      lazyConnect: true,
    });
    await redis.connect();
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:(.+)/);
    const version = versionMatch ? versionMatch[1].trim() : 'Redis';
    await redis.quit();
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: `Redis ${version}`,
    };
  } catch (error: any) {
    if (redis) try { await redis.quit(); } catch {}
    let message = 'فشل الاتصال بـ Redis';
    if (error.message?.includes('ECONNREFUSED')) message = 'رفض الاتصال — تأكد من أن Redis يعمل';
    else if (error.message?.includes('NOAUTH') || error.message?.includes('ERR AUTH')) message = 'كلمة المرور غير صحيحة';
    else if (error.message?.includes('ETIMEDOUT')) message = 'انتهت مهلة الاتصال';
    return { success: false, message, error: error.message, responseTime: Date.now() - startTime };
  }
}

/**
 * Discover Redis key patterns and types
 */
async function discoverRedisKeys(config: ConnectionConfig): Promise<TableInfo[]> {
  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password || undefined,
    db: parseInt(config.databaseName) || 0,
    connectTimeout: 10000,
    tls: config.sslEnabled ? {} : undefined,
    lazyConnect: true,
  });
  await redis.connect();
  try {
    const dbsize = await redis.dbsize();
    const keyTypes: Record<string, { count: number; type: string }> = {};
    let cursor = '0';
    let scanned = 0;
    const maxScan = 500;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'COUNT', 100);
      cursor = nextCursor;
      for (const key of keys) {
        if (scanned >= maxScan) break;
        const prefix = key.includes(':') ? key.split(':')[0] + ':*' : key;
        if (!keyTypes[prefix]) {
          const type = await redis.type(key);
          keyTypes[prefix] = { count: 0, type };
        }
        keyTypes[prefix].count++;
        scanned++;
      }
    } while (cursor !== '0' && scanned < maxScan);

    const tables: TableInfo[] = Object.entries(keyTypes).map(([pattern, info]) => ({
      tableName: pattern,
      tableType: 'key_pattern',
      estimatedRows: info.count,
      columns: [{
        name: 'key',
        type: 'string',
        nullable: false,
        isPrimaryKey: true,
        isForeignKey: false,
      }, {
        name: 'value',
        type: info.type,
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
      }],
      primaryKey: 'key',
    }));

    if (tables.length === 0) {
      tables.push({
        tableName: `(${dbsize} مفاتيح إجمالية)`,
        tableType: 'info',
        estimatedRows: dbsize,
        columns: [],
      });
    }

    await redis.quit();
    return tables;
  } catch (error) {
    await redis.quit();
    throw error;
  }
}

/**
 * Test Elasticsearch connection
 */
async function testElasticsearchConnection(config: ConnectionConfig, startTime: number): Promise<ConnectionTestResult> {
  try {
    const protocol = config.sslEnabled ? 'https' : 'http';
    const auth = config.username ? { username: config.username, password: config.password } : undefined;
    const client = new ElasticClient({
      node: `${protocol}://${config.host}:${config.port}`,
      auth,
      requestTimeout: 10000,
      tls: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
    const info = await client.info();
    const version = (info as any).version?.number || 'Elasticsearch';
    const clusterName = (info as any).cluster_name || '';
    return {
      success: true,
      message: 'تم الاتصال بنجاح',
      responseTime: Date.now() - startTime,
      serverVersion: `Elasticsearch ${version}${clusterName ? ` (${clusterName})` : ''}`,
    };
  } catch (error: any) {
    let message = 'فشل الاتصال بـ Elasticsearch';
    if (error.message?.includes('ECONNREFUSED')) message = 'رفض الاتصال — تأكد من أن Elasticsearch يعمل';
    else if (error.statusCode === 401) message = 'بيانات المصادقة غير صحيحة';
    else if (error.message?.includes('ETIMEDOUT')) message = 'انتهت مهلة الاتصال';
    return { success: false, message, error: error.message, responseTime: Date.now() - startTime };
  }
}

/**
 * Discover Elasticsearch indices and their mappings
 */
async function discoverElasticsearchIndices(config: ConnectionConfig): Promise<TableInfo[]> {
  const protocol = config.sslEnabled ? 'https' : 'http';
  const auth = config.username ? { username: config.username, password: config.password } : undefined;
  const client = new ElasticClient({
    node: `${protocol}://${config.host}:${config.port}`,
    auth,
    requestTimeout: 10000,
    tls: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  const catIndices = await client.cat.indices({ format: 'json' }) as any[];
  const tables: TableInfo[] = [];

  for (const idx of catIndices) {
    const indexName = idx.index;
    if (indexName.startsWith('.')) continue;

    const mappingRes = await client.indices.getMapping({ index: indexName });
    const mapping = (mappingRes as any)[indexName]?.mappings?.properties || {};
    const columns: ColumnInfo[] = Object.entries(mapping).map(([field, meta]: [string, any]) => ({
      name: field,
      type: meta.type || 'object',
      nullable: true,
      isPrimaryKey: field === '_id',
      isForeignKey: false,
    }));

    tables.push({
      tableName: indexName,
      tableType: 'index',
      estimatedRows: parseInt(idx['docs.count'] || '0'),
      columns,
      primaryKey: '_id',
    });
  }

  return tables;
}

/**
 * Execute query on external database
 */
export async function executeQuery(config: ConnectionConfig, query: string): Promise<any[]> {
  switch (config.databaseType) {
    case 'mysql':
      return await executeMySQLQuery(config, query);
    case 'sqlserver':
      return await executeSQLServerQuery(config, query);
    default:
      throw new Error('نوع قاعدة البيانات غير مدعوم');
  }
}

async function executeMySQLQuery(config: ConnectionConfig, query: string): Promise<any[]> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    const [rows] = await connection.query(query);
    await connection.end();
    return rows as any[];
  } catch (error) {
    await connection.end();
    throw error;
  }
}

async function executeSQLServerQuery(config: ConnectionConfig, query: string): Promise<any[]> {
  const sqlConfig: sql.config = {
    server: config.host,
    port: config.port,
    database: config.databaseName,
    user: config.username,
    password: config.password,
    options: {
      encrypt: config.sslEnabled || false,
      trustServerCertificate: true,
    },
  };
  
  const pool = await sql.connect(sqlConfig);
  
  try {
    const result = await pool.query(query);
    await pool.close();
    return result.recordset;
  } catch (error) {
    await pool.close();
    throw error;
  }
}

// ==================== Quality Check on External Databases ====================

export interface QualityCheckInput {
  ruleId: number;
  ruleName: string;
  dimension: string;
  targetTable: string;
  targetColumn?: string;
  threshold: number;
  sqlExpression?: string;
  validationPattern?: string;
  systemName?: string;
}

export interface QualityCheckOutput {
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

/**
 * Run a quality check against an external database (MySQL, SQL Server, PostgreSQL)
 */
export async function runQualityCheckOnExternal(
  config: ConnectionConfig,
  input: QualityCheckInput
): Promise<QualityCheckOutput> {
  switch (config.databaseType) {
    case 'mysql':
      return runMySQLQualityCheck(config, input);
    case 'postgresql':
      return runExternalPostgreSQLQualityCheck(config, input);
    case 'sqlserver':
      return runSQLServerQualityCheck(config, input);
    default:
      throw new Error(`نوع قاعدة البيانات غير مدعوم لفحص الجودة: ${config.databaseType}`);
  }
}

function buildErrorOutput(input: QualityCheckInput, executionTime: number, error: string): QualityCheckOutput {
  return {
    ruleId: input.ruleId,
    ruleName: input.ruleName,
    dimension: input.dimension,
    targetTable: input.targetTable,
    targetColumn: input.targetColumn || '',
    systemName: input.systemName || 'External DB',
    totalRecords: 0,
    passedRecords: 0,
    failedRecords: 0,
    score: 0,
    threshold: input.threshold,
    passed: false,
    executionTime,
    errorMessage: error,
    sampleFailures: null,
  };
}

async function runMySQLQualityCheck(config: ConnectionConfig, input: QualityCheckInput): Promise<QualityCheckOutput> {
  const startTime = Date.now();
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.databaseName,
      user: config.username,
      password: config.password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 15000,
    });

    const tbl = `\`${input.targetTable.replace(/`/g, '')}\``;
    const col = input.targetColumn ? `\`${input.targetColumn.replace(/`/g, '')}\`` : null;

    let totalRecords = 0, passedRecords = 0, failedRecords = 0;

    if (input.sqlExpression) {
      const [rows] = await connection.query(input.sqlExpression);
      const r = (rows as any[])[0] || {};
      totalRecords = Number(r.total) || 0;
      failedRecords = Number(r.failed) || 0;
      passedRecords = Number(r.passed) || (totalRecords - failedRecords);
    } else if (input.dimension === 'الاكتمال' && col) {
      const [rows] = await connection.query(`SELECT COUNT(*) as total, SUM(CASE WHEN ${col} IS NULL OR CAST(${col} AS CHAR) = '' THEN 1 ELSE 0 END) as failed FROM ${tbl}`);
      const r = (rows as any[])[0] || {};
      totalRecords = Number(r.total) || 0;
      failedRecords = Number(r.failed) || 0;
      passedRecords = totalRecords - failedRecords;
    } else if (input.dimension === 'التفرد' && col) {
      const [rows] = await connection.query(`SELECT COUNT(*) as total, COUNT(DISTINCT ${col}) as uniq FROM ${tbl}`);
      const r = (rows as any[])[0] || {};
      totalRecords = Number(r.total) || 0;
      passedRecords = Number(r.uniq) || 0;
      failedRecords = totalRecords - passedRecords;
    } else if (input.dimension === 'الصلاحية' && col && input.validationPattern) {
      const [rows] = await connection.query(`SELECT COUNT(*) as total, SUM(CASE WHEN ${col} REGEXP ? THEN 1 ELSE 0 END) as passed FROM ${tbl}`, [input.validationPattern]);
      const r = (rows as any[])[0] || {};
      totalRecords = Number(r.total) || 0;
      passedRecords = Number(r.passed) || 0;
      failedRecords = totalRecords - passedRecords;
    } else {
      const [rows] = await connection.query(`SELECT COUNT(*) as total FROM ${tbl}`);
      totalRecords = Number((rows as any[])[0]?.total) || 0;
      passedRecords = totalRecords;
    }

    await connection.end();
    const score = totalRecords > 0 ? Math.min(100, (passedRecords / totalRecords) * 100) : 100;
    return {
      ruleId: input.ruleId, ruleName: input.ruleName, dimension: input.dimension,
      targetTable: input.targetTable, targetColumn: input.targetColumn || '',
      systemName: input.systemName || `MySQL:${config.databaseName}`,
      totalRecords, passedRecords, failedRecords,
      score, threshold: input.threshold, passed: score >= input.threshold,
      executionTime: Date.now() - startTime, errorMessage: null, sampleFailures: null,
    };
  } catch (err: any) {
    if (connection) { try { await connection.end(); } catch {} }
    return buildErrorOutput(input, Date.now() - startTime, err.message);
  }
}

async function runExternalPostgreSQLQualityCheck(config: ConnectionConfig, input: QualityCheckInput): Promise<QualityCheckOutput> {
  const startTime = Date.now();
  const pool = new pg.Pool({
    host: config.host, port: config.port, database: config.databaseName,
    user: config.username, password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: 1, connectionTimeoutMillis: 15000,
  });

  try {
    const client = await pool.connect();
    const tbl = `"${input.targetTable.replace(/"/g, '')}"`;
    const col = input.targetColumn ? `"${input.targetColumn.replace(/"/g, '')}"` : null;

    let totalRecords = 0, passedRecords = 0, failedRecords = 0;

    try {
      if (input.sqlExpression) {
        const res = await client.query(input.sqlExpression);
        const r = res.rows[0] || {};
        totalRecords = Number(r.total) || 0;
        failedRecords = Number(r.failed) || 0;
        passedRecords = Number(r.passed) || (totalRecords - failedRecords);
      } else if (input.dimension === 'الاكتمال' && col) {
        const res = await client.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE ${col} IS NULL OR CAST(${col} AS TEXT) = '') as failed FROM ${tbl}`);
        const r = res.rows[0] || {};
        totalRecords = Number(r.total) || 0;
        failedRecords = Number(r.failed) || 0;
        passedRecords = totalRecords - failedRecords;
      } else if (input.dimension === 'التفرد' && col) {
        const res = await client.query(`SELECT COUNT(*) as total, COUNT(DISTINCT ${col}) as uniq FROM ${tbl}`);
        const r = res.rows[0] || {};
        totalRecords = Number(r.total) || 0;
        passedRecords = Number(r.uniq) || 0;
        failedRecords = totalRecords - passedRecords;
      } else if (input.dimension === 'الصلاحية' && col && input.validationPattern) {
        const res = await client.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE CAST(${col} AS TEXT) ~ $1) as passed FROM ${tbl}`, [input.validationPattern]);
        const r = res.rows[0] || {};
        totalRecords = Number(r.total) || 0;
        passedRecords = Number(r.passed) || 0;
        failedRecords = totalRecords - passedRecords;
      } else {
        const res = await client.query(`SELECT COUNT(*) as total FROM ${tbl}`);
        totalRecords = Number(res.rows[0]?.total) || 0;
        passedRecords = totalRecords;
      }
    } finally {
      client.release();
    }

    await pool.end();
    const score = totalRecords > 0 ? Math.min(100, (passedRecords / totalRecords) * 100) : 100;
    return {
      ruleId: input.ruleId, ruleName: input.ruleName, dimension: input.dimension,
      targetTable: input.targetTable, targetColumn: input.targetColumn || '',
      systemName: input.systemName || `PostgreSQL:${config.databaseName}`,
      totalRecords, passedRecords, failedRecords,
      score, threshold: input.threshold, passed: score >= input.threshold,
      executionTime: Date.now() - startTime, errorMessage: null, sampleFailures: null,
    };
  } catch (err: any) {
    try { await pool.end(); } catch {}
    return buildErrorOutput(input, Date.now() - startTime, err.message);
  }
}

async function runSQLServerQualityCheck(config: ConnectionConfig, input: QualityCheckInput): Promise<QualityCheckOutput> {
  const startTime = Date.now();
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect({
      server: config.host, port: config.port, database: config.databaseName,
      user: config.username, password: config.password,
      options: { encrypt: config.sslEnabled || false, trustServerCertificate: true },
      connectionTimeout: 15000,
    });

    const tbl = `[${input.targetTable.replace(/\]/g, '')}]`;
    const col = input.targetColumn ? `[${input.targetColumn.replace(/\]/g, '')}]` : null;

    let totalRecords = 0, passedRecords = 0, failedRecords = 0;

    if (input.sqlExpression) {
      const res = await pool.query(input.sqlExpression);
      const r = res.recordset[0] || {};
      totalRecords = Number(r.total) || 0;
      failedRecords = Number(r.failed) || 0;
      passedRecords = Number(r.passed) || (totalRecords - failedRecords);
    } else if (input.dimension === 'الاكتمال' && col) {
      const res = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN ${col} IS NULL OR CAST(${col} AS NVARCHAR(MAX)) = '' THEN 1 ELSE 0 END) as failed FROM ${tbl}`);
      const r = res.recordset[0] || {};
      totalRecords = Number(r.total) || 0;
      failedRecords = Number(r.failed) || 0;
      passedRecords = totalRecords - failedRecords;
    } else if (input.dimension === 'التفرد' && col) {
      const res = await pool.query(`SELECT COUNT(*) as total, COUNT(DISTINCT ${col}) as uniq FROM ${tbl}`);
      const r = res.recordset[0] || {};
      totalRecords = Number(r.total) || 0;
      passedRecords = Number(r.uniq) || 0;
      failedRecords = totalRecords - passedRecords;
    } else {
      const res = await pool.query(`SELECT COUNT(*) as total FROM ${tbl}`);
      totalRecords = Number(res.recordset[0]?.total) || 0;
      passedRecords = totalRecords;
    }

    await pool.close();
    const score = totalRecords > 0 ? Math.min(100, (passedRecords / totalRecords) * 100) : 100;
    return {
      ruleId: input.ruleId, ruleName: input.ruleName, dimension: input.dimension,
      targetTable: input.targetTable, targetColumn: input.targetColumn || '',
      systemName: input.systemName || `SQL Server:${config.databaseName}`,
      totalRecords, passedRecords, failedRecords,
      score, threshold: input.threshold, passed: score >= input.threshold,
      executionTime: Date.now() - startTime, errorMessage: null, sampleFailures: null,
    };
  } catch (err: any) {
    if (pool) { try { await pool.close(); } catch {} }
    return buildErrorOutput(input, Date.now() - startTime, err.message);
  }
}
