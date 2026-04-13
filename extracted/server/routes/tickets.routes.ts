import type { Express } from "express";
import {
  storage, db, parseId, logger, invalidateDashboardCaches,
  authenticateToken, crypto, sql, eq, and, isNull, inArray, desc,
  users, itTickets, auditLogs, emailIntegrationKeys, ticketTemplates,
  requirePortal, requireUpdate, RESOURCES,
  validateRequest, ticketCreateSchema, ticketUpdateSchema, ticketStatusSchema,
  notifyTicketCreated, notifyTicketStatusChanged,
  publicEndpointRateLimiter,
  ADMIN_PORTALS, IT_DIRECTOR_PORTALS, DEPARTMENT_PORTALS, PORTAL_TO_DEPT_ID,
} from "./shared";
import { createRateLimiter } from "../security-middleware";
import { 
  TICKET_STATUSES, TICKET_STATUS_TRANSITIONS, SLA_HOURS, SLA_MINUTES,
  getSlaDeadline, getSlaHours, isValidTransition, getAllowedTransitions, getTransitionReason
} from "@shared/constants";

export function registerTicketRoutes(app: Express) {

  // ==================== IT Ticket Activities ====================
  app.get("/api/it-tickets/:id/activities", authenticateToken, async (req: any, res) => {
    try {
      const ticketId = parseId(req.params.id, res);
      if (!ticketId) return;

      // Check ticket exists and user can see it
      const [ticket] = await db.select({ id: itTickets.id, departmentId: itTickets.departmentId })
        .from(itTickets).where(and(eq(itTickets.id, ticketId), isNull(itTickets.deletedAt)));
      if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });

      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isPrivilegedActivity = userRole === 'system_admin' || userRole === 'it_director';
      if (!isPrivilegedActivity) {
        const actUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[userPortal];
        if (ticket.departmentId && actUserDeptId && ticket.departmentId !== actUserDeptId) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
      }

      // Fetch audit logs for this ticket
      const activities = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        details: auditLogs.details,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        userId: auditLogs.userId,
        createdAt: auditLogs.createdAt,
      }).from(auditLogs)
        .where(and(
          eq(auditLogs.entityType, 'it_ticket'),
          eq(auditLogs.entityId, ticketId)
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(30);

      // Enrich with user info
      const userIds = Array.from(new Set(activities.map((a: any) => a.userId).filter(Boolean))) as number[];
      const activityUsers = userIds.length > 0 ? await db.select({
        id: users.id, name: users.name, role: users.role
      }).from(users).where(inArray(users.id, userIds)) : [];
      const userMap = Object.fromEntries(activityUsers.map((u: any) => [u.id, u]));

      const enriched = activities.map((a: any) => ({
        ...a,
        user: a.userId ? userMap[a.userId] : null,
        actionLabel: a.action === 'create' ? 'أنشأ التذكرة' :
          a.action === 'update' ? 'حدّث التذكرة' :
          a.action === 'status_change' ? 'غيّر الحالة' :
          a.action === 'delete' ? 'حذف التذكرة' :
          a.action === 'comment' ? 'أضاف تعليق' : a.action,
      }));

      res.json(enriched);
    } catch (error) {
      logger.error('Activity log error:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب سجل النشاط' });
    }
  });

  // ==================== IT Tickets CRUD ====================
  app.get("/api/it-tickets", authenticateToken, async (req: any, res) => {
    try {
      const { departmentId, status, priority } = req.query;
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin';
      const conditions: any[] = [];

      if (isDirectorOrAdmin && departmentId) {
        conditions.push(eq(itTickets.departmentId, parseInt(departmentId as string)));
      } else if (!isDirectorOrAdmin) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId) {
          conditions.push(eq(itTickets.departmentId, userDeptId));
        } else {
          conditions.push(eq(itTickets.departmentId, -1));
        }
      }
      if (status) {
        conditions.push(eq(itTickets.status, status as string));
      }
      if (priority) {
        conditions.push(eq(itTickets.priority, priority as string));
      }
      
      const requester = db.select({ id: users.id, name: users.name }).from(users).as('requester');
      const assignee = db.select({ id: users.id, name: users.name }).from(users).as('assignee');

      const selectFields = {
        id: itTickets.id,
        ticketNumber: itTickets.ticketNumber,
        title: itTickets.title,
        description: itTickets.description,
        requesterId: itTickets.requesterId,
        assigneeId: itTickets.assigneeId,
        departmentId: itTickets.departmentId,
        category: itTickets.category,
        priority: itTickets.priority,
        status: itTickets.status,
        slaDeadline: itTickets.slaDeadline,
        resolvedAt: itTickets.resolvedAt,
        closedAt: itTickets.closedAt,
        resolution: itTickets.resolution,
        satisfaction: itTickets.satisfaction,
        source: itTickets.source,
        createdAt: itTickets.createdAt,
        updatedAt: itTickets.updatedAt,
        requesterName: requester.name,
        assigneeName: assignee.name,
      };

      const allConditions = [isNull(itTickets.deletedAt), ...conditions];

      const results = await db.select(selectFields).from(itTickets)
        .leftJoin(requester, eq(itTickets.requesterId, requester.id))
        .leftJoin(assignee, eq(itTickets.assigneeId, assignee.id))
        .where(and(...allConditions))
        .orderBy(sql`${itTickets.createdAt} DESC`);

      res.json(results);
    } catch (error) {
      logger.error('Error fetching tickets:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب التذاكر' });
    }
  });

  app.post("/api/it-tickets", authenticateToken, createRateLimiter, validateRequest({ body: ticketCreateSchema }), async (req: any, res) => {
    try {
      const { title, priority: rawPriority } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'عنوان التذكرة مطلوب' });
      }

      const datePart = new Date().toISOString().slice(0,7).replace('-','');
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const ticketNumber = `TKT-${datePart}-${randomPart}`;

      const priority = rawPriority || 'medium';
      const hoursToAdd = getSlaHours(priority);
      const slaDeadline = getSlaDeadline(priority);

      // Portal isolation: enforce department from user context
      const userDeptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || null;
      const isPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      const isEmployee = req.user?.portal === 'employee' || req.user?.role === 'employee';
      const requestedDeptId = req.body.departmentId ? parseInt(req.body.departmentId) : null;

      let autoDepartmentId: number | null;
      if (isPrivileged) {
        autoDepartmentId = requestedDeptId ?? userDeptId;
      } else if (isEmployee) {
        autoDepartmentId = requestedDeptId || PORTAL_TO_DEPT_ID['support'] || 12;
      } else {
        if (!userDeptId) {
          return res.status(403).json({ error: 'لا يمكن تحديد القسم التابع لك' });
        }
        if (requestedDeptId && requestedDeptId !== userDeptId) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء تذكرة لقسم آخر' });
        }
        autoDepartmentId = userDeptId;
      }

      const { departmentId: _stripDept, ...safeTicketBody } = req.body;
      const [result] = await db.insert(itTickets).values({
        ...safeTicketBody,
        departmentId: autoDepartmentId,
        ticketNumber,
        requesterId: req.user?.id,
        slaDeadline,
        createdAt: new Date()
      }).returning();
      const insertId = result.id;

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create',
        entityType: 'it_ticket',
        entityId: insertId,
        newValue: JSON.stringify({ id: insertId, ticketNumber, ...req.body }),
        details: `تم إنشاء تذكرة: ${req.body.title} | SLA: ${hoursToAdd} ساعة`,
        ipAddress: req.ip
      });

      const ticketResult = { id: insertId, ticketNumber, slaDeadline, ...req.body };
      notifyTicketCreated({ ...ticketResult, createdBy: req.user?.id }, req.user?.id).catch((e: any) => logger.warn('[Notify] Ticket create notify error:', { error: e?.message }));
      invalidateDashboardCaches();
      res.status(201).json(ticketResult);
    } catch (error) {
      logger.error('Error creating ticket:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء التذكرة' });
    }
  });

  app.put("/api/it-tickets/:id", authenticateToken, validateRequest({ body: ticketUpdateSchema }), async (req: any, res) => {
    try {
      const ticketId = parseId(req.params.id, res);
      if (!ticketId) return;
      const [existing] = await db.select().from(itTickets).where(and(eq(itTickets.id, ticketId), isNull(itTickets.deletedAt)));
      if (!existing) return res.status(404).json({ error: 'التذكرة غير موجودة' });

      const putRole = req.user?.role || '';
      const putPortal = req.user?.portal || '';
      const isPutPrivileged = putRole === 'system_admin' || putRole === 'it_director';
      if (!isPutPrivileged && existing.departmentId) {
        const putUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[putPortal];
        if (!putUserDeptId || existing.departmentId !== putUserDeptId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل تذكرة من قسم آخر' });
        }
      }

      if (req.body.title !== undefined && typeof req.body.title === 'string' && !req.body.title.trim()) {
        return res.status(400).json({ error: 'عنوان التذكرة لا يمكن أن يكون فارغاً' });
      }

      const { requesterId, ticketNumber, createdAt, deletedAt, ...safeBody } = req.body;

      // FIX: Recalculate slaDeadline if priority changes
      const updateData: any = { ...safeBody, updatedAt: new Date() };
      if (safeBody.priority && safeBody.priority !== existing.priority) {
        updateData.slaDeadline = getSlaDeadline(safeBody.priority);
      }

      await db.update(itTickets).set(updateData).where(eq(itTickets.id, ticketId));

      const updatedData = { ...existing, ...updateData };
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'it_ticket',
        entityId: ticketId,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updatedData),
        details: `تم تحديث تذكرة: ${safeBody.title || existing?.title}${safeBody.priority && safeBody.priority !== existing.priority ? ` | تغيير الأولوية: ${existing.priority}→${safeBody.priority}` : ''}`,
        ipAddress: req.ip
      });

      invalidateDashboardCaches();
      res.json(updatedData);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث التذكرة' });
    }
  });

  app.put("/api/it-tickets/:id/status", authenticateToken, validateRequest({ body: ticketStatusSchema }), async (req: any, res) => {
    try {
      const ticketId = parseId(req.params.id, res);
      if (!ticketId) return;
      const { status } = req.body;

      const [existing] = await db.select().from(itTickets).where(and(eq(itTickets.id, ticketId), isNull(itTickets.deletedAt)));
      if (!existing) {
        return res.status(404).json({ error: 'التذكرة غير موجودة' });
      }

      const isManager = ['it_director', 'system_admin', 'infrastructure_manager', 
        'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager'].includes(req.user?.role);
      const isStatusPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      if (!isStatusPrivileged && existing.departmentId) {
        const statusUserDeptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal];
        if (!statusUserDeptId || existing.departmentId !== statusUserDeptId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل تذكرة من قسم آخر' });
        }
      }

      if (!isManager && !isValidTransition('ticket', existing.status, status)) {
        const allowed = getAllowedTransitions('ticket', existing.status);
        return res.status(400).json({ 
          error: `لا يمكن تغيير الحالة من "${existing.status}" إلى "${status}". التحولات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
          allowedTransitions: allowed,
        });
      }

      if (['closed', 'resolved'].includes(existing.status) && !['closed', 'resolved'].includes(status) && !isManager) {
        return res.status(403).json({ 
          error: `لا يمكن إعادة فتح تذكرة ${existing.status === 'resolved' ? 'محلولة' : 'مغلقة'} إلا بإذن المدير` 
        });
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (status === 'closed') {
        updateData.closedAt = new Date();
      } else if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }
      
      await db.update(itTickets)
        .set(updateData)
        .where(eq(itTickets.id, ticketId));
      
      const updatedData = { ...existing, ...updateData };
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'status_change',
        entityType: 'it_ticket',
        entityId: ticketId,
        oldValue: JSON.stringify({ status: existing?.status }),
        newValue: JSON.stringify({ status }),
        details: `تم تغيير حالة تذكرة من ${existing?.status} إلى ${status}`,
        ipAddress: req.ip
      });
      
      if (existing && existing.status !== status) {
        notifyTicketStatusChanged(updatedData, existing.status, req.user?.id).catch((e: any) => logger.warn('[Notify] Ticket status notify error:', { error: e?.message }));
      }
      res.json(updatedData);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تحديث حالة التذكرة' });
    }
  });

  app.delete("/api/it-tickets/:id", authenticateToken, async (req: any, res) => {
    try {
      const ticketId = parseId(req.params.id, res);
      if (!ticketId) return;

      const [existing] = await db.select().from(itTickets).where(
        and(eq(itTickets.id, ticketId), isNull(itTickets.deletedAt))
      );
      if (!existing) return res.status(404).json({ error: 'التذكرة غير موجودة' });

      // Only admins/directors/managers or the ticket requester can delete
      const isPrivileged = ['system_admin', 'it_director', 'infrastructure_manager',
        'cybersecurity_manager', 'digital_manager', 'support_manager'].includes(req.user?.role);
      if (!isPrivileged && existing.requesterId !== req.user.id) {
        return res.status(403).json({ error: 'لا يمكنك حذف تذكرة لم تنشئها' });
      }

      // ===== ISOLATION CHECK: Non-admins cannot delete tickets from other depts =====
      if (!isPrivileged) {
        const delUserDeptId = req.user.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal];
        if (existing.departmentId && delUserDeptId && existing.departmentId !== delUserDeptId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لحذف تذكرة من قسم آخر' });
        }
      }

      // FIX: Soft delete — preserve data for audit/reporting
      await db.update(itTickets)
        .set({ deletedAt: new Date() } as any)
        .where(eq(itTickets.id, ticketId));

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'it_ticket',
        entityId: ticketId,
        oldValue: JSON.stringify(existing),
        details: `تم حذف تذكرة: ${existing?.title}`,
        ipAddress: req.ip
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف التذكرة' });
    }
  });

  // ==================== Ticket Comments ====================

  app.post("/api/tickets/:id/comments", authenticateToken, async (req: any, res) => {
    try {
      const ticketId = parseId(req.params.id, res);
      if (!ticketId) return;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'محتوى التعليق مطلوب' });
      }
      const [ticket] = await db.select().from(itTickets).where(and(eq(itTickets.id, ticketId), isNull(itTickets.deletedAt)));
      if (!ticket) {
        return res.status(404).json({ error: 'التذكرة غير موجودة' });
      }
      const cmtRole = req.user?.role || '';
      const cmtPrivileged = cmtRole === 'system_admin' || cmtRole === 'it_director';
      if (!cmtPrivileged && ticket.departmentId) {
        const cmtDeptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal];
        if (!cmtDeptId || ticket.departmentId !== cmtDeptId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية للتعليق على تذكرة من قسم آخر' });
        }
      }
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'comment',
        entityType: 'it_ticket',
        entityId: ticketId,
        newValue: JSON.stringify({ comment: content.trim() }),
        details: `تعليق على تذكرة: ${ticket.title} - ${content.trim().substring(0, 100)}`,
        ipAddress: req.ip
      });
      res.json({ success: true, message: 'تم إضافة التعليق بنجاح' });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في إضافة التعليق' });
    }
  });

  // ==================== Email Integration API (Outlook Webhook) ====================
  
  app.get("/api/email-integration-keys", authenticateToken, async (req: any, res) => {
    try {
      const keys = await db.select().from(emailIntegrationKeys).orderBy(sql`created_at DESC`);
      res.json(keys);
    } catch (error) {
      logger.error('Error fetching email integration keys:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب مفاتيح الربط' });
    }
  });

  app.post("/api/email-integration-keys", authenticateToken, async (req: any, res) => {
    try {
      const { name, departmentId, defaultPriority, defaultCategory } = req.body;
      const apiKey = `ch_${crypto.randomBytes(32).toString('hex')}`;
      const [result] = await db.insert(emailIntegrationKeys).values({
        name,
        apiKey,
        createdById: req.user?.id,
        departmentId: departmentId ? parseInt(departmentId) : null,
        defaultPriority: defaultPriority || 'medium',
        defaultCategory: defaultCategory || 'support',
      }).returning();
      
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'create',
        entityType: 'email_integration_key',
        entityId: result.id,
        newValue: JSON.stringify({ id: result.id, name }),
        details: `تم إنشاء مفتاح ربط البريد: ${name}`,
        ipAddress: req.ip
      });
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating email integration key:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء مفتاح الربط' });
    }
  });

  app.delete("/api/email-integration-keys/:id", authenticateToken, async (req: any, res) => {
    try {
      const keyId = parseId(req.params.id, res);
      if (!keyId) return;
      await db.delete(emailIntegrationKeys).where(eq(emailIntegrationKeys.id, keyId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف مفتاح الربط' });
    }
  });

  // FIX #8: Strict rate limiting on public endpoint (10 req/hour per IP)
  app.post("/api/public/email-to-ticket", publicEndpointRateLimiter, async (req, res) => {
    try {
      const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ error: 'API key مطلوب' });
      }
      
      const apiKey = String(authHeader).replace('Bearer ', '');
      const [keyRecord] = await db.select().from(emailIntegrationKeys)
        .where(and(
          eq(emailIntegrationKeys.apiKey, apiKey),
          eq(emailIntegrationKeys.isActive, true)
        ));
      
      if (!keyRecord) {
        return res.status(401).json({ error: 'مفتاح API غير صالح أو معطل' });
      }

      const { subject, body, from, fromName, messageId, receivedDate, importance } = req.body;
      
      if (!subject || !body || !from) {
        return res.status(400).json({ error: 'الحقول المطلوبة: subject, body, from' });
      }

      if (messageId) {
        const [existing] = await db.select().from(itTickets)
          .where(and(eq(itTickets.sourceEmailId, messageId), isNull(itTickets.deletedAt)));
        if (existing) {
          return res.status(409).json({ 
            error: 'تم إنشاء تذكرة لهذا البريد مسبقاً',
            ticketId: existing.id,
            ticketNumber: existing.ticketNumber
          });
        }
      }

      let priority = keyRecord.defaultPriority || 'medium';
      if (importance === 'urgent') priority = 'urgent';
      else if (importance === 'high') priority = 'high';
      if (importance === 'low') priority = 'low';

      const emailDatePart = new Date().toISOString().slice(0,7).replace('-','');
      const emailRandomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const ticketNumber = `TKT-${emailDatePart}-${emailRandomPart}`;
      const emailSlaDeadline = getSlaDeadline(priority);
      const [result] = await db.insert(itTickets).values({
        ticketNumber,
        title: subject.substring(0, 300),
        description: `${body}\n\n---\nمصدر: بريد إلكتروني من ${fromName || from}\nتاريخ الاستلام: ${receivedDate || new Date().toISOString()}`,
        requesterId: keyRecord.createdById,
        departmentId: keyRecord.departmentId,
        category: keyRecord.defaultCategory || 'support',
        priority,
        status: 'open',
        source: 'email',
        sourceEmail: from,
        sourceEmailId: messageId || null,
        slaDeadline: emailSlaDeadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      await db.update(emailIntegrationKeys)
        .set({ 
          lastUsedAt: new Date(),
          usageCount: sql`COALESCE(usage_count, 0) + 1`
        })
        .where(eq(emailIntegrationKeys.id, keyRecord.id));

      await storage.createAuditLog({
        userId: keyRecord.createdById,
        action: 'create',
        entityType: 'it_ticket',
        entityId: result.id,
        newValue: JSON.stringify({ id: result.id, ticketNumber, source: 'email', from }),
        details: `تذكرة من البريد الإلكتروني: ${subject}`,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        ticketId: result.id,
        ticketNumber: result.ticketNumber,
        title: result.title,
        status: result.status,
        priority: result.priority,
      });
    } catch (error) {
      logger.error('Error creating ticket from email:', { error });
      res.status(500).json({ error: 'حدث خطأ في إنشاء التذكرة من البريد' });
    }
  });

  // ==================== Bulk Actions for Tickets ====================
  app.post('/api/it-tickets/bulk-status', authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const { ids, status } = req.body;
      if (!ids?.length || !status) return res.status(400).json({ error: 'المعرفات والحالة مطلوبة' });
      if (!TICKET_STATUSES.includes(status)) {
        return res.status(400).json({ error: `حالة غير صالحة. القيم المسموح بها: ${TICKET_STATUSES.join(', ')}` });
      }
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isPrivileged = ['system_admin', 'it_director'].includes(userRole);
      const userDeptId = !isPrivileged ? (PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId) : null;

      const succeeded: number[] = [];
      const failed: { id: number; reason: string }[] = [];
      for (const id of ids) {
        try {
          const [ticket] = await db.select({ id: itTickets.id, departmentId: itTickets.departmentId }).from(itTickets).where(and(eq(itTickets.id, id), isNull(itTickets.deletedAt))).limit(1);
          if (!ticket) { failed.push({ id, reason: 'التذكرة غير موجودة' }); continue; }
          if (!isPrivileged && userDeptId && ticket.departmentId !== userDeptId) {
            failed.push({ id, reason: 'ليس لديك صلاحية على هذه التذكرة' }); continue;
          }
          const [updated] = await db.update(itTickets).set({ status, updatedAt: new Date() }).where(eq(itTickets.id, id)).returning();
          if (updated) succeeded.push(id);
        } catch (e: any) {
          failed.push({ id, reason: e?.message || 'خطأ غير متوقع' });
        }
      }
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'bulk_update',
        entityType: 'it_ticket',
        entityId: 0,
        details: `تحديث جماعي لحالة ${succeeded.length} تذكرة إلى ${status}${failed.length ? ` | فشل: ${failed.length}` : ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: JSON.stringify({ ids, status, failed: failed.length > 0 ? failed : undefined }),
      });
      invalidateDashboardCaches();
      res.json({ updated: succeeded.length, failed: failed.length > 0 ? failed : undefined });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في التحديث الجماعي' });
    }
  });

  app.post('/api/it-tickets/bulk-priority', authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const { ids, priority } = req.body;
      if (!ids?.length || !priority) return res.status(400).json({ error: 'ids and priority required' });
      const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical', 'urgent'];
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `أولوية غير صالحة. القيم المسموح بها: ${VALID_PRIORITIES.join(', ')}` });
      }
      for (const id of ids) {
        await db.update(itTickets).set({ priority, updatedAt: new Date() }).where(eq(itTickets.id, id));
      }
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'bulk_update',
        entityType: 'it_ticket',
        entityId: 0,
        details: `تحديث جماعي لأولوية ${ids.length} تذكرة إلى ${priority}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: JSON.stringify({ ids, priority }),
      });
      res.json({ updated: ids.length });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في التحديث الجماعي' });
    }
  });

  app.post('/api/it-tickets/bulk-delete', authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS]), async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!ids?.length) return res.status(400).json({ error: 'ids required' });
      for (const id of ids) {
        await db.update(itTickets).set({ deletedAt: new Date() }).where(eq(itTickets.id, id));
      }
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'bulk_delete',
        entityType: 'it_ticket',
        entityId: 0,
        details: `حذف جماعي لعدد ${ids.length} تذكرة`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify({ ids }),
        newValue: null,
      });
      res.json({ deleted: ids.length });
    } catch (error) {
      res.status(500).json({ error: 'خطأ في الحذف الجماعي' });
    }
  });

  // ==================== Agile: Bulk Ticket Assignment ====================
  app.post("/api/it-tickets/bulk-assign", authenticateToken, requireUpdate(RESOURCES.SUPPORT_TICKETS), async (req: any, res) => {
    try {
      const { ticketIds, assigneeId } = req.body;
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        return res.status(400).json({ error: 'يجب تحديد تذاكر للإسناد' });
      }
      if (!assigneeId) return res.status(400).json({ error: 'يجب تحديد مستخدم للإسناد' });
      const ids = ticketIds.map((id: any) => parseInt(id)).filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'لا توجد معرفات صالحة' });
      await db.update(itTickets)
        .set({ assigneeId, status: 'assigned', updatedAt: new Date() })
        .where(and(inArray(itTickets.id, ids), isNull(itTickets.deletedAt)));
      await storage.createAuditLog({
        userId: req.user.id, action: 'bulk_assign', entityType: 'ticket',
        entityId: ids[0], details: `إسناد جماعي لـ ${ids.length} تذكرة للمستخدم ${assigneeId}`,
        oldValue: null, newValue: JSON.stringify({ ticketIds: ids, assigneeId }),
        ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null,
      });
      res.json({ success: true, count: ids.length });
    } catch (error) {
      logger.error('Bulk assign error:', { error });
      res.status(500).json({ error: 'حدث خطأ في الإسناد الجماعي' });
    }
  });

  // ==================== Ticket Templates CRUD ====================
  app.get('/api/ticket-templates', authenticateToken, async (req: any, res) => {
    try {
      const { itDepartmentId } = req.query;
      const templates = await db.select().from(ticketTemplates)
        .where(itDepartmentId
          ? and(eq(ticketTemplates.isActive, true), eq(ticketTemplates.itDepartmentId, Number(itDepartmentId)))
          : eq(ticketTemplates.isActive, true))
        .orderBy(ticketTemplates.name);
      res.json(templates);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب القوالب' }); }
  });

  app.get('/api/ticket-templates/all', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const templates = await db.select().from(ticketTemplates).orderBy(desc(ticketTemplates.createdAt));
      res.json(templates);
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب القوالب' }); }
  });

  app.post('/api/ticket-templates', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const { name, description, itDepartmentId, defaultPriority, defaultCategory, defaultTitle, defaultDescription, checklist } = req.body;
      if (!name) return res.status(400).json({ error: 'اسم القالب مطلوب' });
      const [tpl] = await db.insert(ticketTemplates).values({
        name, description: description || null,
        itDepartmentId: itDepartmentId || null,
        defaultPriority: defaultPriority || 'medium',
        defaultCategory: defaultCategory || null,
        defaultTitle: defaultTitle || null,
        defaultDescription: defaultDescription || null,
        checklist: checklist || [],
        isActive: true, createdBy: req.user.id
      }).returning();
      res.status(201).json(tpl);
    } catch (e) { res.status(500).json({ error: 'خطأ في إنشاء القالب' }); }
  });

  app.put('/api/ticket-templates/:id', authenticateToken, async (req: any, res) => {
    try {
      if (!['system_admin', 'it_director'].includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { name, description, itDepartmentId, defaultPriority, defaultCategory, defaultTitle, defaultDescription, checklist, isActive } = req.body;
      const [tpl] = await db.update(ticketTemplates).set({
        name, description, itDepartmentId: itDepartmentId || null,
        defaultPriority, defaultCategory, defaultTitle, defaultDescription,
        checklist: checklist || [], isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }).where(eq(ticketTemplates.id, id)).returning();
      if (!tpl) return res.status(404).json({ error: 'القالب غير موجود' });
      res.json(tpl);
    } catch (e) { res.status(500).json({ error: 'خطأ في تعديل القالب' }); }
  });

  app.delete('/api/ticket-templates/:id', authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'system_admin') return res.status(403).json({ error: 'غير مصرح' });
      const id = parseId(req.params.id, res);
      if (!id) return;
      await db.delete(ticketTemplates).where(eq(ticketTemplates.id, id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في حذف القالب' }); }
  });

}
