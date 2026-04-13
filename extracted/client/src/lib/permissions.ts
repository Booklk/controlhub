/**
 * نظام الصلاحيات المتقدم - RBAC
 * Control Hub - Control Hub
 * نظام شامل ومتكامل لإدارة الصلاحيات والأدوار
 */

// Import unified roles from shared constants
import { USER_ROLES, type UserRole as SharedUserRole } from '@shared/constants';

// Re-export for backward compatibility
export type UserRole = SharedUserRole;

// ==================== تعريف البوابات ====================
export type Portal = 
  | 'admin'              // بوابة مدير النظام
  | 'it_director'        // بوابة المدير العام IT
  | 'it_department'      // بوابة الإدارات التقنية (للتوافق العكسي)
  | 'it_infrastructure'  // بوابة إدارة البنية التحتية
  | 'it_support'         // بوابة إدارة الدعم الفني
  | 'it_cybersecurity'   // بوابة إدارة الأمن السيبراني
  | 'it_digital'         // بوابة إدارة التحول الرقمي
  | 'dmo'                // بوابة مكتب إدارة البيانات
  | 'committee'          // بوابة اللجنة
  | 'data_rep'           // بوابة ممثلي البيانات
  | 'steward';           // بوابة أمناء البيانات

// ==================== تعريف الإدارات التقنية الأربعة ====================
export type ITDepartmentCode = 'INFRA' | 'DTA' | 'CYBER' | 'SUPPORT';

export interface ITDepartmentInfo {
  id: number;
  code: ITDepartmentCode;
  nameAr: string;
  nameEn: string;
  color: string;
  icon: string;
}

export const IT_DEPARTMENTS_LIST: ITDepartmentInfo[] = [
  { id: 5, code: 'DMO', nameAr: 'مكتب إدارة البيانات', nameEn: 'Data Management Office', color: '#F59E0B', icon: 'Database' },
  { id: 9, code: 'INFRA', nameAr: 'إدارة البنية التحتية والشبكات', nameEn: 'Infrastructure & Networks', color: '#3B82F6', icon: 'Server' },
  { id: 10, code: 'CYBER', nameAr: 'إدارة الأمن السيبراني', nameEn: 'Cybersecurity', color: '#EF4444', icon: 'Shield' },
  { id: 11, code: 'DTA', nameAr: 'إدارة التحول الرقمي والتطبيقات', nameEn: 'Digital Transformation & Applications', color: '#8B5CF6', icon: 'Smartphone' },
  { id: 12, code: 'SUPPORT', nameAr: 'إدارة الدعم الفني', nameEn: 'Technical Support', color: '#10B981', icon: 'Headphones' },
];

// للتوافق العكسي مع الكود القديم
export type ITDepartment = 
  | 'infrastructure'
  | 'digital_transformation'
  | 'cybersecurity'
  | 'technical_support';

// ==================== تعريف الصلاحيات ====================
export type Permission = 
  // صلاحيات عامة
  | 'view_dashboard'
  | 'manage_settings'
  | 'view_reports'
  | 'export_reports'
  
  // صلاحيات IT
  | 'it_view_all_departments'
  | 'it_manage_department'
  | 'it_view_department'
  | 'it_manage_projects'
  | 'it_view_projects'
  | 'it_manage_tickets'
  | 'it_view_tickets'
  | 'it_manage_tasks'
  | 'it_view_tasks'
  | 'it_manage_employees'
  | 'it_view_employees'
  | 'it_manage_api_settings'
  | 'it_view_api_settings'
  | 'it_manage_vendors'
  | 'it_view_vendors'
  | 'it_director_dashboard'
  | 'it_department_dashboard'
  | 'it_manage_referrals'
  | 'it_view_referrals'
  | 'it_manage_network'
  | 'it_view_network'
  
  // صلاحيات DMO
  | 'dmo_manage_assets'
  | 'dmo_view_assets'
  | 'dmo_manage_workflow'
  | 'dmo_view_workflow'
  | 'dmo_manage_compliance'
  | 'dmo_view_compliance'
  | 'dmo_manage_dsr'
  | 'dmo_view_dsr'
  | 'dmo_manage_incidents'
  | 'dmo_view_incidents'
  | 'dmo_manage_risks'
  | 'dmo_view_risks'
  | 'dmo_manage_evidence'
  | 'dmo_view_evidence'
  | 'dmo_manage_stewards'
  | 'dmo_view_stewards'
  | 'dmo_manage_teams'
  | 'dmo_view_teams'
  | 'dmo_executive_dashboard'
  
  // صلاحيات اللجنة
  | 'committee_manage_decisions'
  | 'committee_view_decisions'
  | 'committee_vote'
  | 'committee_manage_meetings'
  | 'committee_view_meetings'
  | 'committee_manage_members'
  | 'committee_view_members'
  | 'committee_manage_minutes'
  | 'committee_view_minutes'
  | 'committee_approve_decisions'
  | 'committee_chairman_actions'
  | 'committee_rapporteur_actions'
  
  // صلاحيات ممثل البيانات
  | 'steward_respond_requests'
  | 'steward_view_requests'
  | 'steward_classify_data'
  | 'steward_view_assets'
  
  // صلاحيات الإدارة
  | 'admin_manage_users'
  | 'admin_manage_roles'
  | 'admin_view_audit_logs'
  | 'admin_manage_system'
  | 'admin_manage_departments'
  | 'admin_manage_dmo_team'
  | 'admin_manage_it_team';

// ==================== مصفوفة الصلاحيات لكل دور ====================
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // مدير النظام - كامل الصلاحيات
  system_admin: [
    'view_dashboard', 'manage_settings', 'view_reports', 'export_reports',
    'it_view_all_departments', 'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects', 'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks', 'it_manage_employees', 'it_view_employees',
    'it_manage_api_settings', 'it_view_api_settings', 'it_manage_vendors', 'it_view_vendors',
    'it_director_dashboard', 'it_department_dashboard', 'it_manage_referrals', 'it_view_referrals',
    'it_manage_network', 'it_view_network',
    'dmo_manage_assets', 'dmo_view_assets', 'dmo_manage_workflow', 'dmo_view_workflow',
    'dmo_manage_compliance', 'dmo_view_compliance', 'dmo_manage_dsr', 'dmo_view_dsr',
    'dmo_manage_incidents', 'dmo_view_incidents', 'dmo_manage_risks', 'dmo_view_risks',
    'dmo_manage_evidence', 'dmo_view_evidence', 'dmo_manage_stewards', 'dmo_view_stewards',
    'dmo_manage_teams', 'dmo_view_teams', 'dmo_executive_dashboard',
    'committee_manage_decisions', 'committee_view_decisions', 'committee_vote',
    'committee_manage_meetings', 'committee_view_meetings', 'committee_manage_members',
    'committee_view_members', 'committee_manage_minutes', 'committee_view_minutes',
    'committee_approve_decisions', 'committee_chairman_actions', 'committee_rapporteur_actions',
    'steward_respond_requests', 'steward_view_requests', 'steward_classify_data', 'steward_view_assets',
    'admin_manage_users', 'admin_manage_roles', 'admin_view_audit_logs', 'admin_manage_system',
    'admin_manage_departments', 'admin_manage_dmo_team', 'admin_manage_it_team',
  ],
  
  // المدير العام لتقنية المعلومات
  it_director: [
    'view_dashboard', 'manage_settings', 'view_reports', 'export_reports',
    'it_view_all_departments', 'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects', 'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks', 'it_manage_employees', 'it_view_employees',
    'it_manage_api_settings', 'it_view_api_settings', 'it_manage_vendors', 'it_view_vendors',
    'it_director_dashboard', 'it_department_dashboard', 'it_manage_referrals', 'it_view_referrals',
    'it_manage_network', 'it_view_network',
    // صلاحيات DMO للمدير العام IT
    'dmo_view_assets', 'dmo_view_workflow', 'dmo_view_compliance', 'dmo_view_dsr',
    'dmo_view_incidents', 'dmo_view_risks', 'dmo_view_evidence', 'dmo_view_stewards',
    'dmo_view_teams', 'dmo_executive_dashboard',
  ],
  
  // مدير إدارة البنية التحتية والشبكات
  it_infrastructure_manager: [
    'view_dashboard', 'view_reports', 'export_reports',
    'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
    'it_manage_employees', 'it_view_employees',
    'it_manage_api_settings', 'it_view_api_settings',
    'it_department_dashboard',
    'it_view_referrals',
    'it_manage_network', 'it_view_network',
  ],
  
  // مدير إدارة الأمن السيبراني
  it_cybersecurity_manager: [
    'view_dashboard', 'view_reports', 'export_reports',
    'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
    'it_manage_employees', 'it_view_employees',
    'it_department_dashboard',
    'it_view_referrals',
  ],
  
  // مدير إدارة التحول الرقمي
  it_digital_manager: [
    'view_dashboard', 'view_reports', 'export_reports',
    'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
    'it_manage_employees', 'it_view_employees',
    'it_manage_api_settings', 'it_view_api_settings',
    'it_department_dashboard',
    'it_view_referrals',
  ],
  
  // مدير إدارة الدعم الفني
  it_support_manager: [
    'view_dashboard', 'view_reports', 'export_reports',
    'it_manage_department', 'it_view_department',
    'it_manage_projects', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
    'it_manage_employees', 'it_view_employees',
    'it_department_dashboard',
    'it_view_referrals',
  ],
  
  // موظف البنية التحتية والشبكات (غير محدود)
  it_infrastructure_staff: [
    'view_dashboard', 'view_reports',
    'it_view_department', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
    'it_view_network',
  ],
  
  // موظف الأمن السيبراني (غير محدود)
  it_cybersecurity_staff: [
    'view_dashboard', 'view_reports',
    'it_view_department', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
  ],
  
  // موظف التحول الرقمي (غير محدود)
  it_digital_staff: [
    'view_dashboard', 'view_reports',
    'it_view_department', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
  ],
  
  // موظف الدعم الفني (غير محدود)
  it_support_staff: [
    'view_dashboard', 'view_reports',
    'it_view_department', 'it_view_projects',
    'it_manage_tickets', 'it_view_tickets',
    'it_manage_tasks', 'it_view_tasks',
  ],
  
  // مدير مكتب إدارة البيانات
  dmo_manager: [
    'view_dashboard', 'manage_settings', 'view_reports', 'export_reports',
    'dmo_manage_assets', 'dmo_view_assets', 'dmo_manage_workflow', 'dmo_view_workflow',
    'dmo_manage_compliance', 'dmo_view_compliance', 'dmo_manage_dsr', 'dmo_view_dsr',
    'dmo_manage_incidents', 'dmo_view_incidents', 'dmo_manage_risks', 'dmo_view_risks',
    'dmo_manage_evidence', 'dmo_view_evidence', 'dmo_manage_stewards', 'dmo_view_stewards',
    'dmo_manage_teams', 'dmo_view_teams', 'dmo_executive_dashboard',
    'committee_view_decisions', 'committee_view_meetings', 'committee_view_members',
  ],
  
  // موظف مكتب إدارة البيانات
  dmo_staff: [
    'view_dashboard', 'view_reports',
    'dmo_manage_assets', 'dmo_view_assets', 'dmo_manage_workflow', 'dmo_view_workflow',
    'dmo_view_compliance', 'dmo_view_dsr', 'dmo_view_incidents', 'dmo_view_risks',
    'dmo_manage_evidence', 'dmo_view_evidence', 'dmo_view_stewards', 'dmo_view_teams',
    'dmo_manage_dsr',
  ],
  
  // ممثل بيانات من الإدارات
  data_representative: [
    'view_dashboard',
    'steward_respond_requests', 'steward_view_requests',
    'steward_view_assets',
  ],
  
  // أمين بيانات
  data_steward: [
    'view_dashboard',
    'steward_respond_requests', 'steward_view_requests', 
    'steward_classify_data', 'steward_view_assets',
  ],
  
  // موظف عادي
  employee: [
    'view_dashboard',
  ],
  
  // رئيس اللجنة
  committee_chairman: [
    'view_dashboard', 'view_reports', 'export_reports',
    'committee_manage_decisions', 'committee_view_decisions', 'committee_vote',
    'committee_manage_meetings', 'committee_view_meetings',
    'committee_manage_members', 'committee_view_members',
    'committee_manage_minutes', 'committee_view_minutes',
    'committee_approve_decisions', 'committee_chairman_actions',
  ],
  
  // نائب رئيس اللجنة
  committee_vice_chairman: [
    'view_dashboard', 'view_reports',
    'committee_manage_decisions', 'committee_view_decisions', 'committee_vote',
    'committee_manage_meetings', 'committee_view_meetings',
    'committee_view_members', 'committee_view_minutes',
    'committee_approve_decisions',
  ],
  
  // مقرر اللجنة
  committee_rapporteur: [
    'view_dashboard', 'view_reports',
    'committee_manage_decisions', 'committee_view_decisions', 'committee_vote',
    'committee_manage_meetings', 'committee_view_meetings',
    'committee_manage_members', 'committee_view_members',
    'committee_manage_minutes', 'committee_view_minutes',
    'committee_rapporteur_actions',
  ],
  
  // عضو لجنة
  committee_member: [
    'view_dashboard',
    'committee_view_decisions', 'committee_vote',
    'committee_view_meetings', 'committee_view_members', 'committee_view_minutes',
  ],
};

// ==================== البوابات المسموح بها لكل دور ====================
export const ROLE_PORTALS: Record<UserRole, Portal[]> = {
  // مدير النظام - بوابة الإدارة فقط
  system_admin: ['admin'],
  
  // المدير العام لتقنية المعلومات - بوابة خاصة به + نظرة شاملة
  it_director: ['it_director', 'it_infrastructure', 'it_support', 'it_cybersecurity', 'it_digital', 'it_department', 'dmo'],
  
  // مدراء الإدارات التقنية الأربعة - كل مدير له بوابة إدارته فقط
  it_infrastructure_manager: ['it_infrastructure'],
  it_cybersecurity_manager: ['it_cybersecurity'],
  it_digital_manager: ['it_digital'],
  it_support_manager: ['it_support'],
  
  // موظفي الإدارات التقنية الأربعة - كل موظف له بوابة إدارته فقط (غير محدود)
  it_infrastructure_staff: ['it_infrastructure'],
  it_cybersecurity_staff: ['it_cybersecurity'],
  it_digital_staff: ['it_digital'],
  it_support_staff: ['it_support'],
  
  // مكتب إدارة البيانات
  dmo_manager: ['dmo'],
  dmo_staff: ['dmo'],
  
  // ممثلي وأمناء البيانات
  data_representative: ['data_rep'],
  data_steward: ['steward'],
  
  // اللجنة
  committee_chairman: ['committee'],
  committee_vice_chairman: ['committee'],
  committee_rapporteur: ['committee'],
  committee_member: ['committee'],
  
  // موظف عادي
  employee: ['dmo'],
};

// ==================== المسار الافتراضي لكل دور ====================
export const ROLE_DEFAULT_PATH: Record<UserRole, string> = {
  // مدير النظام
  system_admin: '/admin',
  
  // المدير العام لتقنية المعلومات
  it_director: '/it/executive-dashboard',
  
  // مدراء الإدارات التقنية الأربعة - كل مدير لبوابته الخاصة
  it_infrastructure_manager: '/portal/infrastructure',
  it_cybersecurity_manager: '/portal/cybersecurity',
  it_digital_manager: '/portal/digital',
  it_support_manager: '/portal/support',
  
  // موظفي الإدارات التقنية الأربعة - كل موظف لبوابة إدارته (غير محدود)
  it_infrastructure_staff: '/portal/infrastructure',
  it_cybersecurity_staff: '/portal/cybersecurity',
  it_digital_staff: '/portal/digital',
  it_support_staff: '/portal/support',
  
  // مكتب إدارة البيانات
  dmo_manager: '/dmo',
  dmo_staff: '/dmo',
  
  // ممثلي وأمناء البيانات
  data_representative: '/data-representative',
  data_steward: '/steward',
  
  // اللجنة
  committee_chairman: '/committee',
  committee_vice_chairman: '/committee',
  committee_rapporteur: '/committee',
  committee_member: '/committee',
  
  // موظف عادي
  employee: '/dmo',
};

// ==================== أسماء الأدوار بالعربية ====================
export const ROLE_NAMES: Record<UserRole, string> = {
  // مدير النظام
  system_admin: 'مدير النظام',
  
  // المدير العام لتقنية المعلومات
  it_director: 'المدير العام لتقنية المعلومات والتحول الرقمي',
  
  // مدراء الإدارات التقنية الأربعة
  it_infrastructure_manager: 'مدير إدارة البنية التحتية والشبكات',
  it_cybersecurity_manager: 'مدير إدارة الأمن السيبراني',
  it_digital_manager: 'مدير إدارة التحول الرقمي',
  it_support_manager: 'مدير إدارة الدعم الفني',
  
  // موظفي الإدارات التقنية الأربعة (غير محدود)
  it_infrastructure_staff: 'موظف البنية التحتية والشبكات',
  it_cybersecurity_staff: 'موظف الأمن السيبراني',
  it_digital_staff: 'موظف التحول الرقمي',
  it_support_staff: 'موظف الدعم الفني',
  
  // مكتب إدارة البيانات
  dmo_manager: 'مدير مكتب إدارة البيانات',
  dmo_staff: 'موظف مكتب إدارة البيانات',
  
  // ممثلي وأمناء البيانات
  data_representative: 'ممثل بيانات',
  data_steward: 'أمين بيانات',
  
  // اللجنة
  committee_chairman: 'رئيس اللجنة',
  committee_vice_chairman: 'نائب رئيس اللجنة',
  committee_rapporteur: 'مقرر اللجنة',
  committee_member: 'عضو لجنة',
  
  // موظف عادي
  employee: 'موظف',
};

// ==================== أسماء الأدوار بالإنجليزية ====================
export const ROLE_NAMES_EN: Record<UserRole, string> = {
  // System Admin
  system_admin: 'System Administrator',
  
  // IT Director
  it_director: 'IT & Digital Transformation Director',
  
  // IT Department Managers
  it_infrastructure_manager: 'Infrastructure & Networks Manager',
  it_cybersecurity_manager: 'Cybersecurity Manager',
  it_digital_manager: 'Digital Transformation Manager',
  it_support_manager: 'Technical Support Manager',
  
  // IT Department Staff (غير محدود)
  it_infrastructure_staff: 'Infrastructure & Networks Staff',
  it_cybersecurity_staff: 'Cybersecurity Staff',
  it_digital_staff: 'Digital Transformation Staff',
  it_support_staff: 'Technical Support Staff',
  
  // DMO
  dmo_manager: 'DMO Manager',
  dmo_staff: 'DMO Staff',
  
  // Data Representatives & Stewards
  data_representative: 'Data Representative',
  data_steward: 'Data Steward',
  
  // Committee
  committee_chairman: 'Committee Chairman',
  committee_vice_chairman: 'Committee Vice Chairman',
  committee_rapporteur: 'Committee Rapporteur',
  committee_member: 'Committee Member',
  
  // Employee
  employee: 'Employee',
};

// ==================== أسماء الإدارات التقنية الأربعة بالعربية ====================
export const IT_DEPT_NAMES_AR: Record<number, string> = {
  9: 'إدارة البنية التحتية والشبكات',
  10: 'إدارة التحول الرقمي والتطبيقات',
  11: 'إدارة الأمن السيبراني',
  12: 'إدارة الدعم الفني',
};

// ==================== أسماء الإدارات التقنية الأربعة بالإنجليزية ====================
export const IT_DEPT_NAMES_EN: Record<number, string> = {
  9: 'Infrastructure & Networks',
  10: 'Digital Transformation & Applications',
  11: 'Cybersecurity',
  12: 'Technical Support',
};

// للتوافق العكسي مع الكود القديم
export const IT_DEPARTMENT_NAMES: Record<ITDepartment, string> = {
  infrastructure: 'إدارة البنية التحتية والشبكات',
  digital_transformation: 'إدارة التحول الرقمي والتطبيقات',
  cybersecurity: 'إدارة الأمن السيبراني',
  technical_support: 'إدارة الدعم الفني',
};

export const IT_DEPARTMENT_NAMES_EN: Record<ITDepartment, string> = {
  infrastructure: 'Infrastructure & Networks',
  digital_transformation: 'Digital Transformation & Applications',
  cybersecurity: 'Cybersecurity',
  technical_support: 'Technical Support',
};

// ==================== تعريف أدوار DMO ====================
export type DMORole = 'dmo_manager' | 'dmo_staff';

// ==================== أسماء أدوار DMO بالعربية ====================
export const DMO_ROLE_NAMES: Record<DMORole, string> = {
  dmo_manager: 'مدير مكتب إدارة البيانات',
  dmo_staff: 'موظف مكتب إدارة البيانات',
};

// ==================== أسماء البوابات ====================
export const PORTAL_NAMES: Record<Portal, string> = {
  admin: 'الإدارة',
  it_director: 'المدير العام IT',
  it_department: 'الإدارات التقنية',
  it_infrastructure: 'إدارة البنية التحتية',
  it_support: 'إدارة الدعم الفني',
  it_cybersecurity: 'إدارة الأمن السيبراني',
  it_digital: 'إدارة التحول الرقمي',
  dmo: 'مكتب إدارة البيانات',
  committee: 'اللجنة',
  data_rep: 'ممثلي البيانات',
  steward: 'أمناء البيانات',
};

// ==================== تعريف الصفحات وصلاحياتها ====================
export interface PagePermission {
  portal?: Portal;
  permissions?: Permission[];
  roles?: UserRole[];
}

// تعريف الأدوار المتاحة لبوابة IT
const IT_ALL_ROLES: UserRole[] = ['it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'it_infrastructure_staff', 'it_cybersecurity_staff', 'it_digital_staff', 'it_support_staff'];
const IT_MANAGERS_ROLES: UserRole[] = ['it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager'];
const IT_DEPARTMENT_MANAGERS: UserRole[] = ['it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager'];
const DMO_ALL_ROLES: UserRole[] = ['it_director', 'dmo_manager', 'dmo_staff'];

export const PAGE_PERMISSIONS: Record<string, PagePermission> = {
  // ==================== صفحات Admin ====================
  '/admin': { portal: 'admin', roles: ['system_admin'] },
  '/admin/old': { portal: 'admin', roles: ['system_admin'] },
  '/admin/dashboard': { portal: 'admin', roles: ['system_admin'] },
  '/admin/users': { portal: 'admin', permissions: ['admin_manage_users'] },
  '/admin/users/new': { portal: 'admin', permissions: ['admin_manage_users'] },
  '/admin/roles': { portal: 'admin', permissions: ['admin_manage_roles'] },
  '/admin/permissions': { portal: 'admin', permissions: ['admin_manage_roles'] },
  '/admin/departments': { portal: 'admin', permissions: ['admin_manage_departments'] },
  '/admin/audit-logs': { portal: 'admin', permissions: ['admin_view_audit_logs'] },
  '/admin/settings': { portal: 'admin', permissions: ['admin_manage_system'] },
  '/admin/email-settings': { portal: 'admin', permissions: ['admin_manage_system'] },
  '/admin/demo-data': { portal: 'admin', roles: ['system_admin'] },
  
  // ==================== صفحات IT Director ====================
  '/it-director': { portal: 'it_director', roles: ['it_director'] },
  '/it-director-welcome': { portal: 'it_director', roles: ['it_director'] },
  '/it-director/dashboard': { portal: 'it_director', permissions: ['it_director_dashboard'] },
  '/it-director/departments': { portal: 'it_director', permissions: ['it_view_all_departments'] },
  '/it-director/projects': { portal: 'it_director', permissions: ['it_view_projects'] },
  '/it-director/reports': { portal: 'it_director', permissions: ['view_reports'] },
  '/it-director/assign-assets': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general-classic': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/departments': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/projects': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/employees': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/reports': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/settings': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/api-settings': { portal: 'it_director', roles: ['it_director'] },
  '/it/director-general/open-api-settings': { portal: 'it_director', roles: ['it_director'] },
  '/it/executive-dashboard': { portal: 'it_director', roles: ['it_director'] },
  '/it/assign-tasks': { portal: 'it_director', roles: ['it_director'] },
  '/it/all-projects': { portal: 'it_director', roles: ['it_director'] },
  '/it/all-tickets': { portal: 'it_director', roles: ['it_director'] },
  
  // ==================== صفحات IT Department ====================
  '/it-department': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/departments': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/departments/infrastructure': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/departments/digital_transformation': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/departments/cybersecurity': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/departments/technical_support': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it-department/dashboard': { portal: 'it_department', permissions: ['it_department_dashboard'] },
  '/it-department/projects': { portal: 'it_department', permissions: ['it_view_projects'] },
  '/it-department/tickets': { portal: 'it_department', permissions: ['it_view_tickets'] },
  '/it-department/tasks': { portal: 'it_department', permissions: ['it_view_tasks'] },
  '/it-department/employees': { portal: 'it_department', permissions: ['it_view_employees'] },
  
  // صفحات مدير الإدارة التقنية
  '/it/department-manager': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager-classic': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/tasks': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/projects': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/employees': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/tickets': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/api-settings': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  '/it/department-manager/open-api-settings': { portal: 'it_department', roles: IT_DEPARTMENT_MANAGERS },
  
  // صفحات IT مشتركة
  '/it/my-team': { portal: 'it_department', roles: IT_MANAGERS_ROLES },
  '/it/projects': { portal: 'it_department', permissions: ['it_view_projects'] },
  '/it/tickets': { portal: 'it_department', permissions: ['it_view_tickets'] },
  '/it/tasks': { portal: 'it_department', permissions: ['it_view_tasks'] },
  '/it/tasks-kanban': { portal: 'it_department', permissions: ['it_view_tasks'] },
  '/it/tasks/new': { portal: 'it_department', permissions: ['it_manage_tasks'] },
  '/it/my-tasks': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/employees': { portal: 'it_department', permissions: ['it_view_employees'] },
  '/it/vendors': { portal: 'it_department', permissions: ['it_view_vendors'] },
  '/it/referrals': { portal: 'it_department', permissions: ['it_view_referrals'] },
  '/it/department-dashboard': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/settings': { portal: 'it_department', roles: IT_MANAGERS_ROLES },
  '/it/notifications': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/reports': { portal: 'it_department', permissions: ['view_reports'] },
  '/it/workflows': { portal: 'it_department', roles: IT_MANAGERS_ROLES },
  '/it/create-task': { portal: 'it_department', permissions: ['it_manage_tasks'] },
  
  // إعدادات API والشبكة
  '/it/api-settings': { portal: 'it_department', permissions: ['it_view_api_settings'] },
  '/it/open-api-settings': { portal: 'it_department', permissions: ['it_view_api_settings'] },
  '/it/open-api-settings-classic': { portal: 'it_department', permissions: ['it_view_api_settings'] },
  '/it/oracle-settings': { portal: 'it_department', permissions: ['it_manage_api_settings'] },
  '/it/network': { portal: 'it_department', permissions: ['it_view_network'] },
  
  // طلبات CTO والمشاريع التقنية
  '/it/new-cto-request': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/cto-requests': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/tech-projects': { portal: 'it_department', roles: IT_MANAGERS_ROLES },
  
  // الأصول والتخصيصات
  '/it/assets': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/assign-assets': { portal: 'it_director', roles: ['it_director'] },
  '/it/asset-assignments': { portal: 'it_director', roles: ['it_director'] },
  '/it/my-assets': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/department/my-assets': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it/feature-assignments': { portal: 'it_department', roles: IT_MANAGERS_ROLES },
  '/it/my-assigned-features': { portal: 'it_department', roles: IT_ALL_ROLES },
  
  // صفحات تكاملات API للإدارات
  '/it/api-integrations/infrastructure': { portal: 'it_department', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/it/api-integrations/support': { portal: 'it_department', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/it/api-integrations/cybersecurity': { portal: 'it_department', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/it/api-integrations/digital': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  
  // ==================== بوابات الإدارات التقنية المنفصلة ====================
  // بوابة البنية التحتية
  '/portal/infrastructure': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/dashboard': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/servers': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/networks': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/monitoring': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/api-settings': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/tasks': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/projects': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager', 'it_infrastructure_staff'] },
  '/portal/infrastructure/team': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager'] },
  '/portal/infrastructure/settings': { portal: 'it_infrastructure', roles: ['it_director', 'it_infrastructure_manager'] },
  
  // بوابة الدعم الفني
  '/portal/support': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/dashboard': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/tickets': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/requests': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/satisfaction': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/api-settings': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/tasks': { portal: 'it_support', roles: ['it_director', 'it_support_manager', 'it_support_staff'] },
  '/portal/support/team': { portal: 'it_support', roles: ['it_director', 'it_support_manager'] },
  '/portal/support/settings': { portal: 'it_support', roles: ['it_director', 'it_support_manager'] },
  
  // بوابة الأمن السيبراني
  '/portal/cybersecurity': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/dashboard': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/threats': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/vulnerabilities': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/policies': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/alerts': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/api-settings': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/tasks': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager', 'it_cybersecurity_staff'] },
  '/portal/cybersecurity/team': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager'] },
  '/portal/cybersecurity/settings': { portal: 'it_cybersecurity', roles: ['it_director', 'it_cybersecurity_manager'] },
  
  // بوابة التحول الرقمي
  '/portal/digital': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/dashboard': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/projects': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/applications': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/innovation': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/api-settings': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/tasks': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager', 'it_digital_staff'] },
  '/portal/digital/team': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager'] },
  '/portal/digital/settings': { portal: 'it_digital', roles: ['it_director', 'it_digital_manager'] },
  
  // ==================== صفحات DMO ====================
  '/dmo': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/dashboard': { portal: 'dmo', permissions: ['dmo_executive_dashboard'] },
  '/dmo/dashboard-classic': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/assets': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  '/dmo/workflow': { portal: 'dmo', permissions: ['dmo_view_workflow'] },
  '/dmo/workflow/create': { portal: 'dmo', permissions: ['dmo_manage_workflow'] },
  '/dmo/compliance': { portal: 'dmo', permissions: ['dmo_view_compliance'] },
  '/dmo/dsr': { portal: 'dmo', permissions: ['dmo_view_dsr'] },
  '/dmo/incidents': { portal: 'dmo', permissions: ['dmo_view_incidents'] },
  '/dmo/risks': { portal: 'dmo', permissions: ['dmo_view_risks'] },
  '/dmo/evidence': { portal: 'dmo', permissions: ['dmo_view_evidence'] },
  '/dmo/stewards': { portal: 'dmo', permissions: ['dmo_view_stewards'] },
  '/dmo/teams': { portal: 'dmo', permissions: ['dmo_view_teams'] },
  '/dmo/my-team': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/learning': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/assessment': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/reports': { portal: 'dmo', permissions: ['view_reports'] },
  '/dmo/reports-classic': { portal: 'dmo', permissions: ['view_reports'] },
  '/dmo/interactive-reports': { portal: 'dmo', permissions: ['view_reports'] },
  '/dmo/users': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/settings': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/countdown-settings': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/notifications': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/performance': { portal: 'dmo', roles: DMO_ALL_ROLES },
  '/dmo/reports-center': { portal: 'dmo', permissions: ['view_reports'] },
  '/dmo/committee-members': { portal: 'dmo', permissions: ['committee_view_members'] },
  '/dmo/committee-meetings': { portal: 'dmo', permissions: ['committee_view_meetings'] },
  '/dmo/meeting-minutes': { portal: 'dmo', permissions: ['committee_view_minutes'] },
  '/dmo/decision-approvals': { portal: 'dmo', permissions: ['committee_view_decisions'] },
  '/dmo/decisions': { portal: 'dmo', permissions: ['committee_view_decisions'] },
  '/dmo/notification-settings': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/reports-management': { portal: 'dmo', permissions: ['view_reports'] },
  '/dmo/compliance-reports': { portal: 'dmo', permissions: ['dmo_view_compliance'] },
  '/dmo/risk-management': { portal: 'dmo', permissions: ['dmo_view_risks'] },
  '/dmo/data-processing-registry': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  '/dmo/audit-logs': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/admin-dashboard': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/audit-logs-advanced': { portal: 'dmo', roles: ['dmo_manager'] },
  '/dmo/compliance-monitoring': { portal: 'dmo', permissions: ['dmo_view_compliance'] },
  '/dmo/office-manager-dashboard': { portal: 'dmo', permissions: ['dmo_executive_dashboard'] },
  '/dmo/compliance-pro': { portal: 'dmo', permissions: ['dmo_view_compliance'] },
  '/dmo/data-dictionary': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  '/dmo/data-catalog': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  '/dmo/data-quality': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  '/dmo/source-systems': { portal: 'dmo', permissions: ['dmo_view_assets'] },
  
  // تقارير خارجية
  '/reports/ndmo': { portal: 'dmo', permissions: ['view_reports'] },
  '/reports/nca': { portal: 'dmo', permissions: ['view_reports'] },
  '/reports/pdpl': { portal: 'dmo', permissions: ['view_reports'] },
  
  // ==================== صفحات Committee ====================
  '/committee': { portal: 'committee' },
  '/committee/dashboard': { portal: 'committee' },
  '/committee/decisions': { portal: 'committee', permissions: ['committee_view_decisions'] },
  '/committee/meetings': { portal: 'committee', permissions: ['committee_view_meetings'] },
  '/committee/members': { portal: 'committee', permissions: ['committee_view_members'] },
  '/committee/minutes': { portal: 'committee', permissions: ['committee_view_minutes'] },
  
  // ==================== صفحات Data Representative ====================
  '/data-rep': { portal: 'data_rep' },
  '/data-rep/dashboard': { portal: 'data_rep' },
  '/data-rep/requests': { portal: 'data_rep', permissions: ['steward_view_requests'] },
  '/data-representative': { portal: 'data_rep', roles: ['data_representative'] },
  
  // ==================== صفحات Data Steward ====================
  '/steward': { portal: 'steward' },
  '/steward/dashboard': { portal: 'steward' },
  '/steward/requests': { portal: 'steward', permissions: ['steward_view_requests'] },
  '/steward/classify': { portal: 'steward', permissions: ['steward_classify_data'] },
  '/steward/assets': { portal: 'steward', permissions: ['steward_view_assets'] },
  
  // ==================== صفحات Committee الإضافية ====================
  '/committee/member': { portal: 'committee', roles: ['committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member'] },
  '/committee/voting': { portal: 'committee', permissions: ['committee_vote'] },
  '/committee/approvals': { portal: 'committee', permissions: ['committee_approve_decisions'] },
  
  // ==================== صفحات Data Representative الإضافية ====================
  '/data-representative/requests': { portal: 'data_rep', permissions: ['steward_view_requests'] },
  
  // ==================== مسارات IT الإضافية ====================
  '/it': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it_department': { portal: 'it_department', roles: IT_ALL_ROLES },
  '/it_director': { portal: 'it_director', roles: ['it_director'] },
  
  // ==================== الإشعارات ====================
  '/notifications': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  '/notifications/settings': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  
  // ==================== صفحات Admin الإضافية ====================
  '/admin/privacy-policy': { portal: 'admin', roles: ['system_admin'] },
  
  // ==================== صفحات عامة (متاحة للجميع بعد تسجيل الدخول) ====================
  '/settings': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  '/portal': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  '/portal-classic': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  '/privacy-policy': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  '/submit-report': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
  
  // ==================== الصفحة الرئيسية ====================
  '/': { roles: IT_ALL_ROLES.concat(DMO_ALL_ROLES, ['system_admin', 'data_representative', 'data_steward', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member', 'employee']) },
};

// ==================== دوال التحقق من الصلاحيات ====================

/**
 * التحقق من صلاحية معينة للمستخدم
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions?.includes(permission) || false;
}

/**
 * التحقق من مجموعة صلاحيات للمستخدم
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * التحقق من أي صلاحية من مجموعة للمستخدم
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * التحقق من صلاحية الوصول لبوابة معينة
 */
export function canAccessPortal(userRole: UserRole, portal: Portal): boolean {
  const allowedPortals = ROLE_PORTALS[userRole];
  return allowedPortals?.includes(portal) || false;
}

// المسارات العامة التي لا تتطلب تسجيل دخول أو صلاحيات
const PUBLIC_PATHS = ['/login', '/activate', '/reset-password', '/404', '/login-error'];

// المسارات الديناميكية (تحتوي على معاملات مثل :id)
const DYNAMIC_PATH_PATTERNS: { pattern: RegExp; permission: PagePermission }[] = [
  { pattern: /^\/dmo\/domain\/[^/]+$/, permission: { portal: 'dmo', permissions: ['dmo_view_compliance'] } },
  { pattern: /^\/it\/departments\/[^/]+$/, permission: { portal: 'it_department', roles: IT_ALL_ROLES } },
  { pattern: /^\/it\/projects\/[^/]+$/, permission: { portal: 'it_department', permissions: ['it_view_projects'] } },
  { pattern: /^\/it\/tickets\/[^/]+$/, permission: { portal: 'it_department', permissions: ['it_view_tickets'] } },
  { pattern: /^\/it\/tasks\/[^/]+$/, permission: { portal: 'it_department', permissions: ['it_view_tasks'] } },
  { pattern: /^\/it\/assignment\/[^/]+$/, permission: { portal: 'it_department', roles: IT_MANAGERS_ROLES } },
];

/**
 * التحقق من صلاحية الوصول لصفحة معينة
 * سياسة: deny-by-default - الصفحات غير المعرفة مرفوضة (باستثناء المسارات العامة)
 */
export function canAccessPage(userRole: UserRole, path: string): boolean {
  // المسارات العامة متاحة للجميع
  if (PUBLIC_PATHS.includes(path)) {
    return true;
  }
  
  // البحث عن الصلاحيات في القائمة الثابتة
  let pagePermission = PAGE_PERMISSIONS[path];
  
  // إذا لم توجد، نبحث في المسارات الديناميكية
  if (!pagePermission) {
    for (const dynamicPath of DYNAMIC_PATH_PATTERNS) {
      if (dynamicPath.pattern.test(path)) {
        pagePermission = dynamicPath.permission;
        break;
      }
    }
  }
  
  // سياسة deny-by-default: إذا الصفحة غير معرفة، نرفض الوصول
  if (!pagePermission) {
    console.warn(`[RBAC] Access denied to undefined path: ${path}`);
    return false;
  }
  
  // التحقق من البوابة
  if (pagePermission.portal && !canAccessPortal(userRole, pagePermission.portal)) {
    return false;
  }
  
  // التحقق من الصلاحيات
  if (pagePermission.permissions && !hasAnyPermission(userRole, pagePermission.permissions)) {
    return false;
  }
  
  // التحقق من الأدوار المحددة
  if (pagePermission.roles && !pagePermission.roles.includes(userRole)) {
    return false;
  }
  
  return true;
}

/**
 * الحصول على المسار الافتراضي للمستخدم
 */
export function getDefaultPath(userRole: UserRole): string {
  return ROLE_DEFAULT_PATH[userRole] || '/';
}

/**
 * الحصول على اسم الدور بالعربية
 */
export function getRoleName(role: UserRole): string {
  return ROLE_NAMES[role] || role;
}

/**
 * الحصول على اسم الدور بالإنجليزية
 */
export function getRoleNameEn(role: UserRole): string {
  return ROLE_NAMES_EN[role] || role;
}

/**
 * الحصول على اسم البوابة
 */
export function getPortalName(portal: Portal): string {
  return PORTAL_NAMES[portal] || portal;
}

/**
 * الحصول على جميع الصلاحيات للمستخدم
 */
export function getUserPermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

/**
 * الحصول على البوابات المتاحة للمستخدم
 */
export function getUserPortals(userRole: UserRole): Portal[] {
  return ROLE_PORTALS[userRole] || [];
}

/**
 * التحقق من أن المستخدم مدير
 */
export function isManager(userRole: UserRole): boolean {
  return ['system_admin', 'it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'dmo_manager', 'committee_chairman'].includes(userRole);
}

/**
 * التحقق من أن المستخدم من فريق IT
 */
export function isITTeam(userRole: UserRole): boolean {
  return ['it_director', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'it_infrastructure_staff', 'it_cybersecurity_staff', 'it_digital_staff', 'it_support_staff'].includes(userRole);
}

/**
 * التحقق من أن المستخدم من فريق DMO
 */
export function isDMOTeam(userRole: UserRole): boolean {
  return ['dmo_manager', 'dmo_staff'].includes(userRole);
}

/**
 * التحقق من أن المستخدم من اللجنة
 */
export function isCommittee(userRole: UserRole): boolean {
  return ['committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'committee_member'].includes(userRole);
}

/**
 * الحصول على قائمة جميع الأدوار
 */
export function getAllRoles(): UserRole[] {
  return Object.keys(ROLE_PERMISSIONS) as UserRole[];
}

/**
 * الحصول على قائمة جميع البوابات
 */
export function getAllPortals(): Portal[] {
  return Object.keys(PORTAL_NAMES) as Portal[];
}

/**
 * الحصول على قائمة جميع الصلاحيات
 */
export function getAllPermissions(): Permission[] {
  const allPermissions = new Set<Permission>();
  Object.values(ROLE_PERMISSIONS).forEach(permissions => {
    permissions.forEach(p => allPermissions.add(p));
  });
  return Array.from(allPermissions);
}
