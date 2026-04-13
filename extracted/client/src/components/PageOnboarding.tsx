import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronLeft, ChevronRight, Zap, ArrowLeft, CheckCircle2, Shield, Server, Headphones, Database, BarChart3, Users, FileText, Settings, Vote, BookOpen, Eye, Lock, TrendingUp, ClipboardList, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';

interface PageFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  href?: string;
  hrefLabel?: string;
}

interface PageInfo {
  title: string;
  greeting: string;
  roleLabel?: string;
  emoji?: string;
  features: PageFeature[];
}

// ===================== ROLE-SPECIFIC MAP =====================
const roleInfoMap: Record<string, PageInfo> = {
  system_admin: {
    title: 'لوحة تحكم مسؤول النظام',
    greeting: 'أنت تملك صلاحية التحكم الكامل — إدارة المستخدمين والإعدادات والسجلات كلها بين يديك',
    roleLabel: 'مسؤول النظام',
    emoji: '⚙️',
    features: [
      { icon: <Users className="w-5 h-5" />, title: 'إدارة المستخدمين', description: 'أضف مستخدمين جدد، عيّن الأدوار والبوابات، وفعّل/عطّل الحسابات', tip: 'انقر على صف المستخدم لعرض تفاصيله كاملة', href: '/admin/users', hrefLabel: 'إدارة المستخدمين' },
      { icon: <Settings className="w-5 h-5" />, title: 'إعدادات النظام', description: 'تحكم في قواعد التنبيه، قوالب التذاكر، وقواعد الأتمتة', tip: 'فعّل التقارير الأسبوعية التلقائية لتوفير اجتماعات المتابعة', href: '/admin/alert-rules', hrefLabel: 'قواعد التنبيه' },
      { icon: <Eye className="w-5 h-5" />, title: 'سجل التدقيق الكامل', description: 'تتبع كل العمليات والتغييرات التي يجريها جميع المستخدمين مع تحليلات مفصّلة وتصدير', tip: 'انقر على أي سجل لعرض القيم القديمة والجديدة بتنسيق JSON diff', href: '/admin/audit', hrefLabel: 'سجل التدقيق' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'لوحة KPI التنفيذية', description: 'استعرض مؤشرات الأداء الرئيسية عبر جميع الأقسام وصدّر تقارير PDF', tip: 'مقارنة الأسبوع الحالي بالسابق متاحة بشارات ▲▼', href: '/admin/kpi', hrefLabel: 'لوحة KPI' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن إحصائيات المنصة، المستخدمين، التنبيهات، أو اطلب توصيات ذكية', tip: 'جرّب: "نصائح وتوصيات" أو "وضع جميع الأقسام" للحصول على تقرير فوري' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'الأطر التنظيمية', description: 'استعرض أطر NCA و NDMO و DGA الكاملة وتابع نسب الامتثال لكل إطار', tip: 'اسأل مجيب: "ما ضوابط ECC-2:2024؟" للحصول على شرح مفصّل لكل ضابط' },
    ]
  },

  it_director: {
    title: 'بوابة مدير تقنية المعلومات',
    greeting: 'أنت ترى الصورة الكاملة — جميع الأقسام ومؤشراتها تحت نظرك مباشرة',
    roleLabel: 'مدير تقنية المعلومات',
    emoji: '🏢',
    features: [
      { icon: <BarChart3 className="w-5 h-5" />, title: 'مركز القيادة الحي', description: 'نظرة فورية على جميع الأقسام الأربعة — الخوادم، الأمن، التحول الرقمي، والدعم', tip: 'اضغط F للدخول وضع الشاشة الكاملة في مركز القيادة', href: '/it-director/command-center', hrefLabel: 'مركز القيادة' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'تصعيد التذاكر', description: 'استقبل التذاكر المصعّدة وقرر تحويلها أو إغلاقها مع تتبع SLA', tip: 'التذاكر الحرجة تصلك بإشعار تلقائي فوراً', href: '/it-director/escalations', hrefLabel: 'التصعيدات' },
      { icon: <TrendingUp className="w-5 h-5" />, title: 'التقارير الأسبوعية', description: 'تصلك تقارير كل أحد بملخص جميع الأقسام — لا تحتاج أن تطلبها', tip: 'يمكنك تصدير أي تقرير بصيغة PDF أو Excel', href: '/it-director', hrefLabel: 'لوحة التحكم' },
      { icon: <FileText className="w-5 h-5" />, title: 'KPI التنفيذي', description: 'اضغط "تصدير" في لوحة KPI لتحميل تقرير مصوّر بالنادي والذهبي', tip: 'مقارنة أداء الأسابيع متاحة مباشرة بالشارات', href: '/it-director/kpi', hrefLabel: 'لوحة KPI' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن أي قسم، قارن الأداء، أو اطلب توصيات ذكية لقراراتك', tip: 'جرّب: "قارن الأقسام" أو "نصائح وتوصيات" للحصول على تحليل فوري' },
      { icon: <Users className="w-5 h-5" />, title: 'مقارنة الأقسام', description: 'قارن أداء جميع الأقسام جنباً إلى جنب — التذاكر، SLA، المهام', tip: 'اسأل مجيب: "قارن الأقسام" للحصول على تقرير مقارنة حية' },
    ]
  },

  it_infrastructure_manager: {
    title: 'مدير البنية التحتية',
    greeting: 'أنت مسؤول الخوادم والشبكات والأصول — يمكنك إدارة كل شيء من هنا',
    roleLabel: 'مدير البنية التحتية',
    emoji: '🖥️',
    features: [
      { icon: <Server className="w-5 h-5" />, title: 'إضافة وإدارة الخوادم', description: 'أضف خوادم جديدة عبر زر "إضافة سيرفر"، وتابع حالتها مباشرة', tip: 'الخوادم المتوقفة تُلوّن بالأحمر تلقائياً', href: '/department/infrastructure/servers', hrefLabel: 'الخوادم' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'تذاكر قسمك فقط', description: 'ترى التذاكر المسندة لقسمك، يمكنك إنشاؤها وتحديث حالتها', tip: 'استخدم الفلاتر لترتيب التذاكر حسب SLA أو الأولوية', href: '/department/infrastructure/tickets', hrefLabel: 'التذاكر' },
      { icon: <Users className="w-5 h-5" />, title: 'تكليف الفريق بالمهام', description: 'وزّع المهام على أعضاء فريقك من خلال المخطط', tip: 'تلقّى إشعاراً فورياً عند تحديث حالة أي مهمة', href: '/department/infrastructure/tasks', hrefLabel: 'مهام الفريق' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'لوحة أداء القسم', description: 'تابع معدل حل التذاكر وSLA وأداء الفريق', tip: 'مجيب يعطيك ملخصاً فورياً — اسأله "إحصائيات القسم"', href: '/department/infrastructure', hrefLabel: 'لوحة التحكم' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن حالة الخوادم، التذاكر المتأخرة، أو اطلب توصيات ذكية لتحسين الأداء', tip: 'جرّب: "نصائح وتوصيات" أو "عبء الفريق" لتقييم الوضع' },
    ]
  },

  it_infrastructure_staff: {
    title: 'موظف البنية التحتية',
    greeting: 'أنت عضو في فريق البنية التحتية — مهامك وتذاكرك في انتظارك',
    roleLabel: 'موظف البنية التحتية',
    emoji: '🔧',
    features: [
      { icon: <ClipboardList className="w-5 h-5" />, title: 'مهامي الواردة', description: 'اعرض المهام المسندة إليك واضغط "تحديث الحالة" لتحديث التقدم', tip: 'يمكنك إضافة تعليق عند تحديث الحالة لإبلاغ المدير', href: '/department/infrastructure/tasks', hrefLabel: 'مهامي' },
      { icon: <Server className="w-5 h-5" />, title: 'إضافة أصول IT', description: 'سجّل الأصول الجديدة (خوادم، أجهزة) عبر "إضافة سيرفر"', tip: 'سجّل الأجهزة مع serial number لتسهيل التتبع مستقبلاً', href: '/department/infrastructure/servers', hrefLabel: 'الخوادم' },
      { icon: <FileText className="w-5 h-5" />, title: 'تذاكر القسم', description: 'اطلع على تذاكر البنية التحتية وساعد في معالجتها', tip: 'تذاكر SLA الحرجة لها مؤقت حي — انتبه للعداد', href: '/department/infrastructure/tickets', hrefLabel: 'التذاكر' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'المخطط اليومي', description: 'استخدم المخطط لتنظيم مهامك اليومية وتحديث حالتها', tip: 'اسأل مجيب عن "ملخص يومي" لمعرفة أولوياتك', href: '/department/infrastructure/tasks', hrefLabel: 'المخطط' },
    ]
  },

  it_cybersecurity_manager: {
    title: 'مدير الأمن السيبراني',
    greeting: 'أنت حارس الشبكة — إدارة التهديدات والثغرات وضمان الامتثال لـ NCA',
    roleLabel: 'مدير الأمن السيبراني',
    emoji: '🛡️',
    features: [
      { icon: <Shield className="w-5 h-5" />, title: 'إدارة الحوادث الأمنية', description: 'سجّل الحوادث، صنّفها، وتابع معالجتها في 6 مراحل', tip: 'المراحل: اكتشاف → تحليل → احتواء → استئصال → استعادة → دروس مستفادة', href: '/department/cybersecurity/incidents', hrefLabel: 'الحوادث' },
      { icon: <Lock className="w-5 h-5" />, title: 'تقييم الثغرات', description: 'أضف الثغرات المكتشفة، حدد أولوياتها، وتتبع معالجتها', tip: 'ثغرات CVSS ≥ 9 = حرجة — يجب معالجتها خلال 72 ساعة', href: '/department/cybersecurity/vulnerabilities', hrefLabel: 'الثغرات' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'نسبة امتثال NCA', description: 'تابع نسبة الامتثال لضوابط ECC-2:2024 (108 ضابط)', tip: 'اسأل مجيب: "ما نسبة الامتثال لـ ECC؟" للحصول على إجابة فورية', href: '/department/cybersecurity', hrefLabel: 'لوحة التحكم' },
      { icon: <FileText className="w-5 h-5" />, title: 'تقييم المخاطر الأمنية', description: 'أنشئ تقييمات مخاطر شاملة واربطها بضوابط NCA مباشرة', tip: 'ربط المخاطر بضوابط ECC يسرّع عملية إغلاق الامتثال', href: '/department/cybersecurity', hrefLabel: 'المخاطر' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن الحوادث، الثغرات، الامتثال، أو اطلب توصيات أمنية ذكية', tip: 'جرّب: "نصائح وتوصيات" أو "نسبة الامتثال ECC" للحصول على تحليل فوري' },
    ]
  },

  it_cybersecurity_staff: {
    title: 'موظف الأمن السيبراني',
    greeting: 'أنت خط الدفاع الأول — راقب، ابلغ، واستجب بسرعة',
    roleLabel: 'موظف الأمن السيبراني',
    emoji: '🔐',
    features: [
      { icon: <Shield className="w-5 h-5" />, title: 'الإبلاغ عن حوادث', description: 'استخدم "إضافة حادثة" للإبلاغ الفوري — المدير يتلقى إشعاراً فوراً', tip: 'كلما كان البلاغ أسرع كلما كان الاحتواء أفضل', href: '/department/cybersecurity/incidents', hrefLabel: 'الحوادث' },
      { icon: <Lock className="w-5 h-5" />, title: 'رصد الثغرات', description: 'سجّل الثغرات التي تكتشفها وضع تفاصيل CVSS', tip: 'استخدم NVD أو MITRE ATT&CK لتفاصيل CVE', href: '/department/cybersecurity/vulnerabilities', hrefLabel: 'الثغرات' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'مهامي الأمنية', description: 'المهام المسندة إليك تظهر في "المهام الواردة" — حدّث حالتها فور إنجازها', tip: 'أنجز المهام الحرجة في المنصة لإخطار المدير مباشرة', href: '/department/cybersecurity', hrefLabel: 'مهامي' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'قاعدة المعرفة الأمنية', description: 'ارجع لقاعدة المعرفة لإجراءات الاستجابة الموثقة', tip: 'أضف حلول الحوادث لقاعدة المعرفة لمساعدة زملائك', href: '/department/cybersecurity/knowledge-base', hrefLabel: 'قاعدة المعرفة' },
    ]
  },

  it_digital_manager: {
    title: 'مدير التحول الرقمي',
    greeting: 'أنت قائد رحلة التحول — مشاريعك ومبادراتك الرقمية كلها هنا',
    roleLabel: 'مدير التحول الرقمي',
    emoji: '💡',
    features: [
      { icon: <TrendingUp className="w-5 h-5" />, title: 'المبادرات الرقمية', description: 'أنشئ مبادرات رقمية، حدد مراحلها وميزانياتها، وتابع التقدم', tip: 'ربط المبادرات بمؤشرات DGA يسهّل التقارير الرسمية', href: '/department/digital-transformation/initiatives', hrefLabel: 'المبادرات' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'إدارة المشاريع', description: 'أضف مشاريع جديدة، عيّن أعضاء الفريق، وتابع نسبة الإنجاز', tip: 'شريط التقدم الملوّن يعكس نسبة الإنجاز تلقائياً', href: '/department/digital-transformation/projects', hrefLabel: 'المشاريع' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'التطبيقات الرقمية', description: 'سجّل التطبيقات والأنظمة الرقمية مع بياناتها التقنية', tip: 'دوّن دورة حياة كل تطبيق لتخطيط الاستبدال مبكراً', href: '/department/digital-transformation/applications', hrefLabel: 'التطبيقات' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'لوحة الأداء الرقمي', description: 'تابع معايير DGA للتحول الرقمي وقارن أداءك بالمؤشرات الوطنية', tip: 'اسأل مجيب: "ما معايير DGA للتحول الرقمي؟"', href: '/department/digital-transformation/kpi', hrefLabel: 'لوحة KPI' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن المشاريع، المبادرات، أو اطلب توصيات لتسريع التحول الرقمي', tip: 'جرّب: "نصائح وتوصيات" أو "المشاريع الرقمية النشطة" للحصول على تقرير فوري' },
    ]
  },

  it_digital_staff: {
    title: 'موظف التحول الرقمي',
    greeting: 'أنت جزء من فريق الابتكار — مهامك في المشاريع الرقمية تنتظرك',
    roleLabel: 'موظف التحول الرقمي',
    emoji: '🚀',
    features: [
      { icon: <ClipboardList className="w-5 h-5" />, title: 'مهامي في المشاريع', description: 'اعرض المهام المسندة إليك في مشاريع التحول الرقمي', tip: 'حدّث نسبة الإنجاز يومياً ليظهر في تقارير المدير', href: '/department/digital-transformation', hrefLabel: 'مهامي' },
      { icon: <TrendingUp className="w-5 h-5" />, title: 'المبادرات الجارية', description: 'اطلع على المبادرات الرقمية وشارك في تحديث حالتها', tip: 'تعليقاتك على المبادرات تصل للمدير فوراً', href: '/department/digital-transformation/initiatives', hrefLabel: 'المبادرات' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'تطوير التطبيقات', description: 'سجّل التطبيقات الرقمية وحدّث بياناتها التقنية ودورة حياتها', tip: 'التوثيق الجيد اليوم يوفّر عليك جهداً كبيراً غداً', href: '/department/digital-transformation/applications', hrefLabel: 'التطبيقات' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'المخطط الرقمي', description: 'نظّم مهامك الرقمية بالمخطط اليومي', tip: 'اسأل مجيب: "ملخص يومي" لمعرفة أولوياتك فوراً', href: '/department/digital-transformation', hrefLabel: 'المخطط' },
    ]
  },

  it_support_manager: {
    title: 'مدير الدعم الفني',
    greeting: 'أنت محور رضا المستخدمين — تذاكرهم وSLA قسمك تحت يدك',
    roleLabel: 'مدير الدعم الفني',
    emoji: '🎧',
    features: [
      { icon: <Headphones className="w-5 h-5" />, title: 'تذاكر قسمك', description: 'استعرض جميع تذاكر الدعم الفني، فلترها حسب الأولوية وحالة SLA', tip: 'مؤقت SLA مرئي على كل تذكرة — أحمر = تجاوز الوقت', href: '/department/support/tickets', hrefLabel: 'التذاكر' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'مؤشرات الأداء', description: 'تابع معدل الحل، متوسط وقت الاستجابة، ورضا المستخدمين', tip: 'هدف الدعم الفني: حل 80% من تذاكر P2 في 8 ساعات', href: '/department/support/kpi', hrefLabel: 'لوحة KPI' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'توزيع المهام', description: 'وزّع التذاكر والمهام على موظفي الفريق وتابع أدائهم', tip: 'الإحالات للأقسام الأخرى تتبعها في قائمة الإحالات', href: '/department/support/tasks', hrefLabel: 'مهام الفريق' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'قاعدة المعرفة', description: 'أضف حلولاً موثقة لتسريع معالجة التذاكر المتكررة', tip: 'تذاكر في قاعدة المعرفة = وقت أسرع للحل المستقبلي', href: '/department/support/knowledge-base', hrefLabel: 'قاعدة المعرفة' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن تذاكر القسم، حالة SLA، أو اطلب توصيات لتحسين الخدمة', tip: 'جرّب: "نصائح وتوصيات" أو "حالة SLA" للحصول على تقرير فوري' },
    ]
  },

  it_support_staff: {
    title: 'موظف الدعم الفني',
    greeting: 'أنت صوت الدعم للمستخدمين — حلّ تذاكرهم بسرعة وبجودة',
    roleLabel: 'موظف الدعم الفني',
    emoji: '💼',
    features: [
      { icon: <Headphones className="w-5 h-5" />, title: 'تذاكر معلّقة', description: 'ترى التذاكر المسندة لك — غيّر حالتها من "جاري" إلى "محلول" عند الانتهاء', tip: 'الرد خلال 15 دقيقة من فتح التذكرة مهم لمؤشر SLA', href: '/department/support/tickets', hrefLabel: 'تذاكري' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'مهامي الواردة', description: 'المهام التي كلّفك بها المدير تظهر هنا', tip: 'حدّث الحالة فور إنجاز كل مهمة لتبليغ المدير', href: '/department/support/tasks', hrefLabel: 'مهامي' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'قاعدة المعرفة', description: 'ابحث في الحلول الجاهزة قبل حل كل مشكلة جديدة', tip: 'Ctrl+K يفتح البحث السريع في أي مكان بالمنصة', href: '/department/support/knowledge-base', hrefLabel: 'قاعدة المعرفة' },
      { icon: <FileText className="w-5 h-5" />, title: 'إنشاء تذكرة', description: 'أنشئ تذاكر جديدة للمستخدمين مباشرة بضغطة زر', tip: 'تذاكر الأولوية الحرجة تصل للمدير فوراً بإشعار', href: '/department/support', hrefLabel: 'إنشاء تذكرة' },
    ]
  },

  dmo_manager: {
    title: 'مدير مكتب إدارة البيانات',
    greeting: 'أنت حارس بيانات النادي — حوكمتها وامتثالها وجودتها مسؤوليتك',
    roleLabel: 'مدير DMO',
    emoji: '📊',
    features: [
      { icon: <Database className="w-5 h-5" />, title: 'أصول البيانات والحوكمة', description: 'أضف أصول البيانات، صنّفها، وعيّن مسؤولين (Data Stewards) لكل أصل', tip: 'تصنيف البيانات في 5 مستويات: عام، داخلي، سري، حساس جداً، سري للغاية', href: '/dmo/data-catalog', hrefLabel: 'كتالوج البيانات' },
      { icon: <Shield className="w-5 h-5" />, title: 'امتثال NDMO و PDPL', description: 'تابع نسبة الامتثال لـ 191 متطلب NDMO في 15 مجالاً', tip: 'مهلة DSR بموجب PDPL = 30 يوماً — راقبها في قسم DSR', href: '/dmo/compliance-monitoring', hrefLabel: 'الامتثال' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'جودة البيانات', description: 'أنشئ قواعد الجودة، راقب نتائجها، وتابع التحسن عبر الوقت', tip: 'أبعاد الجودة السبعة: دقة، اكتمال، اتساق، توقيت...', href: '/dmo', hrefLabel: 'لوحة DMO' },
      { icon: <FileText className="w-5 h-5" />, title: 'سجل المشاركات الخارجية', description: 'وثّق طلبات مشاركة البيانات الخارجية EDSR مع أرقام مرجعية', tip: 'كل مشاركة خارجية تحتاج موافقة رسمية — وثّقها هنا', href: '/dmo/dsr', hrefLabel: 'سجل EDSR' },
      { icon: <Sparkles className="w-5 h-5" />, title: 'المساعد الذكي "مجيب"', description: 'اسأل مجيب عن طلبات DSR، حالة الامتثال، أو اطلب توصيات لحوكمة البيانات', tip: 'جرّب: "نصائح وتوصيات" أو "طلبات DSR المعلقة" للحصول على تقرير فوري' },
    ]
  },

  dmo_staff: {
    title: 'موظف مكتب البيانات',
    greeting: 'أنت جزء من فريق حوكمة البيانات — مهامك وطلباتك في انتظارك',
    roleLabel: 'موظف DMO',
    emoji: '🗄️',
    features: [
      { icon: <Database className="w-5 h-5" />, title: 'تصفح كتالوج البيانات', description: 'استعرض أصول البيانات والجداول المكتشفة وابحث في قاموس البيانات', tip: 'يمكنك اكتشاف قواعد البيانات الخارجية تلقائياً', href: '/dmo/data-catalog', hrefLabel: 'كتالوج البيانات' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'طلبات DMO', description: 'أنشئ طلبات بيانات وتابع الاستجابات عليها', tip: 'يمكنك إرفاق ملفات الدعم مع كل طلب', href: '/dmo', hrefLabel: 'طلبات DMO' },
      { icon: <Shield className="w-5 h-5" />, title: 'أدلة الامتثال', description: 'ارفع أدلة الامتثال لمتطلبات NDMO واربطها بالمتطلب المعني', tip: 'الأدلة المرفوعة تُحسّن نسبة الامتثال فوراً', href: '/dmo/compliance-monitoring', hrefLabel: 'الامتثال' },
      { icon: <FileText className="w-5 h-5" />, title: 'طلبات أصحاب البيانات', description: 'استعرض وعالج طلبات DSR خلال مهلة 30 يوم PDPL', tip: 'أنواع DSR: حذف، تصحيح، الاطلاع، نقل البيانات', href: '/dmo/dsr', hrefLabel: 'طلبات DSR' },
    ]
  },

  committee_chairman: {
    title: 'رئيس اللجنة',
    greeting: 'أنت من يقود مسار القرارات — الاجتماعات والتصويت والقرارات تحت إشرافك',
    roleLabel: 'رئيس اللجنة',
    emoji: '🏛️',
    features: [
      { icon: <Users className="w-5 h-5" />, title: 'جدولة الاجتماعات', description: 'أنشئ اجتماعات جديدة، حدد جدول الأعمال، وأرسل دعوات للأعضاء', tip: 'الدعوات تُرسل تلقائياً بالبريد الإلكتروني عند إنشاء الاجتماع', href: '/committee/meetings', hrefLabel: 'الاجتماعات' },
      { icon: <Vote className="w-5 h-5" />, title: 'إدارة التصويت', description: 'افتح جلسات التصويت على القرارات وتابع نتائجها', tip: 'النصاب القانوني يُحسب تلقائياً — لن تحتاج لعدّ الأصوات', href: '/committee/voting', hrefLabel: 'التصويت' },
      { icon: <FileText className="w-5 h-5" />, title: 'اعتماد القرارات', description: 'راجع القرارات المعلقة واعتمدها أو أعدها للتصويت', tip: 'القرارات المعتمدة تظهر في سجل رسمي قابل للتصدير', href: '/committee/decisions', hrefLabel: 'القرارات' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'سجل المحاضر', description: 'استعرض محاضر الاجتماعات السابقة ووثّق القرارات رسمياً', tip: 'تصدير المحاضر بصيغة PDF متاح بضغطة زر', href: '/committee/minutes', hrefLabel: 'المحاضر' },
    ]
  },

  committee_member: {
    title: 'عضو اللجنة',
    greeting: 'صوتك يحدث فرقاً — التصويت على القرارات ومراجعة الاجتماعات من هنا',
    roleLabel: 'عضو اللجنة',
    emoji: '🗳️',
    features: [
      { icon: <Vote className="w-5 h-5" />, title: 'التصويت على القرارات', description: 'صوّت بـ موافق / رفض / امتناع مع إمكانية كتابة ملاحظاتك', tip: 'يمكنك التصويت وإضافة ملاحظة توضيحية لقرارك', href: '/committee/voting', hrefLabel: 'التصويت' },
      { icon: <Users className="w-5 h-5" />, title: 'اجتماعاتي القادمة', description: 'اطلع على الاجتماعات المجدولة وجداول أعمالها', tip: 'إشعار يصلك قبل 24 ساعة من كل اجتماع', href: '/committee/meetings', hrefLabel: 'الاجتماعات' },
      { icon: <FileText className="w-5 h-5" />, title: 'القرارات المعلقة', description: 'اعرض القرارات التي تنتظر تصويتك قبل إغلاق الجلسة', tip: 'صوّت قبل انتهاء مهلة الجلسة للحفاظ على النصاب', href: '/committee/decisions', hrefLabel: 'القرارات' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'محاضر الاجتماعات', description: 'راجع محاضر الاجتماعات التي حضرتها وتحقق من دقة التوثيق', tip: 'أي ملاحظات على المحضر يمكن إرسالها للمقرر مباشرة', href: '/committee/minutes', hrefLabel: 'المحاضر' },
    ]
  },

  committee_rapporteur: {
    title: 'مقرر اللجنة',
    greeting: 'أنت حافظ ذاكرة اللجنة — توثيق المحاضر والقرارات مسؤوليتك',
    roleLabel: 'مقرر اللجنة',
    emoji: '📝',
    features: [
      { icon: <FileText className="w-5 h-5" />, title: 'كتابة المحاضر', description: 'أنشئ محاضر الاجتماعات وسجّل القرارات والتوصيات بشكل منظم', tip: 'رقم المحضر يُولّد تلقائياً بتسلسل MIN-XXXX', href: '/committee/minutes', hrefLabel: 'المحاضر' },
      { icon: <Users className="w-5 h-5" />, title: 'تسجيل الحضور', description: 'سجّل حضور أعضاء اللجنة في كل اجتماع لضمان النصاب', tip: 'يُحسب معدل حضور كل عضو تلقائياً في صفحة الأعضاء', href: '/committee/members', hrefLabel: 'الأعضاء' },
      { icon: <Vote className="w-5 h-5" />, title: 'توثيق نتائج التصويت', description: 'دوّن نتائج التصويت وأسماء المصوّتين في المحضر الرسمي', tip: 'النتائج تُحسب تلقائياً — أنت تراجع فقط للتأكيد', href: '/committee/voting', hrefLabel: 'التصويت' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'أرشيف القرارات', description: 'استعرض القرارات السابقة وتأكد من متابعة تنفيذها', tip: 'فلتر بالتاريخ أو الموضوع للعثور على أي قرار سابق', href: '/committee/decisions', hrefLabel: 'أرشيف القرارات' },
    ]
  },

  data_steward: {
    title: 'أمين البيانات',
    greeting: 'أنت مسؤول جودة أصول البيانات المسندة إليك — حافظ على دقتها واتساقها',
    roleLabel: 'أمين البيانات',
    emoji: '🛡️',
    features: [
      { icon: <Database className="w-5 h-5" />, title: 'أصولي البيانية', description: 'اعرض الأصول البيانية المسندة إليك وحدّث أوصافها', tip: 'وصف واضح للأصل يساعد الفرق في اكتشافه واستخدامه', href: '/dmo/data-catalog', hrefLabel: 'كتالوج البيانات' },
      { icon: <BarChart3 className="w-5 h-5" />, title: 'قواعد جودة البيانات', description: 'حدّث قواعد الجودة وراجع نتائج الفحص', tip: 'حدّد عتبة الجودة المقبولة لكل أصل وراقب التحقق', href: '/dmo', hrefLabel: 'الجودة' },
      { icon: <ClipboardList className="w-5 h-5" />, title: 'تدفقات البيانات', description: 'وثّق مصادر البيانات ومساراتها بين الأنظمة', tip: 'Lineage واضح = تتبع سهل لأي مشكلة في البيانات', href: '/dmo', hrefLabel: 'تدفقات البيانات' },
      { icon: <FileText className="w-5 h-5" />, title: 'قاموس البيانات', description: 'أضف وحدّث مصطلحات قاموس البيانات', tip: 'توحيد المصطلحات يمنع سوء الفهم بين الأقسام', href: '/dmo', hrefLabel: 'قاموس البيانات' },
    ]
  },

  data_representative: {
    title: 'ممثل البيانات',
    greeting: 'أنت الحلقة بين الإدارات ومكتب البيانات — طلباتك تبدأ من هنا',
    roleLabel: 'ممثل البيانات',
    emoji: '🔗',
    features: [
      { icon: <FileText className="w-5 h-5" />, title: 'تقديم طلبات البيانات', description: 'أنشئ طلبات DMO للحصول على بيانات أو الاستفسار عنها', tip: 'أرفق مبرر الطلب لتسريع الموافقة', href: '/dmo', hrefLabel: 'طلبات DMO' },
      { icon: <Database className="w-5 h-5" />, title: 'تصفح الكتالوج', description: 'ابحث في كتالوج البيانات للعثور على الأصول التي تحتاجها', tip: 'ابحث باسم الجدول أو النظام أو الموضوع', href: '/dmo/data-catalog', hrefLabel: 'كتالوج البيانات' },
      { icon: <Shield className="w-5 h-5" />, title: 'ملاحظات الخصوصية', description: 'اطلع على ملاحظات الخصوصية المعتمدة وتأكد من توافق قسمك', tip: 'معالجة البيانات الشخصية تحتاج سند نظامي واضح', href: '/dmo', hrefLabel: 'الخصوصية' },
      { icon: <BookOpen className="w-5 h-5" />, title: 'طلبات أصحاب البيانات', description: 'تابع طلبات DSR المرتبطة بإدارتك', tip: 'DSR يجب معالجتها خلال 30 يوم بموجب PDPL', href: '/dmo/dsr', hrefLabel: 'طلبات DSR' },
    ]
  },
};

// Fallback pages
const pageInfoMap: Record<string, PageInfo> = {
  '/admin': { title: 'لوحة تحكم المسؤول', greeting: 'مرحباً بك في مركز القيادة', emoji: '⚙️', features: [
    { icon: <Users className="w-5 h-5" />, title: 'إدارة المستخدمين', description: 'إضافة وتعديل وحذف المستخدمين', href: '/admin/users', hrefLabel: 'المستخدمون' },
    { icon: <Sparkles className="w-5 h-5" />, title: 'سجل العمليات', description: 'تتبع جميع العمليات في النظام', href: '/admin/audit', hrefLabel: 'سجل التدقيق' },
  ]},
  '/committee': { title: 'بوابة اللجنة', greeting: 'مرحباً بك في مركز القرارات', emoji: '🏛️', features: [
    { icon: <Users className="w-5 h-5" />, title: 'الاجتماعات', description: 'جدولة وإدارة اجتماعات اللجنة', href: '/committee/meetings', hrefLabel: 'الاجتماعات' },
    { icon: <Vote className="w-5 h-5" />, title: 'التصويت', description: 'التصويت على القرارات', href: '/committee/voting', hrefLabel: 'التصويت' },
  ]},
};

// ===================== STORAGE KEYS =====================
function getStorageKey(roleOrPath: string): string {
  return `onboarding-seen-v2-${roleOrPath}`;
}

// ===================== COMPONENT =====================
export function PageOnboarding() {
  const { user } = useAuth();
  const [location] = useLocation();
  const role = (user as any)?.role || '';
  const pageKey = getStorageKey(role || location.split('/')[1]);

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem(pageKey);
    if (!hasSeen && (role || location)) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [pageKey]);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(pageKey, 'true');
    setVisible(false);
    setStep(0);
  };

  const info = roleInfoMap[role] || pageInfoMap[location] || null;
  if (!info || !visible) return null;

  const features = info.features;
  const totalSteps = features.length;
  const currentFeature = features[step];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => dismiss(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-gradient-to-br from-[#0d1e3d] via-[#0a1628] to-[#061020] border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
                <button
                  onClick={() => dismiss(false)}
                  className="absolute top-4 left-4 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl">{info.emoji || '✨'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{info.title}</h2>
                    </div>
                    {info.roleLabel && (
                      <span className="text-xs text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/30 px-2 py-0.5 rounded-full">
                        {info.roleLabel}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-white/60 mt-2 leading-relaxed">{info.greeting}</p>

                {/* Progress dots */}
                <div className="flex items-center gap-2 mt-4">
                  {features.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`transition-all rounded-full ${i === step
                        ? 'w-6 h-2 bg-[#c9a84c]'
                        : i < step
                          ? 'w-2 h-2 bg-[#c9a84c]/50'
                          : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-white/30 mr-1">{step + 1} / {totalSteps}</span>
                </div>
              </div>

              {/* Feature detail */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="px-6 py-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c9a84c]/20 to-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center text-[#c9a84c] shrink-0">
                      {currentFeature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-white mb-1">{currentFeature.title}</h3>
                      <p className="text-sm text-white/70 leading-relaxed">{currentFeature.description}</p>
                      {currentFeature.tip && (
                        <div className="mt-3 flex items-start gap-2 bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-3 py-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#c9a84c] shrink-0 mt-0.5" />
                          <p className="text-xs text-[#c9a84c]/90 leading-relaxed">{currentFeature.tip}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Try it button */}
                  {currentFeature.href && (
                    <a
                      href={currentFeature.href}
                      onClick={() => dismiss(false)}
                      className="mt-4 flex items-center gap-2 text-sm text-[#c9a84c] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 border border-[#c9a84c]/30 rounded-xl px-4 py-2.5 transition-colors w-fit"
                    >
                      <Zap className="w-4 h-4" />
                      جربها الآن: {currentFeature.hrefLabel}
                      <ArrowLeft className="w-3.5 h-3.5 mr-auto" />
                    </a>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* All features mini-list */}
              <div className="px-6 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {features.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`flex items-center gap-2 text-xs p-2 rounded-lg border text-right transition-all ${
                        i === step
                          ? 'bg-[#c9a84c]/15 border-[#c9a84c]/40 text-[#c9a84c]'
                          : 'bg-white/3 border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'
                      }`}
                    >
                      {i < step ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />
                      ) : (
                        <span className={`w-3.5 h-3.5 shrink-0 rounded-full border text-[9px] flex items-center justify-center font-bold ${i === step ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-white/30 text-white/30'}`}>
                          {i + 1}
                        </span>
                      )}
                      <span className="truncate">{f.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between px-6 pb-5 gap-3">
                <button
                  onClick={() => dismiss(true)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  لا تُظهر مرة أخرى
                </button>
                <div className="flex gap-2">
                  {step > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(s => s - 1)}
                      className="h-8 text-xs border-white/20 text-white/60 hover:text-white bg-transparent gap-1"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      السابق
                    </Button>
                  )}
                  {step < totalSteps - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setStep(s => s + 1)}
                      className="h-8 text-xs bg-gradient-to-r from-[#c9a84c] to-[#e6c86e] text-[#0a1628] font-semibold gap-1 hover:opacity-90"
                    >
                      التالي
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => dismiss(true)}
                      className="h-8 text-xs bg-gradient-to-r from-[#c9a84c] to-[#e6c86e] text-[#0a1628] font-semibold gap-1 hover:opacity-90"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ابدأ الآن!
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
