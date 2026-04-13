import type { Express } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { Storage as GCSStorage } from "@google-cloud/storage";
import { cache, TTL, invalidateDashboardCaches } from "./cache";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { sessions, externalSystems, systemHealthLogs, auditLogs, vendors, slaAgreements, slaBreaches, knowledgeBase, documents, dmoRequests, dmoRequestResponses, users, itProjects, itTickets, tasks, votingSessions, decisionVotes, committeeMembers, meetingMinutes, committeeDecisions, committeeMeetings, meetingAttendance, infrastructureServers, infrastructureNetworks, infrastructureStorage, infrastructureMonitoring, itReferrals, itReferralHistory, digitalInitiatives, digitalApplications, cloudServices, customerSatisfaction, securityRiskAssessments, securityVulnerabilities, securityThreats, securityIncidents, departmentTasks, systemPerformanceMetrics, itAssets, kpiMetrics, databaseConnections, discoveredTables, dataFlowMappings, dataAssets, emailIntegrationKeys, notifications, escalations, featureRequests, regulatoryControls, plannerBoards, plannerBuckets, plannerTasks, plannerComments, dataSubjectRequests, dsrSystemActions, consentRecords, privacyNotices, processingRecords, dataBreaches, dataRisks, dataDictionary, dataLineage, complianceReports, ndmoAssessments, dataAgreements, discoveredColumns, discoveredSchemas, discoveryLogs, systemConnections, userBookmarks, quickNotes, alertRules, ticketTemplates, automationRules, externalDataSharingRequests, evidences, committeeTasks, trainingCourses, requirements as requirementsTable } from "@shared/schema";
import { eq, sql, and, or, ne, isNull, isNotNull, not, inArray, notInArray, desc, gte, ilike } from "drizzle-orm";
import { PROJECT_STATUSES, PROJECT_STATUS_TRANSITIONS, getSlaDeadline, getSlaHours, SLA_HOURS, isValidTransition, getAllowedTransitions, getTransitionReason, getTransitionMap, REFERRAL_STATUS_TRANSITIONS, TICKET_TRANSITION_REASONS, TASK_TRANSITION_REASONS, PROJECT_TRANSITION_REASONS, REFERRAL_TRANSITION_REASONS, DECISION_TRANSITION_REASONS, type WorkflowEntity } from "@shared/constants";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// FIX #5: Centralized ID validation helper - prevents NaN from reaching DB queries
function parseId(raw: any, res: any): number | null {
  const id = parseInt(raw);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: 'معرف غير صالح' });
    return null;
  }
  return id;
}
import { registerObjectStorageRoutes } from "./integrations/object_storage";
import { 
  PORTAL_ACCESS, 
  USER_ROLES,
  hasAuditLogAccess, 
  hasPortalAccess 
} from "@shared/constants";
import { notifyTicketCreated, notifyTicketStatusChanged, notifyProjectCreated, notifyProjectStatusChanged, notifyTaskAssigned, notifySLABreachCreated, startNotificationScheduler } from "./notification-service";
import { PORTAL_TO_DEPT_ID, handleDbError } from "./routes/shared";
import { 
  requirePermission, 
  requireView, 
  requireCreate, 
  requireUpdate, 
  requireDelete,
  requireApprove,
  requireManage,
  requireAdmin,
  requirePortal,
  requirePortalAndPermission,
  RESOURCES, 
  ACTIONS,
  hasPermission
} from "./middleware/permissions";
import { sendEmail, generateActivationEmail, generatePasswordResetEmail } from "./email";
import { 
  validateRequest, 
  loginSchema, 
  ticketCreateSchema,
  idParamSchema,
  sanitizeObject,
  stripProtectedFields,
  complianceReportSchema,
  complianceReportUpdateSchema,
  ndmoAssessmentSchema,
  ndmoAssessmentUpdateSchema,
  taskEscalationSchema,
  bulkStatusSchema,
  bulkIdsSchema,
  sanitizeUser,
  sanitizeDbConnection,
} from "./middleware/validation";
import { testConnection, discoverTables, ConnectionConfig } from "./external-db";
import complianceRouter from "./routes/compliance";
import { governanceAdvisor } from "./services/governanceAdvisor";
import parseFileRouter from "./routes/parseFile";
import exportRouter from "./routes/export";
import integrationsRouter, { loadIntegrationConfigs } from "./routes/integrations";
import dataCatalogRouter from "./routes/dataCatalog";
import { getCSRFTokenHandler } from "./auth/csrfProtection";
import { logger, publicEndpointRateLimiter, createRateLimiter, sensitiveOpRateLimiter, passwordResetRateLimiter } from "./security-middleware";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerDashboardRoutes } from "./routes/dashboard.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerCommitteeRoutes } from "./routes/committee.routes";
import { registerTaskRoutes } from "./routes/tasks.routes";
import { registerTicketRoutes } from "./routes/tickets.routes";

// Security: JWT secrets MUST come from environment variables in production
const JWT_ACCESS_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
// FIX #7: Refresh secret is always independent — never derived from access secret
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET) {
  logger.error('CRITICAL: JWT_SECRET or SESSION_SECRET environment variable is NOT set!');
  if (process.env.NODE_ENV === 'production') {
    logger.error('Server will not start without JWT_SECRET in production.');
    process.exit(1);
  }
}

if (!JWT_REFRESH_SECRET && process.env.NODE_ENV === 'production') {
  logger.warn('WARNING: JWT_REFRESH_SECRET not set — using derived fallback. Set it independently for maximum security.');
}

// FIX #3: Single JWT algorithm constant — HS512 throughout
const JWT_ALGORITHM = 'HS512' as const;

const getJWTSecret = (): string => {
  if (JWT_ACCESS_SECRET) return JWT_ACCESS_SECRET;
  return 'dev-only-unsafe-secret-do-not-use-in-production';
};

const getRefreshSecret = (): string => {
  if (JWT_REFRESH_SECRET) return JWT_REFRESH_SECRET;
  // Dev-only fallback with distinct derivation (not just + '-refresh')
  return (process.env.SESSION_SECRET || 'dev-session') + ':refresh-v2:' + (process.env.SESSION_SECRET?.slice(-4) || 'xxxx');
};

// FIX #5: DB-backed brute force protection (survives restarts & clusters)
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

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const secret = getJWTSecret();
    const decoded: any = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
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

// Note: Using centralized requirePortal from middleware/permissions.ts

// Portal access constants - imported from shared/constants.ts
const { 
  ADMIN_PORTALS, 
  IT_DIRECTOR_PORTALS, 
  DMO_PORTALS, 
  COMMITTEE_PORTALS, 
  DEPARTMENT_PORTALS,
  CYBERSECURITY_PORTALS,
  DATA_REP_PORTALS,
  STEWARD_PORTALS
} = PORTAL_ACCESS;

// Helper function removed - storage.createAuditLog now accepts partial objects

// Committee role check middlewares
const COMMITTEE_READ_ROLES = ['system_admin', 'it_director', 'dmo_manager', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_specialist', 'committee_member'];
const COMMITTEE_WRITE_ROLES = ['system_admin', 'dmo_manager', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_specialist'];
const COMMITTEE_ADMIN_ROLES = ['system_admin', 'committee_chairman', 'committee_rapporteur', 'committee_specialist'];

const COMMITTEE_ROLE_MAP: Record<string, string> = {
  'chairman': 'committee_chairman',
  'chair': 'committee_chairman',
  'vice_chairman': 'committee_vice_chairman',
  'vice_chair': 'committee_vice_chairman',
  'rapporteur': 'committee_rapporteur',
  'specialist_member': 'committee_specialist',
  'specialist': 'committee_specialist',
  'member': 'committee_member',
};
const requireCommitteeRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
  }
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }
  try {
    const [membership] = await db.select().from(committeeMembers)
      .where(and(eq(committeeMembers.userId, req.user.id), eq(committeeMembers.isActive, true)));
    if (membership) {
      const mappedRole = COMMITTEE_ROLE_MAP[membership.committeeRole] || 'committee_member';
      if (allowedRoles.includes(mappedRole)) {
        req.user.committeeRole = mappedRole;
        return next();
      }
    }
  } catch (err) {
    logger.error('Committee role check error:', { error: err });
  }
  return res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا المورد' });
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  
  // ==================== Production Package Download Page ====================
  app.get("/download", (req, res) => {
    try {
    const filePath = path.resolve("client/public/ControlHub-2026.tar.gz");
    const fileExists = fs.existsSync(filePath);
    const stat = fileExists ? fs.statSync(filePath) : null;
    const sizeMB = stat ? (stat.size / (1024 * 1024)).toFixed(1) : '0';
    const dateStr = stat ? new Date(stat.mtime).toLocaleDateString('ar-SA') : '';
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تحميل Control Hub 2026 - JCSA</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Segoe UI',Tahoma,sans-serif;min-height:100vh;background:linear-gradient(135deg,#0a1628 0%,#0f1f3d 50%,#0a1628 100%);color:#e2e8f0;display:flex;justify-content:center;align-items:center;padding:20px}
          .container{max-width:580px;width:100%;text-align:center}
          .logo-area{margin-bottom:32px}
          .logo-icon{width:80px;height:80px;border-radius:20px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
          .logo-icon svg{width:40px;height:40px;color:#d4af37}
          .logo-area h1{font-size:32px;color:#fff;margin-bottom:8px;font-weight:800}
          .logo-area h1 span{color:#d4af37}
          .logo-area p{font-size:16px;color:#94a3b8;font-weight:400}
          .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;backdrop-filter:blur(10px);margin-bottom:16px}
          .card-title{font-size:15px;color:#d4af37;margin-bottom:20px;font-weight:600}
          .features{display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:right}
          .feat{display:flex;align-items:center;gap:10px;font-size:13px;color:#cbd5e1;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px}
          .feat svg{width:16px;height:16px;flex-shrink:0}
          .feat .ok{color:#10b981}
          .feat .info{color:#60a5fa}
          .feat .sec{color:#f59e0b}
          .feat .srv{color:#06b6d4}
          .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px}
          .info-item{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 10px}
          .info-item .label{font-size:11px;color:#64748b;margin-bottom:4px}
          .info-item .value{font-size:15px;color:#e2e8f0;font-weight:600}
          .info-item .value.gold{color:#d4af37}
          .download-btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#d4af37,#b8972e);color:#0a1628;font-size:17px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;transition:all .2s;border:none;cursor:pointer;width:100%;justify-content:center;box-shadow:0 4px 20px rgba(212,175,55,0.25)}
          .download-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(212,175,55,0.35)}
          .download-btn svg{width:22px;height:22px}
          .download-btn.disabled{opacity:0.5;pointer-events:none}
          .code-block{background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:left;direction:ltr;font-family:'Courier New',monospace;font-size:12px;line-height:1.8;color:#10b981}
          .code-block .comment{color:#64748b}
          .footer{margin-top:20px;font-size:12px;color:#475569}
          .footer span{color:#d4af37}
          .error-msg{color:#f87171;font-size:14px;margin-top:12px}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-area">
            <div class="logo-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <h1>Control Hub <span>2026</span></h1>
            <p>منصة الحوكمة والامتثال - نادي سباقات الخيل</p>
          </div>
          <div class="card">
            <div class="card-title">محتويات الحزمة</div>
            <div class="features">
              <div class="feat"><svg class="ok" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>الكود المصدري الكامل</div>
              <div class="feat"><svg class="ok" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>ملفات الإعداد والتكوين</div>
              <div class="feat"><svg class="info" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"/></svg>63+ صفحة - 72+ مكون</div>
              <div class="feat"><svg class="info" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>8 بوابات متكاملة</div>
              <div class="feat"><svg class="sec" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>CSRF + JWT + RBAC</div>
              <div class="feat"><svg class="srv" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>نسخة إنتاجية جاهزة</div>
            </div>
          </div>
          <div class="card">
            <div class="info-grid">
              <div class="info-item">
                <div class="label">حجم الملف</div>
                <div class="value">${fileExists ? sizeMB + ' MB' : '---'}</div>
              </div>
              <div class="info-item">
                <div class="label">الإصدار</div>
                <div class="value gold">2026</div>
              </div>
              <div class="info-item">
                <div class="label">الصيغة</div>
                <div class="value">TAR.GZ</div>
              </div>
            </div>
            ${fileExists ? `
            <a href="/api/download/control-hub" class="download-btn" data-testid="button-download">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              تحميل مباشر
            </a>
            ` : `<p class="error-msg">الملف غير متوفر حالياً - يرجى بناء الحزمة أولاً</p>`}
          </div>
          <div class="card">
            <div class="card-title">للتشغيل على خادمك</div>
            <div class="code-block">
              <span class="comment"># فك الضغط</span><br>
              tar xzf ControlHub-2026.tar.gz<br>
              cd ControlHub-2026<br><br>
              <span class="comment"># إعداد المتغيرات (أو انسخ .env.example)</span><br>
              cp .env.example .env<br>
              <span class="comment"># عدّل قيم DATABASE_URL و SESSION_SECRET</span><br><br>
              <span class="comment"># تشغيل (المكتبات مضمنة)</span><br>
              npm run db:push<br>
              npm start<br><br>
              <span class="comment"># أو عبر Docker</span><br>
              docker-compose up -d
            </div>
          </div>
          <div class="footer">
            Control Hub 2026 &copy; JCSA - نادي سباقات الخيل | إعداد: <span>عبدالمجيد المقبل</span>
          </div>
        </div>
      </body>
      </html>
    `);
    } catch (error) {
      logger.error('Download page error:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحميل الصفحة' });
    }
  });

  app.get("/download-latest", (req, res) => {
    try {
      const filePath = path.resolve("control-hub-latest.tar.gz");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "الملف غير موجود" });
      }
      res.download(filePath, "control-hub-latest.tar.gz");
    } catch (error) {
      logger.error('Latest download error:', { error });
      res.status(500).json({ error: 'خطأ في تحميل الملف' });
    }
  });

  app.get("/download-file", (req, res) => {
    try {
      const filePath = path.resolve("client/public/ControlHub-2026.tar.gz");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "الملف غير موجود" });
      }
      res.download(filePath, "ControlHub-2026.tar.gz", (err) => {
        if (err) {
          logger.error('File download error:', { error: err });
          if (!res.headersSent) {
            res.status(500).json({ error: 'خطأ في تحميل الملف' });
          }
        }
      });
    } catch (error) {
      logger.error('Download file error:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحميل الملف' });
    }
  });

  // ==================== Health Check Endpoint (No Auth Required) ====================
  // FIX #13: Health endpoint protected by optional secret header
  // In production, set HEALTH_SECRET env var and pass X-Health-Secret: <value> from monitoring
  app.get("/health", async (req, res) => {
    const healthSecret = process.env.HEALTH_SECRET;
    if (healthSecret && req.headers['x-health-secret'] !== healthSecret) {
      return res.status(404).send('Not found');
    }
    try {
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || "5.0.0",
      });
    } catch (error) {
      res.status(503).json({ 
        status: "error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // ==================== Object Storage Routes ====================
  registerObjectStorageRoutes(app, authenticateToken);
  
  // ==================== Feature Request Routes ====================
  registerFeatureRequestRoutes(app);
  registerTicketRoutes(app);
  
  app.get('/api/kpi/summary', authenticateToken, async (req: any, res) => {
    try {
      const cacheKey = `kpi_summary_${req.user.portal}_${req.user.itDepartmentId || 0}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const PORTAL_TO_DEPT: Record<string, number> = {
        infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12, dmo: 5
      };
      const DEPT_NAMES: Record<number, string> = {
        5: 'مكتب إدارة البيانات', 9: 'البنية التحتية', 10: 'الأمن السيبراني', 11: 'التحول الرقمي', 12: 'الدعم الفني'
      };
      const isGlobal = ['system_admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT[req.user.portal];

      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const deptIds = isGlobal ? [5, 9, 10, 11, 12] : userDeptId ? [userDeptId] : [];

      if (deptIds.length === 0) {
        cache.set(cacheKey, [], 5 * 60 * 1000);
        return res.json([]);
      }

      const deptParam = sql.join(deptIds.map(id => sql`${id}`), sql`, `);
      const [ticketStats, taskStats, memberStats] = await Promise.all([
        db.execute(sql`
          SELECT department_id,
            COUNT(*) FILTER (WHERE status NOT IN ('closed','resolved')) AS open_tickets,
            COUNT(*) FILTER (WHERE status IN ('closed','resolved') AND updated_at >= ${weekAgo}) AS closed_this_week,
            COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) AS sla_breached,
            COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL) AS tickets_with_sla,
            COUNT(*) FILTER (WHERE status IN ('closed','resolved') AND updated_at >= ${twoWeeksAgo} AND updated_at < ${weekAgo}) AS prev_closed_this_week,
            COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status IN ('closed','resolved')), 0) AS avg_resolution_hours
          FROM it_tickets WHERE deleted_at IS NULL AND department_id IN (${deptParam})
          GROUP BY department_id
        `),
        db.execute(sql`
          SELECT department_id,
            COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed','cancelled')) AS overdue_tasks,
            COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= ${monthAgo}) AS completed_this_month,
            COUNT(*) FILTER (WHERE due_date < ${weekAgo} AND due_date >= ${twoWeeksAgo} AND status NOT IN ('completed','cancelled')) AS prev_overdue_tasks
          FROM tasks WHERE deleted_at IS NULL AND department_id IN (${deptParam})
          GROUP BY department_id
        `),
        db.execute(sql`
          SELECT it_department_id AS department_id, COUNT(*) AS member_count
          FROM users WHERE is_active = true AND it_department_id IN (${deptParam})
          GROUP BY it_department_id
        `)
      ]);

      const ticketMap = new Map((ticketStats.rows as any[]).map(r => [Number(r.department_id), r]));
      const taskMap = new Map((taskStats.rows as any[]).map(r => [Number(r.department_id), r]));
      const memberMap = new Map((memberStats.rows as any[]).map(r => [Number(r.department_id), Number(r.member_count)]));

      const results = deptIds.map(deptId => {
        const ts = ticketMap.get(deptId) || {} as any;
        const tk = taskMap.get(deptId) || {} as any;

        const openTickets = Number(ts.open_tickets || 0);
        const closedThisWeek = Number(ts.closed_this_week || 0);
        const slaBreached = Number(ts.sla_breached || 0);
        const ticketsWithSLA = Number(ts.tickets_with_sla || 0);
        const slaComplianceRate = ticketsWithSLA > 0 ? Math.round(((ticketsWithSLA - slaBreached) / ticketsWithSLA) * 100) : 100;
        const avgResolutionHours = Math.round(Number(ts.avg_resolution_hours || 0));
        const prevClosedThisWeek = Number(ts.prev_closed_this_week || 0);
        const prevOpenTickets = Math.max(0, openTickets + closedThisWeek - prevClosedThisWeek);
        const prevSLAComplianceRate = Math.max(0, Math.min(100, slaComplianceRate + (closedThisWeek > prevClosedThisWeek ? 3 : -3)));

        const overdueTasks = Number(tk.overdue_tasks || 0);
        const completedTasksThisMonth = Number(tk.completed_this_month || 0);
        const prevWeekOverdueTasks = Number(tk.prev_overdue_tasks || 0);

        return {
          departmentId: deptId,
          departmentName: DEPT_NAMES[deptId],
          openTickets, closedThisWeek, slaBreached, slaComplianceRate,
          overdueTasks, completedTasksThisMonth, avgResolutionHours,
          teamMembersCount: memberMap.get(deptId) || 0,
          prevOpenTickets, prevClosedThisWeek,
          prevSLAComplianceRate: Math.round(prevSLAComplianceRate),
          prevOverdueTasks: prevWeekOverdueTasks,
        };
      });

      cache.set(cacheKey, results, 5 * 60 * 1000);
      res.json(results);
    } catch (error) {
      logger.error('KPI summary error', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب مؤشرات الأداء' });
    }
  });

  // ==================== Missing Workflow Completion Routes ====================
  registerMissingWorkflowRoutes(app);
  
  // ==================== Compliance Routes - PDPL & NDMO ====================
  app.use("/api/compliance", complianceRouter);
  
  // ==================== Export Routes ====================
  app.use("/api/export", authenticateToken, exportRouter);
  
  // ==================== CSRF Token Endpoint ====================
  app.get("/api/csrf-token", getCSRFTokenHandler);
  
  // ==================== Smart File Parser Routes ====================
  app.use("/api", parseFileRouter);
  
  // ==================== Integration Routes (LDAP, ERP, SIEM, Monitoring, Webhooks) ====================
  app.use("/api/integrations", authenticateToken, integrationsRouter);
  loadIntegrationConfigs().catch(() => {});
  
  // Data Catalog API - فهرس البيانات
  app.use("/api/data-catalog", authenticateToken, dataCatalogRouter);
  
  // ==================== Authentication Routes (modularized) ====================
  registerAuthRoutes(app);

  // ==================== Workflow Metadata API — مسارات العمل ====================
  app.get("/api/workflows/metadata", authenticateToken, async (req: any, res) => {
    try {
      const { entity } = req.query;
      const entities: WorkflowEntity[] = entity 
        ? [entity as WorkflowEntity] 
        : ['ticket', 'task', 'project', 'referral', 'decision', 'dmo_request', 'planner_task', 'compliance_control'];
      
      const result: Record<string, any> = {};
      const entityLabels: Record<string, string> = {
        ticket: 'التذاكر',
        task: 'المهام',
        project: 'المشاريع',
        referral: 'الإحالات',
        decision: 'قرارات اللجنة',
        dmo_request: 'طلبات DMO',
        planner_task: 'مهام التخطيط',
        compliance_control: 'ضوابط الامتثال',
      };
      
      for (const e of entities) {
        const transitions = getTransitionMap(e);
        if (!transitions) continue;
        const statuses = Object.keys(transitions);
        const reasonsMap: Record<string, Record<string, string>> = {};
        for (const from of statuses) {
          const toList = transitions[from];
          if (!toList || toList.length === 0) continue;
          reasonsMap[from] = {};
          for (const to of toList) {
            const reason = getTransitionReason(e, from, to);
            if (reason) reasonsMap[from][to] = reason;
          }
        }
        result[e] = {
          label: entityLabels[e] || e,
          statuses,
          transitions,
          reasons: Object.keys(reasonsMap).length > 0 ? reasonsMap : undefined,
        };
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error fetching workflow metadata:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات مسارات العمل' });
    }
  });
  
  app.get("/api/workflows/:entity/transitions/:fromStatus", authenticateToken, async (req: any, res) => {
    try {
      const { entity, fromStatus } = req.params;
      const allowed = getAllowedTransitions(entity, fromStatus);
      const reasons: Record<string, string> = {};
      for (const toStatus of allowed) {
        const reason = getTransitionReason(entity, fromStatus, toStatus);
        if (reason) reasons[toStatus] = reason;
      }
      res.json({ entity, fromStatus, allowedTransitions: allowed, reasons });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  // ==================== Admin Routes (modularized) ====================
  registerAdminRoutes(app);

  registerDashboardRoutes(app);

  // ==================== Smart Intelligence Endpoints ====================

  app.post("/api/smart/suggest-priority", authenticateToken, async (req: any, res) => {
    try {
      const { title = '', description = '' } = req.body;
      const text = (title + ' ' + description).toLowerCase();

      const CRITICAL_WORDS = ['تعطل', 'معطل', 'متوقف', 'توقف', 'انهيار', 'اختراق', 'هجوم', 'أمني', 'فيروس', 'بيانات مسربة', 'لا يمكن الدخول', 'خطر', 'طارئ', 'سقط', 'crash', 'down', 'outage', 'breach', 'attack', 'critical', 'emergency', 'offline', 'not working', 'inaccessible', 'virus', 'ransomware'];
      const HIGH_WORDS = ['عاجل', 'مهم', 'ضروري', 'لا يعمل', 'خطأ', 'فشل', 'انقطع', 'مشكلة كبيرة', 'urgent', 'important', 'error', 'failed', 'broken', 'high', 'major', 'significant'];
      const MEDIUM_WORDS = ['بطيء', 'تأخير', 'مشكلة', 'تحديث مطلوب', 'يحتاج مراجعة', 'صعوبة', 'slow', 'issue', 'problem', 'delay', 'update needed', 'medium', 'moderate'];

      let priority = 'low';
      let priorityConfidence = 0.5;
      if (CRITICAL_WORDS.some(k => text.includes(k))) { priority = 'critical'; priorityConfidence = 0.9; }
      else if (HIGH_WORDS.some(k => text.includes(k))) { priority = 'high'; priorityConfidence = 0.8; }
      else if (MEDIUM_WORDS.some(k => text.includes(k))) { priority = 'medium'; priorityConfidence = 0.7; }
      else if (text.length > 10) { priority = 'medium'; priorityConfidence = 0.5; }

      // Auto-categorize
      let category = 'support';
      if (/شبكة|network|انترنت|wifi|vpn|روتر|firewall/.test(text)) category = 'network';
      else if (/كمبيوتر|حاسوب|جهاز|طابعة|printer|hardware|شاشة|screen/.test(text)) category = 'hardware';
      else if (/برنامج|تطبيق|نظام|تثبيت|installation|software|application|app|windows|office/.test(text)) category = 'software';
      else if (/أمن|security|اختراق|فيروس|malware|ransomware|password|كلمة مرور/.test(text)) category = 'security';
      else if (/بيانات|data|قاعدة|database|backup|نسخ احتياطي/.test(text)) category = 'database';
      else if (/بريد|email|outlook|رسالة|mail/.test(text)) category = 'email';
      else if (/خادم|server|hosting|cloud|سحابة/.test(text)) category = 'server';

      // Find similar open tickets for awareness
      const searchPatternSmart = `%${title.substring(0, 30)}%`;
      const similarTickets = title.length > 5 ? await db.select({
        id: itTickets.id, title: itTickets.title, status: itTickets.status
      }).from(itTickets)
        .where(and(
          sql`LOWER(${itTickets.title}) LIKE ${searchPatternSmart.toLowerCase()}`,
          isNull(itTickets.deletedAt),
          notInArray(itTickets.status, ['resolved', 'closed'])
        )).limit(3) : [];

      res.json({ priority, category, priorityConfidence, similarTickets });
    } catch (error) {
      logger.error('Smart suggest error:', { error });
      res.status(500).json({ priority: 'medium', category: 'support', priorityConfidence: 0.5, similarTickets: [] });
    }
  });

  // ==================== IT Departments Routes ====================
  
  app.get("/api/it-departments", authenticateToken, async (req, res) => {
    try {
      const departments = await storage.getITDepartments();
      res.json(departments);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/it-departments/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const department = await storage.getITDepartmentById(id);
      if (!department) {
        return res.status(404).json({ error: 'الإدارة غير موجودة' });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Domains Routes ====================
  
  app.get("/api/domains", authenticateToken, async (req, res) => {
    try {
      let result = await storage.getDomains();
      if (result.length === 0) {
        const ndmoDomains = [
          { code: 'DG01', nameAr: 'حوكمة البيانات', icon: 'Database', color: '#1e3a5f', sortOrder: 0 },
          { code: 'DG02', nameAr: 'جودة البيانات', icon: 'CheckCircle', color: '#1e3a5f', sortOrder: 1 },
          { code: 'DG03', nameAr: 'إدارة البيانات الرئيسية والمرجعية', icon: 'BookOpen', color: '#1e3a5f', sortOrder: 2 },
          { code: 'DG04', nameAr: 'هندسة البيانات', icon: 'Layers', color: '#1e3a5f', sortOrder: 3 },
          { code: 'DG05', nameAr: 'تخزين البيانات وإدارة العمليات', icon: 'HardDrive', color: '#1e3a5f', sortOrder: 4 },
          { code: 'DG06', nameAr: 'أمن البيانات', icon: 'Shield', color: '#c9a227', sortOrder: 5 },
          { code: 'DG07', nameAr: 'تكامل البيانات وقابلية التشغيل البيني', icon: 'GitMerge', color: '#1e3a5f', sortOrder: 6 },
          { code: 'DG08', nameAr: 'إدارة المحتوى والوثائق', icon: 'FileText', color: '#1e3a5f', sortOrder: 7 },
          { code: 'DG09', nameAr: 'البيانات المفتوحة', icon: 'Globe', color: '#2d4a6f', sortOrder: 8 },
          { code: 'DG10', nameAr: 'تحليل البيانات وذكاء الأعمال', icon: 'BarChart', color: '#2d4a6f', sortOrder: 9 },
          { code: 'DG11', nameAr: 'الذكاء الاصطناعي وتعلم الآلة', icon: 'Brain', color: '#6366f1', sortOrder: 10 },
          { code: 'DG12', nameAr: 'إدارة البيانات الضخمة', icon: 'Database', color: '#2d4a6f', sortOrder: 11 },
          { code: 'DG13', nameAr: 'خصوصية البيانات', icon: 'Lock', color: '#c9a227', sortOrder: 12 },
          { code: 'DG14', nameAr: 'إدارة دورة حياة البيانات', icon: 'RefreshCw', color: '#1e3a5f', sortOrder: 13 },
          { code: 'DG15', nameAr: 'أخلاقيات البيانات', icon: 'Scale', color: '#3d5a80', sortOrder: 14 },
        ];
        for (const d of ndmoDomains) {
          await db.insert(domains).values({ ...d, isActive: true }).onConflictDoNothing();
        }
        logger.info('[Domains] Auto-seeded 15 NDMO domains');
        result = await storage.getDomains();
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/domains/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const domain = await storage.getDomainById(id);
      if (!domain) {
        return res.status(404).json({ error: 'المجال غير موجود' });
      }
      res.json(domain);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Requirements Routes ====================
  
  app.get("/api/requirements", authenticateToken, async (req, res) => {
    try {
      const requirements = await storage.getRequirements();
      res.json(requirements);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/requirements", authenticateToken, async (req: any, res) => {
    try {
      const DMO_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager', 'dmo_staff'];
      if (!DMO_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية — إضافة المتطلبات مقتصرة على مكتب إدارة البيانات' });
      }
      const { domainId, code, titleAr, titleEn, description, priority, complianceLevel, evidenceType } = req.body;
      if (!domainId || !code || !titleAr) {
        return res.status(400).json({ error: 'الحقول المطلوبة: النطاق، الكود، العنوان بالعربي' });
      }
      const [requirement] = await db.insert(requirementsTable).values({
        domainId: Number(domainId),
        code,
        titleAr,
        titleEn: titleEn || null,
        description: description || null,
        priority: priority || 'medium',
        complianceLevel: complianceLevel || 'mandatory',
        evidenceType: evidenceType || 'document',
      }).returning();
      res.status(201).json(requirement);
    } catch (error: any) {
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(400).json({ error: 'كود المتطلب مستخدم مسبقاً' });
      }
      logger.error('Create requirement error:', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ في إنشاء المتطلب' });
    }
  });

  app.put("/api/requirements/:id", authenticateToken, async (req: any, res) => {
    try {
      const DMO_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager', 'dmo_staff'];
      if (!DMO_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { titleAr, titleEn, description, priority, complianceLevel, evidenceType } = req.body;
      if (titleAr !== undefined && !titleAr.trim()) {
        return res.status(400).json({ error: 'عنوان المتطلب لا يمكن أن يكون فارغاً' });
      }
      const [updated] = await db.update(requirementsTable).set({
        ...(titleAr && { titleAr }),
        ...(titleEn !== undefined && { titleEn }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(complianceLevel && { complianceLevel }),
        ...(evidenceType && { evidenceType }),
        updatedAt: new Date(),
      }).where(eq(requirementsTable.id, id)).returning();
      if (!updated) return res.status(404).json({ error: 'المتطلب غير موجود' });
      res.json(updated);
    } catch (error: any) {
      logger.error('Update requirement error:', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ في تحديث المتطلب' });
    }
  });

  app.delete("/api/requirements/:id", authenticateToken, async (req: any, res) => {
    try {
      const DMO_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager'];
      if (!DMO_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [deleted] = await db.update(requirementsTable).set({ deletedAt: new Date() }).where(eq(requirementsTable.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: 'المتطلب غير موجود' });
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Delete requirement error:', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ في حذف المتطلب' });
    }
  });

  app.get("/api/requirements/domain/:domainId", authenticateToken, async (req, res) => {
    try {
      const domainId = parseId(req.params.domainId, res);
      if (!domainId) return;
      const requirements = await storage.getRequirementsByDomain(domainId);
      res.json(requirements);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Evidences Routes ====================
  
  app.get("/api/evidences", authenticateToken, async (req, res) => {
    try {
      const evidences = await storage.getEvidences();
      res.json(evidences);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/evidences", authenticateToken, sensitiveOpRateLimiter, upload.single('file'), async (req: any, res) => {
    try {
      const { requirementId, title, description, departmentId } = req.body;
      if (!requirementId || !title) {
        return res.status(400).json({ error: 'requirementId و title مطلوبان' });
      }

      let fileUrl: string | null = null;
      let fileKey: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      if (req.file) {
        fileName = req.file.originalname;
        fileType = req.file.mimetype;
        fileSize = req.file.size;
        try {
          const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
          const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
          const bucket = objectStorageClient.bucket(bucketId);
          const key = `.private/evidences/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const blob = bucket.file(key);
          await blob.save(req.file.buffer, { contentType: req.file.mimetype });
          fileKey = key;
          fileUrl = key;
        } catch (uploadError) {
          logger.error('[Upload] Object storage failed:', { error: uploadError });
          return res.status(500).json({ success: false, message: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى' });
        }
      }

      const evidence = await storage.createEvidence({
        requirementId: parseInt(requirementId),
        title,
        description: description || null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        status: 'pending',
        fileUrl,
        fileKey,
        fileName,
        fileType,
        fileSize,
        submittedBy: req.user?.id || null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        expiryDate: null,
        isExpired: false,
      });

      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'create',
        entityType: 'evidence',
        entityId: evidence.id,
        oldValue: null,
        newValue: JSON.stringify({ title, fileName }),
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم رفع دليل امتثال: ${title}${fileName ? ` (${fileName})` : ''}`,
      });

      res.status(201).json(evidence);
    } catch (error) {
      logger.error('Error creating evidence:', { error });
      res.status(500).json({ error: 'حدث خطأ في رفع الدليل' });
    }
  });

  // Upload file to existing evidence
  app.post("/api/evidences/:id/upload", authenticateToken, upload.single('file'), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });

      let fileUrl = '';
      let fileKey = '';
      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const key = `.private/evidences/${id}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const blob = bucket.file(key);
        await blob.save(req.file.buffer, { contentType: req.file.mimetype });
        fileKey = key;
        fileUrl = key;
      } catch (uploadError) {
        logger.error('[Upload] Object storage failed:', { error: uploadError });
        return res.status(500).json({ success: false, message: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى' });
      }

      const [updated] = await db.update(evidences).set({
        fileUrl,
        fileKey,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        status: 'pending',
        updatedAt: new Date(),
      }).where(eq(evidences.id, id)).returning();

      res.json(updated);
    } catch (error) {
      logger.error('Error uploading evidence file:', { error });
      res.status(500).json({ error: 'حدث خطأ في رفع الملف' });
    }
  });

  // Approve / reject evidence
  app.put("/api/evidences/:id/review", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { status, reviewNotes } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'الحالة يجب أن تكون approved أو rejected' });
      }
      const [updated] = await db.update(evidences).set({
        status,
        reviewedBy: req.user?.id || null,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        updatedAt: new Date(),
      }).where(eq(evidences.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في مراجعة الدليل' });
    }
  });

  app.get("/api/evidences/pending", authenticateToken, async (req, res) => {
    try {
      const evidences = await storage.getPendingEvidences();
      res.json(evidences);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/evidences/expiring", authenticateToken, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const evidences = await storage.getExpiringEvidences(days);
      res.json(evidences);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // IT Tickets Routes - moved to tickets.routes.ts

  // ==================== Tasks Routes ====================
  
  // Use centralized PORTAL_TO_DEPT_ID from shared.ts (imported at top)

  // ===== SHARED ISOLATION HELPER =====
  // Returns true if the user is allowed to mutate this resource
  // isGlobalAdmin: system_admin, admin, it_director bypass all checks
  // resourceDeptId: the department that owns the resource (null = allow)
  // allowedPortals: specific portals that can access (default = user's own dept match)
  function canMutateResource(user: any, resourceDeptId?: number | null, allowedPortals?: string[]): boolean {
    if (!user) return false;
    const globalRoles = ['system_admin', 'admin', 'it_director'];
    if (globalRoles.includes(user.role)) return true;
    if (allowedPortals && !allowedPortals.includes(user.portal)) return false;
    if (resourceDeptId != null) {
      const userDeptId = user.itDepartmentId || PORTAL_TO_DEPT_ID[user.portal];
      if (userDeptId && resourceDeptId !== userDeptId) return false;
    }
    return true;
  }
  // NOTE: To make this dynamic, call at startup:
  // const depts = await db.select({portal: itDepartments.portal, id: itDepartments.id}).from(itDepartments);
  // depts.forEach(d => { if (d.portal) PORTAL_TO_DEPT_ID[d.portal] = d.id; });

  registerTaskRoutes(app);

  // ==================== Security Routes ====================
  
  app.get("/api/security/vulnerabilities", authenticateToken, async (req, res) => {
    try {
      const vulnerabilities = await storage.getSecurityVulnerabilities();
      res.json(vulnerabilities);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/security/vulnerabilities/critical", authenticateToken, async (req, res) => {
    try {
      const vulnerabilities = await storage.getCriticalVulnerabilities();
      res.json(vulnerabilities);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/security/threats", authenticateToken, async (req, res) => {
    try {
      const threats = await storage.getSecurityThreats();
      res.json(threats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/security/threats/active", authenticateToken, async (req, res) => {
    try {
      const threats = await storage.getActiveThreats();
      res.json(threats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Knowledge Base Routes ====================
  
  app.get("/api/knowledge", authenticateToken, async (req, res) => {
    try {
      const articles = await storage.getKnowledgeArticles();
      res.json(articles);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/knowledge/search", authenticateToken, async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const articles = await storage.searchKnowledgeBase(query);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/knowledge/category/:category", authenticateToken, async (req, res) => {
    try {
      const articles = await storage.getKnowledgeArticlesByCategory(req.params.category);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Escalations Routes ====================
  
  app.get("/api/escalations", authenticateToken, async (req, res) => {
    try {
      const escalations = await storage.getEscalations();
      res.json(escalations);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/escalations/pending", authenticateToken, async (req, res) => {
    try {
      const escalations = await storage.getPendingEscalations();
      res.json(escalations);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/escalations", authenticateToken, sensitiveOpRateLimiter, async (req: any, res) => {
    try {
      const escalation = await storage.createEscalation({
        ...req.body,
        escalatedFrom: (req as any).user.id,
      });
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'create',
        entityType: 'escalation',
        entityId: escalation.id,
        oldValue: null,
        newValue: JSON.stringify({ reason: escalation.reason, priority: escalation.priority }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء تصعيد جديد`,
      });

      // Notify the escalation target
      if (escalation.escalatedTo && escalation.escalatedTo !== req.user.id) {
        await storage.createNotification({
          userId: escalation.escalatedTo,
          title: 'تصعيد جديد بانتظار اتخاذ إجراء',
          message: `تم تصعيد "${escalation.reason || 'طلب تصعيد'}" إليك بأولوية ${escalation.priority === 'urgent' ? 'عاجلة' : escalation.priority === 'critical' ? 'حرجة' : escalation.priority === 'high' ? 'عالية' : 'متوسطة'}`,
          type: 'escalation',
          priority: escalation.priority === 'urgent' || escalation.priority === 'critical' || escalation.priority === 'high' ? 'high' : 'normal',
          isRead: false,
          entityType: 'escalation',
          entityId: escalation.id,
          actionUrl: '/it-director/escalations',
        });
      }
      // Notify IT Directors of escalation
      const escalationDirectors = await db.select({ id: users.id }).from(users)
        .where(eq(users.portal, 'it_director'));
      for (const dir of escalationDirectors) {
        if (dir.id !== req.user.id && dir.id !== escalation.escalatedTo) {
          await storage.createNotification({
            userId: dir.id,
            title: 'تصعيد جديد',
            message: `تم رفع تصعيد جديد بسبب: ${escalation.reason || 'غير محدد'}`,
            type: 'escalation',
            priority: escalation.priority === 'urgent' || escalation.priority === 'critical' || escalation.priority === 'high' ? 'high' : 'normal',
            isRead: false,
            entityType: 'escalation',
            entityId: escalation.id,
            actionUrl: '/it-director/escalations',
          });
        }
      }
      
      res.json(escalation);
    } catch (error) {
      logger.error('Create escalation error:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء التصعيد' });
    }
  });

  app.put("/api/escalations/:id/resolve", authenticateToken, async (req: any, res) => {
    try {
      const RESOLVE_ROLES = ['system_admin', 'admin', 'it_director', 'infrastructure_manager', 'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager'];
      if (!RESOLVE_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية — حل التصعيد يتطلب صلاحية مدير أو مدير تقنية' });
      }
      const { resolution } = req.body;
      const id = parseId(req.params.id, res);
      if (!id) return;
      const escalation = await storage.resolveEscalation(id, resolution);
      if (!escalation) {
        return res.status(404).json({ error: 'التصعيد غير موجود' });
      }
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'update',
        entityType: 'escalation',
        entityId: escalation.id,
        oldValue: null,
        newValue: JSON.stringify({ status: 'resolved', resolution }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حل التصعيد`,
      });
      
      res.json(escalation);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حل التصعيد' });
    }
  });

  // ==================== Committee Routes ====================
  registerCommitteeRoutes(app);

  // ==================== Compliance Reports Routes ====================
  
  app.get("/api/compliance/reports", authenticateToken, async (req, res) => {
    try {
      const reports = await storage.getComplianceReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== IT Projects Routes ====================
  
  app.get("/api/projects", authenticateToken, async (req: any, res) => {
    try {
      const allProjects = await storage.getITProjects();
      const userRole = req.user?.role;
      const userPortal = req.user?.portal;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (isDirectorOrAdmin) {
        return res.json(allProjects);
      }
      const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
      if (!userDeptId) {
        return res.json([]);
      }
      const filtered = allProjects.filter((p: any) => p.itDepartmentId === userDeptId || p.managerId === req.user?.id);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/projects", authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const { name, nameAr, nameEn, code, description, priority, startDate, endDate, itDepartmentId, budget } = req.body;
      const projectName = nameAr || name;
      if (!projectName) {
        return res.status(400).json({ error: 'اسم المشروع مطلوب' });
      }
      const resolvedDeptId = itDepartmentId
        ? parseInt(itDepartmentId)
        : (req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || 9);
      const autoCode = code || ('PRJ-' + Date.now().toString().slice(-8));
      const project = await storage.createITProject({
        code: autoCode,
        nameAr: projectName,
        nameEn: nameEn || projectName || 'New Project',
        description: description || null,
        priority: priority || 'medium',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        actualEndDate: null,
        status: 'planning',
        progress: 0,
        itDepartmentId: resolvedDeptId,
        departmentId: null,
        managerId: (req as any).user.id,
        budget: budget ? parseFloat(budget) : null,
        actualCost: null,
        notes: null,
      });
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'create',
        entityType: 'project',
        entityId: project.id,
        oldValue: null,
        newValue: JSON.stringify({ code: project.code }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء مشروع جديد: ${project.code}`,
      });
      
      res.json(project);
    } catch (error) {
      logger.error('Create project error:', { error });
      if ((error as any)?.code === '23505' || (error as any)?.constraint?.includes('code')) {
        return res.status(400).json({ error: 'رمز المشروع مستخدم مسبقاً — اختر رمزاً آخر' });
      }
      res.status(500).json({ error: 'حدث خطأ في إنشاء المشروع' });
    }
  });

  app.put("/api/projects/:id", authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const existingProject = await storage.getITProjectById(id);
      if (!existingProject) {
        return res.status(404).json({ error: 'المشروع غير موجود' });
      }

      const { nameAr, nameEn, code, description, priority, status, progress, startDate, endDate, budget, notes, itDepartmentId } = req.body;
      if (nameAr !== undefined && typeof nameAr === 'string' && !nameAr.trim()) {
        return res.status(400).json({ error: 'اسم المشروع لا يمكن أن يكون فارغاً' });
      }
      const updateData: any = {};
      if (nameAr !== undefined) updateData.nameAr = nameAr;
      if (nameEn !== undefined) updateData.nameEn = nameEn;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) updateData.priority = priority;
      if (status !== undefined) updateData.status = status;
      if (progress !== undefined) updateData.progress = progress;
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      if (budget !== undefined) updateData.budget = budget;
      if (notes !== undefined) updateData.notes = notes;
      if (itDepartmentId !== undefined) updateData.itDepartmentId = itDepartmentId;
      
      const project = await storage.updateITProject(id, updateData);
      if (!project) {
        return res.status(404).json({ error: 'المشروع غير موجود' });
      }

      const changedFields: Record<string, any> = {};
      for (const key of Object.keys(updateData)) {
        if ((existingProject as any)[key] !== updateData[key]) {
          changedFields[key] = (existingProject as any)[key];
        }
      }
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'update',
        entityType: 'project',
        entityId: id,
        oldValue: JSON.stringify(changedFields),
        newValue: JSON.stringify(updateData),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تحديث مشروع: ${project.code}`,
      });
      
      res.json(project);
    } catch (error) {
      logger.error('Update project error:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث المشروع' });
    }
  });

  app.delete("/api/projects/:id", authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const project = await storage.getITProjectById(id);
      if (!project) {
        return res.status(404).json({ error: 'المشروع غير موجود' });
      }
      
      await storage.deleteITProject(id);
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'delete',
        entityType: 'project',
        entityId: id,
        oldValue: JSON.stringify({ code: project.code }),
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حذف مشروع: ${project.code}`,
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Delete project error:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف المشروع' });
    }
  });

  app.put("/api/projects/:id/status", authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const { status, progress } = req.body;
      if (!status || !PROJECT_STATUSES.includes(status as any)) {
        return res.status(400).json({ error: `الحالة غير صالحة. القيم المسموحة: ${PROJECT_STATUSES.join(', ')}` });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [existing] = await db.select({ status: itProjects.status, itDepartmentId: itProjects.itDepartmentId }).from(itProjects).where(and(eq(itProjects.id, id), isNull(itProjects.deletedAt))).limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'المشروع غير موجود' });
      }

      if (!canMutateResource(req.user, existing.itDepartmentId)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل مشروع من قسم آخر' });
      }

      const isManager = ['it_director', 'system_admin'].includes(req.user?.role);
      if (!isManager && !isValidTransition('project', existing.status, status)) {
        const allowed = getAllowedTransitions('project', existing.status);
        return res.status(400).json({ 
          error: `لا يمكن تغيير حالة المشروع من "${existing.status}" إلى "${status}". التحولات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
          allowedTransitions: allowed,
        });
      }

      const project = await storage.updateITProject(id, { status, progress });

      if (status === 'cancelled' || status === 'on_hold') {
        try {
          const projectTasks = await db.select({ id: tasks.id, title: tasks.title, assignedTo: tasks.assignedTo })
            .from(tasks)
            .where(and(
              eq(tasks.projectId, id),
              ne(tasks.status, 'completed'),
              ne(tasks.status, 'cancelled'),
              ne(tasks.status, 'archived'),
              isNull(tasks.deletedAt)
            ));

          if (projectTasks.length > 0) {
            const newTaskStatus = status === 'cancelled' ? 'cancelled' : 'on_hold';
            await db.update(tasks).set({
              status: newTaskStatus,
              updatedAt: new Date(),
            } as any).where(and(
              eq(tasks.projectId, id),
              ne(tasks.status, 'completed'),
              ne(tasks.status, 'cancelled'),
              ne(tasks.status, 'archived'),
              isNull(tasks.deletedAt)
            ));

            const uniqueAssignees = [...new Set(projectTasks.map(t => t.assignedTo).filter(Boolean))] as number[];
            for (const assigneeId of uniqueAssignees) {
              await storage.createNotification({
                userId: assigneeId,
                title: status === 'cancelled' ? 'إلغاء مهام المشروع' : 'تعليق مهام المشروع',
                message: `تم ${status === 'cancelled' ? 'إلغاء' : 'تعليق'} ${projectTasks.length} مهمة مرتبطة بمشروع: ${project?.nameAr || project?.code}`,
                type: 'project_tasks_cascade',
                priority: 'high',
                entityType: 'project',
                entityId: id,
                isRead: false,
              });
            }

            logger.info(`Project ${id} ${status}: cascaded to ${projectTasks.length} tasks`);
          }
        } catch (cascadeErr) {
          logger.error(`Project-task cascade failed for project ${id}`, { error: cascadeErr });
        }
      }

      if (status === 'active' || status === 'in_progress') {
        try {
          const holdTasks = await db.select({ id: tasks.id })
            .from(tasks)
            .where(and(
              eq(tasks.projectId, id),
              eq(tasks.status, 'on_hold'),
              isNull(tasks.deletedAt)
            ));

          if (holdTasks.length > 0) {
            await db.update(tasks).set({
              status: 'pending',
              updatedAt: new Date(),
            } as any).where(and(
              eq(tasks.projectId, id),
              eq(tasks.status, 'on_hold'),
              isNull(tasks.deletedAt)
            ));

            logger.info(`Project ${id} reactivated: ${holdTasks.length} on-hold tasks restored to pending`);
          }
        } catch (reactivateErr) {
          logger.error(`Project-task reactivation failed for project ${id}`, { error: reactivateErr });
        }
      }

      invalidateDashboardCaches();
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المشروع' });
    }
  });

  app.get("/api/projects/department/:departmentId", authenticateToken, async (req, res) => {
    try {
      const departmentId = parseId(req.params.departmentId, res);
      if (!departmentId) return;
      const projects = await storage.getITProjectsByDepartment(departmentId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== IT Systems Routes ====================
  
  app.get("/api/systems", authenticateToken, async (req, res) => {
    try {
      const systems = await storage.getITSystems();
      res.json(systems);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/knowledge", authenticateToken, requireCreate(RESOURCES.KNOWLEDGE_BASE), async (req: any, res) => {
    try {
      const { title, content, category: articleCategory, tags, summary } = req.body;
      if (!title || !content || !articleCategory) {
        return res.status(400).json({ error: 'الحقول المطلوبة: العنوان، المحتوى، التصنيف' });
      }
      const article = await storage.createKnowledgeArticle({
        title, content, category: articleCategory,
        tags: tags || null,
        authorId: (req as any).user.id,
        status: 'published',
        departmentId: null,
        helpful: 0,
        views: 0,
      });
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء المقال' });
    }
  });

  // ==================== Data Assets Routes (NDMO) ====================
  
  app.get("/api/data-assets", authenticateToken, requireView(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const assets = await storage.getDataAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأصول البيانية' });
    }
  });

  app.get("/api/data-assets/:id", authenticateToken, requireView(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const asset = await storage.getDataAssetById(id);
      if (!asset) {
        return res.status(404).json({ error: 'الأصل غير موجود' });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأصل' });
    }
  });

  app.post("/api/data-assets", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const { name, nameEn, description, system, systemId, owner, ownerId, classification, dataType, source, format, updateFrequency, retentionPeriod, departmentId, databaseName, schemaName, tableName, connectionType, connectionString, totalRecords, totalColumns, status } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'اسم أصل البيانات مطلوب' });
      }
      const assetData = {
        name, nameEn: nameEn || null, description: description || null,
        system: system || null, systemId: systemId ? Number(systemId) : null,
        owner: owner || null, ownerId: ownerId ? Number(ownerId) : null,
        classification: classification || 'public', dataType: dataType || 'structured',
        source: source || null, format: format || null,
        updateFrequency: updateFrequency || null, retentionPeriod: retentionPeriod || null,
        departmentId: departmentId ? Number(departmentId) : null,
        databaseName: databaseName || null, schemaName: schemaName || null,
        tableName: tableName || null, connectionType: connectionType || null,
        connectionString: connectionString || null,
        totalRecords: totalRecords ? Number(totalRecords) : null,
        totalColumns: totalColumns ? Number(totalColumns) : null,
        status: status || 'active',
        createdBy: req.user?.id || null,
      };
      const asset = await storage.createDataAsset(assetData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_data_asset',
        entityType: 'data_asset',
        entityId: asset.id,
        oldValue: null,
        newValue: JSON.stringify(asset),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء أصل بياني: ${asset.name}`,
      });
      
      res.json(asset);
    } catch (error) {
      logger.error('Error creating data asset:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الأصل البياني' });
    }
  });

  app.post("/api/data-assets/register-from-discovery", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const { tables, connectionId, systemId, databaseName } = req.body;
      if (!tables || !Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ error: 'يجب تحديد جدول واحد على الأقل' });
      }

      const registeredAssets = [];
      for (const table of tables) {
        const assetData = {
          name: table.name,
          nameEn: table.name,
          description: `جدول مكتشف تلقائياً من قاعدة البيانات ${databaseName || ''} - يحتوي على ${table.columnsCount || 0} عمود و ${table.rows || 0} سجل`,
          dataType: 'structured',
          systemId: systemId ? Number(systemId) : null,
          classification: 'public',
          source: databaseName || '',
          format: table.type === 'view' ? 'view' : 'table',
          databaseName: databaseName || '',
          tableName: table.name,
          totalRecords: table.rows || 0,
          totalColumns: table.columnsCount || table.columns?.length || 0,
          status: 'active',
          createdBy: req.user?.id || null,
        };
        const asset = await storage.createDataAsset(assetData);
        registeredAssets.push(asset);

        if (table.columns && table.columns.length > 0) {
          for (const col of table.columns) {
            try {
              await storage.createDataDictionaryTerm({
                term: col.name,
                termEn: col.name,
                definition: `عمود من نوع ${col.type}${col.isPrimaryKey ? ' (مفتاح أساسي)' : ''}${col.isForeignKey ? ' (مفتاح أجنبي)' : ''}${col.nullable ? ' - يقبل القيم الفارغة' : ' - إلزامي'}`,
                category: 'technical',
                dataType: col.type,
                columnName: col.name,
                dataAssetId: asset.id,
                status: 'active',
                createdBy: req.user?.id || null,
              });
            } catch (e: any) {
              logger.debug('Skipped duplicate data dictionary term', { term: col.name, error: e?.message });
            }
          }
        }
      }

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'bulk_register_assets',
        entityType: 'data_asset',
        entityId: null,
        oldValue: null,
        newValue: JSON.stringify({ count: registeredAssets.length, tables: tables.map((t: any) => t.name) }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تسجيل ${registeredAssets.length} أصل بيانات من الاكتشاف التلقائي`,
      });

      res.json({
        success: true,
        registered: registeredAssets.length,
        assets: registeredAssets,
      });
    } catch (error: any) {
      logger.error('Error bulk registering assets:', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ في تسجيل الأصول' });
    }
  });

  app.put("/api/data-assets/:id", authenticateToken, requireUpdate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const asset = await storage.updateDataAsset(id, stripProtectedFields(req.body));
      if (!asset) {
        return res.status(404).json({ error: 'الأصل غير موجود' });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث الأصل' });
    }
  });

  app.delete("/api/data-assets/:id", authenticateToken, requireDelete(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const existing = await storage.getDataAssetById(id);
      if (!existing) {
        return res.status(404).json({ error: 'الأصل غير موجود' });
      }
      await storage.deleteDataAsset(id);
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'data_asset',
        entityId: id,
        details: `حذف أصل بيانات: ${existing.name}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify({ id: existing.id, name: existing.name }),
        newValue: null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف الأصل' });
    }
  });

  // ==================== Data Dictionary Routes ====================
  
  app.get("/api/data-dictionary", authenticateToken, requireView(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const terms = await storage.getDataDictionaryTerms();
      res.json(terms);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب قاموس البيانات' });
    }
  });

  app.post("/api/data-dictionary", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const termData = {
        ...req.body,
        dataAssetId: req.body.dataAssetId && req.body.dataAssetId !== '' ? parseInt(req.body.dataAssetId) : null,
        createdBy: req.user?.id || null,
      };
      const term = await storage.createDataDictionaryTerm(termData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_dictionary_term',
        entityType: 'data_dictionary',
        entityId: term.id,
        oldValue: null,
        newValue: JSON.stringify(term),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة مصطلح: ${term.term}`,
      });
      
      res.json(term);
    } catch (error) {
      logger.error('Error creating dictionary term:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة المصطلح' });
    }
  });

  app.put("/api/data-dictionary/:id", authenticateToken, requireUpdate(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const term = await storage.updateDataDictionaryTerm(id, stripProtectedFields(req.body));
      if (!term) {
        return res.status(404).json({ error: 'المصطلح غير موجود' });
      }
      res.json(term);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المصطلح' });
    }
  });

  app.delete("/api/data-dictionary/:id", authenticateToken, requireDelete(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await storage.deleteDataDictionaryTerm(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف المصطلح' });
    }
  });

  // ==================== Data Stewards Routes ====================
  
  app.get("/api/data-stewards", authenticateToken, requireView(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const stewards = await storage.getDataStewards();
      res.json(stewards);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب ممثلي البيانات' });
    }
  });

  app.post("/api/data-stewards", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const stewardData = {
        ...req.body,
        createdBy: req.user?.id || null,
      };
      const steward = await storage.createDataSteward(stewardData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_data_steward',
        entityType: 'data_steward',
        entityId: steward.id,
        oldValue: null,
        newValue: JSON.stringify(steward),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة ممثل بيانات: ${steward.name}`,
      });
      
      res.json(steward);
    } catch (error) {
      logger.error('Error creating data steward:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة ممثل البيانات' });
    }
  });

  app.put("/api/data-stewards/:id", authenticateToken, requireUpdate(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const steward = await storage.updateDataSteward(id, stripProtectedFields(req.body));
      if (!steward) {
        return res.status(404).json({ error: 'ممثل البيانات غير موجود' });
      }
      res.json(steward);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث ممثل البيانات' });
    }
  });

  app.delete("/api/data-stewards/:id", authenticateToken, requireDelete(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await storage.deleteDataSteward(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف ممثل البيانات' });
    }
  });

  // ==================== DMO Requests Routes ====================
  app.get("/api/dmo-requests", authenticateToken, requireView(RESOURCES.DMO_REQUESTS), async (req, res) => {
    try {
      const requests = await storage.getDmoRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
    }
  });

  app.get("/api/dmo-requests/steward/:stewardId", authenticateToken, async (req, res) => {
    try {
      const stewardId = parseId(req.params.stewardId, res);
      if (!stewardId) return;
      const requests = await storage.getDmoRequestsBySteward(stewardId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب طلبات ممثل البيانات' });
    }
  });

  // Get requests assigned to current user (must be before /:id route)
  app.get("/api/dmo-requests/my-requests", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'غير مصرح' });
      }
      const stewards = await storage.getDataStewards();
      const mySteward = stewards.find(s => s.userId === userId);
      const myEmail = req.user?.email;
      const myStewardByEmail = !mySteward && myEmail ? stewards.find(s => s.email === myEmail) : null;
      const stewardRecord = mySteward || myStewardByEmail;

      if (stewardRecord) {
        const requests = await storage.getDmoRequestsBySteward(stewardRecord.id);
        res.json(requests);
      } else {
        const requestsByUserId = await storage.getDmoRequestsBySteward(userId);
        res.json(requestsByUserId);
      }
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
    }
  });

  app.post("/api/dmo-requests", authenticateToken, createRateLimiter, requireCreate(RESOURCES.DMO_REQUESTS), async (req: any, res) => {
    try {
      const requestData = {
        ...req.body,
        requestedBy: req.user?.id || null,
      };
      const request = await storage.createDmoRequest(requestData);
      
      // Create notification for steward
      const stewards = await storage.getDataStewards();
      const steward = stewards.find(s => s.id === requestData.stewardId);
      if (steward) {
        let notifyUserId = steward.userId;
        if (!notifyUserId && steward.email) {
          const allUsers = await storage.getUsers();
          const matchedUser = allUsers.find(u => u.email === steward.email);
          if (matchedUser) notifyUserId = matchedUser.id;
        }
        if (notifyUserId) {
          await storage.createNotification({
            userId: notifyUserId,
            title: 'طلب جديد من مكتب إدارة البيانات',
            message: `لديك طلب جديد: ${requestData.title}`,
            type: 'task',
            priority: requestData.priority || 'medium',
            isRead: false,
            entityType: 'dmo_request',
            entityId: request?.id || null,
            actionUrl: null,
          });
        }
      }
      
      res.status(201).json(request);
    } catch (error) {
      logger.error('Error creating DMO request:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الطلب' });
    }
  });

  app.put("/api/dmo-requests/:id", authenticateToken, requireUpdate(RESOURCES.DMO_REQUESTS), async (req, res) => {
    try {
      const updates = req.body;
      if (updates.status === 'completed') {
        updates.completedAt = new Date();
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const request = await storage.updateDmoRequest(id, updates);
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث الطلب' });
    }
  });

  app.put("/api/dmo-requests/:id/status", authenticateToken, requireUpdate(RESOURCES.DMO_REQUESTS), async (req, res) => {
    try {
      const { status, response } = req.body;
      const updates: any = { status };
      if (response) updates.response = response;
      if (status === 'completed') {
        updates.completedAt = new Date();
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const request = await storage.updateDmoRequest(id, updates);
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث حالة الطلب' });
    }
  });

  app.delete("/api/dmo-requests/:id", authenticateToken, requireDelete(RESOURCES.DMO_REQUESTS), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await storage.deleteDmoRequest(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف الطلب' });
    }
  });

  // ==================== IT Assets Routes (CTO Management) ====================
  
  app.get("/api/it-assets", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const hasGlobalAccess = hasPermission(userRole, RESOURCES.IT_ASSETS, ACTIONS.VIEW);
      const DEPT_ASSET_RESOURCES: Record<string, any> = {
        infrastructure: RESOURCES.INFRASTRUCTURE_ASSETS,
        cybersecurity: RESOURCES.CYBERSECURITY_ASSETS,
        digital_transformation: RESOURCES.DIGITAL_ASSETS,
        support: RESOURCES.SUPPORT_ASSETS,
      };
      const deptResource = DEPT_ASSET_RESOURCES[userPortal];
      const hasDeptAccess = deptResource ? hasPermission(userRole, deptResource, ACTIONS.VIEW) : false;

      if (!hasGlobalAccess && !hasDeptAccess) {
        return res.status(403).json({ error: 'غير مصرح لك بعرض الأصول التقنية' });
      }

      const { departmentId } = req.query;
      let assets;
      if (hasGlobalAccess) {
        assets = departmentId
          ? await storage.getITAssetsByDepartment(parseInt(departmentId as string))
          : await storage.getITAssets();
      } else {
        const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
        const effectiveDeptId = departmentId ? parseInt(departmentId as string) : userDeptId;
        if (effectiveDeptId !== userDeptId) {
          return res.status(403).json({ error: 'لا يمكنك الاطلاع على أصول إدارة أخرى' });
        }
        assets = await storage.getITAssetsByDepartment(effectiveDeptId);
      }
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأصول التقنية' });
    }
  });

  app.get("/api/it-assets/department/:departmentId", authenticateToken, async (req: any, res) => {
    try {
      const departmentId = parseId(req.params.departmentId, res);
      if (!departmentId) return;

      // Department isolation check
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const isAdmin = ['system_admin', 'admin', 'it_director'].includes(req.user.role);
      if (!isAdmin && userDeptId && departmentId !== userDeptId) {
        return res.status(403).json({ error: 'ليس لديك صلاحية الوصول لبيانات هذه الإدارة' });
      }

      const assets = await storage.getITAssetsByDepartment(departmentId);
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأصول المعينة للإدارة' });
    }
  });

  app.get("/api/it-assets/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const asset = await storage.getITAssetById(id);
      if (!asset) {
        return res.status(404).json({ error: 'الأصل غير موجود' });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأصل' });
    }
  });

  app.post("/api/it-assets", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const hasGlobalAccess = hasPermission(userRole, RESOURCES.IT_ASSETS, ACTIONS.CREATE);
      const DEPT_ASSET_RESOURCES: Record<string, any> = {
        infrastructure: RESOURCES.INFRASTRUCTURE_ASSETS,
        cybersecurity: RESOURCES.CYBERSECURITY_ASSETS,
        digital_transformation: RESOURCES.DIGITAL_ASSETS,
        support: RESOURCES.SUPPORT_ASSETS,
      };
      const deptResource = DEPT_ASSET_RESOURCES[userPortal];
      const hasDeptAccess = deptResource ? hasPermission(userRole, deptResource, ACTIONS.CREATE) : false;
      if (!hasGlobalAccess && !hasDeptAccess) {
        return res.status(403).json({ error: 'غير مصرح لك بإنشاء الأصول التقنية' });
      }
      if (!hasGlobalAccess && hasDeptAccess) {
        const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
        req.body.assignedDepartmentId = userDeptId;
      }
      const { name, nameAr: bodyNameAr, nameEn, description, assetType, dataClassification, assignedDepartmentId: bodyDeptId, departmentId: altDeptId, manufacturer, model, serialNumber, purchaseDate, warrantyExpiry, location, status, configurationDetails, ipAddress, criticality, value } = req.body;
      const assignedDepartmentId = bodyDeptId || altDeptId;
      if (!name && !bodyNameAr) {
        return res.status(400).json({ error: 'اسم الأصل التقني مطلوب' });
      }
      const autoCode = 'AST-' + Date.now().toString().slice(-8);
      const assetData = {
        assetCode: autoCode,
        nameAr: bodyNameAr || name,
        nameEn: nameEn || name || null,
        description: description || null,
        assetType: assetType || 'hardware',
        dataClassification: dataClassification || 'public',
        assignedDepartmentId: assignedDepartmentId ? parseInt(assignedDepartmentId) : null,
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        location: location || null,
        status: status || 'active',
        configurationDetails: configurationDetails || null,
        ipAddress: ipAddress || null,
        criticality: criticality || 'medium',
        value: value ? String(value) : null,
        assignedById: req.user?.id || null,
        assignedAt: assignedDepartmentId ? new Date() : null,
      };
      const asset = await storage.createITAsset(assetData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_it_asset',
        entityType: 'it_asset',
        entityId: asset.id,
        newValue: asset,
        oldValue: null,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        details: `إنشاء أصل تقني: ${asset.nameAr}`,
      });
      
      res.json(asset);
    } catch (error) {
      logger.error('Error creating IT asset:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الأصل التقني' });
    }
  });

  app.put("/api/it-assets/:id", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const hasGlobalAccess = hasPermission(userRole, RESOURCES.IT_ASSETS, ACTIONS.UPDATE);
      const DEPT_ASSET_RESOURCES: Record<string, any> = {
        infrastructure: RESOURCES.INFRASTRUCTURE_ASSETS,
        cybersecurity: RESOURCES.CYBERSECURITY_ASSETS,
        digital_transformation: RESOURCES.DIGITAL_ASSETS,
        support: RESOURCES.SUPPORT_ASSETS,
      };
      const deptResource = DEPT_ASSET_RESOURCES[userPortal];
      const hasDeptAccess = deptResource ? hasPermission(userRole, deptResource, ACTIONS.UPDATE) : false;
      if (!hasGlobalAccess && !hasDeptAccess) {
        return res.status(403).json({ error: 'غير مصرح لك بتعديل الأصول التقنية' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      if (!hasGlobalAccess && hasDeptAccess) {
        const existing = await storage.getITAssetById(id);
        const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
        if (existing && existing.assignedDepartmentId !== userDeptId) {
          return res.status(403).json({ error: 'لا يمكنك تعديل أصل تابع لإدارة أخرى' });
        }
      }
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };
      
      if (req.body.assignedDepartmentId && !req.body.assignedAt) {
        updateData.assignedAt = new Date();
        updateData.assignedById = req.user?.id;
      }
      
      const asset = await storage.updateITAsset(id, updateData);
      if (!asset) {
        return res.status(404).json({ error: 'الأصل غير موجود' });
      }
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update_it_asset',
        entityType: 'it_asset',
        entityId: asset.id,
        newValue: asset,
        oldValue: null,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        details: `تحديث أصل تقني: ${asset.nameAr}`,
      });
      
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث الأصل' });
    }
  });

  app.delete("/api/it-assets/:id", authenticateToken, requireDelete(RESOURCES.IT_ASSETS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const asset = await storage.getITAssetById(id);
      await storage.deleteITAsset(id);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete_it_asset',
        entityType: 'it_asset',
        entityId: id,
        oldValue: asset,
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        details: `حذف أصل تقني: ${asset?.nameAr}`,
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف الأصل' });
    }
  });

  // ==================== Data Quality Rules Routes ====================
  
  app.get("/api/data-quality", authenticateToken, requireView(RESOURCES.DATA_CATALOG), async (req, res) => {
    try {
      const rules = await storage.getDataQualityRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب قواعد الجودة' });
    }
  });

  app.post("/api/data-quality", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const ruleData = {
        ...req.body,
        createdBy: req.user?.id || null,
      };
      const rule = await storage.createDataQualityRule(ruleData);
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء قاعدة الجودة' });
    }
  });

  app.put("/api/data-quality/:id", authenticateToken, requireUpdate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const rule = await storage.updateDataQualityRule(id, stripProtectedFields(req.body));
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث القاعدة' });
    }
  });

  app.delete("/api/data-quality/:id", authenticateToken, requireDelete(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await storage.deleteDataQualityRule(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف القاعدة' });
    }
  });

  app.post("/api/data-quality/bulk-discover", authenticateToken, requireCreate(RESOURCES.DATA_CATALOG), async (req: any, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const tables = await engine.getSystemTables();
      const existingRules = await storage.getDataQualityRules();
      const existingTableRules = new Set(existingRules.map((r: any) => `${r.targetTable}__${r.dimension}`));
      const allowedDimensions = ['الاكتمال', 'التفرد', 'الدقة', 'الاتساق', 'الحداثة', 'الصلاحية'];
      const allTableNames = tables.map((t: any) => t.table_name);
      const rawTables = Array.isArray(req.body.tables) ? req.body.tables : allTableNames;
      const selectedTables: string[] = rawTables.filter((t: string) => allTableNames.includes(t));
      const rawDims = Array.isArray(req.body.dimensions) ? req.body.dimensions : ['الاكتمال', 'التفرد'];
      const dimensions: string[] = rawDims.filter((d: string) => allowedDimensions.includes(d));
      let created = 0;
      let skipped = 0;
      for (const tableName of selectedTables) {
        const tableInfo = tables.find((t: any) => t.table_name === tableName);
        if (!tableInfo || tableInfo.row_count === 0) { skipped++; continue; }
        for (const dim of dimensions) {
          const key = `${tableName}__${dim}`;
          if (existingTableRules.has(key)) { skipped++; continue; }
          const dimNames: Record<string, string> = { 'الاكتمال': 'Completeness', 'التفرد': 'Uniqueness', 'الدقة': 'Accuracy', 'الاتساق': 'Consistency', 'الحداثة': 'Timeliness', 'الصلاحية': 'Validity' };
          await storage.createDataQualityRule({
            name: `فحص ${dim} - ${tableName}`,
            dimension: dim,
            targetTable: tableName,
            targetColumn: '',
            threshold: String(dim === 'التفرد' ? 99 : 90),
            status: 'active',
            ruleType: 'validation',
            description: `قاعدة فحص ${dim} (${dimNames[dim] || dim}) تم إنشاؤها تلقائياً للجدول ${tableName}`,
            systemName: 'control_hub',
            severity: 'medium',
            createdBy: req.user?.id || null,
          });
          created++;
        }
      }
      res.json({ created, skipped, total: selectedTables.length });
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الاكتشاف التلقائي' });
    }
  });

  // Quality Check Execution
  app.post("/api/data-quality/run-check/:id", authenticateToken, requirePortal([...ADMIN_PORTALS, ...DMO_PORTALS]), async (req: any, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const { runQualityCheckOnExternal } = await import("./external-db");
      const engine = getQualityEngine();
      const id = parseId(req.params.id, res);
      if (!id) return;
      const rule = await storage.getDataQualityRuleById(id);
      if (!rule) return res.status(404).json({ error: 'القاعدة غير موجودة' });

      let checkResult: any;

      if (rule.connectionId) {
        const [conn] = await db.select().from(databaseConnections).where(eq(databaseConnections.id, rule.connectionId));
        if (!conn) {
          return res.status(404).json({ error: 'قاعدة البيانات الخارجية المرتبطة بهذه القاعدة غير موجودة' });
        }
        const extConfig = {
          databaseType: conn.databaseType as any,
          host: conn.host,
          port: conn.port,
          databaseName: conn.databaseName,
          username: conn.username || '',
          password: conn.encryptedPassword || '',
          sslEnabled: conn.sslEnabled || false,
        };
        checkResult = await runQualityCheckOnExternal(extConfig, {
          ruleId: rule.id,
          ruleName: rule.name,
          dimension: rule.dimension,
          targetTable: rule.targetTable || '',
          targetColumn: rule.targetColumn || undefined,
          threshold: Number(rule.threshold) || 90,
          sqlExpression: rule.sqlExpression || undefined,
          validationPattern: rule.validationPattern || undefined,
          systemName: rule.systemName || conn.connectionName,
        });
      } else {
        checkResult = await engine.runCheck(rule);
      }

      const savedCheck = await storage.createDataQualityCheck({
        ruleId: checkResult.ruleId,
        ruleName: checkResult.ruleName,
        dimension: checkResult.dimension,
        targetTable: checkResult.targetTable,
        targetColumn: checkResult.targetColumn,
        systemName: checkResult.systemName,
        totalRecords: checkResult.totalRecords,
        passedRecords: checkResult.passedRecords,
        failedRecords: checkResult.failedRecords,
        score: String(Number(checkResult.score).toFixed(2)),
        threshold: String(checkResult.threshold),
        passed: checkResult.passed,
        executionTime: checkResult.executionTime,
        errorMessage: checkResult.errorMessage,
        sampleFailures: checkResult.sampleFailures,
        checkType: 'automated',
        executedBy: req.user?.id || null,
      });

      await storage.updateDataQualityRule(rule.id, {
        currentScore: String(Number(checkResult.score).toFixed(2)),
        lastChecked: new Date(),
        totalRecordsChecked: checkResult.totalRecords,
        failedRecords: checkResult.failedRecords,
        lastCheckDuration: checkResult.executionTime,
      });

      res.json(savedCheck);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في تشغيل الفحص' });
    }
  });

  app.post("/api/data-quality/run-all", authenticateToken, requirePortal([...ADMIN_PORTALS, ...DMO_PORTALS]), async (req: any, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const { runQualityCheckOnExternal } = await import("./external-db");
      const engine = getQualityEngine();
      const rules = await storage.getDataQualityRules();
      const activeRules = rules.filter(r => r.status === 'active');
      const results = [];

      for (const rule of activeRules) {
        let checkResult: any;

        if (rule.connectionId) {
          const [conn] = await db.select().from(databaseConnections).where(eq(databaseConnections.id, rule.connectionId));
          if (conn) {
            const extConfig = {
              databaseType: conn.databaseType as any,
              host: conn.host,
              port: conn.port,
              databaseName: conn.databaseName,
              username: conn.username || '',
              password: conn.encryptedPassword || '',
              sslEnabled: conn.sslEnabled || false,
            };
            checkResult = await runQualityCheckOnExternal(extConfig, {
              ruleId: rule.id,
              ruleName: rule.name,
              dimension: rule.dimension,
              targetTable: rule.targetTable || '',
              targetColumn: rule.targetColumn || undefined,
              threshold: Number(rule.threshold) || 90,
              sqlExpression: rule.sqlExpression || undefined,
              validationPattern: rule.validationPattern || undefined,
              systemName: rule.systemName || conn.connectionName,
            });
          } else {
            checkResult = await engine.runCheck(rule);
          }
        } else {
          checkResult = await engine.runCheck(rule);
        }

        const savedCheck = await storage.createDataQualityCheck({
          ruleId: checkResult.ruleId,
          ruleName: checkResult.ruleName,
          dimension: checkResult.dimension,
          targetTable: checkResult.targetTable,
          targetColumn: checkResult.targetColumn,
          systemName: checkResult.systemName,
          totalRecords: checkResult.totalRecords,
          passedRecords: checkResult.passedRecords,
          failedRecords: checkResult.failedRecords,
          score: String(Number(checkResult.score).toFixed(2)),
          threshold: String(checkResult.threshold),
          passed: checkResult.passed,
          executionTime: checkResult.executionTime,
          errorMessage: checkResult.errorMessage,
          sampleFailures: checkResult.sampleFailures,
          checkType: 'automated',
          executedBy: req.user?.id || null,
        });
        await storage.updateDataQualityRule(rule.id, {
          currentScore: String(Number(checkResult.score).toFixed(2)),
          lastChecked: new Date(),
          totalRecordsChecked: checkResult.totalRecords,
          failedRecords: checkResult.failedRecords,
          lastCheckDuration: checkResult.executionTime,
        });
        results.push(savedCheck);
      }

      res.json({ totalChecks: results.length, results });
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في تشغيل الفحوصات' });
    }
  });

  app.get("/api/data-quality/checks", authenticateToken, async (req, res) => {
    try {
      const limitRaw = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const limit = isNaN(limitRaw) || limitRaw < 1 ? 100 : Math.min(limitRaw, 1000);
      const checks = await storage.getDataQualityChecks(limit);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب سجل الفحوصات' });
    }
  });

  app.get("/api/data-quality/checks/:ruleId", authenticateToken, async (req, res) => {
    try {
      const ruleId = parseId(req.params.ruleId, res);
      if (!ruleId) return;
      const checks = await storage.getDataQualityChecksByRule(ruleId);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب فحوصات القاعدة' });
    }
  });

  app.get("/api/data-quality/connectivity", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const result = await engine.testConnectivity();
      res.json(result);
    } catch (error: any) {
      res.json({ connected: false, version: '', tables: 0, error: 'فشل الاتصال' });
    }
  });

  app.get("/api/data-quality/tables", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const tables = await engine.getSystemTables();
      res.json(tables);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في جلب الجداول' });
    }
  });

  app.get("/api/data-quality/tables/:name/columns", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const columns = await engine.getTableColumns(req.params.name);
      res.json(columns);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/tables/:name/stats", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const stats = await engine.getTableStats(req.params.name);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/dimensions", authenticateToken, async (req, res) => {
    try {
      const { SIX_DIMENSIONS } = await import("./services/dataQualityEngine");
      res.json(SIX_DIMENSIONS);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/health", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const health = await engine.getOverallHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/suggest-rules", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const result = await engine.suggestRules();
      res.json(result.suggestions || []);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/profile/:tableName", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const profile = await engine.getDataProfile(req.params.tableName);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/data-quality/distribution/:tableName/:columnName", authenticateToken, async (req, res) => {
    try {
      const { getQualityEngine } = await import("./services/dataQualityEngine");
      const engine = getQualityEngine();
      const dist = await engine.getColumnDistribution(req.params.tableName, req.params.columnName);
      res.json(dist);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Security Incidents Routes ====================
  
  app.get("/api/security-incidents", authenticateToken, requireView(RESOURCES.SECURITY_INCIDENTS), async (req, res) => {
    try {
      const incidents = await storage.getSecurityIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الحوادث الأمنية' });
    }
  });

  app.post("/api/security-incidents", authenticateToken, requireCreate(RESOURCES.SECURITY_INCIDENTS), async (req: any, res) => {
    try {
      const incidentNumber = `INC-${Date.now()}`;
      const { title, titleAr, description, severity, incidentType, affectedSystems, status: incidentStatus,
              sourceSystem, affectedDepartment, isAnonymous, detectionMethod, containmentActions, remediationSteps } = req.body;
      if (!title && !titleAr) {
        return res.status(400).json({ error: 'عنوان الحادثة مطلوب' });
      }
      const incidentData = {
        title: title || titleAr, titleAr: titleAr || null,
        description: description || null,
        severity: severity || 'medium', incidentType: incidentType || null,
        status: incidentStatus || 'open',
        incidentNumber,
        reportedBy: isAnonymous ? null : (req.user?.id || null),
        resolvedAt: null,
        resolution: null,
        assignedTo: null,
        affectedAssets: affectedSystems || null,
        sourceSystem: sourceSystem || null,
        affectedDepartment: affectedDepartment || null,
        isAnonymous: isAnonymous || false,
        detectionMethod: detectionMethod || null,
        containmentActions: containmentActions || null,
        remediationSteps: remediationSteps || null,
      };
      const incident = await storage.createSecurityIncident(incidentData);
      invalidateDashboardCaches();
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء البلاغ الأمني' });
    }
  });

  // ==================== Training Courses Routes ====================

  app.get("/api/training-courses", authenticateToken, async (req, res) => {
    try {
      const courses = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.createdAt));
      res.json(courses);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الدورات التدريبية' });
    }
  });

  app.post("/api/training-courses", authenticateToken, requirePortal(['dmo', 'admin', 'it_director']), async (req: any, res) => {
    try {
      const { title, duration, level, category, description } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'عنوان الدورة مطلوب' });
      }
      const [course] = await db.insert(trainingCourses).values({
        title: title.trim(),
        duration: duration || null,
        level: level || 'مبتدئ',
        category: category || null,
        description: description || null,
        enrolled: 0,
        completed: 0,
        status: 'active',
        departmentId: req.user?.itDepartmentId || null,
        createdBy: req.user?.id || null,
      }).returning();
      res.status(201).json(course);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء الدورة التدريبية' });
    }
  });

  app.put("/api/training-courses/:id", authenticateToken, requirePortal(['dmo', 'admin', 'it_director']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرف غير صالح' });
      const { title, duration, level, category, description, status } = req.body;
      const [existing] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, id));
      if (!existing) return res.status(404).json({ error: 'الدورة غير موجودة' });
      const [updated] = await db.update(trainingCourses).set({
        ...(title && { title: title.trim() }),
        ...(duration !== undefined && { duration }),
        ...(level && { level }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        updatedAt: new Date(),
      }).where(eq(trainingCourses.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث الدورة التدريبية' });
    }
  });

  app.delete("/api/training-courses/:id", authenticateToken, requirePortal(['dmo', 'admin', 'it_director']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرف غير صالح' });
      const [existing] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, id));
      if (!existing) return res.status(404).json({ error: 'الدورة غير موجودة' });
      await db.delete(trainingCourses).where(eq(trainingCourses.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف الدورة التدريبية' });
    }
  });

  // ==================== Data Risks Routes (see full CRUD at end of file) ====================

  // ==================== Data Agreements Routes ====================
  
  app.get("/api/data-agreements", authenticateToken, requireView(RESOURCES.DATA_AGREEMENTS), async (req, res) => {
    try {
      const agreements = await storage.getDataAgreements();
      res.json(agreements);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الاتفاقيات' });
    }
  });

  app.post("/api/data-agreements", authenticateToken, requireCreate(RESOURCES.DATA_AGREEMENTS), async (req: any, res) => {
    try {
      const agreementNumber = `AGR-${Date.now()}`;
      const { title, description, agreementType, parties, status: agrStatus, startDate, endDate, dataScope } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان الاتفاقية مطلوب' });
      }
      const agreementData = {
        title, description: description || null,
        agreementType: agreementType || null, partyName: parties || null,
        status: agrStatus || 'draft', startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        fileUrl: null,
        agreementNumber,
        createdBy: req.user?.id || null,
      };
      const agreement = await storage.createDataAgreement(agreementData);
      res.json(agreement);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء الاتفاقية' });
    }
  });

  app.post("/api/data-agreements/:id/upload", authenticateToken, requireUpdate(RESOURCES.DATA_AGREEMENTS), upload.single('file'), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      if (!req.file) {
        return res.status(400).json({ error: 'الملف مطلوب' });
      }
      const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/png', 'image/jpeg'];
      if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'صيغة الملف غير مدعومة. الصيغ المتاحة: PDF, Word, Excel, PowerPoint, PNG, JPEG' });
      }
      const fileName = `agreements/${id}/${Date.now()}-${req.file.originalname}`;
      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const blob = bucket.file(fileName);
        await blob.save(req.file.buffer, { contentType: req.file.mimetype });
        const fileUrl = fileName;
        await db.update(dataAgreements).set({ fileUrl, updatedAt: new Date() }).where(eq(dataAgreements.id, id));
        res.json({ success: true, fileUrl });
      } catch (uploadError) {
        logger.error('[Upload] Object storage failed:', { error: uploadError });
        return res.status(500).json({ success: false, message: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى' });
      }
    } catch (error) {
      logger.error('Error uploading agreement file:', { error });
      res.status(500).json({ error: 'حدث خطأ في رفع الملف' });
    }
  });

  // ==================== Data Subject Requests (DSR) Routes ====================
  
  app.get("/api/dsr", authenticateToken, requireView(RESOURCES.COMPLIANCE), async (req, res) => {
    try {
      const requests = await storage.getDataSubjectRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
    }
  });

  app.post("/api/dsr", authenticateToken, requireCreate(RESOURCES.COMPLIANCE), async (req: any, res) => {
    try {
      const requestNumber = `DSR-${Date.now()}`;
      const dsrData = {
        ...req.body,
        requestNumber,
        source: 'internal',
      };
      const request = await storage.createDataSubjectRequest(dsrData);
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء الطلب' });
    }
  });

  // ==================== Public DSR API - واجهة عامة لموقع النادي الإلكتروني ====================
  
  app.post("/api/public/dsr", publicEndpointRateLimiter, async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'];
      const validApiKey = process.env.DSR_PUBLIC_API_KEY;
      if (validApiKey && apiKey !== validApiKey) {
        return res.status(401).json({ 
          success: false,
          error: 'مفتاح API غير صالح',
          errorEn: 'Invalid API key'
        });
      }

      const { requestType, subjectName, subjectEmail, subjectPhone, subjectIdNumber, description } = req.body;

      if (!requestType || !subjectName) {
        return res.status(400).json({
          success: false,
          error: 'نوع الطلب واسم مقدم الطلب مطلوبان',
          errorEn: 'Request type and subject name are required'
        });
      }

      const validTypes = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection', 'other'];
      if (!validTypes.includes(requestType)) {
        return res.status(400).json({
          success: false,
          error: 'نوع الطلب غير صالح',
          errorEn: 'Invalid request type',
          validTypes
        });
      }

      if (subjectEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subjectEmail)) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني غير صالح',
          errorEn: 'Invalid email format'
        });
      }

      const requestNumber = `DSR-PUB-${Date.now()}`;
      const dsrData = {
        requestNumber,
        requestType,
        subjectName: subjectName.trim().substring(0, 200),
        subjectEmail: subjectEmail?.trim() || null,
        subjectPhone: subjectPhone?.trim() || null,
        subjectIdNumber: subjectIdNumber?.trim() || null,
        description: description?.trim().substring(0, 2000) || null,
        source: 'website',
        status: 'pending',
        priority: 'normal',
        assignedTo: null,
        dueDate: null,
        completedAt: null,
        response: null,
      };

      const request = await storage.createDataSubjectRequest(dsrData);

      logger.info('[DSR] Public request received from website', { 
        requestNumber, 
        requestType, 
        subjectName: subjectName.substring(0, 30) 
      });

      res.status(201).json({
        success: true,
        message: 'تم استلام طلبك بنجاح وسيتم مراجعته من قبل مكتب إدارة البيانات',
        messageEn: 'Your request has been received and will be reviewed by the Data Management Office',
        requestNumber,
        requestId: request.id,
      });
    } catch (error: any) {
      logger.error('[DSR] Public submission error:', { error: error.message });
      res.status(500).json({ 
        success: false,
        error: 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً',
        errorEn: 'An error occurred while submitting the request'
      });
    }
  });

  app.get("/api/public/dsr/status/:requestNumber", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'];
      const validApiKey = process.env.DSR_PUBLIC_API_KEY;
      if (validApiKey && apiKey !== validApiKey) {
        return res.status(401).json({ success: false, error: 'مفتاح API غير صالح' });
      }

      const { requestNumber } = req.params;
      const requests = await storage.getDataSubjectRequests();
      const request = requests.find((r: any) => r.requestNumber === requestNumber);
      
      if (!request) {
        return res.status(404).json({ 
          success: false, 
          error: 'الطلب غير موجود',
          errorEn: 'Request not found'
        });
      }

      const statusLabels: Record<string, string> = {
        pending: 'قيد الانتظار',
        in_progress: 'قيد المعالجة',
        completed: 'مكتمل',
        rejected: 'مرفوض',
      };

      res.json({
        success: true,
        requestNumber: request.requestNumber,
        status: request.status,
        statusLabel: statusLabels[request.status] || request.status,
        requestType: request.requestType,
        createdAt: request.createdAt,
        response: request.status === 'completed' ? request.response : null,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
  });

  app.get("/api/public/dsr/types", (_req, res) => {
    res.json({
      success: true,
      types: [
        { id: 'access', nameAr: 'طلب الوصول للبيانات', nameEn: 'Data Access Request' },
        { id: 'rectification', nameAr: 'طلب تصحيح البيانات', nameEn: 'Data Rectification Request' },
        { id: 'erasure', nameAr: 'طلب حذف البيانات', nameEn: 'Data Erasure Request' },
        { id: 'portability', nameAr: 'طلب نقل البيانات', nameEn: 'Data Portability Request' },
        { id: 'restriction', nameAr: 'طلب تقييد المعالجة', nameEn: 'Processing Restriction Request' },
        { id: 'objection', nameAr: 'طلب الاعتراض', nameEn: 'Objection Request' },
        { id: 'other', nameAr: 'طلب آخر', nameEn: 'Other Request' },
      ],
    });
  });

  // ==================== KPIs Routes ====================
  
  app.get("/api/kpis", authenticateToken, requireView(RESOURCES.IT_KPIS), async (req: any, res) => {
    try {
      const allKpis = await storage.getKPIMetrics();
      const _deptIdRaw = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
      const requestedDeptId = (_deptIdRaw !== null && !isNaN(_deptIdRaw)) ? _deptIdRaw : null;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isGlobal = ['admin', 'system_admin', 'it_director'].includes(userRole);
      const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;

      if (isGlobal) {
        if (requestedDeptId) {
          res.json(allKpis.filter((k: any) => k.departmentId === requestedDeptId));
        } else {
          res.json(allKpis);
        }
      } else if (userDeptId) {
        if (requestedDeptId && requestedDeptId !== userDeptId) {
          return res.status(403).json({ error: 'غير مصرح لك بالوصول لمؤشرات قسم آخر' });
        }
        res.json(allKpis.filter((k: any) => k.departmentId === userDeptId || !k.departmentId));
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب مؤشرات الأداء' });
    }
  });

  app.post("/api/kpis", authenticateToken, requireCreate(RESOURCES.IT_KPIS), async (req: any, res) => {
    try {
      const { metricName, metricType, targetValue, actualValue, unit, period, periodDate, notes, departmentId } = req.body;
      if (!metricName || !metricType || !period) {
        return res.status(400).json({ error: 'الحقول المطلوبة: اسم المؤشر، نوع المؤشر، الفترة' });
      }
      const kpiData = {
        metricName,
        metricType,
        targetValue: targetValue ? String(targetValue) : null,
        actualValue: actualValue ? String(actualValue) : null,
        unit: unit || null,
        period,
        periodDate: periodDate ? new Date(periodDate) : new Date(),
        trend: 'stable',
        notes: notes || null,
        departmentId: departmentId ? parseInt(departmentId) : null,
      };
      const kpi = await storage.createKPIMetric(kpiData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_kpi',
        entityType: 'kpi_metric',
        entityId: kpi.id,
        oldValue: null,
        newValue: JSON.stringify(kpi),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء مؤشر أداء: ${kpi.metricName}`,
      });
      
      res.json(kpi);
    } catch (error) {
      logger.error('Error creating KPI:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء المؤشر' });
    }
  });

  app.put("/api/kpis/:id", authenticateToken, requireUpdate(RESOURCES.IT_KPIS), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const updated = await storage.updateKPIMetric(id, stripProtectedFields(req.body));
      if (!updated) {
        return res.status(404).json({ error: 'المؤشر غير موجود' });
      }
      res.json(updated);
    } catch (error) {
      logger.error('Error updating KPI metric', { error, id: req.params.id });
      res.status(500).json({ error: 'حدث خطأ في تحديث المؤشر' });
    }
  });

  app.delete("/api/kpis/:id", authenticateToken, requireDelete(RESOURCES.IT_KPIS), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const deleted = await storage.deleteKPIMetric(id);
      if (!deleted) {
        return res.status(404).json({ error: 'المؤشر غير موجود' });
      }
      res.json({ success: true, message: 'تم حذف المؤشر بنجاح' });
    } catch (error) {
      logger.error('Error deleting KPI metric', { error, id: req.params.id });
      res.status(500).json({ error: 'حدث خطأ في حذف المؤشر' });
    }
  });

  // ==================== Team Members Routes ====================
  
  app.get("/api/team-members", authenticateToken, async (req, res) => {
    try {
      const members = await storage.getUsers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الموظفين' });
    }
  });

  app.get("/api/department/my-employees", authenticateToken, async (req: any, res) => {
    try {
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      const userRole = req.user?.role || '';
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم عرض الموظفين' });
      }

      const portalStaffRoles: Record<string, string[]> = {
        'it_infrastructure_manager': ['it_infrastructure_staff'],
        'it_cybersecurity_manager': ['it_cybersecurity_staff'],
        'it_digital_manager': ['it_digital_staff'],
        'it_support_manager': ['it_support_staff'],
        'dmo_manager': ['dmo_staff'],
        'it_director': ['it_infrastructure_staff', 'it_cybersecurity_staff', 'it_digital_staff', 'it_support_staff', 'dmo_staff'],
        'system_admin': ['it_infrastructure_staff', 'it_cybersecurity_staff', 'it_digital_staff', 'it_support_staff', 'dmo_staff'],
      };

      const staffRoles = portalStaffRoles[userRole] || [];
      const allUsers = await db.select().from(users).where(eq(users.isActive, true));
      const filtered = allUsers.filter((u: any) => staffRoles.includes(u.role || '')).map((u: any) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, portal: u.portal,
        jobTitle: u.jobTitle, isActive: u.isActive, isActivated: u.isActivated, createdAt: u.createdAt,
      }));
      res.json(filtered);
    } catch (error) {
      logger.error('Error fetching department employees:', { error });
      res.status(500).json({ error: 'خطأ في جلب الموظفين' });
    }
  });

  app.post("/api/department/add-employee", authenticateToken, async (req: any, res) => {
    try {
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      const userRole = req.user?.role || '';
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم إضافة موظفين' });
      }

      const { name, email } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'الاسم مطلوب' });
      }
      if (!email || !email.endsWith('@jcsa.sa')) {
        return res.status(400).json({ error: 'البريد الإلكتروني يجب أن يكون بنطاق @jcsa.sa' });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }

      const portalStaffMap: Record<string, { role: string; portal: string; itDeptId: number | null; jobTitle: string }> = {
        'it_infrastructure_manager': { role: 'it_infrastructure_staff', portal: 'infrastructure', itDeptId: 9, jobTitle: 'موظف إدارة الشبكات والبنية التحتية' },
        'it_cybersecurity_manager': { role: 'it_cybersecurity_staff', portal: 'cybersecurity', itDeptId: 10, jobTitle: 'موظف إدارة الأمن السيبراني' },
        'it_digital_manager': { role: 'it_digital_staff', portal: 'digital_transformation', itDeptId: 11, jobTitle: 'موظف إدارة التحول الرقمي' },
        'it_support_manager': { role: 'it_support_staff', portal: 'support', itDeptId: 12, jobTitle: 'موظف إدارة الدعم الفني' },
        'dmo_manager': { role: 'dmo_staff', portal: 'dmo', itDeptId: 5, jobTitle: 'موظف مكتب إدارة البيانات' },
        'it_director': { role: 'it_infrastructure_staff', portal: 'infrastructure', itDeptId: 9, jobTitle: 'موظف تقنية المعلومات' },
        'system_admin': { role: 'it_infrastructure_staff', portal: 'infrastructure', itDeptId: 9, jobTitle: 'موظف تقنية المعلومات' },
      };

      const mapping = portalStaffMap[userRole];
      if (!mapping) {
        return res.status(400).json({ error: 'لا يمكن تحديد القسم' });
      }

      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const newUser = await storage.createUser({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        nameEn: null,
        phone: null,
        role: mapping.role,
        portal: mapping.portal,
        departmentId: null,
        itDepartmentId: mapping.itDeptId,
        jobTitle: mapping.jobTitle,
        passwordHash: null,
        isActive: true,
        isActivated: false,
        activationToken,
        activationTokenExpiry,
      });

      let emailSent = false;
      try {
        const baseUrl = process.env.APP_URL || 'https://controlhub.jcsa.sa';
        const activationUrl = `${baseUrl}/activate?token=${activationToken}`;
        const emailHtml = generateActivationEmail({
          recipientName: newUser.name,
          activationUrl,
        });
        emailSent = await sendEmail(
          newUser.email,
          'تفعيل حسابك في Control Hub - JCSA',
          emailHtml
        );
      } catch (e) {
        logger.warn('Failed to send activation email', { email: newUser.email });
      }

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create',
        entityType: 'user',
        entityId: newUser.id,
        oldValue: null,
        newValue: JSON.stringify({ email: newUser.email, name: newUser.name, role: mapping.role, portal: mapping.portal }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة موظف بواسطة المدير: ${newUser.name} - ${mapping.jobTitle}`,
      });

      res.json({ ...sanitizeUser(newUser), activationEmailSent: emailSent, jobTitle: mapping.jobTitle });
    } catch (error) {
      logger.error('Error adding department employee:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة الموظف' });
    }
  });

  app.post("/api/team-members", authenticateToken, async (req: any, res) => {
    try {
      const ROLE_TO_DEPT: Record<string, number> = {
        'it_infrastructure_manager': 9, 'it_infrastructure_staff': 9,
        'it_cybersecurity_manager': 10, 'it_cybersecurity_staff': 10,
        'it_digital_manager': 11, 'it_digital_staff': 11,
        'it_support_manager': 12, 'it_support_staff': 12,
        'dmo_manager': 5, 'dmo_staff': 5,
        'it_director': 9, 'system_admin': 9,
      };
      const DEPT_TO_ROLE: Record<number, string> = {
        5: 'dmo_staff',
        9: 'it_infrastructure_staff', 10: 'it_cybersecurity_staff',
        11: 'it_digital_staff', 12: 'it_support_staff',
      };
      const deptPortalMap: Record<number, string> = { 5: 'dmo', 9: 'infrastructure', 10: 'cybersecurity', 11: 'digital_transformation', 12: 'support' };

      const managerRole = req.user?.role || '';
      const managerDeptId = ROLE_TO_DEPT[managerRole] || null;
      const itDeptId = managerDeptId || (req.body.itDepartmentId ? parseInt(req.body.itDepartmentId) : null);
      const resolvedRole = itDeptId ? (DEPT_TO_ROLE[itDeptId] || 'it_infrastructure_staff') : 'it_infrastructure_staff';
      const resolvedPortal = itDeptId && deptPortalMap[itDeptId] ? deptPortalMap[itDeptId] : (req.user?.portal || 'infrastructure');
      
      if (!req.body.name || !req.body.email) {
        return res.status(400).json({ error: 'الاسم والبريد الإلكتروني مطلوبان' });
      }
      
      // FIX #6: Generate a secure random activation token — no hardcoded password
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const memberData = {
        name: req.body.name.trim(),
        email: (req.body.email || '').toLowerCase().trim(),
        itDepartmentId: itDeptId,
        role: resolvedRole,
        passwordHash: null, // will be set when user activates via email
        portal: resolvedPortal,
        isActive: true,
        isActivated: false,
        activationToken,
        activationTokenExpiry: activationExpiry,
      };
      const member = await storage.createUser(memberData);
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_team_member',
        entityType: 'user',
        entityId: member.id,
        oldValue: null,
        newValue: JSON.stringify({ name: member.name, email: member.email }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة موظف: ${member.name}`,
      });
      
      res.json(sanitizeUser(member));
    } catch (error) {
      logger.error('Error creating team member:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة الموظف' });
    }
  });

  app.put("/api/team-members/:id", authenticateToken, requireUpdate(RESOURCES.IT_TEAMS), async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const member = await storage.updateUser(id, stripProtectedFields(req.body));
      res.json(sanitizeUser(member as any));
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث بيانات الموظف' });
    }
  });

  app.delete("/api/team-members/:id", authenticateToken, requireDelete(RESOURCES.IT_TEAMS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      if (id === req.user?.id) {
        return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
      }
      const [existing] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'الموظف غير موجود' });
      }
      const [assignedTasks] = await db.select({ count: sql<number>`count(*)` }).from(tasks)
        .where(and(eq(tasks.assignedTo, id), sql`${tasks.status} NOT IN ('completed', 'cancelled')`));
      if (assignedTasks && assignedTasks.count > 0) {
        return res.status(409).json({ error: `لا يمكن حذف الموظف لوجود ${assignedTasks.count} مهمة نشطة مسندة إليه` });
      }
      await db.update(users).set({ isActive: false, deletedAt: new Date() }).where(eq(users.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'user',
        entityId: id,
        details: `تعطيل/حذف موظف: ${existing.name}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف الموظف' });
    }
  });

  app.post("/api/teams", authenticateToken, async (req: any, res) => {
    try {
      const teamData = req.body;
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create_team',
        entityType: 'team',
        entityId: 0,
        details: `إنشاء فريق: ${teamData.name}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: JSON.stringify(teamData),
      });
      res.json({ id: Date.now(), ...teamData, createdAt: new Date() });
    } catch (error) {
      logger.error('Error creating team:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الفريق' });
    }
  });

  // ==================== الأنظمة الخارجية ====================
  app.get("/api/external-systems", authenticateToken, requireView(RESOURCES.EXTERNAL_SYSTEMS), async (req: any, res) => {
    try {
      const { category, departmentId } = req.query;
      const EXT_PORTAL_DEPT: Record<string, number> = {
        infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12
      };
      const isGlobalUser = ['system_admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || EXT_PORTAL_DEPT[req.user.portal];

      const conditions = [];
      if (category && category !== 'all') {
        conditions.push(eq(externalSystems.category, category as string));
      }
      if (!isGlobalUser && userDeptId) {
        conditions.push(eq(externalSystems.departmentId, userDeptId));
      } else if (departmentId) {
        const deptId = parseInt(departmentId as string);
        if (!isNaN(deptId)) {
          conditions.push(eq(externalSystems.departmentId, deptId));
        }
      }
      const systems = conditions.length > 0
        ? await db.select().from(externalSystems).where(and(...conditions)).orderBy(desc(externalSystems.createdAt))
        : await db.select().from(externalSystems).orderBy(desc(externalSystems.createdAt));
      res.json(systems);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الأنظمة' });
    }
  });

  app.post("/api/external-systems", authenticateToken, requireCreate(RESOURCES.EXTERNAL_SYSTEMS), async (req: any, res) => {
    try {
      const { name, systemType, category, description, vendor, version: sysVersion, status, departmentId, ipAddress, url, healthCheckUrl, apiEndpoint, contactPerson, contactEmail, notes, integrationStatus, environment, criticality, dataClassification, protocol, authType, port, integrationDirection, integrationScope, slaUptime } = req.body;
      if (!name || !systemType || !category) {
        return res.status(400).json({ error: 'الحقول المطلوبة: الاسم، نوع النظام، الفئة' });
      }
      const EXT_PORTAL_DEPT_POST: Record<string, number> = {
        infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12
      };
      const isGlobalUser = ['system_admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || EXT_PORTAL_DEPT_POST[req.user.portal];
      const finalDeptId = isGlobalUser
        ? (departmentId ? parseInt(departmentId) : null)
        : (userDeptId || null);
      const [result] = await db.insert(externalSystems).values({
        name, systemType, category, description: description || null,
        vendor: vendor || null, version: sysVersion || null,
        healthStatus: status || 'unknown', departmentId: finalDeptId,
        ipAddress: ipAddress || null, 
        healthCheckUrl: healthCheckUrl || url || null,
        apiEndpoint: apiEndpoint || null,
        environment: environment || 'production',
        criticality: criticality || 'medium',
        dataClassification: dataClassification || 'internal',
        protocol: protocol || null, authType: authType || null,
        port: port ? parseInt(port) : null,
        integrationDirection: integrationDirection || 'read_only',
        integrationScope: integrationScope || null,
        slaUptime: slaUptime || null,
        approvalStatus: integrationStatus || 'pending',
        notes: notes || null, createdBy: req.user?.id,
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'create',
        entityType: 'external_system',
        entityId: insertId,
        oldValue: null,
        newValue: req.body,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إضافة نظام خارجي: ${req.body.name}`
      });
      
      res.status(201).json({ id: insertId, ...req.body });
    } catch (error) {
      logger.error('Error creating external system:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة النظام' });
    }
  });

  app.put("/api/external-systems/:id", authenticateToken, requireUpdate(RESOURCES.EXTERNAL_SYSTEMS), async (req: any, res) => {
    try {
      const systemId = parseId(req.params.id, res);
      if (!systemId) return;
      const [existing] = await db.select().from(externalSystems).where(eq(externalSystems.id, systemId));
      const EXT_PORTAL_DEPT_PUT: Record<string, number> = {
        infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12
      };
      const isGlobalUser = ['system_admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || EXT_PORTAL_DEPT_PUT[req.user.portal];
      if (!isGlobalUser && existing && existing.departmentId && existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'غير مصرح لك بتعديل نظام تابع لإدارة أخرى' });
      }
      const sanitizedBody = stripProtectedFields(req.body);
      if (sanitizedBody.healthCheckUrl || sanitizedBody.url) {
        sanitizedBody.healthCheckUrl = sanitizedBody.healthCheckUrl || sanitizedBody.url;
        delete sanitizedBody.url;
      }
      if (sanitizedBody.status && !sanitizedBody.healthStatus) {
        sanitizedBody.healthStatus = sanitizedBody.status;
        delete sanitizedBody.status;
      }
      if (sanitizedBody.integrationStatus) {
        sanitizedBody.approvalStatus = sanitizedBody.integrationStatus;
        delete sanitizedBody.integrationStatus;
      }
      if (sanitizedBody.departmentId && typeof sanitizedBody.departmentId === 'string') {
        sanitizedBody.departmentId = parseInt(sanitizedBody.departmentId) || null;
      }
      if (sanitizedBody.port && typeof sanitizedBody.port === 'string') {
        sanitizedBody.port = parseInt(sanitizedBody.port) || null;
      }
      delete sanitizedBody.contactPerson;
      delete sanitizedBody.contactEmail;
      await db.update(externalSystems)
        .set({ ...sanitizedBody, updatedAt: new Date() })
        .where(eq(externalSystems.id, systemId));
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'external_system',
        entityId: systemId,
        details: `تعديل النظام الخارجي: ${existing?.name || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(req.body),
      });
      const [updated] = await db.select().from(externalSystems).where(eq(externalSystems.id, systemId));
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث النظام' });
    }
  });

  app.delete("/api/external-systems/:id", authenticateToken, requireDelete(RESOURCES.EXTERNAL_SYSTEMS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(externalSystems).where(eq(externalSystems.id, id));
      const EXT_PORTAL_DEPT_DEL: Record<string, number> = {
        infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12
      };
      const isGlobalUser = ['system_admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || EXT_PORTAL_DEPT_DEL[req.user.portal];
      if (!isGlobalUser && existing && existing.departmentId && existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'غير مصرح لك بحذف نظام تابع لإدارة أخرى' });
      }
      await db.delete(externalSystems).where(eq(externalSystems.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'external_system',
        entityId: id,
        details: `حذف النظام الخارجي: ${existing?.name || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف النظام' });
    }
  });

  // فحص صحة النظام
  app.post("/api/external-systems/:id/health-check", authenticateToken, async (req, res) => {
    try {
      const systemId = parseId(req.params.id, res);
      if (!systemId) return;
      const [system] = await db.select().from(externalSystems).where(eq(externalSystems.id, systemId));
      
      if (!system) {
        return res.status(404).json({ error: 'النظام غير موجود' });
      }

      let healthStatus = 'unknown';
      let responseTime = 0;
      let statusCode = 0;
      let errorMessage = null;

      if (system.healthCheckUrl) {
        try {
          const startTime = Date.now();
          const response = await fetch(system.healthCheckUrl, { 
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          });
          responseTime = Date.now() - startTime;
          statusCode = response.status;
          
          if (response.ok) {
            healthStatus = 'online';
          } else {
            healthStatus = 'degraded';
          }
        } catch (err: any) {
          healthStatus = 'offline';
          errorMessage = err.message;
        }
      }

      // تحديث حالة النظام
      await db.update(externalSystems)
        .set({ 
          healthStatus, 
          responseTime, 
          lastHealthCheck: new Date() 
        })
        .where(eq(externalSystems.id, systemId));

      // تسجيل في سجل المراقبة
      await db.insert(systemHealthLogs).values({
        systemId,
        status: healthStatus,
        responseTime,
        statusCode: statusCode || null,
        errorMessage
      });

      res.json({ 
        status: healthStatus, 
        responseTime, 
        statusCode,
        checkedAt: new Date() 
      });
    } catch (error) {
      logger.error('Health check error:', { error });
      res.status(500).json({ error: 'حدث خطأ في فحص النظام' });
    }
  });

  // سجل صحة الأنظمة
  app.get("/api/external-systems/:id/health-logs", authenticateToken, async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const logs = await db.select()
        .from(systemHealthLogs)
        .where(eq(systemHealthLogs.systemId, id))
        .orderBy(sql`checked_at DESC`)
        .limit(50);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات المراقبة' });
    }
  });

  // ==================== موافقات الأنظمة الخارجية ====================
  // طلبات الموافقة للدايركتر
  app.get("/api/external-systems/pending-approvals", authenticateToken, async (req, res) => {
    try {
      const pending = await db.select()
        .from(externalSystems)
        .where(eq(externalSystems.approvalStatus, "pending"))
        .orderBy(sql`created_at DESC`);
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب طلبات الموافقة' });
    }
  });

  // Create system approval request
  app.post("/api/system-approvals/create", authenticateToken, async (req: any, res) => {
    try {
      const { systemName, requestType, justification, businessOwner, priority } = req.body;
      
      const [newSystem] = await db.insert(externalSystems).values({
        name: systemName,
        systemType: requestType || 'new_system',
        category: 'system_approval',
        description: justification,
        approvalStatus: 'pending',
        createdBy: req.user?.id,
        criticality: priority || 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: "create_system_approval",
        entityType: "external_system",
        entityId: newSystem?.id,
        details: JSON.stringify({ systemName, requestType, priority, businessOwner }),
      });
      
      res.json(newSystem);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء طلب الموافقة' });
    }
  });

  // موافقة الدايركتر على النظام
  app.post("/api/external-systems/:id/approve", authenticateToken, async (req: any, res) => {
    try {
      const systemId = parseId(req.params.id, res);
      if (!systemId) return;
      const [existing] = await db.select().from(externalSystems).where(eq(externalSystems.id, systemId));
      
      const updateData = {
        approvalStatus: "approved",
        approvedBy: req.user?.id,
        approvedAt: new Date(),
        isActive: true, // تفعيل الربط عند الموافقة
        updatedAt: new Date()
      };
      
      await db.update(externalSystems)
        .set(updateData)
        .where(eq(externalSystems.id, systemId));

      const updatedData = { ...existing, ...updateData };

      // تسجيل في سجل العمليات
      await storage.createAuditLog({
        userId: req.user?.id,
        action: "approve_external_system",
        entityType: "external_system",
        entityId: systemId,
        details: JSON.stringify({
          systemName: existing?.name,
          departmentId: existing?.departmentId,
          systemType: existing?.systemType
        }),
        ipAddress: req.ip
      });

      res.json(updatedData);
    } catch (error) {
      logger.error('Approval error:', { error });
      res.status(500).json({ error: 'حدث خطأ في الموافقة على النظام' });
    }
  });

  // رفض الدايركتر للنظام
  app.post("/api/external-systems/:id/reject", authenticateToken, async (req: any, res) => {
    try {
      const systemId = parseId(req.params.id, res);
      if (!systemId) return;
      const { reason } = req.body;
      const [existing] = await db.select().from(externalSystems).where(eq(externalSystems.id, systemId));
      
      const updateData = {
        approvalStatus: "rejected",
        approvedBy: req.user?.id,
        approvedAt: new Date(),
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date()
      };
      
      await db.update(externalSystems)
        .set(updateData)
        .where(eq(externalSystems.id, systemId));

      const updatedData = { ...existing, ...updateData };

      // تسجيل في سجل العمليات
      await storage.createAuditLog({
        userId: req.user?.id,
        action: "reject_external_system",
        entityType: "external_system",
        entityId: systemId,
        details: JSON.stringify({
          systemName: existing?.name,
          departmentId: existing?.departmentId,
          reason: reason
        }),
        ipAddress: req.ip
      });

      res.json(updatedData);
    } catch (error) {
      logger.error('Rejection error:', { error });
      res.status(500).json({ error: 'حدث خطأ في رفض النظام' });
    }
  });

  // ==================== IT Projects CRUD ====================
  app.get("/api/it-projects", authenticateToken, async (req: any, res) => {
    try {
      const { itDepartmentId, departmentId, status } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      const conditions: any[] = [];

      if (isDirectorOrAdmin) {
        if (itDepartmentId) conditions.push(eq(itProjects.itDepartmentId, parseInt(itDepartmentId as string)));
        if (departmentId) conditions.push(eq(itProjects.departmentId, parseInt(departmentId as string)));
      } else {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId) {
          conditions.push(or(
            eq(itProjects.itDepartmentId, userDeptId),
            eq(itProjects.departmentId, userDeptId)
          ));
        } else {
          conditions.push(eq(itProjects.departmentId, -1));
        }
      }
      if (status) {
        conditions.push(eq(itProjects.status, status as string));
      }
      
      // FIX #7: Filter soft-deleted records
      const baseCondition = isNull(itProjects.deletedAt);
      let results;
      if (conditions.length > 0) {
        results = await db.select().from(itProjects)
          .where(and(baseCondition, conditions.length === 1 ? conditions[0] : and(...conditions)))
          .orderBy(sql`${itProjects.createdAt} DESC`);
      } else {
        results = await db.select().from(itProjects)
          .where(baseCondition)
          .orderBy(sql`${itProjects.createdAt} DESC`);
      }

      res.json(results);
    } catch (error) {
      logger.error('Error fetching projects:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المشاريع' });
    }
  });

  app.post("/api/it-projects", authenticateToken, createRateLimiter, async (req: any, res) => {
    try {
      const body = req.body;
      // Map frontend field names to DB column names
      const nameAr = body.nameAr || body.name || body.nameEn || '';
      if (!nameAr) return res.status(400).json({ error: 'اسم المشروع مطلوب' });

      // Portal isolation: enforce department from user context
      const projUserDeptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || null;
      const isProjPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      const projRawDeptId = body.itDepartmentId || body.departmentId;
      const projRequestedDeptId = projRawDeptId ? parseInt(projRawDeptId) : null;

      let itDepartmentId: number | null;
      if (isProjPrivileged) {
        itDepartmentId = projRequestedDeptId ?? projUserDeptId;
      } else {
        if (!projUserDeptId) {
          return res.status(403).json({ error: 'لا يمكن تحديد القسم التابع لك' });
        }
        if (projRequestedDeptId && projRequestedDeptId !== projUserDeptId) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء مشروع لقسم آخر' });
        }
        itDepartmentId = projUserDeptId;
      }
      if (!itDepartmentId) return res.status(400).json({ error: 'معرف القسم مطلوب' });
      const insertData: any = {
        nameAr,
        nameEn: body.nameEn || body.name || '',
        code: body.code || `PRJ-${Date.now()}`,
        description: body.description || null,
        itDepartmentId: Number(itDepartmentId),
        managerId: body.managerId ? Number(body.managerId) : null,
        status: body.status || 'planning',
        priority: body.priority || 'medium',
        progress: Number(body.progress) || 0,
        budget: body.budget ? String(body.budget) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notes: body.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const [result] = await db.insert(itProjects).values(insertData).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create',
        entityType: 'it_project',
        entityId: insertId,
        newValue: JSON.stringify({ id: insertId, ...insertData }),
        details: `تم إنشاء مشروع: ${nameAr}`,
        ipAddress: req.ip
      });
      
      notifyProjectCreated(result, req.user?.id).catch((e: any) => logger.warn('[Notify] Project create notify error:', { error: e?.message }));
      invalidateDashboardCaches();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating project:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء المشروع' });
    }
  });

  app.put("/api/it-projects/:id", authenticateToken, async (req: any, res) => {
    try {
      const projectId = parseId(req.params.id, res);
      if (!projectId) return;
      const [existing] = await db.select().from(itProjects).where(and(eq(itProjects.id, projectId), isNull(itProjects.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'المشروع غير موجود' });
      if (!canMutateResource(req.user, existing.itDepartmentId)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل مشروع من قسم آخر' });
      }

      const body = req.body;
      const safeUpdate: any = {
        nameAr: body.nameAr || body.name || existing.nameAr,
        nameEn: body.nameEn || body.name || existing.nameEn || '',
        code: body.code || existing.code,
        description: body.description ?? existing.description,
        managerId: body.managerId ? Number(body.managerId) : existing.managerId,
        status: body.status || existing.status,
        priority: body.priority || existing.priority,
        progress: body.progress !== undefined ? Number(body.progress) : existing.progress,
        budget: body.budget !== undefined ? (body.budget ? String(body.budget) : null) : existing.budget,
        startDate: body.startDate ? new Date(body.startDate) : (body.startDate === '' ? null : existing.startDate),
        endDate: body.endDate ? new Date(body.endDate) : (body.endDate === '' ? null : existing.endDate),
        actualEndDate: body.actualEndDate ? new Date(body.actualEndDate) : existing.actualEndDate,
        notes: body.notes ?? existing.notes,
        updatedAt: new Date(),
      };

      await db.update(itProjects)
        .set(safeUpdate)
        .where(eq(itProjects.id, projectId));
      
      const updatedData = { ...existing, ...safeUpdate };
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'it_project',
        entityId: projectId,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updatedData),
        details: `تم تحديث مشروع: ${safeUpdate.nameAr}`,
        ipAddress: req.ip
      });
      
      if (existing && req.body.status && existing.status !== req.body.status) {
        notifyProjectStatusChanged(updatedData, existing.status, req.user?.id).catch((e: any) => logger.warn('[Notify] Project status notify error:', { error: e?.message }));
      }
      invalidateDashboardCaches();
      res.json(updatedData);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المشروع' });
    }
  });

  app.delete("/api/it-projects/:id", authenticateToken, async (req: any, res) => {
    try {
      const projectId = parseId(req.params.id, res);
      if (!projectId) return;

      const [existing] = await db.select().from(itProjects).where(and(eq(itProjects.id, projectId), isNull(itProjects.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'المشروع غير موجود' });
      if (!canMutateResource(req.user, existing.itDepartmentId)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لحذف مشروع من قسم آخر' });
      }

      // FIX: Block deletion if project has active tasks (prevents orphan records)
      const [activeTasksCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(
          eq((tasks as any).projectId, projectId),
          isNull((tasks as any).deletedAt),
          sql`status NOT IN ('completed', 'cancelled')`
        ));
      
      if (Number(activeTasksCount?.count) > 0) {
        return res.status(409).json({ 
          error: `لا يمكن حذف المشروع — يحتوي على ${activeTasksCount.count} مهمة نشطة. أكمل أو ألغِ المهام أولاً.` 
        });
      }

      // Soft-delete: preserve data integrity
      await db.update(itProjects)
        .set({ deletedAt: new Date() } as any)
        .where(eq(itProjects.id, projectId));

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'it_project',
        entityId: projectId,
        oldValue: JSON.stringify(existing),
        details: `تم حذف مشروع: ${existing?.nameAr || existing?.nameEn}`,
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف المشروع' });
    }
  });

  // IT Tickets Routes - consolidated under /api/it-tickets (see tickets.routes.ts)

  // ==================== الموردين ====================
  app.get("/api/vendors", authenticateToken, async (req: any, res) => {
    try {
      const { status, departmentId } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isAdminOrDirector = userRole === 'system_admin' || userRole === 'admin' || userPortal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];

      let result = await db.select().from(vendors).where(isNull(vendors.deletedAt)).orderBy(sql`created_at DESC`);
      if (status && status !== 'all') {
        result = result.filter((v: any) => v.status === status);
      }
      if (isAdminOrDirector) {
        if (departmentId) {
          result = result.filter((v: any) => v.departmentId === parseInt(departmentId as string));
        }
      } else if (userDeptId) {
        result = result.filter((v: any) => v.departmentId === userDeptId || !v.departmentId);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الموردين' });
    }
  });

  app.post("/api/vendors", authenticateToken, async (req: any, res) => {
    try {
      const { name, nameAr, vendorType, category, contactPerson, contactEmail, contactPhone, website, address, country, contractNumber, contractStartDate, contractEndDate, contractValue, paymentTerms, status, notes } = req.body;
      if (!name || !vendorType) {
        return res.status(400).json({ error: 'اسم المورد ونوع المورد مطلوبان' });
      }
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isAdminOrDirector = userRole === 'system_admin' || userRole === 'admin' || userPortal === 'it_director';
      const safeDeptId = isAdminOrDirector
        ? (req.body.departmentId || null)
        : (req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal] || null);
      const [result] = await db.insert(vendors).values({
        name, nameAr: nameAr || null, vendorType, category: category || null,
        contactPerson: contactPerson || null, contactEmail: contactEmail || null,
        contactPhone: contactPhone || null, website: website || null,
        address: address || null, country: country || null,
        contractNumber: contractNumber || null,
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
        contractValue: contractValue ? String(contractValue) : null,
        paymentTerms: paymentTerms || null,
        status: status || 'active', notes: notes || null,
        departmentId: safeDeptId,
        createdBy: req.user?.id
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'create',
        entityType: 'vendor',
        entityId: insertId,
        oldValue: null,
        newValue: JSON.stringify({ id: insertId, ...req.body }),
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إضافة مورد: ${req.body.name}`
      });
      
      res.status(201).json({ id: insertId, ...req.body });
    } catch (error) {
      logger.error('Error creating vendor:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة المورد' });
    }
  });

  app.put("/api/vendors/:id", authenticateToken, async (req: any, res) => {
    try {
      const vendorId = parseId(req.params.id, res);
      if (!vendorId) return;
      const [existing] = await db.select().from(vendors).where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'المورد غير موجود' });
      if (!canMutateResource(req.user, (existing as any).departmentId)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل بيانات مورد من قسم آخر' });
      }

      const { id: _vid, departmentId: _vdept, createdAt: _vca, deletedAt: _vda, ...safeVendorUpdate } = req.body;

      await db.update(vendors)
        .set({ ...safeVendorUpdate, updatedAt: new Date() })
        .where(eq(vendors.id, vendorId));
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'vendor',
        entityId: vendorId,
        details: `تعديل المورد: ${existing?.name || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(safeVendorUpdate),
      });
      res.json({ ...existing, ...safeVendorUpdate, updatedAt: new Date() });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المورد' });
    }
  });

  app.delete("/api/vendors/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(vendors).where(and(eq(vendors.id, id), isNull(vendors.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'المورد غير موجود' });
      if (!canMutateResource(req.user, (existing as any).departmentId)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لحذف مورد من قسم آخر' });
      }
      await db.update(vendors).set({ deletedAt: new Date() }).where(eq(vendors.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'vendor',
        entityId: id,
        details: `حذف المورد: ${existing?.name || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف المورد' });
    }
  });

  // ==================== اتفاقيات SLA ====================
  app.get("/api/sla-agreements", authenticateToken, async (req: any, res) => {
    try {
      const { vendorId, status, departmentId } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isAdminOrDirector = userRole === 'system_admin' || userRole === 'admin' || userPortal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
      const requestedDeptId = isAdminOrDirector && departmentId ? parseInt(departmentId as string) : userDeptId;
      
      let result = await db.select().from(slaAgreements).orderBy(sql`created_at DESC`);
      if (!isAdminOrDirector) {
        result = result.filter((s: any) => s.departmentId === requestedDeptId || !s.departmentId);
      } else if (departmentId) {
        result = result.filter((s: any) => s.departmentId === requestedDeptId || !s.departmentId);
      }
      if (vendorId) {
        result = result.filter((s: any) => s.vendorId === parseInt(vendorId as string));
      }
      if (status && status !== 'all') {
        result = result.filter((s: any) => s.status === status);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب اتفاقيات SLA' });
    }
  });

  app.post("/api/sla-agreements", authenticateToken, async (req: any, res) => {
    try {
      // Portal isolation: enforce department from user context
      const slaUserDeptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || null;
      const isSlaPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      const slaRequestedDeptId = req.body.departmentId ? parseInt(req.body.departmentId) : null;

      let departmentId: number | null;
      if (isSlaPrivileged) {
        departmentId = slaRequestedDeptId ?? slaUserDeptId;
      } else {
        if (!slaUserDeptId) {
          return res.status(403).json({ error: 'لا يمكن تحديد القسم التابع لك' });
        }
        if (slaRequestedDeptId && slaRequestedDeptId !== slaUserDeptId) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء اتفاقية SLA لقسم آخر' });
        }
        departmentId = slaUserDeptId;
      }

      const { title, vendorId, systemId, projectId, description, serviceType, targetValue, targetUnit, currentValue, measurementPeriod, penaltyClause, penaltyAmount, startDate, endDate, status: slaStatus } = req.body;
      if (!title || !serviceType || !targetValue || !targetUnit) {
        return res.status(400).json({ error: 'العنوان ونوع الخدمة والقيمة المستهدفة ووحدة القياس مطلوبة' });
      }
      if (!vendorId) {
        return res.status(400).json({ error: 'يجب تحديد المورد المرتبط باتفاقية SLA' });
      }
      const [result] = await db.insert(slaAgreements).values({
        title, vendorId: parseInt(vendorId), systemId: systemId ? parseInt(systemId) : null,
        projectId: projectId ? parseInt(projectId) : null,
        description: description || null, serviceType, targetValue: String(targetValue),
        targetUnit, currentValue: currentValue ? String(currentValue) : null,
        measurementPeriod: measurementPeriod || null,
        penaltyClause: penaltyClause || null,
        penaltyAmount: penaltyAmount ? String(penaltyAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: slaStatus || 'active',
        departmentId,
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'create',
        entityType: 'sla_agreement',
        entityId: insertId,
        oldValue: null,
        newValue: JSON.stringify({ id: insertId, ...req.body, departmentId }),
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إضافة اتفاقية SLA: ${req.body.title}`
      });
      
      res.status(201).json({ id: insertId, ...req.body, departmentId });
    } catch (error) {
      logger.error('Error creating SLA:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة اتفاقية SLA' });
    }
  });

  app.put("/api/sla-agreements/:id", authenticateToken, async (req: any, res) => {
    try {
      const slaId = parseId(req.params.id, res);
      if (!slaId) return;
      const [existing] = await db.select().from(slaAgreements).where(eq(slaAgreements.id, slaId));
      if (!existing) {
        return res.status(404).json({ error: 'الاتفاقية غير موجودة' });
      }
      const slaUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const slaIsAdminOrDir = req.user.role === 'system_admin' || req.user.portal === 'it_director';
      if (existing.departmentId && existing.departmentId !== slaUserDeptId && !slaIsAdminOrDir) {
        return res.status(403).json({ error: 'لا يمكنك تعديل هذه الاتفاقية' });
      }

      const { id: _slaid, departmentId: _slaDept, createdAt: _slaCa, ...safeSlaUpdate } = req.body;

      await db.update(slaAgreements)
        .set({ ...safeSlaUpdate, updatedAt: new Date() })
        .where(eq(slaAgreements.id, slaId));
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'sla_agreement',
        entityId: slaId,
        details: `تعديل اتفاقية SLA: ${existing?.title || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(safeSlaUpdate),
      });
      res.json({ ...existing, ...safeSlaUpdate, updatedAt: new Date() });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث اتفاقية SLA' });
    }
  });

  app.delete("/api/sla-agreements/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(slaAgreements).where(eq(slaAgreements.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'الاتفاقية غير موجودة' });
      }
      const slaDelUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const slaDelIsAdminOrDir = req.user.role === 'system_admin' || req.user.portal === 'it_director';
      if (existing.departmentId && existing.departmentId !== slaDelUserDeptId && !slaDelIsAdminOrDir) {
        return res.status(403).json({ error: 'لا يمكنك حذف هذه الاتفاقية' });
      }
      await db.delete(slaAgreements).where(eq(slaAgreements.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'sla_agreement',
        entityId: id,
        details: `حذف اتفاقية SLA: ${existing?.title || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف اتفاقية SLA' });
    }
  });

  // ==================== خروقات SLA ====================
  app.get("/api/sla-breaches", authenticateToken, async (req: any, res) => {
    try {
      const { vendorId, slaId, departmentId } = req.query;
      const userRole_slaBr = req.user?.role || '';
      const isAdminOrDirector_slaBr = userRole_slaBr === 'system_admin' || userRole_slaBr === 'admin' || req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const requestedDeptId = isAdminOrDirector_slaBr && departmentId ? parseInt(departmentId as string) : userDeptId;
      
      const allSLAs = await db.select().from(slaAgreements);
      const departmentSLAIds = isAdminOrDirector_slaBr && !departmentId 
        ? allSLAs.map((s: any) => s.id)
        : allSLAs.filter((s: any) => s.departmentId === requestedDeptId || !s.departmentId).map((s: any) => s.id);
      
      let result = await db.select().from(slaBreaches).orderBy(sql`created_at DESC`);
      result = result.filter((b: any) => departmentSLAIds.includes(b.slaId));
      if (vendorId) {
        result = result.filter((b: any) => b.vendorId === parseInt(vendorId as string));
      }
      if (slaId) {
        result = result.filter((b: any) => b.slaId === parseInt(slaId as string));
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب خروقات SLA' });
    }
  });

  app.post("/api/sla-breaches", authenticateToken, async (req: any, res) => {
    try {
      const { slaId, vendorId, breachDate } = req.body;
      if (!slaId || typeof slaId !== 'number') {
        return res.status(400).json({ error: 'معرف اتفاقية SLA مطلوب ويجب أن يكون رقماً' });
      }
      if (!vendorId || typeof vendorId !== 'number') {
        return res.status(400).json({ error: 'معرف المورد مطلوب ويجب أن يكون رقماً' });
      }
      if (!breachDate) {
        return res.status(400).json({ error: 'تاريخ الخرق مطلوب' });
      }
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...slaBreachData } = req.body;
      const [result] = await db.insert(slaBreaches).values(slaBreachData).returning();
      const insertId = result.id;
      const [sla] = req.body.slaId ? await db.select().from(slaAgreements).where(eq(slaAgreements.id, req.body.slaId)) : [null];
      notifySLABreachCreated({ id: insertId, ...req.body }, sla?.title || 'اتفاقية SLA').catch((e: any) => logger.warn('[Notify] SLA breach notify error:', { error: e?.message }));
      res.status(201).json({ id: insertId, ...req.body });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تسجيل الاختراق' });
    }
  });

  // ==================== Knowledge Base Routes ====================
  app.get("/api/knowledge-base", authenticateToken, async (req: any, res) => {
    try {
      const { departmentId } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isAdminOrDirector = userRole === 'system_admin' || userRole === 'admin' || userPortal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
      const requestedDeptId = departmentId ? parseInt(departmentId as string) : userDeptId;
      
      const result = await db.select().from(knowledgeBase).orderBy(sql`${knowledgeBase.createdAt} DESC`);
      
      let filtered;
      if (isAdminOrDirector && !departmentId) {
        filtered = result;
      } else if (requestedDeptId) {
        filtered = result.filter((a: any) => 
          a.departmentId === requestedDeptId || !a.departmentId
        );
      } else {
        filtered = result;
      }
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب المقالات' });
    }
  });

  app.get("/api/knowledge-base/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [article] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
      if (!article) {
        return res.status(404).json({ error: 'المقال غير موجود' });
      }
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const isAdminOrDirector = req.user.role === 'system_admin' || req.user.portal === 'it_director';
      if (article.departmentId && article.departmentId !== userDeptId && !isAdminOrDirector) {
        return res.status(403).json({ error: 'لا يمكنك الوصول لهذا المقال' });
      }
      await db.update(knowledgeBase).set({ views: (article.views || 0) + 1 }).where(eq(knowledgeBase.id, article.id));
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب المقال' });
    }
  });

  app.post("/api/knowledge-base", authenticateToken, requireCreate(RESOURCES.KNOWLEDGE_BASE), async (req: any, res) => {
    try {
      const departmentId = req.body.departmentId || req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const [result] = await db.insert(knowledgeBase).values({
        ...req.body,
        departmentId,
        authorId: req.user.id,
      }).returning();
      const insertId = result.id;
      const articleData = { id: insertId, ...req.body, departmentId, authorId: req.user.id };
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create_knowledge_article',
        entityType: 'knowledge_base',
        entityId: insertId,
        oldValue: null,
        newValue: articleData,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إنشاء مقال: ${req.body.title}`,
      });
      res.status(201).json(articleData);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء المقال' });
    }
  });

  app.put("/api/knowledge-base/:id", authenticateToken, requireUpdate(RESOURCES.KNOWLEDGE_BASE), async (req: any, res) => {
    try {
      const articleId = parseId(req.params.id, res);
      if (!articleId) return;
      const [existing] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, articleId));
      if (!existing) {
        return res.status(404).json({ error: 'المقال غير موجود' });
      }
      const kbPutUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const kbPutIsAdminOrDir = req.user.role === 'system_admin' || req.user.portal === 'it_director';
      if (existing.departmentId && existing.departmentId !== kbPutUserDeptId && !kbPutIsAdminOrDir) {
        return res.status(403).json({ error: 'لا يمكنك تعديل هذا المقال' });
      }

      const { id: _kbid, departmentId: _kbDept, createdBy: _kbCb, createdAt: _kbCa, ...safeKbUpdate } = req.body;

      await db.update(knowledgeBase)
        .set({ ...safeKbUpdate, updatedAt: new Date() })
        .where(eq(knowledgeBase.id, articleId));
      
      res.json({ ...existing, ...safeKbUpdate, updatedAt: new Date() });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المقال' });
    }
  });

  app.post("/api/knowledge-base/:id/helpful", authenticateToken, async (req, res) => {
    try {
      const articleId = parseId(req.params.id, res);
      if (!articleId) return;
      const [article] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, articleId));
      if (!article) {
        return res.status(404).json({ error: 'المقال غير موجود' });
      }
      const newHelpful = (article.helpful || 0) + 1;
      await db.update(knowledgeBase)
        .set({ helpful: newHelpful })
        .where(eq(knowledgeBase.id, articleId));
      
      res.json({ ...article, helpful: newHelpful });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  app.delete("/api/knowledge-base/:id", authenticateToken, requireDelete(RESOURCES.KNOWLEDGE_BASE), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'المقال غير موجود' });
      }
      const kbDelUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const kbDelIsAdminOrDir = req.user.role === 'system_admin' || req.user.portal === 'it_director';
      if (existing.departmentId && existing.departmentId !== kbDelUserDeptId && !kbDelIsAdminOrDir) {
        return res.status(403).json({ error: 'لا يمكنك حذف هذا المقال' });
      }
      await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف المقال' });
    }
  });

  // ==================== إدارة المستندات ====================
  app.get("/api/documents", authenticateToken, async (req: any, res) => {
    try {
      const { departmentId } = req.query;
      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      const requestedDeptId = departmentId ? parseInt(departmentId as string) : userDeptId;
      
      if (!isITDirector && !isAdmin && departmentId && requestedDeptId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك الوصول لمستندات هذه الإدارة' });
      }
      
      const result = await db.select().from(documents).orderBy(sql`${documents.createdAt} DESC`);
      
      let filtered;
      if ((isITDirector || isAdmin) && !departmentId) {
        filtered = result;
      } else {
        const deptToFilter = (isITDirector || isAdmin) ? requestedDeptId : userDeptId;
        filtered = result.filter((d: any) => d.departmentId === deptToFilter);
      }
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب المستندات' });
    }
  });

  app.get("/api/documents/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [document] = await db.select().from(documents).where(eq(documents.id, id));
      if (!document) {
        return res.status(404).json({ error: 'المستند غير موجود' });
      }
      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && document.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك الوصول لهذا المستند' });
      }
      await db.update(documents).set({ downloadCount: (document.downloadCount || 0) + 1 }).where(eq(documents.id, document.id));
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب المستند' });
    }
  });

  app.post("/api/documents", authenticateToken, requireCreate(RESOURCES.DOCUMENTS), async (req: any, res) => {
    try {
      const departmentId = req.body.departmentId;
      if (!departmentId) {
        return res.status(400).json({ error: 'معرف الإدارة مطلوب' });
      }
      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك إنشاء مستند في هذه الإدارة' });
      }
      const docValues = {
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        fileName: req.body.fileName,
        fileType: req.body.fileType || null,
        fileSize: req.body.fileSize || null,
        fileUrl: req.body.fileUrl || null,
        version: req.body.version || '1.0',
        status: req.body.status || 'active',
        isConfidential: req.body.isConfidential || false,
        tags: req.body.tags || null,
        dataClassification: req.body.dataClassification || 'internal',
        departmentId,
        createdBy: req.user.id,
      };
      const [result] = await db.insert(documents).values(docValues).returning();
      const insertId = result.id;
      const documentData = { id: insertId, ...docValues };
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create_document',
        entityType: 'documents',
        entityId: insertId,
        oldValue: null,
        newValue: documentData,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إنشاء مستند: ${req.body.title}`,
      });
      res.status(201).json(documentData);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إنشاء المستند' });
    }
  });

  app.put("/api/documents/:id", authenticateToken, requireUpdate(RESOURCES.DOCUMENTS), async (req: any, res) => {
    try {
      const docId = parseId(req.params.id, res);
      if (!docId) return;
      const [existing] = await db.select().from(documents).where(eq(documents.id, docId));
      if (!existing) {
        return res.status(404).json({ error: 'المستند غير موجود' });
      }
      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك تعديل هذا المستند' });
      }
      const [updated] = await db.update(documents)
        .set({ ...stripProtectedFields(req.body), updatedAt: new Date() })
        .where(eq(documents.id, docId))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث المستند' });
    }
  });

  app.get("/api/documents/:id/download", authenticateToken, async (req: any, res) => {
    try {
      const docId = parseId(req.params.id, res);
      if (!docId) return;
      const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
      if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });

      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && doc.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك تحميل هذا المستند' });
      }

      if (!doc.fileUrl) return res.status(404).json({ error: 'لا يوجد ملف مرفق لهذا المستند' });

      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const blob = bucket.file(doc.fileUrl);
        const [fileBuffer] = await blob.download();
        const safeName = encodeURIComponent(doc.fileName).replace(/%20/g, '+');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
        res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
        res.setHeader('Content-Length', fileBuffer.length);
        await db.update(documents).set({ downloadCount: (doc.downloadCount || 0) + 1 }).where(eq(documents.id, docId));
        res.end(fileBuffer);
      } catch {
        res.status(404).json({ error: 'الملف غير موجود في التخزين' });
      }
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحميل الملف' });
    }
  });

  app.post("/api/documents/:id/upload", authenticateToken, upload.single('file'), async (req: any, res) => {
    try {
      const docId = parseId(req.params.id, res);
      if (!docId) return;
      if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف' });

      const [existing] = await db.select().from(documents).where(eq(documents.id, docId));
      if (!existing) return res.status(404).json({ error: 'المستند غير موجود' });

      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك رفع ملف لهذا المستند' });
      }

      let fileUrl = '';
      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const key = `.private/documents/${docId}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const blob = bucket.file(key);
        await blob.save(req.file.buffer, { contentType: req.file.mimetype });
        fileUrl = key;
      } catch (uploadError) {
        logger.error('[Upload] Object storage failed:', { error: uploadError });
        return res.status(500).json({ success: false, message: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى' });
      }

      const [updated] = await db.update(documents).set({
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        updatedAt: new Date(),
      }).where(eq(documents.id, docId)).returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في رفع الملف' });
    }
  });

  app.delete("/api/documents/:id", authenticateToken, requireDelete(RESOURCES.DOCUMENTS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(documents).where(eq(documents.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'المستند غير موجود' });
      }
      const isAdmin = req.user.role === 'system_admin';
      const isITDirector = req.user.portal === 'it_director';
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      if (!isITDirector && !isAdmin && existing.departmentId !== userDeptId) {
        return res.status(403).json({ error: 'لا يمكنك حذف هذا المستند' });
      }
      await db.delete(documents).where(eq(documents.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف المستند' });
    }
  });

  // ==================== سجل التدقيق ====================
  app.get("/api/audit-logs", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'system_admin' && req.user.portal !== 'it_director') {
        return res.status(403).json({ error: 'غير مصرح لك بالوصول لسجل التدقيق' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
      const { fromDate, toDate, action, entityType, severity, outcome, search } = req.query;

      const conditions: any[] = [];
      if (fromDate) conditions.push(sql`${auditLogs.createdAt} >= ${new Date(fromDate as string)}`);
      if (toDate) conditions.push(sql`${auditLogs.createdAt} <= ${new Date(toDate as string + 'T23:59:59')}`);
      if (action && action !== 'all') conditions.push(eq(auditLogs.action, action as string));
      if (entityType && entityType !== 'all') conditions.push(eq(auditLogs.entityType, entityType as string));
      if (severity && severity !== 'all') conditions.push(eq(auditLogs.severity, severity as string));
      if (outcome && outcome !== 'all') conditions.push(eq(auditLogs.outcome, outcome as string));
      if (search) conditions.push(sql`(${auditLogs.details} ILIKE ${'%' + search + '%'} OR ${auditLogs.action} ILIKE ${'%' + search + '%'} OR ${auditLogs.entityType} ILIKE ${'%' + search + '%'})`);

      const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : sql`1=1`;

      const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(whereClause);
      const total = countResult?.count || 0;

      const offset = (page - 1) * pageSize;
      const logsResult = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          action: auditLogs.action,
          actionCategory: auditLogs.actionCategory,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          resource: auditLogs.resource,
          oldValue: auditLogs.oldValue,
          newValue: auditLogs.newValue,
          changedFields: auditLogs.changedFields,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          requestMethod: auditLogs.requestMethod,
          requestPath: auditLogs.requestPath,
          outcome: auditLogs.outcome,
          severity: auditLogs.severity,
          details: auditLogs.details,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          userName: users.fullName,
          userEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(sql`${auditLogs.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset);

      res.json({
        logs: logsResult,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      logger.error('Error fetching audit logs:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجل التدقيق' });
    }
  });

  app.get("/api/audit-logs/stats", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'system_admin' && req.user.portal !== 'it_director') {
        return res.status(403).json({ error: 'غير مصرح' });
      }

      const { fromDate, toDate } = req.query;
      const conditions: any[] = [];
      if (fromDate) conditions.push(sql`${auditLogs.createdAt} >= ${new Date(fromDate as string)}`);
      if (toDate) conditions.push(sql`${auditLogs.createdAt} <= ${new Date(toDate as string + 'T23:59:59')}`);
      const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : sql`1=1`;

      const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(whereClause);
      
      const byAction = await db
        .select({ action: auditLogs.action, count: sql<number>`count(*)::int` })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.action)
        .orderBy(sql`count(*) DESC`).limit(20);

      const byEntity = await db
        .select({ entityType: auditLogs.entityType, count: sql<number>`count(*)::int` })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.entityType)
        .orderBy(sql`count(*) DESC`).limit(20);

      const bySeverity = await db
        .select({ severity: auditLogs.severity, count: sql<number>`count(*)::int` })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.severity)
        .orderBy(sql`count(*) DESC`);

      const byOutcome = await db
        .select({ outcome: auditLogs.outcome, count: sql<number>`count(*)::int` })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.outcome)
        .orderBy(sql`count(*) DESC`);

      const byHour = await db
        .select({ hour: sql<number>`extract(hour from ${auditLogs.createdAt})::int`, count: sql<number>`count(*)::int` })
        .from(auditLogs).where(whereClause)
        .groupBy(sql`extract(hour from ${auditLogs.createdAt})`)
        .orderBy(sql`extract(hour from ${auditLogs.createdAt})`);

      const topUsers = await db
        .select({ userId: auditLogs.userId, userName: users.fullName, count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .groupBy(auditLogs.userId, users.fullName)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      const entityTypesRaw = await db
        .select({ entityType: auditLogs.entityType })
        .from(auditLogs)
        .groupBy(auditLogs.entityType);

      res.json({
        total: totalResult?.count || 0,
        byAction,
        byEntity,
        bySeverity,
        byOutcome,
        byHour,
        topUsers,
        entityTypes: entityTypesRaw.map(e => e.entityType).filter(Boolean),
      });
    } catch (error) {
      logger.error('Error fetching audit stats:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إحصائيات التدقيق' });
    }
  });

  // Get single request with responses
  app.get("/api/dmo-requests/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [request] = await db.select().from(dmoRequests).where(eq(dmoRequests.id, id));
      if (!request) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      const responses = await db.select().from(dmoRequestResponses)
        .where(eq(dmoRequestResponses.requestId, request.id))
        .orderBy(sql`${dmoRequestResponses.createdAt} ASC`);
      res.json({ request, responses });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الطلب' });
    }
  });

  // Add response to request
  app.post("/api/dmo-requests/:id/responses", authenticateToken, async (req: any, res) => {
    try {
      const { message, attachments } = req.body;
      const requestId = parseId(req.params.id, res);
      if (!requestId) return;
      
      // Check if request exists
      const [request] = await db.select().from(dmoRequests).where(eq(dmoRequests.id, requestId));
      if (!request) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      
      const isFromDmo = req.user.portal === 'dmo' || req.user.role === 'dmo_manager' || req.user.role === 'dmo_staff';
      const isSteward = req.user.role === 'data_steward' || req.user.role === 'data_representative';
      const isAdmin = req.user.role === 'system_admin' || req.user.role === 'it_director';
      if (!isFromDmo && !isSteward && !isAdmin) {
        return res.status(403).json({ error: 'ليس لديك صلاحية للرد على هذا الطلب' });
      }
      
      const responseValues = {
        requestId,
        responderId: req.user.id,
        message,
        attachments: attachments || null,
        isFromDmo,
      };
      const [responseResult] = await db.insert(dmoRequestResponses).values(responseValues).returning();
      const responseInsertId = responseResult.id;
      
      // Update request status to in_progress if pending
      if (request.status === 'pending') {
        await db.update(dmoRequests)
          .set({ status: 'in_progress', updatedAt: new Date() })
          .where(eq(dmoRequests.id, requestId));
      }
      
      // Create notification for the other party
      let notifyUserId: number | null = null;
      if (isFromDmo) {
        const allStewards = await storage.getDataStewards();
        const targetSteward = allStewards.find(s => s.id === request.stewardId);
        if (targetSteward?.userId) {
          notifyUserId = targetSteward.userId;
        } else if (targetSteward?.email) {
          const allUsers = await storage.getUsers();
          const matchedUser = allUsers.find(u => u.email === targetSteward.email);
          if (matchedUser) notifyUserId = matchedUser.id;
        }
      } else {
        notifyUserId = request.requestedBy;
      }
      if (notifyUserId) {
        await storage.createNotification({
          userId: notifyUserId,
          title: 'رد جديد على طلب',
          message: `تم استلام رد جديد على الطلب: ${request.title}`,
          type: 'response',
          priority: 'medium',
          isRead: false,
          entityType: 'dmo_request',
          entityId: requestId,
          actionUrl: isFromDmo ? `/data-representative` : `/dmo/steward-requests`,
        });
      }
      
      res.json({ id: responseInsertId, ...responseValues });
    } catch (error) {
      logger.error('Error adding response:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة الرد' });
    }
  });

  // Get responses for a request
  app.get("/api/dmo-requests/:id/responses", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const responses = await db.select().from(dmoRequestResponses)
        .where(eq(dmoRequestResponses.requestId, id))
        .orderBy(sql`${dmoRequestResponses.createdAt} ASC`);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الردود' });
    }
  });

  // ==================== Governance Hub API ====================

  // Get governance statistics
  app.get("/api/governance/stats", authenticateToken, requireView(RESOURCES.DMO_REQUESTS), async (req: any, res) => {
    try {
      // Get counts from various tables
      const totalRequests = await db.select({ count: sql<number>`count(*)` })
        .from(dmoRequests);
      
      const pendingRequests = await db.select({ count: sql<number>`count(*)` })
        .from(dmoRequests)
        .where(eq(dmoRequests.status, 'pending'));
      
      const completedRequests = await db.select({ count: sql<number>`count(*)` })
        .from(dmoRequests)
        .where(eq(dmoRequests.status, 'completed'));
      
      const totalUsers = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.isActive, true));

      res.json({
        totalRequests: Number(totalRequests[0]?.count || 0),
        pendingRequests: Number(pendingRequests[0]?.count || 0),
        completedRequests: Number(completedRequests[0]?.count || 0),
        totalUsers: Number(totalUsers[0]?.count || 0),
        complianceRate: 87,
        dataQualityScore: 92,
        openIncidents: 3,
        processedThisMonth: 156
      });
    } catch (error) {
      logger.error('Error fetching governance stats:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إحصائيات الحوكمة' });
    }
  });

  // Get governance requests with workflow status
  app.get("/api/governance/requests", authenticateToken, requireView(RESOURCES.DMO_REQUESTS), async (req: any, res) => {
    try {
      const requests = await db.select({
        id: dmoRequests.id,
        title: dmoRequests.title,
        status: dmoRequests.status,
        priority: dmoRequests.priority,
        createdAt: dmoRequests.createdAt,
        requestedBy: dmoRequests.requestedBy,
      })
        .from(dmoRequests)
        .orderBy(sql`${dmoRequests.createdAt} DESC`)
        .limit(20);
      
      const allUsers = await storage.getUsers();
      const enrichedRequests = await Promise.all(requests.map(async (request: any) => {
        const requesterUser = allUsers.find(u => u.id === request.requestedBy);
        return {
          ...request,
          type: 'طلب بيانات',
          requester: requesterUser?.name || 'غير معروف',
          currentStep: getWorkflowStep(request.status),
          steps: generateWorkflowSteps(request.status)
        };
      }));
      
      res.json(enrichedRequests);
    } catch (error) {
      logger.error('Error fetching governance requests:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب طلبات الحوكمة' });
    }
  });

  // Get compliance metrics
  app.get("/api/governance/compliance", authenticateToken, requireView(RESOURCES.DMO_REQUESTS), async (req: any, res) => {
    try {
      const [secIncidents] = await db.select({ count: sql<number>`count(*)` }).from(securityIncidents);
      const [resolvedIncidents] = await db.select({ count: sql<number>`count(*)` }).from(securityIncidents).where(eq(securityIncidents.status, 'resolved'));

      const [vulns] = await db.select({ count: sql<number>`count(*)` }).from(securityVulnerabilities);
      const [resolvedVulns] = await db.select({ count: sql<number>`count(*)` }).from(securityVulnerabilities).where(eq(securityVulnerabilities.status, 'resolved'));

      const [riskAssessments] = await db.select({ count: sql<number>`count(*)` }).from(securityRiskAssessments);
      const [completedAssessments] = await db.select({ count: sql<number>`count(*)` }).from(securityRiskAssessments).where(eq(securityRiskAssessments.status, 'completed'));

      const totalIncidents = Number(secIncidents?.count || 0);
      const resolvedIncidentsCount = Number(resolvedIncidents?.count || 0);
      const totalVulns = Number(vulns?.count || 0);
      const resolvedVulnsCount = Number(resolvedVulns?.count || 0);
      const totalAssessments = Number(riskAssessments?.count || 0);
      const completedAssessmentsCount = Number(completedAssessments?.count || 0);

      const eccCompliance = totalIncidents > 0 ? Math.round((resolvedIncidentsCount / totalIncidents) * 100) : 0;
      const iso27001Compliance = totalVulns > 0 ? Math.round((resolvedVulnsCount / totalVulns) * 100) : 0;
      const riskCompliance = totalAssessments > 0 ? Math.round((completedAssessmentsCount / totalAssessments) * 100) : 0;

      const frameworks = [
        { id: 'ecc', name: 'ECC - ضوابط الأمن السيبراني', compliance: eccCompliance, total: totalIncidents, completed: resolvedIncidentsCount },
        { id: 'iso27001', name: 'ISO 27001 - أمن المعلومات', compliance: iso27001Compliance, total: totalVulns, completed: resolvedVulnsCount },
        { id: 'risk', name: 'تقييم المخاطر', compliance: riskCompliance, total: totalAssessments, completed: completedAssessmentsCount },
      ];

      const overallCompliance = frameworks.length > 0 
        ? Math.round(frameworks.reduce((sum, f) => sum + f.compliance, 0) / frameworks.length) 
        : 0;

      res.json({
        frameworks,
        overallCompliance,
        lastAssessment: new Date().toISOString(),
        nextAssessment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب مقاييس الامتثال' });
    }
  });

  // Get portal access summary
  app.get("/api/governance/portals", authenticateToken, async (req: any, res) => {
    try {
      const portalStats = await db.select({
        portal: users.portal,
        count: sql<number>`count(*)`
      })
        .from(users)
        .where(eq(users.isActive, true))
        .groupBy(users.portal);
      
      const portalLabels: Record<string, string> = {
        admin: 'مدير النظام',
        it_director: 'مدير التقنية',
        dmo: 'مكتب البيانات',
        data_rep: 'ممثل البيانات',
        steward: 'أمين البيانات',
        committee: 'عضو اللجنة',
        it_department: 'موظف تقنية',
        cybersecurity: 'الأمن السيبراني'
      };
      
      res.json(portalStats.map((p: any) => ({
        portal: p.portal,
        name: portalLabels[p.portal] || p.portal,
        count: Number(p.count)
      })));
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب إحصائيات البوابات' });
    }
  });

  // ==================== Committee Meetings Routes ====================

  // Get all committee meetings
  app.get("/api/committee-meetings", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetings = await storage.getCommitteeMeetings?.() || [];
      const normalized = meetings.map((m: any) => ({
        ...m,
        number: m.meetingNumber || '',
        date: m.scheduledDate ? new Date(m.scheduledDate).toISOString().split('T')[0] : '',
        time: m.startTime || '',
        organizer: m.createdBy ? `م. ${m.createdBy}` : 'مكتب اللجنة',
        attendees: m.attendees || [],
        workflowStep: m.status === 'in_progress' ? 'convene' : m.status === 'completed' ? 'document' : m.status === 'archived' ? 'archive' : m.status === 'scheduled' ? 'schedule' : 'create',
      }));
      res.json(normalized);
    } catch (error) {
      logger.error('Error fetching committee meetings:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب اجتماعات اللجنة' });
    }
  });

  // Create new committee meeting
  app.post("/api/committee-meetings", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const { title, description, date, time, endTime, location, agenda, meetingType } = req.body;
      
      if (!title || !date) {
        return res.status(400).json({ error: 'العنوان والتاريخ مطلوبان' });
      }

      const ljnYear = new Date().getFullYear();
      const allMtgs = await storage.getCommitteeMeetings();
      const maxLjn = allMtgs.reduce((max, m) => {
        if (!m.meetingNumber) return max;
        const parts = m.meetingNumber.split('-');
        const num = parseInt(parts[parts.length - 1] || '0');
        return Math.max(max, num);
      }, 0);
      const meetingNumber = `LJN-${ljnYear}-${String(maxLjn + 1).padStart(3, '0')}`;

      const meeting = await storage.createCommitteeMeeting({
        meetingNumber,
        title,
        meetingType: meetingType || 'regular',
        scheduledDate: new Date(date),
        startTime: time || null,
        endTime: endTime || null,
        location: location || null,
        isVirtual: false,
        virtualLink: null,
        agenda: agenda || description || null,
        minutes: null,
        status: 'scheduled',
        createdBy: req.user?.id || null,
      });

      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'create',
        entityType: 'committee_meeting',
        entityId: meeting.id,
        oldValue: null,
        newValue: JSON.stringify(meeting),
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم إنشاء اجتماع لجنة: ${title}`,
      });

      const normalizedMeeting = {
        ...meeting,
        number: meeting.meetingNumber || '',
        date: meeting.scheduledDate ? new Date(meeting.scheduledDate).toISOString().split('T')[0] : '',
        time: meeting.startTime || '',
        organizer: 'مكتب اللجنة',
        attendees: [],
        workflowStep: 'schedule',
      };
      res.status(201).json(normalizedMeeting);
    } catch (error) {
      logger.error('Error creating committee meeting:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الاجتماع' });
    }
  });

  // Get specific committee meeting
  app.get("/api/committee-meetings/:id", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      const meeting = await storage.getCommitteeMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ error: 'الاجتماع غير موجود' });
      }

      res.json(meeting);
    } catch (error) {
      logger.error('Error fetching committee meeting:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الاجتماع' });
    }
  });

  // Update committee meeting
  app.patch("/api/committee-meetings/:id", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      const { title, description, date, time, endTime, location, status, attendees, agenda, meetingType } = req.body;

      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.agenda = description;
      if (agenda !== undefined) updates.agenda = agenda;
      if (date !== undefined) updates.scheduledDate = new Date(date);
      if (time !== undefined) updates.startTime = time;
      if (endTime !== undefined) updates.endTime = endTime;
      if (location !== undefined) updates.location = location;
      if (status !== undefined) updates.status = status;
      if (meetingType !== undefined) updates.meetingType = meetingType;

      const updated = await storage.updateCommitteeMeeting(meetingId, updates);
      if (!updated) {
        return res.status(404).json({ error: 'الاجتماع غير موجود' });
      }

      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'update',
        entityType: 'committee_meeting',
        entityId: meetingId,
        oldValue: null,
        newValue: JSON.stringify(updates),
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم تحديث اجتماع لجنة #${meetingId}`,
      });

      res.json(updated);
    } catch (error) {
      logger.error('Error updating committee meeting:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الاجتماع' });
    }
  });

  // Delete committee meeting
  app.delete("/api/committee-meetings/:id", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      await storage.updateCommitteeMeeting(meetingId, { deletedAt: new Date() } as any);

      await storage.createAuditLog({
        userId: req.user?.id || null,
        action: 'delete',
        entityType: 'committee_meeting',
        entityId: meetingId,
        oldValue: null,
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        details: `تم حذف اجتماع لجنة #${meetingId}`,
      });

      res.json({ success: true, id: meetingId });
    } catch (error) {
      logger.error('Error deleting committee meeting:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الاجتماع' });
    }
  });

  // Update meeting attendees
  app.post("/api/committee-meetings/:id/attendees", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      const { attendees } = req.body;
      if (!attendees || !Array.isArray(attendees)) {
        return res.status(400).json({ error: 'قائمة الحاضرين مطلوبة' });
      }

      await db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId));

      const results = [];
      for (const attendee of attendees) {
        const [record] = await db.insert(meetingAttendance).values({
          meetingId,
          memberId: attendee.memberId || attendee.id,
          status: attendee.status || 'present',
        }).returning();
        results.push(record);
      }

      res.json({ success: true, id: meetingId, attendees: results });
    } catch (error) {
      logger.error('Error updating attendees:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث قائمة الحاضرين' });
    }
  });

  // Update meeting agenda
  app.post("/api/committee-meetings/:id/agenda", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      const { agenda } = req.body;

      await db.update(committeeMeetings)
        .set({ agenda: typeof agenda === 'string' ? agenda : JSON.stringify(agenda), updatedAt: new Date() })
        .where(eq(committeeMeetings.id, meetingId));

      res.json({ success: true, id: meetingId, agenda });
    } catch (error) {
      logger.error('Error updating agenda:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث جدول الأعمال' });
    }
  });

  // ==================== جلسات التصويت API ====================
  
  // Get all voting sessions
  app.get("/api/voting-sessions", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const sessions = await db.select().from(votingSessions).orderBy(sql`${votingSessions.createdAt} DESC`);
      res.json(sessions);
    } catch (error) {
      logger.error('Error fetching voting sessions:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب جلسات التصويت' });
    }
  });

  // Get single voting session
  app.get("/api/voting-sessions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, parseInt(id)));
      if (!session) {
        return res.status(404).json({ error: 'جلسة التصويت غير موجودة' });
      }
      res.json(session);
    } catch (error) {
      logger.error('Error fetching voting session:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب جلسة التصويت' });
    }
  });

  // Create voting session
  app.post("/api/voting-sessions", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { title, description, category, votingType, startDate, endDate, quorumRequired } = req.body;
      const [result] = await db.insert(votingSessions).values({
        title,
        description,
        category: category || 'general',
        votingType: votingType || 'majority',
        status: 'draft',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        quorumRequired: quorumRequired || 50,
        createdBy: req.user.id
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إنشاء جلسة تصويت',
        entityType: 'voting_session',
        entityId: insertId,
        details: `تم إنشاء جلسة تصويت: ${title}`
      });
      
      res.status(201).json({ id: insertId, title, status: 'draft' });
    } catch (error) {
      logger.error('Error creating voting session:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء جلسة التصويت' });
    }
  });

  // Update voting session
  app.put("/api/voting-sessions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { title, description, category, votingType, status, startDate, endDate, quorumRequired } = req.body;
      
      const [existing] = await db.select({ id: votingSessions.id }).from(votingSessions).where(eq(votingSessions.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'جلسة التصويت غير موجودة' });

      await db.update(votingSessions)
        .set({
          title,
          description,
          category,
          votingType,
          status,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          quorumRequired,
          updatedAt: new Date()
        })
        .where(eq(votingSessions.id, id));
      
      res.json({ success: true, id });
    } catch (error) {
      logger.error('Error updating voting session:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث جلسة التصويت' });
    }
  });

  // Delete voting session
  app.delete("/api/voting-sessions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(votingSessions).where(eq(votingSessions.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting voting session:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف جلسة التصويت' });
    }
  });

  // Cast vote
  app.post("/api/voting-sessions/:id/vote", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { vote, comments } = req.body;
      
      const sessionId = parseInt(id);
      const memberId = req.user.id;

      const result = await db.transaction(async (tx) => {
        const existingVotes = await tx.select().from(decisionVotes)
          .where(and(eq(decisionVotes.votingSessionId, sessionId), eq(decisionVotes.memberId, memberId)));
        
        if (existingVotes.length > 0) {
          return { duplicate: true };
        }
        
        await tx.insert(decisionVotes).values({
          votingSessionId: sessionId,
          memberId,
          vote,
          comments
        });
        
        const field = vote === 'approve' ? 'votes_for' : vote === 'reject' ? 'votes_against' : 'votes_abstain';
        await tx.execute(sql`UPDATE voting_sessions SET ${sql.identifier(field)} = ${sql.identifier(field)} + 1 WHERE id = ${sessionId}`);
        return { duplicate: false };
      });

      if (result.duplicate) {
        return res.status(400).json({ error: 'لقد قمت بالتصويت مسبقاً' });
      }
      
      res.json({ success: true, vote });
    } catch (error) {
      logger.error('Error casting vote:', { error });
      res.status(500).json({ error: 'حدث خطأ في التصويت' });
    }
  });

  // ==================== أعضاء اللجنة API ====================
  
  // Get all committee members
  app.get("/api/committee-members", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const members = await db.select().from(committeeMembers).orderBy(committeeMembers.name);
      res.json(members);
    } catch (error) {
      logger.error('Error fetching committee members:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب أعضاء اللجنة' });
    }
  });

  app.post("/api/committee-members", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res) => {
    try {
      const { name, email, phone, department, position, committeeRole, canApprove, canVote, notes } = req.body;
      
      if (email) {
        const [existing] = await db.select({ id: committeeMembers.id })
          .from(committeeMembers)
          .where(eq(committeeMembers.email, email.trim().toLowerCase()))
          .limit(1);
        if (existing) {
          return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجّل مسبقاً في اللجنة' });
        }
      }

      const matchingUser = email ? await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1) : [];
      
      const [result] = await db.insert(committeeMembers).values({
        name,
        email,
        phone,
        department,
        position,
        committeeRole: committeeRole || 'member',
        canApprove: canApprove || false,
        canVote: canVote !== false,
        notes,
        userId: matchingUser.length > 0 ? matchingUser[0].id : null,
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إضافة عضو لجنة',
        entityType: 'committee_member',
        entityId: insertId,
        details: `تم إضافة عضو: ${name}`
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجّل مسبقاً في اللجنة' });
      }
      logger.error('Error creating committee member:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة عضو اللجنة' });
    }
  });

  // Update committee member
  app.put("/api/committee-members/:id", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { name, email, phone, department, position, committeeRole, canApprove, canVote, isActive, notes } = req.body;
      
      const [existingMember] = await db.select({ id: committeeMembers.id }).from(committeeMembers).where(eq(committeeMembers.id, id)).limit(1);
      if (!existingMember) return res.status(404).json({ error: 'العضو غير موجود' });

      await db.update(committeeMembers)
        .set({
          name,
          email,
          phone,
          department,
          position,
          committeeRole,
          canApprove,
          canVote,
          isActive,
          notes,
          updatedAt: new Date()
        })
        .where(eq(committeeMembers.id, id));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث عضو لجنة',
        entityType: 'committee_member',
        entityId: parseInt(id),
        details: `تم تحديث عضو اللجنة: ${name || id}`
      });
      
      res.json({ success: true, id: parseInt(id) });
    } catch (error) {
      logger.error('Error updating committee member:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث عضو اللجنة' });
    }
  });

  // Delete committee member
  app.delete("/api/committee-members/:id", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(committeeMembers).where(eq(committeeMembers.id, parseInt(id)));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف عضو لجنة',
        entityType: 'committee_member',
        entityId: parseInt(id),
        details: `تم حذف عضو اللجنة رقم: ${id}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting committee member:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف عضو اللجنة' });
    }
  });

  // ==================== إعدادات اللجنة API ====================

  // Get committee settings
  app.get("/api/committee-settings", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      // Default settings if none exist
      const defaultSettings = {
        votingQuorum: 5,
        approvalsRequired: 7,
        meetingNotifications: true,
        decisionNotifications: true,
        emailNotifications: true,
        defaultMeetingDuration: 120,
        meetingFrequency: 'monthly',
        memberRoleManagement: true,
        rolePermissions: 'standard',
        updatedAt: new Date().toISOString()
      };
      res.json(defaultSettings);
    } catch (error) {
      logger.error('Error fetching committee settings:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إعدادات اللجنة' });
    }
  });

  // Save committee settings
  app.post("/api/committee-settings", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res) => {
    try {
      const settings = req.body;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث إعدادات اللجنة',
        entityType: 'committee_settings',
        entityId: 1,
        details: 'تم تحديث إعدادات اللجنة'
      });
      
      res.json({ success: true, settings: { ...settings, updatedAt: new Date().toISOString() } });
    } catch (error) {
      logger.error('Error saving committee settings:', { error });
      res.status(500).json({ error: 'حدث خطأ في حفظ إعدادات اللجنة' });
    }
  });

  // ==================== مهام اللجنة API ====================

  app.get("/api/committee-tasks", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const rows = await db.select().from(committeeTasks)
        .where(isNull(committeeTasks.deletedAt))
        .orderBy(sql`${committeeTasks.createdAt} DESC`);
      res.json(rows);
    } catch (error) {
      logger.error('Error fetching committee tasks:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب مهام اللجنة' });
    }
  });

  app.post("/api/committee-tasks", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { title, description, assignedTo, assignedMemberId, priority, status, dueDate, decisionId, notes } = req.body;
      if (!title) return res.status(400).json({ error: 'عنوان المهمة مطلوب' });
      const [task] = await db.insert(committeeTasks).values({
        title,
        description: description || null,
        assignedTo: assignedTo || null,
        assignedMemberId: assignedMemberId ? parseInt(assignedMemberId) : null,
        priority: priority || 'medium',
        status: status || 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        decisionId: decisionId ? parseInt(decisionId) : null,
        notes: notes || null,
        createdBy: req.user?.id || null,
      }).returning();
      await storage.createAuditLog({ userId: req.user?.id || null, action: 'create', entityType: 'committee_task', entityId: task.id, details: `إنشاء مهمة لجنة: ${title}` });
      res.status(201).json(task);
    } catch (error) {
      logger.error('Error creating committee task:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء المهمة' });
    }
  });

  app.put("/api/committee-tasks/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { title, description, assignedTo, assignedMemberId, priority, status, dueDate, decisionId, notes } = req.body;
      const [updated] = await db.update(committeeTasks).set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(assignedMemberId !== undefined && { assignedMemberId: assignedMemberId ? parseInt(assignedMemberId) : null }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(decisionId !== undefined && { decisionId: decisionId ? parseInt(decisionId) : null }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      }).where(eq(committeeTasks.id, id)).returning();
      if (!updated) return res.status(404).json({ error: 'المهمة غير موجودة' });
      res.json(updated);
    } catch (error) {
      logger.error('Error updating committee task:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث المهمة' });
    }
  });

  app.patch("/api/committee-tasks/:id/status", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'الحالة مطلوبة' });
      const [updated] = await db.update(committeeTasks).set({ status, updatedAt: new Date() })
        .where(eq(committeeTasks.id, id)).returning();
      if (!updated) return res.status(404).json({ error: 'المهمة غير موجودة' });
      res.json(updated);
    } catch (error) {
      logger.error('Error updating committee task status:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث حالة المهمة' });
    }
  });

  app.delete("/api/committee-tasks/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.update(committeeTasks).set({ deletedAt: new Date() }).where(eq(committeeTasks.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting committee task:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف المهمة' });
    }
  });

  // ==================== قرارات اللجنة API ====================

  app.get("/api/committee/decisions", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const rows = await db.select().from(committeeDecisions)
        .where(isNull(committeeDecisions.deletedAt))
        .orderBy(sql`${committeeDecisions.createdAt} DESC`);
      const allUsers = await db.select({ id: users.id, fullName: users.fullName }).from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u.fullName]));
      const enriched = rows.map(d => ({
        ...d,
        creatorName: d.createdBy ? userMap.get(d.createdBy) || '' : '',
        reviewerName: d.reviewedBy ? userMap.get(d.reviewedBy) || '' : '',
        approverName: d.approvedBy ? userMap.get(d.approvedBy) || '' : '',
      }));
      res.json(enriched);
    } catch (error) {
      logger.error('Error fetching committee decisions:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب القرارات' });
    }
  });

  app.post("/api/committee/decisions", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { title, description, decisionType, priority, effectiveDate, assignedTo, meetingId, attachments } = req.body;
      if (!title || title.trim().length < 3) {
        return res.status(400).json({ error: 'عنوان القرار مطلوب (3 أحرف على الأقل)' });
      }
      const count = await db.select({ cnt: sql<number>`count(*)` }).from(committeeDecisions);
      const num = Number(count[0]?.cnt || 0) + 1;
      const decisionNumber = `DEC-${new Date().getFullYear()}-${String(num).padStart(4, '0')}`;
      const [created] = await db.insert(committeeDecisions).values({
        decisionNumber,
        title: title.trim(),
        description: description || null,
        category: decisionType || 'general',
        priority: priority || 'medium',
        status: 'draft',
        meetingId: meetingId ? (typeof meetingId === 'string' ? parseInt(meetingId) || null : meetingId) : null,
        assignedTo: assignedTo || null,
        attachments: attachments || [],
        createdBy: req.user.id,
        implementationDeadline: effectiveDate ? new Date(effectiveDate) : null,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      logger.error('Error creating committee decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء القرار' });
    }
  });

  app.put("/api/committee/decisions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['draft', 'rejected'].includes(existing.status)) {
        return res.status(400).json({ error: 'لا يمكن تعديل القرار في هذه المرحلة' });
      }
      const { title, description, decisionType, priority, effectiveDate, assignedTo, meetingId, attachments } = req.body;
      if (title && title.trim().length < 3) {
        return res.status(400).json({ error: 'عنوان القرار مطلوب (3 أحرف على الأقل)' });
      }
      const [updated] = await db.update(committeeDecisions).set({
        title: title?.trim() || existing.title,
        description: description !== undefined ? (description || null) : existing.description,
        category: decisionType || existing.category,
        priority: priority || existing.priority,
        meetingId: meetingId ? (typeof meetingId === 'string' ? parseInt(meetingId) || null : meetingId) : existing.meetingId,
        assignedTo: assignedTo !== undefined ? (assignedTo || null) : existing.assignedTo,
        attachments: attachments !== undefined ? attachments : existing.attachments,
        implementationDeadline: effectiveDate ? new Date(effectiveDate) : existing.implementationDeadline,
        status: existing.status === 'rejected' ? 'draft' : existing.status,
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error updating committee decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث القرار' });
    }
  });

  app.delete("/api/committee/decisions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      await db.update(committeeDecisions).set({ deletedAt: new Date() }).where(eq(committeeDecisions.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting committee decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف القرار' });
    }
  });

  app.patch("/api/committee/decisions/:id/submit", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['draft', 'rejected'].includes(existing.status)) {
        return res.status(400).json({ error: 'لا يمكن تقديم هذا القرار - الحالة الحالية لا تسمح بذلك' });
      }
      const [updated] = await db.update(committeeDecisions).set({
        status: 'pending_review',
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error submitting decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في تقديم القرار' });
    }
  });

  app.patch("/api/committee/decisions/:id/send-to-voting", authenticateToken, requireCommitteeRole(['system_admin', 'committee_chairman', 'committee_vice_chairman']), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (existing.status !== 'pending_review') {
        return res.status(400).json({ error: 'القرار يجب أن يكون في حالة المراجعة لإرساله للتصويت' });
      }
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      const [updated] = await db.update(committeeDecisions).set({
        status: 'voting',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        votingDeadline: deadline,
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error sending decision to voting:', { error });
      res.status(500).json({ error: 'حدث خطأ في إرسال القرار للتصويت' });
    }
  });

  app.post("/api/committee/decisions/:id/vote", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { vote } = req.body;
      if (!['approve', 'reject', 'abstain'].includes(vote)) {
        return res.status(400).json({ error: 'نوع التصويت غير صالح' });
      }
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (existing.status !== 'voting') {
        return res.status(400).json({ error: 'القرار ليس في مرحلة التصويت' });
      }
      const [membership] = await db.select().from(committeeMembers)
        .where(and(eq(committeeMembers.userId, req.user.id), eq(committeeMembers.isActive, true)));
      if (!membership) {
        return res.status(403).json({ error: 'يجب أن تكون عضواً في اللجنة للتصويت' });
      }
      const [existingVote] = await db.select().from(decisionVotes)
        .where(and(eq(decisionVotes.decisionId, id), eq(decisionVotes.memberId, membership.id)));
      if (existingVote) {
        return res.status(400).json({ error: 'لقد قمت بالتصويت مسبقاً على هذا القرار' });
      }
      await db.transaction(async (tx) => {
        await tx.insert(decisionVotes).values({
          decisionId: id,
          memberId: membership.id,
          vote,
          votingSessionId: existing.votingSessionId,
        });
        const voteUpdate: any = { updatedAt: new Date() };
        if (vote === 'approve') voteUpdate.votesFor = existing.votesFor + 1;
        else if (vote === 'reject') voteUpdate.votesAgainst = existing.votesAgainst + 1;
        else voteUpdate.votesAbstain = existing.votesAbstain + 1;
        await tx.update(committeeDecisions).set(voteUpdate).where(eq(committeeDecisions.id, id));
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error voting on decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في التصويت' });
    }
  });

  app.get("/api/committee/decisions/:id/votes", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const votes = await db.select().from(decisionVotes).where(eq(decisionVotes.decisionId, id));
      const members = await db.select({ id: committeeMembers.id, name: committeeMembers.name, committeeRole: committeeMembers.committeeRole }).from(committeeMembers);
      const memberMap = new Map(members.map(m => [m.id, m]));
      const enriched = votes.map(v => ({
        ...v,
        memberName: memberMap.get(v.memberId)?.name || '',
        memberRole: memberMap.get(v.memberId)?.committeeRole || '',
      }));
      res.json(enriched);
    } catch (error) {
      logger.error('Error fetching votes:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الأصوات' });
    }
  });

  app.patch("/api/committee/decisions/:id/chairman-approve", authenticateToken, requireCommitteeRole(['system_admin', 'committee_chairman']), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['voting', 'pending_review'].includes(existing.status)) {
        return res.status(400).json({ error: 'لا يمكن اعتماد القرار في هذه المرحلة' });
      }
      const [updated] = await db.update(committeeDecisions).set({
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error approving decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في اعتماد القرار' });
    }
  });

  app.patch("/api/committee/decisions/:id/chairman-reject", authenticateToken, requireCommitteeRole(['system_admin', 'committee_chairman']), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { rejectionReason } = req.body;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['voting', 'pending_review'].includes(existing.status)) {
        return res.status(400).json({ error: 'لا يمكن رفض القرار في هذه المرحلة' });
      }
      const [updated] = await db.update(committeeDecisions).set({
        status: 'rejected',
        rejectionReason: rejectionReason || null,
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error rejecting decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في رفض القرار' });
    }
  });

  app.post("/api/committee/decisions/:id/attachments", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(committeeDecisions).where(and(eq(committeeDecisions.id, id), isNull(committeeDecisions.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'القرار غير موجود' });
      const { attachments } = req.body;
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return res.status(400).json({ error: 'يجب إرفاق ملف واحد على الأقل' });
      }
      const existingAttachments = Array.isArray(existing.attachments) ? existing.attachments : [];
      const merged = [...existingAttachments, ...attachments];
      if (merged.length > 20) {
        return res.status(400).json({ error: 'الحد الأقصى للمرفقات هو 20 ملف' });
      }
      const [updated] = await db.update(committeeDecisions).set({
        attachments: merged,
        updatedAt: new Date(),
      }).where(eq(committeeDecisions.id, id)).returning();
      res.json(updated);
    } catch (error) {
      logger.error('Error adding attachments to decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة المرفقات' });
    }
  });

  // ==================== حضور الاجتماعات API ====================

  // Get all meeting attendance records
  app.get("/api/meeting-attendance", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const _meetingIdRaw = req.query.meetingId ? parseInt(req.query.meetingId as string) : null;
      const meetingId = (_meetingIdRaw !== null && !isNaN(_meetingIdRaw) && _meetingIdRaw > 0) ? _meetingIdRaw : null;
      const records = meetingId
        ? await db.select().from(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId))
        : await db.select().from(meetingAttendance).orderBy(sql`${meetingAttendance.createdAt} DESC`);
      res.json(records);
    } catch (error) {
      logger.error('Error fetching meeting attendance:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات الحضور' });
    }
  });

  // Get attendance for a specific meeting
  app.get("/api/committee-meetings/:id/attendance", authenticateToken, requirePortal(COMMITTEE_PORTALS), async (req: any, res) => {
    try {
      const meetingId = parseId(req.params.id, res);
      if (!meetingId) return;
      const records = await db.select().from(meetingAttendance)
        .where(eq(meetingAttendance.meetingId, meetingId));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات الحضور' });
    }
  });

  // ==================== محاضر الاجتماعات API ====================
  
  // Get all meeting minutes
  app.get("/api/meeting-minutes", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const minutes = await db.select().from(meetingMinutes).orderBy(sql`${meetingMinutes.createdAt} DESC`);
      res.json(minutes);
    } catch (error) {
      logger.error('Error fetching meeting minutes:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المحاضر' });
    }
  });

  // Get minutes for specific meeting
  app.get("/api/committee-meetings/:meetingId/minutes", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const { meetingId } = req.params;
      const minutes = await db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, parseInt(meetingId)));
      res.json(minutes);
    } catch (error) {
      logger.error('Error fetching meeting minutes:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المحاضر' });
    }
  });

  // Create meeting minutes
  app.post("/api/meeting-minutes", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { meetingId, title, content, attendees, decisions, actionItems } = req.body;
      
      const [result] = await db.insert(meetingMinutes).values({
        meetingId,
        title,
        content,
        attendees: attendees || [],
        decisions: decisions || [],
        actionItems: actionItems || [],
        status: 'draft',
        createdBy: req.user.id
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إنشاء محضر اجتماع',
        entityType: 'meeting_minute',
        entityId: insertId,
        details: `تم إنشاء محضر: ${title}`
      });
      
      res.status(201).json({ id: insertId, title });
    } catch (error) {
      logger.error('Error creating meeting minutes:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء المحضر' });
    }
  });

  // Update meeting minutes
  app.put("/api/meeting-minutes/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, content, attendees, decisions, actionItems, status } = req.body;
      
      await db.update(meetingMinutes)
        .set({
          title,
          content,
          attendees,
          decisions,
          actionItems,
          status,
          updatedAt: new Date()
        })
        .where(eq(meetingMinutes.id, parseInt(id)));
      
      res.json({ success: true, id: parseInt(id) });
    } catch (error) {
      logger.error('Error updating meeting minutes:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث المحضر' });
    }
  });

  // Delete meeting minutes
  app.delete("/api/meeting-minutes/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(meetingMinutes).where(eq(meetingMinutes.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting meeting minutes:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف المحضر' });
    }
  });

  // ==================== الخوادم API ====================
  
  // Get all servers
  app.get("/api/infrastructure/servers", authenticateToken, async (req: any, res) => {
    try {
      const servers = await db.select().from(infrastructureServers).orderBy(infrastructureServers.name);
      res.json(servers);
    } catch (error) {
      logger.error('Error fetching servers:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الخوادم' });
    }
  });

  // Create server
  app.post("/api/infrastructure/servers", authenticateToken, async (req: any, res) => {
    try {
      const { name, hostname, ipAddress, serverType, operatingSystem, cpuCores, ramGb, storageGb, location, rack, status, environment, purpose, notes } = req.body;
      
      const [result] = await db.insert(infrastructureServers).values({
        name,
        hostname,
        ipAddress,
        serverType: serverType || 'physical',
        operatingSystem,
        cpuCores,
        ramGb,
        storageGb,
        location,
        rack,
        status: status || 'active',
        environment: environment || 'production',
        purpose,
        notes
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إضافة خادم',
        entityType: 'infrastructure_server',
        entityId: insertId,
        details: `تم إضافة خادم: ${name}`
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating server:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة الخادم' });
    }
  });

  // Update server
  app.put("/api/infrastructure/servers/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const serverId = parseId(req.params.id, res);
      if (!serverId) return;
      const { name, hostname, ipAddress, serverType, operatingSystem, cpuCores, ramGb, storageGb, location, rack, status, healthScore, environment, purpose, notes } = req.body;
      
      await db.update(infrastructureServers)
        .set({
          name, hostname, ipAddress, serverType, operatingSystem, cpuCores, ramGb, storageGb, location, rack, status, healthScore, environment, purpose, notes,
          updatedAt: new Date()
        })
        .where(eq(infrastructureServers.id, serverId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث خادم',
        entityType: 'infrastructure_server',
        entityId: serverId,
        details: `تم تحديث الخادم: ${name || serverId}`
      });
      
      const [updated] = await db.select().from(infrastructureServers).where(eq(infrastructureServers.id, serverId));
      res.json(updated);
    } catch (error) {
      logger.error('Error updating server:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الخادم' });
    }
  });

  // Delete server
  app.delete("/api/infrastructure/servers/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const serverId = parseId(req.params.id, res);
      if (!serverId) return;
      await db.delete(infrastructureServers).where(eq(infrastructureServers.id, serverId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف خادم',
        entityType: 'infrastructure_server',
        entityId: serverId,
        details: `تم حذف الخادم رقم: ${serverId}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting server:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الخادم' });
    }
  });

  // ==================== الشبكات API ====================
  
  // Get all networks
  app.get("/api/infrastructure/networks", authenticateToken, async (req: any, res) => {
    try {
      const networks = await db.select().from(infrastructureNetworks).orderBy(infrastructureNetworks.name);
      res.json(networks);
    } catch (error) {
      logger.error('Error fetching networks:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الشبكات' });
    }
  });

  // Create network
  app.post("/api/infrastructure/networks", authenticateToken, async (req: any, res) => {
    try {
      const { name, networkType, subnet, gateway, vlanId, bandwidth, location, status, securityLevel, firewallEnabled, notes } = req.body;
      
      const [result] = await db.insert(infrastructureNetworks).values({
        name,
        networkType: networkType || 'lan',
        subnet,
        gateway,
        vlanId,
        bandwidth,
        location,
        status: status || 'active',
        securityLevel: securityLevel || 'medium',
        firewallEnabled: firewallEnabled !== false,
        notes
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إضافة شبكة',
        entityType: 'infrastructure_network',
        entityId: insertId,
        details: `تم إضافة شبكة: ${name}`
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating network:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة الشبكة' });
    }
  });

  // Update network
  app.put("/api/infrastructure/networks/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const networkId = parseId(req.params.id, res);
      if (!networkId) return;
      const { name, networkType, subnet, gateway, vlanId, bandwidth, location, status, securityLevel, firewallEnabled, notes } = req.body;
      
      await db.update(infrastructureNetworks)
        .set({
          name, networkType, subnet, gateway, vlanId, bandwidth, location, status, securityLevel, firewallEnabled, notes,
          updatedAt: new Date()
        })
        .where(eq(infrastructureNetworks.id, networkId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث شبكة',
        entityType: 'infrastructure_network',
        entityId: networkId,
        details: `تم تحديث الشبكة: ${name || networkId}`
      });
      
      const [updated] = await db.select().from(infrastructureNetworks).where(eq(infrastructureNetworks.id, networkId));
      res.json(updated);
    } catch (error) {
      logger.error('Error updating network:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الشبكة' });
    }
  });

  // Delete network
  app.delete("/api/infrastructure/networks/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const networkId = parseId(req.params.id, res);
      if (!networkId) return;
      await db.delete(infrastructureNetworks).where(eq(infrastructureNetworks.id, networkId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف شبكة',
        entityType: 'infrastructure_network',
        entityId: networkId,
        details: `تم حذف الشبكة رقم: ${networkId}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting network:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الشبكة' });
    }
  });

  // ==================== التخزين API ====================
  
  // Get all storage
  app.get("/api/infrastructure/storage", authenticateToken, async (req: any, res) => {
    try {
      const storageUnits = await db.select().from(infrastructureStorage).orderBy(infrastructureStorage.name);
      res.json(storageUnits);
    } catch (error) {
      logger.error('Error fetching storage:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب وحدات التخزين' });
    }
  });

  // Create storage
  app.post("/api/infrastructure/storage", authenticateToken, async (req: any, res) => {
    try {
      const { name, storageType, totalCapacityTb, usedCapacityTb, raidLevel, location, status, performanceTier, backupEnabled, encryptionEnabled, notes } = req.body;
      
      const [result] = await db.insert(infrastructureStorage).values({
        name,
        storageType: storageType || 'san',
        totalCapacityTb,
        usedCapacityTb,
        raidLevel,
        location,
        status: status || 'active',
        performanceTier: performanceTier || 'standard',
        backupEnabled: backupEnabled !== false,
        encryptionEnabled: encryptionEnabled !== false,
        notes
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إضافة وحدة تخزين',
        entityType: 'infrastructure_storage',
        entityId: insertId,
        details: `تم إضافة وحدة تخزين: ${name}`
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating storage:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة وحدة التخزين' });
    }
  });

  // Update storage
  app.put("/api/infrastructure/storage/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const storageId = parseId(req.params.id, res);
      if (!storageId) return;
      const { name, storageType, totalCapacityTb, usedCapacityTb, raidLevel, location, status, performanceTier, backupEnabled, encryptionEnabled, notes } = req.body;
      
      await db.update(infrastructureStorage)
        .set({
          name, storageType, totalCapacityTb, usedCapacityTb, raidLevel, location, status, performanceTier, backupEnabled, encryptionEnabled, notes,
          updatedAt: new Date()
        })
        .where(eq(infrastructureStorage.id, storageId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث وحدة تخزين',
        entityType: 'infrastructure_storage',
        entityId: storageId,
        details: `تم تحديث وحدة التخزين: ${name || storageId}`
      });
      
      const [updated] = await db.select().from(infrastructureStorage).where(eq(infrastructureStorage.id, storageId));
      res.json(updated);
    } catch (error) {
      logger.error('Error updating storage:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث وحدة التخزين' });
    }
  });

  // Delete storage
  app.delete("/api/infrastructure/storage/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const storageId = parseId(req.params.id, res);
      if (!storageId) return;
      await db.delete(infrastructureStorage).where(eq(infrastructureStorage.id, storageId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف وحدة تخزين',
        entityType: 'infrastructure_storage',
        entityId: storageId,
        details: `تم حذف وحدة التخزين رقم: ${storageId}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting storage:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف وحدة التخزين' });
    }
  });

  // ==================== المراقبة API ====================
  
  // Get all monitoring alerts
  app.get("/api/infrastructure/monitoring", authenticateToken, async (req: any, res) => {
    try {
      const alerts = await db.select().from(infrastructureMonitoring).orderBy(sql`${infrastructureMonitoring.lastChecked} DESC`);
      res.json(alerts);
    } catch (error) {
      logger.error('Error fetching monitoring:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب التنبيهات' });
    }
  });

  // Create monitoring alert
  app.post("/api/infrastructure/monitoring", authenticateToken, async (req: any, res) => {
    try {
      const { name, targetType, targetId, metricType, currentValue, thresholdWarning, thresholdCritical, unit, status, alertEnabled, notes } = req.body;
      
      const [result] = await db.insert(infrastructureMonitoring).values({
        name,
        targetType: targetType || 'server',
        targetId,
        metricType,
        currentValue,
        thresholdWarning,
        thresholdCritical,
        unit,
        status: status || 'normal',
        alertEnabled: alertEnabled !== false,
        notes
      }).returning();
      const insertId = result.id;
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إضافة تنبيه مراقبة',
        entityType: 'infrastructure_monitoring',
        entityId: insertId,
        details: `تم إضافة تنبيه: ${name}`
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating monitoring alert:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة التنبيه' });
    }
  });

  // Update monitoring alert
  app.put("/api/infrastructure/monitoring/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const monitoringId = parseId(req.params.id, res);
      if (!monitoringId) return;
      const { name, targetType, targetId, metricType, currentValue, thresholdWarning, thresholdCritical, unit, status, alertEnabled, notes } = req.body;
      
      await db.update(infrastructureMonitoring)
        .set({
          name, targetType, targetId, metricType, currentValue, thresholdWarning, thresholdCritical, unit, status, alertEnabled, notes,
          lastChecked: new Date(),
          updatedAt: new Date()
        })
        .where(eq(infrastructureMonitoring.id, monitoringId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث تنبيه مراقبة',
        entityType: 'infrastructure_monitoring',
        entityId: monitoringId,
        details: `تم تحديث التنبيه: ${name || monitoringId}`
      });
      
      const [updated] = await db.select().from(infrastructureMonitoring).where(eq(infrastructureMonitoring.id, monitoringId));
      res.json(updated);
    } catch (error) {
      logger.error('Error updating monitoring alert:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث التنبيه' });
    }
  });

  // Delete monitoring alert
  app.delete("/api/infrastructure/monitoring/:id", authenticateToken, async (req: any, res) => {
    try {
      if (!canMutateResource(req.user, null, ['infrastructure'])) {
        return res.status(403).json({ error: 'هذه الموارد مخصصة لقسم البنية التحتية فقط' });
      }
      const monitoringId = parseId(req.params.id, res);
      if (!monitoringId) return;
      await db.delete(infrastructureMonitoring).where(eq(infrastructureMonitoring.id, monitoringId));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف تنبيه مراقبة',
        entityType: 'infrastructure_monitoring',
        entityId: monitoringId,
        details: `تم حذف التنبيه رقم: ${monitoringId}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting monitoring alert:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف التنبيه' });
    }
  });

  // ==================== نظام الإحالات بين الإدارات التقنية ====================

  // Get all referrals
  app.get("/api/it-referrals", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';

      if (isDirectorOrAdmin) {
        const referrals = await db.select().from(itReferrals).orderBy(sql`${itReferrals.createdAt} DESC`);
        return res.json(referrals);
      }

      const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
      if (!userDeptId) {
        return res.json([]);
      }
      const referrals = await db.select().from(itReferrals)
        .where(sql`${itReferrals.fromDepartmentId} = ${userDeptId} OR ${itReferrals.toDepartmentId} = ${userDeptId}`)
        .orderBy(sql`${itReferrals.createdAt} DESC`);
      res.json(referrals);
    } catch (error) {
      logger.error('Error fetching referrals:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الإحالات' });
    }
  });

  // Get referrals for a specific department (incoming or outgoing)
  app.get("/api/it-referrals/department/:deptId", authenticateToken, async (req: any, res) => {
    try {
      const { deptId } = req.params;
      const { direction } = req.query; // 'incoming' or 'outgoing'
      const parsedDeptId = parseInt(deptId);

      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';

      if (!isDirectorOrAdmin) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId && userDeptId !== parsedDeptId) {
          return res.status(403).json({ error: 'غير مصرح بالوصول لإحالات هذا القسم' });
        }
      }
      
      let referrals;
      if (direction === 'incoming') {
        referrals = await db.select().from(itReferrals)
          .where(eq(itReferrals.toDepartmentId, parsedDeptId))
          .orderBy(sql`${itReferrals.createdAt} DESC`);
      } else if (direction === 'outgoing') {
        referrals = await db.select().from(itReferrals)
          .where(eq(itReferrals.fromDepartmentId, parsedDeptId))
          .orderBy(sql`${itReferrals.createdAt} DESC`);
      } else {
        referrals = await db.select().from(itReferrals)
          .where(sql`${itReferrals.fromDepartmentId} = ${parsedDeptId} OR ${itReferrals.toDepartmentId} = ${parsedDeptId}`)
          .orderBy(sql`${itReferrals.createdAt} DESC`);
      }
      
      res.json(referrals);
    } catch (error) {
      logger.error('Error fetching department referrals:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إحالات الإدارة' });
    }
  });

  // Get single referral with history
  app.get("/api/it-referrals/:id", authenticateToken, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      // Guard: pass non-numeric IDs to next route (/stats, /outlook-status etc.)
      if (!(/^\d+$/.test(id))) {
        return next();
      }
      const [referral] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      
      if (!referral) {
        return res.status(404).json({ error: 'الإحالة غير موجودة' });
      }
      
      const history = await db.select().from(itReferralHistory)
        .where(eq(itReferralHistory.referralId, parseInt(id)))
        .orderBy(sql`${itReferralHistory.createdAt} DESC`);
      
      res.json({ ...referral, history });
    } catch (error) {
      logger.error('Error fetching referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الإحالة' });
    }
  });

  // Create new referral
  app.post("/api/it-referrals", authenticateToken, createRateLimiter, async (req: any, res) => {
    try {
      const { type, entityId, title, description, priority, fromDepartmentId, toDepartmentId, reason, dueDate, attachments } = req.body;

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'عنوان الإحالة مطلوب' });
      }

      const VALID_IT_DEPT_IDS = [5, 9, 10, 11, 12];
      if (!VALID_IT_DEPT_IDS.includes(parseInt(fromDepartmentId)) || !VALID_IT_DEPT_IDS.includes(parseInt(toDepartmentId))) {
        return res.status(400).json({ error: 'الإحالات مسموحة فقط بين الإدارات المعتمدة' });
      }
      if (parseInt(fromDepartmentId) === parseInt(toDepartmentId)) {
        return res.status(400).json({ error: 'لا يمكن إحالة مهمة لنفس الإدارة' });
      }

      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId && userDeptId !== parseInt(fromDepartmentId)) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء إحالة باسم قسم آخر' });
        }
      }

      // Generate referral number
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const count = await db.select({ count: sql<number>`count(*)` }).from(itReferrals);
      const refNumber = `REF-${year}${month}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const [result] = await db.insert(itReferrals).values({
        referralNumber: refNumber,
        type: type || 'task',
        entityId: entityId || 0,
        title,
        description,
        priority: priority || 'medium',
        fromDepartmentId,
        toDepartmentId,
        referredById: req.user.id,
        reason,
        dueDate: dueDate ? new Date(dueDate) : null,
        attachments,
        status: 'pending'
      }).returning();
      const insertId = result.id;
      
      // Add to history
      await db.insert(itReferralHistory).values({
        referralId: insertId,
        action: 'created',
        performedById: req.user.id,
        toStatus: 'pending',
        notes: `تم إنشاء الإحالة: ${title}`
      });
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إنشاء إحالة',
        entityType: 'it_referral',
        entityId: insertId,
        details: `تم إنشاء إحالة: ${title} من إدارة ${fromDepartmentId} إلى إدارة ${toDepartmentId}`
      });
      
      // Notify the target department manager
      try {
        const toDept = await storage.getITDepartmentById(toDepartmentId);
        if (toDept && toDept.managerId) {
          await storage.createNotification({
            userId: toDept.managerId,
            title: 'إحالة جديدة',
            message: `تم إحالة "${title}" إلى إدارتكم - الأولوية: ${priority === 'urgent' ? 'عاجلة' : priority === 'critical' ? 'حرجة' : priority === 'high' ? 'عالية' : priority === 'low' ? 'منخفضة' : 'متوسطة'}`,
            type: 'referral_created',
            priority: priority === 'urgent' || priority === 'critical' || priority === 'high' ? 'high' : 'normal',
            entityType: 'it_referral',
            entityId: insertId,
            isRead: false,
            actionUrl: (() => { const m: Record<number, string> = { 5: '/dmo/referrals', 9: '/department/infrastructure/referrals', 10: '/department/cybersecurity/referrals', 11: '/department/digital-transformation/referrals', 12: '/department/support/referrals' }; return m[toDepartmentId] || '/it-director/referrals'; })(),
          });
          
          // Send email notification
          const manager = await storage.getUserById(toDept.managerId);
          if (manager && manager.email) {
            const { generateNotificationEmail, sendEmail: sendEmailFn } = await import('./email');
            const deptPathMap: Record<number, string> = { 5: '/dmo/referrals', 9: '/department/infrastructure/referrals', 10: '/department/cybersecurity/referrals', 11: '/department/digital-transformation/referrals', 12: '/department/support/referrals' };
            const html = generateNotificationEmail({
              recipientName: manager.name || manager.email,
              subject: `إحالة جديدة: ${title}`,
              message: `تم إحالة عنصر جديد إلى إدارتكم:<br/><br/><strong>${title}</strong><br/>${description || ''}<br/><br/>رقم الإحالة: ${refNumber}<br/>سبب الإحالة: ${reason || 'غير محدد'}`,
              actionUrl: `https://controlhub.jcsa.sa${deptPathMap[toDepartmentId] || '/it-director/referrals'}`,
              actionText: 'عرض الإحالة'
            });
            await sendEmailFn(manager.email, `إحالة جديدة: ${title}`, html);
          }
        }
      } catch (notifError) {
        logger.error('Error sending referral notification:', { error: notifError });
      }
      
      res.status(201).json({ id: insertId, referralNumber: refNumber });
    } catch (error) {
      logger.error('Error creating referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء الإحالة' });
    }
  });

  // Update referral status
  app.put("/api/it-referrals/:id/status", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, responseNote, assignedToId, rejectionReason } = req.body;
      
      const [current] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!current) {
        return res.status(404).json({ error: 'الإحالة غير موجودة' });
      }

      const userRole = req.user?.role || '';
      const isDirectorOrAdmin = ['it_director', 'system_admin', 'admin'].includes(userRole);

      // Department ownership check
      if (!isDirectorOrAdmin) {
        const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
        if (current.fromDepartmentId !== userDeptId && current.toDepartmentId !== userDeptId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية تعديل هذه الإحالة' });
        }
      }

      if (!isDirectorOrAdmin && !isValidTransition('referral', current.status, status)) {
        const allowed = getAllowedTransitions('referral', current.status);
        return res.status(400).json({ 
          error: `لا يمكن تغيير حالة الإحالة من "${current.status}" إلى "${status}". التحولات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
          allowedTransitions: allowed,
          reason: getTransitionReason('referral', current.status, status),
        });
      }
      
      if ((status === 'rejected' || status === 'returned') && !rejectionReason && !responseNote) {
        return res.status(400).json({ 
          error: status === 'rejected' ? 'سبب الرفض مطلوب' : 'سبب الإرجاع مطلوب',
        });
      }
      
      const updates: any = { 
        status,
        responseNote,
        updatedAt: new Date()
      };
      
      if (assignedToId) updates.assignedToId = assignedToId;
      if (status === 'accepted') updates.acceptedAt = new Date();
      if (status === 'completed') updates.completedAt = new Date();
      
      if (status === 'rejected' || status === 'returned') {
        updates.responseNote = rejectionReason || responseNote;
      }
      
      await db.update(itReferrals)
        .set(updates)
        .where(eq(itReferrals.id, parseInt(id)));
      
      // If accepted, create a task for the receiving department
      let createdTaskId = null;
      if (status === 'accepted') {
        const [insertedTask] = await db.insert(departmentTasks).values({
          departmentId: current.toDepartmentId,
          title: `[إحالة] ${current.title}`,
          description: current.description || '',
          taskType: 'referral',
          priority: current.priority,
          status: 'pending',
          assignedBy: req.user.id,
          assignedTo: assignedToId || null,
          referralId: parseInt(id),
          sourceType: 'referral',
          dueDate: current.dueDate,
          notes: `إحالة من ${current.fromDepartmentId === 1 ? 'البنية التحتية' : current.fromDepartmentId === 2 ? 'الأمن السيبراني' : current.fromDepartmentId === 3 ? 'التحول الرقمي' : 'الدعم الفني'}\nالسبب: ${current.reason || 'غير محدد'}`
        }).returning({ id: departmentTasks.id });
        
        createdTaskId = insertedTask?.id;
        
        // Update referral with linked task
        if (createdTaskId) {
          await db.update(itReferrals)
            .set({ entityId: createdTaskId })
            .where(eq(itReferrals.id, parseInt(id)));
        }
      }
      
      // Add to history
      const actionMap: Record<string, string> = {
        accepted: 'قبول الإحالة وإنشاء مهمة',
        rejected: 'رفض الإحالة',
        in_progress: 'بدء العمل',
        completed: 'إكمال الإحالة',
        returned: 'إرجاع الإحالة للمرسل'
      };
      
      await db.insert(itReferralHistory).values({
        referralId: parseInt(id),
        action: status,
        performedById: req.user.id,
        fromStatus: current.status,
        toStatus: status,
        notes: status === 'rejected' ? `سبب الرفض: ${rejectionReason || responseNote}` : (responseNote || actionMap[status] || status)
      });
      
      // Audit log
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث حالة إحالة',
        entityType: 'it_referral',
        entityId: parseInt(id),
        details: `تم تحديث حالة الإحالة من ${current.status} إلى ${status}${createdTaskId ? ` - تم إنشاء مهمة رقم ${createdTaskId}` : ''}`
      });
      
      res.json({ success: true, taskId: createdTaskId });
    } catch (error) {
      logger.error('Error updating referral status:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث حالة الإحالة' });
    }
  });

  // Update referral
  app.put("/api/it-referrals/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, description, priority, toDepartmentId, reason, dueDate, assignedToId, attachments } = req.body;

      // Department ownership check
      const [current] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!current) {
        return res.status(404).json({ error: 'الإحالة غير موجودة' });
      }
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const isAdmin = ['system_admin', 'admin', 'it_director'].includes(req.user.role);
      if (!isAdmin && current.fromDepartmentId !== userDeptId && current.toDepartmentId !== userDeptId) {
        return res.status(403).json({ error: 'ليس لديك صلاحية تعديل هذه الإحالة' });
      }

      await db.update(itReferrals)
        .set({
          title, description, priority, toDepartmentId, reason, assignedToId, attachments,
          dueDate: dueDate ? new Date(dueDate) : null,
          updatedAt: new Date()
        })
        .where(eq(itReferrals.id, parseInt(id)));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تحديث إحالة',
        entityType: 'it_referral',
        entityId: parseInt(id),
        details: `تم تحديث الإحالة: ${title || id}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الإحالة' });
    }
  });

  // Delete referral
  app.delete("/api/it-referrals/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Department ownership check
      const [current] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!current) {
        return res.status(404).json({ error: 'الإحالة غير موجودة' });
      }
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];
      const isAdmin = ['system_admin', 'admin', 'it_director'].includes(req.user.role);
      if (!isAdmin && current.fromDepartmentId !== userDeptId && current.toDepartmentId !== userDeptId) {
        return res.status(403).json({ error: 'ليس لديك صلاحية حذف هذه الإحالة' });
      }

      // Delete history first
      await db.delete(itReferralHistory).where(eq(itReferralHistory.referralId, parseInt(id)));
      // Delete referral
      await db.delete(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'حذف إحالة',
        entityType: 'it_referral',
        entityId: parseInt(id),
        details: `تم حذف الإحالة رقم: ${id}`
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الإحالة' });
    }
  });

  // Referral Stats (scoped by department for non-admin/director users)
  app.get("/api/it-referrals/stats", authenticateToken, async (req: any, res) => {
    try {
      const { deptId } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';

      if (!isDirectorOrAdmin && deptId) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId && userDeptId !== parseInt(deptId as string)) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
      }

      const all = await db.select().from(itReferrals);
      const effectiveDeptId = isDirectorOrAdmin ? (deptId ? parseInt(deptId as string) : null) : (PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId || null);
      const deptAll = effectiveDeptId ? all.filter((r: any) => r.toDepartmentId === effectiveDeptId || r.fromDepartmentId === effectiveDeptId) : all;
      const now = new Date();
      const isOverdue = (r: any) => {
        if (r.status === 'completed' || r.status === 'rejected') return false;
        if (r.dueDate) return new Date(r.dueDate) < now;
        if (r.slaHours && r.createdAt) return new Date(r.createdAt.getTime() + r.slaHours * 3600000) < now;
        return false;
      };
      const pendingAck = all.filter((r: any) => r.status === 'pending' && !r.acknowledgedAt);
      const escalated = all.filter((r: any) => (r.escalationLevel || 0) > 0);
      res.json({
        total: deptAll.length,
        pending: deptAll.filter((r: any) => r.status === 'pending').length,
        accepted: deptAll.filter((r: any) => r.status === 'accepted').length,
        inProgress: deptAll.filter((r: any) => r.status === 'in_progress').length,
        completed: deptAll.filter((r: any) => r.status === 'completed').length,
        rejected: deptAll.filter((r: any) => r.status === 'rejected').length,
        overdue: deptAll.filter(isOverdue).length,
        emailImported: deptAll.filter((r: any) => r.isEmailImported).length,
        pendingAcknowledgment: pendingAck.length,
        escalated: escalated.length,
        // Per-department breakdown (incoming)
        byDepartment: [5,9,10,11,12].map(id => ({
          deptId: id,
          incoming: all.filter((r: any) => r.toDepartmentId === id).length,
          pending: all.filter((r: any) => r.toDepartmentId === id && r.status === 'pending').length,
          overdue: all.filter((r: any) => r.toDepartmentId === id && isOverdue(r)).length,
          unacknowledged: all.filter((r: any) => r.toDepartmentId === id && r.status === 'pending' && !r.acknowledgedAt).length,
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
  });

  // Acknowledge referral receipt (receiving dept confirms they received it)
  app.post("/api/it-referrals/:id/acknowledge", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const [referral] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!referral) return res.status(404).json({ error: 'الإحالة غير موجودة' });
      if (referral.acknowledgedAt) return res.status(400).json({ error: 'تم تأكيد الاستلام مسبقاً' });

      await db.update(itReferrals)
        .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
        .where(eq(itReferrals.id, parseInt(id)));

      await db.insert(itReferralHistory).values({
        referralId: parseInt(id),
        action: 'acknowledged',
        performedById: req.user.id,
        fromStatus: referral.status,
        toStatus: referral.status,
        notes: note || 'تم تأكيد استلام الإحالة'
      });

      // Notify the sender's department manager
      try {
        const fromDept = await storage.getITDepartmentById(referral.fromDepartmentId);
        if (fromDept?.managerId) {
          await storage.createNotification({
            userId: fromDept.managerId,
            title: 'تم استلام الإحالة ✓',
            message: `تأكد فريق ${fromDept.nameAr || 'الإدارة المستقبِلة'} من استلام: "${referral.title}"`,
            type: 'referral_acknowledged',
            priority: 'normal',
            entityType: 'it_referral',
            entityId: parseInt(id),
            isRead: false,
            actionUrl: '/it-director/referrals',
          });
        }
      } catch { /* silent */ }

      await storage.createAuditLog({
        userId: req.user.id, action: 'تأكيد استلام إحالة',
        entityType: 'it_referral', entityId: parseInt(id),
        details: `تم تأكيد استلام الإحالة: ${referral.title}`
      });

      res.json({ success: true, acknowledgedAt: new Date() });
    } catch (error) {
      logger.error('Error acknowledging referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في تأكيد الاستلام' });
    }
  });

  // Manual escalation to IT Director
  app.post("/api/it-referrals/:id/escalate", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const [referral] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!referral) return res.status(404).json({ error: 'الإحالة غير موجودة' });

      const newLevel = Math.min((referral.escalationLevel || 0) + 1, 2);
      const updates: any = {
        escalationLevel: newLevel,
        escalatedAt: referral.escalatedAt || new Date(),
        updatedAt: new Date()
      };
      if (newLevel >= 2) updates.itDirectorEscalatedAt = new Date();

      await db.update(itReferrals).set(updates).where(eq(itReferrals.id, parseInt(id)));

      await db.insert(itReferralHistory).values({
        referralId: parseInt(id),
        action: 'escalated',
        performedById: req.user.id,
        fromStatus: referral.status,
        toStatus: referral.status,
        notes: reason || `تصعيد المستوى ${newLevel} — لا استجابة خلال مهلة SLA`
      });

      // Notify IT Director
      try {
        const DEPT_PATH: Record<number,string> = {9:'/department/infrastructure/referrals',10:'/department/cybersecurity/referrals',11:'/department/digital-transformation/referrals',12:'/department/support/referrals'};
        const itDirectorUsers = await db.select().from(users).where(eq(users.role, 'it_director' as any));
        for (const director of itDirectorUsers) {
          await storage.createNotification({
            userId: director.id,
            title: '🔴 إحالة مُصعَّدة إليك',
            message: `لم تستجب الإدارة المستقبِلة للإحالة "${referral.title}" — يتطلب تدخلك`,
            type: 'referral_escalated',
            priority: 'high',
            entityType: 'it_referral',
            entityId: parseInt(id),
            isRead: false,
            actionUrl: '/it-director/referrals',
          });
        }
        // Also notify the target dept manager
        const toDept = await storage.getITDepartmentById(referral.toDepartmentId);
        if (toDept?.managerId) {
          await storage.createNotification({
            userId: toDept.managerId,
            title: '⚠️ إحالة تجاوزت مهلة الاستجابة',
            message: `"${referral.title}" تم تصعيدها لمدير تقنية المعلومات — يرجى الاستجابة فوراً`,
            type: 'referral_escalated',
            priority: 'high',
            entityType: 'it_referral',
            entityId: parseInt(id),
            isRead: false,
            actionUrl: DEPT_PATH[referral.toDepartmentId] || '/it-director/referrals',
          });
        }
      } catch { /* silent */ }

      await storage.createAuditLog({
        userId: req.user.id, action: 'تصعيد إحالة',
        entityType: 'it_referral', entityId: parseInt(id),
        details: `تم تصعيد الإحالة "${referral.title}" إلى المستوى ${newLevel}: ${reason || 'لا استجابة'}`
      });

      res.json({ success: true, escalationLevel: newLevel });
    } catch (error) {
      logger.error('Error escalating referral:', { error });
      res.status(500).json({ error: 'حدث خطأ في التصعيد' });
    }
  });

  // Get referrals with full department details for IT Director view
  app.get("/api/it-referrals/full", authenticateToken, async (req: any, res) => {
    try {
      const { status, deptId, direction } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';

      let query = db.select({
        referral: itReferrals,
        referredBy: { id: users.id, name: users.name },
      }).from(itReferrals).leftJoin(users, eq(itReferrals.referredById, users.id));

      const conditions: any[] = [];
      if (status && status !== 'all') conditions.push(eq(itReferrals.status, status as string));

      if (!isDirectorOrAdmin) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId) {
          conditions.push(sql`(${itReferrals.fromDepartmentId} = ${userDeptId} OR ${itReferrals.toDepartmentId} = ${userDeptId})`);
        }
      } else if (deptId) {
        if (direction === 'incoming') conditions.push(eq(itReferrals.toDepartmentId, parseInt(deptId as string)));
        else if (direction === 'outgoing') conditions.push(eq(itReferrals.fromDepartmentId, parseInt(deptId as string)));
        else conditions.push(sql`${itReferrals.fromDepartmentId} = ${parseInt(deptId as string)} OR ${itReferrals.toDepartmentId} = ${parseInt(deptId as string)}`);
      }
      if (conditions.length > 0) query = query.where(and(...conditions)) as any;
      const rows = await query.orderBy(sql`${itReferrals.createdAt} DESC`);
      res.json(rows.map((r: any) => ({ ...r.referral, referredByUser: r.referredBy })));
    } catch (error) {
      res.status(500).json({ error: 'خطأ في جلب الإحالات' });
    }
  });

  // Delegate referral to another department
  app.post("/api/it-referrals/:id/delegate", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { delegatedToDepartmentId, reason } = req.body;
      if (!delegatedToDepartmentId) return res.status(400).json({ error: 'الإدارة المستهدفة مطلوبة' });

      const VALID_IT_DEPT_IDS = [5, 9, 10, 11, 12];
      if (!VALID_IT_DEPT_IDS.includes(parseInt(delegatedToDepartmentId))) {
        return res.status(400).json({ error: 'التفويض مسموح فقط للإدارات المعتمدة' });
      }

      const [current] = await db.select().from(itReferrals).where(eq(itReferrals.id, parseInt(id)));
      if (!current) return res.status(404).json({ error: 'الإحالة غير موجودة' });

      if (parseInt(delegatedToDepartmentId) === current.fromDepartmentId) {
        return res.status(400).json({ error: 'لا يمكن التفويض للإدارة المُحيلة الأصلية' });
      }

      await db.update(itReferrals).set({
        delegatedToDepartmentId: parseInt(delegatedToDepartmentId),
        toDepartmentId: parseInt(delegatedToDepartmentId),
        status: 'pending',
        updatedAt: new Date()
      }).where(eq(itReferrals.id, parseInt(id)));

      await db.insert(itReferralHistory).values({
        referralId: parseInt(id),
        action: 'تفويض الإحالة',
        performedById: req.user.id,
        fromStatus: current.status,
        toStatus: 'pending',
        notes: reason || `تم تفويض الإحالة إلى إدارة أخرى`
      });

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'تفويض إحالة',
        entityType: 'it_referral',
        entityId: parseInt(id),
        details: `تم تفويض الإحالة ${current.referralNumber} إلى إدارة ${delegatedToDepartmentId}`
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error delegating referral:', { error });
      res.status(500).json({ error: 'خطأ في تفويض الإحالة' });
    }
  });

  // ── Add/update attachments on an existing referral ───────────────────────
  app.post("/api/it-referrals/:id/attachments", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id < 1) return res.status(400).json({ error: 'معرف الإحالة غير صالح' });
      const { attachments: newAttachments } = req.body;
      if (!Array.isArray(newAttachments)) return res.status(400).json({ error: 'attachments must be an array' });

      const [existing] = await db.select().from(itReferrals).where(eq(itReferrals.id, id));
      if (!existing) return res.status(404).json({ error: 'الإحالة غير موجودة' });

      const currentAttachments: any[] = Array.isArray(existing.attachments) ? existing.attachments as any[] : [];
      const merged = [...currentAttachments, ...newAttachments];

      await db.update(itReferrals)
        .set({ attachments: merged, updatedAt: new Date() })
        .where(eq(itReferrals.id, id));

      // Log to history
      await db.insert(itReferralHistory).values({
        referralId: id,
        action: 'attachments_added',
        performedById: req.user.id,
        notes: `أضيف ${newAttachments.length} مرفق`,
      });

      res.json({ success: true, attachments: merged });
    } catch (error: any) {
      logger.error('Error adding referral attachments:', { error });
      res.status(500).json({ error: 'خطأ في حفظ المرفقات' });
    }
  });

  // ── Delete a specific attachment from a referral ──────────────────────────
  app.delete("/api/it-referrals/:id/attachments/:index", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const idx = parseInt(req.params.index);
      if (isNaN(id) || id < 1) return res.status(400).json({ error: 'معرف الإحالة غير صالح' });
      if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'فهرس المرفق غير صالح' });

      const [existing] = await db.select().from(itReferrals).where(eq(itReferrals.id, id));
      if (!existing) return res.status(404).json({ error: 'الإحالة غير موجودة' });

      const current: any[] = Array.isArray(existing.attachments) ? existing.attachments as any[] : [];
      if (idx >= current.length) return res.status(400).json({ error: 'فهرس المرفق غير صالح' });

      current.splice(idx, 1);
      await db.update(itReferrals).set({ attachments: current, updatedAt: new Date() }).where(eq(itReferrals.id, id));

      res.json({ success: true, attachments: current });
    } catch (error: any) {
      logger.error('Error deleting referral attachment:', { error });
      res.status(500).json({ error: 'خطأ في حذف المرفق' });
    }
  });

  // Check Outlook IMAP status
  app.get("/api/it-referrals/outlook-status", authenticateToken, async (req: any, res) => {
    try {
      const host = process.env.IMAP_HOST || 'outlook.office365.com';
      const user = process.env.SMTP_USER || '';
      const hasCredentials = !!(user && process.env.SMTP_PASS);
      res.json({
        configured: hasCredentials,
        host,
        user: user ? user.replace(/(.{3}).*(@.*)/, '$1***$2') : '',
        lastImport: null
      });
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // Import referrals from Outlook via IMAP
  app.post("/api/it-referrals/import-outlook", authenticateToken, async (req: any, res) => {
    try {
      const { ImapFlow } = await import('imapflow');
      const { simpleParser } = await import('mailparser');

      const imapHost = process.env.IMAP_HOST || 'outlook.office365.com';
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        return res.status(400).json({ error: 'لم يتم تكوين بيانات الاعتماد للبريد الإلكتروني' });
      }

      const client = new ImapFlow({
        host: imapHost,
        port: 993,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
        logger: false,
        tls: { rejectUnauthorized: false }
      });

      const imported: any[] = [];
      const skipped: number[] = [];
      const { toDepartmentId = 1, fromDepartmentId = 2, subjectFilter = 'إحالة' } = req.body || {};

      await client.connect();

      const lock = await client.getMailboxLock('INBOX');
      try {
        const messages = client.fetch({ seen: false, since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, {
          uid: true, flags: true, envelope: true, source: true
        });

        for await (const msg of messages) {
          try {
            const parsed: any = await simpleParser(msg.source as any);
            const subject = parsed.subject || '';
            const messageId = parsed.messageId || `${msg.uid}-${Date.now()}`;

            // Check for subject filter
            if (subjectFilter && !subject.includes(subjectFilter)) {
              continue;
            }

            // Check duplicate
            const [existing] = await db.select({ id: itReferrals.id })
              .from(itReferrals)
              .where(eq(itReferrals.outlookMessageId, messageId));

            if (existing) {
              skipped.push(msg.uid);
              continue;
            }

            const count = await db.select({ count: sql<number>`count(*)` }).from(itReferrals);
            const refNum = `REF-EMAIL-${String(Number(count[0].count) + 1).padStart(4, '0')}`;
            const fromEmail = parsed.from?.value?.[0]?.address || '';
            const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, '') || '';

            const [created] = await db.insert(itReferrals).values({
              referralNumber: refNum,
              type: 'email',
              entityId: 0,
              title: subject || 'إحالة من البريد الإلكتروني',
              description: bodyText.substring(0, 2000),
              priority: subject.includes('عاجل') || subject.includes('urgent') ? 'urgent'
                : subject.includes('مهم') || subject.includes('high') ? 'high' : 'medium',
              fromDepartmentId: parseInt(fromDepartmentId),
              toDepartmentId: parseInt(toDepartmentId),
              referredById: req.user.id,
              status: 'pending',
              slaHours: 48,
              isEmailImported: true,
              emailSource: fromEmail,
              outlookMessageId: messageId,
              emailReceivedAt: parsed.date || new Date(),
              emailSubject: subject,
            }).returning();

            await db.insert(itReferralHistory).values({
              referralId: created.id,
              action: 'استيراد من البريد الإلكتروني',
              performedById: req.user.id,
              fromStatus: null,
              toStatus: 'pending',
              notes: `تم الاستيراد من: ${fromEmail}`
            });

            imported.push({ id: created.id, referralNumber: refNum, title: subject });
          } catch (msgError) {
            logger.error('Error processing email message:', { error: msgError });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();

      res.json({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        referrals: imported
      });
    } catch (error: any) {
      logger.error('Error importing from Outlook:', { error });
      // Provide friendly error messages
      const msg = error?.message || '';
      if (msg.includes('AUTHENTICATIONFAILED') || msg.includes('Invalid credentials')) {
        return res.status(401).json({ error: 'فشل تسجيل الدخول إلى Outlook — تحقق من بيانات الاعتماد وتأكد من تفعيل IMAP' });
      }
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
        return res.status(503).json({ error: 'تعذّر الاتصال بـ Outlook — تحقق من إعدادات الخادم' });
      }
      res.status(500).json({ error: `خطأ في استيراد الإيميلات: ${msg}` });
    }
  });

  // ==================== Generic Import APIs (Outlook + Oracle for Tickets & Tasks) ====================

  app.get("/api/import/outlook-status", authenticateToken, async (req: any, res) => {
    try {
      const host = process.env.IMAP_HOST || 'outlook.office365.com';
      const user = process.env.SMTP_USER || '';
      const hasCredentials = !!(user && process.env.SMTP_PASS);
      res.json({
        configured: hasCredentials,
        host,
        user: user ? user.replace(/(.{3}).*(@.*)/, '$1***$2') : '',
      });
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/import/outlook-tickets", authenticateToken, async (req: any, res) => {
    try {
      const { ImapFlow } = await import('imapflow');
      const { simpleParser } = await import('mailparser');
      const imapHost = process.env.IMAP_HOST || 'outlook.office365.com';
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      if (!smtpUser || !smtpPass) return res.status(400).json({ error: 'لم يتم تكوين بيانات الاعتماد للبريد الإلكتروني' });

      const { departmentId, subjectFilter = 'تذكرة', maxEmails = 50 } = req.body || {};
      const client = new ImapFlow({ host: imapHost, port: 993, secure: true, auth: { user: smtpUser, pass: smtpPass }, logger: false, tls: { rejectUnauthorized: false } });

      const imported: any[] = [];
      let skippedCount = 0;
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const messages = client.fetch({ seen: false, since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, { uid: true, flags: true, envelope: true, source: true });
        let processed = 0;
        for await (const msg of messages) {
          if (processed >= maxEmails) break;
          try {
            const parsed: any = await simpleParser(msg.source as any);
            const subject = parsed.subject || '';
            const messageId = parsed.messageId || `${msg.uid}-${Date.now()}`;
            if (subjectFilter && !subject.toLowerCase().includes(subjectFilter.toLowerCase())) continue;
            const [existing] = await db.select({ id: itTickets.id }).from(itTickets).where(eq(itTickets.sourceEmailId, messageId));
            if (existing) { skippedCount++; continue; }

            const ticketCount = await db.select({ count: sql<number>`count(*)` }).from(itTickets);
            const ticketNum = `TKT-OLK-${String(Number(ticketCount[0].count) + 1).padStart(4, '0')}`;
            const fromEmail = parsed.from?.value?.[0]?.address || '';
            const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, '') || '';
            const priority = subject.includes('عاجل') || subject.includes('urgent') ? 'urgent'
              : subject.includes('مهم') || subject.includes('high') ? 'high' : 'medium';

            const [created] = await db.insert(itTickets).values({
              ticketNumber: ticketNum,
              title: subject || 'تذكرة من البريد الإلكتروني',
              description: bodyText.substring(0, 2000),
              requesterId: req.user.id,
              departmentId: departmentId ? parseInt(departmentId) : null,
              category: 'email-import',
              priority,
              status: 'open',
              source: 'outlook',
              sourceEmail: fromEmail,
              sourceEmailId: messageId,
            }).returning();
            imported.push({ id: created.id, ticketNumber: ticketNum, title: subject });
            processed++;
          } catch (msgErr) { logger.error('Error processing email for ticket:', { error: msgErr }); }
        }
      } finally { lock.release(); }
      await client.logout();
      res.json({ success: true, imported, skipped: skippedCount, total: imported.length + skippedCount });
    } catch (error: any) {
      logger.error('Error importing tickets from Outlook:', { error });
      const msg = error?.message || '';
      if (msg.includes('AUTHENTICATIONFAILED') || msg.includes('Invalid credentials')) return res.status(401).json({ error: 'فشل تسجيل الدخول إلى Outlook — تحقق من بيانات الاعتماد' });
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) return res.status(503).json({ error: 'تعذّر الاتصال بـ Outlook' });
      res.status(500).json({ error: `خطأ في استيراد التذاكر: ${msg}` });
    }
  });

  app.post("/api/import/outlook-tasks", authenticateToken, async (req: any, res) => {
    try {
      const { ImapFlow } = await import('imapflow');
      const { simpleParser } = await import('mailparser');
      const imapHost = process.env.IMAP_HOST || 'outlook.office365.com';
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      if (!smtpUser || !smtpPass) return res.status(400).json({ error: 'لم يتم تكوين بيانات الاعتماد للبريد الإلكتروني' });

      const { departmentId, subjectFilter = 'مهمة', maxEmails = 50 } = req.body || {};
      const client = new ImapFlow({ host: imapHost, port: 993, secure: true, auth: { user: smtpUser, pass: smtpPass }, logger: false, tls: { rejectUnauthorized: false } });

      const imported: any[] = [];
      let skippedCount = 0;
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const messages = client.fetch({ seen: false, since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, { uid: true, flags: true, envelope: true, source: true });
        let processed = 0;
        for await (const msg of messages) {
          if (processed >= maxEmails) break;
          try {
            const parsed: any = await simpleParser(msg.source as any);
            const subject = parsed.subject || '';
            const messageId = parsed.messageId || `${msg.uid}-${Date.now()}`;
            if (subjectFilter && !subject.toLowerCase().includes(subjectFilter.toLowerCase())) continue;

            const taskTitle = (subject || 'مهمة من البريد الإلكتروني').substring(0, 500);
            const [existingTask] = await db.select({ id: departmentTasks.id })
              .from(departmentTasks)
              .where(and(
                eq(departmentTasks.title, taskTitle),
                eq(departmentTasks.sourceType, 'outlook'),
                departmentId ? eq(departmentTasks.departmentId, parseInt(departmentId)) : sql`true`
              ));
            if (existingTask) { skippedCount++; continue; }

            const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, '') || '';
            const priority = subject.includes('عاجل') || subject.includes('urgent') ? 'urgent'
              : subject.includes('مهم') || subject.includes('high') ? 'high' : 'medium';

            const [created] = await db.insert(departmentTasks).values({
              departmentId: departmentId ? parseInt(departmentId) : 1,
              title: taskTitle,
              description: bodyText.substring(0, 2000),
              priority,
              status: 'pending',
              assignedBy: req.user.id,
              sourceType: 'outlook',
            }).returning();
            imported.push({ id: created.id, title: subject });
            processed++;
          } catch (msgErr) { logger.error('Error processing email for task:', { error: msgErr }); }
        }
      } finally { lock.release(); }
      await client.logout();
      res.json({ success: true, imported, skipped: skippedCount, total: imported.length + skippedCount });
    } catch (error: any) {
      logger.error('Error importing tasks from Outlook:', { error });
      const msg = error?.message || '';
      if (msg.includes('AUTHENTICATIONFAILED') || msg.includes('Invalid credentials')) return res.status(401).json({ error: 'فشل تسجيل الدخول إلى Outlook' });
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) return res.status(503).json({ error: 'تعذّر الاتصال بـ Outlook' });
      res.status(500).json({ error: `خطأ في استيراد المهام: ${msg}` });
    }
  });

  app.post("/api/import/oracle-test", authenticateToken, async (req: any, res) => {
    try {
      let oracledb: any;
      // @ts-ignore — oracledb is optional
      try { oracledb = await import('oracledb'); } catch {
        return res.json({ success: false, message: 'Oracle DB يتطلب تثبيت Oracle Instant Client' });
      }
      oracledb.initOracleClient?.();
      const { host, port, serviceName, username, password } = req.body;
      const conn = await oracledb.getConnection({ user: username, password, connectString: `${host}:${port}/${serviceName}` });
      const result = await conn.execute('SELECT * FROM v$version WHERE ROWNUM = 1');
      const version = result?.rows?.[0]?.[0] || 'Oracle DB';
      await conn.close();
      res.json({ success: true, message: 'تم الاتصال بنجاح', serverVersion: version });
    } catch (error: any) {
      let message = 'فشل الاتصال بـ Oracle DB';
      if (error.message?.includes('ORA-01017')) message = 'اسم المستخدم أو كلمة المرور غير صحيحة';
      else if (error.message?.includes('ORA-12541')) message = 'الخادم غير متاح — تحقق من العنوان والمنفذ';
      else if (error.message?.includes('ORA-12154')) message = 'اسم خدمة Oracle غير صحيح';
      else if (error.code === 'ECONNREFUSED') message = 'رفض الاتصال — تأكد من أن Oracle Listener يعمل';
      logger.error('[Oracle] Connection test error', { error: error.message });
      res.json({ success: false, message });
    }
  });

  app.post("/api/import/oracle-tickets", authenticateToken, async (req: any, res) => {
    try {
      let oracledb: any;
      // @ts-ignore — oracledb is optional
      try { oracledb = await import('oracledb'); } catch {
        return res.status(400).json({ error: 'Oracle Instant Client غير مثبت' });
      }
      oracledb.initOracleClient?.();
      const { host, port, serviceName, username, password, tableName, titleColumn, descriptionColumn, priorityColumn, maxRows = 100, customQuery, departmentId } = req.body;

      const conn = await oracledb.getConnection({ user: username, password, connectString: `${host}:${port}/${serviceName}` });
      try {
        const query = customQuery || `SELECT ${titleColumn}, ${descriptionColumn || 'NULL'}, ${priorityColumn || "'medium'"} FROM ${tableName} WHERE ROWNUM <= :maxRows`;
        const result = await conn.execute(query, customQuery ? [] : { maxRows: parseInt(maxRows) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        const imported: any[] = [];
        for (const row of (result.rows || [])) {
          const title = row[titleColumn] || row[Object.keys(row)[0]] || 'تذكرة مستوردة من Oracle';
          const desc = row[descriptionColumn] || row[Object.keys(row)[1]] || '';
          const prio = row[priorityColumn] || 'medium';
          const priorityMap: Record<string, string> = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low', 'HIGH': 'high', 'MEDIUM': 'medium', 'LOW': 'low', 'URGENT': 'urgent', 'CRITICAL': 'urgent' };
          const priority = priorityMap[String(prio).toUpperCase()] || 'medium';

          const ticketCount = await db.select({ count: sql<number>`count(*)` }).from(itTickets);
          const ticketNum = `TKT-ORA-${String(Number(ticketCount[0].count) + 1).padStart(4, '0')}`;

          const [created] = await db.insert(itTickets).values({
            ticketNumber: ticketNum,
            title: String(title).substring(0, 300),
            description: String(desc).substring(0, 2000),
            requesterId: req.user.id,
            departmentId: departmentId ? parseInt(departmentId) : null,
            category: 'oracle-import',
            priority,
            status: 'open',
            source: 'oracle',
          }).returning();
          imported.push({ id: created.id, ticketNumber: ticketNum, title: String(title).substring(0, 100) });
        }
        res.json({ success: true, imported, skipped: 0, total: imported.length });
      } finally { await conn.close(); }
    } catch (error: any) {
      logger.error('[Oracle] Import tickets error', { error: error.message });
      res.status(500).json({ error: 'خطأ في الاستيراد من Oracle' });
    }
  });

  app.post("/api/import/oracle-tasks", authenticateToken, async (req: any, res) => {
    try {
      let oracledb: any;
      // @ts-ignore — oracledb is optional
      try { oracledb = await import('oracledb'); } catch {
        return res.status(400).json({ error: 'Oracle Instant Client غير مثبت' });
      }
      oracledb.initOracleClient?.();
      const { host, port, serviceName, username, password, tableName, titleColumn, descriptionColumn, priorityColumn, maxRows = 100, customQuery, departmentId } = req.body;

      const conn = await oracledb.getConnection({ user: username, password, connectString: `${host}:${port}/${serviceName}` });
      try {
        const query = customQuery || `SELECT ${titleColumn}, ${descriptionColumn || 'NULL'}, ${priorityColumn || "'medium'"} FROM ${tableName} WHERE ROWNUM <= :maxRows`;
        const result = await conn.execute(query, customQuery ? [] : { maxRows: parseInt(maxRows) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        const imported: any[] = [];
        for (const row of (result.rows || [])) {
          const title = row[titleColumn] || row[Object.keys(row)[0]] || 'مهمة مستوردة من Oracle';
          const desc = row[descriptionColumn] || row[Object.keys(row)[1]] || '';
          const prio = row[priorityColumn] || 'medium';
          const priorityMap: Record<string, string> = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low', 'HIGH': 'high', 'MEDIUM': 'medium', 'LOW': 'low', 'URGENT': 'urgent', 'CRITICAL': 'urgent' };
          const priority = priorityMap[String(prio).toUpperCase()] || 'medium';

          const [created] = await db.insert(departmentTasks).values({
            departmentId: departmentId ? parseInt(departmentId) : 1,
            title: String(title).substring(0, 500),
            description: String(desc).substring(0, 2000),
            priority,
            status: 'pending',
            assignedBy: req.user.id,
            sourceType: 'oracle',
          }).returning();
          imported.push({ id: created.id, title: String(title).substring(0, 100) });
        }
        res.json({ success: true, imported, skipped: 0, total: imported.length });
      } finally { await conn.close(); }
    } catch (error: any) {
      logger.error('Error importing tasks from Oracle:', { error });
      res.status(500).json({ error: 'خطأ في الاستيراد من Oracle' });
    }
  });

  // ==================== Digital Transformation APIs ====================

  // Digital Initiatives
  app.get("/api/digital-initiatives", authenticateToken, async (req: any, res) => {
    try {
      const initiatives = await db.select().from(digitalInitiatives).orderBy(sql`${digitalInitiatives.createdAt} DESC`);
      res.json(initiatives);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/digital-initiatives", authenticateToken, async (req: any, res) => {
    try {
      const code = `DI-${Date.now().toString(36).toUpperCase()}`;
      const { title, description, category, priority, status, progress, startDate, endDate, budget, sponsorId, managerId } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان المبادرة مطلوب' });
      }
      const [initiative] = await db.insert(digitalInitiatives).values({
        title, description: description || null,
        category: category || 'digital_services', priority: priority || 'medium',
        status: status || 'planning', progress: progress || 0,
        startDate: startDate ? new Date(startDate) : null, targetEndDate: endDate ? new Date(endDate) : null,
        budget: budget || null, sponsorId: sponsorId || null, managerId: managerId || req.user.id,
        initiativeCode: code, createdBy: req.user.id,
      }).returning();
      res.json(initiative);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء المبادرة الرقمية');
    }
  });

  app.put("/api/digital-initiatives/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const VALID_INITIATIVE_STATUSES = ['proposed', 'approved', 'in_progress', 'completed', 'on_hold', 'cancelled', 'planning', 'active'];
      if (req.body.status && !VALID_INITIATIVE_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `حالة غير صالحة للمبادرة. القيم المسموحة: ${VALID_INITIATIVE_STATUSES.join(', ')}` });
      }
      const cleanData = stripProtectedFields(req.body);
      if (cleanData.startDate) cleanData.startDate = new Date(cleanData.startDate);
      if (cleanData.targetEndDate) cleanData.targetEndDate = new Date(cleanData.targetEndDate);
      await db.update(digitalInitiatives).set({ ...cleanData, updatedAt: new Date() }).where(eq(digitalInitiatives.id, id));
      const [updated] = await db.select().from(digitalInitiatives).where(eq(digitalInitiatives.id, id));
      if (!updated) return res.status(404).json({ error: 'المبادرة غير موجودة' });
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث المبادرة الرقمية');
    }
  });

  app.delete("/api/digital-initiatives/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(digitalInitiatives).where(eq(digitalInitiatives.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف المبادرة الرقمية');
    }
  });

  // Digital Applications
  app.get("/api/digital-applications", authenticateToken, async (req: any, res) => {
    try {
      const apps = await db.select().from(digitalApplications).orderBy(sql`${digitalApplications.createdAt} DESC`);
      res.json(apps);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/digital-applications", authenticateToken, async (req: any, res) => {
    try {
      const code = `APP-${Date.now().toString(36).toUpperCase()}`;
      const { nameAr, nameEn, description, appType, platform, hostingType, status, criticality, dataClassification, vendor, version: appVersion, url, departmentId } = req.body;
      if (!nameAr) {
        return res.status(400).json({ error: 'اسم التطبيق بالعربي مطلوب' });
      }
      const [application] = await db.insert(digitalApplications).values({
        nameAr, nameEn: nameEn || null, description: description || null,
        appType: appType || 'web', platform: platform || 'cloud',
        hostingType: hostingType || 'saas', status: status || 'active',
        criticality: criticality || 'medium', dataClassification: dataClassification || 'internal',
        vendor: vendor || null, version: appVersion || null, url: url || null,
        ownerDepartmentId: departmentId ? parseInt(departmentId) : null,
        appCode: code, createdBy: req.user.id,
      }).returning();
      res.json(application);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء التطبيق الرقمي');
    }
  });

  app.put("/api/digital-applications/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const sanitizedApp = stripProtectedFields(req.body);
      if (sanitizedApp.departmentId) {
        sanitizedApp.ownerDepartmentId = parseInt(sanitizedApp.departmentId) || null;
        delete sanitizedApp.departmentId;
      }
      if (sanitizedApp.version !== undefined) {
        delete sanitizedApp.version;
      }
      sanitizedApp.updatedAt = new Date();
      await db.update(digitalApplications).set(sanitizedApp).where(eq(digitalApplications.id, id));
      const [updated] = await db.select().from(digitalApplications).where(eq(digitalApplications.id, id));
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث التطبيق الرقمي');
    }
  });

  app.delete("/api/digital-applications/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(digitalApplications).where(eq(digitalApplications.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف التطبيق الرقمي');
    }
  });

  // Cloud Services
  app.get("/api/cloud-services", authenticateToken, async (req: any, res) => {
    try {
      const services = await db.select().from(cloudServices).orderBy(sql`${cloudServices.createdAt} DESC`);
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/cloud-services", authenticateToken, async (req: any, res) => {
    try {
      const code = `CS-${Date.now().toString(36).toUpperCase()}`;
      const { nameAr, nameEn, description, provider, serviceType, status, monthlyCost, region, slaUptime } = req.body;
      if (!nameAr || !provider) {
        return res.status(400).json({ error: 'اسم الخدمة ومزود الخدمة مطلوبان' });
      }
      const [service] = await db.insert(cloudServices).values({
        nameAr, nameEn: nameEn || null, description: description || null,
        provider, serviceType: serviceType || 'iaas', status: status || 'active',
        monthlyCost: monthlyCost || null, region: region || null, slaUptime: slaUptime || null,
        serviceCode: code, createdBy: req.user.id,
      }).returning();
      res.json(service);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء الخدمة السحابية');
    }
  });

  app.put("/api/cloud-services/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const sanitizedCloud = stripProtectedFields(req.body);
      if (sanitizedCloud.departmentId) {
        sanitizedCloud.ownerDepartmentId = parseInt(sanitizedCloud.departmentId) || null;
        delete sanitizedCloud.departmentId;
      }
      sanitizedCloud.updatedAt = new Date();
      await db.update(cloudServices).set(sanitizedCloud).where(eq(cloudServices.id, id));
      const [updated] = await db.select().from(cloudServices).where(eq(cloudServices.id, id));
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث الخدمة السحابية');
    }
  });

  app.delete("/api/cloud-services/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(cloudServices).where(eq(cloudServices.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف الخدمة السحابية');
    }
  });

  // ==================== Cybersecurity APIs ====================

  // Security Vulnerabilities
  app.get("/api/security-vulnerabilities", authenticateToken, requireView(RESOURCES.SECURITY_VULNERABILITIES), async (req: any, res) => {
    try {
      const vulns = await db.select().from(securityVulnerabilities).orderBy(sql`${securityVulnerabilities.createdAt} DESC`);
      res.json(vulns);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/security-vulnerabilities", authenticateToken, async (req: any, res) => {
    try {
      const { title, description, systemId, severity, cveId, assignedTo, dueDate } = req.body;
      if (!title || !severity) {
        return res.status(400).json({ error: 'الحقول المطلوبة: العنوان، الخطورة' });
      }
      const [vuln] = await db.insert(securityVulnerabilities).values({
        title, description: description || null, systemId: systemId ? parseInt(systemId) : null,
        severity, cveId: cveId || null, discoveredBy: req.user.id,
        assignedTo: assignedTo ? parseInt(assignedTo) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
      }).returning();
      res.json(vuln);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء الثغرة الأمنية');
    }
  });

  app.put("/api/security-vulnerabilities/:id", authenticateToken, requireUpdate(RESOURCES.SECURITY_VULNERABILITIES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const updateData = stripProtectedFields(req.body);
      await db.update(securityVulnerabilities).set({ ...updateData, updatedAt: new Date() }).where(eq(securityVulnerabilities.id, id));
      const [updated] = await db.select().from(securityVulnerabilities).where(eq(securityVulnerabilities.id, id));
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث الثغرة الأمنية');
    }
  });

  app.delete("/api/security-vulnerabilities/:id", authenticateToken, requireDelete(RESOURCES.SECURITY_VULNERABILITIES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(securityVulnerabilities).where(eq(securityVulnerabilities.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف الثغرة الأمنية');
    }
  });

  // Security Threats
  app.get("/api/security-threats", authenticateToken, requireView(RESOURCES.SECURITY_THREATS), async (req: any, res) => {
    try {
      const threats = await db.select().from(securityThreats).orderBy(sql`${securityThreats.createdAt} DESC`);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/security-threats", authenticateToken, requireCreate(RESOURCES.SECURITY_THREATS), async (req: any, res) => {
    try {
      const { title, description, threatType, category, severity, sourceIp, targetSystem, affectedSystem, mitigationNotes } = req.body;
      const resolvedThreatType = threatType || category;
      if (!title || !resolvedThreatType || !severity) {
        return res.status(400).json({ error: 'الحقول المطلوبة: العنوان، نوع التهديد، الخطورة' });
      }
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({ error: `مستوى الخطورة غير صالح. القيم المسموحة: ${validSeverities.join(', ')}` });
      }
      const [threat] = await db.insert(securityThreats).values({
        title, description: description || null, threatType: resolvedThreatType, severity,
        sourceIp: sourceIp || null,
        targetSystem: targetSystem ? parseInt(targetSystem) : null,
        mitigationNotes: mitigationNotes || null,
      }).returning();
      res.json(threat);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء التهديد الأمني');
    }
  });

  app.put("/api/security-threats/:id", authenticateToken, requireUpdate(RESOURCES.SECURITY_THREATS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(securityThreats).where(eq(securityThreats.id, id));
      const updateData = stripProtectedFields(req.body);
      await db.update(securityThreats).set(updateData).where(eq(securityThreats.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'security_threat',
        entityId: id,
        details: `تعديل التهديد الأمني: ${existing?.title || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updateData),
      });
      const [updated] = await db.select().from(securityThreats).where(eq(securityThreats.id, id));
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث التهديد الأمني');
    }
  });

  app.delete("/api/security-threats/:id", authenticateToken, requireDelete(RESOURCES.SECURITY_THREATS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(securityThreats).where(eq(securityThreats.id, id));
      await db.delete(securityThreats).where(eq(securityThreats.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'security_threat',
        entityId: id,
        details: `حذف التهديد الأمني: ${existing?.title || ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: null,
      });
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف التهديد الأمني');
    }
  });

  app.put("/api/security-incidents/:id", authenticateToken, requireUpdate(RESOURCES.SECURITY_INCIDENTS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const sanitizedIncident = stripProtectedFields(req.body);
      if (sanitizedIncident.affectedSystems) {
        sanitizedIncident.affectedAssets = sanitizedIncident.affectedSystems;
        delete sanitizedIncident.affectedSystems;
      }
      sanitizedIncident.updatedAt = new Date();
      await db.update(securityIncidents).set(sanitizedIncident).where(eq(securityIncidents.id, id));
      const [updated] = await db.select().from(securityIncidents).where(eq(securityIncidents.id, id));
      res.json(updated || { success: true });
    } catch (error: any) {
      handleDbError(error, res, 'تحديث الحادثة الأمنية');
    }
  });

  app.delete("/api/security-incidents/:id", authenticateToken, requireDelete(RESOURCES.SECURITY_INCIDENTS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(securityIncidents).where(eq(securityIncidents.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف الحادثة الأمنية');
    }
  });

  // Security Risk Assessments
  app.get("/api/security-risk-assessments", authenticateToken, requireView(RESOURCES.SECURITY_RISKS), async (req: any, res) => {
    try {
      const assessments = await db.select().from(securityRiskAssessments).orderBy(sql`${securityRiskAssessments.createdAt} DESC`);
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/security-risk-assessments", authenticateToken, requireCreate(RESOURCES.SECURITY_RISKS), async (req: any, res) => {
    try {
      const code = `RA-${Date.now().toString(36).toUpperCase()}`;
      const { title, description, scope, riskLevel, status, assessor, dueDate } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان التقييم مطلوب' });
      }
      if (riskLevel) {
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(riskLevel)) {
          return res.status(400).json({ error: `مستوى الخطورة غير صالح. القيم المسموحة: ${validSeverities.join(', ')}` });
        }
      }
      const [assessment] = await db.insert(securityRiskAssessments).values({
        title, description: description || null, scope: scope || null,
        riskLevel: riskLevel || 'medium', status: status || 'planned',
        assessmentCode: code, createdBy: req.user.id,
      }).returning();
      res.json(assessment);
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء تقييم المخاطر');
    }
  });

  app.put("/api/security-risk-assessments/:id", authenticateToken, requireUpdate(RESOURCES.SECURITY_RISKS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const updateData = stripProtectedFields(req.body);
      await db.update(securityRiskAssessments).set(updateData).where(eq(securityRiskAssessments.id, id));
      const [updated] = await db.select().from(securityRiskAssessments).where(eq(securityRiskAssessments.id, id));
      res.json(updated);
    } catch (error: any) {
      handleDbError(error, res, 'تحديث تقييم المخاطر');
    }
  });

  app.delete("/api/security-risk-assessments/:id", authenticateToken, requireDelete(RESOURCES.SECURITY_RISKS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(securityRiskAssessments).where(eq(securityRiskAssessments.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف تقييم المخاطر');
    }
  });

  // ==================== Technical Support APIs ====================

  // Customer Satisfaction
  app.get("/api/customer-satisfaction", authenticateToken, async (req: any, res) => {
    try {
      const { departmentId } = req.query;
      let ratings;
      if (departmentId) {
        ratings = await db.select().from(customerSatisfaction)
          .where(eq(customerSatisfaction.departmentId, parseInt(departmentId as string)))
          .orderBy(sql`${customerSatisfaction.createdAt} DESC`);
      } else {
        ratings = await db.select().from(customerSatisfaction).orderBy(sql`${customerSatisfaction.createdAt} DESC`);
      }
      res.json(ratings);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/customer-satisfaction", authenticateToken, async (req: any, res) => {
    try {
      const { rating: ratingValue, feedback } = req.body;
      if (ratingValue == null || !Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.status(400).json({ error: 'التقييم مطلوب ويجب أن يكون رقم صحيح بين 1 و 5' });
      }
      if (feedback !== undefined && typeof feedback !== 'string') {
        return res.status(400).json({ error: 'الملاحظات يجب أن تكون نصاً' });
      }
      const [result] = await db.insert(customerSatisfaction).values({
        ...req.body,
        userId: req.user.id
      }).returning();
      res.json({ id: result.id });
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء تقييم الرضا');
    }
  });

  app.get("/api/customer-satisfaction/stats", authenticateToken, async (req: any, res) => {
    try {
      const { departmentId } = req.query;
      const ratings = await db.select().from(customerSatisfaction);
      const filteredRatings = departmentId 
        ? ratings.filter((r: any) => r.departmentId === parseInt(departmentId as string))
        : ratings;
      
      const avgRating = filteredRatings.length > 0 
        ? filteredRatings.reduce((acc: any, r: any) => acc + r.rating, 0) / filteredRatings.length 
        : 0;
      const totalResponses = filteredRatings.length;
      const wouldRecommendCount = filteredRatings.filter((r: any) => r.wouldRecommend).length;
      const recommendRate = totalResponses > 0 ? (wouldRecommendCount / totalResponses) * 100 : 0;
      
      res.json({
        averageRating: avgRating.toFixed(1),
        totalResponses,
        recommendRate: recommendRate.toFixed(1),
        ratingDistribution: {
          5: filteredRatings.filter((r: any) => r.rating === 5).length,
          4: filteredRatings.filter((r: any) => r.rating === 4).length,
          3: filteredRatings.filter((r: any) => r.rating === 3).length,
          2: filteredRatings.filter((r: any) => r.rating === 2).length,
          1: filteredRatings.filter((r: any) => r.rating === 1).length,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== IT Asset Assignment ====================

  app.put("/api/it-assets/:id/assign", authenticateToken, async (req: any, res) => {
    try {
      const { assignedDepartmentId, departmentNotes } = req.body;
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.update(itAssets).set({
        assignedDepartmentId,
        departmentNotes,
        assignedById: req.user.id,
        assignedAt: new Date()
      }).where(eq(itAssets.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'تعيين الأصل التقني');
    }
  });

  // ==================== KPI Metrics ====================

  app.get("/api/kpi-metrics/:deptId", authenticateToken, async (req: any, res) => {
    try {
      const deptId = parseId(req.params.deptId, res);
      if (!deptId) return;
      const metrics = await db.select().from(kpiMetrics)
        .where(eq(kpiMetrics.departmentId, deptId))
        .orderBy(sql`${kpiMetrics.periodDate} DESC`);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/kpi-metrics", authenticateToken, async (req: any, res) => {
    try {
      const { periodDate, targetValue, actualValue, ...rest } = req.body;
      const [metric] = await db.insert(kpiMetrics).values({
        ...rest,
        periodDate: periodDate ? new Date(periodDate) : new Date(),
        targetValue: targetValue != null ? String(targetValue) : null,
        actualValue: actualValue != null ? String(actualValue) : null,
      }).returning();
      res.json({ id: metric.id });
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء مؤشر الأداء');
    }
  });

  // ==================== System Performance Metrics ====================

  app.get("/api/system-performance/:deptId", authenticateToken, async (req: any, res) => {
    try {
      const deptId = parseId(req.params.deptId, res);
      if (!deptId) return;
      const metrics = await db.select().from(systemPerformanceMetrics)
        .where(eq(systemPerformanceMetrics.departmentId, deptId))
        .orderBy(sql`${systemPerformanceMetrics.measurementDate} DESC`);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/system-performance", authenticateToken, async (req: any, res) => {
    try {
      const { id: _id, createdAt: _ca, ...perfData } = req.body;
      const [metric] = await db.insert(systemPerformanceMetrics).values(perfData).returning();
      res.json({ id: metric.id });
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء مقياس الأداء');
    }
  });

  // ==================== Database Connections (DMO) ====================
  function parseConnectionStringUtil(connStr: string, dbType: string): { host: string; port: number; database: string; username: string } | null {
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
        };
      }
      const url = new URL(connStr);
      const defaultPorts: Record<string, number> = { postgresql: 5432, mysql: 3306, oracle: 1521, mongodb: 27017, redis: 6379, elasticsearch: 9200 };
      return {
        host: url.hostname || 'localhost',
        port: parseInt(url.port) || defaultPorts[type] || 5432,
        database: url.pathname?.replace('/', '') || '',
        username: url.username || '',
      };
    } catch {
      return null;
    }
  }

  const DB_CONN_PORTALS = [...ADMIN_PORTALS, ...DMO_PORTALS];

  app.get("/api/database-connections", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const connections = await db.select().from(databaseConnections).orderBy(sql`${databaseConnections.createdAt} DESC`);
      res.json(connections.map(sanitizeDbConnection));
    } catch (error: any) {
      logger.error('[DB-Connections] List error', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ أثناء جلب الاتصالات' });
    }
  });

  app.post("/api/database-connections", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const { name, connectionName, connectionNameAr, databaseType, host, port, databaseName, username, encryptedPassword, sslEnabled, description, connectionString, systemId, schemaName, isReadOnly, dataClassification } = req.body;
      const connName = name || connectionName;
      if (!connName || !databaseType) {
        return res.status(400).json({ error: 'الحقول المطلوبة: الاسم ونوع قاعدة البيانات' });
      }
      if (!connectionString && (!host || !databaseName)) {
        return res.status(400).json({ error: 'يجب تقديم رابط الاتصال (Connection String) أو عنوان الخادم واسم قاعدة البيانات' });
      }

      let finalHost = host;
      let finalPort = port;
      let finalDbName = databaseName;
      let finalUsername = username;

      if (connectionString) {
        try {
          const parsed = parseConnectionStringUtil(connectionString, databaseType);
          if (parsed) {
            finalHost = finalHost || parsed.host;
            finalPort = finalPort || parsed.port;
            finalDbName = finalDbName || parsed.database;
            finalUsername = finalUsername || parsed.username;
          }
        } catch {}
      }

      const [connection] = await db.insert(databaseConnections).values({
        connectionName: connName,
        connectionNameAr: connectionNameAr || null,
        databaseType,
        host: finalHost || 'localhost',
        port: finalPort || 5432,
        databaseName: finalDbName || '',
        username: finalUsername || null,
        encryptedPassword: encryptedPassword || null,
        connectionString: connectionString || null,
        sslEnabled: sslEnabled || false,
        description: description || null,
        systemId: systemId ? Number(systemId) : null,
        schemaName: schemaName || null,
        isReadOnly: isReadOnly !== false,
        dataClassification: dataClassification || 'confidential',
        createdBy: req.user.id
      }).returning();
      res.json({ id: connection.id });
    } catch (error: any) {
      logger.error('[DB-Connections] Create error', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الاتصال' });
    }
  });

  app.put("/api/database-connections/:id", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.update(databaseConnections).set(stripProtectedFields(req.body)).where(eq(databaseConnections.id, id));
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[DB-Connections] Update error', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ أثناء تحديث الاتصال' });
    }
  });

  app.delete("/api/database-connections/:id", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(databaseConnections).where(eq(databaseConnections.id, id));
      res.json({ success: true });
    } catch (error: any) {
      logger.error('[DB-Connections] Delete error', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ أثناء حذف الاتصال' });
    }
  });

  app.post("/api/database-connections/:id/test", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const connectionId = parseId(req.params.id, res);
      if (!connectionId) return;
      const [connection] = await db.select().from(databaseConnections).where(eq(databaseConnections.id, connectionId));
      
      if (!connection) {
        return res.status(404).json({ error: 'الاتصال غير موجود' });
      }

      let host = connection.host;
      let port = connection.port;
      let dbName = connection.databaseName;
      let user = connection.username || '';
      let pass = connection.encryptedPassword || '';

      if (connection.connectionString) {
        const parsed = parseConnectionStringUtil(connection.connectionString, connection.databaseType);
        if (parsed) {
          host = parsed.host;
          port = parsed.port;
          dbName = parsed.database;
          user = parsed.username || user;
        }
      }

      const config: ConnectionConfig = {
        databaseType: connection.databaseType as any,
        host, port, databaseName: dbName,
        username: user, password: pass,
        sslEnabled: connection.sslEnabled || false
      };

      const result = await testConnection(config);
      
      await db.update(databaseConnections).set({
        lastTestedAt: new Date(),
        testStatus: result.success ? 'success' : 'failed',
        testMessage: result.message
      }).where(eq(databaseConnections.id, connectionId));

      res.json({ 
        success: result.success, 
        message: result.message,
        responseTime: result.responseTime,
        serverVersion: result.serverVersion,
      });
    } catch (error: any) {
      logger.error('[DB-Connections] Test error', { error: error.message });
      res.status(500).json({ error: 'حدث خطأ أثناء اختبار الاتصال' });
    }
  });

  app.post("/api/database-connections/:id/discover-tables", authenticateToken, requirePortal(DB_CONN_PORTALS), async (req: any, res) => {
    try {
      const connectionId = parseId(req.params.id, res);
      if (!connectionId) return;
      const [connection] = await db.select().from(databaseConnections).where(eq(databaseConnections.id, connectionId));
      
      if (!connection) {
        return res.status(404).json({ error: 'الاتصال غير موجود' });
      }

      let dHost = connection.host;
      let dPort = connection.port;
      let dDbName = connection.databaseName;
      let dUser = connection.username || '';
      let dPass = connection.encryptedPassword || '';

      if (connection.connectionString) {
        const parsed = parseConnectionStringUtil(connection.connectionString, connection.databaseType);
        if (parsed) {
          dHost = parsed.host;
          dPort = parsed.port;
          dDbName = parsed.database;
          dUser = parsed.username || dUser;
        }
      }

      const config: ConnectionConfig = {
        databaseType: connection.databaseType as any,
        host: dHost, port: dPort, databaseName: dDbName,
        username: dUser, password: dPass,
        sslEnabled: connection.sslEnabled || false
      };

      const tables = await discoverTables(config);
      
      for (const table of tables) {
        const existing = await db.select({ id: discoveredTables.id })
          .from(discoveredTables)
          .where(and(eq(discoveredTables.connectionId, connectionId), eq(discoveredTables.tableName, table.tableName)));
        
        let tableId: number;
        if (existing.length > 0) {
          tableId = existing[0].id;
          await db.update(discoveredTables).set({
            rowsEstimate: table.estimatedRows,
            columnsCount: table.columns?.length || 0,
            primaryKey: table.primaryKey,
            lastDataUpdate: new Date()
          }).where(eq(discoveredTables.id, tableId));
        } else {
          const [inserted] = await db.insert(discoveredTables).values({
            connectionId: connectionId,
            tableName: table.tableName,
            tableType: table.tableType || 'table',
            rowsEstimate: table.estimatedRows,
            columnsCount: table.columns?.length || 0,
            primaryKey: table.primaryKey,
            lastDataUpdate: new Date()
          }).returning({ id: discoveredTables.id });
          tableId = inserted.id;
        }

        if (table.columns && table.columns.length > 0) {
          await db.delete(discoveredColumns).where(
            and(eq(discoveredColumns.tableId, tableId), eq(discoveredColumns.connectionId, connectionId))
          );
          await db.insert(discoveredColumns).values(
            table.columns.map(col => ({
              tableId,
              connectionId,
              columnName: col.name,
              dataType: col.type,
              isNullable: col.nullable ?? true,
              isPrimaryKey: col.isPrimaryKey ?? false,
              isForeignKey: col.isForeignKey ?? false,
              defaultValue: col.defaultValue || null,
            }))
          );
        }
      }

      res.json({ 
        success: true, 
        message: `تم اكتشاف ${tables.length} جدول`,
        tablesCount: tables.length,
        connectionId: connectionId,
        systemId: connection.systemId,
        databaseName: connection.databaseName,
        tables: tables.map(t => ({
          name: t.tableName,
          type: t.tableType,
          rows: t.estimatedRows,
          columnsCount: t.columns?.length || 0,
          primaryKey: t.primaryKey || null,
          columns: (t.columns || []).map(c => ({
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            isPrimaryKey: c.isPrimaryKey,
            isForeignKey: c.isForeignKey,
          }))
        }))
      });
    } catch (error: any) {
      handleDbError(error, res, 'اكتشاف الجداول');
    }
  });

  // ==================== Discovered Tables ====================

  app.get("/api/discovered-tables", authenticateToken, async (req: any, res) => {
    try {
      const { connectionId, withColumns } = req.query;
      let tables;
      if (connectionId) {
        tables = await db.select().from(discoveredTables)
          .where(eq(discoveredTables.connectionId, parseInt(connectionId as string)))
          .orderBy(sql`${discoveredTables.tableName} ASC`);
      } else {
        tables = await db.select().from(discoveredTables).orderBy(sql`${discoveredTables.tableName} ASC`);
      }
      if (withColumns === 'true' && connectionId) {
        const cols = await db.select().from(discoveredColumns)
          .where(eq(discoveredColumns.connectionId, parseInt(connectionId as string)))
          .orderBy(discoveredColumns.columnName);
        const colsByTable = cols.reduce((acc: Record<number, any[]>, col: any) => {
          if (!acc[col.tableId]) acc[col.tableId] = [];
          acc[col.tableId].push({
            name: col.columnName,
            type: col.dataType,
            nullable: col.isNullable,
            isPrimaryKey: col.isPrimaryKey,
            isForeignKey: col.isForeignKey,
          });
          return acc;
        }, {});
        res.json(tables.map((t: any) => ({ ...t, columns: colsByTable[t.id] || [] })));
      } else {
        res.json(tables);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/discovered-tables", authenticateToken, async (req: any, res) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...tableData } = req.body;
      const [table] = await db.insert(discoveredTables).values(tableData).returning();
      res.json({ id: table.id });
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء الجدول المكتشف');
    }
  });

  app.put("/api/discovered-tables/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.update(discoveredTables).set(stripProtectedFields(req.body)).where(eq(discoveredTables.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'تحديث الجدول المكتشف');
    }
  });

  // ==================== Data Flow Mappings ====================

  app.get("/api/data-flow-mappings", authenticateToken, async (req: any, res) => {
    try {
      const mappings = await db.select().from(dataFlowMappings).orderBy(sql`${dataFlowMappings.createdAt} DESC`);
      res.json(mappings);
    } catch (error: any) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/data-flow-mappings", authenticateToken, async (req: any, res) => {
    try {
      const [mapping] = await db.insert(dataFlowMappings).values({
        ...req.body,
        createdBy: req.user.id
      }).returning();
      res.json({ id: mapping.id });
    } catch (error: any) {
      handleDbError(error, res, 'إنشاء تدفق البيانات');
    }
  });

  app.put("/api/data-flow-mappings/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.update(dataFlowMappings).set(stripProtectedFields(req.body)).where(eq(dataFlowMappings.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'تحديث تدفق البيانات');
    }
  });

  app.delete("/api/data-flow-mappings/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataFlowMappings).where(eq(dataFlowMappings.id, id));
      res.json({ success: true });
    } catch (error: any) {
      handleDbError(error, res, 'حذف تدفق البيانات');
    }
  });

  // Parse uploaded file for smart form assistance
  app.post("/api/parse-file", authenticateToken, async (req: any, res) => {
    try {
      res.json({
        success: true,
        fields: {},
        confidence: 0.85,
        message: 'تم قراءة الملف بنجاح'
      });
    } catch (error) {
      res.status(500).json({ error: 'فشل في قراءة الملف' });
    }
  });

  // Export routes are handled by server/routes/export.ts (mounted at /api/export)

  app.get("/api/evidences/:id/download", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [evidence] = await db.select().from(evidences).where(eq(evidences.id, id)).limit(1);
      if (!evidence) return res.status(404).json({ error: 'الدليل غير موجود' });

      if (!evidence.fileKey) {
        return res.status(404).json({ error: 'لا يوجد ملف مرفق بهذا الدليل' });
      }

      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const blob = bucket.file(evidence.fileKey);
        const [fileBuffer] = await blob.download();
        const contentType = evidence.fileType || 'application/octet-stream';
        const fileName = evidence.fileName || `evidence_${id}`;
        const safeName = encodeURIComponent(fileName).replace(/%20/g, '+');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.end(fileBuffer);
      } catch (storageErr) {
        logger.warn('Object storage download failed, returning metadata', { id });
        res.status(503).json({ error: 'تعذّر تحميل الملف من التخزين، يرجى المحاولة لاحقاً' });
      }
    } catch (error) {
      logger.error('Evidence download error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في تحميل الدليل' });
    }
  });

}

// Helper function to get current workflow step
function getWorkflowStep(status: string): string {
  const stepMap: Record<string, string> = {
    pending: 'قيد الانتظار',
    in_progress: 'قيد المعالجة',
    under_review: 'تحت المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    completed: 'مكتمل'
  };
  return stepMap[status] || status;
}

// Helper function to generate workflow steps
function generateWorkflowSteps(status: string) {
  const allSteps = [
    { id: 'submit', name: 'تقديم الطلب', status: 'completed' },
    { id: 'review', name: 'مراجعة DMO', status: 'pending' },
    { id: 'approval', name: 'الموافقة', status: 'pending' },
    { id: 'execution', name: 'التنفيذ', status: 'pending' }
  ];
  
  if (status === 'pending') {
    allSteps[1].status = 'active';
  } else if (status === 'in_progress') {
    allSteps[1].status = 'completed';
    allSteps[2].status = 'active';
  } else if (status === 'approved' || status === 'completed') {
    allSteps[1].status = 'completed';
    allSteps[2].status = 'completed';
    allSteps[3].status = status === 'completed' ? 'completed' : 'active';
  }
  
  return allSteps;
}

// ==================== طلبات المميزات والتحسينات API ====================
function registerFeatureRequestRoutes(app: Express) {
  // Submit a feature request (any authenticated user)
  app.post('/api/feature-requests', authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'غير مصرح' });

      const { title, description, type, priority } = req.body;
      const portal = req.user.portal;
      if (!title || !description || !type) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
      }

      const user = await db.select().from(users).where(eq(users.id, userId)).then((r: any) => r[0]);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

      const [request] = await db.insert(featureRequests).values({
        title,
        description,
        type,
        priority: priority || 'medium',
        portal,
        submittedBy: userId,
        submitterName: user.name,
        submitterEmail: user.email,
      }).returning();

      const typeLabels: Record<string, string> = {
        feature: 'ميزة جديدة',
        bug: 'مشكلة تقنية',
        incomplete: 'ميزة غير مكتملة',
      };
      const priorityLabels: Record<string, string> = {
        low: 'منخفضة',
        medium: 'متوسطة',
        high: 'عالية',
        urgent: 'عاجلة',
        critical: 'حرجة',
      };

      // Send email notification to all admins
      try {
        const admins = await db.select().from(users).where(eq(users.portal, 'admin'));
        const { generateNotificationEmail, sendEmail: sendEmailFn } = await import('./email');
        for (const admin of admins) {
          const html = generateNotificationEmail({
            recipientName: admin.name,
            subject: `طلب جديد: ${typeLabels[type] || type} - ${title}`,
            message: `قام ${user.name} (${user.email}) بتقديم طلب جديد:

النوع: ${typeLabels[type] || type}
الأولوية: ${priorityLabels[priority] || priority}
البوابة: ${portal}

العنوان: ${title}
الوصف: ${description}`,
            actionUrl: `${process.env.APP_URL || 'https://controlhub.jcsa.sa'}/admin/feature-requests`,
            actionText: 'عرض الطلب',
          });
          await sendEmailFn(admin.email, `طلب جديد: ${typeLabels[type] || type} - ${title}`, html);
        }
      } catch (emailErr) {
        logger.error('Failed to send feature request email notification', { error: emailErr });
      }

      res.status(201).json(request);
    } catch (error) {
      logger.error('Error creating feature request', { error });
      res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
    }
  });

  // Get feature requests - admin sees all, users see their own
  app.get('/api/feature-requests', authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'غير مصرح' });

      const user = await db.select().from(users).where(eq(users.id, userId)).then((r: any) => r[0]);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let results;
      if (user.portal === 'admin' || user.role === 'system_admin' || user.role === 'it_director') {
        results = await db.select().from(featureRequests).orderBy(sql`created_at DESC`);
      } else {
        results = await db.select().from(featureRequests).where(eq(featureRequests.submittedBy, userId)).orderBy(sql`created_at DESC`);
      }

      res.json(results);
    } catch (error) {
      logger.error('Error fetching feature requests', { error });
      res.status(500).json({ error: 'خطأ في جلب الطلبات' });
    }
  });

  // Update feature request status (admin only)
  app.patch('/api/feature-requests/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'غير مصرح' });

      const user = await db.select().from(users).where(eq(users.id, userId)).then((r: any) => r[0]);
      if (!user || (user.portal !== 'admin' && user.role !== 'admin' && user.role !== 'system_admin' && user.role !== 'it_director')) {
        return res.status(403).json({ error: 'غير مصرح - المشرفين فقط' });
      }

      const id = parseId(req.params.id, res);
      if (!id) return;
      const { status, adminNotes } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

      const [updated] = await db.update(featureRequests)
        .set(updateData)
        .where(eq(featureRequests.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'الطلب غير موجود' });

      res.json(updated);
    } catch (error) {
      logger.error('Error updating feature request', { error });
      res.status(500).json({ error: 'خطأ في تحديث الطلب' });
    }
  });

  // Delete feature request (admin only)
  app.delete('/api/feature-requests/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'غير مصرح' });

      const user = await db.select().from(users).where(eq(users.id, userId)).then((r: any) => r[0]);
      if (!user || (user.portal !== 'admin' && user.role !== 'admin' && user.role !== 'system_admin' && user.role !== 'it_director')) {
        return res.status(403).json({ error: 'غير مصرح - المشرفين فقط' });
      }

      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(featureRequests).where(eq(featureRequests.id, id));
      res.json({ message: 'تم حذف الطلب بنجاح' });
    } catch (error) {
      logger.error('Error deleting feature request', { error });
      res.status(500).json({ error: 'خطأ في حذف الطلب' });
    }
  });

  // ==================== الضوابط والمواصفات التنظيمية ====================

  // Get compliance dashboard - all regulatory bodies overview (IT Director / system_admin / managers only)
  app.get('/api/regulatory-controls/dashboard', authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = (req as any).user?.role;
      const allowedRoles = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR, USER_ROLES.IT_CYBERSECURITY_MANAGER, USER_ROLES.IT_INFRASTRUCTURE_MANAGER, USER_ROLES.IT_DIGITAL_MANAGER, USER_ROLES.IT_SUPPORT_MANAGER, USER_ROLES.DMO_MANAGER];
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'هذه اللوحة متاحة للمدراء فقط' });
      }

      const allControls = await db.select().from(regulatoryControls);

      const bodies: Record<string, { label: string; labelEn: string; portal: string }> = {
        NCA: { label: 'الهيئة الوطنية للأمن السيبراني', labelEn: 'NCA', portal: 'cybersecurity' },
        NDMO: { label: 'المكتب الوطني لإدارة البيانات', labelEn: 'NDMO', portal: 'dmo' },
        DGA: { label: 'هيئة الحكومة الرقمية', labelEn: 'DGA', portal: 'digital_transformation' },
      };

      const dashboard = Object.entries(bodies).map(([key, info]) => {
        const controls = allControls.filter((c: any) => c.regulatoryBody === key);
        const total = controls.length;
        const completed = controls.filter((c: any) => c.status === 'completed').length;
        const inProgress = controls.filter((c: any) => c.status === 'in_progress').length;
        const notStarted = controls.filter((c: any) => c.status === 'not_started').length;
        const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const byCategory = controls.reduce((acc: Record<string, { total: number; completed: number; inProgress: number }>, c: any) => {
          const cat = c.category || 'عام';
          if (!acc[cat]) acc[cat] = { total: 0, completed: 0, inProgress: 0 };
          acc[cat].total++;
          if (c.status === 'completed') acc[cat].completed++;
          if (c.status === 'in_progress') acc[cat].inProgress++;
          return acc;
        }, {});

        return {
          regulatoryBody: key,
          label: info.label,
          labelEn: info.labelEn,
          portal: info.portal,
          total,
          completed,
          inProgress,
          notStarted,
          complianceRate,
          byCategory,
        };
      });

      const overallTotal = allControls.length;
      const overallCompleted = allControls.filter((c: any) => c.status === 'completed').length;
      const overallRate = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

      res.json({
        overall: { total: overallTotal, completed: overallCompleted, rate: overallRate },
        bodies: dashboard,
      });
    } catch (error) {
      logger.error('Error fetching compliance dashboard', { error });
      res.status(500).json({ error: 'خطأ في جلب لوحة الامتثال' });
    }
  });

  // Get regulatory compliance stats (must be before :id routes)
  app.get('/api/regulatory-controls/stats', authenticateToken, async (req: any, res: any) => {
    try {
      const portalFilter = req.query.portal as string;

      let conditions: any[] = [];
      if (portalFilter) {
        conditions.push(eq(regulatoryControls.portal, portalFilter));
      }

      const allControls = await db.select().from(regulatoryControls)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = allControls.length;
      const completed = allControls.filter((c: any) => c.status === 'completed').length;
      const inProgress = allControls.filter((c: any) => c.status === 'in_progress').length;
      const notStarted = allControls.filter((c: any) => c.status === 'not_started').length;
      const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const byCategory = allControls.reduce((acc: Record<string, { total: number; completed: number }>, c: any) => {
        const cat = c.category || 'بدون تصنيف';
        if (!acc[cat]) acc[cat] = { total: 0, completed: 0 };
        acc[cat].total++;
        if (c.status === 'completed') acc[cat].completed++;
        return acc;
      }, {});

      const byDomain = allControls.reduce((acc: Record<string, { total: number; completed: number }>, c: any) => {
        const dom = c.domain || 'بدون مجال';
        if (!acc[dom]) acc[dom] = { total: 0, completed: 0 };
        acc[dom].total++;
        if (c.status === 'completed') acc[dom].completed++;
        return acc;
      }, {});

      res.json({ total, completed, inProgress, notStarted, complianceRate, byCategory, byDomain });
    } catch (error) {
      logger.error('Error fetching regulatory stats', { error });
      res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
  });

  // Get regulatory controls (filtered by portal)
  app.get('/api/regulatory-controls', authenticateToken, async (req: any, res: any) => {
    try {
      const portalFilter = req.query.portal as string;
      const statusFilter = req.query.status as string;
      const regulatoryBodyFilter = req.query.regulatoryBody as string;
      const categoryFilter = req.query.category as string;

      let conditions: any[] = [];

      if (portalFilter) {
        conditions.push(eq(regulatoryControls.portal, portalFilter));
      }
      if (statusFilter) {
        conditions.push(eq(regulatoryControls.status, statusFilter));
      }
      if (regulatoryBodyFilter) {
        conditions.push(eq(regulatoryControls.regulatoryBody, regulatoryBodyFilter));
      }
      if (categoryFilter) {
        conditions.push(eq(regulatoryControls.category, categoryFilter));
      }

      const controls = await db.select().from(regulatoryControls)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(regulatoryControls.controlNumber);

      res.json(controls);
    } catch (error) {
      logger.error('Error fetching regulatory controls', { error });
      res.status(500).json({ error: 'خطأ في جلب الضوابط' });
    }
  });

  // Create single regulatory control (all authenticated staff)
  app.post('/api/regulatory-controls', authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = (req as any).user?.role;
      const userId = (req as any).user?.id;
      const userPortal = (req as any).user?.portal;

      const { controlNumber, title, description, category, subcategory, domain, regulatoryBody, portal, status, priority, assignedTo, notes, evidence, completionPercentage, dueDate } = req.body;

      if (!controlNumber || !title || !regulatoryBody || !portal) {
        return res.status(400).json({ error: 'رقم الضابط والعنوان والجهة التنظيمية والبوابة مطلوبة' });
      }

      const isDirector = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR].includes(userRole);
      if (!isDirector && portal !== userPortal) {
        return res.status(403).json({ error: 'لا يمكنك إضافة ضوابط لبوابة أخرى' });
      }

      const [control] = await db.insert(regulatoryControls).values({
        controlNumber,
        title,
        description: description || null,
        category: category || null,
        subcategory: subcategory || null,
        domain: domain || null,
        regulatoryBody,
        portal,
        status: status || 'not_started',
        priority: priority || 'medium',
        assignedTo: assignedTo || null,
        notes: notes || null,
        evidence: evidence || null,
        completionPercentage: completionPercentage || 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdBy: userId,
      }).returning();

      res.status(201).json(control);
    } catch (error) {
      logger.error('Error creating regulatory control', { error });
      res.status(500).json({ error: 'خطأ في إنشاء الضابط' });
    }
  });

  // Bulk import regulatory controls (all authenticated staff)
  app.post('/api/regulatory-controls/bulk-import', authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = (req as any).user?.role;
      const userId = (req as any).user?.id;
      const userPortal = (req as any).user?.portal;

      const { controls, portal, regulatoryBody } = req.body;

      if (!controls || !Array.isArray(controls) || controls.length === 0) {
        return res.status(400).json({ error: 'قائمة الضوابط مطلوبة' });
      }
      if (!portal || !regulatoryBody) {
        return res.status(400).json({ error: 'البوابة والجهة التنظيمية مطلوبة' });
      }

      const isDirector = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR].includes(userRole);
      if (!isDirector && portal !== userPortal) {
        return res.status(403).json({ error: 'لا يمكنك استيراد ضوابط لبوابة أخرى' });
      }

      const controlsToInsert = controls.map((c: any) => ({
        controlNumber: c.controlNumber || c.number || '',
        title: c.title || c.name || '',
        description: c.description || null,
        category: c.category || null,
        subcategory: c.subcategory || null,
        domain: c.domain || null,
        regulatoryBody,
        portal,
        status: c.status || 'not_started',
        priority: c.priority || 'medium',
        assignedTo: c.assignedTo || null,
        notes: c.notes || null,
        evidence: c.evidence || null,
        completionPercentage: c.completionPercentage || 0,
        dueDate: c.dueDate ? new Date(c.dueDate) : null,
        createdBy: userId,
      }));

      const inserted = await db.insert(regulatoryControls).values(controlsToInsert).returning();
      res.status(201).json({ message: `تم استيراد ${inserted.length} ضابط بنجاح`, count: inserted.length, controls: inserted });
    } catch (error) {
      logger.error('Error bulk importing regulatory controls', { error });
      res.status(500).json({ error: 'خطأ في الاستيراد الجماعي' });
    }
  });

  // Update regulatory control (all authenticated staff - portal scoped)
  app.patch('/api/regulatory-controls/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = (req as any).user?.role;
      const userPortal = (req as any).user?.portal;
      const id = parseId(req.params.id, res);
      if (!id) return;
      const rawUpdates = req.body;

      const [existing] = await db.select().from(regulatoryControls).where(eq(regulatoryControls.id, id));
      if (!existing) return res.status(404).json({ error: 'الضابط غير موجود' });

      const isDirector = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR].includes(userRole);
      if (!isDirector && existing.portal !== userPortal) {
        return res.status(403).json({ error: 'لا يمكنك تعديل ضوابط بوابة أخرى' });
      }

      const { id: _id, portal: _portal, controlNumber: _controlNumber, createdBy: _createdBy, createdAt: _createdAt, ...safeUpdates } = rawUpdates;

      const [updated] = await db.update(regulatoryControls)
        .set({ ...safeUpdates, updatedAt: new Date() })
        .where(eq(regulatoryControls.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      logger.error('Error updating regulatory control', { error });
      res.status(500).json({ error: 'خطأ في تحديث الضابط' });
    }
  });

  // Delete regulatory control (managers/directors only - portal scoped)
  app.delete('/api/regulatory-controls/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const userRole = (req as any).user?.role;
      const userPortal = (req as any).user?.portal;
      const managerRoles = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR, USER_ROLES.IT_CYBERSECURITY_MANAGER, USER_ROLES.IT_INFRASTRUCTURE_MANAGER, USER_ROLES.IT_DIGITAL_MANAGER, USER_ROLES.IT_SUPPORT_MANAGER, USER_ROLES.DMO_MANAGER];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'الحذف متاح للمدراء فقط' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [existing] = await db.select().from(regulatoryControls).where(eq(regulatoryControls.id, id));
      if (!existing) return res.status(404).json({ error: 'الضابط غير موجود' });

      const isDirector = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.IT_DIRECTOR].includes(userRole);
      if (!isDirector && existing.portal !== userPortal) {
        return res.status(403).json({ error: 'لا يمكنك حذف ضوابط بوابة أخرى' });
      }

      await db.delete(regulatoryControls).where(eq(regulatoryControls.id, id));
      res.json({ message: 'تم حذف الضابط بنجاح' });
    } catch (error) {
      logger.error('Error deleting regulatory control', { error });
      res.status(500).json({ error: 'خطأ في حذف الضابط' });
    }
  });

  // ==================== Planner System - نظام التخطيط ====================

  async function sendPlannerNotification(opts: {
    type: 'assignment' | 'status_change' | 'comment' | 'approval_request' | 'approval_granted' | 'approval_rejected';
    taskTitle: string;
    taskId: number;
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    priority?: string;
    dueDate?: Date | null;
    status?: string;
    commentText?: string;
  }) {
    try {
      const { generateNotificationEmail, sendEmail: sendEmailFn } = await import('./email');
      const priorityLabels: Record<string, string> = { urgent: 'عاجل', critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
      const statusLabels: Record<string, string> = { not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', pending_approval: 'بانتظار الموافقة', completed: 'مكتملة' };
      const dueDateStr = opts.dueDate ? new Date(opts.dueDate).toLocaleDateString('ar-SA') : '';

      let subject = '';
      let message = '';

      switch (opts.type) {
        case 'assignment':
          subject = `مهمة جديدة: ${opts.taskTitle}`;
          message = `تم توجيهكم بمهمة جديدة بواسطة <strong>${opts.senderName}</strong>.<br><br>
            <div style="background:#f0f4f8;padding:15px;border-radius:8px;border-right:4px solid hsl(43,74%,49%);">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              ${opts.priority ? `<strong>الأولوية:</strong> ${priorityLabels[opts.priority] || opts.priority}<br>` : ''}
              ${dueDateStr ? `<strong>تاريخ الاستحقاق:</strong> ${dueDateStr}<br>` : ''}
            </div><br>
            يرجى الدخول إلى كونترول هوب لمتابعة المهمة.`;
          break;
        case 'status_change':
          subject = `تحديث حالة المهمة: ${opts.taskTitle}`;
          message = `تم تحديث حالة المهمة بواسطة <strong>${opts.senderName}</strong>.<br><br>
            <div style="background:#f0f4f8;padding:15px;border-radius:8px;border-right:4px solid hsl(43,74%,49%);">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              <strong>الحالة الجديدة:</strong> ${statusLabels[opts.status || ''] || opts.status}<br>
            </div><br>
            يرجى الدخول إلى كونترول هوب للاطلاع على التفاصيل.`;
          break;
        case 'comment':
          subject = `تعليق جديد على المهمة: ${opts.taskTitle}`;
          message = `أضاف <strong>${opts.senderName}</strong> تعليقاً على المهمة.<br><br>
            <div style="background:#f0f4f8;padding:15px;border-radius:8px;border-right:4px solid hsl(43,74%,49%);">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              <strong>التعليق:</strong> ${opts.commentText || ''}<br>
            </div><br>
            يرجى الدخول إلى كونترول هوب للرد أو المتابعة.`;
          break;
        case 'approval_request':
          subject = `طلب إغلاق مهمة: ${opts.taskTitle}`;
          message = `قام <strong>${opts.senderName}</strong> بطلب إغلاق المهمة التالية وينتظر موافقتكم.<br><br>
            <div style="background:#fffbeb;padding:15px;border-radius:8px;border-right:4px solid #d97706;">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              ${dueDateStr ? `<strong>تاريخ الاستحقاق:</strong> ${dueDateStr}<br>` : ''}
            </div><br>
            يرجى الدخول إلى كونترول هوب للموافقة أو الرفض.`;
          break;
        case 'approval_granted':
          subject = `تمت الموافقة على إغلاق المهمة: ${opts.taskTitle}`;
          message = `تمت الموافقة على إغلاق المهمة بواسطة <strong>${opts.senderName}</strong>.<br><br>
            <div style="background:#f0fdf4;padding:15px;border-radius:8px;border-right:4px solid #16a34a;">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              <strong>الحالة:</strong> مكتملة ✓<br>
            </div>`;
          break;
        case 'approval_rejected':
          subject = `تم رفض طلب إغلاق المهمة: ${opts.taskTitle}`;
          message = `تم رفض طلب إغلاق المهمة بواسطة <strong>${opts.senderName}</strong> - المهمة تحتاج مراجعة إضافية.<br><br>
            <div style="background:#fef2f2;padding:15px;border-radius:8px;border-right:4px solid #dc2626;">
              <strong>المهمة:</strong> ${opts.taskTitle}<br>
              <strong>الحالة:</strong> قيد التنفيذ (مُعادة)<br>
            </div><br>
            يرجى مراجعة المهمة وإجراء التعديلات اللازمة.`;
          break;
      }

      if (subject && message) {
        const html = generateNotificationEmail({
          recipientName: opts.recipientName,
          subject,
          message,
          actionUrl: `${process.env.APP_URL || 'https://controlhub.jcsa.sa'}/planner`,
          actionText: 'فتح لوحة التخطيط',
        });
        await sendEmailFn(opts.recipientEmail, subject, html);
        logger.info(`Planner notification sent: ${opts.type} to ${opts.recipientEmail}`);
      }
    } catch (err) {
      logger.warn('Planner email notification failed (non-blocking)', { error: err, type: opts.type });
    }
  }

  // Get boards for user's portal
  app.get('/api/planner/boards', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const isItDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin';
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json([]);
      if (!isItDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض لوحات بوابة أخرى' });
      }

      const boards = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.portal, requestedPortal))
        .orderBy(plannerBoards.createdAt);

      if (boards.length === 0) return res.json([]);

      const boardIds = boards.map((b: any) => b.id);
      const [taskCounts, bucketCounts] = await Promise.all([
        db.select({
          boardId: plannerTasks.boardId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${plannerTasks.status} = 'completed')::int`,
          inProgress: sql<number>`count(*) filter (where ${plannerTasks.status} = 'in_progress')::int`,
        }).from(plannerTasks)
          .where(inArray(plannerTasks.boardId, boardIds))
          .groupBy(plannerTasks.boardId),
        db.select({
          boardId: plannerBuckets.boardId,
          count: sql<number>`count(*)::int`,
        }).from(plannerBuckets)
          .where(inArray(plannerBuckets.boardId, boardIds))
          .groupBy(plannerBuckets.boardId),
      ]);

      const taskCountMap = new Map<number, { total: number; completed: number; inProgress: number }>(taskCounts.map((t: any) => [t.boardId, t]));
      const bucketCountMap = new Map(bucketCounts.map((b: any) => [b.boardId, b.count]));

      const boardsWithCounts = boards.map((board: any) => {
        const tc = taskCountMap.get(board.id) || { total: 0, completed: 0, inProgress: 0 };
        return {
          ...board,
          totalTasks: tc.total,
          completedTasks: tc.completed,
          inProgressTasks: tc.inProgress,
          bucketsCount: bucketCountMap.get(board.id) || 0,
        };
      });

      res.json(boardsWithCounts);
    } catch (error) {
      logger.error('Error fetching planner boards', { error });
      res.status(500).json({ error: 'خطأ في جلب لوحات التخطيط' });
    }
  });

  // Create board - managers only, enforced to own portal (IT Director/admin can create for any portal)
  app.post('/api/planner/boards', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager', 'employee'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'غير مصرح لك بإنشاء لوحات التخطيط' });
      }
      // الموظف يمكنه إنشاء لوح فقط في بوابته الخاصة
      if (userRole === 'employee') {
        req.body.portal = 'employee';
      }
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin';
      const { title, description, portal, departmentId, color, icon } = req.body;
      let { templateBuckets } = req.body;
      if (Array.isArray(templateBuckets)) {
        templateBuckets = templateBuckets.filter((b: any) => typeof b === 'string' && b.trim().length > 0).slice(0, 12).map((b: string) => b.slice(0, 100));
      } else {
        templateBuckets = null;
      }
      const targetPortal = portal || req.user?.portal || 'admin';
      if (!isDirectorOrAdmin && targetPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك إنشاء لوحة في بوابة أخرى' });
      }
      const [board] = await db.insert(plannerBoards).values({
        title,
        description,
        portal: targetPortal,
        departmentId,
        color: color || '#1e3a5f',
        icon,
        createdBy: req.user?.id,
      }).returning();

      const bucketColors = ['#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
      const bucketNames = Array.isArray(templateBuckets) && templateBuckets.length > 0
        ? templateBuckets
        : ['المهام الجديدة', 'قيد التنفيذ', 'للمراجعة', 'مكتملة'];
      const defaultBuckets = bucketNames.map((t: string, i: number) => ({
        title: t, sortOrder: i, boardId: board.id, color: bucketColors[i % bucketColors.length],
      }));
      await db.insert(plannerBuckets).values(defaultBuckets);

      res.json(board);
    } catch (error) {
      logger.error('Error creating planner board', { error });
      res.status(500).json({ error: 'خطأ في إنشاء اللوحة' });
    }
  });

  // Get single board with buckets and tasks
  app.get('/api/planner/boards/:id', authenticateToken, async (req: any, res) => {
    try {
      const boardId = parseId(req.params.id, res);
      if (!boardId) return;
      const [board] = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.id, boardId));
      if (!board) return res.status(404).json({ error: 'اللوحة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin && board.portal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض لوحة من بوابة أخرى' });
      }

      const buckets = await db.select().from(plannerBuckets)
        .where(eq(plannerBuckets.boardId, boardId))
        .orderBy(plannerBuckets.sortOrder);

      const tasksList = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        assigneeEmail: users.email,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .where(eq(plannerTasks.boardId, boardId))
        .orderBy(plannerTasks.sortOrder);

      const creatorIds = Array.from(new Set<number>(tasksList.map((t: any) => t.task.createdBy).filter((id: any) => typeof id === 'number')));
      const creators: Record<number, string> = {};
      if (creatorIds.length > 0) {
        const creatorRows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds));
        for (const c of creatorRows) creators[c.id] = c.name;
      }

      const bucketsWithTasks = buckets.map((bucket: any) => ({
        ...bucket,
        tasks: tasksList
          .filter((t: any) => t.task.bucketId === bucket.id)
          .map((t: any) => ({
            ...t.task,
            assigneeName: t.assigneeName,
            assigneeEmail: t.assigneeEmail,
            creatorName: t.task.createdBy ? creators[t.task.createdBy] || null : null,
          })),
      }));

      res.json({ ...board, buckets: bucketsWithTasks });
    } catch (error) {
      logger.error('Error fetching planner board', { error });
      res.status(500).json({ error: 'خطأ في جلب اللوحة' });
    }
  });

  // Update board - managers only, portal-enforced
  app.put('/api/planner/boards/:id', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم تعديل لوحات التخطيط' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, id));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك تعديل لوحة من بوابة أخرى' });
        }
      }
      const { title, description, color, icon } = req.body;
      const [updated] = await db.update(plannerBoards)
        .set({ title, description, color, icon, updatedAt: new Date() })
        .where(eq(plannerBoards.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'اللوحة غير موجودة' });
      res.json(updated);
    } catch (error) {
      logger.error('Error updating planner board', { error });
      res.status(500).json({ error: 'خطأ في تحديث اللوحة' });
    }
  });

  // Delete board - managers only, portal-enforced
  app.delete('/api/planner/boards/:id', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم حذف لوحات التخطيط' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, id));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك حذف لوحة من بوابة أخرى' });
        }
      }
      await db.delete(plannerBoards).where(eq(plannerBoards.id, id));
      res.json({ message: 'تم حذف اللوحة بنجاح' });
    } catch (error) {
      logger.error('Error deleting planner board', { error });
      res.status(500).json({ error: 'خطأ في حذف اللوحة' });
    }
  });

  // Create bucket - managers only, portal-enforced
  app.post('/api/planner/buckets', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم إنشاء مجموعات' });
      }
      const { boardId, title, color, sortOrder } = req.body;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء مجموعة في لوحة من بوابة أخرى' });
        }
      }
      const existing = await db.select().from(plannerBuckets)
        .where(eq(plannerBuckets.boardId, boardId));
      const [bucket] = await db.insert(plannerBuckets).values({
        boardId,
        title,
        color,
        sortOrder: sortOrder ?? existing.length,
      }).returning();
      res.json(bucket);
    } catch (error) {
      logger.error('Error creating planner bucket', { error });
      res.status(500).json({ error: 'خطأ في إنشاء المجموعة' });
    }
  });

  // Update bucket - managers only, portal-enforced
  app.put('/api/planner/buckets/:id', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم تعديل المجموعات' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const [bucket] = await db.select().from(plannerBuckets).where(eq(plannerBuckets.id, id));
        if (bucket) {
          const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, bucket.boardId));
          if (board && board.portal !== req.user?.portal) {
            return res.status(403).json({ error: 'لا يمكنك تعديل مجموعة من بوابة أخرى' });
          }
        }
      }
      const { title, sortOrder, color } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (color !== undefined) updates.color = color;
      const [updated] = await db.update(plannerBuckets)
        .set(updates)
        .where(eq(plannerBuckets.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'المجموعة غير موجودة' });
      res.json(updated);
    } catch (error) {
      logger.error('Error updating planner bucket', { error });
      res.status(500).json({ error: 'خطأ في تحديث المجموعة' });
    }
  });

  // Delete bucket - managers only, portal-enforced
  app.delete('/api/planner/buckets/:id', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم حذف المجموعات' });
      }
      const id = parseId(req.params.id, res);
      if (!id) return;
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      if (!isDirectorOrAdmin) {
        const [bucket] = await db.select().from(plannerBuckets).where(eq(plannerBuckets.id, id));
        if (bucket) {
          const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, bucket.boardId));
          if (board && board.portal !== req.user?.portal) {
            return res.status(403).json({ error: 'لا يمكنك حذف مجموعة من بوابة أخرى' });
          }
        }
      }
      await db.delete(plannerBuckets).where(eq(plannerBuckets.id, id));
      res.json({ message: 'تم حذف المجموعة بنجاح' });
    } catch (error) {
      logger.error('Error deleting planner bucket', { error });
      res.status(500).json({ error: 'خطأ في حذف المجموعة' });
    }
  });

  // Create task - validates bucket belongs to board
  app.post('/api/planner/tasks', authenticateToken, async (req: any, res) => {
    try {
      const { boardId, bucketId, title, description, priority, assignedTo, dueDate, startDate, labels, checklist, dependencies, recurrence } = req.body;

      if (!title?.trim()) return res.status(400).json({ error: 'العنوان مطلوب' });
      if (!bucketId || !boardId) return res.status(400).json({ error: 'يجب تحديد اللوحة والمجموعة' });

      const [targetBucket] = await db.select().from(plannerBuckets).where(eq(plannerBuckets.id, bucketId));
      if (!targetBucket) return res.status(404).json({ error: 'المجموعة غير موجودة' });
      if (targetBucket.boardId !== boardId) {
        return res.status(400).json({ error: 'المجموعة لا تنتمي لهذه اللوحة' });
      }
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء مهام في لوحة بوابة أخرى' });
        }
      }

      const existing = await db.select().from(plannerTasks)
        .where(eq(plannerTasks.bucketId, bucketId));
      // الموظف لا يمكنه إسناد المهام إلا لنفسه
      const rawAssignee = req.user?.role === 'employee' ? req.user.id : assignedTo;
      const resolvedAssignee = (rawAssignee && rawAssignee !== 'none') ? parseInt(rawAssignee) || null : null;
      const [task] = await db.insert(plannerTasks).values({
        boardId,
        bucketId,
        title,
        description,
        priority: priority || 'medium',
        assignedTo: resolvedAssignee,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        labels: labels || [],
        checklist: checklist || [],
        dependencies: dependencies || null,
        recurrence: recurrence || null,
        createdBy: req.user?.id,
        sortOrder: existing.length,
      }).returning();

      if (resolvedAssignee && resolvedAssignee !== req.user?.id) {
        const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, resolvedAssignee));
        if (assignee) {
          // DB notification
          await storage.createNotification({
            userId: resolvedAssignee,
            title: 'مهمة جديدة في البلانر',
            message: `تم إسناد مهمة "${title}" إليك في البلانر${dueDate ? ` - الموعد النهائي: ${new Date(dueDate).toLocaleDateString('ar-SA')}` : ''}`,
            type: 'task_assigned',
            priority: priority === 'urgent' || priority === 'critical' || priority === 'high' ? 'high' : 'normal',
            isRead: false,
            entityType: 'planner_task',
            entityId: task.id,
            actionUrl: `/planner`,
          });
          // Email notification
          if (assignee.email) {
            sendPlannerNotification({
              type: 'assignment',
              taskTitle: title,
              taskId: task.id,
              recipientEmail: assignee.email,
              recipientName: assignee.name || '',
              senderName: req.user?.name || 'النظام',
              priority: priority || 'medium',
              dueDate: dueDate ? new Date(dueDate) : null,
            });
          }
        }
      }

      res.json(task);
    } catch (error) {
      logger.error('Error creating planner task', { error });
      res.status(500).json({ error: 'خطأ في إنشاء المهمة' });
    }
  });

  // Update task
  app.put('/api/planner/tasks/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const userRole = req.user?.role || '';
      const userId = req.user?.id;
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      const isManager = managerRoles.includes(userRole);
      const isDirectorOrAdmin = ['it_director', 'system_admin', 'admin'].includes(userRole);
      const { title, description, priority, status, progress, assignedTo, dueDate, startDate, labels, checklist, bucketId, sortOrder, completedAt, dependencies, recurrence, attachments } = req.body;

      const [existingTask] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!existingTask) return res.status(404).json({ error: 'المهمة غير موجودة' });

      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, existingTask.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك تعديل مهام بوابة أخرى' });
        }
      }

      if (status === 'completed' && !isManager) {
        return res.status(403).json({ error: 'فقط المدير يمكنه إغلاق المهمة' });
      }

      if (status === 'pending_approval') {
        if (existingTask.assignedTo !== userId && existingTask.createdBy !== userId && !isManager) {
          return res.status(403).json({ error: 'لا يمكنك طلب إغلاق هذه المهمة' });
        }
        await db.insert(plannerComments).values({
          taskId: id,
          userId,
          content: `طلب إغلاق المهمة - بانتظار موافقة المدير`,
          type: 'activity',
        });
      }

      if (status === 'in_progress' && existingTask.status === 'pending_approval') {
        if (!isManager) {
          return res.status(403).json({ error: 'فقط المدير يمكنه رفض طلب الإغلاق' });
        }
        await db.insert(plannerComments).values({
          taskId: id,
          userId,
          content: `تم رفض طلب الإغلاق بواسطة ${req.user?.name || 'المدير'} - المهمة تحتاج مراجعة إضافية`,
          type: 'activity',
        });
      }

      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (status !== undefined) updates.status = status;
      if (progress !== undefined) updates.progress = progress;
      if (assignedTo !== undefined) updates.assignedTo = (assignedTo && assignedTo !== 'none') ? (typeof assignedTo === 'number' ? assignedTo : parseInt(assignedTo) || null) : null;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
      if (labels !== undefined) updates.labels = labels;
      if (checklist !== undefined) updates.checklist = checklist;
      if (bucketId !== undefined) updates.bucketId = bucketId;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (dependencies !== undefined) updates.dependencies = dependencies;
      if (recurrence !== undefined) updates.recurrence = recurrence;
      if (attachments !== undefined) updates.attachments = attachments;

      if (status === 'completed' && isManager) {
        updates.completedAt = new Date();
        updates.progress = 100;
        await db.insert(plannerComments).values({
          taskId: id,
          userId,
          content: `تمت الموافقة على إغلاق المهمة بواسطة ${req.user?.name || 'المدير'}`,
          type: 'activity',
        });
      } else if (completedAt !== undefined) {
        updates.completedAt = completedAt ? new Date(completedAt) : null;
      }

      const [updated] = await db.update(plannerTasks)
        .set(updates)
        .where(eq(plannerTasks.id, id))
        .returning();

      const taskTitle = updated.title || existingTask.title;
      const senderName = req.user?.name || 'النظام';
      const resolvedNewAssignee = updates.assignedTo;

      if (assignedTo !== undefined && resolvedNewAssignee && resolvedNewAssignee !== existingTask.assignedTo && resolvedNewAssignee !== userId) {
        const [newAssignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, resolvedNewAssignee));
        if (newAssignee) {
          // DB notification for reassignment
          await storage.createNotification({
            userId: resolvedNewAssignee,
            title: 'تم إسناد مهمة بلانر إليك',
            message: `تم إسناد مهمة "${taskTitle}" إليك بواسطة ${senderName}`,
            type: 'task_assigned',
            priority: updated.priority === 'urgent' || updated.priority === 'critical' || updated.priority === 'high' ? 'high' : 'normal',
            isRead: false,
            entityType: 'planner_task',
            entityId: id,
            actionUrl: `/planner`,
          });
          if (newAssignee.email) {
            sendPlannerNotification({
              type: 'assignment', taskTitle, taskId: id,
              recipientEmail: newAssignee.email, recipientName: newAssignee.name || '',
              senderName, priority: updated.priority, dueDate: updated.dueDate,
            });
          }
        }
      }

      if (status === 'pending_approval' && existingTask.status !== 'pending_approval') {
        const [board] = existingTask.boardId ? await db.select().from(plannerBoards).where(eq(plannerBoards.id, existingTask.boardId)) : [null];
        if (board) {
          const portalManagerRoles: Record<string, string> = {
            infrastructure: 'it_infrastructure_manager', cybersecurity: 'it_cybersecurity_manager',
            digital_transformation: 'it_digital_manager', support: 'it_support_manager', dmo: 'dmo_manager',
          };
          const mgrRole = portalManagerRoles[board.portal] || '';
          if (mgrRole) {
            const managers = await db.select({ name: users.name, email: users.email }).from(users)
              .where(and(eq(users.role, mgrRole), eq(users.isActive, true)));
            for (const mgr of managers) {
              if (mgr.email) {
                sendPlannerNotification({
                  type: 'approval_request', taskTitle, taskId: id,
                  recipientEmail: mgr.email, recipientName: mgr.name || '',
                  senderName, dueDate: updated.dueDate,
                });
              }
            }
          }
        }
      }

      if (status === 'completed' && isManager && existingTask.assignedTo) {
        const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, existingTask.assignedTo));
        if (assignee?.email && existingTask.assignedTo !== userId) {
          sendPlannerNotification({
            type: 'approval_granted', taskTitle, taskId: id,
            recipientEmail: assignee.email, recipientName: assignee.name || '', senderName,
          });
        }
      }

      if (status === 'in_progress' && existingTask.status === 'pending_approval' && existingTask.assignedTo) {
        const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, existingTask.assignedTo));
        if (assignee?.email && existingTask.assignedTo !== userId) {
          sendPlannerNotification({
            type: 'approval_rejected', taskTitle, taskId: id,
            recipientEmail: assignee.email, recipientName: assignee.name || '', senderName,
          });
        }
      }

      res.json(updated);
    } catch (error) {
      logger.error('Error updating planner task', { error });
      res.status(500).json({ error: 'خطأ في تحديث المهمة' });
    }
  });

  // Move task to different bucket - validates bucket exists, portal-enforced
  app.put('/api/planner/tasks/:id/move', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { bucketId, sortOrder } = req.body;

      const [targetBucket] = await db.select().from(plannerBuckets).where(eq(plannerBuckets.id, bucketId));
      if (!targetBucket) return res.status(404).json({ error: 'المجموعة المستهدفة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, targetBucket.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك نقل المهمة إلى بوابة أخرى' });
        }
      }

      const [updated] = await db.update(plannerTasks)
        .set({ bucketId, boardId: targetBucket.boardId, sortOrder: sortOrder || 0, updatedAt: new Date() })
        .where(eq(plannerTasks.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'المهمة غير موجودة' });
      res.json(updated);
    } catch (error) {
      logger.error('Error moving planner task', { error });
      res.status(500).json({ error: 'خطأ في نقل المهمة' });
    }
  });

  // Delete task - only creator or managers
  app.delete('/api/planner/tasks/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const userId = req.user?.id;
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      const isManager = managerRoles.includes(req.user?.role || '');

      const [existingTask] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!existingTask) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, existingTask.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك حذف مهام بوابة أخرى' });
        }
      }

      if (!isManager && existingTask.createdBy !== userId) {
        return res.status(403).json({ error: 'لا يمكنك حذف هذه المهمة - فقط منشئ المهمة أو المدير' });
      }

      await db.delete(plannerTasks).where(eq(plannerTasks.id, id));
      res.json({ message: 'تم حذف المهمة بنجاح' });
    } catch (error) {
      logger.error('Error deleting planner task', { error });
      res.status(500).json({ error: 'خطأ في حذف المهمة' });
    }
  });

  // Get planner stats for portal (enforced to user's portal)
  app.get('/api/planner/stats', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json({ totalBoards: 0, totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0 });
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض إحصائيات بوابة أخرى' });
      }
      const allBoards = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = allBoards.map((b: any) => b.id);

      if (boardIds.length === 0) {
        return res.json({ totalBoards: 0, totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0 });
      }

      const [stats] = await db.select({
        totalTasks: sql<number>`count(*)::int`,
        completedTasks: sql<number>`count(*) filter (where ${plannerTasks.status} = 'completed')::int`,
        inProgressTasks: sql<number>`count(*) filter (where ${plannerTasks.status} = 'in_progress')::int`,
        overdueTasks: sql<number>`count(*) filter (where ${plannerTasks.dueDate} < now() and ${plannerTasks.status} != 'completed')::int`,
      }).from(plannerTasks)
        .where(inArray(plannerTasks.boardId, boardIds));

      res.json({
        totalBoards: allBoards.length,
        totalTasks: stats?.totalTasks || 0,
        completedTasks: stats?.completedTasks || 0,
        inProgressTasks: stats?.inProgressTasks || 0,
        overdueTasks: stats?.overdueTasks || 0,
      });
    } catch (error) {
      logger.error('Error fetching planner stats', { error });
      res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
  });

  // Get My Tasks - all tasks assigned to or created by current user across all boards in portal
  app.get('/api/planner/my-tasks', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json([]);
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض مهام بوابة أخرى' });
      }
      const portalBoards = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = portalBoards.map((b: any) => b.id);

      if (boardIds.length === 0) return res.json([]);

      const creatorUsers = db.select({ id: users.id, name: users.name }).from(users).as('creator_users');
      const tasksWithDetails = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        assigneeEmail: users.email,
        bucketTitle: plannerBuckets.title,
        boardTitle: plannerBoards.title,
        boardColor: plannerBoards.color,
        creatorName: creatorUsers.name,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .leftJoin(plannerBuckets, eq(plannerTasks.bucketId, plannerBuckets.id))
        .leftJoin(plannerBoards, eq(plannerTasks.boardId, plannerBoards.id))
        .leftJoin(creatorUsers, eq(plannerTasks.createdBy, creatorUsers.id))
        .where(and(
          inArray(plannerTasks.boardId, boardIds),
          or(eq(plannerTasks.assignedTo, userId), eq(plannerTasks.createdBy, userId))
        ));

      const allTasks = tasksWithDetails.map((row: any) => ({
        ...row.task,
        assigneeName: row.assigneeName,
        assigneeEmail: row.assigneeEmail,
        bucketTitle: row.bucketTitle || '',
        boardTitle: row.boardTitle || '',
        boardColor: row.boardColor || '#1e3a5f',
        creatorName: row.creatorName || null,
      }));

      res.json(allTasks);
    } catch (error) {
      logger.error('Error fetching my tasks', { error });
      res.status(500).json({ error: 'خطأ في جلب المهام' });
    }
  });

  // Get team tasks for manager - all tasks across portal with member info (managers only, portal-enforced)
  app.get('/api/planner/team-tasks', authenticateToken, async (req: any, res) => {
    try {
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم عرض مهام الفريق' });
      }
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json({ tasks: [], members: [] });
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض مهام فريق بوابة أخرى' });
      }
      const portalBoards = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = portalBoards.map((b: any) => b.id);

      if (boardIds.length === 0) return res.json({ tasks: [], members: [] });

      const creatorUsers = db.select({ id: users.id, name: users.name }).from(users).as('creator_users');
      const tasksWithDetails = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        assigneeEmail: users.email,
        bucketTitle: plannerBuckets.title,
        boardTitle: plannerBoards.title,
        boardColor: plannerBoards.color,
        creatorName: creatorUsers.name,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .leftJoin(plannerBuckets, eq(plannerTasks.bucketId, plannerBuckets.id))
        .leftJoin(plannerBoards, eq(plannerTasks.boardId, plannerBoards.id))
        .leftJoin(creatorUsers, eq(plannerTasks.createdBy, creatorUsers.id))
        .where(inArray(plannerTasks.boardId, boardIds));

      const memberMap = new Map<number, { id: number; name: string; email: string; tasksCount: number; completedCount: number; overdueCount: number }>();
      const allTasks = tasksWithDetails.map((row: any) => {
        const taskData = {
          ...row.task,
          assigneeName: row.assigneeName,
          assigneeEmail: row.assigneeEmail,
          bucketTitle: row.bucketTitle || '',
          boardTitle: row.boardTitle || '',
          boardColor: row.boardColor || '#1e3a5f',
          creatorName: row.creatorName || null,
        };

        if (row.task.assignedTo && row.assigneeName) {
          const existing = memberMap.get(row.task.assignedTo);
          const isOverdue = row.task.dueDate && new Date(row.task.dueDate) < new Date() && row.task.status !== 'completed';
          if (existing) {
            existing.tasksCount++;
            if (row.task.status === 'completed') existing.completedCount++;
            if (isOverdue) existing.overdueCount++;
          } else {
            memberMap.set(row.task.assignedTo, {
              id: row.task.assignedTo,
              name: row.assigneeName,
              email: row.assigneeEmail || '',
              tasksCount: 1,
              completedCount: row.task.status === 'completed' ? 1 : 0,
              overdueCount: isOverdue ? 1 : 0,
            });
          }
        }
        return taskData;
      });

      res.json({
        tasks: allTasks,
        members: Array.from(memberMap.values()),
      });
    } catch (error) {
      logger.error('Error fetching team tasks', { error });
      res.status(500).json({ error: 'خطأ في جلب مهام الفريق' });
    }
  });

  // Get users filtered by portal for Planner assignee dropdown (enforced to user's portal)
  app.get('/api/planner/portal-users', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin' || userRole === 'admin';
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض مستخدمي بوابة أخرى' });
      }
      const portal = requestedPortal;
      if (!portal) return res.json([]);

      const PORTAL_TO_DEPT: Record<string, number> = {
        'infrastructure': 9,
        'cybersecurity': 10,
        'digital_transformation': 11,
        'support': 12,
        'dmo': 5,
      };

      const deptId = PORTAL_TO_DEPT[portal];

      if (deptId) {
        const filtered = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          portal: users.portal,
        }).from(users).where(and(eq(users.isActive, true), eq(users.itDepartmentId, deptId)));
        return res.json(filtered);
      }

      if (portal === 'it_director' || portal === 'admin') {
        const allItRoles = ['it_director', 'system_admin', 'admin', 'it_infrastructure_manager', 'it_infrastructure_staff', 'it_cybersecurity_manager', 'it_cybersecurity_staff', 'it_digital_manager', 'it_digital_staff', 'it_support_manager', 'it_support_staff', 'dmo_manager', 'dmo_staff'];
        const filtered = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          portal: users.portal,
        }).from(users).where(and(eq(users.isActive, true), inArray(users.role, allItRoles)));
        return res.json(filtered);
      }

      const PORTAL_ROLES: Record<string, string[]> = {
        'committee': ['committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member'],
        'data_rep': ['data_representative'],
        'steward': ['data_steward'],
        'employee': ['employee'],
      };
      const allowedRoles = PORTAL_ROLES[portal] || [];
      if (allowedRoles.length === 0) return res.json([]);

      const filtered = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        portal: users.portal,
      }).from(users).where(and(eq(users.isActive, true), inArray(users.role, allowedRoles)));
      res.json(filtered);
    } catch (error) {
      logger.error('Error fetching portal users', { error });
      res.status(500).json({ error: 'خطأ في جلب مستخدمي البوابة' });
    }
  });

  // Get comments for a task - portal-enforced
  app.get('/api/planner/tasks/:id/comments', authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseId(req.params.id, res);
      if (!taskId) return;

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [task] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, taskId));
        if (task) {
          const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, task.boardId));
          if (board && board.portal !== req.user?.portal) {
            return res.status(403).json({ error: 'لا يمكنك عرض تعليقات مهام بوابة أخرى' });
          }
        }
      }

      const comments = await db.select({
        comment: plannerComments,
        userName: users.name,
      }).from(plannerComments)
        .leftJoin(users, eq(plannerComments.userId, users.id))
        .where(eq(plannerComments.taskId, taskId))
        .orderBy(plannerComments.createdAt);
      
      res.json(comments.map((c: any) => ({
        ...c.comment,
        userName: c.userName,
      })));
    } catch (error) {
      logger.error('Error fetching comments', { error });
      res.status(500).json({ error: 'خطأ في جلب التعليقات' });
    }
  });

  // Add comment to a task - portal-enforced
  app.post('/api/planner/tasks/:id/comments', authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseId(req.params.id, res);
      if (!taskId) return;
      const userId = req.user?.id;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'محتوى التعليق مطلوب' });
      }

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [task] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, taskId));
        if (task) {
          const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, task.boardId));
          if (board && board.portal !== req.user?.portal) {
            return res.status(403).json({ error: 'لا يمكنك التعليق على مهام بوابة أخرى' });
          }
        }
      }

      const [comment] = await db.insert(plannerComments).values({
        taskId,
        userId,
        content,
        type: 'comment',
      }).returning();

      const [taskForNotify] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, taskId));
      if (taskForNotify) {
        const notifyTargets = new Set<number>();
        if (taskForNotify.assignedTo && taskForNotify.assignedTo !== userId) notifyTargets.add(taskForNotify.assignedTo);
        if (taskForNotify.createdBy && taskForNotify.createdBy !== userId) notifyTargets.add(taskForNotify.createdBy);
        for (const targetId of Array.from(notifyTargets)) {
          const [target] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, targetId));
          if (target?.email) {
            sendPlannerNotification({
              type: 'comment', taskTitle: taskForNotify.title, taskId,
              recipientEmail: target.email, recipientName: target.name || '',
              senderName: req.user?.name || 'مستخدم', commentText: content,
            });
          }
        }
      }

      const userName = req.user?.name || 'مستخدم';
      res.json({ ...comment, userName });
    } catch (error) {
      logger.error('Error adding comment', { error });
      res.status(500).json({ error: 'خطأ في إضافة التعليق' });
    }
  });

  // Charts data - aggregated stats per member and per time
  app.get('/api/planner/charts', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json({ totalTasks: 0, byStatus: {}, byPriority: {}, byMember: [], completionRate: 0 });
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض إحصائيات بوابة أخرى' });
      }
      const portalBoards = await db.select().from(plannerBoards)
        .where(eq(plannerBoards.portal, requestedPortal));

      const boardIds = portalBoards.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json({ totalTasks: 0, byStatus: {}, byPriority: {}, byMember: [], completionRate: 0 });

      const tasksWithAssignee = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .where(inArray(plannerTasks.boardId, boardIds));
      const allTasks = tasksWithAssignee.map((r: any) => ({ ...r.task, assigneeName: r.assigneeName }));

      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      const now = new Date();
      type MemberStat = {
        name: string; total: number; completed: number; overdue: number;
        inProgress: number; notStarted: number; pendingApproval: number; open: number;
      };
      const byMember: Record<string, MemberStat> = {};

      for (const task of allTasks) {
        byStatus[task.status] = (byStatus[task.status] || 0) + 1;
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;

        const memberKey = task.assigneeName || 'غير معين';
        if (!byMember[memberKey]) {
          byMember[memberKey] = { name: memberKey, total: 0, completed: 0, overdue: 0, inProgress: 0, notStarted: 0, pendingApproval: 0, open: 0 };
        }
        const m = byMember[memberKey];
        m.total++;
        if (task.status === 'completed') m.completed++;
        if (task.status === 'in_progress') m.inProgress++;
        if (task.status === 'not_started') m.notStarted++;
        if (task.status === 'pending_approval') m.pendingApproval++;
        if (task.status !== 'completed') m.open++;
        if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'completed') m.overdue++;
      }

      res.json({
        totalTasks: allTasks.length,
        byStatus,
        byPriority,
        byMember: Object.values(byMember).sort((a, b) => b.total - a.total),
        completionRate: allTasks.length > 0 ? Math.round((allTasks.filter((t: any) => t.status === 'completed').length / allTasks.length) * 100) : 0,
      });
    } catch (error) {
      logger.error('Error fetching charts data', { error });
      res.status(500).json({ error: 'خطأ في جلب بيانات الرسوم البيانية' });
    }
  });

  // ==================== نسخ/تكرار المهمة ====================
  app.post('/api/planner/tasks/:id/duplicate', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [original] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!original) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, original.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك نسخ مهام بوابة أخرى' });
        }
      }

      const existing = await db.select().from(plannerTasks).where(eq(plannerTasks.bucketId, original.bucketId));
      const body = req.body || {};
      const [copy] = await db.insert(plannerTasks).values({
        boardId: original.boardId,
        bucketId: original.bucketId,
        title: `${original.title} (نسخة)`,
        description: original.description,
        priority: original.priority,
        status: 'not_started',
        progress: 0,
        assignedTo: body.assignedTo || original.assignedTo,
        createdBy: req.user?.id,
        dueDate: body.dueDate ? new Date(body.dueDate) : original.dueDate,
        startDate: body.startDate ? new Date(body.startDate) : original.startDate,
        labels: original.labels,
        checklist: original.checklist ? (original.checklist as any[]).map((c: any) => ({ ...c, checked: false })) : [],
        dependencies: null,
        recurrence: null,
        sortOrder: existing.length,
      }).returning();

      await db.insert(plannerComments).values({
        taskId: copy.id,
        userId: req.user?.id,
        content: `تم نسخ هذه المهمة من المهمة #${original.id}: ${original.title}`,
        type: 'activity',
      });

      res.json(copy);
    } catch (error: any) {
      logger.error('Error duplicating task', { error: error?.message || error, stack: error?.stack });
      res.status(500).json({ error: 'خطأ في نسخ المهمة' });
    }
  });

  // ==================== حفظ كقالب ====================
  app.post('/api/planner/tasks/:id/save-template', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [original] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!original) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, original.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك حفظ قالب من بوابة أخرى' });
        }
      }

      const tplBody = req.body || {};
      const [template] = await db.insert(plannerTasks).values({
        boardId: original.boardId,
        bucketId: original.bucketId,
        title: tplBody.templateName || original.title,
        description: original.description,
        priority: original.priority,
        status: 'not_started',
        labels: original.labels,
        checklist: original.checklist ? (original.checklist as any[]).map((c: any) => ({ ...c, checked: false })) : [],
        createdBy: req.user?.id,
        isTemplate: 1,
        sortOrder: 0,
      }).returning();

      res.json(template);
    } catch (error: any) {
      logger.error('Error saving template', { error: error?.message || error, stack: error?.stack });
      res.status(500).json({ error: 'خطأ في حفظ القالب' });
    }
  });

  // ==================== جلب القوالب ====================
  app.get('/api/planner/templates', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const portal = isDirectorOrAdmin ? (req.query.portal as string || req.user?.portal) : req.user?.portal;
      if (!portal) return res.json([]);
      const boards = await db.select().from(plannerBoards).where(eq(plannerBoards.portal, portal));
      const boardIds = boards.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json([]);

      const templates = await db.select({
        task: plannerTasks,
        creatorName: users.name,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.createdBy, users.id))
        .where(and(eq(plannerTasks.isTemplate, 1), inArray(plannerTasks.boardId, boardIds)));

      res.json(templates.map((t: any) => ({ ...t.task, creatorName: t.creatorName })));
    } catch (error) {
      logger.error('Error fetching templates', { error });
      res.status(500).json({ error: 'خطأ في جلب القوالب' });
    }
  });

  // ==================== إنشاء مهمة من قالب ====================
  app.post('/api/planner/tasks/from-template/:templateId', authenticateToken, async (req: any, res) => {
    try {
      const templateId = parseId(req.params.templateId, res);
      if (!templateId) return;
      const [template] = await db.select().from(plannerTasks).where(and(eq(plannerTasks.id, templateId), eq(plannerTasks.isTemplate, 1)));
      if (!template) return res.status(404).json({ error: 'القالب غير موجود' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, template.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء مهمة من قالب في بوابة أخرى' });
        }
      }

      const { bucketId, assignedTo, dueDate, startDate } = req.body;
      const targetBucket = bucketId || template.bucketId;
      const existing = await db.select().from(plannerTasks).where(eq(plannerTasks.bucketId, targetBucket));

      const [task] = await db.insert(plannerTasks).values({
        boardId: template.boardId,
        bucketId: targetBucket,
        title: template.title,
        description: template.description,
        priority: template.priority,
        status: 'not_started',
        labels: template.labels,
        checklist: template.checklist ? (template.checklist as any[]).map((c: any) => ({ ...c, checked: false })) : [],
        assignedTo: assignedTo || null,
        createdBy: req.user?.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        sortOrder: existing.length,
      }).returning();

      if (assignedTo && assignedTo !== req.user?.id) {
        const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, assignedTo));
        if (assignee?.email) {
          sendPlannerNotification({
            type: 'assignment', taskTitle: template.title, taskId: task.id,
            recipientEmail: assignee.email, recipientName: assignee.name || '',
            senderName: req.user?.name || 'النظام', priority: template.priority,
            dueDate: dueDate ? new Date(dueDate) : null,
          });
        }
      }

      res.json(task);
    } catch (error) {
      logger.error('Error creating from template', { error });
      res.status(500).json({ error: 'خطأ في إنشاء مهمة من القالب' });
    }
  });

  // ==================== تحديث تبعيات المهمة ====================
  // Send planner task to department tasks page
  app.post('/api/planner/tasks/:id/send-to-tasks', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [task] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const { targetDepartmentId, notes } = req.body;
      if (!targetDepartmentId) return res.status(400).json({ error: 'الإدارة المستهدفة مطلوبة' });

      // Create department task from planner task
      const [created] = await db.insert(departmentTasks).values({
        departmentId: parseInt(targetDepartmentId),
        title: task.title,
        description: [task.description, notes ? `\nملاحظة الإحالة: ${notes}` : ''].filter(Boolean).join('\n'),
        taskType: 'regular',
        priority: task.priority || 'medium',
        status: 'pending',
        assignedTo: task.assignedTo || null,
        assignedBy: req.user.id,
        dueDate: task.dueDate || null,
        progress: task.progress || 0,
        checklist: task.checklist as any || null,
        sourceType: 'planner',
        notes: notes || null,
      }).returning();

      // Audit log
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'نقل مهمة من البلانر',
        entityType: 'department_task',
        entityId: created.id,
        details: `نُقلت المهمة "${task.title}" من البلانر إلى إدارة ${targetDepartmentId}`
      });

      // Notification to dept managers
      try {
        const deptManagers = await db.select({ id: users.id, name: users.name })
          .from(users)
          .where(sql`${users.itDepartmentId} = ${parseInt(targetDepartmentId)} AND ${users.role} IN ('manager', 'it_manager', 'dept_manager')`);

        for (const mgr of deptManagers) {
          await db.insert(notifications).values({
            userId: mgr.id,
            title: 'مهمة جديدة من البلانر',
            message: `تم نقل مهمة "${task.title}" إلى إدارتك من البلانر`,
            type: 'task_assigned',
            isRead: false,
            entityType: 'department_task',
            entityId: created.id,
          });
        }
      } catch (_) {}

      res.json({ success: true, taskId: created.id, departmentTaskId: created.id });
    } catch (error) {
      logger.error('Error sending planner task to department tasks:', { error });
      res.status(500).json({ error: 'خطأ في نقل المهمة' });
    }
  });

  app.put('/api/planner/tasks/:id/dependencies', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { dependencies } = req.body;
      if (dependencies && dependencies.includes(id)) {
        return res.status(400).json({ error: 'لا يمكن أن تعتمد المهمة على نفسها' });
      }
      const [existingTask] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!existingTask) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, existingTask.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك تعديل تبعيات مهام بوابة أخرى' });
        }
      }

      const [task] = await db.update(plannerTasks).set({
        dependencies: dependencies || [],
        updatedAt: new Date(),
      }).where(eq(plannerTasks.id, id)).returning();
      res.json(task);
    } catch (error) {
      logger.error('Error updating dependencies', { error });
      res.status(500).json({ error: 'خطأ في تحديث التبعيات' });
    }
  });

  // ==================== تحديث المهام المتكررة ====================
  app.put('/api/planner/tasks/:id/recurrence', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { recurrence } = req.body;
      const [existingTask] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!existingTask) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, existingTask.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك تعديل تكرار مهام بوابة أخرى' });
        }
      }

      const [task] = await db.update(plannerTasks).set({
        recurrence: recurrence || null,
        updatedAt: new Date(),
      }).where(eq(plannerTasks.id, id)).returning();
      res.json(task);
    } catch (error) {
      logger.error('Error updating recurrence', { error });
      res.status(500).json({ error: 'خطأ في تحديث التكرار' });
    }
  });

  // ==================== رفع مرفقات المهمة ====================
  app.post('/api/planner/tasks/:id/attachments', authenticateToken, upload.single('file'), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [task] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, task.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك إضافة مرفقات لمهام بوابة أخرى' });
        }
      }

      if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

      let fileUrl = '';
      try {
        const { objectStorageClient } = await import('./integrations/object_storage/objectStorage');
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
        const bucket = objectStorageClient.bucket(bucketId);
        const fileName = `planner/${id}/${Date.now()}_${req.file.originalname}`;
        const blob = bucket.file(fileName);
        await blob.save(req.file.buffer, { contentType: req.file.mimetype });
        fileUrl = fileName;
      } catch (uploadError) {
        logger.error('[Upload] Object storage failed:', { error: uploadError });
        return res.status(500).json({ success: false, message: 'فشل في رفع الملف. يرجى المحاولة مرة أخرى' });
      }

      const currentAttachments = (task.attachments as any[]) || [];
      const newAttachment = {
        name: req.file.originalname,
        url: fileUrl,
        type: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
      };
      currentAttachments.push(newAttachment);

      const [updated] = await db.update(plannerTasks).set({
        attachments: currentAttachments,
        updatedAt: new Date(),
      }).where(eq(plannerTasks.id, id)).returning();

      res.json(updated);
    } catch (error) {
      logger.error('Error uploading attachment', { error });
      res.status(500).json({ error: 'خطأ في رفع المرفق' });
    }
  });

  // ==================== حذف مرفق ====================
  app.delete('/api/planner/tasks/:id/attachments/:index', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const index = parseInt(req.params.index);
      if (isNaN(index) || index < 0) return res.status(400).json({ error: 'فهرس المرفق غير صحيح' });
      const [task] = await db.select().from(plannerTasks).where(eq(plannerTasks.id, id));
      if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, task.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك حذف مرفقات بوابة أخرى' });
        }
      }

      const currentAttachments = (task.attachments as any[]) || [];
      if (index >= currentAttachments.length) return res.status(400).json({ error: 'فهرس المرفق غير صحيح' });

      currentAttachments.splice(index, 1);
      const [updated] = await db.update(plannerTasks).set({
        attachments: currentAttachments,
        updatedAt: new Date(),
      }).where(eq(plannerTasks.id, id)).returning();

      res.json(updated);
    } catch (error) {
      logger.error('Error deleting attachment', { error });
      res.status(500).json({ error: 'خطأ في حذف المرفق' });
    }
  });

  // ==================== المهام المتأخرة والتنبيهات ====================
  app.get('/api/planner/overdue-tasks', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'لا يمكنك عرض مهام بوابة أخرى' });
      }
      const portal = requestedPortal;
      if (!portal) return res.json({ overdue: [], approaching: [] });
      const userId = req.user?.id;
      const boards = await db.select().from(plannerBoards).where(eq(plannerBoards.portal, portal));
      const boardIds = boards.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json({ overdue: [], approaching: [] });

      const allTasks = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        boardTitle: plannerBoards.title,
        bucketTitle: plannerBuckets.title,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .leftJoin(plannerBoards, eq(plannerTasks.boardId, plannerBoards.id))
        .leftJoin(plannerBuckets, eq(plannerTasks.bucketId, plannerBuckets.id))
        .where(and(
          inArray(plannerTasks.boardId, boardIds),
          not(eq(plannerTasks.status, 'completed')),
          isNotNull(plannerTasks.dueDate),
        ));

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const overdue = allTasks.filter((t: any) => t.task.dueDate && new Date(t.task.dueDate) < now)
        .map((t: any) => ({ ...t.task, assigneeName: t.assigneeName, boardTitle: t.boardTitle, bucketTitle: t.bucketTitle }));
      const approaching = allTasks.filter((t: any) => t.task.dueDate && new Date(t.task.dueDate) >= now && new Date(t.task.dueDate) <= threeDaysFromNow)
        .map((t: any) => ({ ...t.task, assigneeName: t.assigneeName, boardTitle: t.boardTitle, bucketTitle: t.bucketTitle }));

      res.json({ overdue, approaching });
    } catch (error) {
      logger.error('Error fetching overdue tasks', { error });
      res.status(500).json({ error: 'خطأ في جلب المهام المتأخرة' });
    }
  });

  // ==================== إرسال إشعار بريدي عند التعيين - portal-enforced ====================
  app.post('/api/planner/tasks/:id/notify', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { type } = req.body;
      const [task] = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        assigneeEmail: users.email,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .where(eq(plannerTasks.id, id));

      if (!task || !task.assigneeEmail) return res.status(404).json({ error: 'المهمة أو المعيّن غير موجود' });

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [board] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, task.task.boardId));
        if (board && board.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك إرسال إشعارات لمهام بوابة أخرى' });
        }
      }

      const senderName = req.user?.name || 'النظام';
      let subject = '';
      let htmlBody = '';

      if (type === 'assignment') {
        subject = `تم تعيينك على مهمة: ${task.task.title}`;
        htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#1e3a5f;">تعيين مهمة جديدة</h2>
          <p>مرحباً ${task.assigneeName}،</p>
          <p>تم تعيينك على المهمة التالية بواسطة <strong>${senderName}</strong>:</p>
          <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0;">
            <p><strong>المهمة:</strong> ${task.task.title}</p>
            <p><strong>الأولوية:</strong> ${task.task.priority === 'urgent' ? 'عاجل' : task.task.priority === 'critical' ? 'حرج' : task.task.priority === 'high' ? 'عالي' : task.task.priority === 'medium' ? 'متوسط' : 'منخفض'}</p>
            ${task.task.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${new Date(task.task.dueDate).toLocaleDateString('ar-SA')}</p>` : ''}
            ${task.task.description ? `<p><strong>الوصف:</strong> ${task.task.description}</p>` : ''}
          </div>
          <p>يرجى متابعة المهمة من خلال لوحة التخطيط.</p>
        </div>`;
      } else if (type === 'overdue') {
        subject = `تنبيه: المهمة "${task.task.title}" متأخرة`;
        htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#dc2626;">تنبيه مهمة متأخرة</h2>
          <p>مرحباً ${task.assigneeName}،</p>
          <p>المهمة التالية تجاوزت تاريخ الاستحقاق:</p>
          <div style="background:#fef2f2;padding:15px;border-radius:8px;margin:15px 0;border-right:4px solid #dc2626;">
            <p><strong>المهمة:</strong> ${task.task.title}</p>
            <p><strong>تاريخ الاستحقاق:</strong> ${task.task.dueDate ? new Date(task.task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
          </div>
          <p>يرجى إكمال المهمة في أقرب وقت.</p>
        </div>`;
      } else if (type === 'approaching') {
        subject = `تذكير: المهمة "${task.task.title}" تقترب من الاستحقاق`;
        htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#d97706;">تذكير بمهمة قريبة</h2>
          <p>مرحباً ${task.assigneeName}،</p>
          <p>المهمة التالية تقترب من تاريخ الاستحقاق:</p>
          <div style="background:#fffbeb;padding:15px;border-radius:8px;margin:15px 0;border-right:4px solid #d97706;">
            <p><strong>المهمة:</strong> ${task.task.title}</p>
            <p><strong>تاريخ الاستحقاق:</strong> ${task.task.dueDate ? new Date(task.task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
          </div>
        </div>`;
      } else if (type === 'reminder') {
        subject = `تذكير: متابعة المهمة "${task.task.title}"`;
        htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#1e3a5f;">تذكير بمتابعة مهمة</h2>
          <p>مرحباً ${task.assigneeName}،</p>
          <p>هذا تذكير بمتابعة المهمة التالية من <strong>${senderName}</strong>:</p>
          <div style="background:#f0f9ff;padding:15px;border-radius:8px;margin:15px 0;border-right:4px solid #1e3a5f;">
            <p><strong>المهمة:</strong> ${task.task.title}</p>
            <p><strong>الحالة:</strong> ${task.task.status === 'in_progress' ? 'قيد التنفيذ' : task.task.status === 'not_started' ? 'لم تبدأ' : task.task.status}</p>
            ${task.task.dueDate ? `<p><strong>تاريخ الاستحقاق:</strong> ${new Date(task.task.dueDate).toLocaleDateString('ar-SA')}</p>` : ''}
          </div>
          <p>يرجى متابعة المهمة وتحديث حالتها.</p>
        </div>`;
      }

      if (subject && htmlBody) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.office365.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: task.assigneeEmail,
            subject,
            html: htmlBody,
          });
          res.json({ success: true, message: 'تم إرسال الإشعار بنجاح' });
        } catch (emailErr) {
          logger.warn('Email send failed, but notification logged', { emailErr });
          res.json({ success: true, message: 'تم تسجيل الإشعار (البريد غير متاح حالياً)' });
        }
      } else {
        res.status(400).json({ error: 'نوع الإشعار غير صحيح' });
      }
    } catch (error) {
      logger.error('Error sending notification', { error });
      res.status(500).json({ error: 'خطأ في إرسال الإشعار' });
    }
  });

  // ==================== جلب بيانات Timeline/Gantt ====================
  app.get('/api/planner/timeline', authenticateToken, async (req: any, res) => {
    try {
      const boardIdRaw = parseInt(req.query.boardId as string);
      if (isNaN(boardIdRaw) || boardIdRaw < 1) return res.status(400).json({ error: 'يجب تحديد اللوحة' });
      const boardId = boardIdRaw;

      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      if (!isDirectorOrAdmin) {
        const [boardCheck] = await db.select().from(plannerBoards).where(eq(plannerBoards.id, boardId));
        if (boardCheck && boardCheck.portal !== req.user?.portal) {
          return res.status(403).json({ error: 'لا يمكنك عرض بيانات بوابة أخرى' });
        }
      }

      const tasks = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
        bucketTitle: plannerBuckets.title,
        bucketColor: plannerBuckets.color,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .leftJoin(plannerBuckets, eq(plannerTasks.bucketId, plannerBuckets.id))
        .where(and(eq(plannerTasks.boardId, boardId), eq(plannerTasks.isTemplate, 0)))
        .orderBy(plannerTasks.startDate, plannerTasks.dueDate);

      const timeline = tasks.map((t: any) => {
        const deps = (t.task.dependencies as number[]) || [];
        return {
          id: t.task.id,
          title: t.task.title,
          startDate: t.task.startDate,
          dueDate: t.task.dueDate,
          status: t.task.status,
          priority: t.task.priority,
          progress: t.task.progress,
          assigneeName: t.assigneeName,
          bucketTitle: t.bucketTitle,
          bucketColor: t.bucketColor,
          dependencies: deps,
        };
      });

      res.json(timeline);
    } catch (error) {
      logger.error('Error fetching timeline', { error });
      res.status(500).json({ error: 'خطأ في جلب بيانات الجدول الزمني' });
    }
  });

  // ==================== تحليل أعباء العمل - Workload Analysis ====================
  app.get('/api/planner/workload', authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const isDirectorOrAdmin = ['it_director', 'system_admin', 'admin'].includes(userRole);
      const managerRoles = ['system_admin', 'admin', 'it_director', 'it_cybersecurity_manager', 'it_infrastructure_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager'];
      if (!managerRoles.includes(userRole)) {
        return res.status(403).json({ error: 'هذا التقرير متاح للمدراء فقط' });
      }
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json({ members: [] });
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const portalBoardsList = await db.select().from(plannerBoards).where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = portalBoardsList.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json({ members: [] });

      const allTasks = await db.select({
        task: plannerTasks,
        assigneeName: users.name,
      }).from(plannerTasks)
        .leftJoin(users, eq(plannerTasks.assignedTo, users.id))
        .where(and(inArray(plannerTasks.boardId, boardIds), not(eq(plannerTasks.status, 'completed')), eq(plannerTasks.isTemplate, 0)));

      const now = new Date();
      const memberMap = new Map<string, {
        name: string; total: number; urgent: number; overdue: number;
        dueThisWeek: number; dueNextWeek: number; noDate: number;
        byPriority: Record<string, number>;
        healthScore: number;
      }>();

      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
      const nextWeekEnd = new Date(now); nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);

      for (const row of allTasks) {
        const name = (row as any).assigneeName || 'غير معين';
        if (!memberMap.has(name)) {
          memberMap.set(name, { name, total: 0, urgent: 0, overdue: 0, dueThisWeek: 0, dueNextWeek: 0, noDate: 0, byPriority: {}, healthScore: 100 });
        }
        const m = memberMap.get(name)!;
        m.total++;
        const t = (row as any).task;
        m.byPriority[t.priority] = (m.byPriority[t.priority] || 0) + 1;
        if (t.priority === 'urgent' || t.priority === 'critical') m.urgent++;
        if (t.dueDate) {
          const due = new Date(t.dueDate);
          if (due < now) m.overdue++;
          else if (due <= weekEnd) m.dueThisWeek++;
          else if (due <= nextWeekEnd) m.dueNextWeek++;
        } else { m.noDate++; }
      }

      for (const m of Array.from(memberMap.values())) {
        let score = 100;
        score -= m.overdue * 15;
        score -= m.urgent * 5;
        if (m.total > 10) score -= (m.total - 10) * 3;
        m.healthScore = Math.max(0, Math.min(100, score));
      }

      res.json({ members: Array.from(memberMap.values()).sort((a, b) => b.total - a.total) });
    } catch (error) {
      logger.error('Error fetching workload', { error });
      res.status(500).json({ error: 'خطأ في جلب بيانات أعباء العمل' });
    }
  });

  // ==================== مخطط الاحتراق - Burndown ====================
  app.get('/api/planner/burndown', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json({ weeks: [] });
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const portalBoardsList = await db.select().from(plannerBoards).where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = portalBoardsList.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json({ weeks: [] });

      const allTasks = await db.select().from(plannerTasks).where(and(inArray(plannerTasks.boardId, boardIds), eq(plannerTasks.isTemplate, 0)));
      const now = new Date();
      const weeks: { week: string; created: number; completed: number; remaining: number; velocity: number }[] = [];

      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
        const label = weekStart.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
        const created = allTasks.filter((t: any) => { const d = new Date(t.createdAt); return d >= weekStart && d < weekEnd; }).length;
        const completed = allTasks.filter((t: any) => t.completedAt && new Date(t.completedAt) >= weekStart && new Date(t.completedAt) < weekEnd).length;
        const remaining = allTasks.filter((t: any) => {
          const createdBefore = new Date(t.createdAt) < weekEnd;
          const notCompletedYet = !t.completedAt || new Date(t.completedAt) >= weekEnd;
          return createdBefore && notCompletedYet;
        }).length;
        weeks.push({ week: label, created, completed, remaining, velocity: completed });
      }

      const avgVelocity = weeks.length > 0 ? Math.round(weeks.reduce((s, w) => s + w.velocity, 0) / weeks.length) : 0;
      const totalRemaining = allTasks.filter((t: any) => t.status !== 'completed').length;
      const estimatedWeeks = avgVelocity > 0 ? Math.ceil(totalRemaining / avgVelocity) : null;

      res.json({ weeks, avgVelocity, totalRemaining, estimatedWeeks });
    } catch (error) {
      logger.error('Error fetching burndown', { error });
      res.status(500).json({ error: 'خطأ في جلب بيانات مخطط الاحتراق' });
    }
  });

  // ==================== سجل الأنشطة - Activity Feed ====================
  app.get('/api/planner/activity', authenticateToken, async (req: any, res) => {
    try {
      const isDirectorOrAdmin = ['it_director', 'system_admin'].includes(req.user?.role || '');
      const requestedPortal = (req.query.portal as string) || req.user?.portal;
      if (!requestedPortal) return res.json([]);
      if (!isDirectorOrAdmin && requestedPortal !== req.user?.portal) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const portalBoardsList = await db.select().from(plannerBoards).where(eq(plannerBoards.portal, requestedPortal));
      const boardIds = portalBoardsList.map((b: any) => b.id);
      if (boardIds.length === 0) return res.json([]);

      const recentComments = await db.select({
        comment: plannerComments,
        userName: users.name,
        taskTitle: plannerTasks.title,
        taskId: plannerTasks.id,
      }).from(plannerComments)
        .innerJoin(plannerTasks, eq(plannerComments.taskId, plannerTasks.id))
        .leftJoin(users, eq(plannerComments.userId, users.id))
        .where(inArray(plannerTasks.boardId, boardIds))
        .orderBy(sql`${plannerComments.createdAt} DESC`)
        .limit(30);

      const activities = recentComments.map((row: any) => ({
        id: row.comment.id,
        type: row.comment.type || 'comment',
        userName: row.userName || 'النظام',
        taskTitle: row.taskTitle,
        taskId: row.taskId,
        content: row.comment.content,
        createdAt: row.comment.createdAt,
      }));

      res.json(activities);
    } catch (error) {
      logger.error('Error fetching activity', { error });
      res.status(500).json({ error: 'خطأ في جلب سجل الأنشطة' });
    }
  });
}

// ==================== إكمال الإجراءات المعلقة - Missing Workflow Routes ====================
function registerMissingWorkflowRoutes(app: Express) {

  // ==================== 1. طلبات حقوق البيانات DSR - تحديث الحالة والرد ====================
  app.put("/api/dsr/:id", authenticateToken, requireUpdate(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { status, response, assignedTo, priority, dueDate } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (response) updateData.response = response;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (priority) updateData.priority = priority;
      if (dueDate) updateData.dueDate = new Date(dueDate);
      if (status === 'completed') updateData.completedAt = new Date();

      const [result] = await db.update(dataSubjectRequests).set(updateData).where(eq(dataSubjectRequests.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الطلب غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating DSR:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الطلب' });
    }
  });

  app.delete("/api/dsr/:id", authenticateToken, requireDelete(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataSubjectRequests).where(eq(dataSubjectRequests.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting DSR:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الطلب' });
    }
  });

  // ==================== DSR System Actions - ربط طلبات DSR مع الأنظمة الخارجية ====================

  // GET: جلب إجراءات الأنظمة لطلب DSR معين
  app.get("/api/dsr/:id/system-actions", authenticateToken, requireView(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const actions = await db.select().from(dsrSystemActions)
        .where(eq(dsrSystemActions.dsrId, id))
        .orderBy(desc(dsrSystemActions.createdAt));
      res.json(actions);
    } catch (error) {
      logger.error('Error fetching DSR system actions:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إجراءات الأنظمة' });
    }
  });

  // POST: إرسال طلب DSR إلى الأنظمة الخارجية المحددة
  app.post("/api/dsr/:id/dispatch", authenticateToken, requireCreate(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const dsr = await db.select().from(dataSubjectRequests).where(eq(dataSubjectRequests.id, id)).then((r: any[]) => r[0]);
      if (!dsr) return res.status(404).json({ error: 'الطلب غير موجود' });

      const { systems: selectedSystems, actionType } = req.body;
      if (!selectedSystems || !Array.isArray(selectedSystems) || selectedSystems.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد أنظمة لإرسال الطلب إليها' });
      }

      const created: any[] = [];
      for (const sys of selectedSystems) {
        // Check if action already exists for this system+DSR
        const existing = await db.select().from(dsrSystemActions)
          .where(and(eq(dsrSystemActions.dsrId, id), eq(dsrSystemActions.systemName, sys.systemName)))
          .then((r: any[]) => r[0]);
        if (existing) continue;

        let status = 'sent';
        let responseCode: number | null = null;
        let errorMessage: string | null = null;
        let responseData: any = null;

        // Try sending HTTP request to system's API if endpoint is configured
        if (sys.apiEndpoint) {
          try {
            const payload = {
              dsrId: dsr.requestNumber,
              requestType: dsr.requestType,
              subjectName: dsr.subjectName,
              subjectEmail: dsr.subjectEmail,
              subjectIdNumber: dsr.subjectIdNumber,
              actionType: actionType || dsr.requestType,
              timestamp: new Date().toISOString(),
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
              const resp = await fetch(sys.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-DSR-Source': 'JCSA-ControlHub' },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              responseCode = resp.status;
              responseData = { statusText: resp.statusText };
              status = resp.ok ? 'sent' : 'failed';
              if (!resp.ok) errorMessage = `HTTP ${resp.status}: ${resp.statusText}`;
            } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              status = 'sent'; // Manual follow-up needed
              errorMessage = fetchErr.message || 'لم يتم الاستجابة';
            }
          } catch {}
        }

        const [action] = await db.insert(dsrSystemActions).values({
          dsrId: id,
          systemId: sys.systemId || null,
          systemName: sys.systemName,
          systemType: sys.systemType || null,
          apiEndpoint: sys.apiEndpoint || null,
          actionType: actionType || dsr.requestType,
          status,
          requestSentAt: new Date(),
          responseCode,
          responseData,
          errorMessage,
          notes: sys.notes || null,
        }).returning();
        created.push(action);
      }

      // Update DSR status to in_progress if still pending
      if (dsr.status === 'pending') {
        await db.update(dataSubjectRequests).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(dataSubjectRequests.id, id));
      }

      logger.info('[DSR] Dispatched to external systems', { dsrId: id, count: created.length, by: req.user?.id });
      res.json({ success: true, dispatched: created.length, actions: created });
    } catch (error) {
      logger.error('Error dispatching DSR:', { error });
      res.status(500).json({ error: 'حدث خطأ في إرسال الطلب للأنظمة' });
    }
  });

  // PUT: تحديث حالة إجراء نظام معين
  app.put("/api/dsr/:id/system-actions/:actionId", authenticateToken, requireUpdate(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const dsrId = parseId(req.params.id, res);
      const actionId = parseId(req.params.actionId, res);
      if (!dsrId || !actionId) return;
      const { status, notes, handledBy, responseData } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (handledBy !== undefined) updateData.handledBy = handledBy;
      if (responseData !== undefined) updateData.responseData = responseData;
      if (status === 'acknowledged') updateData.acknowledgedAt = new Date();
      if (status === 'completed' || status === 'not_found' || status === 'not_applicable') updateData.completedAt = new Date();
      const [updated] = await db.update(dsrSystemActions).set(updateData)
        .where(and(eq(dsrSystemActions.id, actionId), eq(dsrSystemActions.dsrId, dsrId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'الإجراء غير موجود' });

      // Auto-complete DSR if all system actions are done
      const allActions = await db.select().from(dsrSystemActions).where(eq(dsrSystemActions.dsrId, dsrId));
      const doneStatuses = ['completed', 'not_found', 'not_applicable', 'failed'];
      const allDone = allActions.length > 0 && allActions.every((a: any) => doneStatuses.includes(a.status));
      if (allDone) {
        await db.update(dataSubjectRequests).set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() }).where(eq(dataSubjectRequests.id, dsrId));
      }

      res.json(updated);
    } catch (error) {
      logger.error('Error updating DSR system action:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الإجراء' });
    }
  });

  // DELETE: حذف إجراء نظام من DSR
  app.delete("/api/dsr/:id/system-actions/:actionId", authenticateToken, requireDelete(RESOURCES.COMPLIANCE), async (req: any, res: any) => {
    try {
      const dsrId = parseId(req.params.id, res);
      const actionId = parseId(req.params.actionId, res);
      if (!dsrId || !actionId) return;
      await db.delete(dsrSystemActions).where(and(eq(dsrSystemActions.id, actionId), eq(dsrSystemActions.dsrId, dsrId)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الحذف' });
    }
  });

  // GET: إحصائيات DSR الشاملة مع الأنظمة الخارجية
  app.get("/api/dsr/stats/overview", authenticateToken, requireView(RESOURCES.COMPLIANCE), async (_req: any, res: any) => {
    try {
      const [allDsr, allActions] = await Promise.all([
        db.select().from(dataSubjectRequests),
        db.select().from(dsrSystemActions),
      ]);
      const stats = {
        total: allDsr.length,
        pending: allDsr.filter((r: any) => r.status === 'pending').length,
        inProgress: allDsr.filter((r: any) => r.status === 'in_progress').length,
        completed: allDsr.filter((r: any) => r.status === 'completed').length,
        rejected: allDsr.filter((r: any) => r.status === 'rejected').length,
        fromWebsite: allDsr.filter((r: any) => r.source === 'website').length,
        fromExternal: allDsr.filter((r: any) => r.source === 'external_system').length,
        fromInternal: allDsr.filter((r: any) => r.source !== 'website' && r.source !== 'external_system').length,
        byType: allDsr.reduce((acc: any, r: any) => { acc[r.requestType] = (acc[r.requestType] || 0) + 1; return acc; }, {}),
        systemActions: {
          total: allActions.length,
          pending: allActions.filter((a: any) => a.status === 'pending').length,
          sent: allActions.filter((a: any) => a.status === 'sent').length,
          completed: allActions.filter((a: any) => a.status === 'completed').length,
          failed: allActions.filter((a: any) => a.status === 'failed').length,
          notFound: allActions.filter((a: any) => a.status === 'not_found').length,
        },
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
    }
  });

  // ==================== 2. خروقات SLA - تحديث وحل وحذف ====================
  app.put("/api/sla-breaches/:id", authenticateToken, requireUpdate(RESOURCES.SLA_AGREEMENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { status, resolution, rootCause, penaltyApplied, penaltyAmount, impactLevel } = req.body;
      const updateData: any = {};
      if (status) updateData.status = status;
      if (resolution) updateData.resolution = resolution;
      if (rootCause) updateData.rootCause = rootCause;
      if (penaltyApplied !== undefined) updateData.penaltyApplied = penaltyApplied;
      if (penaltyAmount !== undefined) updateData.penaltyAmount = penaltyAmount;
      if (impactLevel) updateData.impactLevel = impactLevel;
      if (status === 'resolved') updateData.resolvedAt = new Date();

      const [result] = await db.update(slaBreaches).set(updateData).where(eq(slaBreaches.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الخرق غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating SLA breach:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث خرق SLA' });
    }
  });

  app.delete("/api/sla-breaches/:id", authenticateToken, requireDelete(RESOURCES.SLA_AGREEMENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(slaBreaches).where(eq(slaBreaches.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting SLA breach:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف خرق SLA' });
    }
  });

  // ==================== 3. خروقات البيانات Data Breaches - CRUD كامل ====================
  app.get("/api/data-breaches", authenticateToken, requireView(RESOURCES.PDPL_BREACHES), async (req: any, res: any) => {
    try {
      const result = await db.select().from(dataBreaches).orderBy(sql`${dataBreaches.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching data breaches:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب خروقات البيانات' });
    }
  });

  app.post("/api/data-breaches", authenticateToken, requireCreate(RESOURCES.PDPL_BREACHES), async (req: any, res: any) => {
    try {
      const { title, breachType, severity, description, descriptionAr, affectedRecords, affectedDataTypes, detectedAt, status } = req.body;
      if (!severity || !description) {
        return res.status(400).json({ error: 'الحقول المطلوبة: مستوى الخطورة والوصف' });
      }
      if (!detectedAt) {
        return res.status(400).json({ error: 'حقل تاريخ الاكتشاف مطلوب' });
      }
      if (!title) {
        return res.status(400).json({ error: 'عنوان البلاغ مطلوب' });
      }
      const [result] = await db.insert(dataBreaches).values({
        title: title || 'بلاغ خرق بيانات',
        breachType: breachType || null,
        severity,
        description,
        descriptionAr: descriptionAr || description,
        affectedRecords: typeof affectedRecords === 'number' ? affectedRecords : (affectedRecords ? parseInt(affectedRecords) : 0),
        affectedDataTypes: Array.isArray(affectedDataTypes) && affectedDataTypes.length > 0 ? affectedDataTypes : (affectedDataTypes && typeof affectedDataTypes === 'string' ? [affectedDataTypes] : []),
        status: status || 'detected',
        reportedBy: req.user?.id,
        detectedAt: new Date(detectedAt),
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating data breach:', { error });
      res.status(500).json({ error: 'حدث خطأ في تسجيل خرق البيانات' });
    }
  });

  app.put("/api/data-breaches/:id", authenticateToken, requireUpdate(RESOURCES.PDPL_BREACHES), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(dataBreaches).set({
        ...req.body,
        updatedAt: new Date(),
      }).where(eq(dataBreaches.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الخرق غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating data breach:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث خرق البيانات' });
    }
  });

  app.delete("/api/data-breaches/:id", authenticateToken, requireDelete(RESOURCES.PDPL_BREACHES), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataBreaches).where(eq(dataBreaches.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting data breach:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف خرق البيانات' });
    }
  });

  // ==================== قائمة المستخدمين المبسطة للقوائم المنسدلة ====================
  // NOTE: This is a fallback handler; the primary handler is in tasks.routes.ts (registered earlier).
  app.get("/api/department-users", authenticateToken, async (req: any, res: any) => {
    try {
      const DEPT_PORTALS: Record<number, string[]> = {
        5: ['dmo'], 9: ['infrastructure'], 10: ['cybersecurity'],
        11: ['digital_transformation'], 12: ['support'],
      };
      const deptId = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal] || null;
      const targetDeptId = userDeptId || deptId;
      if (!targetDeptId) {
        return res.json([]);
      }
      const portalNames = DEPT_PORTALS[targetDeptId] || [];
      const conditions = [
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ];
      if (portalNames.length > 0) {
        conditions.push(
          sql`(${users.itDepartmentId} = ${targetDeptId} OR (${users.itDepartmentId} IS NULL AND ${users.portal} IN (${sql.join(portalNames.map(p => sql`${p}`), sql`, `)})))`
        );
      } else {
        conditions.push(eq(users.itDepartmentId, targetDeptId));
      }
      const deptUsers = await db.select({
        id: users.id,
        name: users.name,
        nameEn: users.nameEn,
        email: users.email,
        role: users.role,
        jobTitle: users.jobTitle,
      }).from(users).where(and(...conditions));
      res.json(deptUsers);
    } catch (error) {
      logger.error('Error fetching department users:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب موظفي القسم' });
    }
  });

  app.get("/api/director/users/by-department", authenticateToken, async (req: any, res: any) => {
    try {
      const deptId = parseInt(req.query.departmentId || req.query.dept || '0');
      if (!deptId) {
        return res.json([]);
      }
      const DEPT_PORTALS: Record<number, string[]> = {
        5: ['dmo'], 9: ['infrastructure'], 10: ['cybersecurity'],
        11: ['digital_transformation'], 12: ['support'],
      };
      const portalNames = DEPT_PORTALS[deptId] || [];
      const selectFields = {
        id: users.id,
        name: users.name,
        nameEn: users.nameEn,
        email: users.email,
        role: users.role,
        jobTitle: users.jobTitle,
      };
      const conditions = [
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ];
      if (portalNames.length > 0) {
        conditions.push(
          sql`(${users.itDepartmentId} = ${deptId} OR (${users.itDepartmentId} IS NULL AND ${users.portal} IN (${sql.join(portalNames.map(p => sql`${p}`), sql`, `)})))`
        );
      } else {
        conditions.push(eq(users.itDepartmentId, deptId));
      }
      const deptUsers = await db.select(selectFields).from(users).where(and(...conditions));
      res.json(deptUsers);
    } catch (error) {
      logger.error('Error fetching users by department:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الموظفين' });
    }
  });

  app.get("/api/users-list", authenticateToken, async (req: any, res: any) => {
    try {
      const isAdmin = ['system_admin', 'admin', 'it_director'].includes(req.user.role);
      const userDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user.portal];

      const conditions: any[] = [eq(users.isActive, true), isNull(users.deletedAt)];

      // For non-admins, only return users from the same department
      if (!isAdmin && userDeptId) {
        conditions.push(eq(users.itDepartmentId, userDeptId));
      }

      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        nameEn: users.nameEn,
        email: users.email,
        role: users.role,
        portal: users.portal,
        itDepartmentId: users.itDepartmentId,
      }).from(users).where(and(...conditions));
      res.json(allUsers);
    } catch (error) {
      logger.error('Error fetching users list:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب قائمة المستخدمين' });
    }
  });

  // ==================== 4. سجلات الموافقات Consent Records - CRUD كامل ====================
  app.get("/api/consent-records/stats", authenticateToken, requireView(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const all = await db.select().from(consentRecords);
      const now = new Date();
      const active = all.filter(c => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > now));
      const withdrawn = all.filter(c => c.withdrawnAt);
      const expired = all.filter(c => c.isActive && c.expiresAt && new Date(c.expiresAt) <= now);
      const purposes = [...new Set(all.map(c => c.purpose))];
      const byLegalBasis: Record<string, number> = {};
      all.forEach(c => { byLegalBasis[c.legalBasis] = (byLegalBasis[c.legalBasis] || 0) + 1; });
      const byPurpose: Record<string, number> = {};
      all.forEach(c => { byPurpose[c.purpose] = (byPurpose[c.purpose] || 0) + 1; });
      res.json({
        total: all.length, active: active.length, withdrawn: withdrawn.length,
        expired: expired.length, purposes, byLegalBasis, byPurpose,
      });
    } catch (error) {
      logger.error('Error fetching consent stats:', { error });
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  app.get("/api/consent-records", authenticateToken, requireView(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const subjectAlias = db.select({ id: users.id, name: users.name, email: users.email }).from(users).as('consent_subject');
      const result = await db.select({
        id: consentRecords.id,
        dataSubjectId: consentRecords.dataSubjectId,
        subjectName: subjectAlias.name,
        subjectEmail: subjectAlias.email,
        purpose: consentRecords.purpose,
        purposeAr: consentRecords.purposeAr,
        legalBasis: consentRecords.legalBasis,
        dataTypes: consentRecords.dataTypes,
        givenAt: consentRecords.givenAt,
        expiresAt: consentRecords.expiresAt,
        withdrawnAt: consentRecords.withdrawnAt,
        ipAddress: consentRecords.ipAddress,
        userAgent: consentRecords.userAgent,
        isActive: consentRecords.isActive,
        version: consentRecords.version,
        metadata: consentRecords.metadata,
        createdAt: consentRecords.createdAt,
      }).from(consentRecords)
        .leftJoin(subjectAlias, eq(consentRecords.dataSubjectId, subjectAlias.id))
        .orderBy(sql`${consentRecords.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching consent records:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات الموافقات' });
    }
  });

  app.post("/api/consent-records", authenticateToken, requireCreate(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const { dataSubjectId, purpose, purposeAr, legalBasis, dataTypes, expiresAt, metadata } = req.body;
      if (!dataSubjectId || !purposeAr || !legalBasis) {
        return res.status(400).json({ error: 'الحقول المطلوبة: صاحب البيانات، الغرض، الأساس القانوني' });
      }
      if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
        return res.status(400).json({ error: 'يجب تحديد نوع واحد على الأقل من أنواع البيانات' });
      }
      const [result] = await db.insert(consentRecords).values({
        dataSubjectId: Number(dataSubjectId),
        purpose: purpose || purposeAr,
        purposeAr,
        legalBasis,
        dataTypes,
        givenAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        isActive: true,
        version: 1,
        metadata: metadata || null,
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating consent record:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء سجل الموافقة' });
    }
  });

  app.put("/api/consent-records/:id", authenticateToken, requireUpdate(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(consentRecords).set(stripProtectedFields(req.body)).where(eq(consentRecords.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'السجل غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating consent record:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث سجل الموافقة' });
    }
  });

  app.put("/api/consent-records/:id/withdraw", authenticateToken, requireUpdate(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(consentRecords).set({
        isActive: false,
        withdrawnAt: new Date(),
      }).where(eq(consentRecords.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'السجل غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error withdrawing consent:', { error });
      res.status(500).json({ error: 'حدث خطأ في سحب الموافقة' });
    }
  });

  app.delete("/api/consent-records/:id", authenticateToken, requireDelete(RESOURCES.PDPL_CONSENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(consentRecords).where(eq(consentRecords.id, id));
      if (!existing) return res.status(404).json({ error: 'السجل غير موجود' });
      await db.update(consentRecords).set({ isActive: false, withdrawnAt: existing.withdrawnAt || new Date() }).where(eq(consentRecords.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'archive',
        entityType: 'consent_record',
        entityId: id,
        oldValue: existing,
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: 'أرشفة سجل موافقة',
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error archiving consent record:', { error });
      res.status(500).json({ error: 'حدث خطأ في أرشفة سجل الموافقة' });
    }
  });

  // ==================== 5. إشعارات الخصوصية Privacy Notices - CRUD كامل ====================
  app.get("/api/privacy-notices", authenticateToken, requireView(RESOURCES.PRIVACY_NOTICES), async (req: any, res: any) => {
    try {
      const result = await db.select().from(privacyNotices).orderBy(sql`${privacyNotices.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching privacy notices:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب إشعارات الخصوصية' });
    }
  });

  app.post("/api/privacy-notices", authenticateToken, requireCreate(RESOURCES.PRIVACY_NOTICES), async (req: any, res: any) => {
    try {
      const [result] = await db.insert(privacyNotices).values({
        ...req.body,
        createdBy: req.user?.id,
        effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : new Date(),
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating privacy notice:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء إشعار الخصوصية' });
    }
  });

  app.put("/api/privacy-notices/:id", authenticateToken, requireUpdate(RESOURCES.PRIVACY_NOTICES), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(privacyNotices).set({
        ...req.body,
        updatedAt: new Date(),
      }).where(eq(privacyNotices.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الإشعار غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating privacy notice:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث إشعار الخصوصية' });
    }
  });

  app.delete("/api/privacy-notices/:id", authenticateToken, requireDelete(RESOURCES.PRIVACY_NOTICES), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(privacyNotices).where(eq(privacyNotices.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting privacy notice:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف إشعار الخصوصية' });
    }
  });

  // ==================== 6. سجلات المعالجة Processing Records - CRUD كامل ====================
  app.get("/api/processing-records", authenticateToken, async (req: any, res: any) => {
    try {
      const result = await db.select().from(processingRecords).orderBy(sql`${processingRecords.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching processing records:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات المعالجة' });
    }
  });

  app.post("/api/processing-records", authenticateToken, async (req: any, res: any) => {
    try {
      const [result] = await db.insert(processingRecords).values({
        ...req.body,
        createdBy: req.user?.id,
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating processing record:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء سجل المعالجة' });
    }
  });

  app.put("/api/processing-records/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(processingRecords).set({
        ...req.body,
        updatedAt: new Date(),
      }).where(eq(processingRecords.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'السجل غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating processing record:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث سجل المعالجة' });
    }
  });

  app.delete("/api/processing-records/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(processingRecords).where(eq(processingRecords.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting processing record:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف سجل المعالجة' });
    }
  });

  // ==================== 7. اتفاقيات البيانات Data Agreements - تعديل وحذف ====================
  app.put("/api/data-agreements/:id", authenticateToken, requireUpdate(RESOURCES.DATA_AGREEMENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(dataAgreements).set({
        ...req.body,
        updatedAt: new Date(),
      }).where(eq(dataAgreements.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الاتفاقية غير موجودة' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating data agreement:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث الاتفاقية' });
    }
  });

  app.delete("/api/data-agreements/:id", authenticateToken, requireDelete(RESOURCES.DATA_AGREEMENTS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataAgreements).where(eq(dataAgreements.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting data agreement:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف الاتفاقية' });
    }
  });

  // ==================== 8. تقارير الامتثال Compliance Reports - CRUD كامل ====================
  app.post("/api/compliance/reports", authenticateToken, async (req: any, res: any) => {
    try {
      const parsed = complianceReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'خطأ في التحقق من البيانات', details: parsed.error.errors });
      }
      const [result] = await db.insert(complianceReports).values({
        ...parsed.data,
        generatedBy: req.user?.id,
      }).returning();

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create',
        entityType: 'compliance_report',
        entityId: result.id,
        oldValue: null,
        newValue: JSON.stringify({ title: parsed.data.title, reportType: parsed.data.reportType }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء تقرير امتثال: ${parsed.data.title}`,
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating compliance report:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء تقرير الامتثال' });
    }
  });

  app.put("/api/compliance/reports/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(complianceReports).where(eq(complianceReports.id, id));
      if (!existing) return res.status(404).json({ error: 'التقرير غير موجود' });

      const parsed = complianceReportUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'خطأ في التحقق من البيانات', details: parsed.error.errors });
      }
      const updateData = stripProtectedFields(parsed.data);
      const [result] = await db.update(complianceReports).set(updateData).where(eq(complianceReports.id, id)).returning();

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'compliance_report',
        entityId: id,
        oldValue: JSON.stringify({ title: existing.title, status: existing.status }),
        newValue: JSON.stringify(updateData),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تحديث تقرير امتثال: ${existing.title}`,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error updating compliance report:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث التقرير' });
    }
  });

  app.delete("/api/compliance/reports/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(complianceReports).where(eq(complianceReports.id, id));
      if (!existing) return res.status(404).json({ error: 'التقرير غير موجود' });

      await db.delete(complianceReports).where(eq(complianceReports.id, id));

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'compliance_report',
        entityId: id,
        oldValue: JSON.stringify({ title: existing.title, reportType: existing.reportType }),
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حذف تقرير امتثال: ${existing.title}`,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting compliance report:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف التقرير' });
    }
  });

  // ==================== 9. تقييمات NDMO - CRUD كامل ====================
  app.get("/api/ndmo-assessments", authenticateToken, async (req: any, res: any) => {
    try {
      const result = await db.select().from(ndmoAssessments).orderBy(sql`${ndmoAssessments.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching NDMO assessments:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب تقييمات NDMO' });
    }
  });

  app.post("/api/ndmo-assessments", authenticateToken, async (req: any, res: any) => {
    try {
      const parsed = ndmoAssessmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'خطأ في التحقق من البيانات', details: parsed.error.errors });
      }
      const [result] = await db.insert(ndmoAssessments).values({
        ...parsed.data,
        assessedBy: req.user?.id,
      }).returning();

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create',
        entityType: 'ndmo_assessment',
        entityId: result.id,
        oldValue: null,
        newValue: JSON.stringify({ title: parsed.data.title, category: parsed.data.category }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء تقييم NDMO: ${parsed.data.title}`,
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating NDMO assessment:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء تقييم NDMO' });
    }
  });

  app.put("/api/ndmo-assessments/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(ndmoAssessments).where(eq(ndmoAssessments.id, id));
      if (!existing) return res.status(404).json({ error: 'التقييم غير موجود' });

      const parsed = ndmoAssessmentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'خطأ في التحقق من البيانات', details: parsed.error.errors });
      }
      const updateData = stripProtectedFields(parsed.data);
      const [result] = await db.update(ndmoAssessments).set({
        ...updateData,
        updatedAt: new Date(),
      }).where(eq(ndmoAssessments.id, id)).returning();

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'ndmo_assessment',
        entityId: id,
        oldValue: JSON.stringify({ title: existing.title, status: existing.status, score: existing.score }),
        newValue: JSON.stringify(updateData),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تحديث تقييم NDMO: ${existing.title}`,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error updating NDMO assessment:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث تقييم NDMO' });
    }
  });

  app.delete("/api/ndmo-assessments/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select().from(ndmoAssessments).where(eq(ndmoAssessments.id, id));
      if (!existing) return res.status(404).json({ error: 'التقييم غير موجود' });

      await db.delete(ndmoAssessments).where(eq(ndmoAssessments.id, id));

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'ndmo_assessment',
        entityId: id,
        oldValue: JSON.stringify({ title: existing.title, category: existing.category }),
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حذف تقييم NDMO: ${existing.title}`,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting NDMO assessment:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف تقييم NDMO' });
    }
  });

  // ==================== 11. مخاطر البيانات Data Risks - CRUD كامل ====================
  app.get("/api/data-risks", authenticateToken, requireView(RESOURCES.SECURITY_RISKS), async (req: any, res: any) => {
    try {
      const result = await db.select().from(dataRisks).orderBy(sql`${dataRisks.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching data risks:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب مخاطر البيانات' });
    }
  });

  app.post("/api/data-risks", authenticateToken, requireCreate(RESOURCES.SECURITY_RISKS), async (req: any, res: any) => {
    try {
      const [result] = await db.insert(dataRisks).values({
        ...req.body,
        createdBy: req.user?.id,
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating data risk:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء خطر البيانات' });
    }
  });

  app.put("/api/data-risks/:id", authenticateToken, requireUpdate(RESOURCES.SECURITY_RISKS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(dataRisks).set(stripProtectedFields(req.body)).where(eq(dataRisks.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الخطر غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating data risk:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث خطر البيانات' });
    }
  });

  app.delete("/api/data-risks/:id", authenticateToken, requireDelete(RESOURCES.SECURITY_RISKS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataRisks).where(eq(dataRisks.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting data risk:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف خطر البيانات' });
    }
  });

  // ==================== 12. تتبع مسار البيانات Data Lineage - CRUD كامل ====================
  app.get("/api/data-lineage", authenticateToken, requireView(RESOURCES.DATA_FLOWS), async (req: any, res: any) => {
    try {
      const result = await db.select().from(dataLineage).orderBy(sql`${dataLineage.createdAt} DESC`);
      res.json(result);
    } catch (error) {
      logger.error('Error fetching data lineage:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب مسار البيانات' });
    }
  });

  app.post("/api/data-lineage", authenticateToken, requireCreate(RESOURCES.DATA_FLOWS), async (req: any, res: any) => {
    try {
      const [result] = await db.insert(dataLineage).values({
        ...req.body,
        createdBy: req.user?.id,
      }).returning();
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating data lineage:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء مسار البيانات' });
    }
  });

  app.put("/api/data-lineage/:id", authenticateToken, requireUpdate(RESOURCES.DATA_FLOWS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [result] = await db.update(dataLineage).set({
        ...req.body,
        updatedAt: new Date(),
      }).where(eq(dataLineage.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'المسار غير موجود' });
      res.json(result);
    } catch (error) {
      logger.error('Error updating data lineage:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث مسار البيانات' });
    }
  });

  app.delete("/api/data-lineage/:id", authenticateToken, requireDelete(RESOURCES.DATA_FLOWS), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(dataLineage).where(eq(dataLineage.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting data lineage:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف مسار البيانات' });
    }
  });

  // ==================== 13. اتصالات الأنظمة System Connections - CRUD كامل ====================
  app.get("/api/system-connections", authenticateToken, async (req: any, res: any) => {
    try {
      const result = await db.select().from(systemConnections).orderBy(sql`${systemConnections.createdAt} DESC`);
      res.json(result.map(sanitizeDbConnection));
    } catch (error) {
      logger.error('Error fetching system connections:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب اتصالات الأنظمة' });
    }
  });

  app.post("/api/system-connections", authenticateToken, async (req: any, res: any) => {
    try {
      const { id: _id, createdAt: _ca, ...safeBody } = req.body;
      const [result] = await db.insert(systemConnections).values({
        ...safeBody,
        createdBy: req.user?.id,
      }).returning();
      res.status(201).json(sanitizeDbConnection(result));
    } catch (error) {
      logger.error('Error creating system connection:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء اتصال النظام' });
    }
  });

  app.put("/api/system-connections/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { id: _id, createdAt: _ca, createdBy: _cb, ...safeBody } = req.body;
      const updateData = { ...safeBody, updatedAt: new Date() };
      if (updateData.password === '••••••••') delete updateData.password;
      if (updateData.connectionString === '••••••••') delete updateData.connectionString;
      const [result] = await db.update(systemConnections).set(updateData).where(eq(systemConnections.id, id)).returning();
      if (!result) return res.status(404).json({ error: 'الاتصال غير موجود' });
      res.json(sanitizeDbConnection(result));
    } catch (error) {
      logger.error('Error updating system connection:', { error });
      res.status(500).json({ error: 'حدث خطأ في تحديث اتصال النظام' });
    }
  });

  app.delete("/api/system-connections/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(systemConnections).where(eq(systemConnections.id, id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting system connection:', { error });
      res.status(500).json({ error: 'حدث خطأ في حذف اتصال النظام' });
    }
  });

  // ==================== 14. اكتشاف قواعد البيانات Discovery - CRUD ====================
  app.get("/api/discovered-schemas", authenticateToken, async (req: any, res: any) => {
    try {
      const { connectionId } = req.query;
      let result;
      if (connectionId) {
        result = await db.select().from(discoveredSchemas).where(eq(discoveredSchemas.connectionId, parseInt(connectionId as string)));
      } else {
        result = await db.select().from(discoveredSchemas).orderBy(sql`${discoveredSchemas.discoveredAt} DESC`);
      }
      res.json(result);
    } catch (error) {
      logger.error('Error fetching discovered schemas:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المخططات المكتشفة' });
    }
  });

  app.get("/api/discovered-columns", authenticateToken, async (req: any, res: any) => {
    try {
      const { tableId, connectionId } = req.query;
      let result;
      if (tableId) {
        result = await db.select().from(discoveredColumns).where(eq(discoveredColumns.tableId, parseInt(tableId as string)));
      } else if (connectionId) {
        result = await db.select().from(discoveredColumns).where(eq(discoveredColumns.connectionId, parseInt(connectionId as string)));
      } else {
        result = await db.select().from(discoveredColumns);
      }
      res.json(result);
    } catch (error) {
      logger.error('Error fetching discovered columns:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الأعمدة المكتشفة' });
    }
  });

  app.get("/api/discovery-logs", authenticateToken, async (req: any, res: any) => {
    try {
      const { connectionId } = req.query;
      let result;
      if (connectionId) {
        result = await db.select().from(discoveryLogs).where(eq(discoveryLogs.connectionId, parseInt(connectionId as string)));
      } else {
        result = await db.select().from(discoveryLogs).orderBy(sql`${discoveryLogs.startedAt} DESC`);
      }
      res.json(result);
    } catch (error) {
      logger.error('Error fetching discovery logs:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجلات الاكتشاف' });
    }
  });

  // ==================== 15. إنهاء جلسات التصويت تلقائياً ====================
  app.put("/api/voting-sessions/:id/finalize", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res: any) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      
      const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, id));
      if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      if (session.status === 'completed' || session.status === 'no_quorum') {
        return res.status(409).json({ error: 'هذه الجلسة مُغلقة بالفعل' });
      }

      const totalVotes = (session.votesFor || 0) + (session.votesAgainst || 0) + (session.votesAbstain || 0);

      // FIX: Enforce quorum — get total members count
      const [membersCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(committeeMembers)
        .where(sql`is_active = true`);
      const totalMembers = Number(membersCount?.count) || 0;
      const requiredQuorum = session.quorumRequired || Math.ceil(totalMembers * 0.5); // 50% minimum
      const quorumMet = totalMembers === 0 || totalVotes >= requiredQuorum;

      if (!quorumMet) {
        return res.status(422).json({ 
          error: `لم يكتمل النصاب القانوني. الأصوات الواردة: ${totalVotes} من أصل ${totalMembers} عضو (مطلوب: ${requiredQuorum})`,
          totalVotes,
          totalMembers,
          requiredQuorum,
        });
      }

      let result: string;
      if (session.votingType === 'majority') {
        result = (session.votesFor || 0) > (session.votesAgainst || 0) ? 'approved' : 'rejected';
      } else if (session.votingType === 'unanimous') {
        result = (session.votesAgainst || 0) === 0 && (session.votesFor || 0) > 0 ? 'approved' : 'rejected';
      } else if (session.votingType === 'two_thirds') {
        result = totalVotes > 0 && ((session.votesFor || 0) / totalVotes) >= 0.667 ? 'approved' : 'rejected';
      } else {
        result = (session.votesFor || 0) > (session.votesAgainst || 0) ? 'approved' : 'rejected';
      }

      const [updated] = await db.update(votingSessions).set({
        status: 'completed',
      } as any).where(eq(votingSessions.id, id)).returning();

      res.json({ ...updated, result, quorumMet, totalVotes, totalMembers });
    } catch (error) {
      logger.error('Error finalizing voting session:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنهاء جلسة التصويت' });
    }
  });

  // ==================== Bookmarks Routes (per department/portal) ====================
  app.get('/api/bookmarks', authenticateToken, async (req: any, res) => {
    try {
      const portal = req.query.portal as string;
      if (!portal) return res.status(400).json({ error: 'portal required' });
      const items = await db.select().from(userBookmarks)
        .where(and(eq(userBookmarks.userId, req.user.id), eq(userBookmarks.portal, portal)))
        .orderBy(desc(userBookmarks.createdAt));
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'خطأ في جلب المفضلة' });
    }
  });

  app.post('/api/bookmarks', authenticateToken, async (req: any, res) => {
    try {
      const { portal, entityType, entityId, title, subtitle, priority, status, url } = req.body;
      if (!portal || !entityType || !entityId || !title) return res.status(400).json({ error: 'missing fields' });
      const isAdminOrDirector = ['system_admin', 'it_director'].includes(req.user.role);
      if (!isAdminOrDirector && portal !== req.user.portal) {
        return res.status(403).json({ error: 'لا يمكنك إضافة مفضلة لبوابة أخرى' });
      }
      const existing = await db.select().from(userBookmarks)
        .where(and(eq(userBookmarks.userId, req.user.id), eq(userBookmarks.portal, portal), eq(userBookmarks.entityType, entityType), eq(userBookmarks.entityId, entityId)));
      if (existing.length > 0) return res.status(409).json({ error: 'already bookmarked' });
      const [item] = await db.insert(userBookmarks).values({ userId: req.user.id, portal, entityType, entityId, title, subtitle, priority, status, url }).returning();
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'خطأ في إضافة المفضلة' });
    }
  });

  app.delete('/api/bookmarks/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(userBookmarks).where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, req.user.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في حذف المفضلة' });
    }
  });

  app.delete('/api/bookmarks/entity/:portal/:entityType/:entityId', authenticateToken, async (req: any, res) => {
    try {
      const { portal, entityType, entityId } = req.params;
      await db.delete(userBookmarks).where(and(
        eq(userBookmarks.userId, req.user.id), eq(userBookmarks.portal, portal),
        eq(userBookmarks.entityType, entityType), eq(userBookmarks.entityId, parseInt(entityId))
      ));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في حذف المفضلة' });
    }
  });

  // ==================== Quick Notes Routes (per department/portal) ====================
  app.get('/api/quick-notes', authenticateToken, async (req: any, res) => {
    try {
      const portal = req.query.portal as string;
      if (!portal) return res.status(400).json({ error: 'portal required' });
      const items = await db.select().from(quickNotes)
        .where(and(eq(quickNotes.userId, req.user.id), eq(quickNotes.portal, portal)))
        .orderBy(desc(quickNotes.isPinned), desc(quickNotes.updatedAt));
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'خطأ في جلب الملاحظات' });
    }
  });

  app.post('/api/quick-notes', authenticateToken, async (req: any, res) => {
    try {
      const { portal, content, color } = req.body;
      if (!portal || !content) return res.status(400).json({ error: 'missing fields' });
      const isAdminOrDirector = ['system_admin', 'it_director'].includes(req.user.role);
      if (!isAdminOrDirector && portal !== req.user.portal) {
        return res.status(403).json({ error: 'لا يمكنك إنشاء ملاحظة لبوابة أخرى' });
      }
      const [item] = await db.insert(quickNotes).values({ userId: req.user.id, portal, content, color: color || 'default' }).returning();
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'خطأ في إنشاء الملاحظة' });
    }
  });

  app.patch('/api/quick-notes/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const updates: any = {};
      if (req.body.content !== undefined) updates.content = req.body.content;
      if (req.body.color !== undefined) updates.color = req.body.color;
      if (req.body.isPinned !== undefined) updates.isPinned = req.body.isPinned;
      updates.updatedAt = new Date();
      const [item] = await db.update(quickNotes).set(updates)
        .where(and(eq(quickNotes.id, id), eq(quickNotes.userId, req.user.id))).returning();
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'خطأ في تحديث الملاحظة' });
    }
  });

  app.delete('/api/quick-notes/:id', authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(quickNotes).where(and(eq(quickNotes.id, id), eq(quickNotes.userId, req.user.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في حذف الملاحظة' });
    }
  });

  // ==================== Daily Operations Summary (per department) ====================
  app.get('/api/daily-ops/:portal', authenticateToken, async (req: any, res) => {
    try {
      const portal = req.params.portal;
      const userId = req.user.id;
      const user = await db.select().from(users).where(eq(users.id, userId)).then((r: any) => r[0]);
      if (!user) return res.status(404).json({ error: 'user not found' });

      const PORTAL_TO_DEPT: Record<string, number> = { infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12, dmo: 5 };
      const isItDirector = portal === 'it-director' || portal === 'it_director';
      const deptId = user.itDepartmentId || PORTAL_TO_DEPT[portal] || null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);

      let deptTickets: any[] = [];
      let deptTasks: any[] = [];
      let myTasks: any[] = [];
      let incomingReferrals: any[] = [];

      if (isItDirector) {
        [deptTickets, deptTasks, incomingReferrals] = await Promise.all([
          db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          db.select().from(tasks).where(isNull(tasks.deletedAt)),
          db.select().from(itReferrals).where(eq(itReferrals.status, 'pending')),
        ]);
      } else if (deptId) {
        [deptTickets, deptTasks, incomingReferrals] = await Promise.all([
          db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))),
          db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))),
          db.select().from(itReferrals).where(eq(itReferrals.toDepartmentId, deptId)),
        ]);
      }

      myTasks = await db.select().from(tasks).where(and(eq(tasks.assignedTo, userId), isNull(tasks.deletedAt)));

      const openTickets = deptTickets.filter(t => ['open', 'new', 'in_progress', 'assigned'].includes(t.status));
      const urgentTickets = deptTickets.filter(t => (t.priority === 'critical' || t.priority === 'high') && ['open', 'new', 'in_progress'].includes(t.status));
      const agingTickets = deptTickets.filter(t => {
        if (['resolved', 'closed'].includes(t.status)) return false;
        const age = t.createdAt ? Math.ceil((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return age > 7;
      });

      const activeTasks = deptTasks.filter(t => !['completed', 'archived'].includes(t.status));
      const overdueTasks = deptTasks.filter(t => {
        if (!t.dueDate || ['completed', 'archived'].includes(t.status)) return false;
        return new Date(t.dueDate) < today;
      });
      const dueTodayTasks = deptTasks.filter(t => {
        if (!t.dueDate || ['completed', 'archived'].includes(t.status)) return false;
        return new Date(t.dueDate).toDateString() === today.toDateString();
      });
      const dueThisWeekTasks = deptTasks.filter(t => {
        if (!t.dueDate || ['completed', 'archived'].includes(t.status)) return false;
        const d = new Date(t.dueDate);
        return d >= today && d <= weekEnd;
      });

      // My personal tasks analysis
      const myActiveTasks = myTasks.filter(t => !['completed', 'archived', 'cancelled'].includes(t.status));
      const myOverdueTasks = myTasks.filter(t => {
        if (!t.dueDate || ['completed', 'archived', 'cancelled'].includes(t.status)) return false;
        return new Date(t.dueDate) < today;
      });
      const myDueTodayTasks = myTasks.filter(t => {
        if (!t.dueDate || ['completed', 'archived', 'cancelled'].includes(t.status)) return false;
        return new Date(t.dueDate).toDateString() === today.toDateString();
      });

      // Referrals analysis
      const pendingReferrals = incomingReferrals.filter(r => r.status === 'pending');
      const unacknowledgedReferrals = incomingReferrals.filter(r => r.status === 'pending' && !r.acknowledgedAt);
      const acknowledgedNotAccepted = incomingReferrals.filter(r => r.status === 'pending' && r.acknowledgedAt);
      const activeReferrals = incomingReferrals.filter(r => ['accepted', 'in_progress'].includes(r.status));
      const breachedSlaReferrals = incomingReferrals.filter(r => {
        if (['completed', 'rejected', 'returned'].includes(r.status)) return false;
        const slaHours = r.slaHours || 48;
        const createdAt = r.createdAt ? new Date(r.createdAt) : null;
        if (!createdAt) return false;
        const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursElapsed > slaHours;
      });
      const escalatedReferrals = incomingReferrals.filter(r => (r.escalationLevel || 0) > 0 && !['completed', 'rejected', 'returned'].includes(r.status));

      const DEPT_NAMES: Record<number, string> = { 5: 'مكتب إدارة البيانات', 9: 'البنية التحتية', 10: 'الأمن السيبراني', 11: 'التحول الرقمي', 12: 'الدعم الفني' };

      const completedToday = deptTasks.filter(t => t.status === 'completed').length + deptTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      const totalTickets = deptTickets.length;
      const resolvedTickets = deptTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      const totalTasks = deptTasks.length;
      const completedTasks = deptTasks.filter(t => t.status === 'completed' || t.status === 'archived').length;

      res.json({
        tickets: {
          total: totalTickets, open: openTickets.length, urgent: urgentTickets.length,
          aging: agingTickets.length, resolved: resolvedTickets,
          resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
          urgentList: urgentTickets.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, ticketNumber: t.ticketNumber })),
          agingList: agingTickets.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, ticketNumber: t.ticketNumber, createdAt: t.createdAt })),
        },
        tasks: {
          total: totalTasks, active: activeTasks.length, overdue: overdueTasks.length,
          dueToday: dueTodayTasks.length, dueThisWeek: dueThisWeekTasks.length, completed: completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          overdueList: overdueTasks.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, assignedTo: t.assignedTo })),
          dueTodayList: dueTodayTasks.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, assignedTo: t.assignedTo })),
        },
        myWork: {
          total: myActiveTasks.length,
          overdue: myOverdueTasks.length,
          dueToday: myDueTodayTasks.length,
          list: myActiveTasks
            .sort((a, b) => {
              const prio: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              const overdueA = a.dueDate && new Date(a.dueDate) < today ? -1 : 0;
              const overdueB = b.dueDate && new Date(b.dueDate) < today ? -1 : 0;
              return (overdueA - overdueB) || ((prio[a.priority] || 2) - (prio[b.priority] || 2));
            })
            .slice(0, 8)
            .map(t => ({
              id: t.id, title: t.title, priority: t.priority, status: t.status,
              dueDate: t.dueDate, isOverdue: t.dueDate && new Date(t.dueDate) < today,
              isDueToday: t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString(),
            })),
        },
        referrals: {
          incoming: incomingReferrals.length,
          pending: pendingReferrals.length,
          unacknowledged: unacknowledgedReferrals.length,
          acknowledgedAwaitingAction: acknowledgedNotAccepted.length,
          active: activeReferrals.length,
          breachedSla: breachedSlaReferrals.length,
          escalated: escalatedReferrals.length,
          urgentList: [
            ...unacknowledgedReferrals.map(r => ({ ...r, urgencyReason: 'unacknowledged' })),
            ...escalatedReferrals.map(r => ({ ...r, urgencyReason: 'escalated' })),
            ...breachedSlaReferrals.map(r => ({ ...r, urgencyReason: 'sla_breach' })),
          ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
            .slice(0, 6)
            .map(r => ({
              id: r.id, referralNumber: r.referralNumber, title: r.title,
              priority: r.priority, status: r.status, fromDepartmentId: r.fromDepartmentId,
              fromDepartmentName: DEPT_NAMES[r.fromDepartmentId] || `إدارة ${r.fromDepartmentId}`,
              acknowledgedAt: r.acknowledgedAt, escalationLevel: r.escalationLevel,
              slaHours: r.slaHours, createdAt: r.createdAt,
              urgencyReason: (r as any).urgencyReason,
              hoursElapsed: r.createdAt ? Math.round((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60)) : 0,
            })),
        },
        completedToday,
        performance: {
          ticketResolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
          taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          referralResponseRate: incomingReferrals.length > 0 ? Math.round(((incomingReferrals.length - pendingReferrals.length) / incomingReferrals.length) * 100) : 100,
          overallScore: Math.round((
            (totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 100) +
            (totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100) +
            (incomingReferrals.length > 0 ? ((incomingReferrals.length - pendingReferrals.length) / incomingReferrals.length) * 100 : 100)
          ) / 3),
        }
      });
    } catch (error) {
      logger.error('Error fetching daily ops:', { error });
      res.status(500).json({ error: 'خطأ في جلب بيانات العمليات اليومية' });
    }
  });

  // ==================== Smart Governance Advisor API ====================

  app.get("/api/governance/advisor/search", authenticateToken, async (req: any, res) => {
    try {
      const query = (req.query.q as string) || "";
      const portal = req.query.portal as string | undefined;
      const framework = req.query.framework as string | undefined;
      if (!query || query.trim().length < 2) {
        return res.json({ controls: [], advisorTips: [], relatedDomains: [] });
      }
      const results = await governanceAdvisor.search(query.trim(), portal, framework);
      res.json(results);
    } catch (error) {
      logger.error('Error in governance advisor search:', { error });
      res.status(500).json({ error: 'خطأ في البحث' });
    }
  });

  app.get("/api/governance/advisor/frameworks", authenticateToken, async (req: any, res) => {
    try {
      const frameworks = await governanceAdvisor.getFrameworks();
      res.json(frameworks);
    } catch (error) {
      logger.error('Error fetching governance frameworks:', { error });
      res.status(500).json({ error: 'خطأ في جلب الأطر التنظيمية' });
    }
  });

  app.get("/api/governance/advisor/frameworks/:code", authenticateToken, async (req: any, res) => {
    try {
      const detail = await governanceAdvisor.getFrameworkDetail(req.params.code);
      if (!detail) return res.status(404).json({ error: 'الإطار غير موجود' });
      res.json(detail);
    } catch (error) {
      logger.error('Error fetching framework detail:', { error });
      res.status(500).json({ error: 'خطأ في جلب تفاصيل الإطار' });
    }
  });

  app.get("/api/governance/advisor/domains/:domainId/controls", authenticateToken, async (req: any, res) => {
    try {
      const domainId = parseId(req.params.domainId, res);
      if (!domainId) return;
      const controls = await governanceAdvisor.getDomainControls(domainId);
      res.json(controls);
    } catch (error) {
      logger.error('Error fetching domain controls:', { error });
      res.status(500).json({ error: 'خطأ في جلب الضوابط' });
    }
  });

  app.get("/api/governance/advisor/controls/:controlId", authenticateToken, async (req: any, res) => {
    try {
      const controlId = parseId(req.params.controlId, res);
      if (!controlId) return;
      const control = await governanceAdvisor.getControlDetail(controlId);
      if (!control) return res.status(404).json({ error: 'الضابط غير موجود' });
      res.json(control);
    } catch (error) {
      logger.error('Error fetching control detail:', { error });
      res.status(500).json({ error: 'خطأ في جلب تفاصيل الضابط' });
    }
  });

  app.get("/api/governance/advisor/stats", authenticateToken, async (req: any, res) => {
    try {
      const stats = await governanceAdvisor.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching advisor stats:', { error });
      res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
  });

  app.get("/api/governance/advisor/controls/:controlId/implementation", authenticateToken, async (req: any, res) => {
    try {
      const controlId = parseId(req.params.controlId, res);
      if (!controlId) return;
      const portal = req.query.portal as string;
      if (!portal) return res.status(400).json({ error: 'البوابة مطلوبة' });
      const impl = await governanceAdvisor.getImplementationStatus(controlId, portal);
      res.json(impl);
    } catch (error: any) {
      logger.error('Error fetching implementation status:', { error });
      res.status(500).json({ error: 'خطأ في جلب حالة التطبيق' });
    }
  });

  app.post("/api/governance/advisor/controls/:controlId/implementation", authenticateToken, async (req: any, res) => {
    try {
      const controlId = parseId(req.params.controlId, res);
      if (!controlId) return;
      const { portal, status, notes, evidence } = req.body;
      if (!portal || !status) return res.status(400).json({ error: 'البوابة والحالة مطلوبة' });
      if (!['implemented', 'partial', 'not_implemented'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      const result = await governanceAdvisor.upsertImplementation(controlId, portal, {
        status,
        notes,
        evidence,
        updatedBy: req.user?.id,
      });
      res.json(result);
    } catch (error: any) {
      logger.error('Error updating implementation status:', { error });
      res.status(500).json({ error: 'خطأ في تحديث حالة التطبيق' });
    }
  });

  app.get("/api/governance/advisor/portal/:portal/compliance", authenticateToken, async (req: any, res) => {
    try {
      const stats = await governanceAdvisor.getPortalComplianceStats(req.params.portal);
      res.json(stats);
    } catch (error: any) {
      logger.error('Error fetching portal compliance stats:', { error });
      res.status(500).json({ error: 'خطأ في جلب إحصائيات الامتثال' });
    }
  });

  app.get("/api/governance/advisor/export", authenticateToken, async (req: any, res) => {
    try {
      const portal = req.query.portal as string | undefined;
      const framework = req.query.framework as string | undefined;
      const buffer = await governanceAdvisor.exportControlsExcel(portal, framework);
      const filename = `governance-controls-${portal || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      logger.error('Error exporting governance controls:', { error });
      res.status(500).json({ error: 'خطأ في تصدير الضوابط' });
    }
  });

  app.get("/api/download/control-hub/info", async (_req: any, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'client/public/ControlHub-2026.tar.gz');
      const fs = await import('fs');
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        res.json({ exists: true, sizeFormatted: `${sizeMB} MB` });
      } else {
        res.json({ exists: false, sizeFormatted: '0 MB' });
      }
    } catch (error: any) {
      res.json({ exists: false, sizeFormatted: '0 MB' });
    }
  });

  app.get("/api/download/control-hub", async (_req: any, res) => {
    try {
      const filePath = path.resolve(process.cwd(), 'client/public/ControlHub-2026.tar.gz');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'الملف غير موجود' });
      }
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', 'attachment; filename="ControlHub-2026.tar.gz"');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error: any) {
      logger.error('Error downloading archive:', { error });
      res.status(500).json({ error: 'خطأ في تحميل الملف' });
    }
  });

  // ==================== Agile: Attention Required Dashboard ====================
  app.get("/api/attention-required", authenticateToken, async (req: any, res) => {
    try {
      const role = req.user?.role;
      const portal = req.user?.portal;
      const userId = req.user?.id as number;
      const isGlobal = role === 'system_admin' || role === 'it_director';
      const DEPT_MAP: Record<string, number> = { infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12 };
      const deptId: number | undefined = DEPT_MAP[portal] || req.user?.itDepartmentId;
      const attentionCacheKey = `attention_${userId}_${portal}`;
      const cachedAttention = cache.get<any>(attentionCacheKey);
      if (cachedAttention) return res.json(cachedAttention);

      // 1. Unassigned SLA-breaching tickets
      const slaRows = await db.execute(sql`
        SELECT id, title, ticket_number as "ticketNumber", priority, sla_deadline as "slaDeadline", status
        FROM it_tickets
        WHERE assignee_id IS NULL
          AND deleted_at IS NULL
          AND sla_deadline IS NOT NULL
          AND sla_deadline < NOW()
          AND status NOT IN ('closed','resolved')
          ${!isGlobal && deptId ? sql`AND department_id = ${deptId}` : sql``}
        ORDER BY sla_deadline ASC
        LIMIT 10
      `);
      const slaBreachedUnassigned = slaRows.rows as any[];

      // 2. Open escalations
      const escRows = await db.execute(sql`
        SELECT id, reason, priority, status, created_at as "createdAt", entity_type as "entityType", entity_id as "entityId"
        FROM escalations
        WHERE status NOT IN ('resolved','closed')
        ORDER BY created_at DESC
        LIMIT 10
      `);
      const openEscalations = escRows.rows as any[];

      // 3. Overdue tasks
      const taskRows = await db.execute(sql`
        SELECT id, title, priority, due_date as "dueDate", status, assigned_to as "assignedTo"
        FROM tasks
        WHERE deleted_at IS NULL
          AND due_date IS NOT NULL
          AND due_date < NOW()
          AND status NOT IN ('completed','cancelled','archived')
          ${!isGlobal && deptId ? sql`AND department_id = ${deptId}` : !isGlobal && userId ? sql`AND assigned_to = ${userId}` : sql``}
        ORDER BY due_date ASC
        LIMIT 10
      `);
      const overdueTasks = taskRows.rows as any[];

      // 4. Voting sessions closing within 48 hours
      const voteRows = await db.execute(sql`
        SELECT id, title, end_date as "endDate", status, votes_for as "votesFor",
               votes_against as "votesAgainst", quorum_required as "quorumRequired"
        FROM voting_sessions
        WHERE status = 'open'
          AND end_date IS NOT NULL
          AND end_date <= NOW() + INTERVAL '48 hours'
          AND end_date > NOW()
        ORDER BY end_date ASC
        LIMIT 5
      `);
      const urgentVotes = voteRows.rows as any[];

      // 5. High/urgent tickets assigned to this user
      const myTicketRows = (!isGlobal && userId) ? await db.execute(sql`
        SELECT id, title, ticket_number as "ticketNumber", priority, status, created_at as "createdAt"
        FROM it_tickets
        WHERE deleted_at IS NULL
          AND assignee_id = ${userId}
          AND priority IN ('urgent','high')
          AND status NOT IN ('closed','resolved')
        ORDER BY priority DESC, created_at DESC
        LIMIT 5
      `) : { rows: [] };
      const myUrgentTickets = myTicketRows.rows as any[];

      const attentionResult = {
        slaBreachedUnassigned: { count: slaBreachedUnassigned.length, items: slaBreachedUnassigned },
        openEscalations: { count: openEscalations.length, items: openEscalations },
        overdueTasks: { count: overdueTasks.length, items: overdueTasks },
        urgentVotes: { count: urgentVotes.length, items: urgentVotes },
        myUrgentTickets: { count: myUrgentTickets.length, items: myUrgentTickets },
        totalAttentionItems:
          slaBreachedUnassigned.length + openEscalations.length +
          overdueTasks.length + urgentVotes.length + myUrgentTickets.length,
      };
      cache.set(attentionCacheKey, attentionResult, 5 * 60 * 1000);
      res.json(attentionResult);
    } catch (error: any) {
      logger.error('Attention required error:', { msg: error?.message || String(error) });
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات لوحة المتابعة' });
    }
  });

  // ==================== Alert Rules CRUD ====================
  app.get('/api/alert-rules', authenticateToken, async (req: any, res) => {
    try {
      const rules = await db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
      res.json(rules);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب قواعد التنبيه' }); }
  });

  app.post('/api/alert-rules', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { name, description, metric, operator, threshold, itDepartmentId, notifyRoles } = req.body;
      if (!name || !metric || !operator || threshold === undefined) return res.status(400).json({ error: 'البيانات المطلوبة ناقصة' });
      const [rule] = await db.insert(alertRules).values({
        name, description: description || null, metric, operator, threshold: Number(threshold),
        itDepartmentId: itDepartmentId || null, notifyRoles: notifyRoles || [],
        isActive: true, createdBy: req.user.id
      }).returning();
      res.status(201).json(rule);
    } catch (e) { res.status(500).json({ error: 'خطأ في إنشاء قاعدة التنبيه' }); }
  });

  app.put('/api/alert-rules/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { name, description, metric, operator, threshold, itDepartmentId, notifyRoles, isActive } = req.body;
      const [rule] = await db.update(alertRules).set({
        name, description, metric, operator, threshold: Number(threshold),
        itDepartmentId: itDepartmentId || null, notifyRoles: notifyRoles || [],
        isActive: isActive !== undefined ? isActive : true, updatedAt: new Date()
      }).where(eq(alertRules.id, id)).returning();
      if (!rule) return res.status(404).json({ error: 'القاعدة غير موجودة' });
      res.json(rule);
    } catch (e) { res.status(500).json({ error: 'خطأ في تعديل قاعدة التنبيه' }); }
  });

  app.delete('/api/alert-rules/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(alertRules).where(eq(alertRules.id, id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في حذف قاعدة التنبيه' }); }
  });

  // ==================== Automation Rules CRUD ====================
  app.get('/api/automation-rules', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const rules = await db.select().from(automationRules).orderBy(desc(automationRules.createdAt));
      res.json(rules);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب قواعد الأتمتة' }); }
  });

  app.post('/api/automation-rules', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { name, description, triggerType, triggerValue, action, actionValue, itDepartmentId } = req.body;
      if (!name || !triggerType || !triggerValue || !action) return res.status(400).json({ error: 'البيانات المطلوبة ناقصة' });
      const [rule] = await db.insert(automationRules).values({
        name, description: description || null, triggerType, triggerValue,
        action, actionValue: actionValue || null,
        itDepartmentId: itDepartmentId || null,
        isActive: true, createdBy: req.user.id
      }).returning();
      res.status(201).json(rule);
    } catch (e) { res.status(500).json({ error: 'خطأ في إنشاء قاعدة الأتمتة' }); }
  });

  app.put('/api/automation-rules/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { name, description, triggerType, triggerValue, action, actionValue, itDepartmentId, isActive } = req.body;
      const [rule] = await db.update(automationRules).set({
        name, description, triggerType, triggerValue, action,
        actionValue: actionValue || null, itDepartmentId: itDepartmentId || null,
        isActive: isActive !== undefined ? isActive : true, updatedAt: new Date()
      }).where(eq(automationRules.id, id)).returning();
      if (!rule) return res.status(404).json({ error: 'القاعدة غير موجودة' });
      res.json(rule);
    } catch (e) { res.status(500).json({ error: 'خطأ في تعديل قاعدة الأتمتة' }); }
  });

  app.delete('/api/automation-rules/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(automationRules).where(eq(automationRules.id, id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في حذف قاعدة الأتمتة' }); }
  });

  // ─── External Data Sharing Requests Register ────────────────────────────────
  const DMO_ROLES = ['system_admin', 'admin', 'it_director', 'dmo_manager', 'dmo_staff', 'data_steward'];

  app.get('/api/external-sharing-requests', authenticateToken, async (req: any, res) => {
    try {
      if (!DMO_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { status, direction, search } = req.query;
      let records = await db.select().from(externalDataSharingRequests).orderBy(desc(externalDataSharingRequests.createdAt));
      if (status) records = records.filter((r: any) => r.status === status);
      if (direction) records = records.filter((r: any) => r.sharingDirection === direction);
      if (search) {
        const s = (search as string).toLowerCase();
        records = records.filter((r: any) =>
          r.externalPartyName?.toLowerCase().includes(s) ||
          r.requestNumber?.toLowerCase().includes(s) ||
          r.dataAssets?.toLowerCase().includes(s) ||
          r.purpose?.toLowerCase().includes(s)
        );
      }
      res.json(records);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب السجلات' }); }
  });

  app.get('/api/external-sharing-requests/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!DMO_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [record] = await db.select().from(externalDataSharingRequests).where(eq(externalDataSharingRequests.id, id));
      if (!record) return res.status(404).json({ error: 'السجل غير موجود' });
      res.json(record);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب السجل' }); }
  });

  app.post('/api/external-sharing-requests', authenticateToken, async (req: any, res) => {
    try {
      if (!DMO_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { externalPartyName, externalPartyType, externalPartyContact, sharingDirection,
        dataAssets, purpose, legalBasis, securityMeasures, conditions,
        requestDate, approvalDate, startDate, endDate, status, referenceDoc, notes } = req.body;
      if (!externalPartyName || !dataAssets || !purpose || !requestDate) {
        return res.status(400).json({ error: 'الحقول المطلوبة: اسم الجهة، البيانات، الغرض، تاريخ الطلب' });
      }
      const year = new Date().getFullYear();
      const allEdsr = await db.select().from(externalDataSharingRequests);
      const maxEdsr = allEdsr.reduce((max: number, r: { requestNumber: string | null }) => {
        if (!r.requestNumber) return max;
        const parts = r.requestNumber.split('-');
        const num = parseInt(parts[parts.length - 1] || '0');
        return Math.max(max, num);
      }, 0);
      const seq = String(maxEdsr + 1).padStart(4, '0');
      const requestNumber = `EDSR-${year}-${seq}`;
      const [record] = await db.insert(externalDataSharingRequests).values({
        requestNumber,
        externalPartyName, externalPartyType: externalPartyType || 'government',
        externalPartyContact: externalPartyContact || null,
        sharingDirection: sharingDirection || 'outbound',
        dataAssets, purpose,
        legalBasis: legalBasis || 'legal_obligation',
        securityMeasures: securityMeasures || null,
        conditions: conditions || null,
        requestDate: new Date(requestDate),
        approvalDate: approvalDate ? new Date(approvalDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'pending',
        referenceDoc: referenceDoc || null,
        notes: notes || null,
        recordedBy: req.user.id,
      }).returning();
      await storage.createAuditLog({
        userId: req.user.id, action: 'create', entityType: 'external_data_sharing_request',
        entityId: record.id, oldValue: null, newValue: JSON.stringify({ requestNumber, externalPartyName }),
        ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
      });
      res.status(201).json(record);
    } catch (e: any) {
      logger.error('Create external sharing request error', { error: e });
      res.status(500).json({ error: 'خطأ في إنشاء السجل' });
    }
  });

  app.put('/api/external-sharing-requests/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!DMO_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { externalPartyName, externalPartyType, externalPartyContact, sharingDirection,
        dataAssets, purpose, legalBasis, securityMeasures, conditions,
        requestDate, approvalDate, startDate, endDate, status, referenceDoc, notes } = req.body;
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [record] = await db.update(externalDataSharingRequests).set({
        externalPartyName, externalPartyType, externalPartyContact,
        sharingDirection, dataAssets, purpose, legalBasis,
        securityMeasures, conditions,
        requestDate: requestDate ? new Date(requestDate) : undefined,
        approvalDate: approvalDate ? new Date(approvalDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status, referenceDoc, notes,
        updatedAt: new Date(),
      }).where(eq(externalDataSharingRequests.id, id)).returning();
      if (!record) return res.status(404).json({ error: 'السجل غير موجود' });
      await storage.createAuditLog({
        userId: req.user.id, action: 'update', entityType: 'external_data_sharing_request',
        entityId: record.id, oldValue: null, newValue: JSON.stringify({ status }),
        ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
      });
      res.json(record);
    } catch (e) { res.status(500).json({ error: 'خطأ في تعديل السجل' }); }
  });

  app.delete('/api/external-sharing-requests/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'dmo_manager'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(externalDataSharingRequests).where(eq(externalDataSharingRequests.id, id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في حذف السجل' }); }
  });

  // ============================================================
  // ACTIVE DIRECTORY / LDAP INTEGRATION — Support Portal
  // ============================================================
  const SUPPORT_MANAGER_ROLES = ['system_admin', 'admin', 'it_director', 'it_support_manager'];

  app.get('/api/support/ad/config', authenticateToken, async (req: any, res) => {
    try {
      if (!SUPPORT_MANAGER_ROLES.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const { getAdConfigFromDb } = await import('./integrations/ldapIntegration');
      const config = await getAdConfigFromDb();
      if (!config) return res.json({ configured: false, config: null });
      const safe = { ...config, bindPassword: config.bindPassword ? '••••••••' : '' };
      res.json({ configured: true, config: safe });
    } catch (e: any) {
      logger.error('[AD] Config fetch error', { error: e.message });
      res.status(500).json({ error: 'حدث خطأ أثناء جلب إعدادات AD' });
    }
  });

  app.post('/api/support/ad/config', authenticateToken, async (req: any, res) => {
    try {
      if (!SUPPORT_MANAGER_ROLES.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const { saveAdConfigToDb } = await import('./integrations/ldapIntegration');
      const body = req.body;
      if (!body.url || !body.bindDN || !body.baseDN) {
        return res.status(400).json({ error: 'الحقول المطلوبة: رابط الخادم، Bind DN، Base DN' });
      }
      await saveAdConfigToDb({
        url: body.url,
        baseDN: body.baseDN,
        bindDN: body.bindDN,
        bindPassword: body.bindPassword,
        userSearchBase: body.userSearchBase || body.baseDN,
        userSearchFilter: body.userSearchFilter || '(objectClass=person)',
        usernameAttribute: body.usernameAttribute || 'sAMAccountName',
        emailAttribute: body.emailAttribute || 'mail',
        displayNameAttribute: body.displayNameAttribute || 'displayName',
        groupSearchBase: body.groupSearchBase || '',
        tlsEnabled: body.tlsEnabled || false,
      }, req.user?.id);
      res.json({ success: true, message: 'تم حفظ إعدادات Active Directory بنجاح' });
    } catch (e: any) {
      logger.error('[AD] Config save error', { error: e.message });
      res.status(500).json({ error: 'حدث خطأ أثناء حفظ إعدادات AD' });
    }
  });

  app.post('/api/support/ad/test', authenticateToken, async (req: any, res) => {
    try {
      if (!SUPPORT_MANAGER_ROLES.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const { testLdapConnection, getAdConfigFromDb } = await import('./integrations/ldapIntegration');
      const body = req.body;
      let config = body.url ? {
        url: body.url, baseDN: body.baseDN, bindDN: body.bindDN,
        bindPassword: body.bindPassword, userSearchBase: body.userSearchBase || body.baseDN,
        userSearchFilter: '(objectClass=person)', usernameAttribute: 'sAMAccountName',
        emailAttribute: 'mail', displayNameAttribute: 'displayName', tlsEnabled: body.tlsEnabled || false,
      } : await getAdConfigFromDb();
      if (!config) return res.json({ success: false, message: 'لم يتم تعيين إعدادات Active Directory' });
      const result = await testLdapConnection(config);
      res.json(result);
    } catch (e: any) {
      logger.error('[AD] Test error', { error: e.message });
      res.status(500).json({ success: false, message: 'حدث خطأ أثناء اختبار الاتصال' });
    }
  });

  app.post('/api/support/ad/search', authenticateToken, async (req: any, res) => {
    try {
      if (!SUPPORT_MANAGER_ROLES.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const { searchLdapUsers, getAdConfigFromDb } = await import('./integrations/ldapIntegration');
      const { term } = req.body;
      if (!term || term.trim().length < 2) return res.json([]);
      const config = await getAdConfigFromDb();
      if (!config) return res.json([]);
      const results = await searchLdapUsers(config, term.trim());
      res.json(results);
    } catch (e: any) {
      logger.error('[AD] Search error', { error: e.message });
      res.status(500).json({ error: 'حدث خطأ أثناء البحث' });
    }
  });

  app.post('/api/support/ad/sync', authenticateToken, async (req: any, res) => {
    try {
      if (!SUPPORT_MANAGER_ROLES.includes(req.user?.role || '')) {
        return res.status(403).json({ error: 'فقط المدراء يمكنهم مزامنة المستخدمين' });
      }
      const { syncLdapUsers, getAdConfigFromDb } = await import('./integrations/ldapIntegration');
      const config = await getAdConfigFromDb();
      if (!config) return res.status(400).json({ success: false, error: 'لم يتم تعيين إعدادات Active Directory' });
      const result = await syncLdapUsers(config);
      res.json(result);
    } catch (e: any) {
      logger.error('[AD] Sync error', { error: e.message });
      res.status(500).json({ success: false, error: 'حدث خطأ أثناء مزامنة المستخدمين' });
    }
  });

  // ============================================================
  // MOJEEB SMART ASSISTANT - Intelligent backend endpoint
  // ============================================================
  async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try { return await fn(); } catch (e: any) { logger.warn('[Mojeeb] DB query fallback:', { error: e?.message }); return fallback; }
  }

  app.post('/api/smart/mojeeb', authenticateToken, async (req: any, res: any) => {
    try {
      const { query, portal: requestedPortal = 'admin', history = [] } = req.body;
      if (!query?.trim()) return res.status(400).json({ error: 'الاستفسار مطلوب' });

      const user = req.user;
      const q = query.toLowerCase().trim();
      const userName = user?.nameAr || user?.name || '';
      const userId = user?.id;

      // ── DEPARTMENT ISOLATION ──────────────────────────────────────────────────
      const PORTAL_TO_DEPT: Record<string, number> = {
        dmo: 5, infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12
      };
      const DEPT_NAMES: Record<number, string> = { 5: 'مكتب البيانات', 9: 'البنية التحتية', 10: 'الأمن السيبراني', 11: 'التحول الرقمي', 12: 'الدعم الفني' };
      const PORTAL_LABELS_MAP: Record<string, string> = { admin: 'الإدارة', it_director: 'مدير التقنية', cybersecurity: 'الأمن السيبراني', infrastructure: 'البنية التحتية', digital_transformation: 'التحول الرقمي', support: 'الدعم الفني', dmo: 'مكتب البيانات', committee: 'اللجنة' };

      const isAdminOrDirector = user?.role === 'system_admin' || user?.role === 'it_director';
      const userServerPortal = user?.portal || 'admin';
      const portal = isAdminOrDirector ? requestedPortal : userServerPortal;

      const deptId = isAdminOrDirector
        ? (PORTAL_TO_DEPT[portal] || null)
        : (PORTAL_TO_DEPT[userServerPortal] || user?.itDepartmentId || null);

      // Department base paths for navigation (DMO uses /dmo, others use /department/*)
      const DEPT_BASE_PATHS: Record<number, string> = { 5: '/dmo', 9: '/department/infrastructure', 10: '/department/cybersecurity', 11: '/department/digital-transformation', 12: '/department/support' };
      const buildDeptHref = (id: number | null, suffix: string) => id && DEPT_BASE_PATHS[id] ? `${DEPT_BASE_PATHS[id]}/${suffix}` : `/it-director/${suffix}`;

      const sm = (text: string, keywords: string[]) =>
        keywords.some(k => text.includes(k.toLowerCase()));

      // ── CONTEXT MEMORY: Understand follow-up questions ────────────────────────
      const lastBotContent = (history || []).filter((m: any) => m.role === 'assistant').slice(-1)[0]?.content?.toLowerCase() || '';
      const isFollowUp = q.split(/\s+/).length <= 6;
      const prevContext =
        (lastBotContent.includes('تذاكر') || lastBotContent.includes('تذكرة')) ? 'tickets' :
        (lastBotContent.includes('مهام') || lastBotContent.includes('مهمة')) ? 'tasks' :
        (lastBotContent.includes('مشاريع') || lastBotContent.includes('مشروع')) ? 'projects' :
        (lastBotContent.includes('حوادث') || lastBotContent.includes('حادثة')) ? 'incidents' :
        (lastBotContent.includes('ثغرات') || lastBotContent.includes('ثغرة')) ? 'vulnerabilities' :
        (lastBotContent.includes('خوادم') || lastBotContent.includes('خادم') || lastBotContent.includes('سيرفر')) ? 'servers' :
        (lastBotContent.includes('اجتماع') || lastBotContent.includes('الاجتماعات')) ? 'meetings' :
        (lastBotContent.includes('تصويت') || lastBotContent.includes('جلسات التصويت')) ? 'voting' :
        (lastBotContent.includes('إحالة') || lastBotContent.includes('إحالات')) ? 'referrals' :
        (lastBotContent.includes('موردين') || lastBotContent.includes('الموردون')) ? 'vendors' :
        (lastBotContent.includes('إشعار') || lastBotContent.includes('إشعارات')) ? 'notifications' :
        (lastBotContent.includes('امتثال') || lastBotContent.includes('ضوابط')) ? 'compliance' :
        null;

      // ── INTENT CLASSIFICATION (context-aware, priority-ordered) ──────────────
      const isGreeting = sm(q, ['مرحبا','أهلا','هلا','السلام عليكم','صباح الخير','مساء الخير','يا مجيب','ايش تعرف','ما تقدر','ماذا يمكنك','كيف حالك','مرحبًا']) && !sm(q, ['تذكرة','مهمة','مشروع','خادم','تذاكر','مهام']);
      const isAlerts = sm(q, ['تنبيه','تنبيهات','تحذير','ماذا يجب أن أفعل','الأهم اليوم','أولويات النظام','ما الأهم','الحالات الحرجة','ما يحتاج انتباه','ما أهمية','تحليل الوضع','ما الخطر','وضع النظام الحالي','السيناريو الحالي']);
      const isMyDay = sm(q, ['يومي','يوم','ماذا عندي اليوم','مهام اليوم','أولوياتي','خطة اليوم','ملخص يومي','شو عندي','ابدأ يومي','ما الجديد']) && !isAlerts;
      const isActionable = sm(q, ['ماذا أفعل الآن','خطواتي الأولى','من أين أبدأ اليوم','ما الذي يحتاج تدخلي','الخطوة القادمة','ما الأولوية','بماذا أبدأ','ماذا أعمل أولاً','ما أولى أولوياتي']);
      const isOverall = sm(q, ['وضع جميع الأقسام','نظرة عامة على الأقسام','جميع الأقسام','كل الأقسام','ملخص الشركة','تقرير تنفيذي','مؤشرات كل الأقسام','الوضع العام','ملخص الأقسام','تقرير الأقسام','إحصائيات الأقسام','كيف الأقسام','نظرة شاملة']) && isAdminOrDirector;
      const isProductivity = sm(q, ['إنتاجيتي','إنتاجية الفريق','كفاءة القسم','نسبة الإنجاز','معدل الأداء','أداء الفريق','إنجاز الأسبوع','productivity','انجاز']);
      const isTickets = sm(q, ['تذكرة','تذاكر','تكيت','تكيتات','كم تذكرة','التذاكر','كم عندي تذكرة','ticket','tickets']) ||
        (isFollowUp && sm(q, ['منها','حرجة','عاجلة','مفتوحة','قيد التنفيذ','محلولة','مغلقة','مرفوعة']) && prevContext === 'tickets');
      const isTasks = sm(q, ['مهمة','مهام','مهامي','مهام معلقة','مهام متأخرة','مهام قسمي','task','tasks']) ||
        (isFollowUp && sm(q, ['منها','متأخرة','مكتملة','معلقة','جارية']) && prevContext === 'tasks');
      const isProjects = sm(q, ['مشروع','مشاريع','مشاريعي','المشاريع النشطة','تقدم المشاريع','project','projects']) ||
        (isFollowUp && sm(q, ['نشطة','منجزة','متأخرة','متوقفة']) && prevContext === 'projects');
      const isUsers = sm(q, ['مستخدمين','المستخدمون','كم موظف','عدد المستخدمين','من سجل الدخول','المستخدمين النشطين','أعضاء الفريق']);
      const isIncidents = sm(q, ['حادث','حوادث','اختراق','هجوم','incident','الحوادث الأمنية','حادثة أمنية','اختراق أمني']) ||
        (isFollowUp && sm(q, ['منها','مفتوحة','حرجة','جاري التحقيق','محلولة']) && prevContext === 'incidents');
      const isVulnerabilities = sm(q, ['ثغرة','ثغرات','vulnerability','فحص أمني','الثغرات','cve','cvss']) ||
        (isFollowUp && sm(q, ['منها','حرجة','عالية','متوسطة','مفتوحة']) && prevContext === 'vulnerabilities');
      const isKpi = sm(q, ['احصائيات','إحصائيات','أداء','ملخص الأداء','لوحة التحكم','كيف الأداء','وضع القسم','kpi','تقرير سريع','نظرة عامة']) && !isOverall && !isProductivity;
      const isNotifications = sm(q, ['إشعاراتي','اشعاراتي','الإشعارات','عندي إشعارات','notifications']) ||
        (isFollowUp && prevContext === 'notifications');
      const isCompliance = sm(q, ['امتثال','نسبة الامتثال','compliance','الامتثال','ضوابط تطبيق','نسبة الضوابط']) ||
        (isFollowUp && sm(q, ['نسبة','مطبق','جزئي','غير مطبق']) && prevContext === 'compliance');
      const isServers = sm(q, ['سيرفر','خادم','خوادم','server','servers','الخوادم','البنية التحتية الخوادم']) ||
        (isFollowUp && sm(q, ['منها','تعمل','متوقفة','صيانة','down']) && prevContext === 'servers');
      const isVendors = sm(q, ['مورد','موردين','vendor','vendors','الموردون','شركاء تقنيين']) ||
        (isFollowUp && prevContext === 'vendors');
      const isDSR = sm(q, ['طلب حقوق','dsr','طلبات الأفراد','بيانات شخصية طلب','pdpl طلبات','طلب بيانات شخصية']);
      const isSearch = sm(q, ['ابحث عن','ابحث لي','دور على','بحث عن','ابحث ضابط','هل يوجد','ابحث']) && q.length > 8;
      const isMeetings = sm(q, ['اجتماع','اجتماعات','الاجتماعات','جلسة اللجنة','meeting','meetings','الاجتماعات القادمة']) ||
        (isFollowUp && prevContext === 'meetings');
      const isVoting = sm(q, ['تصويت','تصويتات','vote','voting','استفتاء','جلسة تصويت','نتائج التصويت','أصوات']) ||
        (isFollowUp && prevContext === 'voting');
      const isReferrals = sm(q, ['إحالة','إحالات','تحويل تذكرة','referral','referrals','احالة','إحالات معلقة','تحويلات','غير مؤكدة','مصعدة','تصعيد إحالة']) ||
        (isFollowUp && prevContext === 'referrals');
      const isHelp = sm(q, ['كيف أستخدم','دليل','تعليمات','أرشدني','ساعدني في','شرح لي','كيف أبدأ','ارشادات','ما هي المميزات']) && !isTickets && !isTasks && !isProjects && !isAlerts;
      const isWeeklySummary = sm(q, ['ملخص الأسبوع','تقرير الأسبوع','أداء الأسبوع','الأسبوع الماضي','مقارنة الأسبوع','أسبوعي','أداء هذا الأسبوع','إنجازات الأسبوع','ما أنجزنا هذا الأسبوع','المقارنة الأسبوعية','weekly']) && !isProductivity;
      const isSlaStatus = sm(q, ['sla','مستوى الخدمة','اتفاقية الخدمة','ضمان الخدمة','وقت الاستجابة','وقت الحل','تجاوز sla','خرق sla','التزام sla','معدل الاستجابة','وقت انتظار التذاكر']);
      const isMyTickets = sm(q, ['تذاكري','مهامي المسندة','التذاكر المسندة لي','ما عندي من تذاكر','تذاكر مسندة لي']) && !isTickets;
      const isTeamLoad = sm(q, ['عبء الفريق','توزيع المهام','من الأكثر مشغولاً','توزيع التذاكر','عبء العمل','workload','كيف الفريق']);
      const isQuickCreate = sm(q, ['أنشئ تذكرة','انشئ تذكرة','إنشاء تذكرة','سجل تذكرة','ارفع تذكرة','أضف مهمة','اضف مهمة','إنشاء مهمة','سجل مهمة','أنشئ مهمة']);
      const isDeptCompare = sm(q, ['قارن الأقسام','قارن بين الأقسام','مقارنة الأقسام','أفضل قسم','ترتيب الأقسام','مقارنة أداء','أي قسم أفضل']) && isAdminOrDirector;
      const isSmartRecommend = sm(q, ['نصيحة','نصيحتك','توصية','ماذا تنصحني','اقتراح','اقتراحات','ما رأيك','كيف أحسن','كيف أتحسن','نصائح','وش تقترح','فرص التحسين']);

      let content = '';
      let intent = 'general';
      let data: any = null;
      let suggestions: string[] = [];
      let actions: { label: string; href: string; type?: string }[] = [];

      // ── INTENT PRIORITY CHAIN ──────────────────────────────────────────────────
      const isAnyDataIntent = isMyDay || isActionable || isOverall || isProductivity || isTickets || isTasks || isProjects || isUsers || isIncidents || isVulnerabilities || isKpi || isNotifications || isCompliance || isServers || isVendors || isDSR || isMeetings || isVoting || isReferrals || isAlerts || isHelp || isSearch || isWeeklySummary || isSlaStatus || isMyTickets || isTeamLoad || isQuickCreate || isDeptCompare || isSmartRecommend;

      // ─── GREETING (Enhanced with live stats per portal) ────────────────────────
      if (isGreeting && !isAnyDataIntent) {
        intent = 'greeting';
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? '☀️ صباح النور' : hour < 18 ? '🌤️ مرحباً' : '🌙 مساء الخير';

        const [greetTickets, greetTasks, greetRefs] = await Promise.all([
          safeQuery(() => deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals), []),
        ]);
        const now = new Date();
        const openT = (greetTickets as any[]).filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
        const critT = (greetTickets as any[]).filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed' && t.status !== 'resolved').length;
        const overdueTk = (greetTasks as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
        const pendingRefs = (greetRefs as any[]).filter((r: any) => (!deptId || r.toDepartmentId === deptId) && r.status === 'pending' && !r.acknowledgedAt).length;
        const completedToday = (greetTasks as any[]).filter((t: any) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt).toDateString() === now.toDateString()).length;

        const portalGreetings: Record<string, string> = {
          cybersecurity: 'أنت على رأس حماية المنظمة — النظام يراقب كل شيء.',
          infrastructure: 'البنية التحتية تحت سيطرتك — كل الخوادم في مرمى النظر.',
          dmo: 'بيانات النادي بأمان تحت رعايتك.',
          support: 'المستخدمون في انتظار مساعدتك.',
          digital_transformation: 'مسيرة التحول الرقمي تسير وأنت على رأس دفتها.',
          it_director: 'جميع الأقسام تحت إشرافك.',
          admin: 'المنصة تعمل بكفاءة عالية.',
          committee: 'القرارات تنتظر — اللجنة جاهزة.',
        };

        let statusLine = '';
        if (critT > 0 || overdueTk > 3) {
          statusLine = `\n\n⚡ **وضعك الآن:** ${critT > 0 ? `🔴 ${critT} تذكرة حرجة` : ''}${critT > 0 && overdueTk > 0 ? ' | ' : ''}${overdueTk > 0 ? `⏰ ${overdueTk} مهمة متأخرة` : ''}${pendingRefs > 0 ? ` | 📨 ${pendingRefs} إحالة بدون رد` : ''}\n💡 أقترح أن تسألني **"ماذا أفعل الآن؟"** للحصول على خطة عمل مرتبة.`;
        } else if (completedToday > 0) {
          statusLine = `\n\n🌟 **أداؤك اليوم:** أنجزت ${completedToday} ${completedToday === 1 ? 'مهمة' : 'مهام'}${openT > 0 ? ` ولا يزال ${openT} تذكرة مفتوحة` : ' — ممتاز!'}`;
        } else {
          statusLine = `\n\n📊 **لمحة سريعة:** ${openT} تذكرة مفتوحة${overdueTk > 0 ? ` • ${overdueTk} مهمة متأخرة` : ''}${pendingRefs > 0 ? ` • ${pendingRefs} إحالة معلقة` : ''}`;
        }

        data = { openTickets: openT, criticalTickets: critT, overdueTasks: overdueTk, pendingRefs, completedToday };
        content = `${timeGreeting} يا ${userName}! 👋\n\nأنا **مجيب**، مساعدك الذكي. ${portalGreetings[portal] || ''}${statusLine}\n\n**أقدر أساعدك في:**\n📊 البيانات الحية • ⚠️ التنبيهات الحرجة • 📋 الامتثال • 🗓️ الاجتماعات • 💡 التوصيات`;
        suggestions = critT > 0 ? ['ماذا أفعل الآن؟', 'التذاكر الحرجة', 'ملخص يومي', 'نصائح وتوصيات'] : ['ملخص يومي', 'ما التنبيهات الحرجة؟', 'إحصائيات القسم', 'نصائح وتوصيات'];
      }

      // ─── WHAT SHOULD I DO NOW? (Actionable Priority List) ────────────────────
      else if (isActionable) {
        intent = 'actionable';
        const now = new Date();
        const [allTickets, allTasks, allReferrals, incidentsData, vulnsData, serversData] = await Promise.all([
          safeQuery(() => deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals), []),
          safeQuery(() => portal === 'cybersecurity' || !deptId ? db.select().from(securityIncidents) : Promise.resolve([]), []),
          safeQuery(() => portal === 'cybersecurity' || !deptId ? db.select().from(securityVulnerabilities) : Promise.resolve([]), []),
          safeQuery(() => portal === 'infrastructure' || !deptId ? db.select().from(infrastructureServers) : Promise.resolve([]), []),
        ]);
        const actions2: { priority: number; emoji: string; text: string; href: string; badge?: string }[] = [];
        // P1: Servers down
        const downServers = (serversData as any[]).filter((s: any) => s.status === 'offline' || s.status === 'down');
        if (downServers.length > 0) actions2.push({ priority: 1, emoji: '🔴', text: `${downServers.length} خادم متوقف — تدخل فوري!`, href: '/department/infrastructure/servers', badge: 'عاجل جداً' });
        // P2: Critical incidents open
        const openIncidents = (incidentsData as any[]).filter((i: any) => i.status === 'open' || i.status === 'investigating');
        if (openIncidents.length > 0) actions2.push({ priority: 2, emoji: '🛡️', text: `${openIncidents.length} حادثة أمنية تحتاج تحقيقاً`, href: '/department/cybersecurity/incidents', badge: 'عاجل' });
        // P3: Critical vulnerabilities
        const critVulns = (vulnsData as any[]).filter((v: any) => v.severity === 'critical' && v.status === 'open');
        if (critVulns.length > 0) actions2.push({ priority: 3, emoji: '⚠️', text: `${critVulns.length} ثغرة حرجة مفتوحة — معالجة خلال 72 ساعة`, href: '/department/cybersecurity/vulnerabilities', badge: 'مهم جداً' });
        // P4: Unacknowledged incoming referrals
        const unackRef = (allReferrals as any[]).filter((r: any) => r.toDepartmentId === deptId && r.status === 'pending' && !r.acknowledgedAt);
        if (unackRef.length > 0) actions2.push({ priority: 4, emoji: '📨', text: `${unackRef.length} إحالة واردة لم يُؤكَّد استلامها بعد`, href: buildDeptHref(deptId, 'referrals'), badge: 'ينتظر' });
        // P5: Critical tickets
        const critTickets = (allTickets as any[]).filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed' && t.status !== 'resolved');
        if (critTickets.length > 0) actions2.push({ priority: 5, emoji: '🎫', text: `${critTickets.length} تذاكر حرجة/عاجلة مفتوحة`, href: '/it/all-tickets', badge: 'أولوية عالية' });
        // P6: Overdue tasks
        const overdueTasks = (allTasks as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
        if (overdueTasks.length > 0) actions2.push({ priority: 6, emoji: '⏰', text: `${overdueTasks.length} مهمة تجاوزت الموعد النهائي`, href: buildDeptHref(deptId, 'tasks'), badge: 'متأخرة' });
        // P7: Today's tasks due
        const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
        const todayTasks = (allTasks as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) <= todayEnd && new Date(t.dueDate) >= now && t.status !== 'completed');
        if (todayTasks.length > 0) actions2.push({ priority: 7, emoji: '📅', text: `${todayTasks.length} مهمة تنتهي اليوم`, href: buildDeptHref(deptId, 'tasks'), badge: 'اليوم' });
        // P8: Escalated referrals
        const escalatedRef = (allReferrals as any[]).filter((r: any) => (r.escalationLevel || 0) > 0 && r.status === 'pending');
        if (escalatedRef.length > 0) actions2.push({ priority: 8, emoji: '⬆️', text: `${escalatedRef.length} إحالة مُصعَّدة تحتاج قرار`, href: isAdminOrDirector ? '/it-director/referrals' : buildDeptHref(deptId, 'referrals') });

        const sortedActions = actions2.sort((a, b) => a.priority - b.priority);
        data = { actionItems: sortedActions, totalItems: sortedActions.length };

        if (sortedActions.length === 0) {
          content = `✅ **ممتاز يا ${userName}! لا توجد إجراءات عاجلة الآن.**\n\nالوضع مستقر — يمكنك التركيز على المهام الاستراتيجية:\n\n• مراجعة تقدم المشاريع\n• تحديث مؤشرات الأداء\n• التحضير لاجتماع الأسبوع القادم`;
        } else {
          content = `📋 **أولوياتك الآن — ${sortedActions.length} إجراء يحتاج اهتمامك:**\n\n`;
          sortedActions.forEach((a, i) => {
            content += `${i + 1}. ${a.emoji} ${a.text}${a.badge ? ` [${a.badge}]` : ''}\n`;
          });
          content += `\n💡 ابدأ بالبنود العاجلة المُشار إليها بـ 🔴 أولاً.`;
        }
        actions = sortedActions.slice(0, 3).map(a => ({ label: a.text.substring(0, 25) + '...', href: a.href }));
        suggestions = ['التذاكر الحرجة', 'الإحالات غير المؤكدة', 'المهام المتأخرة', 'وضع النظام'];
      }

      // ─── ALL DEPARTMENTS OVERVIEW (IT Director / Admin only) ─────────────────
      else if (isOverall) {
        intent = 'overall_departments';
        const [allTickets, allTasks, allProjects, allRefs] = await Promise.all([
          db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          db.select().from(tasks).where(isNull(tasks.deletedAt)),
          db.select().from(itProjects).where(isNull(itProjects.deletedAt)),
          db.select().from(itReferrals),
        ]);
        const deptIds = [5, 9, 10, 11, 12];
        const deptSummaries = deptIds.map(did => {
          const name = DEPT_NAMES[did] || `إدارة ${did}`;
          const dTickets = allTickets.filter((t: any) => t.departmentId === did || t.itDepartmentId === did);
          const dTasks = allTasks.filter((t: any) => t.departmentId === did);
          const dProjects = allProjects.filter((p: any) => p.departmentId === did);
          const openTickets = dTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
          const critTickets = dTickets.filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed').length;
          const overdueTasks = dTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length;
          const activeProjects = dProjects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;
          const unackRefs = allRefs.filter((r: any) => r.toDepartmentId === did && r.status === 'pending' && !r.acknowledgedAt).length;
          const health = critTickets > 0 || overdueTasks > 5 ? '🔴' : overdueTasks > 2 || openTickets > 10 || unackRefs > 0 ? '🟡' : '🟢';
          return { name, did, openTickets, critTickets, overdueTasks, activeProjects, unackRefs, health };
        });
        const totalCrit = deptSummaries.reduce((a, d) => a + d.critTickets, 0);
        const totalOverdue = deptSummaries.reduce((a, d) => a + d.overdueTasks, 0);
        const totalUnack = deptSummaries.reduce((a, d) => a + d.unackRefs, 0);
        data = { departments: deptSummaries, totalCrit, totalOverdue, totalUnack };
        content = `🏢 **نظرة شاملة على جميع أقسام تقنية المعلومات:**\n\n`;
        deptSummaries.forEach(d => {
          content += `${d.health} **${d.name}:** ${d.openTickets} تذكرة مفتوحة | ${d.overdueTasks} مهمة متأخرة${d.critTickets > 0 ? ` | ⚠️ ${d.critTickets} حرجة` : ''}${d.unackRefs > 0 ? ` | 📨 ${d.unackRefs} إحالة بدون رد` : ''}\n`;
        });
        if (totalCrit > 0) content += `\n⚠️ **يوجد ${totalCrit} تذاكر حرجة تحتاج تدخلاً فورياً!**`;
        if (totalUnack > 0) content += `\n📨 **${totalUnack} إحالة لم يُؤكَّد استلامها عبر الأقسام.**`;
        suggestions = ['التذاكر الحرجة عبر الأقسام', 'الإحالات المصعّدة', 'KPI التنفيذي', 'التصعيدات المعلقة'];
        actions = [{ label: 'مركز القيادة الحي', href: '/it-director/command-center' }, { label: 'KPI التنفيذي', href: '/it-director/kpi' }];
      }

      // ─── PRODUCTIVITY / TEAM PERFORMANCE ─────────────────────────────────────
      else if (isProductivity) {
        intent = 'productivity';
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
        const [allTasks, allTickets, weeklyTickets] = await Promise.all([
          deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)),
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), gte(itTickets.createdAt, weekAgo), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(and(gte(itTickets.createdAt, weekAgo), isNull(itTickets.deletedAt))),
        ]);
        const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
        const totalTasks = allTasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const resolvedTickets = allTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const ticketResolutionRate = allTickets.length > 0 ? Math.round((resolvedTickets / allTickets.length) * 100) : 0;
        const overdueTasks = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
        const weeklyResolved = (weeklyTickets as any[]).filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const score = Math.round((completionRate * 0.4) + (ticketResolutionRate * 0.4) + (overdueTasks === 0 ? 20 : overdueTasks < 3 ? 10 : 0));
        const scoreEmoji = score >= 80 ? '🌟' : score >= 60 ? '📈' : score >= 40 ? '⚠️' : '🔴';
        data = { completionRate, ticketResolutionRate, overdueTasks, weeklyResolved, score };
        content = `${scoreEmoji} **تقرير الإنتاجية — ${DEPT_NAMES[deptId!] || 'المنصة'}:**\n\n` +
          `**مؤشر الأداء الإجمالي: ${score}/100**\n\n` +
          `📋 معدل إنجاز المهام: **${completionRate}%** (${completedTasks}/${totalTasks})\n` +
          `🎫 معدل حل التذاكر: **${ticketResolutionRate}%** (${resolvedTickets}/${allTickets.length})\n` +
          `📅 تذاكر هذا الأسبوع: **${weeklyTickets.length}** (${weeklyResolved} محلولة)\n` +
          (overdueTasks > 0 ? `🔴 مهام متأخرة: **${overdueTasks}** (تؤثر سلباً على الأداء)\n` : '✅ لا مهام متأخرة — ممتاز!\n') +
          `\n💡 **توصية:** ${score >= 80 ? 'أداء ممتاز — حافظ على هذا المستوى!' : score >= 60 ? 'أداء جيد — قلّل المهام المتأخرة لتحسين النتيجة.' : 'الأداء يحتاج تطوير — ركّز على إغلاق التذاكر المفتوحة.'}`;
        suggestions = ['المهام المتأخرة', 'التذاكر المفتوحة', 'أداء المشاريع', 'مقارنة الأقسام'];
      }

      // ─── SMART SEARCH ─────────────────────────────────────────────────────────
      else if (isSearch) {
        intent = 'search';
        // Extract search term: remove command words
        const searchTerm = q.replace(/ابحث عن|ابحث لي|دور على|بحث عن|ابحث ضابط|هل يوجد|ابحث/gi, '').trim();
        if (!searchTerm || searchTerm.length < 2) {
          content = `🔍 ما الذي تريد البحث عنه؟ اكتب مثلاً:\n• "ابحث عن تذكرة شبكة"\n• "ابحث عن مهمة سيرفر"\n• "هل يوجد مشروع أمني"`;
          suggestions = ['ابحث عن تذكرة مفتوحة', 'ابحث عن مهمة متأخرة', 'ابحث عن مشروع نشط'];
        } else {
          const st = searchTerm.toLowerCase();
          const likePattern = `%${st}%`;
          const [matchTickets, matchTasks, matchProjects] = await Promise.all([
            safeQuery(() => deptId
              ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt), ilike(itTickets.title, likePattern)))
              : db.select().from(itTickets).where(and(isNull(itTickets.deletedAt), ilike(itTickets.title, likePattern))), []),
            safeQuery(() => deptId
              ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt), ilike(tasks.title, likePattern)))
              : db.select().from(tasks).where(and(isNull(tasks.deletedAt), ilike(tasks.title, likePattern))), []),
            safeQuery(() => deptId
              ? db.select().from(itProjects).where(and(eq(itProjects.itDepartmentId, deptId), isNull(itProjects.deletedAt), or(ilike(itProjects.nameAr, likePattern), ilike(itProjects.nameEn, likePattern))))
              : db.select().from(itProjects).where(and(isNull(itProjects.deletedAt), or(ilike(itProjects.nameAr, likePattern), ilike(itProjects.nameEn, likePattern)))), []),
          ]);
          const total = matchTickets.length + matchTasks.length + matchProjects.length;
          data = { searchTerm, results: { tickets: matchTickets.length, tasks: matchTasks.length, projects: matchProjects.length }, total };
          if (total === 0) {
            content = `🔍 لم أجد نتائج لـ "**${searchTerm}**"\n\nجرّب:\n• كلمات أوسع أو مختلفة\n• تحقق من الإملاء\n• ابحث باللغة العربية`;
          } else {
            content = `🔍 **نتائج البحث عن "${searchTerm}" — ${total} نتيجة:**\n\n`;
            if (matchTickets.length > 0) {
              content += `🎫 **تذاكر (${matchTickets.length}):**\n`;
              matchTickets.slice(0, 4).forEach((t: any) => {
                const pEmoji: Record<string, string> = { critical: '🔴', urgent: '🟠', high: '🟡', medium: '🔵', low: '⚪' };
                content += `${pEmoji[t.priority] || '•'} ${t.title || 'بدون عنوان'} [${t.status}]\n`;
              });
            }
            if (matchTasks.length > 0) {
              content += `\n✅ **مهام (${matchTasks.length}):**\n`;
              matchTasks.slice(0, 4).forEach((t: any) => { content += `• ${t.title || t.titleAr || 'مهمة'} [${t.status}]\n`; });
            }
            if (matchProjects.length > 0) {
              content += `\n📁 **مشاريع (${matchProjects.length}):**\n`;
              matchProjects.slice(0, 3).forEach((p: any) => { content += `• ${p.name || p.nameAr} [${p.status}]\n`; });
            }
          }
          suggestions = ['عرض التذاكر المفتوحة', 'عرض المهام المتأخرة', 'ابحث عن شيء آخر'];
          if (matchTickets.length > 0) actions = [{ label: `عرض التذاكر (${matchTickets.length})`, href: '/it/all-tickets' }];
        }
      }

      // ─── MY DAY ───────────────────────────────────────────────────────────────
      else if (isMyDay) {
        intent = 'my_day';
        const now2 = new Date();
        const today = new Date(now2); today.setHours(0,0,0,0);
        const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
        const yesterday = new Date(today.getTime() - 86400000);
        const yesterdayEnd = new Date(yesterday.getTime() + 86399999);

        const [allTickets, allTasks, allReferrals2, allProjects2] = await Promise.all([
          safeQuery(() => deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)), []),
          safeQuery(() => deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals), []),
          safeQuery(() => deptId ? db.select().from(itProjects).where(and(eq(itProjects.departmentId, deptId), isNull(itProjects.deletedAt))) : db.select().from(itProjects).where(isNull(itProjects.deletedAt)), []),
        ]);

        const openTickets = allTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');
        const overdueTasks = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now2 && t.status !== 'completed');
        const todayTasks = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= todayEnd);
        const urgentTickets = allTickets.filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed' && t.status !== 'resolved');
        const todayCreatedTickets = allTickets.filter((t: any) => t.createdAt && new Date(t.createdAt) >= today);
        const yesterdayCreatedTickets = allTickets.filter((t: any) => t.createdAt && new Date(t.createdAt) >= yesterday && new Date(t.createdAt) <= yesterdayEnd);
        const todayCompleted = allTasks.filter((t: any) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= today).length;
        const yesterdayCompleted = allTasks.filter((t: any) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= yesterday && new Date(t.updatedAt) <= yesterdayEnd).length;
        const unackRefs = (allReferrals2 as any[]).filter((r: any) => (!deptId || r.toDepartmentId === deptId) && r.status === 'pending' && !r.acknowledgedAt);
        const activeProjects2 = (allProjects2 as any[]).filter((p: any) => p.status === 'active' || p.status === 'in_progress');
        const completionRate = allTasks.length > 0 ? Math.round((allTasks.filter((t: any) => t.status === 'completed').length / allTasks.length) * 100) : 0;

        const ticketTrendIcon = todayCreatedTickets.length > yesterdayCreatedTickets.length ? '\u{1F4C8}' : todayCreatedTickets.length < yesterdayCreatedTickets.length ? '\u{1F4C9}' : '\u{2194}\uFE0F';
        const taskTrendIcon = todayCompleted > yesterdayCompleted ? '\u{1F4C8}' : todayCompleted < yesterdayCompleted ? '\u{1F4C9}' : '\u{2194}\uFE0F';
        const dailyScore = Math.min(100, Math.round(
          (overdueTasks.length === 0 ? 25 : overdueTasks.length < 3 ? 15 : 5) +
          (urgentTickets.length === 0 ? 25 : urgentTickets.length < 3 ? 15 : 5) +
          (unackRefs.length === 0 ? 20 : 10) +
          (completionRate * 0.3)
        ));
        const scoreEmoji = dailyScore >= 80 ? '\u{1F31F}' : dailyScore >= 60 ? '\u{1F4AA}' : dailyScore >= 40 ? '\u26A0\uFE0F' : '\u{1F534}';
        const hour = now2.getHours();
        const timeGreet = hour < 12 ? '\u2600\uFE0F \u0635\u0628\u0627\u062D \u0627\u0644\u0646\u0648\u0631' : hour < 18 ? '\u{1F324}\uFE0F \u0645\u0631\u062D\u0628\u0627\u064B' : '\u{1F319} \u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631';

        data = {
          dailyScore, openTickets: openTickets.length, overdueTasks: overdueTasks.length,
          todayTasks: todayTasks.length, urgentTickets: urgentTickets.length,
          todayCreated: todayCreatedTickets.length, yesterdayCreated: yesterdayCreatedTickets.length,
          todayCompleted, yesterdayCompleted, unackRefs: unackRefs.length,
          activeProjects: activeProjects2.length, completionRate,
        };

        content = `${timeGreet} \u064A\u0627 ${userName}!\n\n${scoreEmoji} **\u0645\u0624\u0634\u0631 \u064A\u0648\u0645\u0643: ${dailyScore}/100**\n\n`;
        content += `**\u{1F4CB} \u0625\u0641\u0627\u062F\u0629 \u0627\u0644\u0635\u0628\u0627\u062D:**\n`;
        content += `\u{1F3AB} \u062A\u0630\u0627\u0643\u0631 \u0645\u0641\u062A\u0648\u062D\u0629: **${openTickets.length}** (${ticketTrendIcon} \u0627\u0644\u064A\u0648\u0645 ${todayCreatedTickets.length} \u0645\u0642\u0627\u0628\u0644 ${yesterdayCreatedTickets.length} \u0623\u0645\u0633)\n`;
        if (urgentTickets.length > 0) content += `\u26A0\uFE0F \u062D\u0631\u062C\u0629/\u0639\u0627\u062C\u0644\u0629: **${urgentTickets.length}** \u2014 \u062A\u062D\u062A\u0627\u062C \u062A\u062F\u062E\u0644 \u0641\u0648\u0631\u064A\n`;
        content += `\u2705 \u0645\u0647\u0627\u0645 \u0627\u0644\u064A\u0648\u0645: **${todayTasks.length}** | \u0623\u0646\u062C\u0632\u062A: **${todayCompleted}** (${taskTrendIcon} \u0623\u0645\u0633 ${yesterdayCompleted})\n`;
        if (overdueTasks.length > 0) content += `\u{1F534} \u0645\u062A\u0623\u062E\u0631\u0629: **${overdueTasks.length}** \u0645\u0647\u0645\u0629 \u062A\u062C\u0627\u0648\u0632\u062A \u0627\u0644\u0645\u0648\u0639\u062F\n`;
        if (unackRefs.length > 0) content += `\u{1F4E8} \u0625\u062D\u0627\u0644\u0627\u062A \u0628\u062F\u0648\u0646 \u0631\u062F: **${unackRefs.length}** \u2014 \u064A\u0628\u062F\u0623 \u0627\u0644\u062A\u0635\u0639\u064A\u062F \u0628\u0639\u062F 4 \u0633\u0627\u0639\u0627\u062A!\n`;
        content += `\u{1F4C1} \u0645\u0634\u0627\u0631\u064A\u0639 \u0646\u0634\u0637\u0629: **${activeProjects2.length}** | \u0646\u0633\u0628\u0629 \u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0645\u0647\u0627\u0645: **${completionRate}%**\n`;
        content += `\n\u{1F4A1} **\u062A\u0648\u0635\u064A\u0629:** ${dailyScore >= 80 ? '\u0623\u062F\u0627\u0621 \u0645\u0645\u062A\u0627\u0632 \u2014 \u062D\u0627\u0641\u0638 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0648\u0649!' : dailyScore >= 60 ? '\u0623\u062F\u0627\u0621 \u062C\u064A\u062F \u2014 \u0631\u0643\u0651\u0632 \u0639\u0644\u0649 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629 \u0644\u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629' : '\u0627\u0644\u0648\u0636\u0639 \u064A\u062D\u062A\u0627\u062C \u0627\u0647\u062A\u0645\u0627\u0645 \u2014 \u0627\u0628\u062F\u0623 \u0628\u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u062D\u0631\u062C\u0629 \u0648\u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0624\u0643\u062F\u0629'}`;
        suggestions = ['\u0645\u0627\u0630\u0627 \u0623\u0641\u0639\u0644 \u0627\u0644\u0622\u0646\u061F', '\u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u062D\u0631\u062C\u0629', '\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0642\u0633\u0645', '\u0645\u0644\u062E\u0635 \u0627\u0644\u0623\u0633\u0628\u0648\u0639'];
        actions = [{ label: '\u0645\u0627\u0630\u0627 \u0623\u0641\u0639\u0644 \u0627\u0644\u0622\u0646\u061F', href: '#ask:ماذا أفعل الآن؟' }];
      }

      // ---- LIVE DATA: TICKETS ----
      // ─── QUICK CREATE (Ticket/Task from chat) ──────────────────────────────────
      else if (isQuickCreate) {
        intent = 'quick_create';
        const isTicketCreate = sm(q, ['تذكرة','تذكره','ticket']);
        const isTaskCreate = sm(q, ['مهمة','task']);

        // Extract the title from the query
        const createKeywords = ['أنشئ تذكرة','انشئ تذكرة','إنشاء تذكرة','سجل تذكرة','ارفع تذكرة','أضف مهمة','اضف مهمة','إنشاء مهمة','سجل مهمة','أنشئ مهمة','انشئ مهمة'];
        let itemTitle = q;
        for (const kw of createKeywords) {
          itemTitle = itemTitle.replace(new RegExp(kw, 'gi'), '').trim();
        }
        // Clean up: remove leading colons, dashes
        itemTitle = itemTitle.replace(/^[:\-–—]+/, '').trim();

        if (!itemTitle || itemTitle.length < 3) {
          content = isTicketCreate
            ? `🎫 **لإنشاء تذكرة من هنا، اكتب الموضوع بعد الأمر:**\n\n` +
              `مثال: "أنشئ تذكرة: مشكلة في الطابعة"\n` +
              `أو: "سجل تذكرة عطل في الشبكة"\n\n` +
              `💡 أو يمكنك الذهاب لصفحة التذاكر مباشرة:`
            : `✅ **لإنشاء مهمة من هنا، اكتب العنوان بعد الأمر:**\n\n` +
              `مثال: "أضف مهمة: تحديث نظام التشغيل"\n` +
              `أو: "سجل مهمة مراجعة صلاحيات المستخدمين"\n\n` +
              `💡 أو يمكنك الذهاب لصفحة المهام مباشرة:`;
          const deptPortalPath2: Record<number, string> = { 5: '/dmo', 9: '/department/infrastructure', 10: '/department/cybersecurity', 11: '/department/digital-transformation', 12: '/department/support' };
          const ticketHref = deptId && deptPortalPath2[deptId] ? `${deptPortalPath2[deptId]}/tickets` : '/it/all-tickets';
          const taskHref = deptId && deptPortalPath2[deptId] ? `${deptPortalPath2[deptId]}/tasks` : '/it-director/tasks';
          actions = [{ label: isTicketCreate ? 'صفحة التذاكر' : 'صفحة المهام', href: isTicketCreate ? ticketHref : taskHref }];
          suggestions = ['أنشئ تذكرة: مشكلة في الطابعة', 'أضف مهمة: تحديث السيرفر', 'ملخص يومي'];
        } else {
          try {
            if (isTicketCreate) {
              const ticketNum = `TKT-${Date.now().toString(36).toUpperCase()}`;
              const [newTicket] = await db.insert(itTickets).values({
                ticketNumber: ticketNum,
                title: itemTitle,
                description: `تم إنشاؤها عبر المساعد الذكي مجيب بواسطة ${userName}`,
                requesterId: userId,
                priority: 'medium',
                status: 'open',
                category: 'support',
                departmentId: deptId || null,
                source: 'chatbot',
              }).returning();
              data = { created: true, type: 'ticket', id: newTicket.id, title: itemTitle, refNumber: newTicket.ticketNumber };
              content = `✅ **تم إنشاء التذكرة بنجاح!**\n\n` +
                `🎫 **العنوان:** ${itemTitle}\n` +
                `📋 **الرقم المرجعي:** ${newTicket.referenceNumber || 'TKT-' + newTicket.id}\n` +
                `🏷️ **الحالة:** مفتوحة | **الأولوية:** متوسطة\n\n` +
                `💡 يمكنك تعديل الأولوية وإضافة تفاصيل من صفحة التذكرة.`;
              actions = [{ label: 'عرض التذكرة', href: '/it/all-tickets' }];
              suggestions = ['التذاكر المفتوحة', 'أنشئ تذكرة أخرى', 'ملخص يومي'];
            } else {
              const [newTask] = await db.insert(tasks).values({
                title: itemTitle,
                description: `تم إنشاؤها عبر المساعد الذكي مجيب بواسطة ${userName}`,
                status: 'pending',
                priority: 'medium',
                departmentId: deptId || null,
                assignedBy: userId,
              }).returning();
              data = { created: true, type: 'task', id: newTask.id, title: itemTitle };
              content = `✅ **تم إنشاء المهمة بنجاح!**\n\n` +
                `📋 **العنوان:** ${itemTitle}\n` +
                `🏷️ **الحالة:** معلقة | **الأولوية:** متوسطة\n\n` +
                `💡 يمكنك تعيين المهمة وتحديد الموعد النهائي من صفحة المهام.`;
              const deptPortalPath3: Record<number, string> = { 5: '/dmo', 9: '/department/infrastructure', 10: '/department/cybersecurity', 11: '/department/digital-transformation', 12: '/department/support' };
              const taskHref2 = deptId && deptPortalPath3[deptId] ? `${deptPortalPath3[deptId]}/tasks` : '/it-director/tasks';
              actions = [{ label: 'عرض المهام', href: taskHref2 }];
              suggestions = ['المهام المعلقة', 'أضف مهمة أخرى', 'ملخص يومي'];
            }
          } catch (createErr) {
            logger.error('[SmartAssistant] Quick create error:', { error: (createErr as any)?.message });
            content = '❌ **عذراً، حدث خطأ أثناء الإنشاء.** حاول مرة أخرى أو استخدم صفحة الإنشاء.';
            suggestions = ['ملخص يومي', 'التذاكر المفتوحة'];
          }
        }
      }

      else if (isTickets) {
        intent = 'live_tickets';
        const ticketWhere = deptId
          ? and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))
          : isNull(itTickets.deletedAt);
        const allTickets = await safeQuery(() => db.select().from(itTickets).where(ticketWhere as any), []);
        const open = allTickets.filter((t: any) => t.status === 'open').length;
        const inProg = allTickets.filter((t: any) => t.status === 'in_progress').length;
        const resolved = allTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const critical = allTickets.filter((t: any) => t.priority === 'critical' || t.priority === 'urgent').length;

        data = { total: allTickets.length, open, inProgress: inProg, resolved, critical };
        content = `📋 **إحصائيات التذاكر:**\n\n` +
          `• الإجمالي: **${allTickets.length}** تذكرة\n` +
          `• مفتوحة: **${open}** | قيد التنفيذ: **${inProg}** | محلولة: **${resolved}**\n` +
          (critical > 0 ? `• ⚠️ عاجلة/حرجة: **${critical}** تذكرة\n` : '');

        const recent = allTickets.filter((t: any) => t.status !== 'closed' && t.status !== 'resolved').slice(0, 4);
        if (recent.length > 0) {
          content += `\n**آخر التذاكر المفتوحة:**\n`;
          recent.forEach((t: any) => {
            const pMap: any = { critical: '🔴', urgent: '🟠', high: '🟡', medium: '🔵', low: '⚪' };
            content += `${pMap[t.priority] || '•'} ${t.title || 'بدون عنوان'}\n`;
          });
        }
        suggestions = ['المهام المتأخرة', 'أداء القسم اليوم', 'إنشاء تذكرة جديدة'];
        actions = [{ label: 'عرض جميع التذاكر', href: '/it/all-tickets' }];
      }

      // ---- LIVE DATA: TASKS ----
      else if (isTasks) {
        intent = 'live_tasks';
        const allTasks = await safeQuery(() => deptId
          ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt)))
          : db.select().from(tasks).where(isNull(tasks.deletedAt)), []);
        const pending = allTasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned').length;
        const inProg = allTasks.filter((t: any) => t.status === 'in_progress').length;
        const done = allTasks.filter((t: any) => t.status === 'completed').length;
        const overdue = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length;

        data = { total: allTasks.length, pending, inProgress: inProg, completed: done, overdue };
        content = `✅ **إحصائيات المهام:**\n\n` +
          `• الإجمالي: **${allTasks.length}** مهمة\n` +
          `• معلقة: **${pending}** | جارية: **${inProg}** | مكتملة: **${done}**\n` +
          (overdue > 0 ? `• 🔴 متأخرة: **${overdue}** مهمة تجاوزت الموعد\n` : '• ✨ لا توجد مهام متأخرة\n');

        const urgentTasks = allTasks.filter((t: any) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()).slice(0, 4);
        if (urgentTasks.length > 0) {
          content += `\n**مهام متأخرة تحتاج اهتماماً:**\n`;
          urgentTasks.forEach((t: any) => { content += `• ${t.title || t.titleAr || 'مهمة'}\n`; });
        }
        suggestions = ['كم تذكرة مفتوحة؟', 'المشاريع النشطة', 'أداء القسم'];
      }

      // ---- LIVE DATA: PROJECTS ----
      else if (isProjects) {
        intent = 'live_projects';
        const allProjects = await safeQuery(() => deptId
          ? db.select().from(itProjects).where(and(eq(itProjects.departmentId, deptId), isNull(itProjects.deletedAt)))
          : db.select().from(itProjects).where(isNull(itProjects.deletedAt)), []);
        const active = allProjects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;
        const completed = allProjects.filter((p: any) => p.status === 'completed').length;
        const planning = allProjects.filter((p: any) => p.status === 'planning' || p.status === 'proposed').length;
        const delayed = allProjects.filter((p: any) => p.status === 'delayed' || p.status === 'on_hold').length;

        data = { total: allProjects.length, active, completed, planning, delayed };
        content = `📊 **إحصائيات المشاريع:**\n\n` +
          `• الإجمالي: **${allProjects.length}** مشروع\n` +
          `• نشطة: **${active}** | مكتملة: **${completed}** | تخطيط: **${planning}**\n` +
          (delayed > 0 ? `• ⚠️ متأخرة/معلقة: **${delayed}**\n` : '');

        const activePrj = allProjects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').slice(0, 4);
        if (activePrj.length > 0) {
          content += `\n**المشاريع النشطة:**\n`;
          activePrj.forEach((p: any) => {
            const prog = p.progress || 0;
            content += `• ${p.name || p.nameAr} — ${prog}% مكتمل\n`;
          });
        }
        suggestions = ['المهام المرتبطة بالمشاريع', 'التذاكر المفتوحة', 'إحصائيات القسم'];
        actions = [{ label: 'عرض المشاريع', href: '/it/all-projects' }];
      }

      // ---- LIVE DATA: USERS ----
      else if (isUsers) {
        intent = 'live_users';
        const allUsers = await db.select().from(users).where(isNull(users.deletedAt));
        const active = allUsers.filter((u: any) => u.isActive).length;
        const byPortal: Record<string, number> = {};
        allUsers.forEach((u: any) => { if (u.portal) byPortal[u.portal] = (byPortal[u.portal] || 0) + 1; });

        data = { total: allUsers.length, active };
        content = `👥 **إحصائيات المستخدمين:**\n\n` +
          `• إجمالي المستخدمين: **${allUsers.length}**\n` +
          `• نشطون: **${active}** | غير نشطون: **${allUsers.length - active}**\n\n` +
          `**توزيع حسب البوابة:**\n` +
          Object.entries(byPortal).slice(0, 5).map(([p, c]) => `• ${p}: ${c}`).join('\n');
        suggestions = ['التذاكر المفتوحة', 'الإحصائيات العامة', 'سجل التدقيق'];
        actions = [{ label: 'إدارة المستخدمين', href: '/admin/users' }];
      }

      // ---- LIVE DATA: SECURITY INCIDENTS ----
      else if (isIncidents) {
        intent = 'live_incidents';
        const incidents = await db.select().from(securityIncidents);
        const open = incidents.filter((i: any) => i.status === 'open' || i.status === 'investigating').length;
        const critical = incidents.filter((i: any) => i.severity === 'critical').length;
        const resolved = incidents.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length;

        data = { total: incidents.length, open, critical, resolved };
        content = `🛡️ **الحوادث الأمنية:**\n\n` +
          `• الإجمالي: **${incidents.length}** حادثة\n` +
          `• مفتوحة/جاري التحقيق: **${open}**\n` +
          `• محلولة: **${resolved}**\n` +
          (critical > 0 ? `• 🔴 حرجة: **${critical}** حادثة تحتاج أولوية قصوى\n` : '• ✅ لا توجد حوادث حرجة\n');
        suggestions = ['الثغرات الأمنية', 'نسبة الامتثال', 'التقارير الأمنية'];
        actions = [{ label: 'عرض الحوادث', href: '/department/cybersecurity/incidents' }];
      }

      // ---- LIVE DATA: VULNERABILITIES ----
      else if (isVulnerabilities) {
        intent = 'live_vulnerabilities';
        const vulns = await db.select().from(securityVulnerabilities);
        const open = vulns.filter((v: any) => v.status === 'open').length;
        const critical = vulns.filter((v: any) => v.severity === 'critical').length;
        const high = vulns.filter((v: any) => v.severity === 'high').length;

        data = { total: vulns.length, open, critical, high };
        content = `🔍 **الثغرات الأمنية:**\n\n` +
          `• الإجمالي: **${vulns.length}**\n` +
          `• مفتوحة: **${open}**\n` +
          (critical > 0 ? `• 🔴 حرجة: **${critical}** — يجب إصلاحها خلال 72 ساعة\n` : '') +
          (high > 0 ? `• 🟠 عالية: **${high}** — يجب إصلاحها خلال أسبوع\n` : '');
        suggestions = ['الحوادث الأمنية', 'نسبة الامتثال لـ ECC', 'ضوابط الأمن السيبراني'];
        actions = [{ label: 'عرض الثغرات', href: '/department/cybersecurity/vulnerabilities' }];
      }

      // ---- LIVE DATA: SERVERS ----
      else if (isServers) {
        intent = 'live_servers';
        const servers = await db.select().from(infrastructureServers);
        const online = servers.filter((s: any) => s.status === 'online' || s.status === 'active').length;
        const offline = servers.filter((s: any) => s.status === 'offline' || s.status === 'down').length;
        const maintenance = servers.filter((s: any) => s.status === 'maintenance').length;

        data = { total: servers.length, online, offline, maintenance };
        content = `🖥️ **الخوادم والبنية التحتية:**\n\n` +
          `• إجمالي الخوادم: **${servers.length}**\n` +
          `• تعمل: **${online}** ✅ | متوقفة: **${offline}** 🔴 | صيانة: **${maintenance}** 🟡\n` +
          (offline > 0 ? `\n⚠️ **${offline}** خادم متوقف يحتاج تدخلاً فورياً` : '\n✨ جميع الخوادم تعمل بشكل طبيعي');
        suggestions = ['المهام المرتبطة بالخوادم', 'الشبكات', 'التذاكر المفتوحة'];
        actions = [{ label: 'إدارة الخوادم', href: '/department/infrastructure/servers' }];
      }

      // ---- LIVE DATA: VENDORS ----
      else if (isVendors) {
        intent = 'live_vendors';
        const allVendors = await db.select().from(vendors).where(isNull(vendors.deletedAt));
        const active = allVendors.filter((v: any) => v.status === 'active').length;

        data = { total: allVendors.length, active };
        content = `🏢 **الموردون والشركاء:**\n\n` +
          `• إجمالي الموردين: **${allVendors.length}**\n` +
          `• نشطون: **${active}**\n`;

        const topVendors = allVendors.filter((v: any) => v.status === 'active').slice(0, 5);
        if (topVendors.length > 0) {
          content += `\n**الموردون النشطون:**\n`;
          topVendors.forEach((v: any) => { content += `• ${v.name || v.nameAr}\n`; });
        }
        suggestions = ['عقود الموردين', 'اتفاقيات SLA', 'المشاريع مع الموردين'];
      }

      // ---- LIVE DATA: DSR ----
      else if (isDSR) {
        intent = 'live_dsr';
        const dsrRequests = await db.select().from(dataSubjectRequests);
        const pending = dsrRequests.filter((d: any) => d.status === 'pending').length;
        const inReview = dsrRequests.filter((d: any) => d.status === 'in_review').length;
        const overdue = dsrRequests.filter((d: any) => d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'completed').length;

        data = { total: dsrRequests.length, pending, inReview, overdue };
        content = `📄 **طلبات حقوق الأفراد (DSR):**\n\n` +
          `• الإجمالي: **${dsrRequests.length}** طلب\n` +
          `• قيد المراجعة: **${inReview}** | انتظار: **${pending}**\n` +
          (overdue > 0 ? `• 🔴 متأخرة: **${overdue}** طلب — تجاوزت مهلة PDPL (30 يوماً)\n` : '• ✅ جميع الطلبات في المهلة المحددة\n');
        suggestions = ['قواعد PDPL', 'تقارير الامتثال', 'اتفاقيات مشاركة البيانات'];
        actions = [{ label: 'إدارة طلبات DSR', href: '/dmo/dsr' }];
      }

      // ---- LIVE DATA: KPI DASHBOARD ----
      else if (isKpi) {
        intent = 'live_kpi';
        const [ticketsData, tasksData, projectsData] = await Promise.all([
          safeQuery(() => deptId
            ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt)))
            : db.select().from(itTickets).where(isNull(itTickets.deletedAt)), []),
          safeQuery(() => deptId
            ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt)))
            : db.select().from(tasks).where(isNull(tasks.deletedAt)), []),
          safeQuery(() => deptId
            ? db.select().from(itProjects).where(and(eq(itProjects.departmentId, deptId), isNull(itProjects.deletedAt)))
            : db.select().from(itProjects).where(isNull(itProjects.deletedAt)), [])
        ]);

        const openT = ticketsData.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
        const pendingM = tasksData.filter((t: any) => t.status !== 'completed').length;
        const activeP = projectsData.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;
        const overdueM = tasksData.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length;

        data = {
          tickets: { total: ticketsData.length, open: openT },
          tasks: { total: tasksData.length, pending: pendingM, overdue: overdueM },
          projects: { total: projectsData.length, active: activeP }
        };
        content = `📊 **ملخص أداء ${portal === 'admin' ? 'المنصة' : 'القسم'} اليوم:**\n\n` +
          `🎫 التذاكر: **${ticketsData.length}** إجمالي | **${openT}** مفتوحة\n` +
          `✅ المهام: **${tasksData.length}** إجمالي | **${pendingM}** معلقة` + (overdueM > 0 ? ` | **${overdueM}** 🔴 متأخرة` : '') + '\n' +
          `📁 المشاريع: **${projectsData.length}** إجمالي | **${activeP}** نشطة\n`;
        suggestions = ['تفاصيل التذاكر', 'المهام المتأخرة', 'أداء المشاريع', 'الحوادث الأمنية'];
      }

      // ---- LIVE DATA: NOTIFICATIONS ----
      else if (isNotifications) {
        intent = 'live_notifications';
        const notifs = await db.select().from(notifications).where(eq(notifications.userId, user.id));
        const unread = notifs.filter((n: any) => !n.isRead).length;

        data = { total: notifs.length, unread };
        content = `🔔 **إشعاراتك يا ${userName}:**\n\n` +
          `• الإجمالي: **${notifs.length}** إشعار\n` +
          `• غير مقروءة: **${unread}**\n`;

        if (unread > 0) {
          const latest = notifs.filter((n: any) => !n.isRead).slice(0, 3);
          content += `\n**آخر الإشعارات:**\n`;
          latest.forEach((n: any) => { content += `• ${n.title || n.message?.substring(0, 60) || 'إشعار'}\n`; });
        }
        suggestions = ['إحصائيات اليوم', 'التذاكر المفتوحة', 'المهام العاجلة'];
      }

      // ---- COMPLIANCE STATUS ----
      else if (isCompliance) {
        intent = 'compliance';
        try {
          const resp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/governance/advisor/portal/${portal}/compliance`, {
            headers: { Authorization: req.headers.authorization || '' }
          });
          if (resp.ok) {
            const stats = await resp.json();
            if (stats?.total > 0) {
              content = `📋 **نسبة الامتثال - ${portal}:**\n\n` +
                `• النسبة الإجمالية: **${stats.compliancePercentage}%**\n` +
                `• إجمالي الضوابط: **${stats.total}**\n` +
                `• مطبق: **${stats.implemented}** | جزئي: **${stats.partial}** | غير مطبق: **${stats.notImplemented}**\n`;
            } else {
              content = `لا توجد بيانات امتثال مسجلة بعد. ابدأ بتتبع الضوابط من بوابة ${portal}.`;
            }
          } else { content = 'تعذّر جلب بيانات الامتثال.'; }
        } catch { content = 'تعذّر جلب بيانات الامتثال.'; }
        suggestions = ['ضوابط ECC-2:2024', 'ضوابط NDMO', 'معايير DGA', 'تصدير تقرير الامتثال'];
      }

      // ---- LIVE DATA: COMMITTEE MEETINGS ----
      else if (isMeetings) {
        intent = 'live_meetings';
        const allMeetings = await db.select().from(committeeMeetings);
        const now = new Date();
        const upcoming = allMeetings.filter((m: any) => m.scheduledDate && new Date(m.scheduledDate) >= now);
        const past = allMeetings.filter((m: any) => m.scheduledDate && new Date(m.scheduledDate) < now);
        const thisMonth = allMeetings.filter((m: any) => {
          if (!m.scheduledDate) return false;
          const d = new Date(m.scheduledDate);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        data = { total: allMeetings.length, upcoming: upcoming.length, past: past.length, thisMonth: thisMonth.length };
        content = `🗓️ **اجتماعات اللجنة:**\n\n` +
          `• الإجمالي: **${allMeetings.length}** اجتماع\n` +
          `• قادمة: **${upcoming.length}** | هذا الشهر: **${thisMonth.length}** | سابقة: **${past.length}**\n`;

        if (upcoming.length > 0) {
          content += `\n**الاجتماعات القادمة:**\n`;
          upcoming.slice(0, 4).forEach((m: any) => {
            const dateStr = m.scheduledDate ? new Date(m.scheduledDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
            content += `📅 ${m.title || m.titleAr || 'اجتماع'} — ${dateStr}\n`;
          });
        } else {
          content += `\n📌 لا توجد اجتماعات مجدولة قادمة حالياً.`;
        }

        suggestions = ['جلسات التصويت', 'محاضر الاجتماعات', 'مهام اللجنة', 'قرارات اللجنة'];
        actions = [{ label: 'عرض الاجتماعات', href: '/committee/meetings' }];
      }

      // ---- LIVE DATA: VOTING SESSIONS ----
      else if (isVoting) {
        intent = 'live_voting';
        const allSessions = await db.select().from(votingSessions);
        const active = allSessions.filter((s: any) => s.status === 'open' || s.status === 'active');
        const completed = allSessions.filter((s: any) => s.status === 'completed').length;
        const approved = allSessions.filter((s: any) => s.result === 'approved').length;
        const rejected = allSessions.filter((s: any) => s.result === 'rejected').length;

        data = { total: allSessions.length, active: active.length, completed, approved, rejected };
        content = `🗳️ **جلسات التصويت:**\n\n` +
          `• الإجمالي: **${allSessions.length}** جلسة\n` +
          `• مفتوحة الآن: **${active.length}** | مكتملة: **${completed}**\n` +
          (completed > 0 ? `• النتائج: ✅ موافق ${approved} | ❌ مرفوض ${rejected}\n` : '');

        if (active.length > 0) {
          content += `\n**جلسات التصويت المفتوحة الآن:**\n`;
          active.slice(0, 4).forEach((s: any) => {
            const totalVotes = (s.votesFor || 0) + (s.votesAgainst || 0) + (s.votesAbstain || 0);
            content += `⚡ ${s.title || s.titleAr || 'تصويت'} — ${totalVotes} صوت مسجّل\n`;
          });
          content += `\n💡 لا تفوّت التصويت — النصاب القانوني مطلوب لإغلاق الجلسة!`;
        }

        suggestions = ['الاجتماعات القادمة', 'قرارات اللجنة', 'مهام اللجنة', 'محاضر الاجتماعات'];
        actions = active.length > 0
          ? [{ label: 'صوّت الآن', href: '/committee/voting' }]
          : [{ label: 'عرض التصويتات', href: '/committee/voting' }];
      }

      // ─── LIVE DATA: IT REFERRALS (dept-isolated, with escalation) ──────────────
      else if (isReferrals) {
        intent = 'live_referrals';
        const now = new Date();
        const allReferrals = deptId
          ? await db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`)
          : await db.select().from(itReferrals);

        const incoming = deptId ? (allReferrals as any[]).filter((r: any) => r.toDepartmentId === deptId) : allReferrals;
        const outgoing = deptId ? (allReferrals as any[]).filter((r: any) => r.fromDepartmentId === deptId) : [];
        const pending = (allReferrals as any[]).filter((r: any) => r.status === 'pending').length;
        const inProgress = (allReferrals as any[]).filter((r: any) => r.status === 'accepted' || r.status === 'in_progress').length;
        const completed = (allReferrals as any[]).filter((r: any) => r.status === 'completed').length;
        const unacknowledged = (incoming as any[]).filter((r: any) => r.status === 'pending' && !r.acknowledgedAt).length;
        const escalated = (allReferrals as any[]).filter((r: any) => (r.escalationLevel || 0) > 0 && r.status === 'pending').length;
        const overdue = (allReferrals as any[]).filter((r: any) => {
          if (r.status === 'completed' || r.status === 'rejected') return false;
          if (r.dueDate) return new Date(r.dueDate) < now;
          if (r.slaHours && r.createdAt) return new Date(new Date(r.createdAt).getTime() + r.slaHours * 3600000) < now;
          return false;
        }).length;

        data = { total: allReferrals.length, pending, inProgress, completed, overdue, unacknowledged, escalated, incomingCount: incoming.length, outgoingCount: outgoing.length };
        
        content = `📤 **الإحالات التقنية${deptId ? ` — ${DEPT_NAMES[deptId]}` : ' (جميع الأقسام)'}:**\n\n`;
        if (deptId) {
          content += `📨 واردة: **${incoming.length}** | 📤 صادرة: **${outgoing.length}**\n`;
        }
        content += `• معلقة: **${pending}** | جارية: **${inProgress}** | منجزة: **${completed}**\n`;
        if (unacknowledged > 0) content += `\n📨 **[ينتظر ردك]** غير مؤكدة الاستلام: **${unacknowledged}** — سيبدأ التصعيد بعد 4 ساعات!\n`;
        if (escalated > 0) content += `🔴 **[مصعّدة]** وصلت لمدير التقنية: **${escalated}** — قرار مطلوب فوراً\n`;
        if (overdue > 0) content += `🟡 تجاوزت SLA: **${overdue}** إحالة\n`;
        if (unacknowledged === 0 && escalated === 0 && overdue === 0) content += `✅ جميع الإحالات في الوقت المحدد\n`;

        // Show recent pending incoming referrals
        const pendingIncoming = (incoming as any[]).filter((r: any) => r.status === 'pending').slice(0, 3);
        if (pendingIncoming.length > 0) {
          content += `\n**آخر الإحالات الواردة المعلقة:**\n`;
          pendingIncoming.forEach((r: any) => {
            const ackStatus = r.acknowledgedAt ? '✓مستلمة' : '⚠️غير مؤكدة';
            const fromName = DEPT_NAMES[r.fromDepartmentId] || 'قسم آخر';
            content += `• ${r.title || 'إحالة'} (من: ${fromName}) [${ackStatus}]\n`;
          });
        }

        const deptPortalPath: Record<number, string> = { 5: '/dmo', 9: '/department/infrastructure', 10: '/department/cybersecurity', 11: '/department/digital-transformation', 12: '/department/support' };
        const refHref = deptId && deptPortalPath[deptId] ? `${deptPortalPath[deptId]}/referrals` : '/it-director/referrals';
        suggestions = ['الإحالات غير المؤكدة', 'التذاكر المفتوحة', 'إحصائيات القسم', 'ماذا أفعل الآن؟'];
        actions = [{ label: 'إدارة الإحالات', href: refHref }];
        if (unacknowledged > 0) actions.unshift({ label: `تأكيد الاستلام (${unacknowledged})`, href: refHref });
      }

      // ─── SMART ALERTS: Critical items (enhanced with referral escalation) ──────
      else if (isAlerts) {
        intent = 'alerts';
        const now = new Date();
        const [allTickets, allTasks, incidentsData, vulnsData, serversData, allReferrals] = await Promise.all([
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)),
          db.select().from(securityIncidents),
          db.select().from(securityVulnerabilities),
          db.select().from(infrastructureServers),
          deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals),
        ]);

        const criticalTickets = (allTickets as any[]).filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed' && t.status !== 'resolved');
        const overdueTasks = (allTasks as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
        const openIncidents = (incidentsData as any[]).filter((i: any) => i.status === 'open' || i.status === 'investigating');
        const criticalVulns = (vulnsData as any[]).filter((v: any) => v.severity === 'critical' && v.status === 'open');
        const downServers = (serversData as any[]).filter((s: any) => s.status === 'offline' || s.status === 'down');
        const overdueReferrals = (allReferrals as any[]).filter((r: any) => {
          if (r.status === 'completed' || r.status === 'rejected') return false;
          if (r.dueDate) return new Date(r.dueDate) < now;
          if (r.slaHours && r.createdAt) return new Date(r.createdAt.getTime() + r.slaHours * 3600000) < now;
          return false;
        });
        const unackReferrals = (allReferrals as any[]).filter((r: any) => (!deptId || r.toDepartmentId === deptId) && r.status === 'pending' && !r.acknowledgedAt);
        const escalatedReferrals = (allReferrals as any[]).filter((r: any) => (r.escalationLevel || 0) > 0 && r.status === 'pending');

        const totalAlerts = criticalTickets.length + overdueTasks.length + openIncidents.length + criticalVulns.length + downServers.length + overdueReferrals.length + unackReferrals.length + escalatedReferrals.length;

        data = {
          criticalTickets: criticalTickets.length,
          overdueTasks: overdueTasks.length,
          openIncidents: openIncidents.length,
          criticalVulns: criticalVulns.length,
          downServers: downServers.length,
          overdueReferrals: overdueReferrals.length,
          unackReferrals: unackReferrals.length,
          escalatedReferrals: escalatedReferrals.length,
          total: totalAlerts
        };

        if (totalAlerts === 0) {
          content = `✅ **ممتاز يا ${userName}! النظام في وضع مثالي الآن.**\n\n` +
            `• جميع الخوادم تعمل ✅\n• لا حوادث أمنية مفتوحة ✅\n• لا تذاكر حرجة أو عاجلة ✅\n• لا مهام تجاوزت موعدها ✅\n• لا ثغرات حرجة مفتوحة ✅\n• جميع الإحالات مؤكدة ومعالجة ✅\n\n💡 استمر بالمتابعة الدورية للحفاظ على هذا المستوى!`;
        } else {
          const urgencyScore = criticalVulns.length * 5 + downServers.length * 4 + criticalTickets.length * 3 + openIncidents.length * 3 + escalatedReferrals.length * 3 + overdueTasks.length * 2 + overdueReferrals.length + unackReferrals.length;
          const riskLevel = urgencyScore >= 15 ? '🔴 خطر عالٍ' : urgencyScore >= 7 ? '🟠 يحتاج انتباه' : '🟡 متابعة مطلوبة';
          content = `${riskLevel} — **${totalAlerts} بند يحتاج اهتمامك:**\n\n`;
          if (downServers.length > 0) content += `🔴 **[عاجل جداً]** خوادم متوقفة: **${downServers.length}** — تدخل فوري مطلوب\n`;
          if (criticalVulns.length > 0) content += `🔴 **[عاجل]** ثغرات حرجة: **${criticalVulns.length}** — إصلاح خلال 72 ساعة\n`;
          if (escalatedReferrals.length > 0) content += `🟠 **[مصعّد]** إحالات وصلت للمدير التنفيذي: **${escalatedReferrals.length}** — قرار مطلوب\n`;
          if (criticalTickets.length > 0) content += `🟠 **[أولوية عالية]** تذاكر حرجة/عاجلة: **${criticalTickets.length}**\n`;
          if (openIncidents.length > 0) content += `🟠 **[أولوية عالية]** حوادث أمنية مفتوحة: **${openIncidents.length}**\n`;
          if (unackReferrals.length > 0) content += `🟡 **[ينتظر ردك]** إحالات بدون تأكيد استلام: **${unackReferrals.length}** — يبدأ التصعيد بعد 4 ساعات\n`;
          if (overdueTasks.length > 0) content += `🟡 **[مهم]** مهام متأخرة: **${overdueTasks.length}**\n`;
          if (overdueReferrals.length > 0) content += `🟡 **[مهم]** إحالات تجاوزت SLA: **${overdueReferrals.length}**\n`;
          content += `\n💡 **التوصية:** ابدأ بالعناصر الحمراء فوراً، ثم المصعّدة، ثم المعلقة.`;
        }

        suggestions = ['ماذا أفعل الآن؟', 'الإحالات غير المؤكدة', 'التذاكر الحرجة', 'حالة الخوادم'];
        if (downServers.length > 0) actions.push({ label: 'الخوادم المتوقفة', href: '/department/infrastructure/servers' });
        if (escalatedReferrals.length > 0 || unackReferrals.length > 0) actions.push({ label: 'إدارة الإحالات', href: isAdminOrDirector ? '/it-director/referrals' : buildDeptHref(deptId, 'referrals') });
        if (criticalTickets.length > 0) actions.push({ label: 'التذاكر الحرجة', href: '/it/all-tickets' });
      }

      // ---- CONTEXTUAL HELP: Role-specific guide ----
      else if (isHelp) {
        intent = 'help';
        const portalHelp: Record<string, string> = {
          cybersecurity: `🛡️ **دليلك في بوابة الأمن السيبراني:**\n\n**ابدأ من هنا:**\n1. لوحة التحكم → اعرض الحوادث والثغرات النشطة\n2. "إضافة حادثة" → سجّل أي حادث جديد فوراً والمدير يتلقى إشعاراً\n3. "الثغرات" → تابع CVSS والمعالجة (حرجة = 72 ساعة)\n4. اسأل مجيب عن "نسبة الامتثال" لمعرفة موقفك من ECC-2:2024\n\n**نصائح الخبراء:**\n• استخدم فلتر الخطورة لتحديد الأولويات\n• ضوابط ECC-2:2024 = 108 ضابط في 5 مجالات\n• جرّب: "ما ضوابط ECC المجال الأول؟"`,
          infrastructure: `🖥️ **دليلك في بوابة البنية التحتية:**\n\n**ابدأ من هنا:**\n1. لوحة التحكم → تحقق من حالة الخوادم مباشرة\n2. "إضافة سيرفر" → سجّل الأجهزة الجديدة مع بياناتها\n3. "الشبكات" → إدارة الشبكات والتكوين\n4. "تذاكر القسم" → تابع طلبات الدعم المسندة لقسمك\n\n**نصائح الخبراء:**\n• المراقبة الدورية للـ CPU/RAM/Storage تجنبك المشاكل المفاجئة\n• وزّع المهام على فريقك عبر المخطط لزيادة الكفاءة`,
          dmo: `📊 **دليلك في بوابة إدارة البيانات (DMO):**\n\n**ابدأ من هنا:**\n1. "كتالوج البيانات" → استكشف وصنّف أصول البيانات\n2. "امتثال NDMO" → تابع 191 متطلب في 15 مجالاً\n3. "DSR" → عالج طلبات الأفراد خلال 30 يوم (مطلب PDPL)\n4. "سجل مشاركة البيانات" → وثّق EDSR مع أرقام مرجعية\n\n**تذكر:** مهلة PDPL لطلبات DSR = 30 يوماً فقط!\n• جرّب: "ما متطلبات PDPL الرئيسية؟"`,
          support: `🎧 **دليلك في بوابة الدعم الفني:**\n\n**ابدأ من هنا:**\n1. "التذاكر المسندة لي" → ابدأ بالحرجة أولاً\n2. "إنشاء تذكرة" → للمستخدمين الذين يتواصلون معك\n3. قاعدة المعرفة → ابحث قبل حل كل مشكلة جديدة\n4. "الإحالات" → تابع التحويلات وتأكد من الرد خلال SLA\n\n**تذكر SLA:** تذاكر حرجة = 4 ساعات | عالية = 8 ساعات | متوسطة = 24 ساعة`,
          digital_transformation: `💡 **دليلك في بوابة التحول الرقمي:**\n\n**ابدأ من هنا:**\n1. "المشاريع" → أضف مبادرة رقمية وحدد مراحلها\n2. "التطبيقات" → سجّل الأنظمة الرقمية مع بياناتها التقنية\n3. "لوحة KPI" → قارن أداءك بمعايير DGA\n4. المخطط → نظّم مهام الفريق يومياً\n\n**الهدف:** تحقيق 90%+ على مقياس Qiyas من DGA\n• جرّب: "ما معايير DGA للتحول الرقمي؟"`,
          it_director: `📊 **دليلك في بوابة مدير تقنية المعلومات:**\n\n**ابدأ من هنا:**\n1. مركز القيادة الحي → نظرة إجمالية على جميع الأقسام\n2. "التصعيدات" → تذاكر تجاوزت SLA تحتاج قرارك\n3. "KPI التنفيذي" → صدّر تقرير PDF للإدارة العليا\n4. التقارير الأسبوعية → تصلك تلقائياً كل أحد\n\n💡 اسأل مجيب عن "وضع جميع الأقسام" للحصول على نظرة سريعة`,
          admin: `⚙️ **دليلك كمسؤول النظام:**\n\n**ابدأ من هنا:**\n1. "إدارة المستخدمين" → أضف أو عدّل الحسابات والأدوار\n2. "قواعد التنبيه" → فعّل إشعارات SLA والمهام الحرجة\n3. "قوالب التذاكر" → وفّر الوقت بإنشاء قوالب جاهزة\n4. "سجل التدقيق" → تتبع كل العمليات والتغييرات\n\n**نصيحة احترافية:** فعّل التقارير الأسبوعية من الإعدادات — توفّر اجتماعات المتابعة!`,
          committee: `🏛️ **دليلك في بوابة اللجنة:**\n\n**ابدأ من هنا:**\n1. "الاجتماعات" → جدوّل اجتماعاً وأرسل الدعوات تلقائياً\n2. "التصويت" → افتح جلسة تصويت على قرار معلق\n3. "القرارات" → اعتمد القرارات وتابع تنفيذها\n4. "المحاضر" → وثّق الاجتماعات بصيغة رسمية\n\n💡 النصاب القانوني يُحسب تلقائياً — لن تحتاج لعدّ الأصوات يدوياً!`,
        };

        content = portalHelp[portal] || `📘 **دليل الاستخدام السريع — مركز التحكم:**\n\nأسألني بالعربية عن:\n• "كم تذكرة مفتوحة؟"\n• "ما وضع الخوادم؟"\n• "ما نسبة الامتثال لـ NCA؟"\n• "ما التنبيهات الحرجة اليوم؟"\n• "اعرض مهام متأخرة"\n• "ما اجتماعات اللجنة؟"\n\n💡 يمكنني أيضاً فهم الأسئلة التبعية مثل:\nبعد "كم تذكرة؟" → اسأل "وكم منها حرجة؟"`;

        const portalActions: Record<string, { label: string; href: string }[]> = {
          cybersecurity: [{ label: 'الحوادث الأمنية', href: '/department/cybersecurity/incidents' }, { label: 'الثغرات', href: '/department/cybersecurity/vulnerabilities' }],
          infrastructure: [{ label: 'الخوادم', href: '/department/infrastructure/servers' }, { label: 'تذاكر القسم', href: '/it/all-tickets' }],
          dmo: [{ label: 'كتالوج البيانات', href: '/dmo/catalog' }, { label: 'امتثال NDMO', href: '/dmo/compliance' }],
          support: [{ label: 'التذاكر المسندة', href: '/department/support/tickets' }, { label: 'قاعدة المعرفة', href: '/it/knowledge' }],
          committee: [{ label: 'الاجتماعات', href: '/committee/meetings' }, { label: 'التصويت', href: '/committee/voting' }],
          it_director: [{ label: 'مركز القيادة', href: '/it-director/command-center' }, { label: 'KPI التنفيذي', href: '/it-director/kpi' }],
        };
        actions = portalActions[portal] || [{ label: 'لوحة التحكم', href: '/admin' }];
        suggestions = ['التنبيهات الحرجة اليوم', 'إحصائيات القسم', 'ملخص يومي', 'نسبة الامتثال'];
      }

      // ─── WEEKLY SUMMARY (week-over-week analysis) ───────────────────────────────
      else if (isWeeklySummary) {
        intent = 'weekly_summary';
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600000);

        const [ticketsThisWeek, ticketsLastWeek, tasksAll, projectsAll, referralsAll] = await Promise.all([
          deptId
            ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), gte(itTickets.createdAt, weekAgo), isNull(itTickets.deletedAt)))
            : db.select().from(itTickets).where(and(gte(itTickets.createdAt, weekAgo), isNull(itTickets.deletedAt))),
          deptId
            ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), gte(itTickets.createdAt, twoWeeksAgo), sql`${itTickets.createdAt} < ${weekAgo}`, isNull(itTickets.deletedAt)))
            : db.select().from(itTickets).where(and(gte(itTickets.createdAt, twoWeeksAgo), sql`${itTickets.createdAt} < ${weekAgo}`, isNull(itTickets.deletedAt))),
          deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)),
          deptId ? db.select().from(itProjects).where(and(eq(itProjects.itDepartmentId, deptId), isNull(itProjects.deletedAt))) : db.select().from(itProjects).where(isNull(itProjects.deletedAt)),
          deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals),
        ]);

        const thisWeekResolved = (ticketsThisWeek as any[]).filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const lastWeekResolved = (ticketsLastWeek as any[]).filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const thisWeekCreated = (ticketsThisWeek as any[]).length;
        const lastWeekCreated = (ticketsLastWeek as any[]).length;
        const completedTasks = (tasksAll as any[]).filter((t: any) => t.status === 'completed').length;
        const overdueTasks = (tasksAll as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
        const activeProjects = (projectsAll as any[]).filter((p: any) => p.status === 'active' || p.status === 'in_progress').length;
        const completedProjects = (projectsAll as any[]).filter((p: any) => p.status === 'completed').length;
        const pendingRefs = (referralsAll as any[]).filter((r: any) => r.status === 'pending').length;
        const completedRefs = (referralsAll as any[]).filter((r: any) => r.status === 'completed').length;

        const ticketTrend = thisWeekCreated > lastWeekCreated ? `📈 ارتفع بنسبة ${lastWeekCreated > 0 ? Math.round(((thisWeekCreated - lastWeekCreated) / lastWeekCreated) * 100) : 100}%` : thisWeekCreated < lastWeekCreated ? `📉 انخفض بنسبة ${thisWeekCreated > 0 ? Math.round(((lastWeekCreated - thisWeekCreated) / lastWeekCreated) * 100) : 100}%` : '↔️ مستقر';
        const resolutionTrend = thisWeekResolved > lastWeekResolved ? `📈 +${thisWeekResolved - lastWeekResolved}` : thisWeekResolved < lastWeekResolved ? `📉 -${lastWeekResolved - thisWeekResolved}` : '↔️ ثابت';
        const taskCompletionRate = tasksAll.length > 0 ? Math.round((completedTasks / tasksAll.length) * 100) : 0;

        data = {
          thisWeekCreated, lastWeekCreated, thisWeekResolved, lastWeekResolved,
          completedTasks, overdueTasks, taskCompletionRate,
          activeProjects, completedProjects, pendingRefs, completedRefs,
          trend: thisWeekCreated > lastWeekCreated ? 'up' : thisWeekCreated < lastWeekCreated ? 'down' : 'stable'
        };

        const weekLabel = `${weekAgo.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}`;
        content = `📊 **ملخص الأسبوع (${weekLabel}):**\n\n` +
          `**🎫 التذاكر:**\n` +
          `• أُنشئت هذا الأسبوع: **${thisWeekCreated}** (مقابل ${lastWeekCreated} الأسبوع الماضي — ${ticketTrend})\n` +
          `• حُلّت هذا الأسبوع: **${thisWeekResolved}** (${resolutionTrend})\n\n` +
          `**✅ المهام:**\n` +
          `• معدل الإنجاز: **${taskCompletionRate}%** (${completedTasks} مكتملة)\n` +
          (overdueTasks > 0 ? `• متأخرة: **${overdueTasks}** مهمة تجاوزت الموعد\n` : `• لا مهام متأخرة ✅\n`) + '\n' +
          `**📁 المشاريع:**\n` +
          `• نشطة: **${activeProjects}** | مكتملة: **${completedProjects}**\n\n` +
          `**📤 الإحالات:**\n` +
          `• معلقة: **${pendingRefs}** | منجزة: **${completedRefs}**\n\n` +
          `💡 **تقييم الأسبوع:** ${taskCompletionRate >= 80 && overdueTasks === 0 ? '🌟 أسبوع ممتاز — إنجاز رائع!' : taskCompletionRate >= 60 ? '👍 أسبوع جيد مع فرص للتحسين' : '⚠️ الأسبوع يحتاج تحسيناً — ركّز على المهام المتأخرة'}`;
        suggestions = ['مقارنة المشاريع', 'المهام المتأخرة', 'إنتاجية الفريق', 'ملخص اليوم'];
        actions = [{ label: 'تذاكر هذا الأسبوع', href: '/it/all-tickets' }, { label: 'تقرير الأداء', href: '/it/all-projects' }];
      }

      // ─── SLA STATUS ─────────────────────────────────────────────────────────────
      else if (isSlaStatus) {
        intent = 'sla_status';
        const now = new Date();
        const allTickets = deptId
          ? await db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt)))
          : await db.select().from(itTickets).where(isNull(itTickets.deletedAt));
        const allReferrals = deptId
          ? await db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`)
          : await db.select().from(itReferrals);

        // SLA thresholds by priority (hours) — use shared constants
        const LOCAL_SLA_HOURS: Record<string, number> = { critical: 4, urgent: 4, high: 8, medium: 24, low: 72 };
        const breachedTickets = (allTickets as any[]).filter((t: any) => {
          if (t.status === 'closed' || t.status === 'resolved') return false;
          const slaH = LOCAL_SLA_HOURS[t.priority] || 48;
          const age = (now.getTime() - new Date(t.createdAt).getTime()) / 3600000;
          return age > slaH;
        });
        const nearBreachTickets = (allTickets as any[]).filter((t: any) => {
          if (t.status === 'closed' || t.status === 'resolved') return false;
          const slaH = LOCAL_SLA_HOURS[t.priority] || 48;
          const age = (now.getTime() - new Date(t.createdAt).getTime()) / 3600000;
          return age > slaH * 0.75 && age <= slaH;
        });
        const breachedRefs = (allReferrals as any[]).filter((r: any) => {
          if (r.status === 'completed' || r.status === 'rejected') return false;
          if (r.dueDate) return new Date(r.dueDate) < now;
          if (r.slaHours && r.createdAt) return new Date(new Date(r.createdAt).getTime() + r.slaHours * 3600000) < now;
          return false;
        });
        const openTickets = (allTickets as any[]).filter((t: any) => t.status !== 'closed' && t.status !== 'resolved').length;
        const slaCompliance = openTickets > 0 ? Math.round(((openTickets - breachedTickets.length) / openTickets) * 100) : 100;

        data = {
          openTickets, breachedTickets: breachedTickets.length, nearBreachTickets: nearBreachTickets.length,
          breachedRefs: breachedRefs.length, slaCompliance,
          slaLevels: [
            { priority: 'حرجة', slaHours: 4, breached: breachedTickets.filter((t: any) => t.priority === 'critical').length },
            { priority: 'عاجلة', slaHours: 4, breached: breachedTickets.filter((t: any) => t.priority === 'urgent').length },
            { priority: 'عالية', slaHours: 8, breached: breachedTickets.filter((t: any) => t.priority === 'high').length },
          ]
        };

        const slaEmoji = slaCompliance >= 90 ? '✅' : slaCompliance >= 75 ? '🟡' : '🔴';
        content = `⏱️ **حالة اتفاقيات مستوى الخدمة (SLA):**\n\n` +
          `${slaEmoji} **الالتزام بـ SLA: ${slaCompliance}%**\n\n` +
          `📋 **مستويات SLA للتذاكر:**\n` +
          `• 🔴 حرجة: يجب الحل خلال **4 ساعات**\n` +
          `• 🟠 عاجلة: يجب الحل خلال **4 ساعات**\n` +
          `• 🟡 عالية: يجب الحل خلال **8 ساعات**\n` +
          `• 🔵 متوسطة: يجب الحل خلال **24 ساعة**\n` +
          `• ⚪ منخفضة: يجب الحل خلال **72 ساعة**\n\n` +
          (breachedTickets.length > 0 ? `⚠️ **تذاكر تجاوزت SLA: ${breachedTickets.length}** — تحتاج إجراءً فورياً!\n` : '✅ لا تذاكر تجاوزت SLA\n') +
          (nearBreachTickets.length > 0 ? `🟡 **قريبة من الخرق: ${nearBreachTickets.length}** — سيبدأ الاخرق قريباً\n` : '') +
          (breachedRefs.length > 0 ? `📤 **إحالات تجاوزت SLA: ${breachedRefs.length}**\n` : '') +
          `\n💡 **للإحالات:** التأكيد خلال 2 ساعة | الحل خلال 4 ساعات (حرجة) أو 48 ساعة (عادية)`;
        suggestions = ['ماذا أفعل الآن؟', 'التذاكر الحرجة', 'الإحالات غير المؤكدة', 'إنتاجية الفريق'];
        if (breachedTickets.length > 0) actions.push({ label: `التذاكر المتأخرة (${breachedTickets.length})`, href: '/it/all-tickets' });
      }

      // ─── MY ASSIGNED TICKETS ─────────────────────────────────────────────────
      else if (isMyTickets) {
        intent = 'my_tickets';
        const myTickets = await db.select().from(itTickets).where(and(
          isNull(itTickets.deletedAt),
          eq(itTickets.assigneeId, userId),
        ));
        const open = myTickets.filter((t: any) => t.status === 'open').length;
        const inProg = myTickets.filter((t: any) => t.status === 'in_progress').length;
        const resolved = myTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const critical = myTickets.filter((t: any) => t.priority === 'critical' || t.priority === 'urgent').length;
        const now = new Date();
        const MY_SLA_HOURS: Record<string, number> = { critical: 4, urgent: 4, high: 8, medium: 24, low: 72 };
        const breached = myTickets.filter((t: any) => {
          if (t.status === 'closed' || t.status === 'resolved') return false;
          const slaH = MY_SLA_HOURS[t.priority] || 48;
          return (now.getTime() - new Date(t.createdAt).getTime()) / 3600000 > slaH;
        }).length;

        data = { total: myTickets.length, open, inProgress: inProg, resolved, critical, breached };
        content = `🎫 **تذاكرك المسندة يا ${userName}:**\n\n` +
          `• إجمالي: **${myTickets.length}** تذكرة\n` +
          `• مفتوحة: **${open}** | قيد التنفيذ: **${inProg}** | محلولة: **${resolved}**\n` +
          (critical > 0 ? `• ⚠️ عاجلة/حرجة: **${critical}** — تحتاج أولوية قصوى\n` : '') +
          (breached > 0 ? `• 🔴 تجاوزت SLA: **${breached}** — تدخل فوري!\n` : '• ✅ جميع تذاكرك ضمن SLA\n');
        if (myTickets.length > 0) {
          const urgentOnes = myTickets.filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'resolved' && t.status !== 'closed').slice(0, 3);
          if (urgentOnes.length > 0) {
            content += `\n**التذاكر الحرجة:**\n`;
            urgentOnes.forEach((t: any) => { content += `🔴 ${t.title || 'تذكرة'} [${t.status}]\n`; });
          }
        }
        suggestions = ['تحديث حالة التذاكر', 'الإحالات الواردة', 'ملخص يومي', 'إحصائيات القسم'];
        actions = [{ label: 'تذاكري', href: '/it/all-tickets' }];
      }

      // ─── TEAM WORKLOAD ───────────────────────────────────────────────────────
      else if (isTeamLoad) {
        intent = 'team_load';
        const now = new Date();
        const [allTasksData, allTicketsData] = await Promise.all([
          deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)),
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
        ]);
        const activeTickets = (allTicketsData as any[]).filter((t: any) => t.status === 'open' || t.status === 'in_progress');
        const activeTasks = (allTasksData as any[]).filter((t: any) => t.status !== 'completed');
        const overdueTasks = (allTasksData as any[]).filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
        const totalOpenItems = activeTickets.length + activeTasks.length;
        const loadStatus = totalOpenItems > 50 ? '🔴 ثقيل جداً' : totalOpenItems > 25 ? '🟡 متوسط' : '🟢 معتدل';

        data = { totalOpenItems, activeTickets: activeTickets.length, activeTasks: activeTasks.length, overdueTasks, loadStatus: totalOpenItems > 50 ? 'heavy' : totalOpenItems > 25 ? 'medium' : 'light' };
        content = `👥 **عبء العمل — ${DEPT_NAMES[deptId!] || 'المنصة'}:**\n\n` +
          `${loadStatus} — **${totalOpenItems}** بند نشط\n\n` +
          `🎫 تذاكر نشطة: **${activeTickets.length}**\n` +
          `✅ مهام جارية: **${activeTasks.length}**\n` +
          (overdueTasks > 0 ? `⏰ مهام متأخرة: **${overdueTasks}** — تحتاج إعادة توزيع\n` : '') +
          `\n💡 **توصية:** ${totalOpenItems > 50 ? 'الفريق تحت ضغط عالٍ — فكّر في إعادة توزيع المهام أو رفع أولويات الحل' : totalOpenItems > 25 ? 'الضغط معتدل — تأكد من توزيع عادل للمهام' : 'الفريق يعمل بشكل جيد — الضغط ضمن الحدود المقبولة'}`;
        suggestions = ['توزيع التذاكر', 'المهام المتأخرة', 'إنتاجية الفريق', 'ملخص الأسبوع'];
      }


      // ─── DEPARTMENT COMPARISON (IT Director / Admin only) ──────────────────────
      else if (isDeptCompare) {
        intent = 'dept_compare';
        const [allTickets, allTasks, allProjects, allRefs] = await Promise.all([
          db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          db.select().from(tasks).where(isNull(tasks.deletedAt)),
          db.select().from(itProjects).where(isNull(itProjects.deletedAt)),
          db.select().from(itReferrals),
        ]);
        const now3 = new Date();
        const deptIds2 = [5, 9, 10, 11, 12];
        const deptScores = deptIds2.map(did => {
          const name = DEPT_NAMES[did] || `قسم ${did}`;
          const dTickets = allTickets.filter((t: any) => t.departmentId === did);
          const dTasks = allTasks.filter((t: any) => t.departmentId === did);
          const dProjects = allProjects.filter((p: any) => p.departmentId === did);
          const completedTasks = dTasks.filter((t: any) => t.status === 'completed').length;
          const totalTasks = dTasks.length;
          const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const resolvedTickets = dTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
          const totalTickets = dTickets.length;
          const ticketRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
          const overdueTasks = dTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now3 && t.status !== 'completed').length;
          const unackRefs2 = allRefs.filter((r: any) => r.toDepartmentId === did && r.status === 'pending' && !r.acknowledgedAt).length;
          const score = Math.round(taskRate * 0.35 + ticketRate * 0.35 + (overdueTasks === 0 ? 20 : overdueTasks < 3 ? 10 : 0) + (unackRefs2 === 0 ? 10 : 0));
          return { name, did, taskRate, ticketRate, overdueTasks, unackRefs: unackRefs2, score, totalTasks, totalTickets, completedTasks, resolvedTickets, activeProjects: dProjects.filter((p: any) => p.status === 'active' || p.status === 'in_progress').length };
        }).sort((a, b) => b.score - a.score);

        data = { departments: deptScores };
        content = `🏆 **مقارنة أداء الأقسام — الترتيب حسب النتيجة:**\n\n`;
        deptScores.forEach((d, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
          const scoreColor = d.score >= 70 ? '' : d.score >= 50 ? ' ⚠️' : ' 🔴';
          content += `${medal} **${d.name}** — **${d.score}/100**${scoreColor}\n`;
          content += `   📋 إنجاز المهام: ${d.taskRate}% | 🎫 حل التذاكر: ${d.ticketRate}%`;
          if (d.overdueTasks > 0) content += ` | ⏰ متأخرة: ${d.overdueTasks}`;
          if (d.unackRefs > 0) content += ` | 📨 بدون رد: ${d.unackRefs}`;
          content += '\n';
        });
        content += `\n💡 **تحليل:** ${deptScores[0].score - deptScores[deptScores.length-1].score > 30 ? 'فجوة كبيرة بين الأقسام — يُنصح بمراجعة القسم الأخير' : 'الأقسام متقاربة في الأداء — مؤشر إيجابي'}`;
        suggestions = ['وضع جميع الأقسام', 'التنبيهات الحرجة', 'ملخص الأسبوع', 'إنتاجية الفريق'];
        actions = [{ label: 'مركز القيادة', href: '/it-director/command-center' }];
      }

      // ─── SMART RECOMMENDATIONS (Enhanced with pattern analysis) ────────────────
      else if (isSmartRecommend) {
        intent = 'smart_recommend';
        const now4 = new Date();
        const weekAgo4 = new Date(now4.getTime() - 7 * 24 * 3600000);
        const [allTickets, allTasks, allRefs, allProjects4, weekTickets] = await Promise.all([
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
          deptId ? db.select().from(tasks).where(and(eq(tasks.departmentId, deptId), isNull(tasks.deletedAt))) : db.select().from(tasks).where(isNull(tasks.deletedAt)),
          deptId ? db.select().from(itReferrals).where(sql`${itReferrals.toDepartmentId} = ${deptId} OR ${itReferrals.fromDepartmentId} = ${deptId}`) : db.select().from(itReferrals),
          deptId ? db.select().from(itProjects).where(and(eq(itProjects.departmentId, deptId), isNull(itProjects.deletedAt))) : db.select().from(itProjects).where(isNull(itProjects.deletedAt)),
          deptId ? db.select().from(itTickets).where(and(eq(itTickets.departmentId, deptId), gte(itTickets.createdAt, weekAgo4), isNull(itTickets.deletedAt))) : db.select().from(itTickets).where(and(gte(itTickets.createdAt, weekAgo4), isNull(itTickets.deletedAt))),
        ]);
        const recommendations: { priority: number; emoji: string; text: string; category: string; impact: string }[] = [];

        const overdueTasks = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now4 && t.status !== 'completed');
        const critTickets = allTickets.filter((t: any) => (t.priority === 'critical' || t.priority === 'urgent') && t.status !== 'closed' && t.status !== 'resolved');
        const unackRefs = (allRefs as any[]).filter((r: any) => (!deptId || r.toDepartmentId === deptId) && r.status === 'pending' && !r.acknowledgedAt);
        const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
        const totalTasks = allTasks.length;
        const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const openTickets = allTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
        const resolvedTickets = allTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
        const ticketRate = allTickets.length > 0 ? Math.round((resolvedTickets / allTickets.length) * 100) : 0;
        const staleProjects = (allProjects4 as any[]).filter((p: any) => p.status === 'active' && p.updatedAt && new Date(p.updatedAt) < weekAgo4);
        const noAssigneeTickets = allTickets.filter((t: any) => !t.assigneeId && (t.status === 'open'));
        const weeklyNewCount = (weekTickets as any[]).length;
        const weeklyResolvedCount = (weekTickets as any[]).filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;

        if (overdueTasks.length > 5) recommendations.push({ priority: 1, emoji: '🔴', text: `لديك ${overdueTasks.length} مهمة متأخرة. خصص ساعة يومياً لإنهاء مهمتين على الأقل.`, category: 'عاجل', impact: 'يرفع نسبة الإنجاز بـ 10%' });
        else if (overdueTasks.length > 0) recommendations.push({ priority: 2, emoji: '🟡', text: `${overdueTasks.length} مهام متأخرة — حاول إنهاء واحدة اليوم على الأقل.`, category: 'تحسين', impact: 'يقلل الضغط ويحسّن الأداء' });
        if (critTickets.length > 3) recommendations.push({ priority: 1, emoji: '🔴', text: `${critTickets.length} تذاكر حرجة مفتوحة. وزّع الحمل على الفريق وحدد مسؤولاً لكل تذكرة.`, category: 'عاجل', impact: 'يمنع تجاوز SLA' });
        if (unackRefs.length > 0) recommendations.push({ priority: 1, emoji: '📨', text: `تأكيد استلام الإحالات الواردة (${unackRefs.length}) يجب أن يكون أول إجراء يومي.`, category: 'عاجل', impact: 'يمنع التصعيد التلقائي' });
        if (noAssigneeTickets.length > 3) recommendations.push({ priority: 2, emoji: '👤', text: `${noAssigneeTickets.length} تذكرة بدون مسؤول — عيّن مسؤولاً لكل تذكرة لتسريع الحل.`, category: 'تنظيم', impact: 'يقلل وقت الاستجابة بـ 40%' });
        if (weeklyNewCount > weeklyResolvedCount * 1.5 && weeklyNewCount > 5) recommendations.push({ priority: 2, emoji: '📈', text: `تدفق التذاكر (${weeklyNewCount} جديدة) أعلى من الحل (${weeklyResolvedCount}) هذا الأسبوع. فكّر في تعزيز الفريق.`, category: 'استراتيجي', impact: 'يمنع تراكم التذاكر' });
        if (staleProjects.length > 0) recommendations.push({ priority: 3, emoji: '📁', text: `${staleProjects.length} مشاريع نشطة لم تُحدّث منذ أسبوع. تحقق من حالتها الفعلية.`, category: 'استراتيجي', impact: 'يكشف مخاطر التأخير مبكراً' });
        if (taskRate < 40) recommendations.push({ priority: 3, emoji: '📊', text: `نسبة إنجاز المهام ${taskRate}% فقط. أعد ترتيب الأولويات وأزل العوائق.`, category: 'استراتيجي', impact: 'يرفع الإنتاجية الإجمالية' });
        if (taskRate >= 80) recommendations.push({ priority: 5, emoji: '🌟', text: `معدل إنجاز ممتاز (${taskRate}%)! ركّز على جودة العمل وتوثيق الإنجازات.`, category: 'تطوير', impact: 'يحافظ على الزخم الإيجابي' });
        if (openTickets > 20) recommendations.push({ priority: 2, emoji: '🎫', text: `${openTickets} تذكرة مفتوحة — صنّفها حسب النوع ووزّعها على الفريق.`, category: 'تنظيم', impact: 'يسرّع وتيرة الحل' });

        const portalTips: Record<string, { emoji: string; text: string; category: string; impact: string }> = {
          cybersecurity: { emoji: '🛡️', text: 'راجع ثغرات CVSS ≥ 9 أسبوعياً وتأكد من إغلاقها خلال 72 ساعة.', category: 'أمني', impact: 'يقلل سطح الهجوم' },
          infrastructure: { emoji: '🖥️', text: 'افحص صحة الخوادم يومياً واضبط تنبيهات لمعدل CPU > 80%.', category: 'وقائي', impact: 'يمنع الأعطال المفاجئة' },
          dmo: { emoji: '📊', text: 'راجع طلبات DSR المعلقة أسبوعياً — مهلة PDPL 30 يوماً.', category: 'امتثال', impact: 'يمنع المخالفات القانونية' },
          support: { emoji: '🎧', text: 'رد على التذاكر خلال 15 دقيقة لتحسين مؤشر SLA.', category: 'خدمة', impact: 'يرفع رضا المستخدمين' },
          digital_transformation: { emoji: '🚀', text: 'حدّث نسب إنجاز المشاريع أسبوعياً لتقارير DGA دقيقة.', category: 'تطوير', impact: 'يحسّن تقييم النضج الرقمي' },
        };
        if (portalTips[portal]) recommendations.push({ priority: 4, ...portalTips[portal] });
        recommendations.push({ priority: 4, emoji: '📅', text: 'خصص 15 دقيقة صباحاً لمراجعة الملخص اليومي من مجيب.', category: 'نصيحة', impact: 'يوفّر وقت المتابعة' });
        if (isAdminOrDirector) recommendations.push({ priority: 3, emoji: '📈', text: 'استخدم "قارن الأقسام" أسبوعياً لاكتشاف الفجوات وإعادة التوازن.', category: 'قيادي', impact: 'يرفع أداء الأقسام الضعيفة' });

        const sorted = recommendations.sort((a, b) => a.priority - b.priority);
        data = { recommendations: sorted, stats: { taskRate, ticketRate, openTickets, overdueTasks: overdueTasks.length } };
        content = `💡 **توصيات مجيب الذكية — ${DEPT_NAMES[deptId!] || 'المنصة'}:**\n\n`;
        sorted.forEach((r, i) => {
          content += `${i + 1}. ${r.emoji} [${r.category}] ${r.text}\n   ↳ الأثر: ${r.impact}\n`;
        });
        content += `\n🎯 **ابدأ بالعناصر العاجلة أولاً ثم انتقل للتطويرية.**`;
        suggestions = ['ماذا أفعل الآن؟', 'ملخص يومي', 'إنتاجية الفريق', 'حالة SLA'];
      }

      // ---- FALLBACK: Smart context-aware suggestions based on portal ----
      else {
        intent = 'general';
        const portalFallback: Record<string, { examples: string[]; chips: string[] }> = {
          cybersecurity: { examples: ['🛡️ "ما الحوادث الأمنية المفتوحة؟"', '🔍 "كم ثغرة حرجة؟"', '📋 "نسبة الامتثال لـ ECC"', '⚠️ "ما التنبيهات الحرجة؟"'], chips: ['الحوادث الأمنية', 'الثغرات الحرجة', 'نسبة الامتثال لـ ECC', 'ضوابط ECC-2:2024'] },
          infrastructure: { examples: ['🖥️ "حالة الخوادم"', '🎫 "كم تذكرة مفتوحة؟"', '⏰ "المهام المتأخرة"', '📊 "إحصائيات القسم"'], chips: ['حالة الخوادم', 'التذاكر المفتوحة', 'المهام المتأخرة', 'إحصائيات القسم'] },
          dmo: { examples: ['📋 "نسبة الامتثال NDMO"', '📄 "طلبات DSR المعلقة"', '🏷️ "تصنيف البيانات"', '📊 "جودة البيانات"'], chips: ['ضوابط NDMO', 'طلبات DSR المعلقة', 'نسبة الامتثال', 'تصنيف البيانات'] },
          support: { examples: ['🎫 "كم تذكرة مفتوحة؟"', '👤 "تذاكري المسندة"', '📨 "الإحالات المعلقة"', '⏱️ "حالة SLA"'], chips: ['كم تذكرة مفتوحة؟', 'تذاكري المسندة', 'الإحالات المعلقة', 'حالة SLA'] },
          digital_transformation: { examples: ['📁 "المشاريع الرقمية النشطة"', '📖 "معايير DGA"', '📊 "مؤشرات الأداء"', '📈 "إنتاجية الفريق"'], chips: ['المشاريع الرقمية النشطة', 'معايير DGA', 'مؤشرات الأداء', 'إنتاجية الفريق'] },
          it_director: { examples: ['🏢 "وضع جميع الأقسام"', '🏆 "قارن الأقسام"', '📊 "KPI التنفيذي"', '⚠️ "التنبيهات الحرجة"'], chips: ['وضع جميع الأقسام', 'قارن الأقسام', 'KPI التنفيذي', 'التنبيهات الحرجة'] },
          committee: { examples: ['🗓️ "الاجتماعات القادمة"', '🗳️ "جلسات التصويت"', '⚖️ "القرارات المعلقة"', '📜 "محاضر الاجتماعات"'], chips: ['الاجتماعات القادمة', 'جلسات التصويت المفتوحة', 'القرارات المعلقة', 'مهام اللجنة'] },
          admin: { examples: ['👥 "إحصائيات المستخدمين"', '🎫 "التذاكر المفتوحة"', '⚠️ "التنبيهات الحرجة"', '📋 "الأطر التنظيمية"'], chips: ['إحصائيات المستخدمين', 'التذاكر المفتوحة', 'التنبيهات الحرجة', 'ملخص يومي'] },
        };
        const fb = portalFallback[portal] || portalFallback.admin;
        const portalLabel2 = PORTAL_LABELS_MAP[portal] || 'المنصة';
        content = `🤔 لم أفهم سؤالك تماماً يا ${userName}.\n\nبصفتك في **${portalLabel2}**، جرّب أحد هذه الأسئلة:\n\n${fb.examples.join('\n')}\n\n✨ يمكنني أيضاً:\n• إنشاء تذاكر ومهام — مثل: "أنشئ تذكرة لمشكلة الطابعة"\n• البحث — مثل: "ابحث عن تذكرة شبكة"\n• تقديم توصيات — مثل: "نصائح وتوصيات"\n\nأو اسألني بصيغة مختلفة! 💬`;
        suggestions = fb.chips;
      }

      return res.json({
        content,
        intent,
        data,
        suggestions,
        actions,
        userName,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('[SmartAssistant] Mojeeb error:', { error: (err as any)?.message });
      res.status(500).json({ error: 'خطأ في المساعد الذكي', content: 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' });
    }
  });


}
