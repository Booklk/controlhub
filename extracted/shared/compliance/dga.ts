/**
 * DGA - هيئة الحكومة الرقمية
 * معايير ومتطلبات التحول الرقمي الحكومي
 */

export const DGADomains = [
  {
    id: 'DGS-1', nameAr: 'البنية المؤسسية', nameEn: 'Enterprise Architecture', icon: 'Building2',
    standards: [
      { id: 'EA-1', nameAr: 'بنية الأعمال', description: 'توثيق وتطوير بنية الأعمال المؤسسية' },
      { id: 'EA-2', nameAr: 'بنية البيانات', description: 'تصميم وإدارة بنية البيانات المؤسسية' },
      { id: 'EA-3', nameAr: 'بنية التطبيقات', description: 'تخطيط وإدارة محفظة التطبيقات' },
      { id: 'EA-4', nameAr: 'البنية التقنية', description: 'تصميم البنية التحتية التقنية' },
    ],
  },
  {
    id: 'DGS-2', nameAr: 'الخدمات الرقمية', nameEn: 'Digital Services', icon: 'Globe',
    standards: [
      { id: 'DS-1', nameAr: 'تصميم الخدمات الرقمية', description: 'تصميم خدمات رقمية متمحورة حول المستفيد' },
      { id: 'DS-2', nameAr: 'تكامل الخدمات', description: 'تكامل الخدمات الحكومية الرقمية' },
      { id: 'DS-3', nameAr: 'قنوات تقديم الخدمات', description: 'توفير قنوات متعددة لتقديم الخدمات' },
    ],
  },
  {
    id: 'DGS-3', nameAr: 'البيانات المفتوحة', nameEn: 'Open Data', icon: 'Database',
    standards: [
      { id: 'OD-1', nameAr: 'نشر البيانات المفتوحة', description: 'نشر مجموعات البيانات الحكومية' },
      { id: 'OD-2', nameAr: 'جودة البيانات المفتوحة', description: 'ضمان جودة البيانات المنشورة' },
      { id: 'OD-3', nameAr: 'حوكمة البيانات المفتوحة', description: 'حوكمة عملية نشر البيانات' },
    ],
  },
  {
    id: 'DGS-4', nameAr: 'التقنيات الناشئة', nameEn: 'Emerging Technologies', icon: 'Zap',
    standards: [
      { id: 'ET-1', nameAr: 'الذكاء الاصطناعي', description: 'تبني وحوكمة الذكاء الاصطناعي' },
      { id: 'ET-2', nameAr: 'الحوسبة السحابية', description: 'استراتيجية السحابة أولاً' },
      { id: 'ET-3', nameAr: 'إنترنت الأشياء', description: 'إدارة أجهزة إنترنت الأشياء' },
      { id: 'ET-4', nameAr: 'البلوك تشين', description: 'تطبيقات سلسلة الكتل الحكومية' },
    ],
  },
  {
    id: 'DGS-5', nameAr: 'تجربة المستفيد', nameEn: 'User Experience', icon: 'Users',
    standards: [
      { id: 'UX-1', nameAr: 'سهولة الاستخدام', description: 'معايير سهولة الاستخدام للمنصات الحكومية' },
      { id: 'UX-2', nameAr: 'إمكانية الوصول', description: 'ضمان إمكانية الوصول لذوي الاحتياجات' },
      { id: 'UX-3', nameAr: 'قياس رضا المستفيدين', description: 'قياس ومتابعة رضا المستفيدين' },
    ],
  },
];

export const DGAMetadata = {
  framework: 'DGA Standards',
  nameAr: 'معايير الحكومة الرقمية',
  nameEn: 'Digital Government Standards',
  authority: 'هيئة الحكومة الرقمية',
  authorityEn: 'Digital Government Authority (DGA)',
  version: '2024',
  country: 'المملكة العربية السعودية',
};
