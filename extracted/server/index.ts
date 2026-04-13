import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { setupSwagger } from "./swagger";
import { attachGovernanceContext, auditAllRequests, sessionValidator } from "./middleware/governance";
import { notificationHub } from "./websocket/notificationHub";
import { csrfProtection, csrfMiddleware } from "./auth/csrfProtection";
import { applySecurityMiddleware, logger } from "./security-middleware";
import { universalAuditInterceptor, attachRequestId } from "./middleware/audit";
process.on('unhandledRejection', (reason: any) => {
  logger.error('[Process] Unhandled Promise Rejection:', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('[Process] Uncaught Exception — shutting down gracefully:', { message: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 500);
});

// Environment Validation
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
const optionalEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    logger.error(`CRITICAL: Missing required environment variable: ${varName}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
});

optionalEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    logger.warn(`WARNING: Missing optional environment variable: ${varName}`);
  }
});

const app = express();

// Security: Trust proxy (needed for WAF and Rate Limiting)
app.set('trust proxy', 1);

import path from 'path';

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security: Apply all security middleware (unified config from security-middleware)
applySecurityMiddleware(app);

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Cookie Parser for CSRF protection
app.use(cookieParser());

// Logging: Morgan for development only (custom winston logger handles production)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
    limit: '10mb',
  }),
);

app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Governance Layer - طبقة الحوكمة
app.use(attachGovernanceContext());
app.use('/api/', auditAllRequests());
app.use('/api/', sessionValidator());

// Universal Audit Interceptor - تدقيق شامل لجميع العمليات
app.use(attachRequestId());
app.use(universalAuditInterceptor());

// CSRF Protection - حماية من هجمات CSRF
app.use('/api/', csrfMiddleware);

export function log(message: string, source = "express") {
  logger.info(`[${source}] ${message}`);
}

const SENSITIVE_LOG_FIELDS = new Set(['token', 'accessToken', 'refreshToken', 'passwordHash', 'password', 'secret', 'apiKey', 'csrfToken']);

function sanitizeForLog(obj: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_LOG_FIELDS.has(k)) {
      safe[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      safe[k] = sanitizeForLog(v);
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || (!req.path.startsWith('/api') && !req.path.includes('.'))) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

(async () => {
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }
  
  // Initialize WebSocket notification hub
  notificationHub.initialize(httpServer);
  
  await registerRoutes(httpServer, app);
  
  // Start smart notification scheduler
  const { startNotificationScheduler } = await import("./notification-service");
  startNotificationScheduler();

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error("Request Error:", { 
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });

    if (res.headersSent) {
      return next(err);
    }

    const safeMessage = process.env.NODE_ENV === 'production' 
      ? 'حدث خطأ في الخادم' 
      : message;
    return res.status(status).json({ message: safeMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  const shutdown = (signal: string) => {
    logger.info(`[Process] ${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      logger.info('[Process] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('[Process] Forced exit after 10s timeout');
      process.exit(1);
    }, 10_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
})();
