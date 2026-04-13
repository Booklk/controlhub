import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { 
  sessions, externalSystems, systemHealthLogs, auditLogs, vendors, slaAgreements, slaBreaches, 
  knowledgeBase, documents, dmoRequests, dmoRequestResponses, users, itProjects, itTickets, tasks, 
  votingSessions, decisionVotes, committeeMembers, meetingMinutes, committeeDecisions, 
  committeeMeetings, meetingAttendance, infrastructureServers, infrastructureNetworks, 
  infrastructureStorage, infrastructureMonitoring, itReferrals, itReferralHistory, 
  digitalInitiatives, digitalApplications, cloudServices, customerSatisfaction, 
  securityRiskAssessments, securityVulnerabilities, securityThreats, securityIncidents, 
  departmentTasks, systemPerformanceMetrics, itAssets, kpiMetrics, databaseConnections, 
  discoveredTables, dataFlowMappings, dataAssets, emailIntegrationKeys, notifications, 
  escalations, featureRequests, regulatoryControls, plannerBoards, plannerBuckets, plannerTasks, 
  plannerComments, dataSubjectRequests, dsrSystemActions, consentRecords, privacyNotices, 
  processingRecords, dataBreaches, dataRisks, dataDictionary, dataLineage, complianceReports, 
  ndmoAssessments, dataAgreements, discoveredColumns, discoveredSchemas, discoveryLogs, 
  systemConnections, userBookmarks, quickNotes, alertRules, ticketTemplates, automationRules, 
  externalDataSharingRequests, evidences, committeeTasks, tokenBlacklist, emailQueue
} from "@shared/schema";
import { eq, sql, and, or, isNull, isNotNull, not, inArray, notInArray, desc, gte, ilike } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { cache, TTL, invalidateDashboardCaches } from "../cache";
import { PORTAL_ACCESS, USER_ROLES, hasAuditLogAccess, hasPortalAccess } from "@shared/constants";
import { 
  requirePermission, requireView, requireCreate, requireUpdate, requireDelete,
  requireApprove, requireManage, requireAdmin, requirePortal, requirePortalAndPermission,
  RESOURCES, ACTIONS, hasPermission
} from "../middleware/permissions";
import { sendEmail, generateActivationEmail, generatePasswordResetEmail } from "../email";
import { 
  validateRequest, loginSchema, ticketCreateSchema, ticketUpdateSchema, ticketStatusSchema,
  taskStatusSchema, userUpdateSchema, userToggleSchema,
  idParamSchema, sanitizeObject,
  stripProtectedFields, sanitizeUser, sanitizeDbConnection,
  complianceReportSchema, complianceReportUpdateSchema,
  ndmoAssessmentSchema, ndmoAssessmentUpdateSchema, taskEscalationSchema,
  bulkStatusSchema, bulkIdsSchema,
} from "../middleware/validation";
import { notifyTicketCreated, notifyTicketStatusChanged, notifyProjectCreated, notifyProjectStatusChanged, notifyTaskAssigned, notifySLABreachCreated, startNotificationScheduler } from "../notification-service";
import { testConnection, discoverTables, ConnectionConfig } from "../external-db";
import { logger, publicEndpointRateLimiter } from "../security-middleware";

const ALLOWED_MIMES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'application/zip', 'application/x-rar-compressed',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مسموح'));
    }
  }
});

function parseId(raw: any, res: any): number | null {
  const id = parseInt(raw);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح' });
    return null;
  }
  return id;
}

const JWT_ACCESS_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ALGORITHM = 'HS512' as const;

const getJWTSecret = (): string => {
  if (JWT_ACCESS_SECRET) return JWT_ACCESS_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required');
  }
  return 'dev-only-unsafe-secret-do-not-use-in-production';
};

const getRefreshSecret = (): string => {
  if (JWT_REFRESH_SECRET) return JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: JWT_REFRESH_SECRET environment variable is required');
  }
  return (process.env.SESSION_SECRET || 'dev-session') + ':refresh-v2:' + (process.env.SESSION_SECRET?.slice(-4) || 'xxxx');
};

const MAX_LOGIN_ATTEMPTS = 5;

async function checkLoginAttemptsByDB(email: string): Promise<{ allowed: boolean; remainingAttempts: number; lockedUntil?: Date }> {
  try {
    const [user] = await db.select({ loginAttempts: users.loginAttempts, lockedUntil: users.lockedUntil })
      .from(users).where(eq(users.email, email)).limit(1);
    if (!user) return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { allowed: false, remainingAttempts: 0, lockedUntil: user.lockedUntil };
    }
    const attempts = user.loginAttempts || 0;
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts };
  } catch {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
}

async function recordFailedLoginDB(email: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE users SET
        login_attempts = COALESCE(login_attempts, 0) + 1,
        locked_until = CASE WHEN COALESCE(login_attempts, 0) + 1 >= ${MAX_LOGIN_ATTEMPTS}
          THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END
      WHERE LOWER(email) = LOWER(${email})
    `);
    logger.warn(`[Security] Failed login recorded for: ${email}`);
  } catch (e) {
    logger.warn('[Auth] Could not record failed login in DB');
  }
}

async function clearLoginAttemptsDB(email: string): Promise<void> {
  try {
    await db.execute(sql`UPDATE users SET login_attempts = 0, locked_until = NULL WHERE LOWER(email) = LOWER(${email})`);
  } catch {}
}

const blacklistedJtis = new Set<string>();
let blacklistLastSync = 0;

async function syncBlacklist() {
  const now = Date.now();
  if (now - blacklistLastSync < 30000) return;
  blacklistLastSync = now;
  try {
    const rows = await db.select({ tokenJti: tokenBlacklist.tokenJti })
      .from(tokenBlacklist)
      .where(gte(tokenBlacklist.expiresAt, new Date()));
    blacklistedJtis.clear();
    rows.forEach((r: any) => blacklistedJtis.add(r.tokenJti));
  } catch {}
}

async function blacklistToken(jti: string, userId: number, reason: string = 'logout') {
  try {
    blacklistedJtis.add(jti);
    await db.insert(tokenBlacklist).values({
      tokenJti: jti,
      userId,
      reason,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });
  } catch (e: any) {
    logger.warn('[Auth] Failed to blacklist token:', { error: e?.message });
  }
}

async function cleanExpiredBlacklist() {
  try {
    await db.delete(tokenBlacklist).where(
      sql`${tokenBlacklist.expiresAt} < NOW()`
    );
  } catch {}
}

setInterval(cleanExpiredBlacklist, 60 * 60 * 1000);

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const secret = getJWTSecret();
    const decoded: any = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
    
    if (decoded.jti && blacklistedJtis.has(decoded.jti)) {
      return res.status(401).json({ error: 'تم إبطال هذه الجلسة - يرجى تسجيل الدخول مجدداً' });
    }
    
    syncBlacklist().catch(() => {});
    
    if (decoded.role === 'admin') decoded.role = 'system_admin';
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول مجدداً' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مجدداً' });
    }
    logger.error('[Auth] Token verification error:', { message: error.message });
    return res.status(401).json({ error: 'خطأ في التحقق من الجلسة' });
  }
};

const { 
  ADMIN_PORTALS, IT_DIRECTOR_PORTALS, DMO_PORTALS, COMMITTEE_PORTALS,
  DEPARTMENT_PORTALS, CYBERSECURITY_PORTALS, DATA_REP_PORTALS, STEWARD_PORTALS
} = PORTAL_ACCESS;

const COMMITTEE_READ_ROLES = ['system_admin', 'it_director', 'dmo_manager', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_specialist', 'committee_member'];
const COMMITTEE_WRITE_ROLES = ['system_admin', 'dmo_manager', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_specialist'];
const COMMITTEE_ADMIN_ROLES = ['system_admin', 'committee_chairman', 'committee_rapporteur', 'committee_specialist'];

const requireCommitteeRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
  }
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }
  try {
    const { committeeMembers } = await import("@shared/schema");
    const { eq: eqOp, and: andOp } = await import("drizzle-orm");
    const [member] = await db.select({ committeeRole: committeeMembers.committeeRole })
      .from(committeeMembers)
      .where(andOp(
        eqOp(committeeMembers.userId, req.user.id),
        eqOp(committeeMembers.isActive, true)
      )).limit(1);
    if (member) {
      const roleMap: Record<string, string> = {
        chairman: 'committee_chairman',
        chair: 'committee_chairman',
        vice_chairman: 'committee_vice_chairman',
        vice_chair: 'committee_vice_chairman',
        rapporteur: 'committee_rapporteur',
        specialist_member: 'committee_specialist',
        specialist: 'committee_specialist',
        member: 'committee_member',
      };
      const mappedRole = roleMap[member.committeeRole] || member.committeeRole;
      if (allowedRoles.includes(mappedRole)) {
        req.committeeRole = member.committeeRole;
        return next();
      }
    }
  } catch (err) {
    // fall through to 403
  }
  return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
};

const PORTAL_TO_DEPT_ID: Record<string, number> = {
  infrastructure: 9,
  cybersecurity: 10,
  digital_transformation: 11,
  support: 12,
  dmo: 5,
};

/**
 * Maps PostgreSQL/DB errors to user-friendly Arabic messages
 */
function handleDbError(error: any, res: any, context: string = 'العملية') {
  const code = error?.code;
  if (code === '23505') {
    return res.status(409).json({ error: `${context}: يوجد سجل مكرر بنفس البيانات` });
  }
  if (code === '23503') {
    return res.status(400).json({ error: `${context}: البيانات المرتبطة غير موجودة` });
  }
  if (code === '23502') {
    const column = error?.column || '';
    return res.status(400).json({ error: `${context}: حقل مطلوب غير مزوّد${column ? ` (${column})` : ''}` });
  }
  if (code === '22P02') {
    return res.status(400).json({ error: `${context}: نوع البيانات غير صحيح` });
  }
  logger.error(`[DB] ${context} failed:`, { error: error?.message, code });
  return res.status(500).json({ error: `حدث خطأ أثناء ${context}` });
}

export {
  storage, db, upload, parseId, handleDbError, logger, cache, TTL, invalidateDashboardCaches,
  authenticateToken, getJWTSecret, getRefreshSecret, JWT_ALGORITHM, JWT_ACCESS_SECRET,
  MAX_LOGIN_ATTEMPTS, checkLoginAttemptsByDB, recordFailedLoginDB, clearLoginAttemptsDB,
  blacklistToken, tokenBlacklist, emailQueue,
  bcrypt, jwt, crypto, sql, eq, and, or, isNull, isNotNull, not, inArray, notInArray, desc, gte, ilike,
  sessions, externalSystems, systemHealthLogs, auditLogs, vendors, slaAgreements, slaBreaches,
  knowledgeBase, documents, dmoRequests, dmoRequestResponses, users, itProjects, itTickets, tasks,
  votingSessions, decisionVotes, committeeMembers, meetingMinutes, committeeDecisions,
  committeeMeetings, meetingAttendance, infrastructureServers, infrastructureNetworks,
  infrastructureStorage, infrastructureMonitoring, itReferrals, itReferralHistory,
  digitalInitiatives, digitalApplications, cloudServices, customerSatisfaction,
  securityRiskAssessments, securityVulnerabilities, securityThreats, securityIncidents,
  departmentTasks, systemPerformanceMetrics, itAssets, kpiMetrics, databaseConnections,
  discoveredTables, dataFlowMappings, dataAssets, emailIntegrationKeys, notifications,
  escalations, featureRequests, regulatoryControls, plannerBoards, plannerBuckets, plannerTasks,
  plannerComments, dataSubjectRequests, dsrSystemActions, consentRecords, privacyNotices,
  processingRecords, dataBreaches, dataRisks, dataDictionary, dataLineage, complianceReports,
  ndmoAssessments, dataAgreements, discoveredColumns, discoveredSchemas, discoveryLogs,
  systemConnections, userBookmarks, quickNotes, alertRules, ticketTemplates, automationRules,
  externalDataSharingRequests, evidences, committeeTasks,
  requirePermission, requireView, requireCreate, requireUpdate, requireDelete,
  requireApprove, requireManage, requireAdmin, requirePortal, requirePortalAndPermission,
  RESOURCES, ACTIONS, hasPermission,
  sendEmail, generateActivationEmail, generatePasswordResetEmail,
  validateRequest, loginSchema, ticketCreateSchema, ticketUpdateSchema, ticketStatusSchema,
  taskStatusSchema, userUpdateSchema, userToggleSchema,
  idParamSchema, sanitizeObject,
  stripProtectedFields, sanitizeUser, sanitizeDbConnection,
  complianceReportSchema, complianceReportUpdateSchema,
  ndmoAssessmentSchema, ndmoAssessmentUpdateSchema, taskEscalationSchema,
  bulkStatusSchema, bulkIdsSchema,
  notifyTicketCreated, notifyTicketStatusChanged, notifyProjectCreated, notifyProjectStatusChanged,
  notifyTaskAssigned, notifySLABreachCreated, startNotificationScheduler,
  testConnection, discoverTables,
  publicEndpointRateLimiter,
  ADMIN_PORTALS, IT_DIRECTOR_PORTALS, DMO_PORTALS, COMMITTEE_PORTALS,
  DEPARTMENT_PORTALS, CYBERSECURITY_PORTALS, DATA_REP_PORTALS, STEWARD_PORTALS,
  COMMITTEE_READ_ROLES, COMMITTEE_WRITE_ROLES, COMMITTEE_ADMIN_ROLES,
  requireCommitteeRole, PORTAL_TO_DEPT_ID,
  hasAuditLogAccess, hasPortalAccess, USER_ROLES,
  multer,
};

export type { ConnectionConfig };
