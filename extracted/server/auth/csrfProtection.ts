/**
 * CSRF Protection Middleware
 * Control Hub - JCSA
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = '_csrf';
const CSRF_SECRET = process.env.SESSION_SECRET || 'csrf-secret-dev';

// Generate CSRF token
export function generateCSRFToken(sessionId: string): string {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

// Verify CSRF token
export function verifyCSRFToken(token: string, sessionId: string): boolean {
  if (!token || !sessionId) return false;
  
  try {
    const [timestamp, signature] = token.split('.');
    if (!timestamp || !signature) return false;
    
    // Check token age (max 24 hours)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 24 * 60 * 60 * 1000) return false;
    
    // Verify signature
    const data = `${sessionId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', CSRF_SECRET)
      .update(data)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// CSRF Protection Middleware
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // CSRF protection is always enabled in production
    
    // Skip for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // Skip for login/register/refresh only (no session exists yet, CSRF not applicable)
    if (req.path.includes('/auth/login') || req.path.includes('/auth/register') || req.path.includes('/auth/refresh') || req.path.includes('/auth/forgot-password')) {
      return next();
    }
    
    // File upload endpoints now require CSRF tokens (passed via header alongside multipart data)
    
    // Skip for public API endpoints (DSR, webhooks)
    if (req.path.includes('/public/')) {
      return next();
    }
    
    const csrfToken = req.headers[CSRF_TOKEN_HEADER] as string;
    const sessionToken = req.cookies?.[CSRF_COOKIE_NAME] || (req as any).sessionId;
    
    if (!csrfToken) {
      // In development, allow requests without CSRF
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: 'CSRF token مطلوب',
        messageEn: 'CSRF token required',
      });
    }
    
    if (!verifyCSRFToken(csrfToken, sessionToken)) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token غير صالح',
        messageEn: 'Invalid CSRF token',
      });
    }
    
    next();
  };
}

// CSRF Token Endpoint Handler
export function getCSRFTokenHandler(req: Request, res: Response) {
  const sessionId = (req as any).sessionId || crypto.randomBytes(16).toString('hex');
  const token = generateCSRFToken(sessionId);
  
  // Use 'lax' for production to allow cookies through WAF/reverse proxy
  // 'strict' blocks cookies on cross-site requests which breaks WAF setups
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie(CSRF_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // Changed from 'strict' to work with WAF/reverse proxy
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
  
  res.json({ csrfToken: token });
}

// Export middleware instance
export const csrfMiddleware = csrfProtection();
