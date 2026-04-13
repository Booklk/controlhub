import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db';
import { integrationConfigs } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Zod schemas for webhook validation
const webhookCreateSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(200),
  url: z.string().url('رابط غير صالح').refine(
    (url) => url.startsWith('https://'),
    'يجب أن يبدأ الرابط بـ https:// للأمان'
  ),
  events: z.array(z.string()).min(1, 'يجب اختيار حدث واحد على الأقل'),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(100).max(60000).default(1000),
  }).optional(),
});

const webhookUpdateSchema = webhookCreateSchema.partial();

// Zod schemas for LDAP configuration validation
const ldapConfigSchema = z.object({
  url: z.string().url('رابط LDAP غير صالح'),
  baseDn: z.string().min(1, 'Base DN مطلوب'),
  bindDn: z.string().min(1, 'Bind DN مطلوب'),
  bindPassword: z.string().min(1, 'كلمة المرور مطلوبة'),
  searchBase: z.string().optional(),
  searchFilter: z.string().optional(),
  tlsEnabled: z.boolean().optional().default(false),
}).strict();

// Zod schemas for Monitoring configuration validation
const monitoringConfigSchema = z.object({
  type: z.enum(['zabbix', 'nagios', 'prometheus', 'custom']),
  url: z.string().url('رابط API غير صالح'),
  apiKey: z.string().min(1, 'مفتاح API مطلوب'),
  refreshInterval: z.number().min(10000).max(3600000).optional().default(60000),
  timeout: z.number().min(1000).max(30000).optional().default(10000),
}).strict();

// Zod schemas for SIEM configuration validation
const siemConfigSchema = z.object({
  type: z.enum(['splunk', 'qradar', 'elastic', 'arcsight', 'custom']),
  url: z.string().url('رابط API غير صالح'),
  apiKey: z.string().min(1, 'مفتاح API مطلوب'),
  username: z.string().optional(),
  password: z.string().optional(),
  index: z.string().optional(),
  timeout: z.number().min(1000).max(30000).optional().default(10000),
}).strict();

// Zod schemas for ERP configuration validation
const erpConfigSchema = z.object({
  type: z.enum(['sap', 'oracle', 'dynamics', 'odoo', 'custom']),
  url: z.string().url('رابط API غير صالح'),
  apiKey: z.string().min(1, 'مفتاح API مطلوب'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  timeout: z.number().min(1000).max(30000).optional().default(10000),
}).strict();

// Using centralized RBAC middleware from permissions.ts
import { requirePortal, RESOURCES, ACTIONS } from '../middleware/permissions';

// Admin portals that can access integration settings
const INTEGRATION_ADMIN_PORTALS = ['admin', 'it_director', 'dmo'];
const requireIntegrationAdmin = requirePortal(INTEGRATION_ADMIN_PORTALS);

import {
  parseExcelFile,
  parseCsvFile,
  processImport,
  getImportTemplate,
  generateExcelTemplate,
  ImportType
} from '../integrations/excelImport';
import {
  isLdapConfigured,
  testLdapConnection,
  getLdapConfig,
  syncLdapUsers,
  authenticateLdapUser
} from '../integrations/ldapIntegration';
import {
  isMonitoringConfigured,
  getInfrastructureDashboard,
  syncMonitoringData,
  testMonitoringConnection,
  setMonitoringConfig
} from '../integrations/monitoringIntegration';
import {
  isSiemConfigured,
  getSecurityDashboard,
  syncSiemData,
  testSiemConnection,
  setSiemConfig
} from '../integrations/siemIntegration';
import {
  isErpConfigured,
  getErpDashboard,
  syncErpData,
  testErpConnection,
  setErpConfig
} from '../integrations/erpIntegration';
import {
  registerWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  testWebhook,
  getWebhookStats,
  generateWebhookSecret,
  webhookEvents
} from '../integrations/webhooks';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

export async function loadIntegrationConfigs(): Promise<void> {
  try {
    const rows = await db.select().from(integrationConfigs);
    for (const row of rows) {
      if (row.integrationType === 'siem' && row.config) {
        setSiemConfig(row.config as any);
      } else if (row.integrationType === 'erp' && row.config) {
        setErpConfig(row.config as any);
      } else if (row.integrationType === 'monitoring' && row.config) {
        setMonitoringConfig(row.config as any);
      }
    }
  } catch (_e) {}
}

async function saveIntegrationConfig(type: string, config: Record<string, any>, userId?: number): Promise<void> {
  await db.insert(integrationConfigs)
    .values({ integrationType: type, config, updatedAt: new Date(), updatedBy: userId ?? null })
    .onConflictDoUpdate({
      target: integrationConfigs.integrationType,
      set: { config, updatedAt: new Date(), updatedBy: userId ?? null },
    });
}

// Helper functions to convert schema data to integration interface types
function toLdapConfig(data: z.infer<typeof ldapConfigSchema>) {
  return {
    url: data.url,
    baseDN: data.baseDn,
    bindDN: data.bindDn,
    bindPassword: data.bindPassword,
    userSearchBase: data.searchBase || '',
    userSearchFilter: data.searchFilter || '(objectClass=person)',
    usernameAttribute: 'sAMAccountName',
    emailAttribute: 'mail',
    displayNameAttribute: 'displayName',
  };
}

function toMonitoringConfig(data: z.infer<typeof monitoringConfigSchema>) {
  return {
    type: data.type,
    apiUrl: data.url,
    apiKey: data.apiKey,
    refreshInterval: data.refreshInterval,
  };
}

function toSiemConfig(data: z.infer<typeof siemConfigSchema>) {
  return {
    type: data.type,
    apiUrl: data.url,
    apiKey: data.apiKey,
    username: data.username,
    password: data.password,
    index: data.index,
  };
}

function toErpConfig(data: z.infer<typeof erpConfigSchema>) {
  return {
    type: data.type,
    apiUrl: data.url,
    apiKey: data.apiKey,
  };
}

// ========================
// IMPORT ROUTES
// ========================

router.post('/import/preview', requireIntegrationAdmin, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'الملف مطلوب' });
    }
    
    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'xlsx';
    let data: any[];
    
    if (fileType === 'xlsx') {
      data = await parseExcelFile(req.file.buffer);
    } else {
      data = await parseCsvFile(req.file.buffer);
    }
    
    res.json({
      success: true,
      rowCount: data.length,
      columns: data.length > 0 ? Object.keys(data[0]) : [],
      preview: data.slice(0, 10)
    });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/import/:type', requireIntegrationAdmin, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'الملف مطلوب', code: 'FILE_REQUIRED' });
    }
    
    const importType = req.params.type as ImportType;
    const validTypes = ['users', 'tickets', 'projects', 'tasks', 'assets', 'departments'];
    
    if (!validTypes.includes(importType)) {
      return res.status(400).json({ error: 'نوع الاستيراد غير صحيح', code: 'INVALID_IMPORT_TYPE' });
    }
    
    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'xlsx';
    const userId = req.user?.id || 1;
    const result = await processImport(req.file.buffer, fileType, importType, userId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'خطأ في الاستيراد', code: 'IMPORT_ERROR' });
  }
});

router.get('/import/template/:type', requireIntegrationAdmin, (req, res) => {
  try {
    const importType = req.params.type as ImportType;
    const template = getImportTemplate(importType);
    
    res.json({
      success: true,
      type: importType,
      template,
      columns: template.length > 0 ? Object.keys(template[0]) : []
    });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.get('/import/template/:type/download', requireIntegrationAdmin, (req, res) => {
  try {
    const importType = req.params.type as ImportType;
    const buffer = generateExcelTemplate(importType);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=template_${importType}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// LDAP ROUTES
// ========================

router.get('/ldap/status', requireIntegrationAdmin, (req, res) => {
  res.json({
    configured: isLdapConfigured(),
    config: isLdapConfigured() ? getLdapConfig() : null
  });
});

router.post('/ldap/test', requireIntegrationAdmin, async (req, res) => {
  try {
    const validation = ldapConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const result = await testLdapConnection(toLdapConfig(validation.data));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.post('/ldap/sync', requireIntegrationAdmin, async (req, res) => {
  try {
    const result = await syncLdapUsers();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// Zod schema for LDAP authentication validation
const ldapAuthenticateSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
}).strict();

router.post('/ldap/authenticate', requireIntegrationAdmin, async (req, res) => {
  try {
    const validation = ldapAuthenticateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const { username, password } = validation.data;
    const result = await authenticateLdapUser(username, password);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// MONITORING ROUTES
// ========================

router.get('/monitoring/status', requireIntegrationAdmin, (req, res) => {
  res.json({
    configured: isMonitoringConfigured()
  });
});

router.get('/monitoring/dashboard', requireIntegrationAdmin, async (req, res) => {
  try {
    const dashboard = await getInfrastructureDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/monitoring/sync', requireIntegrationAdmin, async (req, res) => {
  try {
    const result = await syncMonitoringData();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

router.post('/monitoring/test', requireIntegrationAdmin, async (req, res) => {
  try {
    const validation = monitoringConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const result = await testMonitoringConnection(toMonitoringConfig(validation.data));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/monitoring/config', requireIntegrationAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationType, 'monitoring'));
    res.json(row ? { configured: true, config: row.config, updatedAt: row.updatedAt } : { configured: false });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/monitoring/config', requireIntegrationAdmin, async (req: any, res) => {
  try {
    const validation = monitoringConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const cfg = toMonitoringConfig(validation.data);
    setMonitoringConfig(cfg);
    await saveIntegrationConfig('monitoring', cfg as any, req.user?.id);
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// SIEM ROUTES
// ========================

router.get('/siem/status', requireIntegrationAdmin, (req, res) => {
  res.json({
    configured: isSiemConfigured()
  });
});

router.get('/siem/dashboard', requireIntegrationAdmin, async (req, res) => {
  try {
    const dashboard = await getSecurityDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/siem/sync', requireIntegrationAdmin, async (req, res) => {
  try {
    const result = await syncSiemData();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

router.post('/siem/test', requireIntegrationAdmin, async (req, res) => {
  try {
    const validation = siemConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const result = await testSiemConnection(toSiemConfig(validation.data));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/siem/config', requireIntegrationAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationType, 'siem'));
    res.json(row ? { configured: true, config: row.config, updatedAt: row.updatedAt } : { configured: false });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/siem/config', requireIntegrationAdmin, async (req: any, res) => {
  try {
    const validation = siemConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const cfg = toSiemConfig(validation.data);
    setSiemConfig(cfg);
    await saveIntegrationConfig('siem', cfg as any, req.user?.id);
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// ERP ROUTES
// ========================

router.get('/erp/status', requireIntegrationAdmin, (req, res) => {
  res.json({
    configured: isErpConfigured()
  });
});

router.get('/erp/dashboard', requireIntegrationAdmin, async (req, res) => {
  try {
    const dashboard = await getErpDashboard();
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/erp/sync', requireIntegrationAdmin, async (req, res) => {
  try {
    const result = await syncErpData();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

router.post('/erp/test', requireIntegrationAdmin, async (req, res) => {
  try {
    const validation = erpConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const result = await testErpConnection(toErpConfig(validation.data));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/erp/config', requireIntegrationAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.integrationType, 'erp'));
    res.json(row ? { configured: true, config: row.config, updatedAt: row.updatedAt } : { configured: false });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/erp/config', requireIntegrationAdmin, async (req: any, res) => {
  try {
    const validation = erpConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات غير صالحة',
        details: validation.error.errors 
      });
    }
    const cfg = toErpConfig(validation.data);
    setErpConfig(cfg);
    await saveIntegrationConfig('erp', cfg as any, req.user?.id);
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// WEBHOOK ROUTES
// ========================

router.get('/webhooks', requireIntegrationAdmin, async (req, res) => {
  try {
    const webhookList = await listWebhooks();
    res.json(webhookList);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.get('/webhooks/events', requireIntegrationAdmin, (req, res) => {
  res.json(webhookEvents);
});

router.get('/webhooks/stats', requireIntegrationAdmin, async (req, res) => {
  try {
    const stats = await getWebhookStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.get('/webhooks/secret', requireIntegrationAdmin, (req, res) => {
  res.json({ secret: generateWebhookSecret() });
});

router.get('/webhooks/:id', requireIntegrationAdmin, async (req, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const webhookId = parseInt(idParam, 10);
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: 'معرف Webhook غير صحيح' });
    }
    const webhook = await getWebhook(webhookId);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook غير موجود' });
    }
    res.json(webhook);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/webhooks', requireIntegrationAdmin, async (req: any, res) => {
  try {
    const validation = webhookCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'بيانات غير صالحة', 
        details: validation.error.errors 
      });
    }
    
    const userId = req.user?.id || null;
    const result = await registerWebhook(validation.data, userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.put('/webhooks/:id', requireIntegrationAdmin, async (req, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const webhookId = parseInt(idParam, 10);
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: 'معرف Webhook غير صحيح' });
    }
    
    const validation = webhookUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'بيانات غير صالحة', 
        details: validation.error.errors 
      });
    }
    
    const success = await updateWebhook(webhookId, validation.data);
    if (!success) {
      return res.status(404).json({ error: 'Webhook غير موجود' });
    }
    const updatedWebhook = await getWebhook(webhookId);
    res.json(updatedWebhook);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.delete('/webhooks/:id', requireIntegrationAdmin, async (req, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const webhookId = parseInt(idParam, 10);
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: 'معرف Webhook غير صحيح' });
    }
    const deleted = await deleteWebhook(webhookId);
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook غير موجود' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/webhooks/:id/test', requireIntegrationAdmin, async (req, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const webhookId = parseInt(idParam, 10);
    if (isNaN(webhookId)) {
      return res.status(400).json({ error: 'معرف Webhook غير صحيح' });
    }
    const result = await testWebhook(webhookId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// ========================
// INTEGRATION STATUS
// ========================

router.get('/status', requireIntegrationAdmin, async (req, res) => {
  try {
    const webhookList = await listWebhooks();
    res.json({
      ldap: {
        configured: isLdapConfigured(),
        name: 'LDAP / Active Directory'
      },
      monitoring: {
        configured: isMonitoringConfigured(),
        name: 'نظام المراقبة (Zabbix/Prometheus)'
      },
      siem: {
        configured: isSiemConfigured(),
        name: 'نظام SIEM'
      },
      erp: {
        configured: isErpConfigured(),
        name: 'نظام ERP'
      },
      webhooks: {
        configured: true,
        count: webhookList.length,
        name: 'Webhooks'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

export default router;
