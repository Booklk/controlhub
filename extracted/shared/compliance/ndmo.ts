/**
 * NDMO - مكتب إدارة البيانات الوطنية
 * National Data Management Office Standards
 * 15 Domains | 77 Controls | 191 Specifications
 */

// مجالات NDMO الـ 15
export type NDMODomain = 
  | 'data_governance'              // 1. حوكمة البيانات
  | 'data_catalog'                 // 2. فهرسة البيانات والميتاداتا
  | 'data_quality'                 // 3. جودة البيانات
  | 'data_assetization'            // 4. تأصيل البيانات
  | 'data_usage'                   // 5. استخدام البيانات
  | 'data_architecture'            // 6. بنية البيانات
  | 'data_integration'             // 7. تكامل البيانات
  | 'data_storage'                 // 8. تخزين وعمليات البيانات
  | 'master_data'                  // 9. إدارة البيانات الرئيسية
  | 'reference_data'               // 10. إدارة البيانات المرجعية
  | 'content_management'           // 11. إدارة المحتوى
  | 'document_management'          // 12. إدارة الوثائق والسجلات
  | 'data_classification'          // 13. تصنيف البيانات وإتاحتها
  | 'personal_data_protection'     // 14. حماية البيانات الشخصية
  | 'data_security';               // 15. أمن البيانات والحماية

// مستوى الأولوية
export type Priority = 'P1' | 'P2' | 'P3';

// حالة الامتثال
export type ComplianceStatus = 
  | 'compliant'         // ممتثل
  | 'partial'           // جزئي
  | 'non_compliant'     // غير ممتثل
  | 'not_applicable'    // لا ينطبق
  | 'in_progress';      // قيد التنفيذ

// المواصفة
export interface Specification {
  id: string;
  domainId: NDMODomain;
  controlId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priority: Priority;
  status: ComplianceStatus;
  evidenceRequired: string[];
  lastAssessed: Date | null;
  nextAssessment: Date | null;
  assignedTo: string | null;
  notes: string;
}

// الضابط
export interface Control {
  id: string;
  domainId: NDMODomain;
  code: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  specifications: Specification[];
  overallStatus: ComplianceStatus;
}

// المجال
export interface Domain {
  id: NDMODomain;
  number: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  controlsCount: number;
  specificationsCount: number;
  controls: Control[];
  compliancePercentage: number;
}

// تعريف المجالات الـ 15
export const NDMODomains: Record<NDMODomain, {
  number: number;
  titleAr: string;
  titleEn: string;
  controlsCount: number;
  specificationsCount: number;
  descriptionAr: string;
  descriptionEn: string;
}> = {
  data_governance: {
    number: 1,
    titleAr: 'حوكمة البيانات',
    titleEn: 'Data Governance',
    controlsCount: 8,
    specificationsCount: 28,
    descriptionAr: 'السياسات والأدوار والصلاحيات الشاملة لإدارة البيانات',
    descriptionEn: 'Overarching policies, roles, and authority for data management implementation',
  },
  data_catalog: {
    number: 2,
    titleAr: 'فهرسة البيانات والميتاداتا',
    titleEn: 'Data Catalog & Metadata',
    controlsCount: 6,
    specificationsCount: 20,
    descriptionAr: 'الوصول الفعال للميتاداتا عالية الجودة عبر أدوات الفهرسة الآلية',
    descriptionEn: 'Effective access to high-quality integrated metadata via automated catalog tools',
  },
  data_quality: {
    number: 3,
    titleAr: 'جودة البيانات',
    titleEn: 'Data Quality',
    controlsCount: 4,
    specificationsCount: 13,
    descriptionAr: 'تحسين جودة البيانات لتلبية متطلبات العملاء والتشغيل',
    descriptionEn: 'Improving data quality to meet customer/operational requirements',
  },
  data_assetization: {
    number: 4,
    titleAr: 'تأصيل البيانات',
    titleEn: 'Data Assetization',
    controlsCount: 4,
    specificationsCount: 10,
    descriptionAr: 'تحديد قيمة البيانات بناءً على الوظيفة وخصائص الجودة',
    descriptionEn: 'Assigning value to data based on function and quality characteristics',
  },
  data_usage: {
    number: 5,
    titleAr: 'استخدام البيانات',
    titleEn: 'Data Usage',
    controlsCount: 5,
    specificationsCount: 14,
    descriptionAr: 'كيفية استخدام البيانات داخل المؤسسات الحكومية',
    descriptionEn: 'How data is utilized within government organizations',
  },
  data_architecture: {
    number: 6,
    titleAr: 'بنية البيانات',
    titleEn: 'Data Architecture',
    controlsCount: 5,
    specificationsCount: 12,
    descriptionAr: 'الأطر الفنية الداعمة لتخزين ونقل البيانات',
    descriptionEn: 'Technical frameworks supporting data storage and movement',
  },
  data_integration: {
    number: 7,
    titleAr: 'تكامل البيانات والتشغيل البيني',
    titleEn: 'Data Integration & Interoperability',
    controlsCount: 5,
    specificationsCount: 13,
    descriptionAr: 'ربط ومشاركة البيانات عبر الأنظمة',
    descriptionEn: 'Connecting and sharing data across systems',
  },
  data_storage: {
    number: 8,
    titleAr: 'تخزين وعمليات البيانات',
    titleEn: 'Data Storage & Operations',
    controlsCount: 5,
    specificationsCount: 12,
    descriptionAr: 'إدارة مستودعات البيانات والبيئات التشغيلية',
    descriptionEn: 'Managing data repositories and operational environments',
  },
  master_data: {
    number: 9,
    titleAr: 'إدارة البيانات الرئيسية',
    titleEn: 'Master Data Management',
    controlsCount: 5,
    specificationsCount: 13,
    descriptionAr: 'إدارة كيانات البيانات المشتركة الحرجة بشكل متسق',
    descriptionEn: 'Managing critical shared data entities consistently',
  },
  reference_data: {
    number: 10,
    titleAr: 'إدارة البيانات المرجعية',
    titleEn: 'Reference Data Management',
    controlsCount: 4,
    specificationsCount: 10,
    descriptionAr: 'إدارة جداول البحث ومخططات التصنيف',
    descriptionEn: 'Managing lookup tables and classification schemes',
  },
  content_management: {
    number: 11,
    titleAr: 'إدارة المحتوى',
    titleEn: 'Content Management',
    controlsCount: 5,
    specificationsCount: 12,
    descriptionAr: 'إدارة المحتوى غير المهيكل (الوثائق، الوسائط)',
    descriptionEn: 'Managing unstructured content (documents, media)',
  },
  document_management: {
    number: 12,
    titleAr: 'إدارة الوثائق والسجلات',
    titleEn: 'Document & Records Management',
    controlsCount: 5,
    specificationsCount: 12,
    descriptionAr: 'إدارة السجلات والوثائق الرسمية',
    descriptionEn: 'Managing official records and documents',
  },
  data_classification: {
    number: 13,
    titleAr: 'تصنيف البيانات وإتاحتها',
    titleEn: 'Data Classification & Availability',
    controlsCount: 5,
    specificationsCount: 13,
    descriptionAr: 'تصنيف البيانات حسب الأثر والحساسية وضمان الوصول المناسب',
    descriptionEn: 'Categorizing data by impact/sensitivity; ensuring appropriate access',
  },
  personal_data_protection: {
    number: 14,
    titleAr: 'حماية البيانات الشخصية',
    titleEn: 'Personal Data Protection',
    controlsCount: 6,
    specificationsCount: 15,
    descriptionAr: 'أحكام وإجراءات حماية الخصوصية وحقوق مالك البيانات',
    descriptionEn: 'Provisions and procedures for privacy protection and data owner rights',
  },
  data_security: {
    number: 15,
    titleAr: 'أمن البيانات والحماية',
    titleEn: 'Data Security & Protection',
    controlsCount: 5,
    specificationsCount: 14,
    descriptionAr: 'الضوابط الفنية لحماية البيانات (محددة من الهيئة الوطنية للأمن السيبراني)',
    descriptionEn: 'Technical controls for protecting data (defined by NCA)',
  },
};

// المبادئ التوجيهية الثمانية
export const NDMOPrinciples = [
  {
    id: 1,
    titleAr: 'البيانات كأصل وطني',
    titleEn: 'Data as a National Asset',
    descriptionAr: 'يجب أن تكون البيانات الحكومية قابلة للاكتشاف ومحمية وقابلة للتثمين',
    descriptionEn: 'Government data should be discoverable, protected, and monetizable',
  },
  {
    id: 2,
    titleAr: 'حماية البيانات بالتصميم',
    titleEn: 'Data Protection by Design',
    descriptionAr: 'حماية الخصوصية الاستباقية المدمجة في العمليات',
    descriptionEn: 'Proactive privacy protection built into processes',
  },
  {
    id: 3,
    titleAr: 'مفتوح بشكل افتراضي',
    titleEn: 'Open by Default',
    descriptionAr: 'البيانات الحكومية متاحة ما لم يكن عدم الإفصاح مبررًا',
    descriptionEn: 'Government data available unless non-disclosure justified',
  },
  {
    id: 4,
    titleAr: 'الاستخدام الأخلاقي للبيانات',
    titleEn: 'Ethical Data Use',
    descriptionAr: 'العدالة والتتبع والمساهمة في الصالح العام',
    descriptionEn: 'Fairness, traceability, and contribution to common good',
  },
  {
    id: 5,
    titleAr: 'الجودة والنزاهة',
    titleEn: 'Quality & Integrity',
    descriptionAr: 'يجب أن تكون البيانات دقيقة وكاملة وموثوقة',
    descriptionEn: 'Data must be accurate, complete, and reliable',
  },
  {
    id: 6,
    titleAr: 'التشغيل البيني',
    titleEn: 'Interoperability',
    descriptionAr: 'مشاركة البيانات عبر الجهات بمعايير متسقة',
    descriptionEn: 'Data sharing across entities with consistent standards',
  },
  {
    id: 7,
    titleAr: 'المساءلة',
    titleEn: 'Accountability',
    descriptionAr: 'ملكية ومسؤولية واضحة عن أصول البيانات',
    descriptionEn: 'Clear ownership and responsibility for data assets',
  },
  {
    id: 8,
    titleAr: 'الشفافية',
    titleEn: 'Transparency',
    descriptionAr: 'التواصل الواضح حول ممارسات واستخدام البيانات',
    descriptionEn: 'Clear communication about data practices and usage',
  },
];

// خارطة طريق التنفيذ
export const ImplementationRoadmap = {
  year1: {
    priority: 'P1',
    focus: 'المواصفات الأساسية والاستراتيجية',
    focusEn: 'Foundational and strategic specifications',
    targetPercentage: 100,
  },
  year2: {
    priority: 'P2',
    focus: 'الضوابط التشغيلية',
    focusEn: 'Operational controls',
    targetPercentage: 100,
  },
  year3: {
    priority: 'P3',
    focus: 'مواصفات تحسين النضج',
    focusEn: 'Maturity-enhancing specifications',
    targetPercentage: 100,
  },
};

// نموذج تقييم الامتثال
export interface ComplianceAssessment {
  id: string;
  domainId: NDMODomain;
  assessedAt: Date;
  assessedBy: string;
  fiscalQuarter: string;
  fiscalYear: number;
  specifications: {
    specificationId: string;
    status: ComplianceStatus;
    score: 0 | 100; // Binary scoring
    evidence: string[];
    gaps: string[];
    remediationPlan?: string;
  }[];
  overallScore: number;
  submittedToNDMO: boolean;
  submittedAt?: Date;
}

// حساب نسبة الامتثال
export function calculateDomainCompliance(assessment: ComplianceAssessment): number {
  if (assessment.specifications.length === 0) return 0;
  
  const totalScore = assessment.specifications.reduce((sum, spec) => sum + spec.score, 0);
  return Math.round(totalScore / assessment.specifications.length);
}

// حساب الامتثال الكلي
export function calculateOverallCompliance(assessments: ComplianceAssessment[]): number {
  if (assessments.length === 0) return 0;
  
  const totalScore = assessments.reduce(
    (sum, assessment) => sum + calculateDomainCompliance(assessment),
    0
  );
  return Math.round(totalScore / assessments.length);
}

// التحقق من جاهزية التقديم
export function validateAssessmentForSubmission(
  assessment: ComplianceAssessment
): { ready: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // التحقق من تقييم جميع المواصفات
  const unevaluated = assessment.specifications.filter(
    spec => spec.status === 'in_progress'
  );
  if (unevaluated.length > 0) {
    issues.push(`${unevaluated.length} مواصفات لم يتم تقييمها بعد`);
  }
  
  // التحقق من وجود الأدلة
  const noEvidence = assessment.specifications.filter(
    spec => spec.status === 'compliant' && spec.evidence.length === 0
  );
  if (noEvidence.length > 0) {
    issues.push(`${noEvidence.length} مواصفات ممتثلة بدون أدلة`);
  }
  
  // التحقق من خطط المعالجة
  const noRemediation = assessment.specifications.filter(
    spec => spec.status === 'non_compliant' && !spec.remediationPlan
  );
  if (noRemediation.length > 0) {
    issues.push(`${noRemediation.length} مواصفات غير ممتثلة بدون خطة معالجة`);
  }
  
  return {
    ready: issues.length === 0,
    issues,
  };
}

// تسميات عربية
export const NDMOLabels = {
  status: {
    compliant: 'ممتثل',
    partial: 'ممتثل جزئياً',
    non_compliant: 'غير ممتثل',
    not_applicable: 'لا ينطبق',
    in_progress: 'قيد التنفيذ',
  },
  priority: {
    P1: 'أولوية أولى',
    P2: 'أولوية ثانية',
    P3: 'أولوية ثالثة',
  },
};

// ضوابط المجال الأول: حوكمة البيانات (نموذج)
export const DataGovernanceControls = [
  {
    id: 'DG-01',
    code: 'DG-01',
    titleAr: 'استراتيجية إدارة البيانات',
    titleEn: 'Data Management Strategy',
    specifications: [
      { code: 'DG-01-01', titleAr: 'خطة تنفيذ لمدة 3 سنوات', priority: 'P1' },
      { code: 'DG-01-02', titleAr: 'المعالم ذات الأولوية', priority: 'P1' },
      { code: 'DG-01-03', titleAr: 'المواءمة مع الإطار الوطني', priority: 'P1' },
    ],
  },
  {
    id: 'DG-02',
    code: 'DG-02',
    titleAr: 'هيكل الحوكمة',
    titleEn: 'Governance Structure',
    specifications: [
      { code: 'DG-02-01', titleAr: 'تعيين مدير البيانات الرئيسي (CDO)', priority: 'P1' },
      { code: 'DG-02-02', titleAr: 'تعيين مسؤول حماية البيانات الشخصية', priority: 'P1' },
      { code: 'DG-02-03', titleAr: 'لجان رعاية البيانات', priority: 'P2' },
    ],
  },
  {
    id: 'DG-03',
    code: 'DG-03',
    titleAr: 'السياسات والإرشادات',
    titleEn: 'Policies & Guidelines',
    specifications: [
      { code: 'DG-03-01', titleAr: 'سياسات إدارة البيانات', priority: 'P1' },
      { code: 'DG-03-02', titleAr: 'المعايير والإجراءات', priority: 'P1' },
      { code: 'DG-03-03', titleAr: 'إرشادات التطبيق', priority: 'P2' },
    ],
  },
  {
    id: 'DG-04',
    code: 'DG-04',
    titleAr: 'إطار الامتثال',
    titleEn: 'Compliance Framework',
    specifications: [
      { code: 'DG-04-01', titleAr: 'مؤشرات الأداء الرئيسية', priority: 'P1' },
      { code: 'DG-04-02', titleAr: 'تقارير المراقبة', priority: 'P2' },
      { code: 'DG-04-03', titleAr: 'آليات التدقيق', priority: 'P2' },
    ],
  },
  {
    id: 'DG-05',
    code: 'DG-05',
    titleAr: 'الأدوار والمسؤوليات',
    titleEn: 'Roles & Responsibilities',
    specifications: [
      { code: 'DG-05-01', titleAr: 'تحديد المساءلة', priority: 'P1' },
      { code: 'DG-05-02', titleAr: 'مصفوفة RACI', priority: 'P2' },
    ],
  },
  {
    id: 'DG-06',
    code: 'DG-06',
    titleAr: 'خطط إدارة البيانات',
    titleEn: 'Data Management Plans',
    specifications: [
      { code: 'DG-06-01', titleAr: 'خطط متكاملة', priority: 'P1' },
      { code: 'DG-06-02', titleAr: 'المواءمة مع الإطار الوطني', priority: 'P1' },
    ],
  },
  {
    id: 'DG-07',
    code: 'DG-07',
    titleAr: 'خارطة طريق التنفيذ',
    titleEn: 'Implementation Roadmap',
    specifications: [
      { code: 'DG-07-01', titleAr: 'نهج مرحلي على 3 سنوات', priority: 'P1' },
      { code: 'DG-07-02', titleAr: 'مستويات الأولوية', priority: 'P1' },
    ],
  },
  {
    id: 'DG-08',
    code: 'DG-08',
    titleAr: 'التحسين المستمر',
    titleEn: 'Continuous Improvement',
    specifications: [
      { code: 'DG-08-01', titleAr: 'عمليات المراجعة الدورية', priority: 'P2' },
      { code: 'DG-08-02', titleAr: 'إدارة التغيير', priority: 'P3' },
    ],
  },
];

// دالة إنشاء تقرير الامتثال
export function generateComplianceReport(
  assessments: ComplianceAssessment[],
  fiscalYear: number,
  quarter: string
): {
  summary: {
    overallScore: number;
    domainsAssessed: number;
    specificationsTotal: number;
    specificationsCompliant: number;
    specificationsNonCompliant: number;
    specificationsPartial: number;
  };
  domainScores: { domain: NDMODomain; score: number }[];
  topGaps: string[];
  recommendations: string[];
} {
  const filteredAssessments = assessments.filter(
    a => a.fiscalYear === fiscalYear && a.fiscalQuarter === quarter
  );
  
  let specificationsTotal = 0;
  let specificationsCompliant = 0;
  let specificationsNonCompliant = 0;
  let specificationsPartial = 0;
  const gaps: string[] = [];
  
  filteredAssessments.forEach(assessment => {
    assessment.specifications.forEach(spec => {
      specificationsTotal++;
      if (spec.status === 'compliant') specificationsCompliant++;
      if (spec.status === 'non_compliant') {
        specificationsNonCompliant++;
        gaps.push(...spec.gaps);
      }
      if (spec.status === 'partial') specificationsPartial++;
    });
  });
  
  const domainScores = filteredAssessments.map(a => ({
    domain: a.domainId,
    score: calculateDomainCompliance(a),
  }));
  
  return {
    summary: {
      overallScore: calculateOverallCompliance(filteredAssessments),
      domainsAssessed: filteredAssessments.length,
      specificationsTotal,
      specificationsCompliant,
      specificationsNonCompliant,
      specificationsPartial,
    },
    domainScores,
    topGaps: gaps.slice(0, 10),
    recommendations: [
      'معالجة الفجوات ذات الأولوية الأولى (P1) أولاً',
      'تطوير خطط معالجة للمواصفات غير الممتثلة',
      'تعزيز التوثيق والأدلة للمواصفات الممتثلة',
      'مراجعة دورية للتقدم مع لجنة حوكمة البيانات',
    ],
  };
}
