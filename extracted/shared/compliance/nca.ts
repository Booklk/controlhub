/**
 * NCA - الهيئة الوطنية للأمن السيبراني
 * ضوابط الأمن السيبراني الأساسية (ECC-1:2018)
 */

export const NCADomains = [
  {
    id: 'GOV', nameAr: 'حوكمة الأمن السيبراني', nameEn: 'Cybersecurity Governance', icon: 'Shield',
    controls: [
      { id: 'GOV-1', nameAr: 'استراتيجية الأمن السيبراني', level: 'essential', description: 'وضع استراتيجية شاملة للأمن السيبراني معتمدة من الإدارة العليا' },
      { id: 'GOV-2', nameAr: 'إدارة الأمن السيبراني', level: 'essential', description: 'إنشاء إدارة مختصة بالأمن السيبراني مع صلاحيات واضحة' },
      { id: 'GOV-3', nameAr: 'سياسات وإجراءات الأمن السيبراني', level: 'essential', description: 'تطوير واعتماد سياسات وإجراءات الأمن السيبراني' },
      { id: 'GOV-4', nameAr: 'أدوار ومسؤوليات الأمن السيبراني', level: 'essential', description: 'تحديد الأدوار والمسؤوليات المتعلقة بالأمن السيبراني' },
      { id: 'GOV-5', nameAr: 'إدارة مخاطر الأمن السيبراني', level: 'essential', description: 'تطبيق منهجية إدارة المخاطر السيبرانية' },
      { id: 'GOV-6', nameAr: 'الالتزام بالتشريعات والأنظمة', level: 'essential', description: 'الالتزام بالمتطلبات التشريعية والتنظيمية' },
      { id: 'GOV-7', nameAr: 'التدقيق والمراجعة', level: 'essential', description: 'إجراء تدقيق ومراجعة دورية للأمن السيبراني' },
      { id: 'GOV-8', nameAr: 'الأمن السيبراني في إدارة الموارد البشرية', level: 'essential', description: 'تضمين متطلبات الأمن السيبراني في إدارة الموارد البشرية' },
      { id: 'GOV-9', nameAr: 'التوعية والتدريب', level: 'essential', description: 'تنفيذ برامج توعية وتدريب بالأمن السيبراني' },
    ],
  },
  {
    id: 'DEF', nameAr: 'تعزيز الأمن السيبراني', nameEn: 'Cybersecurity Defense', icon: 'Lock',
    controls: [
      { id: 'DEF-1', nameAr: 'إدارة الأصول', level: 'essential', description: 'جرد وتصنيف الأصول المعلوماتية والتقنية' },
      { id: 'DEF-2', nameAr: 'إدارة الهوية والوصول', level: 'essential', description: 'التحكم في الوصول وإدارة الهويات الرقمية' },
      { id: 'DEF-3', nameAr: 'حماية البريد الإلكتروني', level: 'essential', description: 'تأمين خدمات البريد الإلكتروني ضد التهديدات' },
      { id: 'DEF-4', nameAr: 'أمن الشبكات', level: 'essential', description: 'حماية البنية التحتية للشبكات' },
      { id: 'DEF-5', nameAr: 'أمن الأجهزة المحمولة', level: 'essential', description: 'تأمين الأجهزة المحمولة والعمل عن بُعد' },
      { id: 'DEF-6', nameAr: 'حماية البيانات والمعلومات', level: 'essential', description: 'تصنيف وحماية البيانات والمعلومات الحساسة' },
      { id: 'DEF-7', nameAr: 'التشفير', level: 'essential', description: 'استخدام التشفير لحماية البيانات أثناء النقل والتخزين' },
      { id: 'DEF-8', nameAr: 'إدارة النسخ الاحتياطي', level: 'essential', description: 'تنفيذ استراتيجية نسخ احتياطي واستعادة' },
      { id: 'DEF-9', nameAr: 'إدارة الثغرات', level: 'essential', description: 'اكتشاف ومعالجة الثغرات الأمنية بشكل دوري' },
      { id: 'DEF-10', nameAr: 'اختبار الاختراق', level: 'advanced', description: 'إجراء اختبارات اختراق دورية للأنظمة' },
      { id: 'DEF-11', nameAr: 'إدارة سجلات الأحداث', level: 'essential', description: 'جمع وتحليل سجلات الأحداث الأمنية' },
      { id: 'DEF-12', nameAr: 'مركز عمليات الأمن السيبراني', level: 'advanced', description: 'إنشاء وتشغيل مركز عمليات أمن سيبراني (SOC)' },
    ],
  },
  {
    id: 'RES', nameAr: 'صمود الأمن السيبراني', nameEn: 'Cybersecurity Resilience', icon: 'RefreshCw',
    controls: [
      { id: 'RES-1', nameAr: 'إدارة حوادث الأمن السيبراني', level: 'essential', description: 'إعداد وتنفيذ خطة الاستجابة للحوادث' },
      { id: 'RES-2', nameAr: 'إدارة التهديدات السيبرانية', level: 'essential', description: 'رصد ومراقبة التهديدات السيبرانية' },
      { id: 'RES-3', nameAr: 'استمرارية الأعمال', level: 'essential', description: 'تطوير خطط استمرارية الأعمال والتعافي من الكوارث' },
    ],
  },
  {
    id: 'TPC', nameAr: 'الأمن السيبراني للأطراف الخارجية', nameEn: 'Third-Party Security', icon: 'Users',
    controls: [
      { id: 'TPC-1', nameAr: 'إدارة الأطراف الخارجية', level: 'essential', description: 'تقييم ومراقبة المخاطر السيبرانية للأطراف الخارجية' },
      { id: 'TPC-2', nameAr: 'الحوسبة السحابية والاستضافة', level: 'essential', description: 'تأمين الخدمات السحابية وبيئات الاستضافة' },
    ],
  },
];

export const NCAMetadata = {
  framework: 'ECC-1:2018',
  nameAr: 'ضوابط الأمن السيبراني الأساسية',
  nameEn: 'Essential Cybersecurity Controls',
  authority: 'الهيئة الوطنية للأمن السيبراني',
  authorityEn: 'National Cybersecurity Authority (NCA)',
  version: '2018',
  totalControls: 114,
  country: 'المملكة العربية السعودية',
};

export const NCAComplianceLevels = {
  not_implemented: { ar: 'غير مطبق', en: 'Not Implemented', color: '#ef4444', score: 0 },
  partially_implemented: { ar: 'مطبق جزئياً', en: 'Partially Implemented', color: '#f59e0b', score: 50 },
  implemented: { ar: 'مطبق', en: 'Implemented', color: '#22c55e', score: 100 },
  not_applicable: { ar: 'لا ينطبق', en: 'Not Applicable', color: '#6b7280', score: null },
};
