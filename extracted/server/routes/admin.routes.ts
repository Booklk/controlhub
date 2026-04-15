import type { Express } from "express";
import {
  storage, db, parseId, handleDbError, logger, cache, TTL, invalidateDashboardCaches,
  authenticateToken, crypto,
  sql, eq, and, desc,
  sessions, auditLogs, users, notifications,
  requireView, requireCreate, requireUpdate, requireDelete,
  requirePortal,
  RESOURCES,
  ADMIN_PORTALS,
  sendEmail, generateActivationEmail, generatePasswordResetEmail,
  stripProtectedFields, sanitizeUser,
  validateRequest, userUpdateSchema, userToggleSchema,
  itTickets,
} from './shared';

export function registerAdminRoutes(app: Express) {

  // ==================== Users Routes ====================
  
  app.get("/api/users", authenticateToken, requireView(RESOURCES.USERS), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        nameEn: u.nameEn,
        role: u.role,
        portal: u.portal,
        isActive: u.isActive,
        isActivated: u.isActivated,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role || '';
      const isPrivileged = ['system_admin', 'it_director'].includes(requesterRole);
      const isSelf = requesterId === id;

      if (isPrivileged || isSelf) {
        res.json({
          id: user.id,
          email: user.email,
          name: user.name,
          nameEn: user.nameEn,
          role: user.role,
          portal: user.portal,
          phone: user.phone,
          jobTitle: user.jobTitle,
          departmentId: user.departmentId,
          itDepartmentId: user.itDepartmentId,
          isActive: user.isActive,
          isActivated: user.isActivated,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        });
      } else {
        res.json({
          id: user.id,
          name: user.name,
          nameEn: user.nameEn,
          role: user.role,
          portal: user.portal,
          jobTitle: user.jobTitle,
          departmentId: user.departmentId,
          itDepartmentId: user.itDepartmentId,
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // Get user statistics
  app.get("/api/users/:id/stats", authenticateToken, requireView(RESOURCES.USERS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [ticketCount, sessionCount, auditCount, user] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(itTickets).where(eq(itTickets.requesterId, id)),
        db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(and(eq(sessions.userId, id), eq(sessions.isActive, true))),
        db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(eq(auditLogs.userId, id)),
        db.select().from(users).where(eq(users.id, id)).limit(1),
      ]);

      const recentLogs = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      }).from(auditLogs).where(eq(auditLogs.userId, id)).orderBy(desc(auditLogs.createdAt)).limit(5);

      res.json({
        ticketsCreated: ticketCount[0]?.count || 0,
        activeSessions: sessionCount[0]?.count || 0,
        totalAuditLogs: auditCount[0]?.count || 0,
        lastLoginAt: user[0]?.lastLoginAt || null,
        recentActivity: recentLogs,
      });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب إحصائيات المستخدم' });
    }
  });

  // Revoke all sessions for a user (force logout)
  app.delete("/api/users/:id/sessions", authenticateToken, requireDelete(RESOURCES.SESSIONS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      await db.update(sessions).set({ isActive: false }).where(eq(sessions.userId, id));

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إلغاء جلسات مستخدم',
        entityType: 'user',
        entityId: id,
        details: `تم إلغاء جميع جلسات المستخدم (id: ${id}) بواسطة ${req.user.name || req.user.email}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'تم إلغاء جميع الجلسات بنجاح' });
    } catch (error) {
      handleDbError(error, res, 'إلغاء جلسات المستخدم');
    }
  });

  // Reset user password (admin action)
  app.post("/api/users/:id/reset-password", authenticateToken, requireUpdate(RESOURCES.USERS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const targetUser = await storage.getUserById(id);
      if (!targetUser) return res.status(404).json({ error: 'المستخدم غير موجود' });

      // Send password reset email
      const crypto = await import('crypto');
      const tempToken = crypto.default.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.update(users).set({ activationToken: tempToken, activationTokenExpiresAt: expiresAt }).where(eq(users.id, id));
      const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/activate?token=${tempToken}`;
      const html = generatePasswordResetEmail({ recipientName: targetUser.name || 'مستخدم', resetUrl });
      await sendEmail(targetUser.email, 'إعادة تعيين كلمة المرور - Control Hub', html);

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'إعادة ضبط كلمة المرور',
        entityType: 'user',
        entityId: id,
        details: `تم إرسال رابط إعادة ضبط كلمة المرور للمستخدم ${targetUser.email}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'تم إرسال رابط إعادة ضبط كلمة المرور عبر البريد الإلكتروني' });
    } catch (error) {
      handleDbError(error, res, 'إعادة ضبط كلمة المرور');
    }
  });

  app.post("/api/users", authenticateToken, requireCreate(RESOURCES.USERS), async (req: any, res) => {
    try {
      const { email, name, phone, role, portal, departmentId, itDepartmentId, jobTitle, nameEn } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: 'الاسم مطلوب' });
      }
      
      // Validate email domain
      if (!email || !email.endsWith('@jcsa.sa')) {
        return res.status(400).json({ error: 'البريد الإلكتروني يجب أن يكون بدومين @jcsa.sa' });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
      
      // تحديد البوابة تلقائياً بناءً على الدور
      const roleToPortal: Record<string, string> = {
        system_admin: 'admin',
        it_director: 'it_director',
        it_infrastructure_manager: 'infrastructure',
        it_cybersecurity_manager: 'cybersecurity',
        it_digital_manager: 'digital_transformation',
        it_support_manager: 'support',
        it_infrastructure_staff: 'infrastructure',
        it_cybersecurity_staff: 'cybersecurity',
        it_digital_staff: 'digital_transformation',
        it_support_staff: 'support',
        dmo_manager: 'dmo',
        dmo_staff: 'dmo',
        data_steward: 'steward',
        data_representative: 'data_rep',
        committee_chairman: 'committee',
        committee_vice_chairman: 'committee',
        committee_rapporteur: 'committee',
        committee_member: 'committee',
        employee: 'employee',
      };
      
      const userRole = role || 'user';
      const userPortal = portal || roleToPortal[userRole] || 'user';
      
      // Check if user wants to send activation email
      const sendActivationEmail = req.body.sendActivationEmail !== false;
      
      // Generate activation token
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const user = await storage.createUser({
        email,
        name,
        nameEn: nameEn || null,
        phone: phone || null,
        role: userRole,
        portal: userPortal,
        departmentId: departmentId || null,
        itDepartmentId: itDepartmentId || null,
        jobTitle: jobTitle || null,
        passwordHash: null,
        isActive: true,
        isActivated: false,
        activationToken,
        activationTokenExpiry,
        mustChangePassword: true,
      });
      
      // Send activation email
      let emailSent = false;
      if (sendActivationEmail) {
        const baseUrl = process.env.APP_URL || 'https://controlhub.jcsa.sa';
        const activationUrl = `${baseUrl}/activate?token=${activationToken}`;
        
        const emailHtml = generateActivationEmail({
          recipientName: user.name,
          activationUrl,
        });
        
        emailSent = await sendEmail(
          user.email,
          'تفعيل حسابك في Control Hub - JCSA',
          emailHtml
        );
      }
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'create',
        entityType: 'user',
        entityId: user.id,
        oldValue: null,
        newValue: JSON.stringify({ email: user.email, name: user.name, emailSent }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إنشاء مستخدم جديد: ${user.name}`,
      });
      
      invalidateDashboardCaches();
      res.json({ ...sanitizeUser(user), activationEmailSent: emailSent });
    } catch (error) {
      logger.error('Create user error:', { error });
      handleDbError(error, res, 'إنشاء المستخدم');
    }
  });

  app.put("/api/users/:id/toggle", authenticateToken, requireUpdate(RESOURCES.USERS), validateRequest({ body: userToggleSchema }), async (req: any, res) => {
    try {
      const userId = parseId(req.params.id, res);
      if (!userId) return;
      const { isActive } = req.body;

      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      if (existingUser.email?.toLowerCase() === 'controlhub@jcsa.sa') {
        return res.status(403).json({ error: 'لا يمكن تعطيل حساب مدير النظام الرئيسي' });
      }

      const user = await storage.updateUser(userId, { isActive });
      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'update',
        entityType: 'user',
        entityId: userId,
        oldValue: JSON.stringify({ isActive: !isActive }),
        newValue: JSON.stringify({ isActive }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: isActive ? 'تفعيل حساب المستخدم' : 'تعطيل حساب المستخدم',
      });
      
      invalidateDashboardCaches();
      res.json(sanitizeUser(user));
    } catch (error) {
      handleDbError(error, res, 'تبديل حالة المستخدم');
    }
  });

  // Update user
  app.put("/api/users/:id", authenticateToken, requireUpdate(RESOURCES.USERS), validateRequest({ body: userUpdateSchema }), async (req: any, res) => {
    try {
      const userId = parseId(req.params.id, res);
      if (!userId) return;
      const { name, nameEn, phone, role, portal, departmentId, itDepartmentId, jobTitle } = req.body;
      
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      
      // Validate name if provided
      if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 200)) {
        return res.status(400).json({ error: 'الاسم يجب أن يكون بين 1 و 200 حرف' });
      }
      
      // Only system_admin can change role/portal
      const currentUserRole = req.user?.role;
      if ((role !== undefined || portal !== undefined) && currentUserRole !== 'system_admin') {
        return res.status(403).json({ error: 'لا يمكنك تغيير الدور أو البوابة' });
      }
      
      // Validate phone format if provided
      if (phone !== undefined && phone !== '' && !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/im.test(phone)) {
        return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (nameEn !== undefined) updateData.nameEn = nameEn;
      if (phone !== undefined) updateData.phone = phone;
      if (role !== undefined) updateData.role = role;
      if (portal !== undefined) updateData.portal = portal;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (itDepartmentId !== undefined) updateData.itDepartmentId = itDepartmentId;
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle;

      // نقل الموظف بين الإدارات: تحديث role و portal تلقائياً
      const DEPT_TO_ROLE_MAP: Record<number, { staff: string; manager: string; portal: string }> = {
        5:  { staff: 'dmo_staff', manager: 'dmo_manager', portal: 'dmo' },
        9:  { staff: 'it_infrastructure_staff', manager: 'it_infrastructure_manager', portal: 'infrastructure' },
        10: { staff: 'it_cybersecurity_staff', manager: 'it_cybersecurity_manager', portal: 'cybersecurity' },
        11: { staff: 'it_digital_staff', manager: 'it_digital_manager', portal: 'digital_transformation' },
        12: { staff: 'it_support_staff', manager: 'it_support_manager', portal: 'support' },
      };
      const newDeptId = Number(updateData.itDepartmentId);
      if (newDeptId && DEPT_TO_ROLE_MAP[newDeptId] && newDeptId !== existingUser.itDepartmentId) {
        const deptInfo = DEPT_TO_ROLE_MAP[newDeptId];
        // تحديث البوابة تلقائياً
        if (!updateData.portal) {
          updateData.portal = deptInfo.portal;
        }
        // تحديث الدور تلقائياً (يحافظ على مستوى المدير إذا كان مدير)
        if (!updateData.role) {
          const isManager = existingUser.role?.includes('manager');
          updateData.role = isManager ? deptInfo.manager : deptInfo.staff;
        }
        logger.info(`[UserTransfer] User ${existingUser.name} transferred: dept ${existingUser.itDepartmentId} → ${newDeptId}, role → ${updateData.role}, portal → ${updateData.portal}`);
      }
      
      const user = await storage.updateUser(userId, updateData);
      
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'update',
        entityType: 'user',
        entityId: userId,
        oldValue: JSON.stringify({ name: existingUser.name, role: existingUser.role, portal: existingUser.portal }),
        newValue: JSON.stringify(updateData),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تحديث بيانات المستخدم: ${existingUser.name}`,
      });
      
      res.json(sanitizeUser(user as any));
    } catch (error) {
      logger.error('Error updating user:', { error });
      handleDbError(error, res, 'تحديث المستخدم');
    }
  });

  // Delete user
  app.delete("/api/users/:id", authenticateToken, requireDelete(RESOURCES.USERS), async (req: any, res) => {
    try {
      const userId = parseId(req.params.id, res);
      if (!userId) return;
      
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      
      // Prevent deleting system admin
      if (existingUser.email?.toLowerCase() === 'controlhub@jcsa.sa') {
        return res.status(403).json({ error: 'لا يمكن حذف حساب مدير النظام الرئيسي' });
      }

      // فحص التذاكر والمهام المسندة
      const [activeWork] = await db.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM it_tickets WHERE assignee_id = ${userId} AND status IN ('open','assigned','in_progress')) as open_tickets,
          (SELECT COUNT(*)::int FROM tasks WHERE assigned_to = ${userId} AND status IN ('pending','in_progress') AND deleted_at IS NULL) as active_tasks
      `);
      const work = (activeWork as any).rows?.[0] || (activeWork as any)[0] || {};
      const openTickets = Number(work.open_tickets) || 0;
      const activeTasks = Number(work.active_tasks) || 0;
      if (openTickets > 0 || activeTasks > 0) {
        return res.status(400).json({ error: `لا يمكن حذف المستخدم — لديه ${openTickets} تذكرة مفتوحة و ${activeTasks} مهمة نشطة. أعد إسنادها أولاً` });
      }

      await storage.deleteUser(userId);
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'delete',
        entityType: 'user',
        entityId: userId,
        oldValue: JSON.stringify({ email: existingUser.email, name: existingUser.name, role: existingUser.role }),
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حذف المستخدم: ${existingUser.name} (${existingUser.email})`,
      });
      
      res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
      logger.error('Error deleting user:', { error });
      handleDbError(error, res, 'حذف المستخدم');
    }
  });

  // ==================== Business Departments Routes (Admin Only) ====================
  
  app.get("/api/departments", authenticateToken, async (req, res) => {
    try {
      const cached = cache.get<any>('departments_list');
      if (cached) return res.json(cached);
      const departments = await storage.getDepartments();
      cache.set('departments_list', departments, TTL.DEPARTMENTS);
      res.json(departments);
    } catch (error) {
      logger.error('Error fetching departments:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب الإدارات' });
    }
  });

  app.get("/api/departments/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const department = await storage.getDepartmentById(id);
      if (!department) {
        return res.status(404).json({ error: 'الإدارة غير موجودة' });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب الإدارة' });
    }
  });

  app.post("/api/departments", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const { nameAr, nameEn, code, description, managerId, parentId, isActive } = req.body;
      
      if (!nameAr || !code) {
        return res.status(400).json({ error: 'الاسم والرمز مطلوبان' });
      }
      
      const department = await storage.createDepartment({
        nameAr,
        nameEn: nameEn || null,
        code,
        description: description || null,
        managerId: managerId || null,
        parentId: parentId || null,
        isActive: isActive !== false,
      });
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create',
        entityType: 'department',
        entityId: department.id,
        oldValue: null,
        newValue: JSON.stringify(department),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة إدارة جديدة: ${department.nameAr}`,
      });
      
      cache.invalidate('departments_list');
      res.status(201).json(department);
    } catch (error) {
      logger.error('Error creating department:', { error });
      handleDbError(error, res, 'إنشاء الإدارة');
    }
  });

  app.put("/api/departments/:id", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const existing = await storage.getDepartmentById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'الإدارة غير موجودة' });
      }
      
      const department = await storage.updateDepartment(id, stripProtectedFields(req.body));
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'update',
        entityType: 'department',
        entityId: id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(department),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تحديث إدارة: ${department?.nameAr}`,
      });
      
      cache.invalidate('departments_list');
      res.json(department);
    } catch (error) {
      logger.error('Error updating department:', { error });
      handleDbError(error, res, 'تحديث الإدارة');
    }
  });

  app.delete("/api/departments/:id", authenticateToken, requirePortal(ADMIN_PORTALS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const existing = await storage.getDepartmentById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'الإدارة غير موجودة' });
      }
      
      await storage.deleteDepartment(id);
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'delete',
        entityType: 'department',
        entityId: id,
        oldValue: JSON.stringify(existing),
        newValue: null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `حذف إدارة: ${existing.nameAr}`,
      });
      
      cache.invalidate('departments_list');
      res.json({ success: true, message: 'تم حذف الإدارة بنجاح' });
    } catch (error) {
      logger.error('Error deleting department:', { error });
      handleDbError(error, res, 'حذف الإدارة');
    }
  });

  // ==================== Sessions Routes (Admin Only) ====================
  
  app.get("/api/sessions", authenticateToken, requireView(RESOURCES.SESSIONS), async (req: any, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // FIX: terminate-all MUST be registered BEFORE /:id to avoid "terminate-all" matching as an ID param
  app.delete("/api/sessions/terminate-all", authenticateToken, requireDelete(RESOURCES.SESSIONS), async (req: any, res) => {
    try {
      const isAdmin = req.user?.role === 'system_admin';
      // FIX #2: Only admins can terminate ALL sessions; others terminate only their own
      const sessions = isAdmin
        ? await storage.getSessions()
        : await storage.getSessionsByUserId(req.user.id);
      for (const session of sessions) {
        await storage.deleteSession(session.id);
      }
      res.json({ success: true, message: isAdmin ? 'تم إنهاء جميع الجلسات بنجاح' : 'تم إنهاء جلساتك بنجاح' });
    } catch (error) {
      handleDbError(error, res, 'إنهاء جميع الجلسات');
    }
  });

  app.delete("/api/sessions/:id", authenticateToken, requireDelete(RESOURCES.SESSIONS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      await storage.deleteSession(id);
      res.json({ success: true });
    } catch (error) {
      handleDbError(error, res, 'إنهاء الجلسة');
    }
  });

  // ==================== Audit Logs Routes ====================
  
  app.get("/api/audit-logs", authenticateToken, requireView(RESOURCES.AUDIT_LOGS), async (req: any, res) => {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 50, 10), 200);
      const offset = (page - 1) * pageSize;
      const fromDate = req.query.fromDate as string;
      const toDate = req.query.toDate as string;
      const action = req.query.action as string;
      const entityType = req.query.entityType as string;
      const userId = req.query.userId as string;
      const severity = req.query.severity as string;
      const actionCategory = req.query.actionCategory as string;
      const outcome = req.query.outcome as string;
      const search = req.query.search as string;
      
      const conditions = [];
      if (fromDate) {
        conditions.push(sql`${auditLogs.createdAt} >= ${new Date(fromDate)}`);
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        conditions.push(sql`${auditLogs.createdAt} <= ${to}`);
      }
      if (action && action !== 'all') {
        conditions.push(eq(auditLogs.action, action));
      }
      if (entityType && entityType !== 'all') {
        conditions.push(eq(auditLogs.entityType, entityType));
      }
      if (userId && userId !== 'all') {
        conditions.push(eq(auditLogs.userId, parseInt(userId)));
      }
      if (severity && severity !== 'all') {
        conditions.push(eq(auditLogs.severity, severity));
      }
      if (actionCategory && actionCategory !== 'all') {
        conditions.push(eq(auditLogs.actionCategory, actionCategory));
      }
      if (outcome && outcome !== 'all') {
        conditions.push(eq(auditLogs.outcome, outcome));
      }
      if (search && search.trim() && search.trim().length <= 200) {
        const term = `%${search.trim().slice(0, 200)}%`;
        conditions.push(sql`(
          ${auditLogs.details} ILIKE ${term} OR
          ${auditLogs.action} ILIKE ${term} OR
          ${auditLogs.entityType} ILIKE ${term} OR
          ${auditLogs.requestPath} ILIKE ${term} OR
          COALESCE(${users.name}, '') ILIKE ${term} OR
          COALESCE(${users.email}, '') ILIKE ${term} OR
          ${auditLogs.ipAddress} ILIKE ${term}
        )`);
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const selectFields = {
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        actionCategory: auditLogs.actionCategory,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        resource: auditLogs.resource,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        changedFields: auditLogs.changedFields,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        requestMethod: auditLogs.requestMethod,
        requestPath: auditLogs.requestPath,
        outcome: auditLogs.outcome,
        severity: auditLogs.severity,
        details: auditLogs.details,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userName: sql<string>`COALESCE(${users.name}, CASE WHEN ${auditLogs.userId} IS NULL THEN 'النظام' ELSE 'مستخدم غير معروف' END)`,
        userEmail: sql<string>`COALESCE(${users.email}, '')`,
      };

      const baseQuery = db.select(selectFields)
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id));

      const countQuery = db.select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id));

      const [rows, [{ count: total }]] = await Promise.all([
        whereClause
          ? baseQuery.where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset)
          : baseQuery.orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
        whereClause
          ? countQuery.where(whereClause)
          : countQuery,
      ]);
      
      res.json({
        logs: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      logger.error('Audit logs error:', { error });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/audit-logs/stats", authenticateToken, requireView(RESOURCES.AUDIT_LOGS), async (req: any, res) => {
    try {
      const fromDate = req.query.fromDate as string;
      const toDate = req.query.toDate as string;
      
      const dateConditions = [];
      if (fromDate) dateConditions.push(sql`${auditLogs.createdAt} >= ${new Date(fromDate)}`);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        dateConditions.push(sql`${auditLogs.createdAt} <= ${to}`);
      }
      const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;

      const [byAction, byEntity, bySeverity, byOutcome, byHour, topUsers, totalCount] = await Promise.all([
        db.select({
          action: auditLogs.action,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).where(whereClause).groupBy(auditLogs.action).orderBy(sql`count(*) DESC`),

        db.select({
          entityType: auditLogs.entityType,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).where(whereClause).groupBy(auditLogs.entityType).orderBy(sql`count(*) DESC`).limit(20),

        db.select({
          severity: auditLogs.severity,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).where(whereClause).groupBy(auditLogs.severity),

        db.select({
          outcome: auditLogs.outcome,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).where(whereClause).groupBy(auditLogs.outcome),

        db.select({
          hour: sql<number>`EXTRACT(HOUR FROM ${auditLogs.createdAt})::int`,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).where(whereClause).groupBy(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt})`).orderBy(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt})`),

        db.select({
          userId: auditLogs.userId,
          userName: sql<string>`COALESCE(${users.name}, 'النظام')`,
          count: sql<number>`count(*)::int`,
        }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(whereClause).groupBy(auditLogs.userId, users.name).orderBy(sql`count(*) DESC`).limit(10),

        db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(whereClause),
      ]);

      const entityTypes = await db.selectDistinct({ entityType: auditLogs.entityType })
        .from(auditLogs)
        .where(sql`${auditLogs.entityType} IS NOT NULL`)
        .orderBy(auditLogs.entityType);

      res.json({
        total: totalCount[0]?.count || 0,
        byAction,
        byEntity,
        bySeverity,
        byOutcome,
        byHour,
        topUsers,
        entityTypes: entityTypes.map((e: any) => e.entityType).filter(Boolean),
      });
    } catch (error) {
      logger.error('Audit stats error:', { error });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Notifications Routes ====================
  
  app.get("/api/notifications", authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUserId((req as any).user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/notifications/unread", authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getUnreadNotificationsByUserId((req as any).user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/notifications/unread-count", authenticateToken, async (req: any, res) => {
    try {
      const unread = await storage.getUnreadNotificationsByUserId(req.user.id);
      res.json({ count: unread.length });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req: any, res) => {
    try {
      const notifId = parseId(req.params.id, res);
      if (!notifId) return;
      if (isNaN(notifId)) return res.status(400).json({ error: 'معرف غير صالح' });
      // FIX #4: Verify this notification belongs to the requesting user (prevents IDOR)
      const [notif] = await db.select({ userId: notifications.userId })
        .from(notifications).where(eq(notifications.id, notifId)).limit(1);
      if (!notif) return res.status(404).json({ error: 'الإشعار غير موجود' });
      if (notif.userId !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
      await storage.markNotificationAsRead(notifId);
      res.json({ success: true });
    } catch (error) {
      handleDbError(error, res, 'تحديث حالة الإشعار');
    }
  });

  app.put("/api/notifications/read-all", authenticateToken, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead((req as any).user.id);
      res.json({ success: true });
    } catch (error) {
      handleDbError(error, res, 'تحديث جميع الإشعارات كمقروءة');
    }
  });

  app.delete("/api/notifications/clear-all", authenticateToken, async (req: any, res) => {
    try {
      await db.delete(notifications).where(eq(notifications.userId, req.user.id));
      res.json({ success: true });
    } catch (error) {
      handleDbError(error, res, 'حذف جميع الإشعارات');
    }
  });

  app.delete("/api/notifications/:id", authenticateToken, async (req: any, res) => {
    try {
      const notifId = parseId(req.params.id, res);
      if (!notifId) return;
      const [notif] = await db.select({ userId: notifications.userId })
        .from(notifications).where(eq(notifications.id, notifId)).limit(1);
      if (!notif) return res.status(404).json({ error: 'الإشعار غير موجود' });
      if (notif.userId !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
      await db.delete(notifications).where(eq(notifications.id, notifId));
      res.json({ success: true });
    } catch (error) {
      handleDbError(error, res, 'حذف الإشعار');
    }
  });

}
