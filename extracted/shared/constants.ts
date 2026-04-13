/**
 * Control Hub - Shared Constants
 * الثوابت المشتركة - مركز التحكم
 * نادي سباقات الخيل (JCSA)
 * 
 * Production-Ready MySQL Version
 * الإصدار الإنتاجي - قاعدة بيانات MySQL
 */

// ==================== User Roles - أدوار المستخدمين ====================
export const USER_ROLES = {
  // System Administration - إدارة النظام
  SYSTEM_ADMIN: 'system_admin',
  
  // IT Management - المدير العام لتقنية المعلومات
  IT_DIRECTOR: 'it_director',
  
  // IT Department Managers - مدراء الإدارات التقنية الأربعة
  IT_INFRASTRUCTURE_MANAGER: 'it_infrastructure_manager',
  IT_CYBERSECURITY_MANAGER: 'it_cybersecurity_manager',
  IT_DIGITAL_MANAGER: 'it_digital_manager',
  IT_SUPPORT_MANAGER: 'it_support_manager',
  
  // IT Department Staff - موظفي الإدارات التقنية الأربعة
  IT_INFRASTRUCTURE_STAFF: 'it_infrastructure_staff',
  IT_CYBERSECURITY_STAFF: 'it_cybersecurity_staff',
  IT_DIGITAL_STAFF: 'it_digital_staff',
  IT_SUPPORT_STAFF: 'it_support_staff',
  
  // DMO - مكتب إدارة البيانات
  DMO_MANAGER: 'dmo_manager',
  DMO_STAFF: 'dmo_staff',
  
  // Data Governance - حوكمة البيانات
  DATA_STEWARD: 'data_steward',
  DATA_REPRESENTATIVE: 'data_representative',
  
  // Committee - اللجنة
  COMMITTEE_CHAIRMAN: 'committee_chairman',
  COMMITTEE_VICE_CHAIRMAN: 'committee_vice_chairman',
  COMMITTEE_RAPPORTEUR: 'committee_rapporteur',
  COMMITTEE_MEMBER: 'committee_member',
  
  // Auditor - المدقق
  AUDITOR: 'auditor',
  
  // General - عام
  EMPLOYEE: 'employee',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// ==================== User Portals - بوابات المستخدمين (10 بوابات) ====================
export const USER_PORTALS = {
  ADMIN: 'admin',                    // بوابة الإدارة
  IT_DIRECTOR: 'it_director',        // بوابة المدير العام لتقنية المعلومات
  IT_DEPARTMENT: 'it_department',    // بوابة إدارات تقنية المعلومات
  CYBERSECURITY: 'cybersecurity',    // بوابة الأمن السيبراني
  DMO: 'dmo',                        // بوابة مكتب إدارة البيانات
  COMMITTEE: 'committee',            // بوابة اللجنة
  DATA_REP: 'data_rep',              // بوابة ممثل البيانات
  STEWARD: 'steward',                // بوابة أمين البيانات
  AUDITOR: 'auditor',                // بوابة المدقق
  EMPLOYEE: 'employee',              // بوابة الموظفين العامة
} as const;

export type UserPortal = typeof USER_PORTALS[keyof typeof USER_PORTALS];

// ==================== Portal Access Groups - مجموعات الوصول للبوابات ====================
// كل بوابة مخصصة فقط لمستخدميها - IT Director يمكنه الوصول لجميع البوابات
export const PORTAL_ACCESS = {
  // Admin portal - فقط مدير النظام
  ADMIN_PORTALS: ['admin'] as string[],
  
  // IT Director can access ALL IT portals + DMO - المدير العام يصل لجميع بوابات تقنية المعلومات ومكتب إدارة البيانات
  IT_DIRECTOR_PORTALS: ['it_director', 'infrastructure', 'cybersecurity', 'digital_transformation', 'support', 'dmo'] as string[],
  
  // DMO portal - مكتب إدارة البيانات + IT Director + ممثل البيانات + أمين البيانات
  DMO_PORTALS: ['dmo', 'it_director', 'data_rep', 'steward'] as string[],
  
  // Committee portal - اللجنة + DMO (لأن صفحات اللجنة موجودة في بوابة DMO)
  COMMITTEE_PORTALS: ['committee', 'dmo', 'it_director'] as string[],
  
  // Data Representative - ممثل البيانات + DMO + IT Director
  DATA_REP_PORTALS: ['data_rep', 'dmo', 'it_director'] as string[],
  
  // Data Steward - أمين البيانات + DMO + IT Director
  STEWARD_PORTALS: ['steward', 'dmo', 'it_director'] as string[],
  
  // IT Departments - كل إدارة لموظفيها فقط + IT Director
  INFRASTRUCTURE_PORTALS: ['infrastructure', 'it_director'] as string[],
  CYBERSECURITY_PORTALS: ['cybersecurity', 'it_director'] as string[],
  DIGITAL_TRANSFORMATION_PORTALS: ['digital_transformation', 'it_director'] as string[],
  SUPPORT_PORTALS: ['support', 'it_director'] as string[],
  
  // Legacy support
  DEPARTMENT_PORTALS: ['it_department', 'it_director', 'infrastructure', 'cybersecurity', 'digital_transformation', 'support'] as string[],
  
  // Employee portal - الموظفين العاديين
  EMPLOYEE_PORTALS: ['employee'] as string[],
} as const;

// ==================== IT Department Portals - بوابات الإدارات التقنية (منفصلة) ====================
export const IT_DEPT_PORTALS = {
  INFRASTRUCTURE: 'infrastructure',      // بوابة البنية التحتية
  CYBERSECURITY: 'cybersecurity',        // بوابة الأمن السيبراني
  DIGITAL_TRANSFORMATION: 'digital_transformation', // بوابة التحول الرقمي
  SUPPORT: 'support',                    // بوابة الدعم الفني
} as const;

// ==================== Role to Portal Mapping - ربط الأدوار بالبوابات (تلقائي) ====================
export const ROLE_TO_PORTAL: Record<string, string> = {
  // System Admin - مدير النظام
  [USER_ROLES.SYSTEM_ADMIN]: USER_PORTALS.ADMIN,
  
  // IT Director - المدير العام لتقنية المعلومات (يصل لجميع البوابات)
  [USER_ROLES.IT_DIRECTOR]: USER_PORTALS.IT_DIRECTOR,
  
  // Infrastructure - البنية التحتية (مدير وموظفين)
  [USER_ROLES.IT_INFRASTRUCTURE_MANAGER]: IT_DEPT_PORTALS.INFRASTRUCTURE,
  [USER_ROLES.IT_INFRASTRUCTURE_STAFF]: IT_DEPT_PORTALS.INFRASTRUCTURE,
  
  // Cybersecurity - الأمن السيبراني (مدير وموظفين)
  [USER_ROLES.IT_CYBERSECURITY_MANAGER]: IT_DEPT_PORTALS.CYBERSECURITY,
  [USER_ROLES.IT_CYBERSECURITY_STAFF]: IT_DEPT_PORTALS.CYBERSECURITY,
  
  // Digital Transformation - التحول الرقمي (مدير وموظفين)
  [USER_ROLES.IT_DIGITAL_MANAGER]: IT_DEPT_PORTALS.DIGITAL_TRANSFORMATION,
  [USER_ROLES.IT_DIGITAL_STAFF]: IT_DEPT_PORTALS.DIGITAL_TRANSFORMATION,
  
  // Technical Support - الدعم الفني (مدير وموظفين)
  [USER_ROLES.IT_SUPPORT_MANAGER]: IT_DEPT_PORTALS.SUPPORT,
  [USER_ROLES.IT_SUPPORT_STAFF]: IT_DEPT_PORTALS.SUPPORT,
  
  // DMO - مكتب إدارة البيانات (مدير وموظفين)
  [USER_ROLES.DMO_MANAGER]: USER_PORTALS.DMO,
  [USER_ROLES.DMO_STAFF]: USER_PORTALS.DMO,
  
  // Data Governance - حوكمة البيانات
  [USER_ROLES.DATA_STEWARD]: USER_PORTALS.STEWARD,
  [USER_ROLES.DATA_REPRESENTATIVE]: USER_PORTALS.DATA_REP,
  
  // Committee - اللجنة (رئيس، نائب، مقرر، أعضاء)
  [USER_ROLES.COMMITTEE_CHAIRMAN]: USER_PORTALS.COMMITTEE,
  [USER_ROLES.COMMITTEE_VICE_CHAIRMAN]: USER_PORTALS.COMMITTEE,
  [USER_ROLES.COMMITTEE_RAPPORTEUR]: USER_PORTALS.COMMITTEE,
  [USER_ROLES.COMMITTEE_MEMBER]: USER_PORTALS.COMMITTEE,
  
  // Auditor - المدقق
  [USER_ROLES.AUDITOR]: USER_PORTALS.AUDITOR,
  
  // Employee - الموظفين العاديين
  [USER_ROLES.EMPLOYEE]: USER_PORTALS.EMPLOYEE,
};

// ==================== Default Routes by Portal - المسارات الافتراضية حسب البوابة ====================
export const DEFAULT_ROUTES: Record<string, string> = {
  // Admin Portal
  [USER_PORTALS.ADMIN]: '/admin',
  
  // IT Director Portal
  [USER_PORTALS.IT_DIRECTOR]: '/it-director',
  
  // IT Department Portals (Separate) - كل إدارة لها مسار خاص
  [IT_DEPT_PORTALS.INFRASTRUCTURE]: '/department/infrastructure',
  [IT_DEPT_PORTALS.CYBERSECURITY]: '/department/cybersecurity',
  [IT_DEPT_PORTALS.DIGITAL_TRANSFORMATION]: '/department/digital-transformation',
  [IT_DEPT_PORTALS.SUPPORT]: '/department/support',
  
  // Legacy IT Department (fallback)
  [USER_PORTALS.IT_DEPARTMENT]: '/department/infrastructure',
  
  // DMO Portal
  [USER_PORTALS.DMO]: '/dmo',
  
  // Committee Portal
  [USER_PORTALS.COMMITTEE]: '/committee',
  
  // Data Governance Portals
  [USER_PORTALS.DATA_REP]: '/data-representative',
  [USER_PORTALS.STEWARD]: '/steward',
  
  // Auditor Portal
  [USER_PORTALS.AUDITOR]: '/auditor',
  
  // Employee Portal
  [USER_PORTALS.EMPLOYEE]: '/employee',
};

// ==================== Department IDs - معرفات الإدارات ====================
export const DEPARTMENT_IDS = {
  INFRASTRUCTURE: 1,
  CYBERSECURITY: 2,
  DIGITAL_TRANSFORMATION: 3,
  SUPPORT: 4,
  DMO: 5,
} as const;

// ==================== IT Department Types - أنواع إدارات تقنية المعلومات ====================
export const IT_DEPARTMENT_TYPES = {
  INFRASTRUCTURE: 'infrastructure',
  CYBERSECURITY: 'cybersecurity',
  DIGITAL_TRANSFORMATION: 'digital_transformation',
  SUPPORT: 'support',
} as const;

// ==================== Roles with Audit Log Access - الأدوار ذات صلاحية سجلات المراجعة ====================
export const AUDIT_LOG_ACCESS_ROLES = [
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.IT_DIRECTOR,
  USER_ROLES.DMO_MANAGER,
] as const;

// ==================== Request Status - حالات الطلبات ====================
export const REQUEST_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  APPROVED: 'approved',
} as const;

export type RequestStatus = typeof REQUEST_STATUS[keyof typeof REQUEST_STATUS];

// ==================== Priority Levels - مستويات الأولوية ====================
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

// ==================== Compliance Domains - مجالات الامتثال (15 مجال) ====================
export const COMPLIANCE_DOMAINS = {
  DATA_GOVERNANCE: 'data_governance',
  DATA_QUALITY: 'data_quality',
  DATA_SECURITY: 'data_security',
  DATA_PRIVACY: 'data_privacy',
  DATA_ARCHITECTURE: 'data_architecture',
  METADATA_MANAGEMENT: 'metadata_management',
  MASTER_DATA: 'master_data',
  DATA_INTEGRATION: 'data_integration',
  BUSINESS_INTELLIGENCE: 'business_intelligence',
  DATA_WAREHOUSING: 'data_warehousing',
  REFERENCE_DATA: 'reference_data',
  DATA_LIFECYCLE: 'data_lifecycle',
  DATA_OPERATIONS: 'data_operations',
  REGULATORY_COMPLIANCE: 'regulatory_compliance',
  DATA_ETHICS: 'data_ethics',
} as const;

// ==================== Arabic Labels - التسميات العربية ====================
export const ARABIC_LABELS = {
  // Roles - الأدوار
  ROLES: {
    [USER_ROLES.SYSTEM_ADMIN]: 'مدير النظام',
    [USER_ROLES.IT_DIRECTOR]: 'المدير العام لتقنية المعلومات والتحول الرقمي',
    [USER_ROLES.IT_INFRASTRUCTURE_MANAGER]: 'مدير إدارة البنية التحتية والشبكات',
    [USER_ROLES.IT_CYBERSECURITY_MANAGER]: 'مدير إدارة الأمن السيبراني',
    [USER_ROLES.IT_DIGITAL_MANAGER]: 'مدير إدارة التحول الرقمي',
    [USER_ROLES.IT_SUPPORT_MANAGER]: 'مدير إدارة الدعم الفني',
    [USER_ROLES.IT_INFRASTRUCTURE_STAFF]: 'موظف البنية التحتية والشبكات',
    [USER_ROLES.IT_CYBERSECURITY_STAFF]: 'موظف الأمن السيبراني',
    [USER_ROLES.IT_DIGITAL_STAFF]: 'موظف التحول الرقمي',
    [USER_ROLES.IT_SUPPORT_STAFF]: 'موظف الدعم الفني',
    [USER_ROLES.DMO_MANAGER]: 'مدير مكتب إدارة البيانات',
    [USER_ROLES.DMO_STAFF]: 'موظف مكتب إدارة البيانات',
    [USER_ROLES.DATA_STEWARD]: 'أمين البيانات',
    [USER_ROLES.DATA_REPRESENTATIVE]: 'ممثل البيانات',
    [USER_ROLES.COMMITTEE_CHAIRMAN]: 'رئيس اللجنة',
    [USER_ROLES.COMMITTEE_VICE_CHAIRMAN]: 'نائب رئيس اللجنة',
    [USER_ROLES.COMMITTEE_RAPPORTEUR]: 'مقرر اللجنة',
    [USER_ROLES.COMMITTEE_MEMBER]: 'عضو اللجنة',
    [USER_ROLES.EMPLOYEE]: 'موظف',
  } as Record<string, string>,
  
  // Portals - البوابات
  PORTALS: {
    [USER_PORTALS.ADMIN]: 'بوابة الإدارة',
    [USER_PORTALS.IT_DIRECTOR]: 'بوابة مدير تقنية المعلومات',
    [USER_PORTALS.IT_DEPARTMENT]: 'بوابة إدارة تقنية المعلومات',
    [USER_PORTALS.CYBERSECURITY]: 'بوابة الأمن السيبراني',
    [USER_PORTALS.DMO]: 'بوابة مكتب إدارة البيانات',
    [USER_PORTALS.COMMITTEE]: 'بوابة اللجنة',
    [USER_PORTALS.DATA_REP]: 'بوابة ممثل البيانات',
    [USER_PORTALS.STEWARD]: 'بوابة أمين البيانات',
    [USER_PORTALS.EMPLOYEE]: 'بوابة الموظفين',
  } as Record<string, string>,
  
  // Status - الحالات
  STATUS: {
    [REQUEST_STATUS.PENDING]: 'قيد الانتظار',
    [REQUEST_STATUS.IN_PROGRESS]: 'قيد التنفيذ',
    [REQUEST_STATUS.COMPLETED]: 'مكتمل',
    [REQUEST_STATUS.CANCELLED]: 'ملغي',
    [REQUEST_STATUS.REJECTED]: 'مرفوض',
    [REQUEST_STATUS.APPROVED]: 'معتمد',
  } as Record<string, string>,
  
  // Priority - الأولوية
  PRIORITY: {
    [PRIORITY_LEVELS.LOW]: 'منخفضة',
    [PRIORITY_LEVELS.MEDIUM]: 'متوسطة',
    [PRIORITY_LEVELS.HIGH]: 'عالية',
    [PRIORITY_LEVELS.CRITICAL]: 'حرجة',
  } as Record<string, string>,

  // IT Departments - إدارات تقنية المعلومات
  IT_DEPARTMENTS: {
    [IT_DEPARTMENT_TYPES.INFRASTRUCTURE]: 'إدارة البنية التحتية والشبكات',
    [IT_DEPARTMENT_TYPES.CYBERSECURITY]: 'إدارة الأمن السيبراني',
    [IT_DEPARTMENT_TYPES.DIGITAL_TRANSFORMATION]: 'إدارة التحول الرقمي والتطبيقات',
    [IT_DEPARTMENT_TYPES.SUPPORT]: 'إدارة الدعم الفني',
  } as Record<string, string>,

  // Compliance Domains - مجالات الامتثال
  DOMAINS: {
    [COMPLIANCE_DOMAINS.DATA_GOVERNANCE]: 'حوكمة البيانات',
    [COMPLIANCE_DOMAINS.DATA_QUALITY]: 'جودة البيانات',
    [COMPLIANCE_DOMAINS.DATA_SECURITY]: 'أمن البيانات',
    [COMPLIANCE_DOMAINS.DATA_PRIVACY]: 'خصوصية البيانات',
    [COMPLIANCE_DOMAINS.DATA_ARCHITECTURE]: 'هندسة البيانات',
    [COMPLIANCE_DOMAINS.METADATA_MANAGEMENT]: 'إدارة البيانات الوصفية',
    [COMPLIANCE_DOMAINS.MASTER_DATA]: 'البيانات الرئيسية',
    [COMPLIANCE_DOMAINS.DATA_INTEGRATION]: 'تكامل البيانات',
    [COMPLIANCE_DOMAINS.BUSINESS_INTELLIGENCE]: 'ذكاء الأعمال',
    [COMPLIANCE_DOMAINS.DATA_WAREHOUSING]: 'مستودعات البيانات',
    [COMPLIANCE_DOMAINS.REFERENCE_DATA]: 'البيانات المرجعية',
    [COMPLIANCE_DOMAINS.DATA_LIFECYCLE]: 'دورة حياة البيانات',
    [COMPLIANCE_DOMAINS.DATA_OPERATIONS]: 'عمليات البيانات',
    [COMPLIANCE_DOMAINS.REGULATORY_COMPLIANCE]: 'الامتثال التنظيمي',
    [COMPLIANCE_DOMAINS.DATA_ETHICS]: 'أخلاقيات البيانات',
  } as Record<string, string>,
} as const;

// ==================== Helper Functions - دوال مساعدة ====================

/**
 * Get portal for role automatically - الحصول على البوابة تلقائياً حسب الدور
 */
export function getPortalForRole(role: string): string {
  return ROLE_TO_PORTAL[role] || USER_PORTALS.EMPLOYEE;
}

/**
 * Check if a role has access to audit logs - التحقق من صلاحية الوصول لسجلات المراجعة
 */
export function hasAuditLogAccess(role: string): boolean {
  return AUDIT_LOG_ACCESS_ROLES.includes(role as any);
}

/**
 * Get default route for a portal - الحصول على المسار الافتراضي للبوابة
 */
export function getPortalDefaultRoute(portal: string): string {
  return DEFAULT_ROUTES[portal] || '/login';
}

/**
 * Check if a portal has access to a protected area - التحقق من صلاحية الوصول لمنطقة محمية
 * Admin portal has access to ALL portals - بوابة المسؤول لها صلاحية الوصول لجميع البوابات
 */
export function hasPortalAccess(userPortal: string, allowedPortals: string[]): boolean {
  // Admin has access to ALL portals
  if (userPortal === 'admin') {
    return true;
  }
  return allowedPortals.includes(userPortal);
}

/**
 * Get Arabic label for role - الحصول على التسمية العربية للدور
 */
export function getRoleLabel(role: string): string {
  return ARABIC_LABELS.ROLES[role] || role;
}

/**
 * Get Arabic label for portal - الحصول على التسمية العربية للبوابة
 */
export function getPortalLabel(portal: string): string {
  return ARABIC_LABELS.PORTALS[portal] || portal;
}

/**
 * Get Arabic label for status - الحصول على التسمية العربية للحالة
 */
export function getStatusLabel(status: string): string {
  return ARABIC_LABELS.STATUS[status] || status;
}

/**
 * Get Arabic label for priority - الحصول على التسمية العربية للأولوية
 */
export function getPriorityLabel(priority: string): string {
  return ARABIC_LABELS.PRIORITY[priority] || priority;
}

/**
 * Get Arabic label for IT department - الحصول على التسمية العربية لإدارة تقنية المعلومات
 */
export function getITDepartmentLabel(dept: string): string {
  return ARABIC_LABELS.IT_DEPARTMENTS[dept] || dept;
}

/**
 * Get Arabic label for compliance domain - الحصول على التسمية العربية لمجال الامتثال
 */
export function getDomainLabel(domain: string): string {
  return ARABIC_LABELS.DOMAINS[domain] || domain;
}

/**
 * Check if user is admin - التحقق إذا المستخدم مدير نظام
 */
export function isSystemAdmin(role: string): boolean {
  return role === USER_ROLES.SYSTEM_ADMIN;
}

/**
 * Check if user is IT Director - التحقق إذا المستخدم مدير تقنية المعلومات
 */
export function isITDirector(role: string): boolean {
  return role === USER_ROLES.IT_DIRECTOR;
}

/**
 * Check if user is IT Manager - التحقق إذا المستخدم مدير إدارة تقنية
 */
export function isITManager(role: string): boolean {
  return [
    USER_ROLES.IT_INFRASTRUCTURE_MANAGER,
    USER_ROLES.IT_CYBERSECURITY_MANAGER,
    USER_ROLES.IT_DIGITAL_MANAGER,
    USER_ROLES.IT_SUPPORT_MANAGER,
  ].includes(role as any);
}

/**
 * Check if user is DMO staff - التحقق إذا المستخدم من مكتب إدارة البيانات
 */
export function isDMOStaff(role: string): boolean {
  return [USER_ROLES.DMO_MANAGER, USER_ROLES.DMO_STAFF].includes(role as any);
}

/**
 * Check if user is committee member - التحقق إذا المستخدم عضو لجنة
 */
export function isCommitteeMember(role: string): boolean {
  return [
    USER_ROLES.COMMITTEE_CHAIRMAN,
    USER_ROLES.COMMITTEE_VICE_CHAIRMAN,
    USER_ROLES.COMMITTEE_RAPPORTEUR,
    USER_ROLES.COMMITTEE_MEMBER,
  ].includes(role as any);
}

/**
 * Get all roles as array - الحصول على جميع الأدوار كمصفوفة
 */
export function getAllRoles(): string[] {
  return Object.values(USER_ROLES);
}

/**
 * Get all portals as array - الحصول على جميع البوابات كمصفوفة
 */
export function getAllPortals(): string[] {
  return Object.values(USER_PORTALS);
}

// ==================== Production Configuration - إعدادات الإنتاج ====================
export const PRODUCTION_CONFIG = {
  APP_NAME: 'Control Hub',
  APP_NAME_AR: 'Control Hub',
  ORGANIZATION: 'نادي سباقات الخيل',
  ORGANIZATION_EN: 'Horse Racing Club',
  DOMAIN: 'controlhub.jcsa.sa',
  VERSION: '2.0.0',
  DATABASE: 'MySQL',
  THEME: {
    NAVY: 'hsl(222, 47%, 11%)',
    GOLD: 'hsl(43, 74%, 49%)',
  },
} as const;

export const SLA_HOURS: Record<string, number> = {
  critical: 4,
  urgent: 4,
  high: 8,
  medium: 24,
  low: 72,
};

export const SLA_MINUTES: Record<string, number> = {
  critical: 240,
  urgent: 240,
  high: 480,
  medium: 1440,
  low: 4320,
};

export const PRIORITIES = ['critical', 'urgent', 'high', 'medium', 'low'] as const;
export type Priority = typeof PRIORITIES[number];

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل التذاكر — IT Ticket Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: إدارة دورة حياة تذاكر الدعم الفني من الفتح حتى الإغلاق
// لماذا: ضمان معالجة منظمة لكل طلب، مع تتبع SLA ومنع التراجع العشوائي
//
// المسار المنطقي:
//   open ─→ assigned ─→ in_progress ─→ resolved ─→ closed
//                    ↕                ↕
//                  pending ←──────→ pending
//
// open       → التذكرة مفتوحة جديدة — بانتظار التوزيع. يخدم: استقبال الطلب وتسجيله.
// assigned   → تم تعيين مسؤول — الفني يعرف أن لديه مهمة. يخدم: المساءلة وتوزيع العمل.
// in_progress→ العمل جارٍ فعلياً — بدأ الحل. يخدم: شفافية التقدم وقياس وقت المعالجة.
// pending    → معلّقة لسبب خارجي (انتظار قطعة/رد عميل). يخدم: إيقاف ساعة SLA مؤقتاً.
// resolved   → تم الحل — بانتظار تأكيد المستخدم أو الإغلاق التلقائي. يخدم: ضمان رضا المستفيد.
// closed     → مغلقة نهائياً — لا تعديل. يخدم: حفظ السجل وإحصائيات الأداء.
// ══════════════════════════════════════════════════════════════════════════════
export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

export const TICKET_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'pending', 'closed'],
  in_progress: ['pending', 'resolved', 'closed'],
  pending: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export const TICKET_TRANSITION_REASONS: Record<string, Record<string, string>> = {
  open: {
    assigned: 'تم تعيين فني مسؤول عن التذكرة',
    in_progress: 'بدء العمل المباشر على التذكرة (دون تعيين مسبق)',
    closed: 'إغلاق مباشر — تذكرة مكررة أو لا تحتاج معالجة',
  },
  assigned: {
    in_progress: 'الفني بدأ العمل الفعلي على المشكلة',
    pending: 'معلقة بانتظار معلومات إضافية أو موارد خارجية',
    closed: 'إغلاق — لم تعد ذات صلة بعد التعيين',
  },
  in_progress: {
    pending: 'العمل متوقف مؤقتاً — بانتظار رد أو قطعة غيار',
    resolved: 'تم حل المشكلة بنجاح — بانتظار تأكيد المستفيد',
    closed: 'إغلاق مباشر بدون مرحلة الحل (حالات استثنائية)',
  },
  pending: {
    in_progress: 'وصلت المعلومات/الموارد المطلوبة — استئناف العمل',
    resolved: 'تم الحل أثناء فترة الانتظار',
    closed: 'إغلاق — المستفيد ألغى الطلب أثناء الانتظار',
  },
  resolved: {
    closed: 'المستفيد أكّد الحل — إغلاق نهائي',
    in_progress: 'المستفيد أبلغ أن المشكلة لم تُحل — إعادة فتح',
  },
  closed: {},
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل المهام — IT Task Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: تتبع المهام التشغيلية والمشاريع الصغيرة داخل كل إدارة
// لماذا: ضمان إنجاز العمل المخطط بجودة عالية مع مراجعة قبل الإغلاق
//
// المسار المنطقي:
//   open ─→ assigned ─→ in_progress ─→ review ─→ completed ─→ archived
//                    ↕                ↕
//                  pending         cancelled ←→ open (إعادة فتح)
//
// open       → مهمة جديدة مسجلة — بانتظار التوزيع. يخدم: حصر المهام وتحديد الأولويات.
// assigned   → تم تكليف موظف — المسؤولية واضحة. يخدم: توزيع العمل والمساءلة.
// in_progress→ التنفيذ جارٍ. يخدم: متابعة التقدم ومنع التأخير.
// pending    → معلقة لسبب خارجي (اعتماد مالي/رد من جهة). يخدم: تمييز التأخير الخارجي.
// review     → تمت — بانتظار مراجعة المدير. يخدم: ضمان الجودة قبل اعتبارها مكتملة.
// completed  → مكتملة ومعتمدة. يخدم: تسجيل الإنجاز وقياس الإنتاجية.
// cancelled  → ملغاة — يمكن إعادة فتحها. يخدم: تتبع المهام التي ألغيت ولماذا.
// archived   → محفوظة للسجل — لا تعديل. يخدم: حفظ تاريخي ومنع الفوضى.
// ══════════════════════════════════════════════════════════════════════════════
export const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled', 'pending', 'assigned', 'review', 'archived'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'pending', 'cancelled'],
  in_progress: ['pending', 'review', 'completed', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  review: ['completed', 'in_progress'],
  completed: ['archived'],
  cancelled: ['open'],
  archived: [],
};

export const TASK_TRANSITION_REASONS: Record<string, Record<string, string>> = {
  open: {
    assigned: 'تم تكليف موظف بالمهمة',
    in_progress: 'بدء العمل مباشرة بدون مرحلة تعيين',
    cancelled: 'إلغاء المهمة — لم تعد مطلوبة',
  },
  assigned: {
    in_progress: 'الموظف بدأ التنفيذ الفعلي',
    pending: 'بانتظار موارد أو اعتمادات خارجية',
    cancelled: 'إلغاء بعد التعيين — تغيّرت الأولويات',
  },
  in_progress: {
    pending: 'توقف مؤقت — بانتظار رد أو اعتماد',
    review: 'اكتمل التنفيذ — بانتظار مراجعة المدير',
    completed: 'إكمال مباشر (مهام صغيرة لا تحتاج مراجعة)',
    cancelled: 'إلغاء أثناء التنفيذ',
  },
  pending: {
    in_progress: 'استئناف العمل — تم توفير المتطلبات',
    cancelled: 'إلغاء أثناء الانتظار',
  },
  review: {
    completed: 'المدير اعتمد — المهمة مكتملة',
    in_progress: 'المدير طلب تعديلات — تحتاج عمل إضافي',
  },
  completed: {
    archived: 'نقل للأرشيف — حفظ تاريخي',
  },
  cancelled: {
    open: 'إعادة فتح المهمة الملغاة — أصبحت مطلوبة مجدداً',
  },
  archived: {},
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل المشاريع — IT Project Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: إدارة دورة حياة المشاريع التقنية من التخطيط حتى التشغيل المستمر
// لماذا: المشاريع تمر بمراحل هندسية متميزة — كل مرحلة لها مخرجات ومعايير قبول
//
// المسار المنطقي:
//   planning ─→ review ─→ development ─→ testing ─→ deployed ─→ maintenance
//                                          ↕          ↕
//           in_progress ←─── on_hold ───→ cancelled   completed
//
// planning    → تجميع المتطلبات وتحديد النطاق والموارد. يخدم: منع البدء بدون خطة واضحة.
// review      → مراجعة فنية/لجنة للخطة قبل التنفيذ. يخدم: ضمان الجدوى والتوافق مع الاستراتيجية.
// development → بناء الحل التقني. يخدم: تتبع مرحلة البناء الفعلي.
// testing     → اختبار الجودة والقبول. يخدم: ضمان خلو الحل من العيوب قبل النشر.
// deployed    → تم النشر في بيئة الإنتاج. يخدم: تسجيل لحظة الإطلاق ومراقبة الاستقرار.
// in_progress → مرحلة عامة للعمل النشط (مشاريع لا تتبع مسار SDLC). يخدم: مرونة التصنيف.
// on_hold     → مجمّد مؤقتاً (ميزانية/أولويات). يخدم: تمييز التأخير المتعمد.
// completed   → المشروع مكتمل ومسلّم. يخدم: قياس الإنجاز وإغلاق الملف.
// cancelled   → ملغى — يمكن إعادته للتخطيط. يخدم: حفظ سبب الإلغاء والدروس المستفادة.
// maintenance → صيانة مستمرة بعد النشر. يخدم: تتبع الدعم والتحديثات بعد الإطلاق.
// ══════════════════════════════════════════════════════════════════════════════
export const PROJECT_STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled', 'review', 'development', 'testing', 'deployed', 'maintenance'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const PROJECT_STATUS_TRANSITIONS: Record<string, string[]> = {
  planning: ['in_progress', 'cancelled', 'review'],
  review: ['planning', 'development', 'cancelled'],
  development: ['testing', 'on_hold', 'cancelled'],
  testing: ['development', 'deployed', 'on_hold', 'cancelled'],
  deployed: ['maintenance', 'in_progress'],
  in_progress: ['on_hold', 'completed', 'cancelled', 'review', 'testing'],
  on_hold: ['in_progress', 'cancelled'],
  completed: ['maintenance'],
  cancelled: ['planning'],
  maintenance: ['completed', 'in_progress'],
};

export const PROJECT_TRANSITION_REASONS: Record<string, Record<string, string>> = {
  planning: {
    in_progress: 'بدء التنفيذ المباشر بدون مراجعة رسمية',
    cancelled: 'إلغاء في مرحلة التخطيط — عدم جدوى أو تغيّر الأولويات',
    review: 'الخطة جاهزة — تحويل للمراجعة الفنية واللجنة',
  },
  review: {
    planning: 'اللجنة طلبت تعديلات على الخطة — إعادة للتخطيط',
    development: 'تمت الموافقة — بدء مرحلة التطوير',
    cancelled: 'اللجنة رفضت المشروع',
  },
  development: {
    testing: 'مرحلة البناء اكتملت — تحويل للاختبار',
    on_hold: 'تجميد مؤقت — مشكلة موارد أو أولويات',
    cancelled: 'إلغاء أثناء التطوير',
  },
  testing: {
    development: 'فشل الاختبار — إعادة للتطوير لإصلاح العيوب',
    deployed: 'نجح الاختبار — نشر في بيئة الإنتاج',
    on_hold: 'تجميد أثناء الاختبار',
    cancelled: 'إلغاء بعد فشل متكرر في الاختبار',
  },
  deployed: {
    maintenance: 'انتهت فترة المراقبة — تحويل لمرحلة الصيانة المستمرة',
    in_progress: 'اكتشاف مشكلة حرجة — إعادة للعمل النشط',
  },
  in_progress: {
    on_hold: 'تجميد مؤقت',
    completed: 'المشروع مكتمل ومسلّم',
    cancelled: 'إلغاء أثناء التنفيذ',
    review: 'تحويل لمراجعة فنية',
    testing: 'تحويل مباشر للاختبار',
  },
  on_hold: {
    in_progress: 'استئناف العمل — تم حل العائق',
    cancelled: 'إلغاء نهائي بعد التجميد',
  },
  completed: {
    maintenance: 'فتح ملف صيانة مستمرة للمشروع المكتمل',
  },
  cancelled: {
    planning: 'إعادة إحياء المشروع الملغى — إرجاع لمرحلة التخطيط',
  },
  maintenance: {
    completed: 'إغلاق ملف الصيانة — المشروع مستقر بالكامل',
    in_progress: 'تحديث كبير يتطلب عمل نشط مجدداً',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل الإحالات بين الإدارات — IT Referral Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: إدارة تحويل المهام والمشكلات بين إدارات تقنية المعلومات الأربع
// لماذا: ضمان عدم ضياع الطلبات بين الإدارات مع مساءلة واضحة ومهل زمنية (SLA)
//
// المسار المنطقي:
//   pending ─→ acknowledged ─→ accepted ─→ in_progress ─→ completed
//                    ↓              ↓
//                 delegated      rejected / returned
//                    ↓
//               escalated (تصعيد تلقائي/يدوي)
//
// pending     → إحالة جديدة أُرسلت — الإدارة المستقبِلة لم تؤكد الاستلام بعد.
//               يخدم: تسجيل لحظة الإرسال وبدء ساعة SLA (4 ساعات للتأكيد).
// acknowledged→ الإدارة المستقبِلة أكّدت الاستلام (لم تقبل بعد).
//               يخدم: منع ادعاء عدم الاستلام، وإيقاف التصعيد التلقائي الأول.
// accepted    → الإدارة وافقت وأُنشئت مهمة مرتبطة تلقائياً.
//               يخدم: تحويل الإحالة إلى عمل ملموس مع مسؤول محدد.
// in_progress → بدأ العمل على المهمة المرتبطة.
//               يخدم: شفافية التقدم للإدارة المرسِلة.
// completed   → تم الإنجاز — الإحالة مغلقة بنجاح.
//               يخدم: تسجيل الإنجاز وقياس أداء التعاون بين الإدارات.
// rejected    → الإدارة رفضت (مع سبب إلزامي).
//               يخدم: توثيق سبب الرفض وإعادة الإحالة للمرسِل.
// returned    → إرجاع للمرسِل لنقص في المعلومات (مع سبب إلزامي).
//               يخدم: طلب تكملة البيانات بدلاً من الرفض القاطع.
// delegated   → الإدارة حوّلتها لإدارة أخرى (مع تبرير).
//               يخدم: توجيه الإحالة للجهة الأنسب دون إرجاعها للمرسِل.
// escalated   → تصعيد يدوي أو تلقائي (مستويان: مدير إدارة → مدير تقنية المعلومات).
//               يخدم: ضمان عدم تجاهل الإحالات وتدخل المستوى الأعلى عند الحاجة.
// ══════════════════════════════════════════════════════════════════════════════
export const REFERRAL_STATUSES = ['pending', 'acknowledged', 'accepted', 'in_progress', 'completed', 'rejected', 'returned', 'delegated', 'escalated'] as const;
export type ReferralStatus = typeof REFERRAL_STATUSES[number];

export const REFERRAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['acknowledged', 'accepted', 'rejected', 'returned', 'delegated', 'escalated'],
  acknowledged: ['accepted', 'rejected', 'returned', 'delegated'],
  accepted: ['in_progress', 'returned'],
  in_progress: ['completed', 'returned', 'escalated'],
  completed: [],
  rejected: [],
  returned: ['pending'],
  delegated: [],
  escalated: ['accepted', 'in_progress', 'rejected'],
};

export const REFERRAL_TRANSITION_REASONS: Record<string, Record<string, string>> = {
  pending: {
    acknowledged: 'الإدارة المستقبِلة أكّدت استلام الإحالة',
    accepted: 'قبول مباشر دون مرحلة تأكيد منفصلة',
    rejected: 'رفض — الإحالة ليست من اختصاص هذه الإدارة',
    returned: 'إرجاع — معلومات ناقصة من المرسِل',
    delegated: 'تحويل لإدارة أخرى أنسب',
    escalated: 'تصعيد — لم يتم الرد خلال مهلة SLA',
  },
  acknowledged: {
    accepted: 'قبول الإحالة وإنشاء مهمة مرتبطة',
    rejected: 'رفض بعد المراجعة — خارج النطاق',
    returned: 'إرجاع — تحتاج تفاصيل إضافية',
    delegated: 'تحويل لإدارة أخرى بعد المراجعة',
  },
  accepted: {
    in_progress: 'بدء العمل على الإحالة المقبولة',
    returned: 'إرجاع — تبيّن نقص في المعلومات بعد القبول',
  },
  in_progress: {
    completed: 'تم إنجاز العمل المطلوب بنجاح',
    returned: 'إرجاع — ظهرت عوائق تتطلب تدخل المرسِل',
    escalated: 'تصعيد — تجاوز مهلة SLA أثناء التنفيذ',
  },
  completed: {},
  rejected: {},
  returned: {
    pending: 'المرسِل أكمل المعلومات — إعادة إرسال الإحالة',
  },
  delegated: {},
  escalated: {
    accepted: 'مدير تقنية المعلومات وجّه بالقبول بعد التصعيد',
    in_progress: 'مدير تقنية المعلومات أمر ببدء العمل فوراً',
    rejected: 'مدير تقنية المعلومات وافق على الرفض',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل قرارات اللجنة — Committee Decision Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: حوكمة القرارات التقنية من الطرح حتى التنفيذ والمتابعة
// لماذا: ضمان أن كل قرار يمر بتصويت رسمي ولا يُنفَّذ بدون اعتماد
//
// المسار المنطقي:
//   draft ─→ pending ─→ approved ─→ finalized ─→ implemented
//                    ↓
//                rejected ←→ draft (إعادة صياغة)
//
// draft       → مسودة أولية — قيد الإعداد. يخدم: تحضير القرار قبل طرحه للتصويت.
// pending     → مطروح للتصويت — الأعضاء يصوتون. يخدم: جمع الأصوات بشفافية.
// approved    → حاز الأغلبية — بانتظار التوقيع الرسمي. يخدم: تسجيل نتيجة التصويت.
// rejected    → رُفض بالأغلبية — يمكن إعادة صياغته. يخدم: توثيق أسباب الرفض.
// finalized   → مصادق عليه رسمياً — لا تعديل إلا من مدير النظام. يخدم: القوة الإلزامية.
// implemented → تم تنفيذ القرار فعلياً. يخدم: متابعة التنفيذ وقياس الالتزام.
// ══════════════════════════════════════════════════════════════════════════════
export const DECISION_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'finalized', 'implemented'] as const;
export type DecisionStatus = typeof DECISION_STATUSES[number];

export const DECISION_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected'],
  approved: ['finalized', 'pending'],
  rejected: ['draft'],
  finalized: ['implemented'],
  implemented: [],
};

export const DECISION_TRANSITION_REASONS: Record<string, Record<string, string>> = {
  draft: {
    pending: 'القرار جاهز — طرحه للتصويت الرسمي',
  },
  pending: {
    approved: 'حاز أغلبية الأصوات — معتمد',
    rejected: 'لم يحز الأغلبية — مرفوض',
  },
  approved: {
    finalized: 'التوقيع الرسمي — القرار نافذ',
    pending: 'إعادة طرح للتصويت — ظهرت ملاحظات جديدة',
  },
  rejected: {
    draft: 'إعادة صياغة القرار المرفوض مع التعديلات',
  },
  finalized: {
    implemented: 'تم تنفيذ القرار على أرض الواقع',
  },
  implemented: {},
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل طلبات DMO — Data Management Office Request Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: إدارة طلبات خدمات مكتب إدارة البيانات (تصنيف/مشاركة/حذف بيانات)
// لماذا: ضمان الامتثال لأنظمة حماية البيانات (PDPL/NDMO) في كل عملية
//
// المسار المنطقي:
//   pending ─→ in_progress ─→ approved ─→ completed
//                           ↓
//                        rejected
//
// pending    → طلب جديد مقدّم — بانتظار مراجعة DMO. يخدم: تسجيل الطلب رسمياً.
// in_progress→ فريق DMO يراجع الطلب ويقيّم المخاطر. يخدم: التقييم الفني والقانوني.
// approved   → الطلب موافق عليه — بانتظار التنفيذ. يخدم: الإذن الرسمي بالمتابعة.
// rejected   → مرفوض (مع تبرير). يخدم: توثيق سبب الرفض والبدائل.
// completed  → تم تنفيذ الطلب. يخدم: إغلاق الملف وحفظ السجل.
// ══════════════════════════════════════════════════════════════════════════════
export const DMO_REQUEST_STATUSES = ['pending', 'in_progress', 'approved', 'rejected', 'completed'] as const;
export type DmoRequestStatus = typeof DMO_REQUEST_STATUSES[number];

export const DMO_REQUEST_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'rejected'],
  in_progress: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: ['pending'],
  completed: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل مهام لوحة التخطيط — Planner Task Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: إدارة المهام اليومية للفِرق مع اشتراط موافقة المدير على الإغلاق
// لماذا: منع الإغلاق الذاتي بدون مراجعة — المدير هو من يعتمد الإنجاز
//
// المسار المنطقي:
//   not_started ─→ in_progress ─→ pending_approval ─→ completed
//                       ↕                ↓ (رفض)
//                    on_hold        in_progress (إعادة)
//
// not_started     → مهمة مخططة لم تبدأ. يخدم: رؤية شاملة للعمل القادم.
// in_progress     → العمل جارٍ. يخدم: متابعة الإنجاز اليومي.
// pending_approval→ الموظف أنهى — بانتظار اعتماد المدير. يخدم: ضبط الجودة.
// completed       → المدير اعتمد الإنجاز (فقط المدير يغلق). يخدم: المساءلة.
// on_hold         → مجمّدة مؤقتاً. يخدم: تمييز الأعمال المتأخرة لسبب خارجي.
// cancelled       → ملغاة. يخدم: تنظيف اللوحة مع حفظ السبب.
// ══════════════════════════════════════════════════════════════════════════════
export const PLANNER_TASK_STATUSES = ['not_started', 'in_progress', 'pending_approval', 'completed', 'on_hold', 'cancelled'] as const;
export type PlannerTaskStatus = typeof PLANNER_TASK_STATUSES[number];

export const PLANNER_TASK_TRANSITIONS: Record<string, string[]> = {
  not_started: ['in_progress', 'cancelled'],
  in_progress: ['pending_approval', 'on_hold', 'cancelled'],
  pending_approval: ['completed', 'in_progress'],
  completed: [],
  on_hold: ['in_progress', 'cancelled'],
  cancelled: ['not_started'],
};

// ══════════════════════════════════════════════════════════════════════════════
// مسار عمل ضوابط الامتثال — Compliance Control Workflow
// ──────────────────────────────────────────────────────────────────────────────
// الغرض: تتبع تطبيق ضوابط الحوكمة (NCA/PDPL/NDMO) داخل المنظمة
// لماذا: ضمان الامتثال التنظيمي مع إثبات التطبيق لجهات الرقابة
//
// not_started  → الضابط مسجّل ولم يبدأ تطبيقه. يخدم: جرد الضوابط المطلوبة.
// in_progress  → التطبيق جارٍ. يخدم: متابعة نسبة الإنجاز.
// pending_approval → بانتظار مراجعة المسؤول. يخدم: ضمان التطبيق السليم قبل الاعتماد.
// completed    → مطبّق ومعتمد. يخدم: إثبات الامتثال.
// ══════════════════════════════════════════════════════════════════════════════
export const COMPLIANCE_CONTROL_STATUSES = ['not_started', 'in_progress', 'pending_approval', 'completed'] as const;
export type ComplianceControlStatus = typeof COMPLIANCE_CONTROL_STATUSES[number];

export const COMPLIANCE_CONTROL_TRANSITIONS: Record<string, string[]> = {
  not_started: ['in_progress'],
  in_progress: ['pending_approval'],
  pending_approval: ['completed', 'in_progress'],
  completed: [],
};

// ══════════════════════════════════════════════════════════════════════════════
// التحقق الموحّد من صحة التحولات — Unified Transition Validator
// ──────────────────────────────────────────════════════════════════════════════
export type WorkflowEntity = 'ticket' | 'task' | 'project' | 'referral' | 'decision' | 'dmo_request' | 'planner_task' | 'compliance_control';

const ALL_TRANSITION_MAPS: Record<WorkflowEntity, Record<string, string[]>> = {
  ticket: TICKET_STATUS_TRANSITIONS,
  task: TASK_STATUS_TRANSITIONS,
  project: PROJECT_STATUS_TRANSITIONS,
  referral: REFERRAL_STATUS_TRANSITIONS,
  decision: DECISION_STATUS_TRANSITIONS,
  dmo_request: DMO_REQUEST_TRANSITIONS,
  planner_task: PLANNER_TASK_TRANSITIONS,
  compliance_control: COMPLIANCE_CONTROL_TRANSITIONS,
};

const ALL_REASON_MAPS: Record<string, Record<string, Record<string, string>>> = {
  ticket: TICKET_TRANSITION_REASONS,
  task: TASK_TRANSITION_REASONS,
  project: PROJECT_TRANSITION_REASONS,
  referral: REFERRAL_TRANSITION_REASONS,
  decision: DECISION_TRANSITION_REASONS,
};

export function isValidTransition(entity: WorkflowEntity | string, fromStatus: string, toStatus: string): boolean {
  const transitions = ALL_TRANSITION_MAPS[entity as WorkflowEntity];
  if (!transitions) return true;
  const allowed = transitions[fromStatus];
  if (!allowed) return true;
  return allowed.length === 0 ? false : allowed.includes(toStatus);
}

export function getTransitionReason(entity: string, fromStatus: string, toStatus: string): string | null {
  const reasons = ALL_REASON_MAPS[entity];
  if (!reasons) return null;
  return reasons[fromStatus]?.[toStatus] || null;
}

export function getAllowedTransitions(entity: WorkflowEntity | string, fromStatus: string): string[] {
  const transitions = ALL_TRANSITION_MAPS[entity as WorkflowEntity];
  if (!transitions) return [];
  return transitions[fromStatus] || [];
}

export function getTransitionMap(entity: WorkflowEntity | string): Record<string, string[]> | null {
  return ALL_TRANSITION_MAPS[entity as WorkflowEntity] || null;
}

export function getSlaDeadline(priority: string): Date {
  const hours = SLA_HOURS[priority] || SLA_HOURS.medium;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function getSlaHours(priority: string): number {
  return SLA_HOURS[priority] || SLA_HOURS.medium;
}
