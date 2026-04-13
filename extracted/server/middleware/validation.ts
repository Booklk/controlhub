import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";

export const validateRequest = (schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: 'خطأ في التحقق من البيانات',
          details: errors
        });
      }
      next(error);
    }
  };
};

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'معرف غير صالح').transform(Number)
});

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

const jcsaEmailSchema = z.string()
  .email('البريد الإلكتروني غير صالح')
  .refine(
    (email) => email.toLowerCase().endsWith('@jcsa.sa'),
    { message: 'يجب أن يكون البريد الإلكتروني من نطاق @jcsa.sa' }
  );

export const userCreateSchema = z.object({
  email: jcsaEmailSchema,
  name: z.string().min(2, 'الاسم قصير جداً').max(200, 'الاسم طويل جداً'),
  nameEn: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  role: z.string().optional(),
  portal: z.string().optional(),
  departmentId: z.number().int().positive().optional(),
  itDepartmentId: z.number().int().positive().optional(),
  jobTitle: z.string().max(200).optional()
});

export const userUpdateSchema = userCreateSchema.partial();

export const loginSchema = z.object({
  email: z.string()
    .email('البريد الإلكتروني غير صالح')
    .refine(
      (email) => email.toLowerCase().endsWith('@jcsa.sa'),
      { message: 'يجب أن يكون البريد الإلكتروني من نطاق @jcsa.sa' }
    ),
  password: z.string().min(1, 'كلمة المرور مطلوبة')
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
    .regex(/[a-z]/, 'يجب أن تحتوي على حرف صغير')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword']
});

export const ticketCreateSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(300, 'العنوان طويل جداً'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).optional(),
  departmentId: z.number().int().positive().optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const ticketUpdateSchema = ticketCreateSchema.partial().extend({
  status: z.enum(['open', 'assigned', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
  assigneeId: z.number().int().positive().optional()
});

export const ticketStatusSchema = z.object({
  status: z.enum(['open', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'], {
    errorMap: () => ({ message: 'حالة التذكرة غير صالحة' })
  }),
  resolution: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const taskStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'on_hold', 'deferred'], {
    errorMap: () => ({ message: 'حالة المهمة غير صالحة' })
  }),
});

export const userToggleSchema = z.object({
  isActive: z.boolean({ required_error: 'حالة المستخدم مطلوبة' }),
});

export const projectCreateSchema = z.object({
  nameAr: z.string().min(3, 'الاسم قصير جداً').max(200),
  nameEn: z.string().max(200).optional(),
  description: z.string().optional(),
  itDepartmentId: z.number().int().positive(),
  managerId: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().positive().optional()
});

export const evidenceCreateSchema = z.object({
  requirementId: z.number().int().positive(),
  title: z.string().min(3, 'العنوان قصير جداً').max(300),
  description: z.string().optional(),
  departmentId: z.number().int().positive().optional()
});

export const decisionCreateSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(500),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  votingDeadline: z.string().optional(),
  implementationDeadline: z.string().optional()
});

export const voteSchema = z.object({
  vote: z.enum(['for', 'against', 'abstain']),
  comments: z.string().optional()
});

export const meetingCreateSchema = z.object({
  title: z.string().min(5, 'العنوان قصير جداً').max(300),
  meetingType: z.enum(['regular', 'emergency', 'special']).optional(),
  scheduledDate: z.string().min(1, 'تاريخ الاجتماع مطلوب'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  isVirtual: z.boolean().optional(),
  virtualLink: z.string().optional(),
  agenda: z.string().optional()
});

export const complianceReportSchema = z.object({
  title: z.string().min(3, 'العنوان قصير جداً').max(500, 'العنوان طويل جداً'),
  reportType: z.string().min(1, 'نوع التقرير مطلوب').max(100),
  framework: z.string().max(100).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived', 'rejected']).optional(),
  findings: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
  score: z.number().min(0).max(100).optional(),
  period: z.string().max(100).optional(),
});

export const ndmoAssessmentSchema = z.object({
  domainId: z.union([z.string(), z.number()]).transform(v => String(v)).pipe(z.string().min(1, 'معرف النطاق مطلوب').max(100)),
  fiscalQuarter: z.string().min(1, 'الربع المالي مطلوب').max(10),
  fiscalYear: z.union([z.string(), z.number()]).transform(v => Number(v)).pipe(z.number().int().min(2020).max(2050)),
  specifications: z.array(z.any()).optional().default([]),
  overallScore: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  submittedToNdmo: z.boolean().optional(),
});

export const complianceReportUpdateSchema = complianceReportSchema.partial();

export const ndmoAssessmentUpdateSchema = ndmoAssessmentSchema.partial();

export const taskEscalationSchema = z.object({
  escalatedTo: z.number().int().positive().optional(),
  reason: z.string().max(1000, 'سبب التصعيد يجب ألا يتجاوز 1000 حرف').optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).optional(),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'يجب تحديد عنصر واحد على الأقل').max(100, 'الحد الأقصى 100 عنصر'),
});

export const bulkStatusSchema = bulkIdsSchema.extend({
  status: z.string().min(1, 'الحالة مطلوبة'),
});

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

const PROTECTED_FIELDS = new Set([
  'id', 'createdAt', 'created_at', 'createdBy', 'created_by',
  'passwordHash', 'password_hash', 'activationToken', 'activation_token',
  'activationTokenExpiry', 'activation_token_expiry',
  'role', 'portal', 'isActive', 'is_active', 'deletedAt', 'deleted_at',
]);

export const stripProtectedFields = <T extends Record<string, any>>(obj: T, extraProtected?: string[]): Partial<T> => {
  const blocked = extraProtected ? new Set([...Array.from(PROTECTED_FIELDS), ...extraProtected]) : PROTECTED_FIELDS;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!blocked.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
};

const USER_SENSITIVE_FIELDS = new Set([
  'passwordHash', 'password_hash',
  'activationToken', 'activation_token',
  'activationTokenExpiry', 'activation_token_expiry',
  'passwordResetToken', 'password_reset_token',
  'passwordResetExpiry', 'password_reset_expiry',
  'twoFactorSecret', 'two_factor_secret',
]);

export const sanitizeUser = <T extends Record<string, any>>(user: T): Partial<T> => {
  if (!user) return user;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!USER_SENSITIVE_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  return safe as Partial<T>;
};

const DB_CONNECTION_SENSITIVE_FIELDS = new Set([
  'encryptedPassword', 'encrypted_password',
  'password', 'sshKey', 'ssh_key', 'privateKey', 'private_key',
  'connectionString', 'connection_string',
  'apiKey', 'api_key', 'secretKey', 'secret_key',
]);

export const sanitizeDbConnection = <T extends Record<string, any>>(conn: T): Partial<T> => {
  if (!conn) return conn;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(conn)) {
    if (!DB_CONNECTION_SENSITIVE_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  return safe as Partial<T>;
};

export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
};
