/**
 * Control Hub - Centralized Audit Middleware
 * نظام التدقيق المركزي - مركز التحكم
 * نادي سباقات الخيل (JCSA)
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { logger } from '../security-middleware';

export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  SESSION_CREATED: 'session_created',
  SESSION_REVOKED: 'session_revoked',
  
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
  IMPORT: 'import',
  
  PERMISSION_DENIED: 'permission_denied',
  ACCESS_BLOCKED: 'access_blocked',
  RATE_LIMITED: 'rate_limited',
  
  SETTINGS_CHANGED: 'settings_changed',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET: 'password_reset',
  PROFILE_UPDATED: 'profile_updated',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export const AUDIT_CATEGORIES = {
  AUTH: 'auth',
  ACCESS_CONTROL: 'access_control',
  DATA_MODIFICATION: 'data_modification',
  DATA_ACCESS: 'data_access',
  SYSTEM: 'system',
  SECURITY: 'security',
  ADMIN: 'admin',
} as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[keyof typeof AUDIT_CATEGORIES];

export const AUDIT_SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type AuditSeverity = typeof AUDIT_SEVERITY[keyof typeof AUDIT_SEVERITY];

export const AUDIT_OUTCOMES = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  DENIED: 'denied',
  ERROR: 'error',
} as const;

export type AuditOutcome = typeof AUDIT_OUTCOMES[keyof typeof AUDIT_OUTCOMES];

export interface AuditLogEntry {
  userId?: number | null;
  sessionId?: number | null;
  action: string;
  actionCategory?: AuditCategory;
  entityType?: string;
  entityId?: number;
  resource?: string;
  oldValue?: any;
  newValue?: any;
  changedFields?: string[];
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  requestMethod?: string;
  requestPath?: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  policyDecision?: string;
  errorMessage?: string;
  details?: string;
  metadata?: Record<string, any>;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getDeviceInfo(userAgent: string): { deviceType: string; browser: string; os: string } {
  let deviceType = 'desktop';
  let browser = 'unknown';
  let os = 'unknown';

  if (/mobile/i.test(userAgent)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';

  if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  else if (/msie|trident/i.test(userAgent)) browser = 'Internet Explorer';

  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

  return { deviceType, browser, os };
}

export async function createAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    await storage.createAuditLog({
      userId: entry.userId ?? null,
      sessionId: entry.sessionId ?? null,
      action: entry.action,
      actionCategory: entry.actionCategory || null,
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      resource: entry.resource || null,
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      changedFields: entry.changedFields || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      requestId: entry.requestId || null,
      requestMethod: entry.requestMethod || null,
      requestPath: entry.requestPath || null,
      outcome: entry.outcome || AUDIT_OUTCOMES.SUCCESS,
      severity: entry.severity || AUDIT_SEVERITY.INFO,
      policyDecision: entry.policyDecision || null,
      errorMessage: entry.errorMessage || null,
      details: entry.details || null,
      metadata: entry.metadata || null,
    });
  } catch (error) {
    logger.error('[Audit] Failed to create audit entry:', { error });
  }
}

export function attachRequestId(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).requestId = randomUUID().split('-')[0];
    next();
  };
}

export function auditRequest(options: {
  action: AuditAction;
  category: AuditCategory;
  resource?: string;
  entityType?: string;
  severity?: AuditSeverity;
  getEntityId?: (req: Request) => number | undefined;
  getDetails?: (req: Request) => string | undefined;
  getMetadata?: (req: Request) => Record<string, any> | undefined;
}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalEnd = res.end;
    const startTime = Date.now();

    res.end = function(this: Response, ...args: any[]) {
      const duration = Date.now() - startTime;
      const outcome = res.statusCode >= 400 ? AUDIT_OUTCOMES.FAILURE : AUDIT_OUTCOMES.SUCCESS;
      const severity = res.statusCode >= 500 ? AUDIT_SEVERITY.ERROR : 
                       res.statusCode >= 400 ? AUDIT_SEVERITY.WARNING : 
                       options.severity || AUDIT_SEVERITY.INFO;

      createAuditEntry({
        userId: (req as any).user?.id,
        sessionId: (req as any).session?.id,
        action: options.action,
        actionCategory: options.category,
        entityType: options.entityType,
        entityId: options.getEntityId?.(req),
        resource: options.resource,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        requestId: (req as any).requestId,
        requestMethod: req.method,
        requestPath: req.path,
        outcome,
        severity,
        details: options.getDetails?.(req),
        metadata: {
          ...options.getMetadata?.(req),
          duration,
          statusCode: res.statusCode,
        },
      }).catch((e: any) => logger.error('[Audit] Write error', { error: e?.message }));

      return originalEnd.apply(this, args as any);
    };

    next();
  };
}

export function auditDataModification(options: {
  resource: string;
  entityType: string;
  action: 'create' | 'update' | 'delete';
  getEntityId?: (req: Request) => number | undefined;
  getOldValue?: (req: Request) => any;
  getNewValue?: (req: Request) => any;
  getChangedFields?: (req: Request) => string[];
}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(this: Response, body: any) {
      const outcome = res.statusCode >= 400 ? AUDIT_OUTCOMES.FAILURE : AUDIT_OUTCOMES.SUCCESS;

      createAuditEntry({
        userId: (req as any).user?.id,
        sessionId: (req as any).session?.id,
        action: options.action,
        actionCategory: AUDIT_CATEGORIES.DATA_MODIFICATION,
        entityType: options.entityType,
        entityId: options.getEntityId?.(req) || body?.id,
        resource: options.resource,
        oldValue: options.getOldValue?.(req),
        newValue: options.getNewValue?.(req) || (options.action !== 'delete' ? body : undefined),
        changedFields: options.getChangedFields?.(req),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        requestId: (req as any).requestId,
        requestMethod: req.method,
        requestPath: req.path,
        outcome,
        severity: options.action === 'delete' ? AUDIT_SEVERITY.WARNING : AUDIT_SEVERITY.INFO,
        details: `${options.action} ${options.entityType}`,
      }).catch((e: any) => logger.error('[Audit] Write error', { error: e?.message }));

      return originalJson.call(this, body);
    };

    next();
  };
}

export function auditSecurityEvent(
  action: AuditAction,
  severity: AuditSeverity,
  details: {
    userId?: number;
    sessionId?: number;
    ipAddress: string;
    userAgent?: string;
    policyDecision?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): void {
  createAuditEntry({
    userId: details.userId,
    sessionId: details.sessionId,
    action,
    actionCategory: AUDIT_CATEGORIES.SECURITY,
    ipAddress: details.ipAddress,
    userAgent: details.userAgent,
    outcome: severity === AUDIT_SEVERITY.ERROR || severity === AUDIT_SEVERITY.CRITICAL 
      ? AUDIT_OUTCOMES.FAILURE 
      : AUDIT_OUTCOMES.SUCCESS,
    severity,
    policyDecision: details.policyDecision,
    errorMessage: details.errorMessage,
    metadata: details.metadata,
  }).catch((e: any) => logger.error('[Audit] Write error', { error: e?.message }));
}

export function auditLogin(
  success: boolean,
  userId: number | undefined,
  sessionId: number | undefined,
  ipAddress: string,
  userAgent: string | undefined,
  metadata?: Record<string, any>
): void {
  createAuditEntry({
    userId,
    sessionId,
    action: success ? AUDIT_ACTIONS.LOGIN : AUDIT_ACTIONS.LOGIN_FAILED,
    actionCategory: AUDIT_CATEGORIES.AUTH,
    ipAddress,
    userAgent,
    outcome: success ? AUDIT_OUTCOMES.SUCCESS : AUDIT_OUTCOMES.FAILURE,
    severity: success ? AUDIT_SEVERITY.INFO : AUDIT_SEVERITY.WARNING,
    details: success ? 'تسجيل دخول ناجح' : 'فشل في تسجيل الدخول',
    metadata,
  }).catch((e: any) => logger.error('[Audit] Write error', { error: e?.message }));
}

export function auditLogout(
  userId: number,
  sessionId: number | undefined,
  ipAddress: string,
  userAgent: string | undefined
): void {
  createAuditEntry({
    userId,
    sessionId,
    action: AUDIT_ACTIONS.LOGOUT,
    actionCategory: AUDIT_CATEGORIES.AUTH,
    ipAddress,
    userAgent,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    severity: AUDIT_SEVERITY.INFO,
    details: 'تسجيل خروج',
  }).catch((e: any) => logger.error('[Audit] Write error', { error: e?.message }));
}

const ENTITY_TYPE_ENTRIES: [string, string][] = [
  ['planner/boards', 'planner_board'],
  ['planner/buckets', 'planner_bucket'],
  ['planner/tasks', 'planner_task'],
  ['planner/comments', 'planner_comment'],
  ['committee-meetings', 'committee_meeting'],
  ['committee-decisions', 'committee_decision'],
  ['committee-tasks', 'committee_task'],
  ['committee', 'committee'],
  ['security-incidents', 'security_incident'],
  ['security-threats', 'security_threat'],
  ['security-vulnerabilities', 'security_vulnerability'],
  ['security-risk', 'security_risk'],
  ['digital-initiatives', 'digital_initiative'],
  ['digital-applications', 'digital_application'],
  ['cloud-services', 'cloud_service'],
  ['infrastructure/servers', 'server'],
  ['infrastructure/networks', 'network'],
  ['infrastructure/storage', 'inf_storage'],
  ['infrastructure/monitoring', 'monitoring'],
  ['data-catalog', 'data_catalog'],
  ['data-dictionary', 'data_dictionary'],
  ['data-lineage', 'data_lineage'],
  ['data-quality', 'data_quality'],
  ['data-breaches', 'data_breach'],
  ['data-risks', 'data_risk'],
  ['data-agreements', 'data_agreement'],
  ['database-connections', 'database_connection'],
  ['privacy-notices', 'privacy_notice'],
  ['processing-records', 'processing_record'],
  ['feature-requests', 'feature_request'],
  ['alert-rules', 'alert_rule'],
  ['automation-rules', 'automation_rule'],
  ['external-systems', 'external_system'],
  ['regulatory-controls', 'regulatory_control'],
  ['knowledge-base', 'knowledge_article'],
  ['quick-notes', 'quick_note'],
  ['ndmo', 'ndmo_assessment'],
  ['tickets', 'ticket'],
  ['tasks', 'task'],
  ['projects', 'project'],
  ['users', 'user'],
  ['referrals', 'referral'],
  ['dmo', 'dmo_request'],
  ['compliance', 'compliance'],
  ['dsr', 'data_subject_request'],
  ['consent', 'consent_record'],
  ['vendors', 'vendor'],
  ['sla', 'sla_agreement'],
  ['assets', 'asset'],
  ['kpi', 'kpi_metric'],
  ['documents', 'document'],
  ['escalations', 'escalation'],
  ['notifications', 'notification'],
  ['bookmarks', 'bookmark'],
  ['evidences', 'evidence'],
  ['voting', 'voting_session'],
];

const SUB_ACTION_PATTERNS: [RegExp, string][] = [
  [/reset-password/, 'password_reset'],
  [/toggle-status/, 'update'],
  [/activate/, 'update'],
  [/deactivate/, 'update'],
  [/approve/, 'approve'],
  [/reject/, 'reject'],
  [/export/, 'export'],
  [/import/, 'import'],
  [/move/, 'update'],
  [/duplicate/, 'create'],
  [/notify/, 'create'],
  [/send/, 'create'],
  [/save-template/, 'create'],
  [/from-template/, 'create'],
  [/attachments/, 'update'],
  [/dependencies/, 'update'],
  [/recurrence/, 'update'],
  [/comments/, 'create'],
];

const ACTION_MAP: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

function resolveEntityType(path: string): string | null {
  const clean = path.replace(/^\/api\//, '');
  for (const [pattern, entity] of ENTITY_TYPE_ENTRIES) {
    if (clean.startsWith(pattern)) return entity;
  }
  return null;
}

function resolveAction(method: string, path: string): string {
  for (const [pattern, action] of SUB_ACTION_PATTERNS) {
    if (pattern.test(path)) return action;
  }
  return ACTION_MAP[method] || method.toLowerCase();
}

function extractEntityId(path: string): number | undefined {
  const matches = path.match(/\/(\d+)(?:\/|$)/);
  return matches ? parseInt(matches[1]) : undefined;
}

export function universalAuditInterceptor(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.includes('/api/auth/') || req.path.includes('/api/csrf') || req.path.includes('/api/audit')) return next();
    if (req.path.includes('/api/admin/') || req.path.includes('/api/export/')) return next();

    const entityType = resolveEntityType(req.path);
    if (!entityType) return next();

    const action = resolveAction(method, req.path);
    const entityId = extractEntityId(req.path);
    const startTime = Date.now();
    const originalJson = res.json;
    let alreadyLogged = false;

    (req as any)._auditIntercepted = true;

    res.json = function(this: Response, body: any) {
      if (alreadyLogged) return originalJson.call(this, body);
      alreadyLogged = true;

      const duration = Date.now() - startTime;
      const outcome = res.statusCode >= 400 ? AUDIT_OUTCOMES.FAILURE : AUDIT_OUTCOMES.SUCCESS;
      const severity = action === 'delete' ? AUDIT_SEVERITY.WARNING :
                       res.statusCode >= 500 ? AUDIT_SEVERITY.ERROR :
                       res.statusCode >= 400 ? AUDIT_SEVERITY.WARNING : AUDIT_SEVERITY.INFO;

      createAuditEntry({
        userId: (req as any).user?.id,
        action,
        actionCategory: AUDIT_CATEGORIES.DATA_MODIFICATION,
        entityType,
        entityId: entityId || body?.id,
        resource: entityType,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        requestId: (req as any).requestId,
        requestMethod: method,
        requestPath: req.path,
        outcome,
        severity,
        details: `${action} ${entityType}${entityId ? ` #${entityId}` : ''}`,
        metadata: { duration, statusCode: res.statusCode, portal: (req as any).user?.portal },
      }).catch(() => {});

      return originalJson.call(this, body);
    };

    next();
  };
}

export { getClientIp, getDeviceInfo };
