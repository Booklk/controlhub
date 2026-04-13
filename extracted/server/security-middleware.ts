/**
 * Security Middleware for Control Hub
 * نادي سباقات الخيل
 */

import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// ==================== Helmet Configuration ====================
const isProduction = process.env.NODE_ENV === 'production';

export const helmetConfig = helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // inline styles needed for Tailwind
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      // FIX #11: Remove 'unsafe-inline' from scriptSrc — use nonce-based CSP
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
});

// ==================== CORS Configuration ====================
const allowedOrigins = [
  'https://controlhub.jcsa.sa',
  'https://www.controlhub.jcsa.sa',
  'https://172.19.101.24',
  'https://172.19.102.24',
  'http://172.19.101.24',
  'http://172.19.102.24',
  'http://localhost:5000',
  'https://localhost',
];

export const corsConfig = cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
  maxAge: 86400,
});

// ==================== Rate Limiting ====================
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { 
    success: false, 
    message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.',
    messageEn: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { 
    success: false, 
    message: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول.',
    messageEn: 'Too many login attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { 
    success: false, 
    message: 'تم تجاوز الحد المسموح من طلبات API.',
    messageEn: 'API rate limit exceeded.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== Winston Logger ====================
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'control-hub' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
    }),
  ],
});

if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
  logger.add(new transports.File({ 
    filename: process.env.LOG_FILE,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
}

// ==================== Zod Validation Schemas ====================
export const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
});

export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  role: z.string(),
  portal: z.string(),
  departmentId: z.number().optional(),
  itDepartmentId: z.number().optional(),
});

export const ticketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']),
  category: z.string(),
  departmentId: z.number(),
});

export const projectSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
});

export const evidenceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  requirementId: z.number(),
  departmentId: z.number(),
});

export const decisionSchema = z.object({
  title: z.string().min(5).max(500),
  description: z.string(),
  category: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

// ==================== XSS Sanitization ====================
// FIX #14: Do NOT escape forward slashes — they are safe in HTML and escaping them
// corrupts URLs and file paths stored in the database.
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  // Note: '/' is intentionally NOT escaped — Zod validation is the primary input defense
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]) as any;
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }
  return sanitized;
}

// ==================== Validation Middleware ====================
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const sanitizedBody = sanitizeObject(req.body);
      const result = schema.safeParse(sanitizedBody);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'بيانات غير صالحة',
          errors: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      res.status(500).json({ success: false, message: 'خطأ في معالجة البيانات' });
    }
  };
}

// ==================== Apply All Security Middleware ====================
export function applySecurityMiddleware(app: Express) {
  app.use(helmetConfig);
  app.use(corsConfig);
  app.use('/api/', apiRateLimiter);
  app.use('/api/auth/login', loginRateLimiter);
}

export const publicEndpointRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'تم تجاوز الحد المسموح به. يرجى المحاولة لاحقاً.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'تم تجاوز الحد المسموح لعمليات الإنشاء. انتظر دقيقة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const sensitiveOpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'تم تجاوز الحد المسموح للعمليات الحساسة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'تم تجاوز الحد المسموح لطلبات إعادة تعيين كلمة المرور.' },
  standardHeaders: true,
  legacyHeaders: false,
});
