/**
 * Control Hub - Permission Middleware
 * وسيط الصلاحيات - مركز التحكم
 * نادي سباقات الخيل (JCSA)
 */

import { Request, Response, NextFunction } from 'express';
import { 
  hasPermission, 
  canView, 
  canCreate, 
  canUpdate, 
  canDelete, 
  canApprove,
  canManage,
  ACTIONS,
  RESOURCES
} from '@shared/permissions';
import type { Resource, Action } from '@shared/permissions';
import { hasPortalAccess } from '@shared/constants';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    portal: string;
    name: string;
  };
}

/**
 * Middleware to check if user has permission for a specific action on a resource
 * وسيط للتحقق من صلاحية المستخدم لإجراء عملية على مورد معين
 */
export function requirePermission(resource: Resource, action: Action) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ 
        error: 'غير مصرح - يرجى تسجيل الدخول',
        code: 'UNAUTHORIZED'
      });
    }
    
    const hasPerms = hasPermission(userRole, resource, action);
    
    if (!hasPerms) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية لتنفيذ هذه العملية',
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
}

/**
 * Middleware to check view permission
 * وسيط للتحقق من صلاحية العرض
 */
export function requireView(resource: Resource) {
  return requirePermission(resource, ACTIONS.VIEW);
}

/**
 * Middleware to check create permission
 * وسيط للتحقق من صلاحية الإنشاء
 */
export function requireCreate(resource: Resource) {
  return requirePermission(resource, ACTIONS.CREATE);
}

/**
 * Middleware to check update permission
 * وسيط للتحقق من صلاحية التعديل
 */
export function requireUpdate(resource: Resource) {
  return requirePermission(resource, ACTIONS.UPDATE);
}

/**
 * Middleware to check delete permission
 * وسيط للتحقق من صلاحية الحذف
 */
export function requireDelete(resource: Resource) {
  return requirePermission(resource, ACTIONS.DELETE);
}

/**
 * Middleware to check approve permission
 * وسيط للتحقق من صلاحية الموافقة
 */
export function requireApprove(resource: Resource) {
  return requirePermission(resource, ACTIONS.APPROVE);
}

/**
 * Middleware to check manage permission
 * وسيط للتحقق من صلاحية الإدارة الكاملة
 */
export function requireManage(resource: Resource) {
  return requirePermission(resource, ACTIONS.MANAGE);
}

/**
 * Middleware to check portal-based access
 * وسيط للتحقق من الوصول حسب البوابة
 */
export function requirePortal(allowedPortals: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPortal = req.user?.portal;
    
    if (!userPortal || !hasPortalAccess(userPortal, allowedPortals)) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية للوصول لهذا المورد',
        code: 'PORTAL_ACCESS_DENIED'
      });
    }
    
    next();
  };
}

/**
 * Combined middleware: check portal AND permission
 * وسيط مركب: التحقق من البوابة والصلاحية معاً
 */
export function requirePortalAndPermission(
  allowedPortals: string[], 
  resource: Resource, 
  action: Action
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userPortal = req.user?.portal;
    const userRole = req.user?.role;
    
    // Check portal access first
    if (!userPortal || !hasPortalAccess(userPortal, allowedPortals)) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية للوصول لهذا المورد',
        code: 'PORTAL_ACCESS_DENIED'
      });
    }
    
    // Then check specific permission
    if (!userRole || !hasPermission(userRole, resource, action)) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية لتنفيذ هذه العملية',
        code: 'PERMISSION_DENIED',
        resource,
        action
      });
    }
    
    next();
  };
}

/**
 * Middleware to check if user is admin
 * وسيط للتحقق إذا المستخدم مدير نظام
 */
export function requireAdmin() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (userRole !== 'system_admin') {
      return res.status(403).json({ 
        error: 'هذه العملية متاحة لمدير النظام فقط',
        code: 'ADMIN_ONLY'
      });
    }
    
    next();
  };
}

/**
 * Middleware to check multiple permissions (user needs ALL)
 * وسيط للتحقق من صلاحيات متعددة (يجب توفرها جميعاً)
 */
export function requireAllPermissions(permissions: { resource: Resource; action: Action }[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ 
        error: 'غير مصرح - يرجى تسجيل الدخول',
        code: 'UNAUTHORIZED'
      });
    }
    
    const missingPermission = permissions.find(
      p => !hasPermission(userRole, p.resource, p.action)
    );
    
    if (missingPermission) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية لتنفيذ هذه العملية',
        code: 'PERMISSION_DENIED',
        resource: missingPermission.resource,
        action: missingPermission.action
      });
    }
    
    next();
  };
}

/**
 * Middleware to check any of multiple permissions (user needs at least ONE)
 * وسيط للتحقق من أي صلاحية من الصلاحيات المتعددة
 */
export function requireAnyPermission(permissions: { resource: Resource; action: Action }[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ 
        error: 'غير مصرح - يرجى تسجيل الدخول',
        code: 'UNAUTHORIZED'
      });
    }
    
    const hasAny = permissions.some(
      p => hasPermission(userRole, p.resource, p.action)
    );
    
    if (!hasAny) {
      return res.status(403).json({ 
        error: 'عذراً، لا يوجد صلاحية لتنفيذ هذه العملية',
        code: 'PERMISSION_DENIED'
      });
    }
    
    next();
  };
}

// Re-export resources and actions for convenience
export { RESOURCES, ACTIONS, Resource, Action, hasPermission };

// Export AuthenticatedRequest type
export type { AuthenticatedRequest };
