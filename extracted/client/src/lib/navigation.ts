import { 
  LayoutDashboard, FolderKanban, Ticket, AlertTriangle,
  Server, BarChart3, Users, Building2, Link2,
  Shield, Cpu, Zap, Headphones, Database,
  FileText, BookOpen, ClipboardList, Settings, Send,
  FileCheck, UserCog, ArrowLeftRight, Network, HardDrive,
  Activity, Rocket, Cloud, AppWindow, Bug, ShieldAlert,
  Package, Plug, FileBarChart, Mail, Layers, Scale, ListChecks,
  Target, Bell, Archive, Timer, GraduationCap, Workflow,
  Gavel, Vote, UserCheck, Eye, FileKey, Gauge, Award, Briefcase, FolderOpen,
  Lightbulb, KanbanSquare, UserPlus, Radio, ShieldCheck
} from 'lucide-react';
import { canView, RESOURCES, type Resource } from '@shared/permissions';

export interface NavItem {
  title: string;
  href: string;
  icon: any;
  description?: string;
  resource?: Resource;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  icon?: any;
}

export const INFRASTRUCTURE_DEPT_ID = 9;
export const CYBERSECURITY_DEPT_ID = 10;
export const DIGITAL_TRANSFORMATION_DEPT_ID = 11;
export const SUPPORT_DEPT_ID = 12;
export const DMO_DEPARTMENT_ID = 5;

// ──────────────────────────────────────────────────────────
// Factory Functions - عناصر مشتركة بين البوابات
// لإضافة عنصر مشترك جديد، أضفه هنا مرة واحدة فقط
// ──────────────────────────────────────────────────────────

function makeDeptOpsGroup(basePath: string, extras?: NavItem[], options?: { ticketResource?: Resource }): NavGroup {
  return {
    label: 'العمليات',
    icon: KanbanSquare,
    items: [
      { title: 'المهام', href: `${basePath}/tasks`, icon: ClipboardList },
      { title: 'لوحة التخطيط', href: `${basePath}/planner`, icon: KanbanSquare },
      { title: 'التذاكر', href: `${basePath}/tickets`, icon: Ticket, ...(options?.ticketResource ? { resource: options.ticketResource } : {}) },
      ...(extras || []),
      { title: 'الإحالات', href: `${basePath}/referrals`, icon: ArrowLeftRight },
    ],
  };
}

interface AdminGroupOptions {
  basePath: string;
  assetsResource?: Resource;
  slaResource?: Resource;
  extraItems?: NavItem[];
}

function makeDeptAdminGroup({ basePath, assetsResource, slaResource, extraItems }: AdminGroupOptions): NavGroup {
  return {
    label: 'الإدارة',
    icon: Settings,
    items: [
      { title: 'أصول الإدارة', href: `${basePath}/assets`, icon: Package, ...(assetsResource ? { resource: assetsResource } : {}) },
      { title: 'اتفاقيات SLA', href: `${basePath}/sla`, icon: FileText, ...(slaResource ? { resource: slaResource } : {}) },
      { title: 'الموظفين', href: `${basePath}/employees`, icon: UserPlus },
      { title: 'قاعدة المعرفة', href: `${basePath}/knowledge-base`, icon: BookOpen, resource: RESOURCES.KNOWLEDGE_BASE },
      { title: 'المستندات', href: `${basePath}/documents`, icon: FileBarChart },
      { title: 'ربط الأنظمة', href: `${basePath}/api-settings`, icon: Plug },
      ...(extraItems || []),
      { title: 'مؤشرات الأداء', href: `${basePath}/kpi`, icon: BarChart3 },
      { title: 'طلب مميزات', href: `${basePath}/feature-requests`, icon: Lightbulb },
    ],
  };
}

// ──────────────────────────────────────────────────────────
// IT Director - مدير تقنية المعلومات
// ──────────────────────────────────────────────────────────

export const itDirectorNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { title: 'لوحة التحكم', href: '/it-director', icon: LayoutDashboard },
      { title: '🔴 مركز القيادة الحي', href: '/it-director/command-center', icon: Radio },
      { title: 'مؤشرات الأداء (KPI)', href: '/it-director/kpi', icon: BarChart3 },
    ],
  },
  {
    label: 'العمليات',
    icon: KanbanSquare,
    items: [
      { title: 'المهام المرسلة', href: '/it-director/tasks', icon: Send },
      { title: 'لوحة التخطيط', href: '/it-director/planner', icon: KanbanSquare },
      { title: 'المشاريع', href: '/it-director/projects', icon: FolderKanban, resource: RESOURCES.IT_PROJECTS },
      { title: 'التذاكر', href: '/it-director/tickets', icon: Ticket, resource: RESOURCES.IT_TICKETS },
      { title: 'التصعيدات', href: '/it-director/escalations', icon: AlertTriangle, resource: RESOURCES.IT_ESCALATIONS },
      { title: 'الإحالات', href: '/it-director/referrals', icon: ArrowLeftRight, resource: RESOURCES.IT_REFERRALS },
    ],
  },
  {
    label: 'الموارد',
    icon: Server,
    items: [
      { title: 'الأصول التقنية', href: '/it-director/assets', icon: Server, resource: RESOURCES.IT_ASSETS },
      { title: 'الفرق', href: '/it-director/teams', icon: Users, resource: RESOURCES.IT_TEAMS },
      { title: 'الموردين', href: '/it-director/vendors', icon: Building2, resource: RESOURCES.IT_VENDORS },
    ],
  },
  {
    label: 'الأنظمة والتقارير',
    icon: BarChart3,
    items: [
      { title: 'لوحة الامتثال التنظيمي', href: '/it-director/compliance-dashboard', icon: Scale },
      { title: 'قواعد التنبيه الذكي', href: '/it-director/alert-rules', icon: Bell },
      { title: 'قوالب التذاكر', href: '/it-director/ticket-templates', icon: FileText },
      { title: 'أتمتة سير العمل', href: '/it-director/automation-rules', icon: Workflow },
      { title: 'مؤشرات الأداء', href: '/it-director/kpis', icon: BarChart3, resource: RESOURCES.IT_KPIS },
      { title: 'اتفاقيات SLA', href: '/it-director/sla', icon: FileText },
      { title: 'الأنظمة الخارجية', href: '/it-director/external-systems', icon: Link2, resource: RESOURCES.EXTERNAL_SYSTEMS },
      { title: 'موافقات الأنظمة', href: '/it-director/system-approvals', icon: FileCheck, resource: RESOURCES.SYSTEM_APPROVALS },
      { title: 'ربط البريد الإلكتروني', href: '/it-director/email-integration', icon: Mail },
      { title: 'طلب مميزات', href: '/it-director/feature-requests', icon: Lightbulb },
    ],
  },
  {
    label: 'بوابات الإدارات',
    icon: Layers,
    items: [
      { title: 'لوحة المسؤول', href: '/admin', icon: Settings },
      { title: 'البنية التحتية', href: '/department/infrastructure', icon: Server },
      { title: 'الأمن السيبراني', href: '/department/cybersecurity', icon: Shield },
      { title: 'التحول الرقمي', href: '/department/digital-transformation', icon: Zap },
      { title: 'الدعم الفني', href: '/department/support', icon: Headphones },
      { title: 'مكتب إدارة البيانات', href: '/dmo', icon: Database },
      { title: 'إدارة اللجان', href: '/committee', icon: Gavel },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Cybersecurity - الأمن السيبراني
// ──────────────────────────────────────────────────────────

export const cybersecurityNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: Shield,
    items: [
      { title: 'لوحة التحكم', href: '/department/cybersecurity', icon: Shield },
    ],
  },
  makeDeptOpsGroup('/department/cybersecurity', [
    { title: 'المشاريع', href: '/department/cybersecurity/projects', icon: FolderKanban },
  ]),
  {
    label: 'الأمن',
    icon: ShieldAlert,
    items: [
      { title: 'الضوابط والمواصفات', href: '/department/cybersecurity/regulatory-compliance', icon: Scale },
      { title: 'الحوادث الأمنية', href: '/department/cybersecurity/incidents', icon: ShieldAlert, resource: RESOURCES.SECURITY_INCIDENTS },
      { title: 'الثغرات الأمنية', href: '/department/cybersecurity/vulnerabilities', icon: Bug, resource: RESOURCES.SECURITY_VULNERABILITIES },
      { title: 'تقييم المخاطر', href: '/department/cybersecurity/threats', icon: AlertTriangle, resource: RESOURCES.SECURITY_THREATS },
    ],
  },
  makeDeptAdminGroup({
    basePath: '/department/cybersecurity',
    assetsResource: RESOURCES.CYBERSECURITY_ASSETS,
    slaResource: RESOURCES.CYBERSECURITY_SLA,
  }),
];

// ──────────────────────────────────────────────────────────
// Infrastructure - البنية التحتية
// ──────────────────────────────────────────────────────────

export const infrastructureNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: Cpu,
    items: [
      { title: 'لوحة التحكم', href: '/department/infrastructure', icon: Cpu },
    ],
  },
  makeDeptOpsGroup('/department/infrastructure', [
    { title: 'المشاريع', href: '/department/infrastructure/projects', icon: FolderKanban },
  ]),
  {
    label: 'البنية التحتية',
    icon: Server,
    items: [
      { title: 'الخوادم', href: '/department/infrastructure/servers', icon: Server, resource: RESOURCES.INFRASTRUCTURE_SERVERS },
      { title: 'الشبكات', href: '/department/infrastructure/network', icon: Network, resource: RESOURCES.INFRASTRUCTURE_NETWORK },
      { title: 'التخزين', href: '/department/infrastructure/storage', icon: HardDrive, resource: RESOURCES.INFRASTRUCTURE_STORAGE },
      { title: 'المراقبة', href: '/department/infrastructure/monitoring', icon: Activity, resource: RESOURCES.INFRASTRUCTURE_MONITORING },
      { title: 'الضوابط والمواصفات', href: '/department/infrastructure/regulatory-compliance', icon: Scale },
    ],
  },
  makeDeptAdminGroup({
    basePath: '/department/infrastructure',
    assetsResource: RESOURCES.INFRASTRUCTURE_ASSETS,
    slaResource: RESOURCES.INFRASTRUCTURE_SLA,
  }),
];

// ──────────────────────────────────────────────────────────
// Digital Transformation - التحول الرقمي
// ──────────────────────────────────────────────────────────

export const digitalTransformationNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: Zap,
    items: [
      { title: 'لوحة التحكم', href: '/department/digital-transformation', icon: Zap },
    ],
  },
  makeDeptOpsGroup('/department/digital-transformation', [
    { title: 'المشاريع', href: '/department/digital-transformation/projects', icon: FolderKanban },
  ]),
  {
    label: 'التحول الرقمي',
    icon: Rocket,
    items: [
      { title: 'الضوابط والمؤشرات', href: '/department/digital-transformation/regulatory-compliance', icon: Scale },
      { title: 'المبادرات الرقمية', href: '/department/digital-transformation/initiatives', icon: Rocket, resource: RESOURCES.DIGITAL_INITIATIVES },
      { title: 'التطبيقات', href: '/department/digital-transformation/applications', icon: AppWindow, resource: RESOURCES.DIGITAL_APPLICATIONS },
      { title: 'الخدمات السحابية', href: '/department/digital-transformation/cloud', icon: Cloud, resource: RESOURCES.CLOUD_SERVICES },
      { title: 'العقود والاتفاقيات', href: '/department/digital-transformation/agreements', icon: Briefcase, resource: RESOURCES.DATA_AGREEMENTS },
    ],
  },
  makeDeptAdminGroup({
    basePath: '/department/digital-transformation',
    assetsResource: RESOURCES.DIGITAL_ASSETS,
    slaResource: RESOURCES.DIGITAL_SLA,
  }),
];

// ──────────────────────────────────────────────────────────
// Support - الدعم الفني
// ──────────────────────────────────────────────────────────

export const supportNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: Headphones,
    items: [
      { title: 'لوحة التحكم', href: '/department/support', icon: Headphones },
    ],
  },
  makeDeptOpsGroup('/department/support', [
    { title: 'المشاريع', href: '/department/support/projects', icon: FolderKanban },
  ], { ticketResource: RESOURCES.SUPPORT_TICKETS }),
  {
    label: 'الامتثال',
    icon: Scale,
    items: [
      { title: 'الضوابط والمواصفات', href: '/department/support/regulatory-compliance', icon: Scale },
    ],
  },
  makeDeptAdminGroup({
    basePath: '/department/support',
    assetsResource: RESOURCES.SUPPORT_ASSETS,
    slaResource: RESOURCES.SUPPORT_SLA,
    extraItems: [
      { title: 'ربط البريد الإلكتروني', href: '/department/support/email-integration', icon: Mail },
      { title: 'Active Directory', href: '/department/support/active-directory', icon: Network },
    ],
  }),
];

// ──────────────────────────────────────────────────────────
// DMO - مكتب إدارة البيانات
// "لوحة مدير المكتب" بدلاً من "لوحة المدير التنفيذي"
// ──────────────────────────────────────────────────────────

export const dmoNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { title: 'لوحة التحكم', href: '/dmo', icon: Database },
      { title: 'لوحة مدير المكتب', href: '/dmo/office-manager-dashboard', icon: Gauge },
      { title: 'الإشعارات', href: '/dmo/notifications', icon: Bell },
    ],
  },
  {
    label: 'إدارة البيانات',
    icon: Database,
    items: [
      { title: 'فهرس البيانات', href: '/dmo/data-catalog', icon: BookOpen, resource: RESOURCES.DATA_CATALOG },
      { title: 'مستودع البيانات التحليلي', href: '/dmo/data-warehouse', icon: Database },
      { title: 'أصول البيانات', href: '/dmo/data-assets', icon: FolderOpen },
      { title: 'قاموس البيانات', href: '/dmo/data-dictionary', icon: FileText },
      { title: 'تصنيفات البيانات', href: '/dmo/data-classifications', icon: Layers },
      { title: 'جودة البيانات', href: '/dmo/data-quality', icon: Target },
      { title: 'تخطيط تدفق البيانات', href: '/dmo/data-flow-mapping', icon: ArrowLeftRight },
      { title: 'ممثلي البيانات', href: '/dmo/stewards', icon: UserCheck },
    ],
  },
  {
    label: 'الامتثال والحوكمة',
    icon: Shield,
    items: [
      { title: 'الضوابط والمواصفات', href: '/dmo/regulatory-compliance', icon: Shield },
      { title: 'مراقبة الامتثال', href: '/dmo/compliance-monitoring', icon: Scale },
      { title: 'مستودع الأدلة', href: '/dmo/evidence', icon: FileCheck },
      { title: 'التقييم', href: '/dmo/assessment', icon: Award },
      { title: 'المخاطر', href: '/dmo/risks', icon: AlertTriangle },
      { title: 'الاتفاقيات', href: '/dmo/agreements', icon: Briefcase },
      { title: 'مشاركة البيانات الخارجية', href: '/dmo/external-sharing', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'سير العمل والطلبات',
    icon: KanbanSquare,
    items: [
      { title: 'التذاكر', href: '/dmo/tickets', icon: Ticket },
      { title: 'المهام', href: '/dmo/tasks', icon: FolderKanban },
      { title: 'الإحالات', href: '/dmo/referrals', icon: Send },
      { title: 'لوحة التخطيط', href: '/dmo/planner', icon: KanbanSquare },
      { title: 'طلبات الحوكمة', href: '/dmo/governance-requests', icon: ListChecks },
      { title: 'طلبات ممثلي البيانات', href: '/dmo/steward-requests', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'الخصوصية والحماية',
    icon: FileKey,
    items: [
      { title: 'طلبات أصحاب البيانات', href: '/dmo/dsr', icon: FileKey },
      { title: 'إدارة الموافقات', href: '/dmo/consent-management', icon: ShieldCheck },
      { title: 'حوادث البيانات', href: '/dmo/incidents', icon: ShieldAlert },
    ],
  },
  {
    label: 'اللجنة',
    icon: Gavel,
    items: [
      { title: 'القرارات', href: '/committee/decisions', icon: Gavel },
      { title: 'الموافقات', href: '/dmo/decision-approvals', icon: Vote },
      { title: 'أعضاء اللجنة', href: '/committee/members', icon: Users },
      { title: 'اجتماعات اللجنة', href: '/committee/meetings', icon: Building2 },
      { title: 'محاضر الجلسات', href: '/committee/minutes', icon: ClipboardList },
    ],
  },
  {
    label: 'التقارير والأداء',
    icon: BarChart3,
    items: [
      { title: 'مركز التقارير', href: '/dmo/reports-center', icon: FileBarChart },
      { title: 'إدارة التقارير', href: '/dmo/reports-management', icon: BarChart3 },
      { title: 'الأداء', href: '/dmo/performance', icon: Activity },
    ],
  },
  {
    label: 'الموارد والإعدادات',
    icon: Settings,
    items: [
      { title: 'قاعدة المعرفة', href: '/dmo/knowledge-base', icon: BookOpen, resource: RESOURCES.KNOWLEDGE_BASE },
      { title: 'المستندات', href: '/dmo/documents', icon: ClipboardList, resource: RESOURCES.DMO_DOCUMENTS },
      { title: 'الفرق', href: '/dmo/teams', icon: Users },
      { title: 'الموظفين', href: '/dmo/employees', icon: UserPlus },
      { title: 'التعلم والتدريب', href: '/dmo/learning', icon: GraduationCap },
      { title: 'المستخدمين', href: '/dmo/users', icon: UserCog },
      { title: 'الأرشيف', href: '/dmo/archive', icon: Archive },
      { title: 'ربط الأنظمة', href: '/dmo/api-settings', icon: Plug },
      { title: 'الإعدادات', href: '/dmo/settings', icon: Settings },
      { title: 'طلب مميزات', href: '/dmo/feature-requests', icon: Lightbulb },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Data Representative - ممثل البيانات
// ──────────────────────────────────────────────────────────
export const dataRepNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { title: 'لوحة التحكم', href: '/data-representative', icon: Database },
      { title: 'الإشعارات', href: '/dmo/notifications', icon: Bell },
    ],
  },
  {
    label: 'الطلبات',
    icon: KanbanSquare,
    items: [
      { title: 'طلبات الحوكمة', href: '/dmo/governance-requests', icon: ListChecks },
      { title: 'طلبات ممثلي البيانات', href: '/dmo/steward-requests', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'الموارد والإعدادات',
    icon: Settings,
    items: [
      { title: 'قاعدة المعرفة', href: '/dmo/knowledge-base', icon: BookOpen, resource: RESOURCES.KNOWLEDGE_BASE },
      { title: 'طلب مميزات', href: '/dmo/feature-requests', icon: Lightbulb },
      { title: 'الإعدادات', href: '/dmo/settings', icon: Settings },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Admin - المشرف العام
// ──────────────────────────────────────────────────────────

export const adminNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { title: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'الإدارة',
    icon: UserCog,
    items: [
      { title: 'إدارة المستخدمين', href: '/admin/users', icon: UserCog, resource: RESOURCES.USERS },
      { title: 'إدارات الأعمال', href: '/admin/departments', icon: Building2, resource: RESOURCES.BUSINESS_DEPARTMENTS },
    ],
  },
  {
    label: 'المراقبة والتحكم',
    icon: Eye,
    items: [
      { title: 'سجل التدقيق', href: '/admin/audit', icon: FileCheck, resource: RESOURCES.AUDIT_LOGS },
      { title: 'قواعد التنبيه الذكي', href: '/admin/alert-rules', icon: Bell },
      { title: 'قوالب التذاكر', href: '/admin/ticket-templates', icon: FileText },
      { title: 'أتمتة سير العمل', href: '/admin/automation-rules', icon: Workflow },
      { title: 'الجلسات', href: '/admin/sessions', icon: Users, resource: RESOURCES.SESSIONS },
      { title: 'حالة الأنظمة', href: '/admin/systems-status', icon: Server, resource: RESOURCES.SYSTEMS_STATUS },
      { title: 'مؤشرات الأداء (KPI)', href: '/admin/kpi', icon: BarChart3 },
      { title: 'التقارير', href: '/admin/reports', icon: FileBarChart },
      { title: 'طلبات المميزات', href: '/admin/feature-requests', icon: Lightbulb },
    ],
  },
  {
    label: 'التخطيط',
    icon: KanbanSquare,
    items: [
      { title: 'لوحة التخطيط', href: '/admin/planner', icon: KanbanSquare },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Committee - اللجنة
// ──────────────────────────────────────────────────────────

export const committeeNavGroups: NavGroup[] = [
  {
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { title: 'لوحة التحكم', href: '/committee', icon: LayoutDashboard },
    ],
  },
  {
    label: 'الحوكمة',
    icon: Gavel,
    items: [
      { title: 'القرارات', href: '/committee/decisions', icon: FileCheck, resource: RESOURCES.COMMITTEE_DECISIONS },
      { title: 'الاجتماعات', href: '/committee/meetings', icon: Users, resource: RESOURCES.COMMITTEE_MEETINGS },
      { title: 'التصويت', href: '/committee/voting', icon: ClipboardList, resource: RESOURCES.COMMITTEE_VOTING },
      { title: 'محاضر الجلسات', href: '/committee/minutes', icon: FileText, resource: RESOURCES.COMMITTEE_MINUTES },
    ],
  },
  {
    label: 'الإدارة',
    icon: Settings,
    items: [
      { title: 'الأعضاء', href: '/committee/members', icon: Users, resource: RESOURCES.COMMITTEE_MEMBERS },
      { title: 'المهام', href: '/committee/tasks', icon: ClipboardList, resource: RESOURCES.COMMITTEE_TASKS },
      { title: 'الإعدادات', href: '/committee/settings', icon: Settings, resource: RESOURCES.COMMITTEE_SETTINGS },
      { title: 'طلب مميزات', href: '/committee/feature-requests', icon: Lightbulb },
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Flat NavItem exports (التوافق مع الكود القديم)
// ──────────────────────────────────────────────────────────

export const itDirectorNavItems: NavItem[] = itDirectorNavGroups.flatMap(g => g.items);
export const cybersecurityNavItems: NavItem[] = cybersecurityNavGroups.flatMap(g => g.items);
export const infrastructureNavItems: NavItem[] = infrastructureNavGroups.flatMap(g => g.items);
export const digitalTransformationNavItems: NavItem[] = digitalTransformationNavGroups.flatMap(g => g.items);
export const supportNavItems: NavItem[] = supportNavGroups.flatMap(g => g.items);
export const dmoNavItems: NavItem[] = dmoNavGroups.flatMap(g => g.items);
export const adminNavItems: NavItem[] = adminNavGroups.flatMap(g => g.items);
export const committeeNavItems: NavItem[] = committeeNavGroups.flatMap(g => g.items);

// ──────────────────────────────────────────────────────────
// Portal → NavGroups resolver
// يُرجع قائمة التنقل الثابتة حسب بوابة المستخدم
// لمنع تغيّر السايدبار عند زيارة صفحات بوابات أخرى
// ──────────────────────────────────────────────────────────
const PORTAL_NAV_MAP: Record<string, NavGroup[]> = {
  system_admin: adminNavGroups,
  admin: adminNavGroups,
  it_director: itDirectorNavGroups,
  it_department: infrastructureNavGroups,
  infrastructure: infrastructureNavGroups,
  cybersecurity: cybersecurityNavGroups,
  digital_transformation: digitalTransformationNavGroups,
  support: supportNavGroups,
  dmo: dmoNavGroups,
  dmo_manager: dmoNavGroups,
  data_rep: dataRepNavGroups,
  steward: dmoNavGroups,
  committee: committeeNavGroups,
  committee_chairman: committeeNavGroups,
  committee_vice_chairman: committeeNavGroups,
  committee_rapporteur: committeeNavGroups,
  committee_member: committeeNavGroups,
};

const PORTAL_LABEL_MAP: Record<string, string> = {
  system_admin: 'بوابة مدير النظام',
  admin: 'بوابة مدير النظام',
  it_director: 'مدير تقنية المعلومات',
  it_department: 'البنية التحتية',
  infrastructure: 'البنية التحتية',
  cybersecurity: 'الأمن السيبراني',
  digital_transformation: 'التحول الرقمي',
  support: 'الدعم الفني',
  dmo: 'مكتب إدارة البيانات',
  dmo_manager: 'مكتب إدارة البيانات',
  data_rep: 'ممثل البيانات',
  steward: 'أمين البيانات',
  employee: 'الموظفين',
  committee: 'اللجنة',
  committee_chairman: 'اللجنة',
  committee_vice_chairman: 'اللجنة',
  committee_rapporteur: 'اللجنة',
  committee_member: 'اللجنة',
};

export function getNavGroupsForPortal(portal: string): NavGroup[] | null {
  return PORTAL_NAV_MAP[portal] || null;
}

export function getPortalLabel(portal: string): string {
  return PORTAL_LABEL_MAP[portal] || portal;
}

// ──────────────────────────────────────────────────────────
// Permission filtering (تصفية حسب الصلاحيات)
// ──────────────────────────────────────────────────────────

export function filterNavItemsByPermission(items: NavItem[], role: string): NavItem[] {
  return items.filter(item => {
    if (!item.resource) return true;
    return canView(role, item.resource);
  });
}

export function filterNavGroupsByPermission(groups: NavGroup[], role: string): NavGroup[] {
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.resource) return true;
        return canView(role, item.resource);
      }),
    }))
    .filter(group => group.items.length > 0);
}
