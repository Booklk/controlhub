/**
 * Control Hub - Governance Middleware
 * طبقة الحوكمة المركزية - مركز التحكم
 * نادي سباقات الخيل (JCSA)
 * 
 * يفرض ضوابط الحوكمة على جميع العمليات في النظام
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { hasPermission, ACTIONS, type Resource, type Action } from '@shared/permissions';
import { logger } from '../security-middleware';

const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'token', 'secret', 'apiKey',
  'nationalId', 'bankAccount', 'salary', 'privateNotes'
];

const ACTION_MAP: Record<string, string> = {
  'GET': ACTIONS.VIEW,
  'POST': ACTIONS.CREATE,
  'PUT': ACTIONS.UPDATE,
  'PATCH': ACTIONS.UPDATE,
  'DELETE': ACTIONS.DELETE,
};

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function parseUserAgent(ua: string | undefined): { deviceType: string; browser: string; os: string } {
  if (!ua) return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
  
  let deviceType = 'desktop';
  if (/mobile/i.test(ua)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';

  let browser = 'unknown';
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';

  let os = 'unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';

  return { deviceType, browser, os };
}

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item));
  }
  
  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      masked[key] = '********';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function getChangedFields(oldValue: any, newValue: any): string[] {
  if (!oldValue || !newValue) return [];
  const changed: string[] = [];
  
  for (const key of Object.keys(newValue)) {
    if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export function attachGovernanceContext(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const requestId = randomUUID().split('-')[0];
    const timestamp = new Date();
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgent);
    
    (req as any).governance = {
      requestId,
      timestamp,
      ipAddress,
      userAgent,
      deviceInfo,
      auditTrail: [] as any[],
    };
    
    next();
  };
}

export function auditAllRequests(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    const governance = (req as any).governance || {};
    const user = (req as any).user;
    const session = (req as any).session;
    
    let responseBody: any = null;
    
    res.json = function(body: any) {
      responseBody = body;
      return originalJson(body);
    };
    
    res.on('finish', async () => {
      if (req.path.startsWith('/api/') && !req.path.includes('/health')) {
        if ((req as any)._auditIntercepted && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          return;
        }
        const duration = Date.now() - startTime;
        const action = ACTION_MAP[req.method] || req.method.toLowerCase();
        const isSuccess = res.statusCode < 400;
        
        const entityMatch = req.path.match(/\/api\/([^\/]+)(?:\/(\d+))?/);
        const entityType = entityMatch?.[1] || null;
        const entityId = entityMatch?.[2] ? parseInt(entityMatch[2]) : null;
        
        try {
          await storage.createAuditLog({
            userId: user?.id || null,
            sessionId: session?.id || null,
            action,
            actionCategory: req.method === 'GET' ? 'data_access' : 'data_modification',
            entityType,
            entityId,
            resource: entityType,
            oldValue: (req as any).oldValue ? maskSensitiveData((req as any).oldValue) : null,
            newValue: req.method !== 'GET' && req.method !== 'DELETE' 
              ? maskSensitiveData(req.body) 
              : null,
            changedFields: (req as any).oldValue 
              ? getChangedFields((req as any).oldValue, req.body) 
              : null,
            ipAddress: governance.ipAddress,
            userAgent: governance.userAgent,
            requestId: governance.requestId,
            requestMethod: req.method,
            requestPath: req.path,
            outcome: isSuccess ? 'success' : 'failure',
            severity: res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warning' : 'info',
            policyDecision: null,
            errorMessage: !isSuccess && responseBody?.message ? responseBody.message : null,
            details: `${req.method} ${req.path}`,
            metadata: {
              duration,
              statusCode: res.statusCode,
              queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
              deviceInfo: governance.deviceInfo,
            },
          });
        } catch (error) {
          logger.error('[Governance] Audit log failed:', { error });
        }
      }
    });
    
    next();
  };
}

export function enforcePermissions(resource: Resource): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const governance = (req as any).governance || {};
    
    if (!user) {
      logSecurityEvent('access_denied', 'unauthorized', req, null, resource).catch(() => {});
      return res.status(401).json({
        success: false,
        message: 'يجب تسجيل الدخول للوصول إلى هذا المورد',
        code: 'UNAUTHORIZED'
      });
    }

    const action = ACTION_MAP[req.method] as Action || ACTIONS.VIEW;
    const hasAccess = hasPermission(user.role, resource, action);

    if (!hasAccess) {
      logSecurityEvent('permission_denied', action, req, user.id, resource).catch(() => {});
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية للوصول إلى هذا المورد',
        code: 'FORBIDDEN',
        resource,
        action,
      });
    }
    
    next();
  };
}

export function requireSecureAction(actionType: 'approve' | 'delete' | 'export'): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const governance = (req as any).governance || {};

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'يجب تسجيل الدخول',
        code: 'UNAUTHORIZED'
      });
    }

    try {
      await storage.createAuditLog({
        userId: user.id,
        sessionId: (req as any).session?.id || null,
        action: `secure_${actionType}`,
        actionCategory: 'security',
        entityType: null,
        entityId: null,
        resource: null,
        oldValue: null,
        newValue: null,
        changedFields: null,
        ipAddress: governance.ipAddress,
        userAgent: governance.userAgent,
        requestId: governance.requestId,
        requestMethod: req.method,
        requestPath: req.path,
        outcome: 'success',
        severity: 'warning',
        policyDecision: `${actionType}_initiated`,
        errorMessage: null,
        details: `عملية آمنة: ${actionType}`,
        metadata: { actionType, userId: user.id },
      });
    } catch (error) {
      logger.error('[Governance] Secure action audit failed:', { error });
    }

    next();
  };
}

export function maskSensitiveFields(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      const masked = maskSensitiveData(body);
      return originalJson(masked);
    };
    
    next();
  };
}

export function trackDataAccess(entityType: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const governance = (req as any).governance || {};
    const idParam = req.params.id;
    const entityId = typeof idParam === 'string' ? parseInt(idParam) : null;
    
    if (user && req.method === 'GET') {
      try {
        await storage.createAuditLog({
          userId: user.id,
          sessionId: (req as any).session?.id || null,
          action: 'view',
          actionCategory: 'data_access',
          entityType,
          entityId,
          resource: entityType,
          oldValue: null,
          newValue: null,
          changedFields: null,
          ipAddress: governance.ipAddress,
          userAgent: governance.userAgent,
          requestId: governance.requestId,
          requestMethod: req.method,
          requestPath: req.path,
          outcome: 'success',
          severity: 'info',
          policyDecision: null,
          errorMessage: null,
          details: `عرض ${entityType}${entityId ? ` #${entityId}` : ''}`,
          metadata: { entityType, entityId },
        });
      } catch (error) {
        logger.error('[Governance] Data access tracking failed:', { error });
      }
    }
    
    next();
  };
}

async function logSecurityEvent(
  action: string,
  policyDecision: string,
  req: Request,
  userId: number | null,
  resource?: string
): Promise<void> {
  const governance = (req as any).governance || {};
  
  try {
    await storage.createAuditLog({
      userId,
      sessionId: (req as any).session?.id || null,
      action,
      actionCategory: 'security',
      entityType: null,
      entityId: null,
      resource: resource || null,
      oldValue: null,
      newValue: null,
      changedFields: null,
      ipAddress: governance.ipAddress || getClientIp(req),
      userAgent: governance.userAgent || req.headers['user-agent'],
      requestId: governance.requestId,
      requestMethod: req.method,
      requestPath: req.path,
      outcome: 'denied',
      severity: 'warning',
      policyDecision,
      errorMessage: null,
      details: `حدث أمني: ${action}`,
      metadata: { 
        resource,
        attemptedAction: ACTION_MAP[req.method],
      },
    });
  } catch (error) {
    logger.error('[Governance] Security event logging failed:', { error });
  }
}

export function rateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const key = options.keyGenerator?.(req) || user?.id?.toString() || getClientIp(req);
    const now = Date.now();
    
    let record = requests.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + options.windowMs };
      requests.set(key, record);
    }
    
    record.count++;
    
    if (record.count > options.maxRequests) {
      const governance = (req as any).governance || {};

      try {
        await storage.createAuditLog({
          userId: user?.id || null,
          sessionId: (req as any).session?.id || null,
          action: 'rate_limited',
          actionCategory: 'security',
          entityType: null,
          entityId: null,
          resource: null,
          oldValue: null,
          newValue: null,
          changedFields: null,
          ipAddress: governance.ipAddress || getClientIp(req),
          userAgent: governance.userAgent || req.headers['user-agent'],
          requestId: governance.requestId,
          requestMethod: req.method,
          requestPath: req.path,
          outcome: 'denied',
          severity: 'warning',
          policyDecision: 'rate_limit_exceeded',
          errorMessage: null,
          details: 'تجاوز حد الطلبات المسموح',
          metadata: {
            key,
            count: record.count,
            maxRequests: options.maxRequests,
          },
        });
      } catch (error) {
        logger.error('[Governance] Rate limit audit failed:', { error });
      }

      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
    
    next();
  };
}

export function sessionValidator(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).session;

    if (session) {
      const now = new Date();
      if (session.expiresAt && new Date(session.expiresAt) < now) {
        const governance = (req as any).governance || {};

        try {
          await storage.createAuditLog({
            userId: session.userId,
            sessionId: session.id,
            action: 'session_expired',
            actionCategory: 'auth',
            entityType: null,
            entityId: null,
            resource: null,
            oldValue: null,
            newValue: null,
            changedFields: null,
            ipAddress: governance.ipAddress || getClientIp(req),
            userAgent: governance.userAgent || req.headers['user-agent'],
            requestId: governance.requestId,
            requestMethod: req.method,
            requestPath: req.path,
            outcome: 'denied',
            severity: 'info',
            policyDecision: 'session_expired',
            errorMessage: null,
            details: 'انتهت صلاحية الجلسة',
            metadata: { sessionId: session.id },
          });
        } catch (error) {
          logger.error('[Governance] Session expiry audit failed:', { error });
        }

        return res.status(401).json({
          success: false,
          message: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى',
          code: 'SESSION_EXPIRED',
        });
      }
    }

    next();
  };
}

export { maskSensitiveData, getChangedFields, getClientIp, parseUserAgent };
