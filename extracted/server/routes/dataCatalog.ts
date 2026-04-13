import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { 
  createSystemConnection, 
  testConnection, 
  runDiscovery,
  getConnectionDetails,
  getAllConnections,
  getDiscoveryStats,
  deleteConnection
} from "../integrations/dataDiscoveryEngine";
import { db } from "../db";
import { 
  systemConnections, discoveredSchemas, discoveredTables, discoveredColumns,
  dataLineage, discoveryLogs, itSystems
} from "@shared/schema";
import { eq, desc, ilike, or } from "drizzle-orm";
import { logger } from "../security-middleware";

const router = Router();

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    portal: string;
    name: string;
  };
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).user) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  }
  next();
};

const requireDataCatalogAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  const allowedRoles = [
    'system_admin',           // مدير النظام
    'it_director',            // المدير العام لتقنية المعلومات
    'dmo_manager',            // مدير مكتب إدارة البيانات
    'dmo_staff',              // موظف مكتب إدارة البيانات
    'data_steward',           // أمين البيانات
    'data_representative'     // ممثل البيانات
  ];
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'غير مصرح لك بالوصول إلى فهرس البيانات' });
  }
  next();
};

const createConnectionSchema = z.object({
  name: z.string().min(1, 'اسم الاتصال مطلوب').max(200),
  nameAr: z.string().max(200).optional(),
  systemId: z.coerce.number().int().positive().optional().nullable(),
  connectionType: z.enum(['postgresql', 'mysql', 'oracle', 'sqlserver', 'mongodb', 'redis', 'elasticsearch', 'api', 'file']),
  host: z.string().max(500).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  database: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  password: z.string().optional(),
  connectionString: z.string().max(2000).optional(),
  sslEnabled: z.boolean().default(false),
  description: z.string().max(1000).optional(),
  autoDiscoveryEnabled: z.boolean().default(true),
  discoverySchedule: z.enum(['manual', 'daily', 'weekly', 'monthly']).default('daily')
}).refine(data => {
  if (data.connectionString && data.connectionString.trim().length > 0) return true;
  if (data.host && data.host.trim().length > 0) return true;
  return false;
}, { message: 'يجب تقديم رابط الاتصال (Connection String) أو عنوان الخادم (Host)' })
.transform(data => ({
  ...data,
  databaseName: data.database,
}));

router.get('/connections', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connections = await db.select({
      id: systemConnections.id,
      name: systemConnections.name,
      nameAr: systemConnections.nameAr,
      systemId: systemConnections.systemId,
      connectionType: systemConnections.connectionType,
      host: systemConnections.host,
      port: systemConnections.port,
      databaseName: systemConnections.databaseName,
      status: systemConnections.status,
      sslEnabled: systemConnections.sslEnabled,
      lastConnectionTest: systemConnections.lastConnectionTest,
      lastDiscovery: systemConnections.lastDiscovery,
      autoDiscoveryEnabled: systemConnections.autoDiscoveryEnabled,
      discoverySchedule: systemConnections.discoverySchedule,
      createdBy: systemConnections.createdBy,
      createdAt: systemConnections.createdAt,
      updatedAt: systemConnections.updatedAt,
      systemNameAr: itSystems.nameAr,
      systemNameEn: itSystems.nameEn,
      systemCode: itSystems.code,
    })
    .from(systemConnections)
    .leftJoin(itSystems, eq(systemConnections.systemId, itSystems.id))
    .orderBy(desc(systemConnections.createdAt));
    res.json(connections);
  } catch (error) {
    logger.error('Error fetching connections:', { error });
    res.status(500).json({ error: 'فشل في جلب الاتصالات' });
  }
});

router.get('/connections/:id', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connectionId = parseInt(getParamString(req.params.id));
    const details = await getConnectionDetails(connectionId);
    
    if (!details) {
      return res.status(404).json({ error: 'الاتصال غير موجود' });
    }
    
    res.json(details);
  } catch (error) {
    logger.error('Error fetching connection details:', { error });
    res.status(500).json({ error: 'فشل في جلب تفاصيل الاتصال' });
  }
});

router.post('/connections', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const validatedData = createConnectionSchema.parse(req.body);
    
    const connectionId = await createSystemConnection(
      validatedData,
      (req as any).user.id
    );
    
    res.status(201).json({ 
      success: true, 
      connectionId,
      message: 'تم إنشاء الاتصال بنجاح'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'بيانات غير صالحة', details: error.errors });
    }
    logger.error('Error creating connection:', { error });
    res.status(500).json({ error: 'فشل في إنشاء الاتصال' });
  }
});

router.post('/connections/:id/test', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connectionId = parseInt(getParamString(req.params.id));
    const result = await testConnection(connectionId);
    res.json(result);
  } catch (error) {
    logger.error('Error testing connection:', { error });
    res.status(500).json({ error: 'فشل في اختبار الاتصال' });
  }
});

router.post('/connections/:id/discover', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connectionId = parseInt(getParamString(req.params.id));
    const userId = (req as any).user?.id;
    
    res.json({ 
      message: 'بدأت عملية الاكتشاف',
      connectionId,
      status: 'running'
    });
    
    runDiscovery(connectionId, userId).catch(err => {
      logger.error('Discovery error:', { error: err });
    });
  } catch (error) {
    logger.error('Error starting discovery:', { error });
    res.status(500).json({ error: 'فشل في بدء عملية الاكتشاف' });
  }
});

router.get('/connections/:id/discovery-status', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connectionId = parseInt(getParamString(req.params.id));
    
    const [connection] = await db.select({
      status: systemConnections.status,
      lastDiscovery: systemConnections.lastDiscovery
    }).from(systemConnections).where(eq(systemConnections.id, connectionId));
    
    if (!connection) {
      return res.status(404).json({ error: 'الاتصال غير موجود' });
    }
    
    const [latestLog] = await db.select()
      .from(discoveryLogs)
      .where(eq(discoveryLogs.connectionId, connectionId))
      .orderBy(desc(discoveryLogs.startedAt))
      .limit(1);
    
    res.json({
      status: connection.status,
      lastDiscovery: connection.lastDiscovery,
      latestLog
    });
  } catch (error) {
    logger.error('Error fetching discovery status:', { error });
    res.status(500).json({ error: 'فشل في جلب حالة الاكتشاف' });
  }
});

router.delete('/connections/:id', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const connectionId = parseInt(getParamString(req.params.id));
    
    const adminRoles = ['system_admin', 'admin', 'it_director', 'dmo_manager'];
    if (!adminRoles.includes((req as any).user.role)) {
      return res.status(403).json({ error: 'غير مصرح لك بحذف الاتصالات' });
    }
    
    await deleteConnection(connectionId);
    res.json({ success: true, message: 'تم حذف الاتصال بنجاح' });
  } catch (error) {
    logger.error('Error deleting connection:', { error });
    res.status(500).json({ error: 'فشل في حذف الاتصال' });
  }
});

router.get('/schemas', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { connectionId } = req.query;
    
    let query = db.select({
      id: discoveredSchemas.id,
      connectionId: discoveredSchemas.connectionId,
      schemaName: discoveredSchemas.schemaName,
      tablesCount: discoveredSchemas.tablesCount,
      discoveredAt: discoveredSchemas.discoveredAt,
      connectionName: systemConnections.name
    })
    .from(discoveredSchemas)
    .leftJoin(systemConnections, eq(discoveredSchemas.connectionId, systemConnections.id));
    
    if (connectionId) {
      query = query.where(eq(discoveredSchemas.connectionId, parseInt(connectionId as string))) as typeof query;
    }
    
    const schemas = await query.orderBy(desc(discoveredSchemas.discoveredAt));
    res.json(schemas);
  } catch (error) {
    logger.error('Error fetching schemas:', { error });
    res.status(500).json({ error: 'فشل في جلب المخططات' });
  }
});

router.get('/tables', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { schemaId, connectionId, classification, limit = '100' } = req.query;
    
    let query = db.select({
      id: discoveredTables.id,
      schemaId: discoveredTables.schemaId,
      tableName: discoveredTables.tableName,
      columnsCount: discoveredTables.columnsCount,
      rowsEstimate: discoveredTables.rowsEstimate,
      classification: discoveredTables.classification,
      description: discoveredTables.description,
      discoveredAt: discoveredTables.discoveredAt,
      schemaName: discoveredSchemas.schemaName,
      connectionName: systemConnections.name
    })
    .from(discoveredTables)
    .leftJoin(discoveredSchemas, eq(discoveredTables.schemaId, discoveredSchemas.id))
    .leftJoin(systemConnections, eq(discoveredSchemas.connectionId, systemConnections.id));
    
    if (connectionId) {
      query = query.where(eq(discoveredSchemas.connectionId, parseInt(connectionId as string))) as typeof query;
    }
    
    if (schemaId) {
      query = query.where(eq(discoveredTables.schemaId, parseInt(schemaId as string))) as typeof query;
    }
    
    if (classification) {
      query = query.where(eq(discoveredTables.classification, classification as string)) as typeof query;
    }
    
    const tables = await query
      .orderBy(desc(discoveredTables.discoveredAt))
      .limit(parseInt(limit as string));
    
    res.json(tables);
  } catch (error) {
    logger.error('Error fetching tables:', { error });
    res.status(500).json({ error: 'فشل في جلب الجداول' });
  }
});

router.get('/tables/:id', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const tableId = parseInt(getParamString(req.params.id));
    
    const [tableRow] = await db.select({
      id: discoveredTables.id,
      schemaId: discoveredTables.schemaId,
      tableName: discoveredTables.tableName,
      columnsCount: discoveredTables.columnsCount,
      rowsEstimate: discoveredTables.rowsEstimate,
      classification: discoveredTables.classification,
      owner: discoveredTables.owner,
      businessDomain: discoveredTables.businessDomain,
      description: discoveredTables.description,
      discoveredAt: discoveredTables.discoveredAt,
      schemaName: discoveredSchemas.schemaName,
      connectionName: systemConnections.name,
      connectionType: systemConnections.connectionType
    })
    .from(discoveredTables)
    .leftJoin(discoveredSchemas, eq(discoveredTables.schemaId, discoveredSchemas.id))
    .leftJoin(systemConnections, eq(discoveredSchemas.connectionId, systemConnections.id))
    .where(eq(discoveredTables.id, tableId));
    
    if (!tableRow) {
      return res.status(404).json({ error: 'الجدول غير موجود' });
    }
    
    const columns = await db.select()
      .from(discoveredColumns)
      .where(eq(discoveredColumns.tableId, tableId))
      .orderBy(discoveredColumns.position);
    
    res.json({ ...tableRow, columns });
  } catch (error) {
    logger.error('Error fetching table details:', { error });
    res.status(500).json({ error: 'فشل في جلب تفاصيل الجدول' });
  }
});

router.patch('/tables/:id', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const tableId = parseInt(getParamString(req.params.id));
    const { classification, owner, businessDomain, description } = req.body;
    
    await db.update(discoveredTables)
      .set({
        classification,
        owner,
        businessDomain,
        description,
        updatedAt: new Date()
      })
      .where(eq(discoveredTables.id, tableId));
    
    res.json({ success: true, message: 'تم تحديث الجدول بنجاح' });
  } catch (error) {
    logger.error('Error updating table:', { error });
    res.status(500).json({ error: 'فشل في تحديث الجدول' });
  }
});

router.get('/columns', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { tableId, isPrimaryKey, isForeignKey } = req.query;
    
    let query = db.select({
      id: discoveredColumns.id,
      tableId: discoveredColumns.tableId,
      columnName: discoveredColumns.columnName,
      dataType: discoveredColumns.dataType,
      isNullable: discoveredColumns.isNullable,
      isPrimaryKey: discoveredColumns.isPrimaryKey,
      isForeignKey: discoveredColumns.isForeignKey,
      position: discoveredColumns.position,
      classification: discoveredColumns.classification,
      isPII: discoveredColumns.isPII,
      description: discoveredColumns.description,
      tableName: discoveredTables.tableName,
      schemaName: discoveredSchemas.schemaName
    })
    .from(discoveredColumns)
    .leftJoin(discoveredTables, eq(discoveredColumns.tableId, discoveredTables.id))
    .leftJoin(discoveredSchemas, eq(discoveredTables.schemaId, discoveredSchemas.id));
    
    if (tableId) {
      query = query.where(eq(discoveredColumns.tableId, parseInt(tableId as string))) as typeof query;
    }
    
    if (isPrimaryKey === 'true') {
      query = query.where(eq(discoveredColumns.isPrimaryKey, true)) as typeof query;
    }
    
    if (isForeignKey === 'true') {
      query = query.where(eq(discoveredColumns.isForeignKey, true)) as typeof query;
    }
    
    const columns = await query.orderBy(discoveredColumns.position);
    res.json(columns);
  } catch (error) {
    logger.error('Error fetching columns:', { error });
    res.status(500).json({ error: 'فشل في جلب الأعمدة' });
  }
});

router.patch('/columns/:id', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const columnId = parseInt(getParamString(req.params.id));
    const { classification, businessName, businessNameAr, description } = req.body;
    
    await db.update(discoveredColumns)
      .set({
        classification,
        businessName,
        businessNameAr,
        description,
        updatedAt: new Date()
      })
      .where(eq(discoveredColumns.id, columnId));
    
    res.json({ success: true, message: 'تم تحديث العمود بنجاح' });
  } catch (error) {
    logger.error('Error updating column:', { error });
    res.status(500).json({ error: 'فشل في تحديث العمود' });
  }
});

router.get('/lineage', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { sourceTableId, targetTableId } = req.query;
    
    let query = db.select().from(dataLineage);
    
    if (sourceTableId) {
      query = query.where(eq(dataLineage.sourceTableId, parseInt(sourceTableId as string))) as typeof query;
    }
    
    if (targetTableId) {
      query = query.where(eq(dataLineage.targetTableId, parseInt(targetTableId as string))) as typeof query;
    }
    
    const lineageData = await query.orderBy(desc(dataLineage.createdAt));
    res.json(lineageData);
  } catch (error) {
    logger.error('Error fetching lineage:', { error });
    res.status(500).json({ error: 'فشل في جلب خريطة تدفق البيانات' });
  }
});

const createLineageSchema = z.object({
  sourceTableId: z.number().int().positive(),
  targetTableId: z.number().int().positive(),
  sourceType: z.string().min(1),
  targetType: z.string().min(1),
  transformationType: z.string().optional(),
  transformationLogic: z.string().optional(),
  name: z.string().optional()
}).strict();

router.post('/lineage', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const validatedData = createLineageSchema.parse(req.body);
    
    const [lineage] = await db.insert(dataLineage).values({
      ...validatedData,
      createdBy: (req as any).user.id
    }).returning();
    
    res.status(201).json(lineage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'بيانات غير صالحة', details: error.errors });
    }
    logger.error('Error creating lineage:', { error });
    res.status(500).json({ error: 'فشل في إنشاء خريطة التدفق' });
  }
});

router.get('/systems', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const systems = await db.select({
      id: itSystems.id,
      nameAr: itSystems.nameAr,
      nameEn: itSystems.nameEn,
      code: itSystems.code,
      status: itSystems.status,
      systemType: itSystems.systemType,
    })
    .from(itSystems)
    .where(eq(itSystems.isActive, true))
    .orderBy(itSystems.nameAr);
    res.json(systems);
  } catch (error) {
    logger.error('Error fetching systems:', { error });
    res.status(500).json({ error: 'فشل في جلب الأنظمة' });
  }
});

router.get('/stats', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const stats = await getDiscoveryStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', { error });
    res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
  }
});

router.get('/logs', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { connectionId, status, limit = '50' } = req.query;
    
    let query = db.select().from(discoveryLogs);
    
    if (connectionId) {
      query = query.where(eq(discoveryLogs.connectionId, parseInt(connectionId as string))) as typeof query;
    }
    
    if (status) {
      query = query.where(eq(discoveryLogs.status, status as string)) as typeof query;
    }
    
    const logs = await query
      .orderBy(desc(discoveryLogs.startedAt))
      .limit(parseInt(limit as string));
    
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching logs:', { error });
    res.status(500).json({ error: 'فشل في جلب السجلات' });
  }
});

router.get('/search', requireAuth, requireDataCatalogAccess, async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'يجب أن يكون البحث على الأقل حرفين' });
    }
    
    const searchTerm = `%${q}%`;
    const results: any = {};
    
    if (type === 'all' || type === 'connections') {
      results.connections = await db.select()
        .from(systemConnections)
        .where(or(
          ilike(systemConnections.name, searchTerm),
          ilike(systemConnections.nameAr || '', searchTerm)
        ))
        .limit(10);
    }
    
    if (type === 'all' || type === 'schemas') {
      results.schemas = await db.select()
        .from(discoveredSchemas)
        .where(or(
          ilike(discoveredSchemas.schemaName, searchTerm),
          ilike(discoveredSchemas.description || '', searchTerm)
        ))
        .limit(10);
    }
    
    if (type === 'all' || type === 'tables') {
      results.tables = await db.select({
        table: discoveredTables,
        schemaName: discoveredSchemas.schemaName
      })
      .from(discoveredTables)
      .leftJoin(discoveredSchemas, eq(discoveredTables.schemaId, discoveredSchemas.id))
      .where(or(
        ilike(discoveredTables.tableName, searchTerm),
        ilike(discoveredTables.description || '', searchTerm)
      ))
      .limit(20);
    }
    
    if (type === 'all' || type === 'columns') {
      results.columns = await db.select({
        column: discoveredColumns,
        tableName: discoveredTables.tableName,
        schemaName: discoveredSchemas.schemaName
      })
      .from(discoveredColumns)
      .leftJoin(discoveredTables, eq(discoveredColumns.tableId, discoveredTables.id))
      .leftJoin(discoveredSchemas, eq(discoveredTables.schemaId, discoveredSchemas.id))
      .where(or(
        ilike(discoveredColumns.columnName, searchTerm),
        ilike(discoveredColumns.businessName || '', searchTerm)
      ))
      .limit(30);
    }
    
    res.json(results);
  } catch (error) {
    logger.error('Error searching catalog:', { error });
    res.status(500).json({ error: 'فشل في البحث' });
  }
});

export default router;
