import { db } from "../db";
import { 
  systemConnections, discoveredSchemas, discoveredTables, discoveredColumns, 
  dataLineage, discoveryLogs
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../security-middleware";
import { testConnection as realTestConn, discoverTables as realDiscoverTables } from "../external-db";

const isProduction = process.env.NODE_ENV === 'production';

function getEncryptionKey(): string {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (isProduction) {
      logger.error('CRITICAL SECURITY ERROR: SESSION_SECRET not set in production for Data Catalog encryption');
      throw new Error('SESSION_SECRET environment variable is required in production for secure credential encryption');
    }
    logger.warn('WARNING: Using development-only encryption key. Set SESSION_SECRET for production.');
    return crypto.createHash('sha256').update('dev-salt-' + (process.env.REPL_ID || 'local')).digest('hex');
  }
  return sessionSecret;
}

const ENCRYPTION_KEY = getEncryptionKey();

function encrypt(text: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText;
  }
}

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  schema?: string;
}

function parseConnectionString(connStr: string, dbType: string): { host: string; port: number; database: string; username: string; password?: string } | null {
  try {
    const type = dbType?.toLowerCase();
    if (type === 'sqlserver' || type === 'mssql') {
      const params: Record<string, string> = {};
      connStr.split(';').forEach(part => {
        const [key, ...vals] = part.split('=');
        if (key && vals.length) params[key.trim().toLowerCase()] = vals.join('=').trim();
      });
      return {
        host: params['server'] || params['data source'] || params['host'] || 'localhost',
        port: parseInt(params['port'] || '1433'),
        database: params['database'] || params['initial catalog'] || '',
        username: params['user id'] || params['uid'] || params['user'] || '',
        password: params['password'] || params['pwd'] || undefined,
      };
    }
    const url = new URL(connStr);
    const defaultPorts: Record<string, number> = { postgresql: 5432, mysql: 3306, oracle: 1521 };
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || defaultPorts[type] || 5432,
      database: url.pathname?.replace('/', '') || '',
      username: url.username || '',
      password: url.password || undefined,
    };
  } catch {
    return null;
  }
}

export interface TableMetadata {
  tableName: string;
  schemaName?: string;
  tableType: 'table' | 'view' | 'materialized_view';
  estimatedRows?: number;
  tableSizeBytes?: number;
  description?: string;
}

export interface ColumnMetadata {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  description?: string;
  referencedTable?: string;
  referencedColumn?: string;
}

export interface SchemaMetadata {
  schemaName: string;
  description?: string;
  tableCount: number;
  viewCount: number;
  totalSizeBytes?: number;
}

export interface DiscoveryResult {
  success: boolean;
  connectionId: number;
  schemasDiscovered: number;
  tablesDiscovered: number;
  columnsDiscovered: number;
  duration: number;
  errors: string[];
}

export async function createSystemConnection(
  data: {
    name: string;
    nameAr?: string;
    connectionType: string;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
    connectionString?: string;
    sslEnabled?: boolean;
    autoDiscoveryEnabled?: boolean;
    discoverySchedule?: string;
  },
  createdById: number
): Promise<number> {
  const encryptedPassword = data.password ? encrypt(data.password) : null;
  const encryptedConnString = data.connectionString ? encrypt(data.connectionString) : null;

  let host = data.host;
  let port = data.port;
  let databaseName = data.databaseName;
  let username = data.username;

  if (encryptedConnString && data.connectionString) {
    const parsed = parseConnectionString(data.connectionString, data.connectionType);
    if (parsed) {
      host = host || parsed.host;
      port = port || parsed.port;
      databaseName = databaseName || parsed.database;
      username = username || parsed.username;
    }
  }
  
  const [connection] = await db.insert(systemConnections).values({
    name: data.name,
    nameAr: data.nameAr,
    connectionType: data.connectionType,
    host,
    port,
    databaseName,
    username,
    password: encryptedPassword,
    connectionString: encryptedConnString,
    sslEnabled: data.sslEnabled ?? false,
    autoDiscoveryEnabled: data.autoDiscoveryEnabled ?? true,
    discoverySchedule: data.discoverySchedule,
    status: 'pending',
    createdBy: createdById
  }).returning({ id: systemConnections.id });

  await db.insert(discoveryLogs).values({
    connectionId: connection.id,
    discoveryType: 'schema_only',
    status: 'completed',
    schemasDiscovered: 0,
    tablesDiscovered: 0,
    columnsDiscovered: 0,
    triggeredBy: createdById
  });

  return connection.id;
}

function buildConnectionConfig(connection: any) {
  const type = connection.connectionType?.toLowerCase();
  const typeMap: Record<string, string> = {
    mysql: 'mysql', postgresql: 'postgresql', sqlserver: 'sqlserver',
    mssql: 'sqlserver', oracle: 'oracle', mongodb: 'mongodb',
    redis: 'redis', elasticsearch: 'elasticsearch'
  };
  const databaseType = (typeMap[type] || 'postgresql') as any;
  const defaultPorts: Record<string, number> = {
    mysql: 3306, postgresql: 5432, sqlserver: 1433, oracle: 1521,
    mongodb: 27017, redis: 6379, elasticsearch: 9200
  };

  if (connection.connectionString) {
    const connStr = decrypt(connection.connectionString);
    const parsed = parseConnectionString(connStr, type);
    if (parsed) {
      return {
        databaseType,
        host: parsed.host,
        port: parsed.port,
        databaseName: parsed.database,
        username: parsed.username,
        password: parsed.password || (connection.password ? decrypt(connection.password) : ''),
        sslEnabled: connection.sslEnabled || false,
      };
    }
  }

  return {
    databaseType,
    host: connection.host || 'localhost',
    port: connection.port || defaultPorts[databaseType] || 5432,
    databaseName: connection.databaseName || '',
    username: connection.username || '',
    password: connection.password ? decrypt(connection.password) : '',
    sslEnabled: connection.sslEnabled || false,
  };
}

export async function testConnection(connectionId: number): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const [connection] = await db.select().from(systemConnections).where(eq(systemConnections.id, connectionId));
  
  if (!connection) {
    return { success: false, message: 'الاتصال غير موجود' };
  }

  const type = connection.connectionType?.toLowerCase();
  const testableTypes = ['postgresql', 'mysql', 'sqlserver', 'mssql', 'oracle', 'mongodb', 'redis', 'elasticsearch'];
  if (!testableTypes.includes(type)) {
    await db.update(systemConnections)
      .set({ status: 'connected', lastConnectionTest: new Date() })
      .where(eq(systemConnections.id, connectionId));
    return { success: true, message: 'نوع الاتصال لا يدعم الاختبار المباشر', latencyMs: 0 };
  }

  try {
    const config = buildConnectionConfig(connection);
    const result = await realTestConn(config);
    await db.update(systemConnections)
      .set({ status: result.success ? 'connected' : 'failed', lastConnectionTest: new Date() })
      .where(eq(systemConnections.id, connectionId));
    return { success: result.success, message: result.message, latencyMs: result.responseTime };
  } catch (error) {
    await db.update(systemConnections)
      .set({ status: 'failed', lastConnectionTest: new Date() })
      .where(eq(systemConnections.id, connectionId));
    return { success: false, message: 'فشل الاتصال' };
  }
}

export async function runDiscovery(connectionId: number, performedById?: number): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let schemasDiscovered = 0;
  let tablesDiscovered = 0;
  let columnsDiscovered = 0;

  const [connection] = await db.select().from(systemConnections).where(eq(systemConnections.id, connectionId));
  
  if (!connection) {
    return {
      success: false,
      connectionId,
      schemasDiscovered: 0,
      tablesDiscovered: 0,
      columnsDiscovered: 0,
      duration: Date.now() - startTime,
      errors: ['الاتصال غير موجود']
    };
  }

  const [logEntry] = await db.insert(discoveryLogs).values({
    connectionId,
    discoveryType: 'full',
    status: 'running',
    schemasDiscovered: 0,
    tablesDiscovered: 0,
    columnsDiscovered: 0,
    triggeredBy: performedById
  }).returning({ id: discoveryLogs.id });

  try {
    const type = connection.connectionType?.toLowerCase();
    const realDbTypes = ['postgresql', 'mysql', 'sqlserver', 'mssql', 'oracle', 'mongodb', 'redis', 'elasticsearch'];

    if (!realDbTypes.includes(type)) {
      await db.update(systemConnections)
        .set({ status: 'connected', lastDiscovery: new Date() })
        .where(eq(systemConnections.id, connectionId));
      await db.update(discoveryLogs)
        .set({ status: 'completed', schemasDiscovered: 0, tablesDiscovered: 0, columnsDiscovered: 0, completedAt: new Date(), duration: 0 })
        .where(eq(discoveryLogs.id, logEntry.id));
      return { success: true, connectionId, schemasDiscovered: 0, tablesDiscovered: 0, columnsDiscovered: 0, duration: 0, errors: ['نوع الاتصال لا يدعم الاكتشاف التلقائي'] };
    }

    const config = buildConnectionConfig(connection);
    const realTables = await realDiscoverTables(config);

    await db.update(systemConnections)
      .set({ status: 'connected' })
      .where(eq(systemConnections.id, connectionId));

    // مسح البيانات القديمة لتجنب التكرار
    await db.delete(discoveredColumns).where(eq(discoveredColumns.connectionId, connectionId));
    await db.delete(discoveredTables).where(eq(discoveredTables.connectionId, connectionId));
    await db.delete(discoveredSchemas).where(eq(discoveredSchemas.connectionId, connectionId));

    // إنشاء schema واحد يمثل قاعدة البيانات
    const schemaName = connection.databaseName || 'default';
    const [insertedSchema] = await db.insert(discoveredSchemas).values({
      connectionId,
      schemaName,
      description: `قاعدة البيانات: ${schemaName}`,
      tablesCount: realTables.length,
      viewsCount: realTables.filter((t: any) => t.tableType?.toLowerCase().includes('view')).length,
      isDefault: true
    }).returning({ id: discoveredSchemas.id });
    schemasDiscovered++;

    for (const table of realTables) {
      const [insertedTable] = await db.insert(discoveredTables).values({
        connectionId,
        schemaId: insertedSchema.id,
        tableName: table.tableName,
        tableType: table.tableType || 'table',
        rowsEstimate: table.estimatedRows,
        columnsCount: table.columns.length,
      }).returning({ id: discoveredTables.id });
      tablesDiscovered++;

      for (let i = 0; i < table.columns.length; i++) {
        const col = table.columns[i];
        await db.insert(discoveredColumns).values({
          connectionId,
          tableId: insertedTable.id,
          columnName: col.name,
          dataType: col.type,
          isNullable: col.nullable,
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: col.isForeignKey,
          defaultValue: col.defaultValue || null,
          position: i + 1
        });
        columnsDiscovered++;
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    await db.update(systemConnections)
      .set({ 
        status: 'connected',
        lastDiscovery: new Date()
      })
      .where(eq(systemConnections.id, connectionId));

    await db.update(discoveryLogs)
      .set({
        status: 'completed',
        schemasDiscovered,
        tablesDiscovered,
        columnsDiscovered,
        completedAt: new Date(),
        duration
      })
      .where(eq(discoveryLogs.id, logEntry.id));

    return {
      success: true,
      connectionId,
      schemasDiscovered,
      tablesDiscovered,
      columnsDiscovered,
      duration: Date.now() - startTime,
      errors
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);

    await db.update(systemConnections)
      .set({ status: 'failed' })
      .where(eq(systemConnections.id, connectionId));

    await db.update(discoveryLogs)
      .set({
        status: 'failed',
        errorsCount: 1,
        errorDetails: { error: errorMessage },
        completedAt: new Date(),
        duration: Math.floor((Date.now() - startTime) / 1000)
      })
      .where(eq(discoveryLogs.id, logEntry.id));

    return {
      success: false,
      connectionId,
      schemasDiscovered,
      tablesDiscovered,
      columnsDiscovered,
      duration: Date.now() - startTime,
      errors
    };
  }
}

export async function getConnectionDetails(connectionId: number) {
  const [connection] = await db.select().from(systemConnections).where(eq(systemConnections.id, connectionId));
  
  if (!connection) return null;

  const schemas = await db.select().from(discoveredSchemas)
    .where(eq(discoveredSchemas.connectionId, connectionId));

  const tables = await db.select().from(discoveredTables)
    .where(eq(discoveredTables.connectionId, connectionId));

  const logs = await db.select().from(discoveryLogs)
    .where(eq(discoveryLogs.connectionId, connectionId))
    .orderBy(desc(discoveryLogs.startedAt))
    .limit(20);

  return {
    connection,
    schemas,
    tables,
    logs
  };
}

export async function getAllConnections() {
  return db.select().from(systemConnections).orderBy(desc(systemConnections.createdAt));
}

export async function getDiscoveryStats() {
  const connections = await db.select().from(systemConnections);
  const schemas = await db.select().from(discoveredSchemas);
  const tables = await db.select().from(discoveredTables);
  const columns = await db.select().from(discoveredColumns);

  return {
    totalConnections: connections.length,
    activeConnections: connections.filter((c: any) => c.status === 'connected').length,
    failedConnections: connections.filter((c: any) => c.status === 'failed').length,
    totalSchemas: schemas.length,
    totalTables: tables.length,
    totalColumns: columns.length,
    connectionsByType: connections.reduce((acc: Record<string, number>, c: any) => {
      acc[c.connectionType] = (acc[c.connectionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

export async function deleteConnection(connectionId: number) {
  await db.delete(discoveryLogs).where(eq(discoveryLogs.connectionId, connectionId));
  await db.delete(discoveredColumns).where(eq(discoveredColumns.connectionId, connectionId));
  await db.delete(discoveredTables).where(eq(discoveredTables.connectionId, connectionId));
  await db.delete(discoveredSchemas).where(eq(discoveredSchemas.connectionId, connectionId));
  await db.delete(systemConnections).where(eq(systemConnections.id, connectionId));
  
  return { success: true };
}

export { encrypt, decrypt };
