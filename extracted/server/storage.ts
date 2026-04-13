import { eq, desc, sql, and, isNull, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { logger } from "./security-middleware";

import {
  users, sessions, auditLogs, notifications, departments, itDepartments,
  itDepartmentMembers, domains, requirements, evidences, committeeMembers,
  committeeDecisions, committeeMeetings, meetingAttendance, decisionVotes,
  itSystems, itProjects, itTickets, tasks, securityVulnerabilities,
  securityThreats, knowledgeBase, kpiMetrics, escalations, systemSettings,
  complianceReports, dataAssets, dataDictionary, dataStewards, dataQualityRules,
  dataSubjectRequests, dataRisks, securityIncidents, dataAgreements, itAssets,
  dmoRequests, databaseConnections, discoveredTables, dataFlowMappings,
  itReferrals, externalSystems,
  type User, type InsertUser, type Session, type AuditLog, type Notification,
  type Department, type ITDepartment, type ITDepartmentMember, type Domain,
  type Requirement, type Evidence, type CommitteeMember, type CommitteeDecision,
  type CommitteeMeeting, type MeetingAttendance, type DecisionVote, type ITSystem,
  type ITProject, type ITTicket, type Task, type SecurityVulnerability,
  type SecurityThreat, type KnowledgeArticle, type KPIMetric, type Escalation,
  type SystemSetting, type ComplianceReport, type DataAsset, type InsertDataAsset,
  type DataDictionaryTerm, type InsertDataDictionary, type DataSteward, type InsertDataSteward,
  type DataQualityRule, type InsertDataQualityRule,
  type DataQualityCheck, type InsertDataQualityCheck,
  dataQualityChecks,
  type DataSubjectRequest,
  type DataRisk, type SecurityIncident, type DataAgreement, type ITAsset,
  type DmoRequest, type InsertDmoRequest,
  type DatabaseConnection, type InsertDatabaseConnection,
  type DiscoveredTable, type InsertDiscoveredTable,
  type DataFlowMapping, type InsertDataFlowMapping
} from "@shared/schema";
import * as schema from "@shared/schema";

// Database connection singleton for DMO data operations
let dbInstance: ReturnType<typeof drizzle> | null = null;
let dbInitError: Error | null = null;

function getDb() {
  if (dbInitError) {
    throw dbInitError;
  }
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      dbInitError = new Error('DATABASE_URL environment variable is not set');
      logger.warn('[Storage] Database not available - DMO data features will be limited');
      throw dbInitError;
    }
    try {
      const pool = new pg.Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      dbInstance = drizzle(pool, { schema });
      logger.info('[Storage] Database connection established for DMO data');
    } catch (error) {
      dbInitError = error as Error;
      logger.error('[Storage] Failed to connect to database:', { error });
      throw dbInitError;
    }
  }
  return dbInstance;
}

function isDatabaseAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByActivationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Sessions
  getSessions(): Promise<Session[]>;
  getSessionsByUserId(userId: number): Promise<Session[]>;
  createSession(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
  deleteSession(id: number): Promise<boolean>;
  deleteSessionsByUserId(userId: number): Promise<boolean>;
  
  // Audit Logs
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: Partial<Omit<AuditLog, 'id' | 'createdAt'>> & { action: string }): Promise<AuditLog>;
  
  // Notifications
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  getUnreadNotificationsByUserId(userId: number): Promise<Notification[]>;
  createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'deletedAt'>): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  
  // Departments (Business Departments)
  getDepartments(): Promise<Department[]>;
  getDepartmentById(id: number): Promise<Department | undefined>;
  createDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Department>;
  updateDepartment(id: number, data: Partial<Department>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // IT Departments
  getITDepartments(): Promise<ITDepartment[]>;
  getITDepartmentById(id: number): Promise<ITDepartment | undefined>;
  
  // IT Department Members
  getITDepartmentMembers(departmentId: number): Promise<ITDepartmentMember[]>;
  
  // Domains
  getDomains(): Promise<Domain[]>;
  getDomainById(id: number): Promise<Domain | undefined>;
  
  // Requirements
  getRequirements(): Promise<Requirement[]>;
  getRequirementsByDomain(domainId: number): Promise<Requirement[]>;
  getRequirementById(id: number): Promise<Requirement | undefined>;
  
  // Evidences
  getEvidences(): Promise<Evidence[]>;
  getEvidencesByRequirement(requirementId: number): Promise<Evidence[]>;
  getPendingEvidences(): Promise<Evidence[]>;
  getExpiringEvidences(days: number): Promise<Evidence[]>;
  createEvidence(evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Evidence>;
  updateEvidenceStatus(id: number, status: string, reviewedBy?: number, reviewNotes?: string): Promise<Evidence | undefined>;
  
  // Committee Members
  getCommitteeMembers(): Promise<CommitteeMember[]>;
  getActiveCommitteeMembers(): Promise<CommitteeMember[]>;
  getCommitteeMemberById(id: number): Promise<CommitteeMember | undefined>;
  createCommitteeMember(member: Omit<CommitteeMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommitteeMember>;
  updateCommitteeMember(id: number, updates: Partial<CommitteeMember>): Promise<CommitteeMember | undefined>;
  
  // Committee Decisions
  getCommitteeDecisions(): Promise<CommitteeDecision[]>;
  getCommitteeDecisionById(id: number): Promise<CommitteeDecision | undefined>;
  getPendingDecisions(): Promise<CommitteeDecision[]>;
  createCommitteeDecision(decision: Omit<CommitteeDecision, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CommitteeDecision>;
  updateCommitteeDecision(id: number, updates: Partial<CommitteeDecision>): Promise<CommitteeDecision | undefined>;
  
  // Committee Meetings
  getCommitteeMeetings(): Promise<CommitteeMeeting[]>;
  getCommitteeMeetingById(id: number): Promise<CommitteeMeeting | undefined>;
  getUpcomingMeetings(): Promise<CommitteeMeeting[]>;
  createCommitteeMeeting(meeting: Omit<CommitteeMeeting, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CommitteeMeeting>;
  updateCommitteeMeeting(id: number, updates: Partial<CommitteeMeeting>): Promise<CommitteeMeeting | undefined>;
  
  // IT Systems
  getITSystems(): Promise<ITSystem[]>;
  getITSystemById(id: number): Promise<ITSystem | undefined>;
  
  // IT Projects
  getITProjects(): Promise<ITProject[]>;
  getITProjectsByDepartment(departmentId: number): Promise<ITProject[]>;
  getITProjectById(id: number): Promise<ITProject | undefined>;
  createITProject(project: Omit<ITProject, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITProject>;
  updateITProject(id: number, updates: Partial<ITProject>): Promise<ITProject | undefined>;
  deleteITProject(id: number): Promise<void>;
  
  // IT Tickets
  getITTickets(): Promise<ITTicket[]>;
  getITTicketsByDepartment(departmentId: number): Promise<ITTicket[]>;
  getITTicketsByAssignee(assigneeId: number): Promise<ITTicket[]>;
  getOpenTickets(): Promise<ITTicket[]>;
  createITTicket(ticket: Omit<ITTicket, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITTicket>;
  updateITTicketStatus(id: number, status: string): Promise<ITTicket | undefined>;
  
  // Tasks
  getTasks(): Promise<Task[]>;
  getTasksByAssignee(assigneeId: number): Promise<Task[]>;
  getTasksByDepartment(departmentId: number): Promise<Task[]>;
  getOverdueTasks(): Promise<Task[]>;
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task | undefined>;
  updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  escalateTask(id: number, escalatedTo: number): Promise<Task | undefined>;
  
  // Security Vulnerabilities
  getSecurityVulnerabilities(): Promise<SecurityVulnerability[]>;
  getOpenVulnerabilities(): Promise<SecurityVulnerability[]>;
  getCriticalVulnerabilities(): Promise<SecurityVulnerability[]>;
  createSecurityVulnerability(vuln: Omit<SecurityVulnerability, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityVulnerability>;
  updateVulnerabilityStatus(id: number, status: string): Promise<SecurityVulnerability | undefined>;
  
  // Security Threats
  getSecurityThreats(): Promise<SecurityThreat[]>;
  getActiveThreats(): Promise<SecurityThreat[]>;
  createSecurityThreat(threat: Omit<SecurityThreat, 'id' | 'createdAt'>): Promise<SecurityThreat>;
  
  // Knowledge Base
  getKnowledgeArticles(): Promise<KnowledgeArticle[]>;
  getKnowledgeArticlesByCategory(category: string): Promise<KnowledgeArticle[]>;
  getKnowledgeArticleById(id: number): Promise<KnowledgeArticle | undefined>;
  searchKnowledgeBase(query: string): Promise<KnowledgeArticle[]>;
  createKnowledgeArticle(article: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeArticle>;
  
  // KPI Metrics
  getKPIMetrics(): Promise<KPIMetric[]>;
  getKPIMetricsByDepartment(departmentId: number): Promise<KPIMetric[]>;
  createKPIMetric(metric: Omit<KPIMetric, 'id' | 'createdAt'>): Promise<KPIMetric>;
  updateKPIMetric(id: number, updates: Partial<KPIMetric>): Promise<KPIMetric | undefined>;
  deleteKPIMetric(id: number): Promise<boolean>;
  
  // Escalations
  getEscalations(): Promise<Escalation[]>;
  getPendingEscalations(): Promise<Escalation[]>;
  createEscalation(escalation: Omit<Escalation, 'id' | 'createdAt'>): Promise<Escalation>;
  resolveEscalation(id: number, resolution: string): Promise<Escalation | undefined>;
  
  // System Settings
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSettingByKey(key: string): Promise<SystemSetting | undefined>;
  updateSystemSetting(key: string, value: string): Promise<SystemSetting | undefined>;
  
  // Compliance Reports
  getComplianceReports(): Promise<ComplianceReport[]>;
  getComplianceReportById(id: number): Promise<ComplianceReport | undefined>;
  createComplianceReport(report: Omit<ComplianceReport, 'id' | 'createdAt'>): Promise<ComplianceReport>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalUsers: number;
    totalDomains: number;
    totalRequirements: number;
    complianceRate: number;
    pendingEvidences: number;
    openTickets: number;
    activeThreats: number;
    pendingEscalations: number;
  }>;
  
  getITDirectorStats(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    avgResolutionTime: number;
    slaComplianceRate: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    totalReferrals: number;
    pendingReferrals: number;
    totalStaff: number;
    securityAlerts: number;
    pendingApprovals: number;
    systemHealthScore: number;
    departmentStats: Array<{
      departmentId: number;
      departmentName: string;
      departmentCode: string;
      openTickets: number;
      closedTickets: number;
      totalTickets: number;
      activeProjects: number;
      totalProjects: number;
      openTasks: number;
      completedTasks: number;
      totalTasks: number;
      pendingReferrals: number;
      totalReferrals: number;
      staffCount: number;
      slaComplianceRate: number;
      healthScore: number;
    }>;
  }>;
  
  getCybersecurityStats(): Promise<{
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    activeThreats: number;
    resolvedThreats: number;
    avgResolutionTime: number;
    threatsByType: Record<string, number>;
  }>;
  
  // IT Assets (CTO Management)
  getITAssets(): Promise<ITAsset[]>;
  getITAssetById(id: number): Promise<ITAsset | undefined>;
  getITAssetsByDepartment(departmentId: number): Promise<ITAsset[]>;
  createITAsset(asset: Omit<ITAsset, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITAsset>;
  updateITAsset(id: number, updates: Partial<ITAsset>): Promise<ITAsset | undefined>;
  deleteITAsset(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {

  constructor() {
    this.initializeDatabase().catch(err => {
      logger.error('[Storage] Failed to initialize database:', { error: err });
    });
  }

  private async initializeDatabase() {
    const database = getDb();

    await this.ensureDomainsSeeded(database);

    const existingUsers = await database.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      logger.info('[Storage] Database already initialized');
      return;
    }

    const bcrypt = await import('bcryptjs');
    const defaultPassword = await bcrypt.hash('Admin@2024', 10);

    await database.insert(users).values({
      email: 'admin@jcsa.sa',
      passwordHash: defaultPassword,
      name: 'مدير النظام',
      nameEn: 'System Admin',
      phone: '+966500000000',
      role: 'admin',
      portal: 'admin',
      jobTitle: 'مدير النظام',
      itDepartmentId: null,
      isActive: true,
      isActivated: true,
      emailNotificationsEnabled: false,
      loginAttempts: 0,
    });

    const itDepts = [
      { nameAr: 'إدارة مكتب البيانات', nameEn: 'Data Management Office', code: 'DMO', departmentType: 'dmo', color: '#6366f1', icon: 'Database', sortOrder: -1 },
      { nameAr: 'إدارة البنية التحتية والشبكات', nameEn: 'Infrastructure & Networks', code: 'INFRA', departmentType: 'infrastructure', color: '#1e3a5f', icon: 'Server', sortOrder: 0 },
      { nameAr: 'إدارة الأمن السيبراني', nameEn: 'Cybersecurity', code: 'CYBER', departmentType: 'cybersecurity', color: '#c9a227', icon: 'Shield', sortOrder: 1 },
      { nameAr: 'إدارة التحول الرقمي والتطبيقات', nameEn: 'Digital Transformation', code: 'DTA', departmentType: 'digital_transformation', color: '#2d4a6f', icon: 'Smartphone', sortOrder: 2 },
      { nameAr: 'إدارة الدعم الفني', nameEn: 'Technical Support', code: 'SUPPORT', departmentType: 'technical_support', color: '#3d5a80', icon: 'Headphones', sortOrder: 3 },
    ];

    const insertedItDepts: any[] = [];
    for (const dept of itDepts) {
      const [inserted] = await database.insert(itDepartments).values({ ...dept, isActive: true }).returning();
      insertedItDepts.push(inserted);
    }

    const businessDepts = [
      { nameAr: 'إدارة السباقات', nameEn: 'Racing Department', code: 'RACING', description: 'إدارة وتنظيم سباقات الخيل' },
      { nameAr: 'إدارة العضوية', nameEn: 'Membership Department', code: 'MEMBER', description: 'إدارة شؤون الأعضاء والعضويات' },
      { nameAr: 'الشؤون المالية', nameEn: 'Finance Department', code: 'FINANCE', description: 'إدارة الشؤون المالية والميزانية' },
      { nameAr: 'الموارد البشرية', nameEn: 'Human Resources', code: 'HR', description: 'إدارة شؤون الموظفين والتوظيف' },
      { nameAr: 'إدارة المرافق', nameEn: 'Facilities Department', code: 'FACILITY', description: 'إدارة وصيانة المرافق والمنشآت' },
      { nameAr: 'إدارة التسويق والإعلام', nameEn: 'Marketing & Media', code: 'MARKETING', description: 'التسويق والعلاقات العامة والإعلام' },
      { nameAr: 'إدارة الشؤون القانونية', nameEn: 'Legal Affairs', code: 'LEGAL', description: 'الشؤون القانونية والامتثال' },
      { nameAr: 'إدارة خدمات الخيل', nameEn: 'Horse Services', code: 'HORSE', description: 'خدمات رعاية الخيل والإسطبلات' },
    ];

    for (const dept of businessDepts) {
      await database.insert(departments).values({ ...dept, isActive: true });
    }

    const coreUsers = [
      { email: 'director@jcsa.sa', name: 'مدير تقنية المعلومات', nameEn: 'IT Director', role: 'it_director', portal: 'it_director', jobTitle: 'مدير تقنية المعلومات' },
      { email: 'infra@jcsa.sa', name: 'مدير البنية التحتية', nameEn: 'Infrastructure Manager', role: 'it_infrastructure_manager', portal: 'infrastructure', jobTitle: 'مدير البنية التحتية', itDepartmentId: insertedItDepts[1]?.id },
      { email: 'cyber@jcsa.sa', name: 'مدير الأمن السيبراني', nameEn: 'Cybersecurity Manager', role: 'it_cybersecurity_manager', portal: 'cybersecurity', jobTitle: 'مدير الأمن السيبراني', itDepartmentId: insertedItDepts[2]?.id },
      { email: 'digital@jcsa.sa', name: 'مدير التحول الرقمي', nameEn: 'Digital Transformation Manager', role: 'it_digital_manager', portal: 'digital_transformation', jobTitle: 'مدير التحول الرقمي', itDepartmentId: insertedItDepts[3]?.id },
      { email: 'support@jcsa.sa', name: 'مدير الدعم الفني', nameEn: 'Support Manager', role: 'it_support_manager', portal: 'support', jobTitle: 'مدير الدعم الفني', itDepartmentId: insertedItDepts[4]?.id },
      { email: 'dmo@jcsa.sa', name: 'مدير إدارة البيانات', nameEn: 'DMO Manager', role: 'dmo_manager', portal: 'dmo', jobTitle: 'مدير مكتب البيانات', itDepartmentId: insertedItDepts[0]?.id },
    ];

    for (const u of coreUsers) {
      await database.insert(users).values({
        ...u,
        passwordHash: defaultPassword,
        phone: '+966500000000',
        isActive: true,
        isActivated: true,
        emailNotificationsEnabled: false,
        mustChangePassword: true,
        loginAttempts: 0,
      });
    }

    logger.info('[Storage] Database initialization complete — default admin and department managers created');
  }

  private async ensureDomainsSeeded(database: any) {
    try {
      const existingDomains = await database.select().from(domains).limit(1);
      if (existingDomains.length > 0) return;
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
        await database.insert(domains).values({ ...d, isActive: true }).onConflictDoNothing();
      }
      logger.info('[Storage] 15 NDMO domains seeded');
    } catch (err) {
      logger.warn('[Storage] Domain seeding skipped:', { error: (err as Error).message });
    }
  }

  // Users - Using Database
  async getUsers(): Promise<User[]> {
    const database = getDb();
    return await database.select().from(users).where(isNull(users.deletedAt));
  }

  async getUserById(id: number): Promise<User | undefined> {
    const database = getDb();
    const [user] = await database.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const database = getDb();
    const [user] = await database.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }

  async getUserByActivationToken(token: string): Promise<User | undefined> {
    const database = getDb();
    const [user] = await database.select().from(users).where(eq(users.activationToken, token));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const database = getDb();
    const [created] = await database.insert(users).values({
      email: (user.email || '').toLowerCase().trim(),
      passwordHash: user.passwordHash || null,
      name: user.name,
      nameEn: user.nameEn || null,
      phone: user.phone || null,
      role: user.role || 'user',
      portal: user.portal || 'user',
      departmentId: user.departmentId || null,
      itDepartmentId: user.itDepartmentId || null,
      jobTitle: user.jobTitle || null,
      avatar: user.avatar || null,
      isActive: user.isActive ?? true,
      isActivated: user.isActivated ?? false,
      activationToken: user.activationToken || null,
      activationTokenExpiry: user.activationTokenExpiry || null,
      passwordResetToken: user.passwordResetToken || null,
      passwordResetTokenExpiry: user.passwordResetTokenExpiry || null,
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
    }).returning();
    return created;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const database = getDb();
    const [updated] = await database.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    const database = getDb();
    const [existing] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!existing) return false;
    await database.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
    return true;
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    const database = getDb();
    return await database.select().from(sessions);
  }

  async getSessionsByUserId(userId: number): Promise<Session[]> {
    const database = getDb();
    return await database.select().from(sessions).where(eq(sessions.userId, userId));
  }

  async createSession(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const database = getDb();
    const [created] = await database.insert(sessions).values({
      userId: session.userId,
      token: session.token,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      isActive: session.isActive ?? true,
      expiresAt: session.expiresAt,
    }).returning();
    return created;
  }

  async deleteSession(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(sessions).where(eq(sessions.id, id));
    return true;
  }

  async deleteSessionsByUserId(userId: number): Promise<boolean> {
    const database = getDb();
    await database.delete(sessions).where(eq(sessions.userId, userId));
    return true;
  }

  // Audit Logs
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const database = getDb();
    return await database.select().from(auditLogs).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit);
  }

  async createAuditLog(log: Partial<Omit<AuditLog, 'id' | 'createdAt'>> & { action: string }): Promise<AuditLog> {
    const database = getDb();
    const [created] = await database.insert(auditLogs).values({
      userId: log.userId ?? null,
      sessionId: log.sessionId ?? null,
      action: log.action,
      actionCategory: log.actionCategory ?? 'user_action',
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      resource: log.resource ?? null,
      oldValue: log.oldValue ?? null,
      newValue: log.newValue ?? null,
      changedFields: log.changedFields ?? null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      requestId: log.requestId ?? null,
      requestMethod: log.requestMethod ?? null,
      requestPath: log.requestPath ?? null,
      outcome: log.outcome ?? 'success',
      severity: log.severity ?? 'info',
      policyDecision: log.policyDecision ?? null,
      errorMessage: log.errorMessage ?? null,
      details: log.details ?? null,
      metadata: log.metadata ?? null,
    }).returning();
    return created;
  }

  // Notifications
  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    const database = getDb();
    return await database.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(sql`${notifications.createdAt} DESC`);
  }

  async getUnreadNotificationsByUserId(userId: number): Promise<Notification[]> {
    const database = getDb();
    return await database.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))).orderBy(sql`${notifications.createdAt} DESC`);
  }

  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'deletedAt'>): Promise<Notification> {
    const database = getDb();
    const [created] = await database.insert(notifications).values({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'normal',
      isRead: notification.isRead ?? false,
      actionUrl: notification.actionUrl || null,
      entityType: notification.entityType || null,
      entityId: notification.entityId || null,
    }).returning();
    return created;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const database = getDb();
    await database.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    return true;
  }

  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    const database = getDb();
    await database.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
    return true;
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    const database = getDb();
    return await database.select().from(departments).where(isNull(departments.deletedAt));
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const database = getDb();
    const [dept] = await database.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Department> {
    const database = getDb();
    const [created] = await database.insert(departments).values({
      nameAr: data.nameAr,
      nameEn: data.nameEn || null,
      code: data.code,
      description: data.description || null,
      managerId: data.managerId || null,
      parentId: data.parentId || null,
      isActive: data.isActive ?? true,
    }).returning();
    return created;
  }

  async updateDepartment(id: number, data: Partial<Department>): Promise<Department | undefined> {
    const database = getDb();
    await database.update(departments).set({ ...data, updatedAt: new Date() }).where(eq(departments.id, id));
    const [updated] = await database.select().from(departments).where(eq(departments.id, id));
    return updated;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const database = getDb();
    const [existing] = await database.select({ id: departments.id }).from(departments).where(and(eq(departments.id, id), isNull(departments.deletedAt)));
    if (!existing) return false;
    await database.update(departments).set({ deletedAt: new Date() }).where(eq(departments.id, id));
    return true;
  }

  // IT Departments
  async getITDepartments(): Promise<ITDepartment[]> {
    const database = getDb();
    return await database.select().from(itDepartments).orderBy(sql`${itDepartments.sortOrder} ASC`);
  }

  async getITDepartmentById(id: number): Promise<ITDepartment | undefined> {
    const database = getDb();
    const [dept] = await database.select().from(itDepartments).where(eq(itDepartments.id, id));
    return dept;
  }

  // IT Department Members
  async getITDepartmentMembers(departmentId: number): Promise<ITDepartmentMember[]> {
    const database = getDb();
    return await database.select().from(itDepartmentMembers).where(eq(itDepartmentMembers.departmentId, departmentId));
  }

  // Domains
  async getDomains(): Promise<Domain[]> {
    const database = getDb();
    return await database.select().from(domains).orderBy(sql`${domains.sortOrder} ASC`);
  }

  async getDomainById(id: number): Promise<Domain | undefined> {
    const database = getDb();
    const [domain] = await database.select().from(domains).where(eq(domains.id, id));
    return domain;
  }

  // Requirements
  async getRequirements(): Promise<Requirement[]> {
    const database = getDb();
    return await database.select().from(requirements).where(and(isNull(requirements.deletedAt), eq(requirements.isActive, true)));
  }

  async getRequirementsByDomain(domainId: number): Promise<Requirement[]> {
    const database = getDb();
    return await database.select().from(requirements).where(and(eq(requirements.domainId, domainId), isNull(requirements.deletedAt), eq(requirements.isActive, true)));
  }

  async getRequirementById(id: number): Promise<Requirement | undefined> {
    const database = getDb();
    const [req] = await database.select().from(requirements).where(eq(requirements.id, id));
    return req;
  }

  // Evidences
  async getEvidences(): Promise<Evidence[]> {
    const database = getDb();
    return await database.select().from(evidences).where(isNull(evidences.deletedAt));
  }

  async getEvidencesByRequirement(requirementId: number): Promise<Evidence[]> {
    const database = getDb();
    return await database.select().from(evidences).where(and(eq(evidences.requirementId, requirementId), isNull(evidences.deletedAt)));
  }

  async getPendingEvidences(): Promise<Evidence[]> {
    const database = getDb();
    return await database.select().from(evidences).where(and(eq(evidences.status, 'pending'), isNull(evidences.deletedAt)));
  }

  async getExpiringEvidences(days: number): Promise<Evidence[]> {
    const database = getDb();
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return await database.select().from(evidences).where(and(eq(evidences.isExpired, false), sql`${evidences.expiryDate} <= ${threshold}`));
  }

  async createEvidence(evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Evidence> {
    const database = getDb();
    const [created] = await database.insert(evidences).values({ ...evidence }).returning();
    return created;
  }

  async updateEvidenceStatus(id: number, status: string, reviewedBy?: number, reviewNotes?: string): Promise<Evidence | undefined> {
    const database = getDb();
    await database.update(evidences).set({ status, reviewedBy: reviewedBy || null, reviewNotes: reviewNotes || null, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(evidences.id, id));
    const [updated] = await database.select().from(evidences).where(eq(evidences.id, id));
    return updated;
  }

  // Committee Members
  async getCommitteeMembers(): Promise<CommitteeMember[]> {
    const database = getDb();
    return await database.select().from(committeeMembers);
  }

  async getActiveCommitteeMembers(): Promise<CommitteeMember[]> {
    const database = getDb();
    return await database.select().from(committeeMembers).where(eq(committeeMembers.isActive, true));
  }

  async getCommitteeMemberById(id: number): Promise<CommitteeMember | undefined> {
    const database = getDb();
    const [member] = await database.select().from(committeeMembers).where(eq(committeeMembers.id, id));
    return member;
  }

  async createCommitteeMember(member: Omit<CommitteeMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommitteeMember> {
    const database = getDb();
    const [created] = await database.insert(committeeMembers).values({ ...member }).returning();
    return created;
  }

  async updateCommitteeMember(id: number, updates: Partial<CommitteeMember>): Promise<CommitteeMember | undefined> {
    const database = getDb();
    await database.update(committeeMembers).set({ ...updates, updatedAt: new Date() }).where(eq(committeeMembers.id, id));
    const [updated] = await database.select().from(committeeMembers).where(eq(committeeMembers.id, id));
    return updated;
  }

  // Committee Decisions
  async getCommitteeDecisions(): Promise<CommitteeDecision[]> {
    const database = getDb();
    return await database.select().from(committeeDecisions);
  }

  async getCommitteeDecisionById(id: number): Promise<CommitteeDecision | undefined> {
    const database = getDb();
    const [decision] = await database.select().from(committeeDecisions).where(eq(committeeDecisions.id, id));
    return decision;
  }

  async getPendingDecisions(): Promise<CommitteeDecision[]> {
    const database = getDb();
    return await database.select().from(committeeDecisions).where(eq(committeeDecisions.status, 'pending_vote'));
  }

  async createCommitteeDecision(decision: Omit<CommitteeDecision, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CommitteeDecision> {
    const database = getDb();
    const [created] = await database.insert(committeeDecisions).values({ ...decision }).returning();
    return created;
  }

  async updateCommitteeDecision(id: number, updates: Partial<CommitteeDecision>): Promise<CommitteeDecision | undefined> {
    const database = getDb();
    await database.update(committeeDecisions).set({ ...updates, updatedAt: new Date() }).where(eq(committeeDecisions.id, id));
    const [updated] = await database.select().from(committeeDecisions).where(eq(committeeDecisions.id, id));
    return updated;
  }

  // Committee Meetings
  async getCommitteeMeetings(): Promise<CommitteeMeeting[]> {
    const database = getDb();
    return await database.select().from(committeeMeetings).where(isNull(committeeMeetings.deletedAt));
  }

  async getCommitteeMeetingById(id: number): Promise<CommitteeMeeting | undefined> {
    const database = getDb();
    const [meeting] = await database.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
    return meeting;
  }

  async getUpcomingMeetings(): Promise<CommitteeMeeting[]> {
    const database = getDb();
    const now = new Date();
    return await database.select().from(committeeMeetings).where(and(eq(committeeMeetings.status, 'scheduled'), sql`${committeeMeetings.scheduledDate} > ${now}`));
  }

  async createCommitteeMeeting(meeting: Omit<CommitteeMeeting, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<CommitteeMeeting> {
    const database = getDb();
    const [created] = await database.insert(committeeMeetings).values({ ...meeting }).returning();
    return created;
  }

  async updateCommitteeMeeting(id: number, updates: Partial<CommitteeMeeting>): Promise<CommitteeMeeting | undefined> {
    const database = getDb();
    await database.update(committeeMeetings).set({ ...updates, updatedAt: new Date() }).where(eq(committeeMeetings.id, id));
    const [updated] = await database.select().from(committeeMeetings).where(eq(committeeMeetings.id, id));
    return updated;
  }

  // IT Systems
  async getITSystems(): Promise<ITSystem[]> {
    const database = getDb();
    return await database.select().from(itSystems);
  }

  async getITSystemById(id: number): Promise<ITSystem | undefined> {
    const database = getDb();
    const [system] = await database.select().from(itSystems).where(eq(itSystems.id, id));
    return system;
  }

  // IT Projects
  async getITProjects(): Promise<ITProject[]> {
    const database = getDb();
    return await database.select().from(itProjects).where(isNull(itProjects.deletedAt));
  }

  async getITProjectsByDepartment(departmentId: number): Promise<ITProject[]> {
    const database = getDb();
    return await database.select().from(itProjects).where(and(eq(itProjects.itDepartmentId, departmentId), isNull(itProjects.deletedAt)));
  }

  async getITProjectById(id: number): Promise<ITProject | undefined> {
    const database = getDb();
    const [project] = await database.select().from(itProjects).where(and(eq(itProjects.id, id), isNull(itProjects.deletedAt)));
    return project;
  }

  async createITProject(project: Omit<ITProject, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITProject> {
    const database = getDb();
    const [created] = await database.insert(itProjects).values({ ...project }).returning();
    return created;
  }

  async updateITProject(id: number, updates: Partial<ITProject>): Promise<ITProject | undefined> {
    const database = getDb();
    await database.update(itProjects).set({ ...updates, updatedAt: new Date() }).where(eq(itProjects.id, id));
    const [updated] = await database.select().from(itProjects).where(eq(itProjects.id, id));
    return updated;
  }

  async deleteITProject(id: number): Promise<void> {
    const database = getDb();
    await database.update(itProjects).set({ deletedAt: new Date() }).where(eq(itProjects.id, id));
  }

  // IT Tickets
  async getITTickets(): Promise<ITTicket[]> {
    const database = getDb();
    return await database.select().from(itTickets).where(isNull(itTickets.deletedAt)).orderBy(sql`${itTickets.createdAt} DESC`);
  }

  async getITTicketsByDepartment(departmentId: number): Promise<ITTicket[]> {
    const database = getDb();
    return await database.select().from(itTickets).where(and(eq(itTickets.departmentId, departmentId), isNull(itTickets.deletedAt)));
  }

  async getITTicketsByAssignee(assigneeId: number): Promise<ITTicket[]> {
    const database = getDb();
    return await database.select().from(itTickets).where(and(eq(itTickets.assigneeId, assigneeId), isNull(itTickets.deletedAt)));
  }

  async getOpenTickets(): Promise<ITTicket[]> {
    const database = getDb();
    return await database.select().from(itTickets).where(and(sql`${itTickets.status} IN ('open', 'in_progress')`, isNull(itTickets.deletedAt)));
  }

  async createITTicket(ticket: Omit<ITTicket, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITTicket> {
    const database = getDb();
    const [created] = await database.insert(itTickets).values({ ...ticket }).returning();
    return created;
  }

  async updateITTicketStatus(id: number, status: string): Promise<ITTicket | undefined> {
    const database = getDb();
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'resolved') updates.resolvedAt = new Date();
    if (status === 'closed') updates.closedAt = new Date();
    await database.update(itTickets).set(updates).where(eq(itTickets.id, id));
    const [updated] = await database.select().from(itTickets).where(eq(itTickets.id, id));
    return updated;
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    const database = getDb();
    return await database.select().from(tasks).where(isNull(tasks.deletedAt));
  }

  async getTasksByAssignee(assigneeId: number): Promise<Task[]> {
    const database = getDb();
    return await database.select().from(tasks).where(and(eq(tasks.assignedTo, assigneeId), isNull(tasks.deletedAt)));
  }

  async getTasksByDepartment(departmentId: number): Promise<Task[]> {
    const database = getDb();
    return await database.select().from(tasks).where(and(eq(tasks.departmentId, departmentId), isNull(tasks.deletedAt)));
  }

  async getOverdueTasks(): Promise<Task[]> {
    const database = getDb();
    const now = new Date();
    return await database.select().from(tasks).where(and(sql`${tasks.dueDate} < ${now}`, ne(tasks.status, 'completed'), ne(tasks.status, 'cancelled'), isNull(tasks.deletedAt)));
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Task> {
    const database = getDb();
    const [created] = await database.insert(tasks).values({ ...task }).returning();
    return created;
  }

  async updateTaskStatus(id: number, status: string): Promise<Task | undefined> {
    const database = getDb();
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'completed') updates.completedAt = new Date();
    await database.update(tasks).set(updates).where(eq(tasks.id, id));
    const [updated] = await database.select().from(tasks).where(eq(tasks.id, id));
    return updated;
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined> {
    const database = getDb();
    const { id: _, createdAt: __, ...safeUpdates } = updates as any;
    await database.update(tasks).set({ ...safeUpdates, updatedAt: new Date() }).where(eq(tasks.id, id));
    const [updated] = await database.select().from(tasks).where(eq(tasks.id, id));
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    const database = getDb();
    const result = await database.update(tasks).set({ deletedAt: new Date() }).where(and(eq(tasks.id, id), isNull(tasks.deletedAt)));
    return (result.rowCount ?? 0) > 0;
  }

  async escalateTask(id: number, escalatedTo: number): Promise<Task | undefined> {
    const database = getDb();
    await database.update(tasks).set({ isEscalated: true, escalatedAt: new Date(), escalatedTo, updatedAt: new Date() }).where(eq(tasks.id, id));
    const [updated] = await database.select().from(tasks).where(eq(tasks.id, id));
    return updated;
  }

  // Security Vulnerabilities
  async getSecurityVulnerabilities(): Promise<SecurityVulnerability[]> {
    const database = getDb();
    return await database.select().from(securityVulnerabilities).orderBy(desc(securityVulnerabilities.createdAt));
  }

  async getOpenVulnerabilities(): Promise<SecurityVulnerability[]> {
    const database = getDb();
    return await database.select().from(securityVulnerabilities).where(eq(securityVulnerabilities.status, 'open'));
  }

  async getCriticalVulnerabilities(): Promise<SecurityVulnerability[]> {
    const database = getDb();
    return await database.select().from(securityVulnerabilities).where(eq(securityVulnerabilities.severity, 'critical'));
  }

  async createSecurityVulnerability(vuln: Omit<SecurityVulnerability, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityVulnerability> {
    const database = getDb();
    const [created] = await database.insert(securityVulnerabilities).values({ ...vuln }).returning();
    return created;
  }

  async updateVulnerabilityStatus(id: number, status: string): Promise<SecurityVulnerability | undefined> {
    const database = getDb();
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'resolved') updates.resolvedAt = new Date();
    await database.update(securityVulnerabilities).set(updates).where(eq(securityVulnerabilities.id, id));
    const [updated] = await database.select().from(securityVulnerabilities).where(eq(securityVulnerabilities.id, id));
    return updated;
  }

  // Security Threats
  async getSecurityThreats(): Promise<SecurityThreat[]> {
    const database = getDb();
    return await database.select().from(securityThreats).orderBy(desc(securityThreats.createdAt));
  }

  async getActiveThreats(): Promise<SecurityThreat[]> {
    const database = getDb();
    return await database.select().from(securityThreats).where(eq(securityThreats.status, 'active'));
  }

  async createSecurityThreat(threat: Omit<SecurityThreat, 'id' | 'createdAt'>): Promise<SecurityThreat> {
    const database = getDb();
    const [created] = await database.insert(securityThreats).values({ ...threat }).returning();
    return created;
  }

  // Knowledge Base
  async getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
    const database = getDb();
    return await database.select().from(knowledgeBase).where(eq(knowledgeBase.status, 'published'));
  }

  async getKnowledgeArticlesByCategory(category: string): Promise<KnowledgeArticle[]> {
    const database = getDb();
    return await database.select().from(knowledgeBase).where(and(eq(knowledgeBase.category, category), eq(knowledgeBase.status, 'published')));
  }

  async getKnowledgeArticleById(id: number): Promise<KnowledgeArticle | undefined> {
    const database = getDb();
    const [article] = await database.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
    return article;
  }

  async searchKnowledgeBase(query: string): Promise<KnowledgeArticle[]> {
    const database = getDb();
    const lowerQuery = `%${query.toLowerCase()}%`;
    return await database.select().from(knowledgeBase).where(
      and(
        eq(knowledgeBase.status, 'published'),
        sql`(LOWER(${knowledgeBase.title}) LIKE ${lowerQuery} OR LOWER(${knowledgeBase.content}) LIKE ${lowerQuery})`
      )
    );
  }

  async createKnowledgeArticle(article: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeArticle> {
    const database = getDb();
    const [created] = await database.insert(knowledgeBase).values({ ...article }).returning();
    return created;
  }

  // KPI Metrics
  async getKPIMetrics(): Promise<KPIMetric[]> {
    const database = getDb();
    return await database.select().from(kpiMetrics).orderBy(desc(kpiMetrics.createdAt));
  }

  async getKPIMetricsByDepartment(departmentId: number): Promise<KPIMetric[]> {
    const database = getDb();
    return await database.select().from(kpiMetrics).where(eq(kpiMetrics.departmentId, departmentId));
  }

  async createKPIMetric(metric: Omit<KPIMetric, 'id' | 'createdAt'>): Promise<KPIMetric> {
    const database = getDb();
    const [created] = await database.insert(kpiMetrics).values({ ...metric }).returning();
    return created;
  }

  async updateKPIMetric(id: number, updates: Partial<KPIMetric>): Promise<KPIMetric | undefined> {
    const database = getDb();
    const { id: _, ...safeUpdates } = updates as any;
    await database.update(kpiMetrics).set(safeUpdates).where(eq(kpiMetrics.id, id));
    const [updated] = await database.select().from(kpiMetrics).where(eq(kpiMetrics.id, id));
    return updated;
  }

  async deleteKPIMetric(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(kpiMetrics).where(eq(kpiMetrics.id, id));
    return true;
  }

  // Escalations
  async getEscalations(): Promise<Escalation[]> {
    const database = getDb();
    return await database.select().from(escalations).orderBy(desc(escalations.createdAt));
  }

  async getPendingEscalations(): Promise<Escalation[]> {
    const database = getDb();
    return await database.select().from(escalations).where(eq(escalations.status, 'pending'));
  }

  async createEscalation(escalation: Omit<Escalation, 'id' | 'createdAt'>): Promise<Escalation> {
    const database = getDb();
    const [created] = await database.insert(escalations).values({ ...escalation }).returning();
    return created;
  }

  async resolveEscalation(id: number, resolution: string): Promise<Escalation | undefined> {
    const database = getDb();
    await database.update(escalations).set({ status: 'resolved', resolution, resolvedAt: new Date() }).where(eq(escalations.id, id));
    const [updated] = await database.select().from(escalations).where(eq(escalations.id, id));
    return updated;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSetting[]> {
    const database = getDb();
    return await database.select().from(systemSettings);
  }

  async getSystemSettingByKey(key: string): Promise<SystemSetting | undefined> {
    const database = getDb();
    const [setting] = await database.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }

  async updateSystemSetting(key: string, value: string): Promise<SystemSetting | undefined> {
    const database = getDb();
    await database.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    const [updated] = await database.select().from(systemSettings).where(eq(systemSettings.key, key));
    return updated;
  }

  // Compliance Reports
  async getComplianceReports(): Promise<ComplianceReport[]> {
    const database = getDb();
    return await database.select().from(complianceReports).orderBy(desc(complianceReports.createdAt));
  }

  async getComplianceReportById(id: number): Promise<ComplianceReport | undefined> {
    const database = getDb();
    const [report] = await database.select().from(complianceReports).where(eq(complianceReports.id, id));
    return report;
  }

  async createComplianceReport(report: Omit<ComplianceReport, 'id' | 'createdAt'>): Promise<ComplianceReport> {
    const database = getDb();
    const [created] = await database.insert(complianceReports).values({ ...report }).returning();
    return created;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const database = getDb();
    const users = await this.getUsers();
    const domains = await this.getDomains();
    const requirements = await this.getRequirements();
    const evidences = await this.getEvidences();
    const tickets = await this.getOpenTickets();
    const threats = await this.getActiveThreats();
    const escalations = await this.getPendingEscalations();

    const approvedEvidences = evidences.filter(e => e.status === 'approved').length;
    const complianceRate = evidences.length > 0 ? (approvedEvidences / evidences.length) * 100 : 0;

    // Week-over-week trends
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const usersThisWeek = users.filter(u => u.createdAt && new Date(u.createdAt) >= weekAgo).length;
    const usersLastWeek = users.filter(u => u.createdAt && new Date(u.createdAt) >= twoWeeksAgo && new Date(u.createdAt) < weekAgo).length;
    const userTrend = usersLastWeek > 0 ? Math.round(((usersThisWeek - usersLastWeek) / usersLastWeek) * 100) : (usersThisWeek > 0 ? 100 : 0);

    // Sparkline: new users per day for last 7 days
    const userSparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      userSparkline.push(users.filter(u => u.createdAt && new Date(u.createdAt) >= dayStart && new Date(u.createdAt) < dayEnd).length);
    }

    // Ticket trend: compare open tickets created this week vs last week
    let allTickets: any[] = [];
    try {
      allTickets = await database.select({ createdAt: itTickets.createdAt, status: itTickets.status }).from(itTickets);
    } catch {}
    const ticketsThisWeek = allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= weekAgo).length;
    const ticketsLastWeek = allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= twoWeeksAgo && new Date(t.createdAt) < weekAgo).length;
    const ticketTrend = ticketsLastWeek > 0 ? Math.round(((ticketsThisWeek - ticketsLastWeek) / ticketsLastWeek) * 100) : 0;

    // Sparkline: tickets opened per day for last 7 days
    const ticketSparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      ticketSparkline.push(allTickets.filter(t => t.createdAt && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) < dayEnd).length);
    }

    return {
      totalUsers: users.length,
      totalDomains: domains.length,
      totalRequirements: requirements.length,
      complianceRate: Math.round(complianceRate),
      pendingEvidences: evidences.filter(e => e.status === 'pending').length,
      openTickets: tickets.length,
      activeThreats: threats.length,
      pendingEscalations: escalations.length,
      trends: {
        userTrend,
        userTrendDirection: userTrend > 0 ? 'up' : userTrend < 0 ? 'down' : 'neutral',
        userSparkline,
        ticketTrend: Math.abs(ticketTrend),
        ticketTrendDirection: ticketsThisWeek > ticketsLastWeek ? 'up' : ticketsThisWeek < ticketsLastWeek ? 'down' : 'neutral',
        ticketSparkline,
      },
    };
  }

  async getITDirectorStats() {
    const database = getDb();
    const projects = await this.getITProjects();
    const tickets = await this.getITTickets();
    const departments = await this.getITDepartments();
    const allTasks = await database.select().from(tasks).where(isNull(tasks.deletedAt));
    const allUsers = await database.select().from(users).where(eq(users.isActive, true));

    let allReferrals: any[] = [];
    try { allReferrals = await database.select().from(itReferrals); } catch {}
    let securityAlertCount = 0;
    try {
      const [threats, incidents] = await Promise.all([
        database.select({ count: sql<number>`count(*)` }).from(securityThreats).where(or(eq(securityThreats.status, 'active'), eq(securityThreats.status, 'investigating'))),
        database.select({ count: sql<number>`count(*)` }).from(securityIncidents).where(or(eq(securityIncidents.status, 'open'), eq(securityIncidents.status, 'investigating'))),
      ]);
      securityAlertCount = Number(threats[0]?.count || 0) + Number(incidents[0]?.count || 0);
    } catch {}
    let pendingApprovalsCount = 0;
    try {
      const [pa] = await database.select({ count: sql<number>`count(*)` }).from(externalSystems).where(eq(externalSystems.approvalStatus, 'pending'));
      pendingApprovalsCount = Number(pa?.count || 0);
    } catch {}

    const activeProjects = projects.filter(p => p.status === 'in_progress').length;
    const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'assigned').length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    const openTasksCount = allTasks.filter(t => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress').length;
    const completedTasksCount = allTasks.filter(t => t.status === 'completed').length;
    const pendingReferralsTotal = allReferrals.filter(r => r.status === 'pending' || r.status === 'new').length;

    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, t) => {
        if (t.resolvedAt) {
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
        }
        return sum;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60));
    }

    const calcSlaRate = (ticketSet: typeof tickets) => {
      const withSLA = ticketSet.filter(t => t.slaDeadline);
      if (withSLA.length === 0) return 100;
      const onTime = withSLA.filter(t => {
        if (t.status === 'closed' && t.resolvedAt && t.slaDeadline) return t.resolvedAt <= t.slaDeadline;
        if (t.status !== 'closed' && t.slaDeadline) return new Date() <= t.slaDeadline;
        return true;
      });
      return Math.round((onTime.length / withSLA.length) * 100);
    };

    const slaComplianceRate = calcSlaRate(tickets);

    const deptCodeMap: Record<string, string> = {};
    departments.forEach(d => { deptCodeMap[d.id] = d.code || ''; });

    const departmentStats = departments.map((dept) => {
      const deptTickets = tickets.filter(t => t.departmentId === dept.id);
      const deptProjects = projects.filter(p => p.itDepartmentId === dept.id);
      const deptTasks = allTasks.filter(t => t.departmentId === dept.id);
      const deptReferrals = allReferrals.filter(r => r.toDepartmentId === dept.id || r.fromDepartmentId === dept.id);
      const deptStaff = allUsers.filter(u => u.itDepartmentId === dept.id);
      const deptOpenTickets = deptTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'assigned').length;
      const deptClosedTickets = deptTickets.filter(t => t.status === 'closed').length;
      const deptOpenTasks = deptTasks.filter(t => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress').length;
      const deptCompletedTasks = deptTasks.filter(t => t.status === 'completed').length;
      const deptActiveProjects = deptProjects.filter(p => p.status === 'in_progress').length;
      const deptPendingReferrals = deptReferrals.filter(r => r.status === 'pending' || r.status === 'new').length;
      const deptSla = calcSlaRate(deptTickets);

      const ticketScore = deptTickets.length > 0 ? (deptClosedTickets / deptTickets.length) * 100 : 100;
      const taskScore = deptTasks.length > 0 ? (deptCompletedTasks / deptTasks.length) * 100 : 100;
      const healthScore = Math.round((ticketScore * 0.3 + taskScore * 0.3 + deptSla * 0.4));

      return {
        departmentId: dept.id,
        departmentName: dept.nameAr,
        departmentCode: dept.code || '',
        openTickets: deptOpenTickets,
        closedTickets: deptClosedTickets,
        totalTickets: deptTickets.length,
        activeProjects: deptActiveProjects,
        totalProjects: deptProjects.length,
        openTasks: deptOpenTasks,
        completedTasks: deptCompletedTasks,
        totalTasks: deptTasks.length,
        pendingReferrals: deptPendingReferrals,
        totalReferrals: deptReferrals.length,
        staffCount: deptStaff.length,
        slaComplianceRate: deptSla,
        healthScore,
      };
    });

    const overallTicketScore = tickets.length > 0 ? (resolvedTickets.length / tickets.length) * 100 : 100;
    const overallTaskScore = allTasks.length > 0 ? (completedTasksCount / allTasks.length) * 100 : 100;
    const systemHealthScore = Math.round((overallTicketScore * 0.25 + overallTaskScore * 0.25 + slaComplianceRate * 0.5));

    return {
      totalProjects: projects.length,
      activeProjects,
      totalTickets: tickets.length,
      openTickets,
      closedTickets: resolvedTickets.length,
      avgResolutionTime,
      slaComplianceRate,
      totalTasks: allTasks.length,
      openTasks: openTasksCount,
      completedTasks: completedTasksCount,
      totalReferrals: allReferrals.length,
      pendingReferrals: pendingReferralsTotal,
      totalStaff: allUsers.length,
      securityAlerts: securityAlertCount,
      pendingApprovals: pendingApprovalsCount,
      systemHealthScore,
      departmentStats,
    };
  }

  async getCybersecurityStats() {
    const vulnerabilities = await this.getSecurityVulnerabilities();
    const threats = await this.getSecurityThreats();

    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
    const activeThreats = threats.filter(t => t.status === 'active').length;
    const resolvedThreats = threats.filter(t => t.status === 'mitigated').length;

    const threatsByType: Record<string, number> = {};
    threats.forEach(t => {
      threatsByType[t.threatType] = (threatsByType[t.threatType] || 0) + 1;
    });

    // Calculate average threat resolution time dynamically (only threats with both dates)
    const threatsWithBothDates = threats.filter(t => t.status === 'mitigated' && t.mitigatedAt && t.detectedAt);
    let avgThreatResolutionTime = 0;
    if (threatsWithBothDates.length > 0) {
      const totalTime = threatsWithBothDates.reduce((sum, t) => {
        return sum + (new Date(t.mitigatedAt!).getTime() - new Date(t.detectedAt!).getTime());
      }, 0);
      avgThreatResolutionTime = Math.round(totalTime / threatsWithBothDates.length / (1000 * 60 * 60));
    }

    return {
      totalVulnerabilities: vulnerabilities.length,
      criticalVulnerabilities: criticalVulns,
      activeThreats,
      resolvedThreats,
      avgResolutionTime: avgThreatResolutionTime,
      threatsByType,
    };
  }

  // ==================== Data Assets ====================
  async getDataAssets(): Promise<any[]> {
    const database = getDb();
    return await database.select({
      id: dataAssets.id,
      name: dataAssets.name,
      nameEn: dataAssets.nameEn,
      description: dataAssets.description,
      system: dataAssets.system,
      systemId: dataAssets.systemId,
      owner: dataAssets.owner,
      ownerId: dataAssets.ownerId,
      classification: dataAssets.classification,
      dataType: dataAssets.dataType,
      source: dataAssets.source,
      format: dataAssets.format,
      updateFrequency: dataAssets.updateFrequency,
      retentionPeriod: dataAssets.retentionPeriod,
      departmentId: dataAssets.departmentId,
      databaseName: dataAssets.databaseName,
      schemaName: dataAssets.schemaName,
      tableName: dataAssets.tableName,
      connectionType: dataAssets.connectionType,
      connectionString: dataAssets.connectionString,
      totalRecords: dataAssets.totalRecords,
      totalColumns: dataAssets.totalColumns,
      lastSyncAt: dataAssets.lastSyncAt,
      status: dataAssets.status,
      createdBy: dataAssets.createdBy,
      createdAt: dataAssets.createdAt,
      updatedAt: dataAssets.updatedAt,
      systemNameAr: itSystems.nameAr,
      systemNameEn: itSystems.nameEn,
      systemCode: itSystems.code,
    })
    .from(dataAssets)
    .leftJoin(itSystems, eq(dataAssets.systemId, itSystems.id))
    .orderBy(desc(dataAssets.createdAt));
  }

  async getDataAssetById(id: number): Promise<any | undefined> {
    const database = getDb();
    const [asset] = await database.select({
      id: dataAssets.id,
      name: dataAssets.name,
      nameEn: dataAssets.nameEn,
      description: dataAssets.description,
      system: dataAssets.system,
      systemId: dataAssets.systemId,
      owner: dataAssets.owner,
      ownerId: dataAssets.ownerId,
      classification: dataAssets.classification,
      dataType: dataAssets.dataType,
      source: dataAssets.source,
      format: dataAssets.format,
      updateFrequency: dataAssets.updateFrequency,
      retentionPeriod: dataAssets.retentionPeriod,
      departmentId: dataAssets.departmentId,
      databaseName: dataAssets.databaseName,
      schemaName: dataAssets.schemaName,
      tableName: dataAssets.tableName,
      connectionType: dataAssets.connectionType,
      connectionString: dataAssets.connectionString,
      totalRecords: dataAssets.totalRecords,
      totalColumns: dataAssets.totalColumns,
      lastSyncAt: dataAssets.lastSyncAt,
      status: dataAssets.status,
      createdBy: dataAssets.createdBy,
      createdAt: dataAssets.createdAt,
      updatedAt: dataAssets.updatedAt,
      systemNameAr: itSystems.nameAr,
      systemNameEn: itSystems.nameEn,
      systemCode: itSystems.code,
    })
    .from(dataAssets)
    .leftJoin(itSystems, eq(dataAssets.systemId, itSystems.id))
    .where(eq(dataAssets.id, id));
    return asset;
  }

  async createDataAsset(data: InsertDataAsset): Promise<DataAsset> {
    const database = getDb();
    const [created] = await database.insert(dataAssets).values(data).returning();
    return created;
  }

  async updateDataAsset(id: number, updates: Partial<DataAsset>): Promise<DataAsset | undefined> {
    const database = getDb();
    await database.update(dataAssets).set({...updates, updatedAt: new Date()}).where(eq(dataAssets.id, id));
    const [updated] = await database.select().from(dataAssets).where(eq(dataAssets.id, id));
    return updated;
  }

  async deleteDataAsset(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dataAssets).where(eq(dataAssets.id, id));
    return true;
  }

  // ==================== Data Dictionary ====================
  async getDataDictionaryTerms(): Promise<DataDictionaryTerm[]> {
    const database = getDb();
    return await database.select().from(dataDictionary).orderBy(dataDictionary.term);
  }

  async createDataDictionaryTerm(data: InsertDataDictionary): Promise<DataDictionaryTerm> {
    const database = getDb();
    const [created] = await database.insert(dataDictionary).values(data).returning();
    return created;
  }

  async updateDataDictionaryTerm(id: number, updates: Partial<DataDictionaryTerm>): Promise<DataDictionaryTerm | undefined> {
    const database = getDb();
    await database.update(dataDictionary).set({...updates, updatedAt: new Date()}).where(eq(dataDictionary.id, id));
    const [updated] = await database.select().from(dataDictionary).where(eq(dataDictionary.id, id));
    return updated;
  }

  async deleteDataDictionaryTerm(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dataDictionary).where(eq(dataDictionary.id, id));
    return true;
  }

  // ==================== Data Stewards ====================
  async getDataStewards(): Promise<DataSteward[]> {
    const database = getDb();
    return await database.select().from(dataStewards).orderBy(dataStewards.name);
  }

  async createDataSteward(data: InsertDataSteward): Promise<DataSteward> {
    const database = getDb();
    const [created] = await database.insert(dataStewards).values(data).returning();
    return created;
  }

  async updateDataSteward(id: number, updates: Partial<DataSteward>): Promise<DataSteward | undefined> {
    const database = getDb();
    await database.update(dataStewards).set({...updates, updatedAt: new Date()}).where(eq(dataStewards.id, id));
    const [updated] = await database.select().from(dataStewards).where(eq(dataStewards.id, id));
    return updated;
  }

  async deleteDataSteward(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dataStewards).where(eq(dataStewards.id, id));
    return true;
  }

  // ==================== DMO Requests ====================
  async getDmoRequests(): Promise<DmoRequest[]> {
    const database = getDb();
    return await database.select().from(dmoRequests).orderBy(desc(dmoRequests.createdAt));
  }

  async getDmoRequestsBySteward(stewardId: number): Promise<DmoRequest[]> {
    const database = getDb();
    return await database.select().from(dmoRequests)
      .where(eq(dmoRequests.stewardId, stewardId))
      .orderBy(desc(dmoRequests.createdAt));
  }

  async getDmoRequestById(id: number): Promise<DmoRequest | undefined> {
    const database = getDb();
    const [request] = await database.select().from(dmoRequests).where(eq(dmoRequests.id, id));
    return request;
  }

  async createDmoRequest(data: InsertDmoRequest): Promise<DmoRequest> {
    const database = getDb();
    const [created] = await database.insert(dmoRequests).values(data).returning();
    return created;
  }

  async updateDmoRequest(id: number, updates: Partial<DmoRequest>): Promise<DmoRequest | undefined> {
    const database = getDb();
    await database.update(dmoRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dmoRequests.id, id));
    const [updated] = await database.select().from(dmoRequests).where(eq(dmoRequests.id, id));
    return updated;
  }

  async deleteDmoRequest(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dmoRequests).where(eq(dmoRequests.id, id));
    return true;
  }

  // ==================== Data Quality Rules ====================
  async getDataQualityRules(): Promise<DataQualityRule[]> {
    const database = getDb();
    return await database.select().from(dataQualityRules).orderBy(desc(dataQualityRules.createdAt));
  }

  async getDataQualityRuleById(id: number): Promise<DataQualityRule | undefined> {
    const database = getDb();
    const [rule] = await database.select().from(dataQualityRules).where(eq(dataQualityRules.id, id));
    return rule;
  }

  async createDataQualityRule(data: InsertDataQualityRule): Promise<DataQualityRule> {
    const database = getDb();
    const [created] = await database.insert(dataQualityRules).values(data).returning();
    return created;
  }

  async updateDataQualityRule(id: number, data: Partial<DataQualityRule>): Promise<DataQualityRule | undefined> {
    const database = getDb();
    const [updated] = await database.update(dataQualityRules).set({ ...data, updatedAt: new Date() }).where(eq(dataQualityRules.id, id)).returning();
    return updated;
  }

  async deleteDataQualityRule(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dataQualityRules).where(eq(dataQualityRules.id, id));
    return true;
  }

  // ==================== Data Quality Checks ====================
  async getDataQualityChecks(limit?: number): Promise<DataQualityCheck[]> {
    const database = getDb();
    const query = database.select().from(dataQualityChecks).orderBy(desc(dataQualityChecks.executedAt));
    if (limit) return await query.limit(limit);
    return await query;
  }

  async getDataQualityChecksByRule(ruleId: number): Promise<DataQualityCheck[]> {
    const database = getDb();
    return await database.select().from(dataQualityChecks).where(eq(dataQualityChecks.ruleId, ruleId)).orderBy(desc(dataQualityChecks.executedAt));
  }

  async createDataQualityCheck(data: InsertDataQualityCheck): Promise<DataQualityCheck> {
    const database = getDb();
    const [created] = await database.insert(dataQualityChecks).values(data).returning();
    return created;
  }

  // ==================== Security Incidents ====================
  async getSecurityIncidents(): Promise<SecurityIncident[]> {
    const database = getDb();
    return await database.select().from(securityIncidents).orderBy(desc(securityIncidents.createdAt));
  }

  async createSecurityIncident(data: Omit<SecurityIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityIncident> {
    const database = getDb();
    const [created] = await database.insert(securityIncidents).values(data).returning();
    return created;
  }

  // ==================== Data Risks ====================
  async getDataRisks(): Promise<DataRisk[]> {
    const database = getDb();
    return await database.select().from(dataRisks).orderBy(desc(dataRisks.createdAt));
  }

  async createDataRisk(data: Omit<DataRisk, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataRisk> {
    const database = getDb();
    const [created] = await database.insert(dataRisks).values(data).returning();
    return created;
  }

  // ==================== Data Agreements ====================
  async getDataAgreements(): Promise<DataAgreement[]> {
    const database = getDb();
    return await database.select().from(dataAgreements).orderBy(desc(dataAgreements.createdAt));
  }

  async createDataAgreement(data: Omit<DataAgreement, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataAgreement> {
    const database = getDb();
    const [created] = await database.insert(dataAgreements).values(data).returning();
    return created;
  }

  // ==================== Data Subject Requests ====================
  async getDataSubjectRequests(): Promise<DataSubjectRequest[]> {
    const database = getDb();
    return await database.select().from(dataSubjectRequests).orderBy(desc(dataSubjectRequests.createdAt));
  }

  async createDataSubjectRequest(data: Omit<DataSubjectRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataSubjectRequest> {
    const database = getDb();
    const [created] = await database.insert(dataSubjectRequests).values(data).returning();
    return created;
  }

  // ==================== IT Assets (CTO Management) ====================
  async getITAssets(): Promise<ITAsset[]> {
    const database = getDb();
    return await database.select().from(itAssets).where(isNull(itAssets.deletedAt)).orderBy(desc(itAssets.createdAt));
  }

  async getITAssetById(id: number): Promise<ITAsset | undefined> {
    const database = getDb();
    const [asset] = await database.select().from(itAssets).where(and(eq(itAssets.id, id), isNull(itAssets.deletedAt)));
    return asset;
  }

  async getITAssetsByDepartment(departmentId: number): Promise<ITAsset[]> {
    const database = getDb();
    return await database.select().from(itAssets).where(and(eq(itAssets.assignedDepartmentId, departmentId), isNull(itAssets.deletedAt))).orderBy(desc(itAssets.createdAt));
  }

  async createITAsset(data: Omit<ITAsset, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ITAsset> {
    const database = getDb();
    const [created] = await database.insert(itAssets).values(data).returning();
    return created;
  }

  async updateITAsset(id: number, updates: Partial<ITAsset>): Promise<ITAsset | undefined> {
    const database = getDb();
    await database.update(itAssets).set(updates).where(eq(itAssets.id, id));
    const [updated] = await database.select().from(itAssets).where(eq(itAssets.id, id));
    return updated;
  }

  async deleteITAsset(id: number): Promise<boolean> {
    const database = getDb();
    await database.update(itAssets).set({ deletedAt: new Date() }).where(eq(itAssets.id, id));
    return true;
  }

  // ==================== Database Connections (External Systems) ====================
  async getDatabaseConnections(): Promise<DatabaseConnection[]> {
    const database = getDb();
    return await database.select().from(databaseConnections).orderBy(desc(databaseConnections.createdAt));
  }

  async getDatabaseConnectionById(id: number): Promise<DatabaseConnection | undefined> {
    const database = getDb();
    const [connection] = await database.select().from(databaseConnections).where(eq(databaseConnections.id, id));
    return connection;
  }

  async createDatabaseConnection(data: InsertDatabaseConnection): Promise<DatabaseConnection> {
    const database = getDb();
    const [created] = await database.insert(databaseConnections).values(data).returning();
    return created;
  }

  async updateDatabaseConnection(id: number, updates: Partial<DatabaseConnection>): Promise<DatabaseConnection | undefined> {
    const database = getDb();
    await database.update(databaseConnections).set({...updates, updatedAt: new Date()}).where(eq(databaseConnections.id, id));
    const [updated] = await database.select().from(databaseConnections).where(eq(databaseConnections.id, id));
    return updated;
  }

  async deleteDatabaseConnection(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(databaseConnections).where(eq(databaseConnections.id, id));
    return true;
  }

  // ==================== Discovered Tables (From External Systems) ====================
  async getDiscoveredTables(): Promise<DiscoveredTable[]> {
    const database = getDb();
    return await database.select().from(discoveredTables).orderBy(desc(discoveredTables.discoveredAt));
  }

  async getDiscoveredTablesByConnection(connectionId: number): Promise<DiscoveredTable[]> {
    const database = getDb();
    return await database.select().from(discoveredTables).where(eq(discoveredTables.connectionId, connectionId)).orderBy(discoveredTables.tableName);
  }

  async createDiscoveredTable(data: InsertDiscoveredTable): Promise<DiscoveredTable> {
    const database = getDb();
    const [created] = await database.insert(discoveredTables).values(data).returning();
    return created;
  }

  async deleteDiscoveredTable(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(discoveredTables).where(eq(discoveredTables.id, id));
    return true;
  }

  // ==================== Data Flow Mappings ====================
  async getDataFlowMappings(): Promise<DataFlowMapping[]> {
    const database = getDb();
    return await database.select().from(dataFlowMappings).orderBy(desc(dataFlowMappings.createdAt));
  }

  async getDataFlowMappingById(id: number): Promise<DataFlowMapping | undefined> {
    const database = getDb();
    const [mapping] = await database.select().from(dataFlowMappings).where(eq(dataFlowMappings.id, id));
    return mapping;
  }

  async createDataFlowMapping(data: InsertDataFlowMapping): Promise<DataFlowMapping> {
    const database = getDb();
    const [created] = await database.insert(dataFlowMappings).values(data).returning();
    return created;
  }

  async updateDataFlowMapping(id: number, updates: Partial<DataFlowMapping>): Promise<DataFlowMapping | undefined> {
    const database = getDb();
    await database.update(dataFlowMappings).set({...updates, updatedAt: new Date()}).where(eq(dataFlowMappings.id, id));
    const [updated] = await database.select().from(dataFlowMappings).where(eq(dataFlowMappings.id, id));
    return updated;
  }

  async deleteDataFlowMapping(id: number): Promise<boolean> {
    const database = getDb();
    await database.delete(dataFlowMappings).where(eq(dataFlowMappings.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
