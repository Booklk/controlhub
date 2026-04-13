/**
 * Token Manager - نظام إدارة التوكنات المتقدم
 * Control Hub - JCSA
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { sessions, users } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

// Token Configuration
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const TOKEN_ROTATION_ENABLED = true;

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  portal: string;
  departmentId?: number;
  itDepartmentId?: number;
  sessionId: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Get JWT secret with fallback for development
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret || 'dev-secret-change-in-production';
}

// Generate secure random token
function generateSecureToken(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Verify CSRF token
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false;
  const expectedToken = crypto
    .createHmac('sha256', getJWTSecret())
    .update(sessionToken)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken.substring(0, token.length))
  );
}

// Create access token
export function createAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS512',
    issuer: 'control-hub-jcsa',
    audience: 'control-hub-api',
  });
}

// Verify access token
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJWTSecret(), {
      algorithms: ['HS512'],
      issuer: 'control-hub-jcsa',
      audience: 'control-hub-api',
    }) as TokenPayload;
  } catch (error) {
    return null;
  }
}

// Create token pair (access + refresh)
export async function createTokenPair(user: any, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
  const sessionId = generateSecureToken(32);
  const refreshToken = generateSecureToken(64);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    portal: user.portal,
    departmentId: user.departmentId,
    itDepartmentId: user.itDepartmentId,
    sessionId,
  };
  
  const accessToken = createAccessToken(payload);
  
  // Store refresh token in database
  await db.insert(sessions).values({
    userId: user.id,
    token: refreshToken,
    expiresAt,
    ipAddress: ipAddress || '',
    userAgent: userAgent || '',
    isActive: true,
    isTrusted: false,
    lastActivityAt: new Date(),
    loginMethod: 'password',
    createdAt: new Date(),
  });
  
  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

// Refresh token pair
export async function refreshTokenPair(refreshToken: string, ipAddress: string): Promise<TokenPair | null> {
  // Find valid session
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, refreshToken),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (!session) {
    return null;
  }
  
  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  
  if (!user || !user.isActive) {
    // Invalidate session if user is inactive
    await db.update(sessions).set({ isActive: false }).where(eq(sessions.id, session.id));
    return null;
  }
  
  // Token rotation - invalidate old refresh token
  if (TOKEN_ROTATION_ENABLED) {
    await db.update(sessions).set({ isActive: false, revokedAt: new Date(), revokedReason: 'token_rotated' }).where(eq(sessions.id, session.id));
  }
  
  // Create new token pair
  const newTokenPair = await createTokenPair(user, ipAddress, session.userAgent || '');
  
  return newTokenPair;
}

// Revoke all sessions for user
export async function revokeAllUserSessions(userId: number): Promise<void> {
  await db.update(sessions).set({ 
    isActive: false, 
    revokedAt: new Date(), 
    revokedReason: 'user_logout_all' 
  }).where(eq(sessions.userId, userId));
}

// Revoke single session
export async function revokeSession(token: string): Promise<void> {
  await db.update(sessions).set({ 
    isActive: false, 
    revokedAt: new Date(), 
    revokedReason: 'user_logout' 
  }).where(eq(sessions.token, token));
}

// Clean expired sessions
export async function cleanExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// Validate session is active
export async function isSessionActive(token: string): Promise<boolean> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  
  return !!session;
}

// Get user's active sessions
export async function getUserActiveSessions(userId: number): Promise<any[]> {
  return await db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      browser: sessions.browser,
      os: sessions.os,
      deviceType: sessions.deviceType,
      location: sessions.location,
      isTrusted: sessions.isTrusted,
      lastActivityAt: sessions.lastActivityAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    );
}

// Update session activity
export async function updateSessionActivity(token: string): Promise<void> {
  await db.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.token, token));
}
