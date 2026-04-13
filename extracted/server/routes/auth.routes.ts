import type { Express } from "express";
import {
  storage, db, parseId, logger, authenticateToken, getJWTSecret, getRefreshSecret,
  JWT_ALGORITHM, checkLoginAttemptsByDB, recordFailedLoginDB, clearLoginAttemptsDB,
  blacklistToken,
  bcrypt, jwt, crypto, sql, eq, and, sessions, users, committeeMembers,
  validateRequest, loginSchema, sendEmail, generateActivationEmail,
  publicEndpointRateLimiter, USER_ROLES
} from "./shared";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", validateRequest({ body: loginSchema }), async (req, res) => {
    try {
      const { password } = req.body;
      const email = (req.body.email || '').trim().toLowerCase();
      const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

      const attemptCheck = await checkLoginAttemptsByDB(email);
      if (!attemptCheck.allowed) {
        const remainingMs = attemptCheck.lockedUntil ? attemptCheck.lockedUntil.getTime() - Date.now() : 0;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        logger.warn(`[Security] Blocked login attempt for locked account: ${email} from ${clientIp}`);
        await storage.createAuditLog({
          userId: null, action: 'login_blocked', entityType: 'security', entityId: null,
          oldValue: null, newValue: null, ipAddress: clientIp as string, userAgent: req.headers['user-agent'] || null,
          details: `محاولة دخول محظورة - الحساب مقفل لمدة ${remainingMinutes} دقيقة`,
        });
        return res.status(429).json({ 
          error: `تم قفل الحساب مؤقتاً بسبب محاولات متكررة. حاول بعد ${remainingMinutes} دقيقة` 
        });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        await recordFailedLoginDB(email).catch((e) => logger.warn('[Auth] recordFailedLoginDB error:', { error: e?.message }));
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      }

      if (!user.isActive) {
        await storage.createAuditLog({
          userId: user.id, action: 'login_failed', entityType: 'security', entityId: user.id,
          oldValue: null, newValue: null, ipAddress: clientIp as string, userAgent: req.headers['user-agent'] || null,
          details: 'محاولة دخول لحساب معطل',
        });
        return res.status(401).json({ error: 'الحساب معطل - تواصل مع المسؤول' });
      }

      if (!user.isActivated) {
        return res.status(401).json({ error: 'الحساب غير مفعل - تحقق من بريدك الإلكتروني' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash || '');
      
      if (!validPassword) {
        await recordFailedLoginDB(email);
        const remaining = attemptCheck.remainingAttempts - 1;
        await storage.createAuditLog({
          userId: user.id, action: 'login_failed', entityType: 'security', entityId: user.id,
          oldValue: null, newValue: null, ipAddress: clientIp as string, userAgent: req.headers['user-agent'] || null,
          details: `كلمة مرور خاطئة - المحاولات المتبقية: ${remaining}`,
        });
        if (remaining <= 2 && remaining > 0) {
          return res.status(401).json({ error: `بيانات الدخول غير صحيحة - متبقي ${remaining} محاولات` });
        }
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      }

      await clearLoginAttemptsDB(email);

      let isCommitteeMember = false;
      let committeeRole: string | null = null;
      try {
        const [membership] = await db.select({ committeeRole: committeeMembers.committeeRole })
          .from(committeeMembers)
          .where(and(eq(committeeMembers.userId, user.id), eq(committeeMembers.isActive, true)))
          .limit(1);
        if (membership) {
          isCommitteeMember = true;
          committeeRole = membership.committeeRole;
        }
      } catch (_) {}

      const tokenId = crypto.randomBytes(16).toString('hex');
      const accessToken = jwt.sign(
        { 
          id: user.id, email: user.email, role: user.role, portal: user.portal,
          name: user.name, departmentId: user.departmentId, itDepartmentId: user.itDepartmentId,
          isCommitteeMember, committeeRole,
          jti: tokenId,
        },
        getJWTSecret(),
        { expiresIn: '8h', algorithm: 'HS512', issuer: 'controlhub.jcsa.sa', audience: 'controlhub-api' }
      );

      const refreshToken = jwt.sign(
        { id: user.id, jti: crypto.randomBytes(16).toString('hex'), type: 'refresh' },
        getRefreshSecret(),
        { expiresIn: '7d', algorithm: 'HS512', issuer: 'controlhub.jcsa.sa' }
      );

      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      const ua = req.headers['user-agent'] || '';
      const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s]?([\d.]+)/i);
      const osMatch = ua.match(/(Windows NT|Mac OS X|Linux|Android|iOS)[\/\s]?([\d._]+)?/i);
      const isMobile = /Mobile|Android/i.test(ua);
      try {
        await db.insert(sessions).values({
          userId: user.id, token: refreshToken, ipAddress: clientIp || '', userAgent: ua,
          deviceType: isMobile ? 'mobile' : 'desktop',
          browser: browserMatch ? `${browserMatch[1]} ${browserMatch[2] || ''}`.trim() : 'Unknown',
          os: osMatch ? `${osMatch[1]} ${osMatch[2] || ''}`.trim().replace(/_/g, '.') : 'Unknown',
          isActive: true, isTrusted: false, loginMethod: 'password',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      } catch (sessionErr: any) {
        logger.warn('Failed to create session record', { error: sessionErr?.message });
      }

      await storage.createAuditLog({
        userId: user.id, action: 'login', entityType: 'user', entityId: user.id,
        oldValue: null, newValue: null, ipAddress: clientIp as string, userAgent: req.headers['user-agent'] || null,
        details: 'تسجيل دخول ناجح',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth',
      });

      res.json({
        success: true, token: accessToken,
        mustChangePassword: user.mustChangePassword || false,
        user: {
          id: user.id, email: user.email, name: user.name, nameEn: user.nameEn,
          role: user.role, portal: user.portal, avatar: user.avatar, jobTitle: user.jobTitle,
          departmentId: user.departmentId, itDepartmentId: user.itDepartmentId,
          mustChangePassword: user.mustChangePassword || false,
          isCommitteeMember, committeeRole,
        }
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Login error:', { message: errorMessage, stack: error?.stack });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة مطلوبة' });
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، ورمز خاص (@#$!...)' });
      }
      const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      if (!user.mustChangePassword) {
        if (!currentPassword) return res.status(400).json({ error: 'كلمة المرور الحالية مطلوبة' });
        const valid = await bcrypt.compare(currentPassword, user.passwordHash || '');
        if (!valid) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }
      const newHash = await bcrypt.hash(newPassword, 12);
      await db.update(users).set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, req.user.id));
      await storage.createAuditLog({
        userId: req.user.id, action: 'update', entityType: 'user', entityId: req.user.id,
        details: 'تغيير كلمة المرور', ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
        oldValue: null, newValue: null,
      });
      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (error) {
      logger.error('change-password error', { error });
      res.status(500).json({ error: 'حدث خطأ في تغيير كلمة المرور' });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
      }
      const decoded: any = jwt.verify(refreshToken, getRefreshSecret(), { algorithms: ['HS512'], issuer: 'controlhub.jcsa.sa' });
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'توكن غير صالح' });
      }
      const [existingSession] = await db.select().from(sessions)
        .where(and(eq(sessions.userId, decoded.id), eq(sessions.token, refreshToken))).limit(1);
      if (!existingSession) {
        res.clearCookie('refreshToken', { path: '/api/auth' });
        return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول مجدداً' });
      }
      const user = await storage.getUserById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'الحساب غير متاح' });
      }
      const newRefreshToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, portal: user.portal, type: 'refresh' },
        getRefreshSecret(),
        { expiresIn: '7d', algorithm: 'HS512', issuer: 'controlhub.jcsa.sa' }
      );
      await db.update(sessions).set({ token: newRefreshToken, updatedAt: new Date() } as any)
        .where(eq(sessions.id, existingSession.id));
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, portal: user.portal, name: user.name, departmentId: user.departmentId, itDepartmentId: user.itDepartmentId, jti: crypto.randomBytes(16).toString('hex') },
        getJWTSecret(),
        { expiresIn: '8h', algorithm: 'HS512', issuer: 'controlhub.jcsa.sa', audience: 'controlhub-api' }
      );
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth',
      });
      res.json({ success: true, token: newAccessToken });
    } catch (error: any) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول مجدداً' });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.jti) {
        await blacklistToken(req.user.jti, req.user.id, 'logout');
      }
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await db.delete(sessions).where(
          and(eq(sessions.userId, req.user.id), eq(sessions.token, refreshToken))
        ).catch((e: any) => logger.warn('[Auth] Session cleanup error:', { error: e?.message }));
      }
      await storage.createAuditLog({
        userId: req.user.id, action: 'logout', entityType: 'user', entityId: req.user.id,
        oldValue: null, newValue: null, ipAddress: (req.ip || '') as string, userAgent: req.headers['user-agent'] || null,
        details: 'تسجيل خروج',
      });
    } catch (e: any) {
      logger.warn('Failed to create logout audit log', { error: e?.message });
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      res.json({
        id: user.id, email: user.email, name: user.name,
        nameEn: user.nameEn || user.name, role: user.role, portal: user.portal,
        avatar: user.avatar, jobTitle: user.jobTitle,
        departmentId: user.departmentId, itDepartmentId: user.itDepartmentId,
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/activate/verify", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.json({ valid: false, message: 'رمز التفعيل غير صالح' });
      }
      const user = await storage.getUserByActivationToken(token);
      if (!user) {
        return res.json({ valid: false, message: 'رمز التفعيل غير موجود أو منتهي الصلاحية' });
      }
      if (user.activationTokenExpiry && new Date(user.activationTokenExpiry) < new Date()) {
        return res.json({ valid: false, message: 'انتهت صلاحية رابط التفعيل' });
      }
      res.json({ valid: true, userName: user.name, email: user.email });
    } catch (error) {
      logger.error('Verify activation token error:', { error });
      res.json({ valid: false, message: 'حدث خطأ في التحقق من الرمز' });
    }
  });

  app.post("/api/activate", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: 'الرمز وكلمة المرور مطلوبان' });
      }
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      }
      if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على حرف كبير' });
      if (!/[a-z]/.test(password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على حرف صغير' });
      if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على رقم' });
      if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>\/?\\|`~]/.test(password)) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على رمز خاص' });
      }
      const user = await storage.getUserByActivationToken(token);
      if (!user) return res.status(400).json({ error: 'رمز التفعيل غير صالح أو منتهي الصلاحية' });
      if (user.activationTokenExpiry && new Date(user.activationTokenExpiry) < new Date()) {
        return res.status(400).json({ error: 'انتهت صلاحية رابط التفعيل' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUser(user.id, { passwordHash, isActivated: true, activationToken: null, activationTokenExpiry: null });
      await storage.createAuditLog({
        userId: user.id, action: 'activate', entityType: 'user', entityId: user.id,
        oldValue: null, newValue: JSON.stringify({ activated: true }),
        ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
        details: `تفعيل حساب المستخدم: ${user.name}`,
      });
      res.json({ success: true, message: 'تم تفعيل الحساب بنجاح' });
    } catch (error) {
      logger.error('Activate account error:', { error });
      res.status(500).json({ error: 'حدث خطأ في تفعيل الحساب' });
    }
  });

  app.post("/api/users/:id/resend-activation", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== USER_ROLES.SYSTEM_ADMIN) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const userId = parseId(req.params.id, res);
      if (!userId) return;
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      if (user.isActivated) return res.status(400).json({ error: 'الحساب مفعل بالفعل' });
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.updateUser(userId, { activationToken, activationTokenExpiry });
      const baseUrl = process.env.APP_URL || 'https://controlhub.jcsa.sa';
      const activationUrl = `${baseUrl}/activate?token=${activationToken}`;
      const emailHtml = generateActivationEmail({ recipientName: user.name, activationUrl });
      const emailSent = await sendEmail(user.email, 'تفعيل حسابك في Control Hub - JCSA', emailHtml);
      await storage.createAuditLog({
        userId: req.user.id, action: 'resend_activation', entityType: 'user', entityId: userId,
        oldValue: null, newValue: JSON.stringify({ emailSent }),
        ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
        details: `إعادة إرسال رابط التفعيل للمستخدم: ${user.name}`,
      });
      res.json({ success: true, emailSent });
    } catch (error) {
      logger.error('Resend activation error:', { error });
      res.status(500).json({ error: 'حدث خطأ في إعادة إرسال رابط التفعيل' });
    }
  });
}
