/**
 * PDPL - نظام حماية البيانات الشخصية السعودي
 * Saudi Arabia Personal Data Protection Law
 * Effective: September 14, 2024
 * Regulator: SDAIA (Saudi Data & AI Authority)
 */

// أنواع البيانات الشخصية
export type PersonalDataType = 
  | 'identity'           // بيانات الهوية
  | 'contact'            // بيانات الاتصال
  | 'financial'          // بيانات مالية
  | 'employment'         // بيانات التوظيف
  | 'health'             // بيانات صحية (حساسة)
  | 'biometric'          // بيانات بيومترية (حساسة)
  | 'genetic'            // بيانات وراثية (حساسة)
  | 'criminal'           // سجلات جنائية (حساسة)
  | 'religious'          // بيانات دينية (حساسة)
  | 'political'          // آراء سياسية (حساسة)
  | 'location'           // بيانات موقع
  | 'behavioral';        // بيانات سلوكية

// الأساس القانوني للمعالجة
export type LegalBasis = 
  | 'consent'            // موافقة صاحب البيانات
  | 'contract'           // تنفيذ عقد
  | 'legal_obligation'   // التزام قانوني
  | 'vital_interest'     // مصلحة حيوية
  | 'public_interest'    // مصلحة عامة
  | 'legitimate_interest'; // مصلحة مشروعة

// حقوق أصحاب البيانات
export type DataSubjectRight = 
  | 'access'             // حق الوصول
  | 'rectification'      // حق التصحيح
  | 'erasure'            // حق المحو
  | 'portability'        // حق النقل
  | 'objection'          // حق الاعتراض
  | 'restriction'        // تقييد المعالجة
  | 'withdraw_consent'   // سحب الموافقة
  | 'complaint';         // تقديم شكوى

// حالة طلب حقوق صاحب البيانات
export type DSRStatus = 
  | 'pending'            // قيد الانتظار
  | 'in_progress'        // قيد المعالجة
  | 'completed'          // مكتمل
  | 'rejected'           // مرفوض
  | 'escalated';         // مصعّد

// مستوى خطورة الاختراق
export type BreachSeverity = 
  | 'low'                // منخفض
  | 'medium'             // متوسط
  | 'high'               // مرتفع
  | 'critical';          // حرج

// تصنيف البيانات
export type DataClassification = 
  | 'public'             // عام
  | 'restricted'         // مقيد
  | 'confidential'       // سري
  | 'top_secret';        // سري للغاية

// سجل الموافقة
export interface ConsentRecord {
  id: string;
  dataSubjectId: string;
  purpose: string;
  purposeAr: string;
  legalBasis: LegalBasis;
  dataTypes: PersonalDataType[];
  givenAt: Date;
  expiresAt?: Date;
  withdrawnAt?: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  version: number;
  metadata: Record<string, unknown>;
}

// طلب حقوق صاحب البيانات (DSR)
export interface DataSubjectRequest {
  id: string;
  requesterId: string;
  requesterEmail: string;
  rightType: DataSubjectRight;
  status: DSRStatus;
  description: string;
  descriptionAr: string;
  submittedAt: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
  assignedTo?: string;
  response?: string;
  responseAr?: string;
  attachments: string[];
  auditTrail: DSRAuditEntry[];
}

// سجل تدقيق DSR
export interface DSRAuditEntry {
  timestamp: Date;
  action: string;
  performedBy: string;
  details: string;
}

// تقرير اختراق البيانات
export interface DataBreachReport {
  id: string;
  detectedAt: Date;
  reportedAt?: Date;
  severity: BreachSeverity;
  affectedRecords: number;
  affectedDataTypes: PersonalDataType[];
  description: string;
  descriptionAr: string;
  rootCause?: string;
  containmentMeasures: string[];
  remediationSteps: string[];
  notificationSent: boolean;
  notifiedSDaia: boolean;
  notifiedAffectedUsers: boolean;
  status: 'detected' | 'contained' | 'resolved' | 'closed';
  investigationNotes: string[];
  leadInvestigator?: string;
}

// سجل معالجة البيانات (RoPA)
export interface ProcessingRecord {
  id: string;
  activityName: string;
  activityNameAr: string;
  purpose: string;
  purposeAr: string;
  legalBasis: LegalBasis;
  dataCategories: PersonalDataType[];
  dataSubjectCategories: string[];
  recipients: string[];
  crossBorderTransfers: CrossBorderTransfer[];
  retentionPeriod: string;
  securityMeasures: string[];
  dpiaRequired: boolean;
  dpiaCompleted: boolean;
  lastReviewed: Date;
  nextReview: Date;
  responsible: string;
}

// نقل البيانات عبر الحدود
export interface CrossBorderTransfer {
  destinationCountry: string;
  recipient: string;
  mechanism: 'adequacy' | 'scc' | 'bcr' | 'consent' | 'derogation';
  safeguards: string[];
  approvedAt: Date;
}

// إشعار الخصوصية
export interface PrivacyNotice {
  id: string;
  version: string;
  effectiveDate: Date;
  contentEn: string;
  contentAr: string;
  purposes: string[];
  dataCategories: PersonalDataType[];
  retentionPeriods: Record<PersonalDataType, string>;
  thirdPartySharing: boolean;
  crossBorderTransfers: boolean;
  dataSubjectRights: DataSubjectRight[];
  contactDetails: {
    dpo: string;
    dpoEmail: string;
    address: string;
  };
  lastUpdated: Date;
}

// متطلبات PDPL
export const PDPLRequirements = {
  // المتحكم في البيانات
  controller: {
    registration: {
      required: true,
      platform: 'National Data Governance Platform',
      criteria: ['public_entity', 'primary_activity_data_processing', 'sensitive_data_processing'],
    },
    dpo: {
      required: true,
      criteria: ['public_entity_large_scale', 'systematic_monitoring'],
    },
  },
  
  // فترات الاستجابة
  responseTimes: {
    dsrAcknowledgment: 3,     // 3 أيام عمل
    dsrCompletion: 30,         // 30 يوم
    breachNotification: 72,    // 72 ساعة
  },
  
  // العقوبات
  penalties: {
    maxFineIndividual: 3000000,    // 3 مليون ريال
    maxFineEntity: 5000000,        // 5 مليون ريال
    maxImprisonment: 2,            // سنتين
    repeatViolationMultiplier: 2,  // مضاعفة
  },
  
  // البيانات الحساسة
  sensitiveData: [
    'health', 'biometric', 'genetic', 'criminal', 'religious', 'political'
  ],
};

// التحقق من صحة الموافقة
export function validateConsent(consent: ConsentRecord): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!consent.purpose || consent.purpose.trim() === '') {
    errors.push('يجب تحديد غرض المعالجة');
  }
  
  if (!consent.dataTypes || consent.dataTypes.length === 0) {
    errors.push('يجب تحديد أنواع البيانات');
  }
  
  if (!consent.legalBasis) {
    errors.push('يجب تحديد الأساس القانوني');
  }
  
  if (consent.expiresAt && consent.expiresAt < new Date()) {
    errors.push('الموافقة منتهية الصلاحية');
  }
  
  if (consent.withdrawnAt) {
    errors.push('الموافقة مسحوبة');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// التحقق من الامتثال للمعالجة
export function checkProcessingCompliance(
  processing: ProcessingRecord,
  hasConsent: boolean
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // التحقق من الأساس القانوني
  if (processing.legalBasis === 'consent' && !hasConsent) {
    violations.push('المعالجة تتطلب موافقة صاحب البيانات');
  }
  
  // التحقق من البيانات الحساسة
  const sensitiveTypes = processing.dataCategories.filter(
    type => PDPLRequirements.sensitiveData.includes(type)
  );
  if (sensitiveTypes.length > 0 && processing.legalBasis === 'legitimate_interest') {
    violations.push('لا يمكن معالجة البيانات الحساسة بناءً على المصلحة المشروعة');
  }
  
  // التحقق من DPIA
  if (sensitiveTypes.length > 0 && processing.dpiaRequired && !processing.dpiaCompleted) {
    violations.push('تقييم الأثر على الخصوصية (DPIA) مطلوب ولم يكتمل');
  }
  
  // التحقق من النقل عبر الحدود
  processing.crossBorderTransfers.forEach(transfer => {
    if (!transfer.mechanism) {
      violations.push(`نقل البيانات إلى ${transfer.destinationCountry} يفتقر لآلية الحماية`);
    }
  });
  
  return {
    compliant: violations.length === 0,
    violations,
  };
}

// حساب وقت الاستجابة لـ DSR
export function calculateDSRDeadline(request: DataSubjectRequest): Date {
  const submittedAt = new Date(request.submittedAt);
  const deadline = new Date(submittedAt);
  deadline.setDate(deadline.getDate() + PDPLRequirements.responseTimes.dsrCompletion);
  return deadline;
}

// تقييم خطورة الاختراق
export function assessBreachSeverity(
  affectedRecords: number,
  dataTypes: PersonalDataType[]
): BreachSeverity {
  const hasSensitiveData = dataTypes.some(
    type => PDPLRequirements.sensitiveData.includes(type)
  );
  
  if (affectedRecords > 10000 || (affectedRecords > 1000 && hasSensitiveData)) {
    return 'critical';
  }
  
  if (affectedRecords > 1000 || (affectedRecords > 100 && hasSensitiveData)) {
    return 'high';
  }
  
  if (affectedRecords > 100 || hasSensitiveData) {
    return 'medium';
  }
  
  return 'low';
}

// التحقق من الحاجة للإخطار
export function requiresBreachNotification(breach: DataBreachReport): {
  notifySdaia: boolean;
  notifyUsers: boolean;
  deadline: Date;
} {
  const deadline = new Date(breach.detectedAt);
  deadline.setHours(deadline.getHours() + PDPLRequirements.responseTimes.breachNotification);
  
  return {
    notifySdaia: breach.severity === 'high' || breach.severity === 'critical',
    notifyUsers: breach.severity === 'critical' || 
                 breach.affectedDataTypes.some(t => PDPLRequirements.sensitiveData.includes(t)),
    deadline,
  };
}

// تصدير الثوابت العربية
export const PDPLLabels = {
  legalBasis: {
    consent: 'موافقة صاحب البيانات',
    contract: 'تنفيذ عقد',
    legal_obligation: 'التزام قانوني',
    vital_interest: 'مصلحة حيوية',
    public_interest: 'مصلحة عامة',
    legitimate_interest: 'مصلحة مشروعة',
  },
  dataTypes: {
    identity: 'بيانات الهوية',
    contact: 'بيانات الاتصال',
    financial: 'بيانات مالية',
    employment: 'بيانات التوظيف',
    health: 'بيانات صحية',
    biometric: 'بيانات بيومترية',
    genetic: 'بيانات وراثية',
    criminal: 'سجلات جنائية',
    religious: 'بيانات دينية',
    political: 'آراء سياسية',
    location: 'بيانات الموقع',
    behavioral: 'بيانات سلوكية',
  },
  rights: {
    access: 'حق الوصول',
    rectification: 'حق التصحيح',
    erasure: 'حق المحو',
    portability: 'حق النقل',
    objection: 'حق الاعتراض',
    restriction: 'تقييد المعالجة',
    withdraw_consent: 'سحب الموافقة',
    complaint: 'تقديم شكوى',
  },
  classification: {
    public: 'عام',
    restricted: 'مقيد',
    confidential: 'سري',
    top_secret: 'سري للغاية',
  },
  severity: {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    critical: 'حرج',
  },
};
