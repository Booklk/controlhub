import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, jsonb, decimal, bigint, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== المستخدمون ====================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  phone: varchar("phone", { length: 20 }),
  role: text("role").default("user").notNull(),
  portal: text("portal").default("user").notNull(),
  departmentId: integer("department_id"),
  itDepartmentId: integer("it_department_id"),
  jobTitle: varchar("job_title", { length: 200 }),
  avatar: text("avatar"),
  isActive: boolean("is_active").default(true).notNull(),
  isActivated: boolean("is_activated").default(false).notNull(),
  activationToken: varchar("activation_token", { length: 200 }),
  activationTokenExpiry: timestamp("activation_token_expiry"),
  passwordResetToken: varchar("password_reset_token", { length: 200 }),
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  loginAttempts: integer("login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== جلسات المستخدمين المحسنة ====================
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 500 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 100 }),
  deviceType: varchar("device_type", { length: 50 }),
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),
  location: varchar("location", { length: 200 }),
  isActive: boolean("is_active").default(true).notNull(),
  isTrusted: boolean("is_trusted").default(false).notNull(),
  lastActivityAt: timestamp("last_activity_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  loginMethod: varchar("login_method", { length: 50 }).default("password"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedReason: varchar("revoked_reason", { length: 200 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Session = typeof sessions.$inferSelect;

// ==================== سجل التدقيق المحسن ====================
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  actionCategory: varchar("action_category", { length: 50 }),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: integer("entity_id"),
  resource: varchar("resource", { length: 100 }),
  oldValue: json("old_value"),
  newValue: json("new_value"),
  changedFields: json("changed_fields"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  requestId: varchar("request_id", { length: 50 }),
  requestMethod: varchar("request_method", { length: 10 }),
  requestPath: varchar("request_path", { length: 500 }),
  outcome: varchar("outcome", { length: 20 }).default("success"),
  severity: varchar("severity", { length: 20 }).default("info"),
  policyDecision: varchar("policy_decision", { length: 50 }),
  errorMessage: text("error_message"),
  details: text("details"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== الإشعارات ====================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message").notNull(),
  priority: text("priority").default("normal").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  actionUrl: text("action_url"),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: integer("entity_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Notification = typeof notifications.$inferSelect;

// ==================== الإدارات ====================
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description"),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }),
  parentId: integer("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Department = typeof departments.$inferSelect;

// ==================== الإدارات التقنية (4 إدارات) ====================
export const itDepartments = pgTable("it_departments", {
  id: serial("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description"),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }),
  departmentType: text("department_type").notNull(),
  color: varchar("color", { length: 20 }).default("#1e3a5f"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type ITDepartment = typeof itDepartments.$inferSelect;

// ==================== موظفي الإدارات التقنية ====================
export const itDepartmentMembers = pgTable("it_department_members", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => itDepartments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("specialist").notNull(),
  jobTitle: varchar("job_title", { length: 100 }),
  joinDate: timestamp("join_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ITDepartmentMember = typeof itDepartmentMembers.$inferSelect;

// ==================== مجالات الحوكمة (15 مجال) ====================
export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 300 }).notNull(),
  nameEn: varchar("name_en", { length: 300 }),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Domain = typeof domains.$inferSelect;

// ==================== المتطلبات (191 متطلب) ====================
export const requirements = pgTable("requirements", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 30 }).notNull().unique(),
  titleAr: varchar("title_ar", { length: 500 }).notNull(),
  titleEn: varchar("title_en", { length: 500 }),
  description: text("description"),
  priority: text("priority").default("medium").notNull(),
  complianceLevel: text("compliance_level").default("mandatory").notNull(),
  status: text("status").default("pending").notNull(),
  evidenceType: text("evidence_type"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Requirement = typeof requirements.$inferSelect;

// ==================== الأدلة والشواهد ====================
export const evidences = pgTable("evidences", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id").notNull().references(() => requirements.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 500 }),
  fileName: varchar("file_name", { length: 300 }),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  expiryDate: timestamp("expiry_date"),
  isExpired: boolean("is_expired").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Evidence = typeof evidences.$inferSelect;

// ==================== أعضاء لجنة الحوكمة ====================
export const committeeMembers = pgTable("committee_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  department: varchar("department", { length: 200 }),
  position: varchar("position", { length: 200 }),
  committeeRole: text("committee_role").default("member").notNull(),
  canApprove: boolean("can_approve").default(false).notNull(),
  canVote: boolean("can_vote").default(true).notNull(),
  joinDate: timestamp("join_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type CommitteeMember = typeof committeeMembers.$inferSelect;

// ==================== قرارات اللجنة ====================
export const committeeDecisions = pgTable("committee_decisions", {
  id: serial("id").primaryKey(),
  decisionNumber: varchar("decision_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: text("category").default("general").notNull(),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("draft").notNull(),
  meetingId: integer("meeting_id").references(() => committeeMeetings.id, { onDelete: "set null" }),
  votesFor: integer("votes_for").default(0).notNull(),
  votesAgainst: integer("votes_against").default(0).notNull(),
  votesAbstain: integer("votes_abstain").default(0).notNull(),
  votingDeadline: timestamp("voting_deadline"),
  implementationDeadline: timestamp("implementation_deadline"),
  implementationStatus: text("implementation_status").default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  votingSessionId: integer("voting_session_id"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  attachments: jsonb("attachments").default([]),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type CommitteeDecision = typeof committeeDecisions.$inferSelect;

// ==================== اجتماعات اللجنة ====================
export const committeeMeetings = pgTable("committee_meetings", {
  id: serial("id").primaryKey(),
  meetingNumber: varchar("meeting_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  meetingType: text("meeting_type").default("regular").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  location: varchar("location", { length: 300 }),
  isVirtual: boolean("is_virtual").default(false).notNull(),
  virtualLink: text("virtual_link"),
  agenda: text("agenda"),
  minutes: text("minutes"),
  status: text("status").default("scheduled").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type CommitteeMeeting = typeof committeeMeetings.$inferSelect;

// ==================== حضور الاجتماعات ====================
export const meetingAttendance = pgTable("meeting_attendance", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => committeeMeetings.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => committeeMembers.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(),
  delegatedTo: integer("delegated_to").references(() => committeeMembers.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type MeetingAttendance = typeof meetingAttendance.$inferSelect;

// ==================== تصويت القرارات ====================
export const decisionVotes = pgTable("decision_votes", {
  id: serial("id").primaryKey(),
  decisionId: integer("decision_id").references(() => committeeDecisions.id, { onDelete: "cascade" }),
  votingSessionId: integer("voting_session_id").references(() => votingSessions.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => committeeMembers.id, { onDelete: "cascade" }),
  vote: text("vote").notNull(),
  comments: text("comments"),
  votedAt: timestamp("voted_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DecisionVote = typeof decisionVotes.$inferSelect;

// ==================== جلسات التصويت ====================
export const votingSessions = pgTable("voting_sessions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: text("category").default("general").notNull(),
  votingType: text("voting_type").default("majority").notNull(),
  status: text("status").default("draft").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  votesFor: integer("votes_for").default(0).notNull(),
  votesAgainst: integer("votes_against").default(0).notNull(),
  votesAbstain: integer("votes_abstain").default(0).notNull(),
  quorumRequired: integer("quorum_required").default(50),
  result: text("result"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertVotingSessionSchema = createInsertSchema(votingSessions).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertVotingSession = z.infer<typeof insertVotingSessionSchema>;
export type VotingSession = typeof votingSessions.$inferSelect;

// ==================== محاضر الاجتماعات ====================
export const meetingMinutes = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => committeeMeetings.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content"),
  attendees: json("attendees"),
  decisions: json("decisions"),
  actionItems: json("action_items"),
  attachments: json("attachments"),
  status: text("status").default("draft").notNull(),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMeetingMinuteSchema = createInsertSchema(meetingMinutes).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertMeetingMinute = z.infer<typeof insertMeetingMinuteSchema>;
export type MeetingMinute = typeof meetingMinutes.$inferSelect;

// ==================== مهام اللجنة ====================
export const committeeTasks = pgTable("committee_tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to", { length: 200 }),
  assignedMemberId: integer("assigned_member_id").references(() => committeeMembers.id, { onDelete: "set null" }),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  decisionId: integer("decision_id").references(() => committeeDecisions.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertCommitteeTaskSchema = createInsertSchema(committeeTasks).omit({
  id: true, createdAt: true, updatedAt: true, deletedAt: true
});
export type InsertCommitteeTask = z.infer<typeof insertCommitteeTaskSchema>;
export type CommitteeTask = typeof committeeTasks.$inferSelect;

// ==================== الخوادم ====================
export const infrastructureServers = pgTable("infrastructure_servers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  hostname: varchar("hostname", { length: 200 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  serverType: text("server_type").default("physical").notNull(),
  operatingSystem: varchar("operating_system", { length: 100 }),
  cpuCores: integer("cpu_cores"),
  ramGb: integer("ram_gb"),
  storageGb: integer("storage_gb"),
  location: varchar("location", { length: 200 }),
  rack: varchar("rack", { length: 50 }),
  status: text("status").default("active").notNull(),
  healthScore: integer("health_score").default(100),
  lastHealthCheck: timestamp("last_health_check"),
  environment: text("environment").default("production").notNull(),
  purpose: text("purpose"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInfrastructureServerSchema = createInsertSchema(infrastructureServers).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertInfrastructureServer = z.infer<typeof insertInfrastructureServerSchema>;
export type InfrastructureServer = typeof infrastructureServers.$inferSelect;

// ==================== الشبكات ====================
export const infrastructureNetworks = pgTable("infrastructure_networks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  networkType: text("network_type").default("lan").notNull(),
  subnet: varchar("subnet", { length: 50 }),
  gateway: varchar("gateway", { length: 45 }),
  vlanId: integer("vlan_id"),
  bandwidth: varchar("bandwidth", { length: 50 }),
  location: varchar("location", { length: 200 }),
  status: text("status").default("active").notNull(),
  securityLevel: text("security_level").default("medium"),
  firewallEnabled: boolean("firewall_enabled").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInfrastructureNetworkSchema = createInsertSchema(infrastructureNetworks).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertInfrastructureNetwork = z.infer<typeof insertInfrastructureNetworkSchema>;
export type InfrastructureNetwork = typeof infrastructureNetworks.$inferSelect;

// ==================== التخزين ====================
export const infrastructureStorage = pgTable("infrastructure_storage", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  storageType: text("storage_type").default("san").notNull(),
  totalCapacityTb: decimal("total_capacity_tb", { precision: 10, scale: 2 }),
  usedCapacityTb: decimal("used_capacity_tb", { precision: 10, scale: 2 }),
  raidLevel: varchar("raid_level", { length: 20 }),
  location: varchar("location", { length: 200 }),
  status: text("status").default("active").notNull(),
  performanceTier: text("performance_tier").default("standard"),
  backupEnabled: boolean("backup_enabled").default(true),
  encryptionEnabled: boolean("encryption_enabled").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInfrastructureStorageSchema = createInsertSchema(infrastructureStorage).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertInfrastructureStorage = z.infer<typeof insertInfrastructureStorageSchema>;
export type InfrastructureStorage = typeof infrastructureStorage.$inferSelect;

// ==================== المراقبة ====================
export const infrastructureMonitoring = pgTable("infrastructure_monitoring", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  targetType: text("target_type").default("server").notNull(),
  targetId: integer("target_id"),
  metricType: text("metric_type").notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  thresholdWarning: decimal("threshold_warning", { precision: 10, scale: 2 }),
  thresholdCritical: decimal("threshold_critical", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 20 }),
  status: text("status").default("normal").notNull(),
  lastChecked: timestamp("last_checked"),
  alertEnabled: boolean("alert_enabled").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInfrastructureMonitoringSchema = createInsertSchema(infrastructureMonitoring).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertInfrastructureMonitoring = z.infer<typeof insertInfrastructureMonitoringSchema>;
export type InfrastructureMonitoring = typeof infrastructureMonitoring.$inferSelect;

// ==================== الأنظمة التقنية ====================
export const itSystems = pgTable("it_systems", {
  id: serial("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  systemType: text("system_type").default("other").notNull(),
  vendor: varchar("vendor", { length: 200 }),
  version: varchar("version", { length: 50 }),
  status: text("status").default("active").notNull(),
  responsibleDepartmentId: integer("responsible_department_id"),
  responsibleUserId: integer("responsible_user_id"),
  goLiveDate: timestamp("go_live_date"),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  criticality: text("criticality").default("medium").notNull(),
  uptime: decimal("uptime", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ITSystem = typeof itSystems.$inferSelect;

// ==================== المشاريع التقنية ====================
export const itProjects = pgTable("it_projects", {
  id: serial("id").primaryKey(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description"),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  itDepartmentId: integer("it_department_id").notNull().references(() => itDepartments.id, { onDelete: "cascade" }),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").default("planning").notNull(),
  priority: text("priority").default("medium").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  actualEndDate: timestamp("actual_end_date"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }),
  progress: integer("progress").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type ITProject = typeof itProjects.$inferSelect;

// ==================== التذاكر ====================
export const itTickets = pgTable("it_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  requesterId: integer("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: integer("department_id").references(() => itDepartments.id, { onDelete: "set null" }),
  category: text("category").default("support").notNull(),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("open").notNull(),
  slaDeadline: timestamp("sla_deadline"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  resolution: text("resolution"),
  satisfaction: integer("satisfaction"),
  source: text("source").default("manual"),
  sourceEmail: varchar("source_email", { length: 255 }),
  sourceEmailId: varchar("source_email_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type ITTicket = typeof itTickets.$inferSelect;

export const emailIntegrationKeys = pgTable("email_integration_keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  apiKey: varchar("api_key", { length: 128 }).notNull().unique(),
  createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").references(() => itDepartments.id, { onDelete: "set null" }),
  defaultPriority: text("default_priority").default("medium"),
  defaultCategory: text("default_category").default("support"),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type EmailIntegrationKey = typeof emailIntegrationKeys.$inferSelect;

// ==================== تصنيف البيانات الوطني ====================
export const dataClassificationLevels = ["top_secret", "confidential", "restricted", "public"] as const;
export type DataClassification = typeof dataClassificationLevels[number];

export const dataClassificationLabels: Record<DataClassification, string> = {
  top_secret: "سري للغاية",
  confidential: "سري",
  restricted: "مقيد",
  public: "عام"
};

// ==================== المهام ====================
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => itProjects.id, { onDelete: "set null" }),
  departmentId: integer("department_id").references(() => itDepartments.id, { onDelete: "set null" }),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  assignedBy: integer("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("pending").notNull(),
  dataClassification: text("data_classification").default("public").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  isEscalated: boolean("is_escalated").default(false).notNull(),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: integer("escalated_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Task = typeof tasks.$inferSelect;

// ==================== الأصول التقنية ====================
export const assetTypes = ["server", "network", "storage", "software", "hardware", "security", "cloud", "other"] as const;
export type AssetType = typeof assetTypes[number];

export const assetTypeLabels: Record<AssetType, string> = {
  server: "خادم",
  network: "شبكات",
  storage: "تخزين",
  software: "برمجيات",
  hardware: "أجهزة",
  security: "أمني",
  cloud: "سحابي",
  other: "أخرى"
};

export const itAssets = pgTable("it_assets", {
  id: serial("id").primaryKey(),
  assetCode: varchar("asset_code", { length: 50 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  description: text("description"),
  assetType: text("asset_type").default("hardware").notNull(),
  dataClassification: text("data_classification").default("public").notNull(),
  assignedDepartmentId: integer("assigned_department_id").references(() => itDepartments.id, { onDelete: "set null" }),
  assignedById: integer("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at"),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  location: varchar("location", { length: 200 }),
  status: text("status").default("active").notNull(),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  maintenanceNotes: text("maintenance_notes"),
  departmentNotes: text("department_notes"),
  configurationDetails: text("configuration_details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  criticality: text("criticality").default("medium").notNull(),
  value: decimal("value", { precision: 15, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertITAssetSchema = createInsertSchema(itAssets).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertITAsset = z.infer<typeof insertITAssetSchema>;
export type ITAsset = typeof itAssets.$inferSelect;

// ==================== الثغرات الأمنية ====================
export const securityVulnerabilities = pgTable("security_vulnerabilities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  systemId: integer("system_id"),
  severity: text("severity").notNull(),
  status: text("status").default("open").notNull(),
  cveId: varchar("cve_id", { length: 50 }),
  discoveredAt: timestamp("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  discoveredBy: integer("discovered_by"),
  assignedTo: integer("assigned_to"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityVulnerability = typeof securityVulnerabilities.$inferSelect;

// ==================== التهديدات الأمنية ====================
export const securityThreats = pgTable("security_threats", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  threatType: text("threat_type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").default("active").notNull(),
  sourceIp: varchar("source_ip", { length: 45 }),
  targetSystem: integer("target_system"),
  detectedAt: timestamp("detected_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  mitigatedAt: timestamp("mitigated_at"),
  mitigationNotes: text("mitigation_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityThreat = typeof securityThreats.$inferSelect;

// ==================== قاعدة المعرفة ====================
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  departmentId: integer("department_id"),
  tags: json("tags"),
  views: integer("views").default(0).notNull(),
  helpful: integer("helpful").default(0).notNull(),
  authorId: integer("author_id").notNull(),
  status: text("status").default("published").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type KnowledgeArticle = typeof knowledgeBase.$inferSelect;

// ==================== مؤشرات الأداء ====================
export const kpiMetrics = pgTable("kpi_metrics", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id"),
  metricName: varchar("metric_name", { length: 200 }).notNull(),
  metricType: text("metric_type").notNull(),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 50 }),
  period: varchar("period", { length: 20 }).notNull(),
  periodDate: timestamp("period_date").notNull(),
  trend: text("trend"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type KPIMetric = typeof kpiMetrics.$inferSelect;

// ==================== التصعيدات ====================
export const escalations = pgTable("escalations", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  reason: text("reason").notNull(),
  escalatedFrom: integer("escalated_from"),
  escalatedTo: integer("escalated_to").notNull(),
  priority: text("priority").default("high").notNull(),
  status: text("status").default("pending").notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Escalation = typeof escalations.$inferSelect;

// ==================== إعدادات النظام ====================
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  category: varchar("category", { length: 50 }),
  description: text("description"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// ==================== تقارير الامتثال ====================
export const complianceReports = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  period: varchar("period", { length: 50 }),
  domainId: integer("domain_id"),
  departmentId: integer("department_id"),
  totalRequirements: integer("total_requirements").default(0),
  compliantCount: integer("compliant_count").default(0),
  nonCompliantCount: integer("non_compliant_count").default(0),
  partialCount: integer("partial_count").default(0),
  complianceRate: decimal("compliance_rate", { precision: 5, scale: 2 }),
  status: text("status").default("draft").notNull(),
  generatedBy: integer("generated_by"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ComplianceReport = typeof complianceReports.$inferSelect;

// ==================== أصول البيانات (NDMO) ====================
export const dataAssets = pgTable("data_assets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  nameEn: varchar("name_en", { length: 300 }),
  description: text("description"),
  system: varchar("system", { length: 200 }),
  systemId: integer("system_id"),
  owner: varchar("owner", { length: 200 }),
  ownerId: integer("owner_id"),
  classification: text("classification").default("restricted").notNull(),
  dataType: text("data_type").default("structured").notNull(),
  source: varchar("source", { length: 200 }),
  format: varchar("format", { length: 100 }),
  updateFrequency: varchar("update_frequency", { length: 100 }),
  retentionPeriod: varchar("retention_period", { length: 100 }),
  departmentId: integer("department_id"),
  databaseName: varchar("database_name", { length: 200 }),
  schemaName: varchar("schema_name", { length: 200 }),
  tableName: varchar("table_name", { length: 200 }),
  connectionType: varchar("connection_type", { length: 100 }),
  connectionString: varchar("connection_string", { length: 500 }),
  totalRecords: integer("total_records"),
  totalColumns: integer("total_columns"),
  lastSyncAt: timestamp("last_sync_at"),
  status: text("status").default("active").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataAssetSchema = createInsertSchema(dataAssets).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataAsset = z.infer<typeof insertDataAssetSchema>;
export type DataAsset = typeof dataAssets.$inferSelect;

// ==================== قاموس البيانات ====================
export const dataDictionary = pgTable("data_dictionary", {
  id: serial("id").primaryKey(),
  term: varchar("term", { length: 300 }).notNull(),
  termEn: varchar("term_en", { length: 300 }),
  definition: text("definition").notNull(),
  category: varchar("category", { length: 100 }),
  dataType: varchar("data_type", { length: 100 }),
  format: varchar("format", { length: 100 }),
  allowedValues: text("allowed_values"),
  example: text("example"),
  source: varchar("source", { length: 200 }),
  relatedTerms: text("related_terms"),
  dataAssetId: integer("data_asset_id"),
  columnName: varchar("column_name", { length: 200 }),
  businessRule: text("business_rule"),
  status: text("status").default("active").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataDictionarySchema = createInsertSchema(dataDictionary).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataDictionary = z.infer<typeof insertDataDictionarySchema>;
export type DataDictionaryTerm = typeof dataDictionary.$inferSelect;

// ==================== ممثلو بيانات الأعمال ====================
export const dataStewards = pgTable("data_stewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: varchar("name", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  department: varchar("department", { length: 200 }),
  departmentId: integer("department_id"),
  role: text("role").default("steward").notNull(),
  responsibilities: text("responsibilities"),
  assignedAssets: json("assigned_assets"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataStewardSchema = createInsertSchema(dataStewards).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataSteward = z.infer<typeof insertDataStewardSchema>;
export type DataSteward = typeof dataStewards.$inferSelect;

// ==================== طلبات مكتب إدارة البيانات ====================
export const dmoRequests = pgTable("dmo_requests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  requestType: varchar("request_type", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 50 }).default("medium").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  stewardId: integer("steward_id").notNull(),
  requestedBy: integer("requested_by").notNull(),
  assignedAssetId: integer("assigned_asset_id"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  response: text("response"),
  attachments: json("attachments"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDmoRequestSchema = createInsertSchema(dmoRequests).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true
});
export type InsertDmoRequest = z.infer<typeof insertDmoRequestSchema>;
export type DmoRequest = typeof dmoRequests.$inferSelect;

// ==================== اتصالات الأنظمة الخارجية (Data Discovery) ====================
export const systemConnections = pgTable("system_connections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  systemId: integer("system_id"),
  connectionType: varchar("connection_type", { length: 50 }).notNull(), // postgresql, mysql, oracle, sqlserver, api, file
  host: varchar("host", { length: 500 }),
  port: integer("port"),
  databaseName: varchar("database_name", { length: 200 }),
  username: varchar("username", { length: 200 }),
  password: text("password"), // encrypted
  connectionString: text("connection_string"),
  apiEndpoint: text("api_endpoint"),
  apiKey: text("api_key"), // encrypted
  authType: varchar("auth_type", { length: 50 }), // basic, bearer, oauth2, api_key
  sslEnabled: boolean("ssl_enabled").default(false),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, connected, failed, disconnected
  lastConnectionTest: timestamp("last_connection_test"),
  lastDiscovery: timestamp("last_discovery"),
  autoDiscoveryEnabled: boolean("auto_discovery_enabled").default(true),
  discoverySchedule: varchar("discovery_schedule", { length: 50 }), // daily, weekly, monthly, manual
  metadata: json("metadata"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSystemConnectionSchema = createInsertSchema(systemConnections).omit({
  id: true, createdAt: true, updatedAt: true, lastConnectionTest: true, lastDiscovery: true
});
export type InsertSystemConnection = z.infer<typeof insertSystemConnectionSchema>;
export type SystemConnection = typeof systemConnections.$inferSelect;

// ==================== الـ Schemas المكتشفة ====================
export const discoveredSchemas = pgTable("discovered_schemas", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  schemaName: varchar("schema_name", { length: 200 }).notNull(),
  schemaNameAr: varchar("schema_name_ar", { length: 200 }),
  description: text("description"),
  tablesCount: integer("tables_count").default(0),
  viewsCount: integer("views_count").default(0),
  isDefault: boolean("is_default").default(false),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  discoveredAt: timestamp("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDiscoveredSchemaSchema = createInsertSchema(discoveredSchemas).omit({
  id: true, discoveredAt: true, updatedAt: true
});
export type InsertDiscoveredSchema = z.infer<typeof insertDiscoveredSchemaSchema>;
export type DiscoveredSchema = typeof discoveredSchemas.$inferSelect;

// ==================== الجداول المكتشفة ====================
export const discoveredTables = pgTable("discovered_tables", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  schemaId: integer("schema_id"),
  tableName: varchar("table_name", { length: 200 }).notNull(),
  tableNameAr: varchar("table_name_ar", { length: 200 }),
  tableType: varchar("table_type", { length: 50 }).default("table").notNull(), // table, view, materialized_view
  description: text("description"),
  columnsCount: integer("columns_count").default(0),
  rowsEstimate: bigint("rows_estimate", { mode: "number" }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  primaryKey: text("primary_key"),
  classification: varchar("classification", { length: 50 }), // public, internal, restricted, confidential, top_secret
  owner: varchar("owner", { length: 200 }),
  dataCategory: varchar("data_category", { length: 100 }), // master, reference, transactional, analytical
  businessDomain: varchar("business_domain", { length: 200 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  lastDataUpdate: timestamp("last_data_update"),
  discoveredAt: timestamp("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDiscoveredTableSchema = createInsertSchema(discoveredTables).omit({
  id: true, discoveredAt: true, updatedAt: true
});
export type InsertDiscoveredTable = z.infer<typeof insertDiscoveredTableSchema>;
export type DiscoveredTable = typeof discoveredTables.$inferSelect;

// ==================== الأعمدة المكتشفة ====================
export const discoveredColumns = pgTable("discovered_columns", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull(),
  connectionId: integer("connection_id").notNull(),
  columnName: varchar("column_name", { length: 200 }).notNull(),
  columnNameAr: varchar("column_name_ar", { length: 200 }),
  dataType: varchar("data_type", { length: 100 }).notNull(),
  maxLength: integer("max_length"),
  precision: integer("precision"),
  scale: integer("scale"),
  isNullable: boolean("is_nullable").default(true),
  isPrimaryKey: boolean("is_primary_key").default(false),
  isForeignKey: boolean("is_foreign_key").default(false),
  isUnique: boolean("is_unique").default(false),
  isIndexed: boolean("is_indexed").default(false),
  defaultValue: text("default_value"),
  description: text("description"),
  businessName: varchar("business_name", { length: 300 }),
  businessNameAr: varchar("business_name_ar", { length: 300 }),
  classification: varchar("classification", { length: 50 }), // public, internal, restricted, confidential, pii
  isPII: boolean("is_pii").default(false), // Personal Identifiable Information
  sampleValues: json("sample_values"),
  validationRules: json("validation_rules"),
  referencedTable: varchar("referenced_table", { length: 200 }),
  referencedColumn: varchar("referenced_column", { length: 200 }),
  position: integer("position").default(0),
  discoveredAt: timestamp("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDiscoveredColumnSchema = createInsertSchema(discoveredColumns).omit({
  id: true, discoveredAt: true, updatedAt: true
});
export type InsertDiscoveredColumn = z.infer<typeof insertDiscoveredColumnSchema>;
export type DiscoveredColumn = typeof discoveredColumns.$inferSelect;

// ==================== تتبع مصادر البيانات (Data Lineage) ====================
export const dataLineage = pgTable("data_lineage", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }),
  sourceConnectionId: integer("source_connection_id"),
  sourceTableId: integer("source_table_id"),
  sourceColumnId: integer("source_column_id"),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // database, api, file, manual
  targetConnectionId: integer("target_connection_id"),
  targetTableId: integer("target_table_id"),
  targetColumnId: integer("target_column_id"),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  transformationType: varchar("transformation_type", { length: 100 }), // direct, aggregation, calculation, merge, split
  transformationLogic: text("transformation_logic"),
  dataFlowDirection: varchar("data_flow_direction", { length: 20 }).default("downstream"), // upstream, downstream, bidirectional
  frequency: varchar("frequency", { length: 50 }), // realtime, hourly, daily, weekly
  isActive: boolean("is_active").default(true),
  lastDataFlow: timestamp("last_data_flow"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataLineageSchema = createInsertSchema(dataLineage).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataLineage = z.infer<typeof insertDataLineageSchema>;
export type DataLineage = typeof dataLineage.$inferSelect;

// ==================== سجل الاكتشاف ====================
export const discoveryLogs = pgTable("discovery_logs", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  discoveryType: varchar("discovery_type", { length: 50 }).notNull(), // full, incremental, schema_only
  status: varchar("status", { length: 50 }).notNull(), // running, completed, failed
  schemasDiscovered: integer("schemas_discovered").default(0),
  tablesDiscovered: integer("tables_discovered").default(0),
  columnsDiscovered: integer("columns_discovered").default(0),
  errorsCount: integer("errors_count").default(0),
  errorDetails: json("error_details"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in seconds
  triggeredBy: integer("triggered_by"),
});

export const insertDiscoveryLogSchema = createInsertSchema(discoveryLogs).omit({
  id: true, startedAt: true, completedAt: true
});
export type InsertDiscoveryLog = z.infer<typeof insertDiscoveryLogSchema>;
export type DiscoveryLog = typeof discoveryLogs.$inferSelect;

// ==================== جودة البيانات ====================
export const dataQualityRules = pgTable("data_quality_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  nameEn: varchar("name_en", { length: 300 }),
  description: text("description"),
  assetId: integer("asset_id"),
  dimension: varchar("dimension", { length: 100 }).notNull(),
  ruleType: varchar("rule_type", { length: 100 }),
  threshold: decimal("threshold", { precision: 5, scale: 2 }),
  currentScore: decimal("current_score", { precision: 5, scale: 2 }),
  targetTable: varchar("target_table", { length: 200 }),
  targetColumn: varchar("target_column", { length: 200 }),
  sqlExpression: text("sql_expression"),
  validationPattern: varchar("validation_pattern", { length: 500 }),
  systemName: varchar("system_name", { length: 200 }),
  connectionId: integer("connection_id"),
  severity: varchar("severity", { length: 50 }).default("medium"),
  schedule: varchar("schedule", { length: 100 }).default("manual"),
  totalRecordsChecked: integer("total_records_checked").default(0),
  failedRecords: integer("failed_records").default(0),
  lastCheckDuration: integer("last_check_duration"),
  status: text("status").default("active").notNull(),
  lastChecked: timestamp("last_checked"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataQualityRuleSchema = createInsertSchema(dataQualityRules).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataQualityRule = z.infer<typeof insertDataQualityRuleSchema>;
export type DataQualityRule = typeof dataQualityRules.$inferSelect;

export const dataQualityChecks = pgTable("data_quality_checks", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull(),
  ruleName: varchar("rule_name", { length: 300 }),
  dimension: varchar("dimension", { length: 100 }),
  targetTable: varchar("target_table", { length: 200 }),
  targetColumn: varchar("target_column", { length: 200 }),
  systemName: varchar("system_name", { length: 200 }),
  totalRecords: integer("total_records").default(0),
  passedRecords: integer("passed_records").default(0),
  failedRecords: integer("failed_records").default(0),
  score: decimal("score", { precision: 5, scale: 2 }),
  threshold: decimal("threshold", { precision: 5, scale: 2 }),
  passed: boolean("passed").default(false),
  executionTime: integer("execution_time"),
  errorMessage: text("error_message"),
  sampleFailures: text("sample_failures"),
  checkType: varchar("check_type", { length: 50 }).default("automated"),
  executedBy: integer("executed_by"),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataQualityCheckSchema = createInsertSchema(dataQualityChecks).omit({
  id: true, executedAt: true
});
export type InsertDataQualityCheck = z.infer<typeof insertDataQualityCheckSchema>;
export type DataQualityCheck = typeof dataQualityChecks.$inferSelect;

// ==================== طلبات أصحاب البيانات (DSR) ====================
export const dataSubjectRequests = pgTable("data_subject_requests", {
  id: serial("id").primaryKey(),
  requestNumber: varchar("request_number", { length: 50 }).notNull().unique(),
  requestType: text("request_type").notNull(),
  subjectName: varchar("subject_name", { length: 200 }).notNull(),
  subjectEmail: varchar("subject_email", { length: 320 }),
  subjectPhone: varchar("subject_phone", { length: 20 }),
  subjectIdNumber: varchar("subject_id_number", { length: 20 }),
  description: text("description"),
  status: text("status").default("pending").notNull(),
  priority: text("priority").default("normal").notNull(),
  source: text("source").default("internal").notNull(),
  assignedTo: integer("assigned_to"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  response: text("response"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DataSubjectRequest = typeof dataSubjectRequests.$inferSelect;

// ==================== إجراءات DSR على الأنظمة الخارجية ====================
export const dsrSystemActions = pgTable("dsr_system_actions", {
  id: serial("id").primaryKey(),
  dsrId: integer("dsr_id").notNull().references(() => dataSubjectRequests.id, { onDelete: "cascade" }),
  systemId: integer("system_id"),
  systemName: varchar("system_name", { length: 200 }).notNull(),
  systemType: varchar("system_type", { length: 100 }),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  actionType: text("action_type").notNull(), // search | delete | restrict | export | notify
  status: text("status").default("pending").notNull(), // pending | sent | acknowledged | completed | failed | not_found | not_applicable
  requestSentAt: timestamp("request_sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  completedAt: timestamp("completed_at"),
  responseCode: integer("response_code"),
  responseData: json("response_data"),
  errorMessage: text("error_message"),
  notes: text("notes"),
  handledBy: varchar("handled_by", { length: 200 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
export const insertDsrSystemActionSchema = createInsertSchema(dsrSystemActions).omit({ id: true, createdAt: true, updatedAt: true });
export type DsrSystemAction = typeof dsrSystemActions.$inferSelect;
export type InsertDsrSystemAction = typeof dsrSystemActions.$inferInsert;

// ==================== سجل المخاطر ====================
export const dataRisks = pgTable("data_risks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  assetId: integer("asset_id"),
  likelihood: text("likelihood").default("medium").notNull(),
  impact: text("impact").default("medium").notNull(),
  riskLevel: text("risk_level").default("medium").notNull(),
  mitigationPlan: text("mitigation_plan"),
  owner: varchar("owner", { length: 200 }),
  ownerId: integer("owner_id"),
  status: text("status").default("identified").notNull(),
  dueDate: timestamp("due_date"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DataRisk = typeof dataRisks.$inferSelect;

// ==================== الحوادث الأمنية ====================
export const securityIncidents = pgTable("security_incidents", {
  id: serial("id").primaryKey(),
  incidentNumber: varchar("incident_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  titleAr: varchar("title_ar", { length: 300 }),
  description: text("description"),
  incidentType: varchar("incident_type", { length: 100 }),
  severity: text("severity").default("medium").notNull(),
  status: text("status").default("open").notNull(),
  affectedAssets: json("affected_assets"),
  sourceSystem: varchar("source_system", { length: 300 }),
  affectedDepartment: varchar("affected_department", { length: 200 }),
  isAnonymous: boolean("is_anonymous").default(false),
  detectionMethod: varchar("detection_method", { length: 300 }),
  containmentActions: text("containment_actions"),
  remediationSteps: text("remediation_steps"),
  reportedBy: integer("reported_by"),
  assignedTo: integer("assigned_to"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SecurityIncident = typeof securityIncidents.$inferSelect;

// ==================== الاتفاقيات والعقود ====================
export const dataAgreements = pgTable("data_agreements", {
  id: serial("id").primaryKey(),
  agreementNumber: varchar("agreement_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  agreementType: varchar("agreement_type", { length: 100 }),
  partyName: varchar("party_name", { length: 200 }),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default("draft").notNull(),
  fileUrl: text("file_url"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DataAgreement = typeof dataAgreements.$inferSelect;

// ==================== الدورات التدريبية ====================
export const trainingCourses = pgTable("training_courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  duration: varchar("duration", { length: 100 }),
  level: varchar("level", { length: 50 }).default("مبتدئ"),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  enrolled: integer("enrolled").default(0),
  completed: integer("completed").default(0),
  status: text("status").default("active").notNull(),
  departmentId: integer("department_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type TrainingCourse = typeof trainingCourses.$inferSelect;

// ==================== الأنظمة الخارجية ====================
export const externalSystems = pgTable("external_systems", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  systemType: text("system_type").notNull(),
  category: text("category").notNull(),
  departmentId: integer("department_id"),
  apiEndpoint: text("api_endpoint"),
  ipAddress: varchar("ip_address", { length: 45 }),
  port: integer("port"),
  protocol: varchar("protocol", { length: 20 }),
  authType: varchar("auth_type", { length: 50 }),
  authCredentials: text("auth_credentials"),
  healthCheckUrl: text("health_check_url"),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").default("unknown"),
  responseTime: integer("response_time"),
  description: text("description"),
  vendor: varchar("vendor", { length: 200 }),
  version: varchar("version", { length: 50 }),
  environment: text("environment").default("production"),
  criticality: text("criticality").default("medium"),
  dataClassification: text("data_classification").default("internal"),
  integrationDirection: text("integration_direction").default("read_only"),
  integrationScope: text("integration_scope"),
  slaUptime: decimal("sla_uptime", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  approvalStatus: text("approval_status").default("pending"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ExternalSystem = typeof externalSystems.$inferSelect;

// ==================== سجل مراقبة الأنظمة ====================
export const systemHealthLogs = pgTable("system_health_logs", {
  id: serial("id").primaryKey(),
  systemId: integer("system_id").notNull(),
  status: text("status").notNull(),
  responseTime: integer("response_time"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SystemHealthLog = typeof systemHealthLogs.$inferSelect;

// ==================== إدارة الموردين ====================
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  vendorType: text("vendor_type").notNull(),
  category: text("category"),
  contactPerson: varchar("contact_person", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  website: text("website"),
  address: text("address"),
  country: varchar("country", { length: 100 }),
  contractNumber: varchar("contract_number", { length: 100 }),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  contractValue: decimal("contract_value", { precision: 15, scale: 2 }),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  status: text("status").default("active").notNull(),
  rating: integer("rating"),
  notes: text("notes"),
  departmentId: integer("department_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Vendor = typeof vendors.$inferSelect;

// ==================== اتفاقيات مستوى الخدمة (SLA) ====================
export const slaAgreements = pgTable("sla_agreements", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull(),
  systemId: integer("system_id"),
  departmentId: integer("department_id"),
  projectId: integer("project_id"),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  serviceType: text("service_type").notNull(),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }).notNull(),
  targetUnit: varchar("target_unit", { length: 50 }).notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  measurementPeriod: varchar("measurement_period", { length: 50 }),
  penaltyClause: text("penalty_clause"),
  penaltyAmount: decimal("penalty_amount", { precision: 15, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default("active").notNull(),
  lastMeasured: timestamp("last_measured"),
  complianceStatus: text("compliance_status").default("compliant"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SLAAgreement = typeof slaAgreements.$inferSelect;

// ==================== سجل خروقات SLA ====================
export const slaBreaches = pgTable("sla_breaches", {
  id: serial("id").primaryKey(),
  slaId: integer("sla_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  breachDate: timestamp("breach_date").notNull(),
  expectedValue: decimal("expected_value", { precision: 10, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  impactLevel: text("impact_level").default("medium"),
  description: text("description"),
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  penaltyApplied: boolean("penalty_applied").default(false),
  penaltyAmount: decimal("penalty_amount", { precision: 15, scale: 2 }),
  status: text("status").default("open"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SLABreach = typeof slaBreaches.$inferSelect;

// ==================== إدارة المستندات ====================
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  category: text("category").notNull(),
  dataClassification: text("data_classification").default("internal"),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  fileUrl: text("file_url"),
  version: varchar("version", { length: 50 }).default("1.0"),
  status: text("status").default("active").notNull(),
  isConfidential: boolean("is_confidential").default(false),
  tags: json("tags"),
  createdBy: integer("created_by"),
  reviewDate: timestamp("review_date"),
  expiryDate: timestamp("expiry_date"),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Document = typeof documents.$inferSelect;

// ==================== ردود طلبات البيانات ====================
export const dmoRequestResponses = pgTable("dmo_request_responses", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  responderId: integer("responder_id").notNull(),
  message: text("message").notNull(),
  attachments: json("attachments"),
  isFromDmo: boolean("is_from_dmo").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDmoRequestResponseSchema = createInsertSchema(dmoRequestResponses).omit({
  id: true, createdAt: true
});
export type InsertDmoRequestResponse = z.infer<typeof insertDmoRequestResponseSchema>;
export type DmoRequestResponse = typeof dmoRequestResponses.$inferSelect;

// ==================== إحالات بين الإدارات التقنية ====================
export const itReferrals = pgTable("it_referrals", {
  id: serial("id").primaryKey(),
  referralNumber: varchar("referral_number", { length: 50 }).notNull().unique(),
  type: text("type").notNull(),
  entityId: integer("entity_id").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  priority: text("priority").default("medium").notNull(),
  fromDepartmentId: integer("from_department_id").notNull(),
  toDepartmentId: integer("to_department_id").notNull(),
  referredById: integer("referred_by_id").notNull(),
  assignedToId: integer("assigned_to_id"),
  delegatedToDepartmentId: integer("delegated_to_department_id"),
  status: text("status").default("pending").notNull(),
  reason: text("reason"),
  responseNote: text("response_note"),
  attachments: json("attachments"),
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours").default(48),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
  // Acknowledgment & Escalation tracking
  acknowledgedAt: timestamp("acknowledged_at"),
  escalationLevel: integer("escalation_level").default(0).notNull(),
  escalatedAt: timestamp("escalated_at"),
  itDirectorEscalatedAt: timestamp("it_director_escalated_at"),
  slaAcknowledgeHours: integer("sla_acknowledge_hours").default(4),
  // Outlook email import fields
  isEmailImported: boolean("is_email_imported").default(false),
  emailSource: text("email_source"),
  outlookMessageId: text("outlook_message_id"),
  emailReceivedAt: timestamp("email_received_at"),
  emailSubject: text("email_subject"),
  // Planner task import
  sourcePlannerTaskId: integer("source_planner_task_id"),
  sourcePlannerBoardId: integer("source_planner_board_id"),
  isPlannerImported: boolean("is_planner_imported").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertItReferralSchema = createInsertSchema(itReferrals).omit({
  id: true, createdAt: true, updatedAt: true, referralNumber: true
});
export type InsertItReferral = z.infer<typeof insertItReferralSchema>;
export type ItReferral = typeof itReferrals.$inferSelect;

// ==================== سجل الإحالات (التاريخ) ====================
export const itReferralHistory = pgTable("it_referral_history", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull(),
  action: text("action").notNull(),
  performedById: integer("performed_by_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ItReferralHistory = typeof itReferralHistory.$inferSelect;

// ==================== مبادرات التحول الرقمي ====================
export const digitalInitiatives = pgTable("digital_initiatives", {
  id: serial("id").primaryKey(),
  initiativeCode: varchar("initiative_code", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  titleEn: varchar("title_en", { length: 300 }),
  description: text("description"),
  objectives: text("objectives"),
  category: text("category").default("automation").notNull(),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("proposed").notNull(),
  sponsorId: integer("sponsor_id"),
  managerId: integer("manager_id"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }),
  startDate: timestamp("start_date"),
  targetEndDate: timestamp("target_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  progress: integer("progress").default(0).notNull(),
  benefitsMeasured: text("benefits_measured"),
  roiTarget: decimal("roi_target", { precision: 10, scale: 2 }),
  roiActual: decimal("roi_actual", { precision: 10, scale: 2 }),
  affectedDepartments: json("affected_departments"),
  dependencies: json("dependencies"),
  risks: text("risks"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDigitalInitiativeSchema = createInsertSchema(digitalInitiatives).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDigitalInitiative = z.infer<typeof insertDigitalInitiativeSchema>;
export type DigitalInitiative = typeof digitalInitiatives.$inferSelect;

// ==================== التطبيقات الرقمية ====================
export const digitalApplications = pgTable("digital_applications", {
  id: serial("id").primaryKey(),
  appCode: varchar("app_code", { length: 50 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  description: text("description"),
  appType: text("app_type").default("web").notNull(),
  platform: text("platform").default("web").notNull(),
  vendor: varchar("vendor", { length: 200 }),
  version: varchar("version", { length: 50 }),
  url: text("url"),
  hostingType: text("hosting_type").default("on_premise").notNull(),
  ownerDepartmentId: integer("owner_department_id"),
  responsibleUserId: integer("responsible_user_id"),
  usersCount: integer("users_count"),
  licensingType: varchar("licensing_type", { length: 100 }),
  licenseCost: decimal("license_cost", { precision: 15, scale: 2 }),
  renewalDate: timestamp("renewal_date"),
  status: text("status").default("active").notNull(),
  criticality: text("criticality").default("medium").notNull(),
  dataClassification: text("data_classification").default("internal").notNull(),
  integrations: json("integrations"),
  goLiveDate: timestamp("go_live_date"),
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDate: timestamp("next_review_date"),
  documentation: text("documentation"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDigitalApplicationSchema = createInsertSchema(digitalApplications).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDigitalApplication = z.infer<typeof insertDigitalApplicationSchema>;
export type DigitalApplication = typeof digitalApplications.$inferSelect;

// ==================== الخدمات السحابية ====================
export const cloudServices = pgTable("cloud_services", {
  id: serial("id").primaryKey(),
  serviceCode: varchar("service_code", { length: 50 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }),
  description: text("description"),
  provider: text("provider").notNull(),
  serviceType: text("service_type").default("saas").notNull(),
  region: varchar("region", { length: 100 }),
  accountId: varchar("account_id", { length: 200 }),
  subscriptionType: varchar("subscription_type", { length: 100 }),
  monthlyCost: decimal("monthly_cost", { precision: 15, scale: 2 }),
  annualCost: decimal("annual_cost", { precision: 15, scale: 2 }),
  ownerDepartmentId: integer("owner_department_id"),
  responsibleUserId: integer("responsible_user_id"),
  dataClassification: text("data_classification").default("internal").notNull(),
  complianceStatus: text("compliance_status").default("compliant"),
  securityAssessmentDate: timestamp("security_assessment_date"),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  autoRenew: boolean("auto_renew").default(false),
  status: text("status").default("active").notNull(),
  slaUptime: decimal("sla_uptime", { precision: 5, scale: 2 }),
  resourceDetails: json("resource_details"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCloudServiceSchema = createInsertSchema(cloudServices).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertCloudService = z.infer<typeof insertCloudServiceSchema>;
export type CloudService = typeof cloudServices.$inferSelect;

// ==================== تقييم رضا العملاء ====================
export const customerSatisfaction = pgTable("customer_satisfaction", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id"),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  category: text("category"),
  departmentId: integer("department_id"),
  agentId: integer("agent_id"),
  responseTime: integer("response_time"),
  resolutionTime: integer("resolution_time"),
  wouldRecommend: boolean("would_recommend"),
  improvementSuggestion: text("improvement_suggestion"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCustomerSatisfactionSchema = createInsertSchema(customerSatisfaction).omit({
  id: true, createdAt: true
});
export type InsertCustomerSatisfaction = z.infer<typeof insertCustomerSatisfactionSchema>;
export type CustomerSatisfactionRecord = typeof customerSatisfaction.$inferSelect;

// ==================== تقييمات المخاطر الأمنية ====================
export const securityRiskAssessments = pgTable("security_risk_assessments", {
  id: serial("id").primaryKey(),
  assessmentCode: varchar("assessment_code", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  assessmentType: text("assessment_type").default("general").notNull(),
  scope: text("scope"),
  targetSystemId: integer("target_system_id"),
  targetAssetId: integer("target_asset_id"),
  assessorId: integer("assessor_id"),
  status: text("status").default("planned").notNull(),
  riskLevel: text("risk_level").default("medium").notNull(),
  threatLevel: text("threat_level"),
  vulnerabilityLevel: text("vulnerability_level"),
  impactLevel: text("impact_level"),
  likelihood: text("likelihood"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  remediationPlan: text("remediation_plan"),
  remediationDeadline: timestamp("remediation_deadline"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  nextAssessmentDate: timestamp("next_assessment_date"),
  attachments: json("attachments"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSecurityRiskAssessmentSchema = createInsertSchema(securityRiskAssessments).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertSecurityRiskAssessment = z.infer<typeof insertSecurityRiskAssessmentSchema>;
export type SecurityRiskAssessment = typeof securityRiskAssessments.$inferSelect;

// ==================== مراقبة أداء الأنظمة ====================
export const systemPerformanceMetrics = pgTable("system_performance_metrics", {
  id: serial("id").primaryKey(),
  systemId: integer("system_id"),
  assetId: integer("asset_id"),
  metricType: text("metric_type").notNull(),
  metricName: varchar("metric_name", { length: 200 }).notNull(),
  currentValue: decimal("current_value", { precision: 15, scale: 4 }),
  targetValue: decimal("target_value", { precision: 15, scale: 4 }),
  minThreshold: decimal("min_threshold", { precision: 15, scale: 4 }),
  maxThreshold: decimal("max_threshold", { precision: 15, scale: 4 }),
  unit: varchar("unit", { length: 50 }),
  status: text("status").default("normal").notNull(),
  trend: text("trend"),
  measurementDate: timestamp("measurement_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  departmentId: integer("department_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SystemPerformanceMetric = typeof systemPerformanceMetrics.$inferSelect;

// ==================== جدول أعمال الإدارة ====================
export const departmentTasks = pgTable("department_tasks", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  taskType: text("task_type").default("regular").notNull(),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("pending").notNull(),
  assignedTo: integer("assigned_to"),
  assignedBy: integer("assigned_by").notNull(),
  parentTaskId: integer("parent_task_id"),
  projectId: integer("project_id"),
  referralId: integer("referral_id"),
  sourceType: text("source_type").default("manual"),
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  progress: integer("progress").default(0).notNull(),
  attachments: json("attachments"),
  checklist: json("checklist"),
  tags: json("tags"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDepartmentTaskSchema = createInsertSchema(departmentTasks).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDepartmentTask = z.infer<typeof insertDepartmentTaskSchema>;
export type DepartmentTask = typeof departmentTasks.$inferSelect;

// ==================== اتصالات قواعد البيانات الخارجية ====================
export const databaseConnections = pgTable("database_connections", {
  id: serial("id").primaryKey(),
  connectionName: varchar("connection_name", { length: 200 }).notNull(),
  connectionNameAr: varchar("connection_name_ar", { length: 200 }),
  systemId: integer("system_id"),
  databaseType: varchar("database_type", { length: 50 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull(),
  databaseName: varchar("database_name", { length: 200 }).notNull(),
  username: varchar("username", { length: 100 }),
  encryptedPassword: text("encrypted_password"),
  sslEnabled: boolean("ssl_enabled").default(false),
  sslCertificate: text("ssl_certificate"),
  connectionString: text("connection_string"),
  schemaName: varchar("schema_name", { length: 100 }),
  isReadOnly: boolean("is_read_only").default(true),
  maxConnections: integer("max_connections").default(5),
  connectionTimeout: integer("connection_timeout").default(30),
  lastTestedAt: timestamp("last_tested_at"),
  testStatus: varchar("test_status", { length: 50 }).default("pending"),
  testMessage: text("test_message"),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  dataClassification: varchar("data_classification", { length: 50 }).default("confidential"),
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDatabaseConnectionSchema = createInsertSchema(databaseConnections).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDatabaseConnection = z.infer<typeof insertDatabaseConnectionSchema>;
export type DatabaseConnection = typeof databaseConnections.$inferSelect;

// ==================== خريطة تدفق البيانات ====================
export const dataFlowMappings = pgTable("data_flow_mappings", {
  id: serial("id").primaryKey(),
  sourceSystemId: integer("source_system_id"),
  sourceTableId: integer("source_table_id"),
  targetSystemId: integer("target_system_id"),
  targetTableId: integer("target_table_id"),
  flowName: varchar("flow_name", { length: 200 }).notNull(),
  flowNameAr: varchar("flow_name_ar", { length: 200 }),
  flowType: varchar("flow_type", { length: 50 }),
  frequency: varchar("frequency", { length: 50 }),
  transformationRules: json("transformation_rules"),
  dataVolume: varchar("data_volume", { length: 100 }),
  isActive: boolean("is_active").default(true),
  lastExecutedAt: timestamp("last_executed_at"),
  status: varchar("status", { length: 50 }).default("active"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDataFlowMappingSchema = createInsertSchema(dataFlowMappings).omit({
  id: true, createdAt: true, updatedAt: true
});
export type InsertDataFlowMapping = z.infer<typeof insertDataFlowMappingSchema>;
export type DataFlowMapping = typeof dataFlowMappings.$inferSelect;

// ==================== العلاقات بين الجداول (Relations) ====================
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  itDepartment: one(itDepartments, { fields: [users.itDepartmentId], references: [itDepartments.id] }),
  sessions: many(sessions),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  tickets: many(itTickets),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  manager: one(users, { fields: [departments.managerId], references: [users.id] }),
  parent: one(departments, { fields: [departments.parentId], references: [departments.id] }),
  users: many(users),
  evidences: many(evidences),
  documents: many(documents),
}));

export const itDepartmentsRelations = relations(itDepartments, ({ one, many }) => ({
  manager: one(users, { fields: [itDepartments.managerId], references: [users.id] }),
  members: many(itDepartmentMembers),
  projects: many(itProjects),
}));

export const itDepartmentMembersRelations = relations(itDepartmentMembers, ({ one }) => ({
  department: one(itDepartments, { fields: [itDepartmentMembers.departmentId], references: [itDepartments.id] }),
  user: one(users, { fields: [itDepartmentMembers.userId], references: [users.id] }),
}));

export const domainsRelations = relations(domains, ({ many }) => ({
  requirements: many(requirements),
}));

export const requirementsRelations = relations(requirements, ({ one, many }) => ({
  domain: one(domains, { fields: [requirements.domainId], references: [domains.id] }),
  evidences: many(evidences),
}));

export const evidencesRelations = relations(evidences, ({ one }) => ({
  requirement: one(requirements, { fields: [evidences.requirementId], references: [requirements.id] }),
  department: one(departments, { fields: [evidences.departmentId], references: [departments.id] }),
  submitter: one(users, { fields: [evidences.submittedBy], references: [users.id] }),
  reviewer: one(users, { fields: [evidences.reviewedBy], references: [users.id] }),
}));

export const committeeDecisionsRelations = relations(committeeDecisions, ({ one, many }) => ({
  meeting: one(committeeMeetings, { fields: [committeeDecisions.meetingId], references: [committeeMeetings.id] }),
  creator: one(users, { fields: [committeeDecisions.createdBy], references: [users.id] }),
  votes: many(decisionVotes),
}));

export const committeeMeetingsRelations = relations(committeeMeetings, ({ one, many }) => ({
  creator: one(users, { fields: [committeeMeetings.createdBy], references: [users.id] }),
  decisions: many(committeeDecisions),
  attendance: many(meetingAttendance),
  minutes: many(meetingMinutes),
}));

export const meetingAttendanceRelations = relations(meetingAttendance, ({ one }) => ({
  meeting: one(committeeMeetings, { fields: [meetingAttendance.meetingId], references: [committeeMeetings.id] }),
  member: one(committeeMembers, { fields: [meetingAttendance.memberId], references: [committeeMembers.id] }),
  delegate: one(committeeMembers, { fields: [meetingAttendance.delegatedTo], references: [committeeMembers.id] }),
}));

export const decisionVotesRelations = relations(decisionVotes, ({ one }) => ({
  decision: one(committeeDecisions, { fields: [decisionVotes.decisionId], references: [committeeDecisions.id] }),
  votingSession: one(votingSessions, { fields: [decisionVotes.votingSessionId], references: [votingSessions.id] }),
  member: one(committeeMembers, { fields: [decisionVotes.memberId], references: [committeeMembers.id] }),
}));

export const votingSessionsRelations = relations(votingSessions, ({ one, many }) => ({
  creator: one(users, { fields: [votingSessions.createdBy], references: [users.id] }),
  votes: many(decisionVotes),
}));

export const itProjectsRelations = relations(itProjects, ({ one, many }) => ({
  department: one(departments, { fields: [itProjects.departmentId], references: [departments.id] }),
  itDepartment: one(itDepartments, { fields: [itProjects.itDepartmentId], references: [itDepartments.id] }),
  manager: one(users, { fields: [itProjects.managerId], references: [users.id] }),
  tasks: many(departmentTasks),
}));

export const itTicketsRelations = relations(itTickets, ({ one }) => ({
  requester: one(users, { fields: [itTickets.requesterId], references: [users.id] }),
  assignee: one(users, { fields: [itTickets.assigneeId], references: [users.id] }),
  department: one(departments, { fields: [itTickets.departmentId], references: [departments.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  department: one(departments, { fields: [documents.departmentId], references: [departments.id] }),
  creator: one(users, { fields: [documents.createdBy], references: [users.id] }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  department: one(departments, { fields: [vendors.departmentId], references: [departments.id] }),
  creator: one(users, { fields: [vendors.createdBy], references: [users.id] }),
  slaAgreements: many(slaAgreements),
  slaBreaches: many(slaBreaches),
}));

export const slaAgreementsRelations = relations(slaAgreements, ({ one, many }) => ({
  vendor: one(vendors, { fields: [slaAgreements.vendorId], references: [vendors.id] }),
  system: one(itSystems, { fields: [slaAgreements.systemId], references: [itSystems.id] }),
  department: one(departments, { fields: [slaAgreements.departmentId], references: [departments.id] }),
  project: one(itProjects, { fields: [slaAgreements.projectId], references: [itProjects.id] }),
  breaches: many(slaBreaches),
}));

export const slaBreachesRelations = relations(slaBreaches, ({ one }) => ({
  sla: one(slaAgreements, { fields: [slaBreaches.slaId], references: [slaAgreements.id] }),
  vendor: one(vendors, { fields: [slaBreaches.vendorId], references: [vendors.id] }),
}));

export const itSystemsRelations = relations(itSystems, ({ one, many }) => ({
  responsibleDepartment: one(itDepartments, { fields: [itSystems.responsibleDepartmentId], references: [itDepartments.id] }),
  responsibleUser: one(users, { fields: [itSystems.responsibleUserId], references: [users.id] }),
  slaAgreements: many(slaAgreements),
  systemConnections: many(systemConnections),
  dataAssets: many(dataAssets),
}));

export const systemConnectionsRelations = relations(systemConnections, ({ one }) => ({
  system: one(itSystems, { fields: [systemConnections.systemId], references: [itSystems.id] }),
  creator: one(users, { fields: [systemConnections.createdBy], references: [users.id] }),
}));

export const dataAssetsRelations = relations(dataAssets, ({ one }) => ({
  system: one(itSystems, { fields: [dataAssets.systemId], references: [itSystems.id] }),
}));

export const departmentTasksRelations = relations(departmentTasks, ({ one }) => ({
  department: one(departments, { fields: [departmentTasks.departmentId], references: [departments.id] }),
  assignedToUser: one(users, { fields: [departmentTasks.assignedTo], references: [users.id] }),
  assignedByUser: one(users, { fields: [departmentTasks.assignedBy], references: [users.id] }),
  parent: one(departmentTasks, { fields: [departmentTasks.parentTaskId], references: [departmentTasks.id] }),
  project: one(itProjects, { fields: [departmentTasks.projectId], references: [itProjects.id] }),
}));

export const databaseConnectionsRelations = relations(databaseConnections, ({ one, many }) => ({
  system: one(itSystems, { fields: [databaseConnections.systemId], references: [itSystems.id] }),
  approver: one(users, { fields: [databaseConnections.approvedBy], references: [users.id] }),
  creator: one(users, { fields: [databaseConnections.createdBy], references: [users.id] }),
  tables: many(discoveredTables),
}));

export const discoveredTablesRelations = relations(discoveredTables, ({ one }) => ({
  connection: one(databaseConnections, { fields: [discoveredTables.connectionId], references: [databaseConnections.id] }),
}));

export const digitalInitiativesRelations = relations(digitalInitiatives, ({ one }) => ({
  sponsor: one(users, { fields: [digitalInitiatives.sponsorId], references: [users.id] }),
  manager: one(users, { fields: [digitalInitiatives.managerId], references: [users.id] }),
  creator: one(users, { fields: [digitalInitiatives.createdBy], references: [users.id] }),
}));

export const digitalApplicationsRelations = relations(digitalApplications, ({ one }) => ({
  ownerDepartment: one(itDepartments, { fields: [digitalApplications.ownerDepartmentId], references: [itDepartments.id] }),
  responsibleUser: one(users, { fields: [digitalApplications.responsibleUserId], references: [users.id] }),
  creator: one(users, { fields: [digitalApplications.createdBy], references: [users.id] }),
}));

export const cloudServicesRelations = relations(cloudServices, ({ one }) => ({
  ownerDepartment: one(itDepartments, { fields: [cloudServices.ownerDepartmentId], references: [itDepartments.id] }),
  responsibleUser: one(users, { fields: [cloudServices.responsibleUserId], references: [users.id] }),
  creator: one(users, { fields: [cloudServices.createdBy], references: [users.id] }),
}));

export const itReferralsRelations = relations(itReferrals, ({ one, many }) => ({
  fromDepartment: one(itDepartments, { fields: [itReferrals.fromDepartmentId], references: [itDepartments.id] }),
  toDepartment: one(itDepartments, { fields: [itReferrals.toDepartmentId], references: [itDepartments.id] }),
  referredBy: one(users, { fields: [itReferrals.referredById], references: [users.id] }),
  assignedTo: one(users, { fields: [itReferrals.assignedToId], references: [users.id] }),
  history: many(itReferralHistory),
}));

export const itReferralHistoryRelations = relations(itReferralHistory, ({ one }) => ({
  referral: one(itReferrals, { fields: [itReferralHistory.referralId], references: [itReferrals.id] }),
  performer: one(users, { fields: [itReferralHistory.performedById], references: [users.id] }),
}));

export const securityRiskAssessmentsRelations = relations(securityRiskAssessments, ({ one }) => ({
  targetSystem: one(itSystems, { fields: [securityRiskAssessments.targetSystemId], references: [itSystems.id] }),
  assessor: one(users, { fields: [securityRiskAssessments.assessorId], references: [users.id] }),
  creator: one(users, { fields: [securityRiskAssessments.createdBy], references: [users.id] }),
}));

export const customerSatisfactionRelations = relations(customerSatisfaction, ({ one }) => ({
  ticket: one(itTickets, { fields: [customerSatisfaction.ticketId], references: [itTickets.id] }),
  user: one(users, { fields: [customerSatisfaction.userId], references: [users.id] }),
  department: one(departments, { fields: [customerSatisfaction.departmentId], references: [departments.id] }),
  agent: one(users, { fields: [customerSatisfaction.agentId], references: [users.id] }),
}));

// ==================== PDPL - سجلات الموافقة ====================
export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  dataSubjectId: integer("data_subject_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: varchar("purpose", { length: 500 }).notNull(),
  purposeAr: varchar("purpose_ar", { length: 500 }).notNull(),
  legalBasis: varchar("legal_basis", { length: 50 }).notNull(),
  dataTypes: json("data_types").$type<string[]>().notNull(),
  givenAt: timestamp("given_at").notNull(),
  expiresAt: timestamp("expires_at"),
  withdrawnAt: timestamp("withdrawn_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ConsentRecord = typeof consentRecords.$inferSelect;
export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({ id: true, createdAt: true });
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;

// ==================== PDPL - تقارير اختراق البيانات ====================
export const dataBreaches = pgTable("data_breaches", {
  id: serial("id").primaryKey(),
  detectedAt: timestamp("detected_at").notNull(),
  reportedAt: timestamp("reported_at"),
  severity: varchar("severity", { length: 20 }).notNull(),
  affectedRecords: integer("affected_records").notNull(),
  affectedDataTypes: json("affected_data_types").$type<string[]>().notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  rootCause: text("root_cause"),
  containmentMeasures: json("containment_measures").$type<string[]>().default([]),
  remediationSteps: json("remediation_steps").$type<string[]>().default([]),
  notificationSent: boolean("notification_sent").default(false).notNull(),
  notifiedSdaia: boolean("notified_sdaia").default(false).notNull(),
  notifiedAffectedUsers: boolean("notified_affected_users").default(false).notNull(),
  status: varchar("status", { length: 30 }).default("detected").notNull(),
  investigationNotes: json("investigation_notes").$type<string[]>().default([]),
  leadInvestigator: integer("lead_investigator").references(() => users.id, { onDelete: "set null" }),
  reportedBy: integer("reported_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DataBreach = typeof dataBreaches.$inferSelect;
export const insertDataBreachSchema = createInsertSchema(dataBreaches).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDataBreach = z.infer<typeof insertDataBreachSchema>;

// ==================== PDPL - سجلات المعالجة (RoPA) ====================
export const processingRecords = pgTable("processing_records", {
  id: serial("id").primaryKey(),
  activityName: varchar("activity_name", { length: 300 }).notNull(),
  activityNameAr: varchar("activity_name_ar", { length: 300 }).notNull(),
  purpose: text("purpose").notNull(),
  purposeAr: text("purpose_ar").notNull(),
  legalBasis: varchar("legal_basis", { length: 50 }).notNull(),
  dataCategories: json("data_categories").$type<string[]>().notNull(),
  dataSubjectCategories: json("data_subject_categories").$type<string[]>().default([]),
  recipients: json("recipients").$type<string[]>().default([]),
  crossBorderTransfers: json("cross_border_transfers").$type<{ country: string; recipient: string; mechanism: string }[]>().default([]),
  retentionPeriod: varchar("retention_period", { length: 100 }),
  securityMeasures: json("security_measures").$type<string[]>().default([]),
  dpiaRequired: boolean("dpia_required").default(false).notNull(),
  dpiaCompleted: boolean("dpia_completed").default(false).notNull(),
  lastReviewed: timestamp("last_reviewed"),
  nextReview: timestamp("next_review"),
  responsible: integer("responsible").references(() => users.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ProcessingRecord = typeof processingRecords.$inferSelect;
export const insertProcessingRecordSchema = createInsertSchema(processingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProcessingRecord = z.infer<typeof insertProcessingRecordSchema>;

// ==================== NDMO - تقييمات الامتثال ====================
export const ndmoAssessments = pgTable("ndmo_assessments", {
  id: serial("id").primaryKey(),
  domainId: varchar("domain_id", { length: 50 }).notNull(),
  fiscalQuarter: varchar("fiscal_quarter", { length: 10 }).notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  assessedAt: timestamp("assessed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  assessedBy: integer("assessed_by").references(() => users.id, { onDelete: "set null" }),
  specifications: json("specifications").$type<{
    specificationId: string;
    status: string;
    score: number;
    evidence: string[];
    gaps: string[];
    remediationPlan?: string;
  }[]>().default([]),
  overallScore: integer("overall_score").default(0),
  submittedToNdmo: boolean("submitted_to_ndmo").default(false).notNull(),
  submittedAt: timestamp("submitted_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type NdmoAssessment = typeof ndmoAssessments.$inferSelect;
export const insertNdmoAssessmentSchema = createInsertSchema(ndmoAssessments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNdmoAssessment = z.infer<typeof insertNdmoAssessmentSchema>;

// ==================== تصنيف البيانات ====================
export const dataClassifications = pgTable("data_classifications", {
  id: serial("id").primaryKey(),
  assetName: varchar("asset_name", { length: 300 }).notNull(),
  assetNameAr: varchar("asset_name_ar", { length: 300 }).notNull(),
  assetType: varchar("asset_type", { length: 100 }).notNull(),
  classificationLevel: varchar("classification_level", { length: 50 }).notNull(),
  impactNational: varchar("impact_national", { length: 20 }),
  impactOrganization: varchar("impact_organization", { length: 20 }),
  impactIndividual: varchar("impact_individual", { length: 20 }),
  impactEnvironment: varchar("impact_environment", { length: 20 }),
  containsPersonalData: boolean("contains_personal_data").default(false).notNull(),
  containsSensitiveData: boolean("contains_sensitive_data").default(false).notNull(),
  assignedDate: timestamp("assigned_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiryDate: timestamp("expiry_date"),
  reviewDate: timestamp("review_date"),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  dataOwner: integer("data_owner").references(() => users.id, { onDelete: "set null" }),
  dataCustodian: integer("data_custodian").references(() => users.id, { onDelete: "set null" }),
  handlingInstructions: text("handling_instructions"),
  handlingInstructionsAr: text("handling_instructions_ar"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DataClassificationRecord = typeof dataClassifications.$inferSelect;
export const insertDataClassificationSchema = createInsertSchema(dataClassifications).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDataClassification = z.infer<typeof insertDataClassificationSchema>;

// ==================== إشعارات الخصوصية ====================
export const privacyNotices = pgTable("privacy_notices", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 20 }).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  contentEn: text("content_en").notNull(),
  contentAr: text("content_ar").notNull(),
  purposes: json("purposes").$type<string[]>().default([]),
  dataCategories: json("data_categories").$type<string[]>().default([]),
  retentionPeriods: json("retention_periods"),
  thirdPartySharing: boolean("third_party_sharing").default(false).notNull(),
  crossBorderTransfers: boolean("cross_border_transfers").default(false).notNull(),
  dataSubjectRights: json("data_subject_rights").$type<string[]>().default([]),
  dpoName: varchar("dpo_name", { length: 200 }),
  dpoEmail: varchar("dpo_email", { length: 320 }),
  contactAddress: text("contact_address"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PrivacyNotice = typeof privacyNotices.$inferSelect;
export const insertPrivacyNoticeSchema = createInsertSchema(privacyNotices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrivacyNotice = z.infer<typeof insertPrivacyNoticeSchema>;

// ==================== علاقات الامتثال ====================
export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  dataSubject: one(users, { fields: [consentRecords.dataSubjectId], references: [users.id] }),
}));

export const dataSubjectRequestsRelations = relations(dataSubjectRequests, ({ one }) => ({
  assignee: one(users, { fields: [dataSubjectRequests.assignedTo], references: [users.id] }),
}));

export const dataBreachesRelations = relations(dataBreaches, ({ one }) => ({
  investigator: one(users, { fields: [dataBreaches.leadInvestigator], references: [users.id] }),
  reporter: one(users, { fields: [dataBreaches.reportedBy], references: [users.id] }),
}));

export const processingRecordsRelations = relations(processingRecords, ({ one }) => ({
  responsibleUser: one(users, { fields: [processingRecords.responsible], references: [users.id] }),
  creator: one(users, { fields: [processingRecords.createdBy], references: [users.id] }),
}));

export const ndmoAssessmentsRelations = relations(ndmoAssessments, ({ one }) => ({
  assessor: one(users, { fields: [ndmoAssessments.assessedBy], references: [users.id] }),
}));

export const dataClassificationsRelations = relations(dataClassifications, ({ one }) => ({
  approver: one(users, { fields: [dataClassifications.approvedBy], references: [users.id] }),
  owner: one(users, { fields: [dataClassifications.dataOwner], references: [users.id] }),
  custodian: one(users, { fields: [dataClassifications.dataCustodian], references: [users.id] }),
}));

export const privacyNoticesRelations = relations(privacyNotices, ({ one }) => ({
  creator: one(users, { fields: [privacyNotices.createdBy], references: [users.id] }),
  approver: one(users, { fields: [privacyNotices.approvedBy], references: [users.id] }),
}));

// ==================== Webhooks للتكامل الخارجي ====================
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 500 }).notNull(),
  events: json("events").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  headers: json("headers").$type<Record<string, string>>().default({}),
  retryPolicy: json("retry_policy").$type<{ maxRetries: number; retryDelay: number }>().default({ maxRetries: 3, retryDelay: 1000 }),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: varchar("last_delivery_status", { length: 50 }),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

// ==================== سجلات تسليم Webhooks ====================
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: varchar("event", { length: 100 }).notNull(),
  payload: json("payload"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  duration: integer("duration"),
  success: boolean("success").default(false).notNull(),
  errorMessage: text("error_message"),
  attemptNumber: integer("attempt_number").default(1).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  creator: one(users, { fields: [webhooks.createdBy], references: [users.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, { fields: [webhookDeliveries.webhookId], references: [webhooks.id] }),
}));

// ==================== طلبات المميزات والتحسينات ====================
export const featureRequests = pgTable("feature_requests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'feature' | 'bug' | 'incomplete'
  priority: varchar("priority", { length: 30 }).default('medium').notNull(), // 'low' | 'medium' | 'high' | 'critical'
  status: varchar("status", { length: 30 }).default('pending').notNull(), // 'pending' | 'in_review' | 'approved' | 'in_progress' | 'completed' | 'rejected'
  portal: varchar("portal", { length: 50 }).notNull(),
  submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
  submitterName: varchar("submitter_name", { length: 200 }).notNull(),
  submitterEmail: varchar("submitter_email", { length: 200 }).notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type FeatureRequest = typeof featureRequests.$inferSelect;
export const insertFeatureRequestSchema = createInsertSchema(featureRequests).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true });
export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;

export const featureRequestsRelations = relations(featureRequests, ({ one }) => ({
  submitter: one(users, { fields: [featureRequests.submittedBy], references: [users.id] }),
}));

// ==================== الضوابط والمواصفات التنظيمية ====================
export const regulatoryControls = pgTable("regulatory_controls", {
  id: serial("id").primaryKey(),
  controlNumber: varchar("control_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 200 }),
  subcategory: varchar("subcategory", { length: 200 }),
  domain: varchar("domain", { length: 200 }),
  regulatoryBody: varchar("regulatory_body", { length: 100 }).notNull(),
  portal: varchar("portal", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default('not_started').notNull(),
  completionPercentage: integer("completion_percentage").default(0),
  assignedTo: varchar("assigned_to", { length: 200 }),
  evidence: text("evidence"),
  notes: text("notes"),
  priority: varchar("priority", { length: 30 }).default('medium'),
  dueDate: timestamp("due_date"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type RegulatoryControl = typeof regulatoryControls.$inferSelect;
export const insertRegulatoryControlSchema = createInsertSchema(regulatoryControls).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRegulatoryControl = z.infer<typeof insertRegulatoryControlSchema>;

export const regulatoryControlsRelations = relations(regulatoryControls, ({ one }) => ({
  creator: one(users, { fields: [regulatoryControls.createdBy], references: [users.id] }),
}));

// ==================== نظام التخطيط (Planner) - لوحات كانبان ====================
export const plannerBoards = pgTable("planner_boards", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  portal: varchar("portal", { length: 50 }).notNull(),
  departmentId: integer("department_id"),
  color: varchar("color", { length: 30 }).default('#1e3a5f'),
  icon: varchar("icon", { length: 50 }),
  isDefault: integer("is_default").default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PlannerBoard = typeof plannerBoards.$inferSelect;
export const insertPlannerBoardSchema = createInsertSchema(plannerBoards).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlannerBoard = z.infer<typeof insertPlannerBoardSchema>;

export const plannerBuckets = pgTable("planner_buckets", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => plannerBoards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  color: varchar("color", { length: 30 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PlannerBucket = typeof plannerBuckets.$inferSelect;
export const insertPlannerBucketSchema = createInsertSchema(plannerBuckets).omit({ id: true, createdAt: true });
export type InsertPlannerBucket = z.infer<typeof insertPlannerBucketSchema>;

export const plannerTasks = pgTable("planner_tasks", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => plannerBoards.id, { onDelete: "cascade" }),
  bucketId: integer("bucket_id").notNull().references(() => plannerBuckets.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default('medium').notNull(),
  status: varchar("status", { length: 30 }).default('not_started').notNull(),
  progress: integer("progress").default(0).notNull(),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  completedAt: timestamp("completed_at"),
  labels: json("labels").$type<string[]>(),
  checklist: json("checklist").$type<{ text: string; checked: boolean }[]>(),
  attachments: json("attachments").$type<{ name: string; url: string; type: string; size: number; uploadedAt: string }[]>(),
  dependencies: json("dependencies").$type<number[]>(),
  recurrence: json("recurrence").$type<{ type: 'daily' | 'weekly' | 'monthly' | 'custom'; interval: number; daysOfWeek?: number[]; endDate?: string; nextDue?: string } | null>(),
  isTemplate: integer("is_template").default(0),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PlannerTask = typeof plannerTasks.$inferSelect;
export const insertPlannerTaskSchema = createInsertSchema(plannerTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlannerTask = z.infer<typeof insertPlannerTaskSchema>;

export const plannerComments = pgTable("planner_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => plannerTasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  type: varchar("type", { length: 30 }).default('comment').notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PlannerComment = typeof plannerComments.$inferSelect;
export const insertPlannerCommentSchema = createInsertSchema(plannerComments).omit({ id: true, createdAt: true });
export type InsertPlannerComment = z.infer<typeof insertPlannerCommentSchema>;

export const plannerBoardsRelations = relations(plannerBoards, ({ one, many }) => ({
  creator: one(users, { fields: [plannerBoards.createdBy], references: [users.id] }),
  buckets: many(plannerBuckets),
  tasks: many(plannerTasks),
}));

export const plannerBucketsRelations = relations(plannerBuckets, ({ one, many }) => ({
  board: one(plannerBoards, { fields: [plannerBuckets.boardId], references: [plannerBoards.id] }),
  tasks: many(plannerTasks),
}));

export const plannerTasksRelations = relations(plannerTasks, ({ one, many }) => ({
  board: one(plannerBoards, { fields: [plannerTasks.boardId], references: [plannerBoards.id] }),
  bucket: one(plannerBuckets, { fields: [plannerTasks.bucketId], references: [plannerBuckets.id] }),
  assignee: one(users, { fields: [plannerTasks.assignedTo], references: [users.id] }),
  creator: one(users, { fields: [plannerTasks.createdBy], references: [users.id] }),
  comments: many(plannerComments),
}));

export const plannerCommentsRelations = relations(plannerComments, ({ one }) => ({
  task: one(plannerTasks, { fields: [plannerComments.taskId], references: [plannerTasks.id] }),
  user: one(users, { fields: [plannerComments.userId], references: [users.id] }),
}));

// ==================== المفضلات - Bookmarks (per department) ====================
export const userBookmarks = pgTable("user_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  portal: varchar("portal", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  priority: varchar("priority", { length: 20 }),
  status: varchar("status", { length: 50 }),
  url: varchar("url", { length: 500 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserBookmark = typeof userBookmarks.$inferSelect;
export const insertUserBookmarkSchema = createInsertSchema(userBookmarks).omit({ id: true, createdAt: true });
export type InsertUserBookmark = z.infer<typeof insertUserBookmarkSchema>;

// ==================== ملاحظات سريعة - Quick Notes (per department) ====================
export const quickNotes = pgTable("quick_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  portal: varchar("portal", { length: 50 }).notNull(),
  content: text("content").notNull(),
  color: varchar("color", { length: 20 }).default('default'),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type QuickNote = typeof quickNotes.$inferSelect;
export const insertQuickNoteSchema = createInsertSchema(quickNotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuickNote = z.infer<typeof insertQuickNoteSchema>;

// ==================== المستشار الذكي - قاعدة المعرفة التنظيمية ====================
export const governanceFrameworks = pgTable("governance_frameworks", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 300 }).notNull(),
  nameEn: varchar("name_en", { length: 300 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  version: varchar("version", { length: 50 }),
  issuingBody: varchar("issuing_body", { length: 200 }),
  issuingBodyAr: varchar("issuing_body_ar", { length: 200 }),
  applicableTo: text("applicable_to"),
  totalDomains: integer("total_domains").default(0),
  totalControls: integer("total_controls").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GovernanceFramework = typeof governanceFrameworks.$inferSelect;

export const governanceDomains = pgTable("governance_domains", {
  id: serial("id").primaryKey(),
  frameworkId: integer("framework_id").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  nameAr: varchar("name_ar", { length: 300 }).notNull(),
  nameEn: varchar("name_en", { length: 300 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  sortOrder: integer("sort_order").default(0),
  parentDomainId: integer("parent_domain_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GovernanceDomain = typeof governanceDomains.$inferSelect;

export const governanceControls = pgTable("governance_controls", {
  id: serial("id").primaryKey(),
  frameworkId: integer("framework_id").notNull(),
  domainId: integer("domain_id").notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  nameAr: varchar("name_ar", { length: 500 }).notNull(),
  nameEn: varchar("name_en", { length: 500 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  objective: text("objective"),
  objectiveAr: text("objective_ar"),
  implementationGuide: text("implementation_guide"),
  implementationGuideAr: text("implementation_guide_ar"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  applicablePortals: json("applicable_portals"),
  tags: json("tags"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GovernanceControl = typeof governanceControls.$inferSelect;

export const advisorResponses = pgTable("advisor_responses", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  questionPattern: text("question_pattern").notNull(),
  keywords: json("keywords").notNull(),
  responseAr: text("response_ar").notNull(),
  responseEn: text("response_en"),
  relatedControlIds: json("related_control_ids"),
  relatedFrameworks: json("related_frameworks"),
  applicablePortals: json("applicable_portals"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type AdvisorResponse = typeof advisorResponses.$inferSelect;

export const governanceControlImplementations = pgTable("governance_control_implementations", {
  id: serial("id").primaryKey(),
  controlId: integer("control_id").notNull(),
  portal: varchar("portal", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("not_implemented"),
  notes: text("notes"),
  evidence: text("evidence"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GovernanceControlImplementation = typeof governanceControlImplementations.$inferSelect;

// ─── Alert Rules ────────────────────────────────────────────────────────────
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  metric: varchar("metric", { length: 100 }).notNull(),
  operator: varchar("operator", { length: 10 }).notNull().default(">"),
  threshold: integer("threshold").notNull(),
  itDepartmentId: integer("it_department_id").references(() => itDepartments.id),
  notifyRoles: json("notify_roles").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

// ─── Ticket Templates ────────────────────────────────────────────────────────
export const ticketTemplates = pgTable("ticket_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  itDepartmentId: integer("it_department_id").references(() => itDepartments.id),
  defaultPriority: varchar("default_priority", { length: 50 }).default("medium"),
  defaultCategory: varchar("default_category", { length: 100 }),
  defaultTitle: varchar("default_title", { length: 500 }),
  defaultDescription: text("default_description"),
  checklist: json("checklist").$type<{ item: string; required: boolean }[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type TicketTemplate = typeof ticketTemplates.$inferSelect;
export type InsertTicketTemplate = typeof ticketTemplates.$inferInsert;

// ─── Automation Rules ────────────────────────────────────────────────────────
export const automationRules = pgTable("automation_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 100 }).notNull(),
  triggerValue: varchar("trigger_value", { length: 255 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  actionValue: varchar("action_value", { length: 255 }),
  itDepartmentId: integer("it_department_id").references(() => itDepartments.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

// ─── External Data Sharing Requests Register ─────────────────────────────────
export const externalDataSharingRequests = pgTable("external_data_sharing_requests", {
  id: serial("id").primaryKey(),
  requestNumber: varchar("request_number", { length: 50 }).notNull().unique(),
  externalPartyName: varchar("external_party_name", { length: 255 }).notNull(),
  externalPartyType: varchar("external_party_type", { length: 100 }).notNull().default("government"),
  externalPartyContact: varchar("external_party_contact", { length: 255 }),
  sharingDirection: varchar("sharing_direction", { length: 20 }).notNull().default("outbound"),
  dataAssets: text("data_assets").notNull(),
  purpose: text("purpose").notNull(),
  legalBasis: varchar("legal_basis", { length: 100 }).notNull().default("legal_obligation"),
  securityMeasures: text("security_measures"),
  conditions: text("conditions"),
  requestDate: timestamp("request_date").notNull(),
  approvalDate: timestamp("approval_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  referenceDoc: varchar("reference_doc", { length: 255 }),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ExternalDataSharingRequest = typeof externalDataSharingRequests.$inferSelect;
export type InsertExternalDataSharingRequest = typeof externalDataSharingRequests.$inferInsert;

export const tokenBlacklist = pgTable("token_blacklist", {
  id: serial("id").primaryKey(),
  tokenJti: varchar("token_jti", { length: 100 }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).default("logout"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TokenBlacklist = typeof tokenBlacklist.$inferSelect;

export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  toEmail: varchar("to_email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlBody: text("html_body").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  nextRetryAt: timestamp("next_retry_at"),
});
export type EmailQueue = typeof emailQueue.$inferSelect;

export const integrationConfigs = pgTable("integration_configs", {
  id: serial("id").primaryKey(),
  integrationType: varchar("integration_type", { length: 50 }).notNull().unique(),
  config: json("config").notNull().$type<Record<string, any>>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
});
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
