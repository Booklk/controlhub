import { z } from 'zod';

export const externalSystemSchema = z.object({
  name: z.string()
    .min(1, { message: "اسم النظام مطلوب" })
    .min(2, { message: "اسم النظام مطلوب (2 أحرف على الأقل)" })
    .max(255, { message: "اسم النظام يجب أن لا يتجاوز 255 حرف" }),
  nameAr: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "اسم النظام العربي يجب أن لا يتجاوز 255 حرف"
    }),
  systemType: z.enum(['server', 'application', 'api', 'database', 'network', 'monitoring', 'camera', 'storage', 'firewall', 'switch'], {
    errorMap: () => ({ message: "نوع النظام مطلوب" })
  }),
  integrationStatus: z.enum(['active', 'pending', 'inactive'], {
    errorMap: () => ({ message: "حالة الدمج مطلوبة" })
  }),
  category: z.enum(['infrastructure', 'digital_transformation', 'security', 'business'], {
    errorMap: () => ({ message: "الفئة مطلوبة" })
  }),
  vendor: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "المورد يجب أن لا يتجاوز 255 حرف"
    }),
  description: z.string()
    .optional()
    .refine((val) => !val || val.length <= 500, {
      message: "الوصف يجب أن لا يتجاوز 500 حرف"
    }),
  apiEndpoint: z.string()
    .optional()
    .refine((val) => !val || val.length <= 500, {
      message: "رابط API يجب أن لا يتجاوز 500 حرف"
    }),
  ipAddress: z.string()
    .optional()
    .refine((val) => !val || val.length <= 45, {
      message: "عنوان IP غير صحيح"
    }),
  port: z.union([
    z.string().refine((val) => val === '' || !isNaN(Number(val)), {
      message: "المنفذ يجب أن يكون رقم"
    }).refine((val) => val === '' || (Number(val) >= 1 && Number(val) <= 65535), {
      message: "المنفذ يجب أن يكون بين 1 و 65535"
    }),
    z.number().int().min(1).max(65535)
  ]).optional(),
  protocol: z.enum(['http', 'https', 'ssh', 'ftp', 'tcp'], {
    errorMap: () => ({ message: "البروتوكول مطلوب" })
  }),
  healthCheckUrl: z.string()
    .optional()
    .refine((val) => !val || val.length <= 500, {
      message: "رابط فحص الصحة يجب أن لا يتجاوز 500 حرف"
    }),
  version: z.string()
    .optional()
    .refine((val) => !val || val.length <= 100, {
      message: "الإصدار يجب أن لا يتجاوز 100 حرف"
    }),
  environment: z.enum(['production', 'staging', 'development'], {
    errorMap: () => ({ message: "البيئة مطلوبة" })
  }),
  criticality: z.enum(['critical', 'high', 'medium', 'low'], {
    errorMap: () => ({ message: "مستوى الأهمية مطلوب" })
  }),
  dataClassification: z.enum(['top_secret', 'confidential', 'internal', 'public'], {
    errorMap: () => ({ message: "تصنيف البيانات مطلوب" })
  }),
  integrationDirection: z.enum(['read_only', 'push', 'pull', 'bidirectional'], {
    errorMap: () => ({ message: "اتجاه الربط مطلوب" })
  }),
  integrationScope: z.string().optional()
});

export type ExternalSystemFormData = z.infer<typeof externalSystemSchema>;

export const threatReportingSchema = z.object({
  title: z.string()
    .min(1, "عنوان التهديد مطلوب (3 أحرف على الأقل)")
    .min(3, "عنوان التهديد مطلوب (3 أحرف على الأقل)")
    .max(255, "عنوان التهديد يجب أن لا يتجاوز 255 حرف")
    .trim(),
  description: z.string()
    .min(1, "وصف التهديد مطلوب (10 أحرف على الأقل)")
    .min(10, "وصف التهديد مطلوب (10 أحرف على الأقل)")
    .max(1000, "الوصف يجب أن لا يتجاوز 1000 حرف")
    .trim(),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: "مستوى الخطورة مطلوب" })
  }),
  category: z.enum(['brute_force', 'ddos', 'malware', 'phishing', 'intrusion', 'other'], {
    errorMap: () => ({ message: "التصنيف مطلوب" })
  }),
  affectedSystem: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "النظام المتأثر يجب أن لا يتجاوز 255 حرف"
    })
});

export type ThreatReportingFormData = z.infer<typeof threatReportingSchema>;

export const meetingCreationSchema = z.object({
  title: z.string()
    .min(1, { message: "عنوان الاجتماع مطلوب (3 أحرف على الأقل)" })
    .min(3, { message: "عنوان الاجتماع مطلوب (3 أحرف على الأقل)" })
    .max(255, { message: "عنوان الاجتماع يجب أن لا يتجاوز 255 حرف" })
    .trim(),
  meetingDate: z.string()
    .min(1, { message: "تاريخ الاجتماع مطلوب" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ الاجتماع مطلوب"
    }),
  startTime: z.string().optional().default(''),
  endTime: z.string()
    .optional()
    .refine((val) => !val || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: "صيغة وقت النهاية غير صحيحة"
    }),
  location: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "الموقع يجب أن لا يتجاوز 255 حرف"
    }),
  agenda: z.string()
    .min(1, { message: "جدول الأعمال مطلوب (10 أحرف على الأقل)" })
    .min(10, { message: "جدول الأعمال مطلوب (10 أحرف على الأقل)" })
    .max(2000, { message: "جدول الأعمال يجب أن لا يتجاوز 2000 حرف" })
    .trim(),
  meetingType: z.enum(['regular', 'emergency', 'special'], {
    errorMap: () => ({ message: "نوع الاجتماع مطلوب" })
  }),
  description: z.string()
    .optional()
    .refine((val) => !val || val.length <= 1000, {
      message: "الوصف يجب أن لا يتجاوز 1000 حرف"
    })
}).superRefine((data, ctx) => {
  if (data.endTime && data.startTime) {
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMin;
    const endTimeInMinutes = endHour * 60 + endMin;
    
    if (endTimeInMinutes <= startTimeInMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: "وقت النهاية يجب أن يكون بعد وقت البداية"
      });
    }
  }
});

export type MeetingCreationFormData = z.infer<typeof meetingCreationSchema>;

export const decisionCreationSchema = z.object({
  title: z.string()
    .min(1, { message: "عنوان القرار مطلوب (3 أحرف على الأقل)" })
    .min(3, { message: "عنوان القرار مطلوب (3 أحرف على الأقل)" })
    .max(255, { message: "عنوان القرار يجب أن لا يتجاوز 255 حرف" })
    .trim(),
  description: z.string()
    .max(2000, { message: "وصف القرار يجب أن لا يتجاوز 2000 حرف" })
    .optional()
    .or(z.literal("")),
  decisionType: z.enum(['policy', 'procedure', 'resolution', 'directive'], {
    errorMap: () => ({ message: "نوع القرار مطلوب (سياسة / إجراء / قرار / توجيه)" })
  }),
  priority: z.enum(['urgent', 'low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: "مستوى الأولوية مطلوب (عاجل / منخفض / متوسط / عالي / حرج)" })
  }),
  effectiveDate: z.string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "تاريخ التطبيق يجب أن يكون صحيح"
    }),
  assignedTo: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "مسؤول التنفيذ يجب أن لا يتجاوز 255 حرف"
    }),
  meetingId: z.union([
    z.string().refine((val) => val === '' || !isNaN(Number(val)), {
      message: "معرف الاجتماع يجب أن يكون رقم"
    }),
    z.number().int().positive()
  ]).optional()
});

export type DecisionCreationFormData = z.infer<typeof decisionCreationSchema>;

export const votingProposalSchema = z.object({
  title: z.string()
    .min(1, { message: "عنوان المقترح مطلوب (3 أحرف على الأقل)" })
    .min(3, { message: "عنوان المقترح مطلوب (3 أحرف على الأقل)" })
    .max(255, { message: "عنوان المقترح يجب أن لا يتجاوز 255 حرف" })
    .trim(),
  description: z.string()
    .min(1, { message: "وصف المقترح مطلوب (10 أحرف على الأقل)" })
    .min(10, { message: "وصف المقترح مطلوب (10 أحرف على الأقل)" })
    .max(1000, { message: "وصف المقترح يجب أن لا يتجاوز 1000 حرف" })
    .trim(),
  votingType: z.enum(['majority', 'unanimous', 'weighted'], {
    errorMap: () => ({ message: "نوع التصويت مطلوب (أغلبية / إجماع / مرجح)" })
  }),
  deadline: z.string()
    .min(1, { message: "تاريخ انتهاء التصويت مطلوب" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ انتهاء التصويت يجب أن يكون صحيح"
    })
    .refine((date) => new Date(date) > new Date(), {
      message: "تاريخ انتهاء التصويت يجب أن يكون في المستقبل"
    }),
  minimumQuorum: z.union([
    z.string()
      .refine((val) => val === '' || !isNaN(Number(val)), {
        message: "النصاب الأدنى يجب أن يكون رقم"
      })
      .refine((val) => val === '' || Number(val) > 0, {
        message: "النصاب الأدنى يجب أن يكون موجب"
      })
      .optional(),
    z.number().int().positive().optional()
  ]).optional(),
  meetingId: z.union([
    z.string()
      .refine((val) => val === '' || !isNaN(Number(val)), {
        message: "معرف الاجتماع يجب أن يكون رقم"
      })
      .optional(),
    z.number().int().positive().optional()
  ]).optional()
}).superRefine((data, ctx) => {
  if (data.minimumQuorum && Number(data.minimumQuorum) > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minimumQuorum'],
      message: "النصاب الأدنى يجب أن لا يتجاوز 100"
    });
  }
});

export type VotingProposalFormData = z.infer<typeof votingProposalSchema>;

export const memberCreationSchema = z.object({
  fullName: z.string()
    .min(1, { message: "اسم العضو مطلوب (2 أحرف على الأقل)" })
    .min(2, { message: "اسم العضو مطلوب (2 أحرف على الأقل)" })
    .max(255, { message: "اسم العضو يجب أن لا يتجاوز 255 حرف" })
    .trim(),
  email: z.string()
    .min(1, { message: "البريد الإلكتروني مطلوب" })
    .email({ message: "البريد الإلكتروني غير صحيح" })
    .refine((e) => e.endsWith('@jcsa.sa'), { message: 'البريد الإلكتروني يجب أن يكون بنطاق @jcsa.sa' }),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^(\+\d{1,3}[- ]?)?\d{7,15}$/.test(val), {
      message: "صيغة رقم الهاتف غير صحيحة"
    }),
  memberRole: z.enum(['chairman', 'vice_chairman', 'specialist_member', 'rapporteur', 'member'], {
    errorMap: () => ({ message: "دور العضو مطلوب" })
  }),
  department: z.string()
    .optional()
    .refine((val) => !val || val.length <= 255, {
      message: "الإدارة يجب أن لا تتجاوز 255 حرف"
    }),
  startDate: z.string()
    .min(1, { message: "تاريخ البداية مطلوب" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ البداية يجب أن يكون صحيحاً"
    })
});

export type MemberCreationFormData = z.infer<typeof memberCreationSchema>;

export const taskCreationSchema = z.object({
  title: z.string()
    .min(3, { message: "عنوان المهمة مطلوب (3 أحرف على الأقل)" })
    .trim(),
  description: z.string()
    .min(10, { message: "وصف المهمة مطلوب (10 أحرف على الأقل)" })
    .trim(),
  assignedTo: z.string()
    .min(1, { message: "يجب تعيين مسؤول المهمة" }),
  dueDate: z.string()
    .min(1, { message: "تاريخ الاستحقاق مطلوب" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ الاستحقاق مطلوب"
    }),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent'], {
    errorMap: () => ({ message: "الأولوية مطلوبة" })
  }),
  decisionId: z.union([
    z.string().refine((val) => val === '' || !isNaN(Number(val)), {
      message: "معرف القرار يجب أن يكون رقم"
    }),
    z.number().int().positive()
  ]).optional()
});

export type TaskCreationFormData = z.infer<typeof taskCreationSchema>;

export const infrastructureProjectSchema = z.object({
  name: z.string()
    .min(1, { message: "اسم المشروع مطلوب (2 أحرف على الأقل)" })
    .min(2, { message: "اسم المشروع مطلوب (2 أحرف على الأقل)" })
    .max(255, { message: "اسم المشروع يجب أن لا يتجاوز 255 حرف" })
    .trim(),
  code: z.string()
    .min(1, { message: "رمز المشروع مطلوب" })
    .regex(/^[a-zA-Z0-9\-_]+$/, { message: "رمز المشروع غير صحيح" })
    .max(50, { message: "رمز المشروع يجب أن لا يتجاوز 50 حرف" })
    .optional()
    .or(z.literal('')),
  description: z.string()
    .max(500, { message: "الوصف يجب أن لا يتجاوز 500 حرف" })
    .optional()
    .or(z.literal('')),
  status: z.enum(['planning', 'development', 'testing', 'deployment', 'maintenance', 'completed', 'on_hold'], {
    errorMap: () => ({ message: "حالة المشروع مطلوبة" })
  }),
  priority: z.enum(['low', 'medium', 'high', 'critical'], {
    errorMap: () => ({ message: "أولوية المشروع مطلوبة" })
  }),
  progress: z.union([
    z.number().int().min(0).max(100),
    z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100), {
      message: "نسبة الإنجاز يجب أن تكون بين 0 و 100"
    })
  ]).optional(),
  startDate: z.string()
    .refine((date) => date === '' || !isNaN(Date.parse(date)), {
      message: "تاريخ البداية غير صحيح"
    })
    .optional()
    .or(z.literal('')),
  endDate: z.string()
    .refine((date) => date === '' || !isNaN(Date.parse(date)), {
      message: "تاريخ الانتهاء غير صحيح"
    })
    .optional()
    .or(z.literal('')),
  budget: z.union([
    z.number().positive({ message: "الميزانية يجب أن تكون رقم موجب" }),
    z.string().refine((val) => val === '' || (!isNaN(Number(val)) && Number(val) > 0), {
      message: "الميزانية يجب أن تكون رقم موجب"
    })
  ]).optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.startDate !== '' && data.endDate !== '') {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية"
      });
    }
  }
});

export type InfrastructureProjectFormData = z.infer<typeof infrastructureProjectSchema>;
