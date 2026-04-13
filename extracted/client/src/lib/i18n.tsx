import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'ar' | 'en';

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (text: string) => string;
  dir: 'rtl' | 'ltr';
  isAr: boolean;
  isEn: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('controlhub_lang');
    return (saved === 'en' || saved === 'ar') ? saved as Lang : 'ar';
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('controlhub_lang', newLang);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (text: string): string => {
    if (lang === 'ar') return text;
    return EN[text] ?? text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr', isAr: lang === 'ar', isEn: lang === 'en' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

// ─── English translations ────────────────────────────────────────────────────
const EN: Record<string, string> = {

  // ── Portal names ────────────────────────────────────────────────────────────
  'نادي سباقات الخيل': 'Jockey Club of Saudi Arabia',
  'مدير تقنية المعلومات': 'IT Director',
  'تقنية المعلومات': 'Information Technology',
  'إدارة البيانات': 'Data Management',
  'الأمن السيبراني': 'Cybersecurity',
  'البنية التحتية': 'Infrastructure',
  'التحول الرقمي': 'Digital Transformation',
  'الدعم الفني': 'Technical Support',
  'مكتب إدارة البيانات': 'Data Management Office',
  'إدارة اللجان': 'Committee Management',
  'بوابة الموظفين': 'Employee Portal',
  'المشرف': 'Administrator',
  'لوحة المشرف': 'Admin Dashboard',

  // ── Navigation groups ────────────────────────────────────────────────────────
  'الرئيسية': 'Home',
  'العمليات': 'Operations',
  'الإدارة': 'Management',
  'الموارد': 'Resources',
  'الأنظمة والتقارير': 'Systems & Reports',
  'بوابات الإدارات': 'Department Portals',
  'الأمن': 'Security',
  'الدعم': 'Support',
  'البيانات': 'Data',
  'اللجان': 'Committees',

  // ── Nav items ────────────────────────────────────────────────────────────────
  'لوحة التحكم': 'Dashboard',
  '🔴 مركز القيادة الحي': '🔴 Live Command Center',
  'مؤشرات الأداء (KPI)': 'Performance Indicators (KPI)',
  'المهام': 'Tasks',
  'المهام المرسلة': 'Assigned Tasks',
  'لوحة التخطيط': 'Planner Board',
  'المشاريع': 'Projects',
  'التذاكر': 'Tickets',
  'التصعيدات': 'Escalations',
  'الإحالات': 'Referrals',
  'الأصول التقنية': 'IT Assets',
  'الفرق': 'Teams',
  'الموردين': 'Vendors',
  'لوحة الامتثال التنظيمي': 'Regulatory Compliance Dashboard',
  'قواعد التنبيه الذكي': 'Smart Alert Rules',
  'قوالب التذاكر': 'Ticket Templates',
  'أتمتة سير العمل': 'Workflow Automation',
  'مؤشرات الأداء': 'Performance Indicators',
  'اتفاقيات SLA': 'SLA Agreements',
  'الأنظمة الخارجية': 'External Systems',
  'موافقات الأنظمة': 'System Approvals',
  'ربط البريد الإلكتروني': 'Email Integration',
  'طلب مميزات': 'Feature Requests',
  'الضوابط والمواصفات': 'Controls & Standards',
  'الحوادث الأمنية': 'Security Incidents',
  'الثغرات الأمنية': 'Security Vulnerabilities',
  'تقييم المخاطر': 'Risk Assessment',
  'الخوادم': 'Servers',
  'الشبكات': 'Networks',
  'التخزين': 'Storage',
  'المراقبة': 'Monitoring',
  'الضوابط والمؤشرات': 'Controls & Indicators',
  'المبادرات الرقمية': 'Digital Initiatives',
  'التطبيقات': 'Applications',
  'الخدمات السحابية': 'Cloud Services',
  'الدليل النشط': 'Active Directory',
  'أصول الإدارة': 'Department Assets',
  'الموظفين': 'Employees',
  'قاعدة المعرفة': 'Knowledge Base',
  'المستندات': 'Documents',
  'ربط الأنظمة': 'System Integration',
  'إدارة المستخدمين': 'User Management',
  'سجل التدقيق': 'Audit Log',
  'الجلسات': 'Sessions',
  'التقارير': 'Reports',
  'إدارات الأعمال': 'Business Departments',
  'حالة الأنظمة': 'Systems Status',
  'إدارة الأصول': 'Asset Management',
  'فهرس البيانات': 'Data Catalog',
  'قاموس البيانات': 'Data Dictionary',
  'جودة البيانات': 'Data Quality',
  'ممثلو البيانات': 'Data Stewards',
  'ممثلي البيانات': 'Data Stewards',
  'القرارات': 'Decisions',
  'الاجتماعات': 'Meetings',
  'التصويت': 'Voting',
  'محاضر الجلسات': 'Meeting Minutes',
  'الأعضاء': 'Members',
  'الإعدادات': 'Settings',
  'الامتثال التنظيمي': 'Regulatory Compliance',
  'الأصول': 'Assets',

  // ── Route labels ─────────────────────────────────────────────────────────────
  'البريد الإلكتروني': 'Email',

  // ── Common UI strings ────────────────────────────────────────────────────────
  'الملف الشخصي': 'Profile',
  'تسجيل الخروج': 'Sign Out',
  'بحث': 'Search',
  'إضافة': 'Add',
  'حفظ': 'Save',
  'إلغاء': 'Cancel',
  'حذف': 'Delete',
  'تعديل': 'Edit',
  'عرض': 'View',
  'تأكيد': 'Confirm',
  'إغلاق': 'Close',
  'تصدير': 'Export',
  'استيراد': 'Import',
  'تحديث': 'Refresh',
  'بحث...': 'Search...',
  'لا توجد بيانات': 'No data available',
  'تحميل...': 'Loading...',
  'خطأ': 'Error',
  'نجاح': 'Success',
  'تحذير': 'Warning',
  'معلومات': 'Info',
  'جميع': 'All',
  'الكل': 'All',
  'نعم': 'Yes',
  'لا': 'No',
  'إرسال': 'Submit',
  'رفع': 'Upload',
  'تنزيل': 'Download',
  'طباعة': 'Print',
  'مشاركة': 'Share',

  // ── Status labels ────────────────────────────────────────────────────────────
  'مفتوح': 'Open',
  'مغلق': 'Closed',
  'معلق': 'Pending',
  'قيد التنفيذ': 'In Progress',
  'تم الحل': 'Resolved',
  'مكتمل': 'Completed',
  'ملغي': 'Cancelled',
  'مسند': 'Assigned',
  'مسودة': 'Draft',
  'نشط': 'Active',
  'غير نشط': 'Inactive',
  'معتمد': 'Approved',
  'مرفوض': 'Rejected',
  'قيد المراجعة': 'Under Review',
  'قيد التصويت': 'In Voting',
  'معلن': 'Announced',
  'تخطيط': 'Planning',
  'متوقف': 'On Hold',
  'ملتزم': 'Compliant',
  'مخترق': 'Breached',
  'مُصعَّد': 'Escalated',
  'جاري': 'In Progress',
  'مقبول': 'Accepted',
  'مُحال': 'Referred',
  'مُرجَع': 'Returned',

  // ── Priority labels ───────────────────────────────────────────────────────────
  'حرج': 'Critical',
  'عالي': 'High',
  'متوسط': 'Medium',
  'منخفض': 'Low',
  'عاجل': 'Urgent',
  'عادي': 'Normal',
  'مرتفع': 'High',

  // ── Common fields ─────────────────────────────────────────────────────────────
  'الاسم': 'Name',
  'الوصف': 'Description',
  'الحالة': 'Status',
  'الأولوية': 'Priority',
  'الإجراءات': 'Actions',
  'التاريخ': 'Date',
  'تاريخ الإنشاء': 'Created At',
  'تاريخ التحديث': 'Updated At',
  'تاريخ الاستحقاق': 'Due Date',
  'المسؤول': 'Assignee',
  'المنشئ': 'Creator',
  'التعليق': 'Comment',
  'الملاحظات': 'Notes',
  'المرفقات': 'Attachments',
  'الرقم': 'Number',
  'رقم التذكرة': 'Ticket Number',
  'العنوان': 'Title',
  'النوع': 'Type',
  'الفئة': 'Category',
  'النتيجة': 'Result',
  'الإجمالي': 'Total',
  'المجموع': 'Total',
  'التقدم': 'Progress',
  'المسمى الوظيفي': 'Job Title',
  'البوابة': 'Portal',
  'الدور': 'Role',
  'الصلاحيات': 'Permissions',
  'النسبة': 'Percentage',
  'المدة': 'Duration',
  'ساعة': 'hour',
  'ساعات': 'hours',
  'يوم': 'day',
  'أيام': 'days',
  'دقيقة': 'minute',
  'دقائق': 'minutes',

  // ── Profile dialog ────────────────────────────────────────────────────────────

  // ── Dashboard common ──────────────────────────────────────────────────────────
  'إجمالي التذاكر': 'Total Tickets',
  'التذاكر المفتوحة': 'Open Tickets',
  'التذاكر العاجلة': 'Urgent Tickets',
  'المهام المتأخرة': 'Overdue Tasks',
  'المهام النشطة': 'Active Tasks',
  'المشاريع النشطة': 'Active Projects',
  'الإحالات المعلقة': 'Pending Referrals',
  'حوادث الأمن': 'Security Incidents',
  'معدل الإنجاز': 'Completion Rate',
  'معدل الحل': 'Resolution Rate',
  'مؤشر الأداء': 'Performance Score',
  'إجمالي': 'Total',
  'منجز': 'Completed',
  'متأخر': 'Overdue',

  // ── Referrals ─────────────────────────────────────────────────────────────────
  'إحالة جديدة': 'New Referral',
  'إنشاء إحالة جديدة': 'Create New Referral',
  'الإدارة المرسِلة': 'From Department',
  'الإدارة المستقبِلة': 'To Department',
  'رقم الإحالة': 'Referral Number',
  'سبب الإحالة': 'Referral Reason',
  'ساعات SLA': 'SLA Hours',
  'اعتراف بالاستلام': 'Acknowledge',
  'قبول الإحالة': 'Accept',
  'رفض الإحالة': 'Reject',
  'إعادة الإحالة': 'Return',
  'تصعيد': 'Escalate',
  'خرق SLA': 'SLA Breach',

  // ── Ticket types ──────────────────────────────────────────────────────────────
  'حادثة': 'Incident',
  'طلب': 'Request',
  'مشكلة': 'Problem',
  'تغيير': 'Change',
  'استفسار': 'Inquiry',

  // ── Time ─────────────────────────────────────────────────────────────────────
  'اليوم': 'Today',
  'الأمس': 'Yesterday',
  'هذا الأسبوع': 'This Week',
  'هذا الشهر': 'This Month',
  'مستحق اليوم': 'Due Today',
  'مستحق هذا الأسبوع': 'Due This Week',
  'منذ': 'ago',
  'قبل': 'before',
  'بعد': 'after',

  // ── Portal switcher ───────────────────────────────────────────────────────────

  // ── Login page ────────────────────────────────────────────────────────────────
  'تسجيل الدخول': 'Sign In',
  'اسم المستخدم': 'Username',
  'كلمة المرور': 'Password',
  'نظام مركز التحكم': 'Control Hub System',
  'بوابة الوصول الآمن': 'Secure Access Portal',
  'دخول': 'Login',
  'إدارة تقنية المعلومات والتحول الرقمي': 'IT & Digital Transformation Management',

  // ── SmartAssistant ────────────────────────────────────────────────────────────
  'مساعد ذكي': 'Smart Assistant',
  'مجيب': 'Mujeeb AI',
  'اكتب سؤالك هنا...': 'Type your question here...',
  'مسح المحادثة': 'Clear Chat',
  'جارٍ الكتابة...': 'Typing...',

  // ── Notifications ─────────────────────────────────────────────────────────────
  'الإشعارات': 'Notifications',
  'تحديد الكل كمقروء': 'Mark all as read',
  'لا توجد إشعارات': 'No notifications',
  'إشعار جديد': 'New notification',

  // ── Reports ───────────────────────────────────────────────────────────────────
  'التقارير والتصدير': 'Reports & Export',
  'تصدير PDF': 'Export PDF',
  'تصدير Excel': 'Export Excel',
  'تقرير التذاكر': 'Tickets Report',
  'تقرير المشاريع': 'Projects Report',
  'تقرير المهام': 'Tasks Report',
  'تقرير الإحالات': 'Referrals Report',
  'تقرير الأصول': 'Assets Report',
  'تقرير الموردين': 'Vendors Report',
  'تقرير الموظفين': 'Employees Report',
  'تقرير الامتثال': 'Compliance Report',

  // ── Compliance ────────────────────────────────────────────────────────────────
  'غير ملتزم': 'Non-Compliant',
  'قيد التطبيق': 'In Implementation',
  'مستثنى': 'Exempted',
  'PDPL': 'PDPL',
  'NDMO': 'NDMO',

  // ── Data catalog ──────────────────────────────────────────────────────────────
  'أمين البيانات': 'Data Steward',
  'ممثل البيانات': 'Data Representative',
  'جدول': 'Table',
  'عمود': 'Column',
  'نوع البيانات': 'Data Type',
  'حساسية البيانات': 'Data Sensitivity',
  'عام': 'Public',
  'خاص': 'Private',
  'سري': 'Confidential',
  'سري للغاية': 'Top Secret',

  // ── Committee ─────────────────────────────────────────────────────────────────
  'اجتماع': 'Meeting',
  'قرار': 'Decision',
  'تصويت': 'Vote',
  'محضر': 'Minutes',
  'جدول الأعمال': 'Agenda',
  'رئيس اللجنة': 'Committee Chair',
  'عضو': 'Member',
  'نصاب': 'Quorum',
  'نتيجة التصويت': 'Voting Result',
  'موافق': 'Approve',
  'معارض': 'Oppose',
  'ممتنع': 'Abstain',

  // ── Misc ──────────────────────────────────────────────────────────────────────
  'مركز القيادة الحي': 'Live Command Center',
  'لوحة الامتثال': 'Compliance Dashboard',
  'تنبيه': 'Alert',
  'تنبيهات': 'Alerts',
  'قاعدة التنبيه': 'Alert Rule',
  'أتمتة': 'Automation',
  'قالب': 'Template',
  'الموافقة': 'Approval',
  'الرفض': 'Rejection',
  'العودة': 'Back',
  'التالي': 'Next',
  'السابق': 'Previous',
  'عرض الكل': 'View All',
  'إظهار المزيد': 'Show More',
  'إخفاء': 'Hide',
  'تصفية': 'Filter',
  'ترتيب': 'Sort',
  'بحث متقدم': 'Advanced Search',
  'لا يوجد': 'None',
  'غير محدد': 'Unspecified',
  'غير متاح': 'Unavailable',
  'جديد': 'New',
  'محدّث': 'Updated',
  'ملاحظة': 'Note',
  'تفاصيل': 'Details',
  'ملخص': 'Summary',
  'نظرة عامة': 'Overview',
  'إحصاءات': 'Statistics',
  'نشاط': 'Activity',
  'سجل': 'Log',
  'تاريخ': 'History',
  'الموقع': 'Location',
  'المنطقة': 'Region',
  'المدينة': 'City',
  'رقم الهاتف': 'Phone Number',
  'الامتداد': 'Extension',
  'IP': 'IP',
  'نوع الجهاز': 'Device Type',
  'الشركة المصنعة': 'Manufacturer',
  'الموديل': 'Model',
  'الرقم التسلسلي': 'Serial Number',
  'تاريخ الشراء': 'Purchase Date',
  'تاريخ الانتهاء': 'Expiry Date',
  'الضمان': 'Warranty',
  'الحالة التشغيلية': 'Operational Status',
  'المبلغ': 'Amount',
  'العملة': 'Currency',
  'العقد': 'Contract',
  'تاريخ بدء العقد': 'Contract Start Date',
  'تاريخ انتهاء العقد': 'Contract End Date',
  'قيمة العقد': 'Contract Value',
  'تقييم المورد': 'Vendor Rating',
  'مستوى الخدمة': 'Service Level',
  'نوع الخدمة': 'Service Type',
  'خطة الطوارئ': 'Contingency Plan',
  'مخطط للمشروع': 'Planned',
  'فعلي': 'Actual',
  'الميزانية': 'Budget',
  'التكلفة الفعلية': 'Actual Cost',
  'نسبة الإنجاز': 'Completion %',
  'مدير المشروع': 'Project Manager',
  'فريق المشروع': 'Project Team',
  'معرّف': 'ID',
  'الرمز': 'Code',
  'الوسم': 'Tag',
  'وسوم': 'Tags',

  // ── DMO-specific ────────────────────────────────────────────────────────────
  'حوادث البيانات': 'Data Incidents',
  'مركز حوادث البيانات والخصوصية': 'Data & Privacy Incidents Center',
  'سجل حوادث البيانات والخصوصية': 'Data & Privacy Incidents Log',
  'حادثة بيانات جديدة': 'New Data Incident',
  'تفاصيل حادثة البيانات': 'Data Incident Details',
  'إجمالي الحوادث': 'Total Incidents',
  'حوادث مفتوحة': 'Open Incidents',

  // ── Login page ──────────────────────────────────────────────────────────────
  'أدخل بيانات الاعتماد للوصول إلى النظام': 'Enter your credentials to access the system',
  'جاري...': 'Loading...',
  'اتصال مشفر وآمن': 'Secure encrypted connection',
  'النظام متصل': 'System online',
  'انتهت الجلسة': 'Session expired',
  'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.': 'Your session has expired. Please sign in again.',
  'تم تسجيل الدخول بنجاح': 'Signed in successfully',
  'جاري الدخول...': 'Signing in...',
  'نسيت كلمة المرور؟': 'Forgot password?',
  'تواصل مع مدير النظام لإعادة تعيين كلمة المرور الخاصة بك.': 'Contact the system administrator to reset your password.',
  'خطأ في تسجيل الدخول': 'Login failed',
  'تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد 15 دقيقة.': 'Account temporarily locked due to multiple failed attempts. Try again in 15 minutes.',
  'البريد الإلكتروني أو كلمة المرور غير صحيحة': 'Incorrect email or password',
  'الحساب غير مفعل — تحقق من بريدك الإلكتروني أو تواصل مع المسؤول.': 'Account not activated — check your email or contact the admin.',
  'الحساب معطل — تواصل مع مدير النظام.': 'Account disabled — contact the system administrator.',
  'حدث خطأ في الاتصال بالسيرفر. حاول مرة أخرى.': 'Connection error. Please try again.',
};

export { EN };
