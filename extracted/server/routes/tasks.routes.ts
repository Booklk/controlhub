import type { Express } from "express";
import {
  storage, db, parseId, handleDbError, logger, invalidateDashboardCaches,
  authenticateToken, 
  sql, eq, and, or, isNull, isNotNull, not, inArray, desc, gte,
  tasks, users, escalations, plannerTasks, plannerBuckets,
  requirePortal,
  stripProtectedFields, taskEscalationSchema,
  ADMIN_PORTALS, IT_DIRECTOR_PORTALS, DEPARTMENT_PORTALS,
  PORTAL_TO_DEPT_ID,
} from './shared';
import { createRateLimiter } from '../security-middleware';
import { TASK_STATUSES, TASK_STATUS_TRANSITIONS, isValidTransition, getAllowedTransitions, getTransitionReason } from "@shared/constants";
import { notifyTaskAssigned } from '../notification-service';

export function registerTaskRoutes(app: Express) {

  // ==================== Tasks Routes ====================

  const DEPT_ID_TO_PORTALS: Record<number, string[]> = {
    5: ['dmo'],
    9: ['infrastructure'],
    10: ['cybersecurity'],
    11: ['digital_transformation'],
    12: ['support'],
  };

  app.get("/api/department-users", authenticateToken, async (req: any, res) => {
    try {
      const deptId = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
      const userDeptId = PORTAL_TO_DEPT_ID[req.user?.portal] || req.user?.itDepartmentId || null;
      const isPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      const targetDeptId = isPrivileged ? (deptId || userDeptId) : (userDeptId || deptId);

      const selectFields = {
        id: users.id,
        name: users.name,
        nameEn: users.nameEn,
        email: users.email,
        jobTitle: users.jobTitle,
        role: users.role,
      };

      let deptUsers;
      if (targetDeptId) {
        const portalNames = DEPT_ID_TO_PORTALS[targetDeptId] || [];
        const conditions = [
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ];
        if (portalNames.length > 0) {
          conditions.push(
            sql`(${users.itDepartmentId} = ${targetDeptId} OR (${users.itDepartmentId} IS NULL AND ${users.portal} IN (${sql.join(portalNames.map(p => sql`${p}`), sql`, `)})))`
          );
        } else {
          conditions.push(eq(users.itDepartmentId, targetDeptId));
        }
        deptUsers = await db.select(selectFields).from(users).where(and(...conditions));
      } else if (isPrivileged) {
        deptUsers = await db.select(selectFields).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt)));
      } else {
        deptUsers = [];
      }
      res.json(deptUsers);
    } catch (error) {
      logger.error('Error fetching department users:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المستخدمين' });
    }
  });

  app.get("/api/tasks", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin';
      const requestedDeptId = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;

      const conditions = [isNull(tasks.deletedAt)];

      if (isDirectorOrAdmin) {
        if (requestedDeptId) {
          conditions.push(eq(tasks.departmentId, requestedDeptId));
        }
      } else {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId) {
          conditions.push(or(eq(tasks.departmentId, userDeptId), eq(tasks.assignedTo, req.user?.id))!);
        } else {
          conditions.push(eq(tasks.assignedTo, req.user?.id));
        }
      }

      const assignee = db.select({ id: users.id, name: users.name, email: users.email }).from(users).as('assignee');
      const assigner = db.select({ id: users.id, name: users.name }).from(users).as('assigner');

      const result = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        departmentId: tasks.departmentId,
        assignedTo: tasks.assignedTo,
        assignedBy: tasks.assignedBy,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        isEscalated: tasks.isEscalated,
        notes: tasks.notes,
        estimatedHours: tasks.estimatedHours,
        projectId: tasks.projectId,
        assigneeName: assignee.name,
        assigneeEmail: assignee.email,
        assignerName: assigner.name,
      }).from(tasks)
        .leftJoin(assignee, eq(tasks.assignedTo, assignee.id))
        .leftJoin(assigner, eq(tasks.assignedBy, assigner.id))
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/tasks/overdue", authenticateToken, async (req: any, res) => {
    try {
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isDirectorOrAdmin = userRole === 'it_director' || userRole === 'system_admin';

      const assigneeAlias = db.select({ id: users.id, name: users.name }).from(users).as('od_assignee');
      const now = new Date();
      const overdueConditions = [
        sql`${tasks.dueDate} < ${now}`,
        not(eq(tasks.status, 'completed')),
        not(eq(tasks.status, 'cancelled')),
        isNull(tasks.deletedAt),
      ];

      if (!isDirectorOrAdmin) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (userDeptId) {
          overdueConditions.push(or(eq(tasks.departmentId, userDeptId), eq(tasks.assignedTo, req.user?.id))!);
        } else {
          overdueConditions.push(eq(tasks.assignedTo, req.user?.id));
        }
      }

      const overdueTasks = await db.select({
        id: tasks.id, title: tasks.title, description: tasks.description,
        departmentId: tasks.departmentId, assignedTo: tasks.assignedTo,
        assignedBy: tasks.assignedBy, priority: tasks.priority, status: tasks.status,
        dueDate: tasks.dueDate, createdAt: tasks.createdAt, isEscalated: tasks.isEscalated,
        assigneeName: assigneeAlias.name,
      }).from(tasks)
        .leftJoin(assigneeAlias, eq(tasks.assignedTo, assigneeAlias.id))
        .where(and(...overdueConditions))
        .orderBy(desc(tasks.createdAt));

      res.json(overdueTasks);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.post("/api/tasks/:id/escalate", authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseId(req.params.id, res);
      if (!taskId) return;

      const parsed = taskEscalationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'خطأ في التحقق من البيانات', details: parsed.error.errors });
      }
      const { escalatedTo, reason, priority } = parsed.data;

      const task = await storage.escalateTask(taskId, escalatedTo as number);
      if (!task) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      await db.insert(escalations).values({
        entityType: 'task',
        entityId: taskId,
        escalatedFrom: req.user.id,
        escalatedTo: escalatedTo || null,
        reason: reason || 'تصعيد يدوي',
        priority: priority || 'high',
        status: 'pending',
        createdAt: new Date(),
      }).catch((e: any) => logger.warn('[Planner] Escalation insert error:', { error: e?.message }));

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'escalate',
        entityType: 'task',
        entityId: taskId,
        oldValue: null,
        newValue: JSON.stringify({ escalatedTo, reason, priority: priority || 'high' }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تصعيد مهمة: ${task.title || taskId}`,
      });

      res.json(task);
    } catch (error) {
      handleDbError(error, res, 'تصعيد المهمة');
    }
  });

  app.post("/api/tasks", authenticateToken, createRateLimiter, async (req: any, res) => {
    try {
      const TASK_CREATE_ROLES = ['system_admin', 'it_director', 'infrastructure_manager', 'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager', 'it_infrastructure_staff', 'it_cybersecurity_staff', 'it_digital_staff', 'it_support_staff', 'committee_chairman', 'committee_vice_chairman', 'committee_rapporteur', 'dmo_staff', 'employee'];
      if (!TASK_CREATE_ROLES.includes(req.user?.role)) {
        return res.status(403).json({ error: 'صلاحية غير كافية — إنشاء المهام يتطلب صلاحية موظف قسم أو أعلى' });
      }
      // الموظف لا يمكنه إسناد المهام إلا لنفسه
      if (req.user?.role === 'employee') {
        req.body.assignedTo = req.user.id;
      }
      const { sendEmailNotification, ...taskData } = req.body;

      if (!taskData.title || !taskData.title.trim()) {
        return res.status(400).json({ error: 'عنوان المهمة مطلوب' });
      }
      // تحقق: تاريخ الاستحقاق لا يكون بالماضي
      if (taskData.dueDate) {
        const due = new Date(taskData.dueDate);
        const today = new Date(); today.setHours(0,0,0,0);
        if (due < today) {
          return res.status(400).json({ error: 'تاريخ الاستحقاق لا يمكن أن يكون بالماضي' });
        }
      }
      taskData.title = taskData.title.trim();
      if (taskData.description) taskData.description = taskData.description.trim();

      // Portal isolation: enforce department from user context
      const taskUserDeptId = PORTAL_TO_DEPT_ID[req.user?.portal] || req.user?.itDepartmentId || null;
      const isTaskPrivileged = req.user?.role === 'system_admin' || req.user?.role === 'it_director';
      const isTaskEmployee = req.user?.portal === 'employee' || req.user?.role === 'employee';
      const taskRequestedDeptId = taskData.departmentId ? parseInt(taskData.departmentId) : null;

      if (isTaskPrivileged) {
        taskData.departmentId = taskRequestedDeptId ?? taskUserDeptId;
      } else if (isTaskEmployee) {
        taskData.departmentId = taskRequestedDeptId || taskUserDeptId || null;
      } else {
        if (!taskUserDeptId) {
          return res.status(403).json({ error: 'لا يمكن تحديد القسم التابع لك' });
        }
        if (taskRequestedDeptId && taskRequestedDeptId !== taskUserDeptId) {
          return res.status(403).json({ error: 'لا يمكنك إنشاء مهمة لقسم آخر' });
        }
        taskData.departmentId = taskUserDeptId;
      }
      
      if (taskData.dueDate === '' || taskData.dueDate === null) {
        delete taskData.dueDate;
      } else if (taskData.dueDate) {
        taskData.dueDate = new Date(taskData.dueDate);
      }
      if (taskData.assignedTo === '' || taskData.assignedTo === null || taskData.assignedTo === 'none') {
        delete taskData.assignedTo;
      } else if (taskData.assignedTo) {
        taskData.assignedTo = parseInt(taskData.assignedTo);
      }

      const task = await storage.createTask({
        ...taskData,
        status: 'pending',
        assignedBy: (req as any).user.id,
      });

      // Create audit log for task creation
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'create',
        entityType: 'task',
        entityId: task.id,
        details: `إنشاء مهمة: ${task.title}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: JSON.stringify({ title: task.title, departmentId: task.departmentId }),
      });

      // Create notification for the department
      if (taskData.departmentId) {
        const itDepartment = await storage.getITDepartmentById(taskData.departmentId);
        if (itDepartment && itDepartment.managerId) {
          await storage.createNotification({
            userId: itDepartment.managerId,
            title: 'مهمة جديدة من مدير التقنية',
            message: `تم إسناد مهمة جديدة: ${task.title}`,
            type: 'task_assigned',
            priority: taskData.priority || 'medium',
            entityType: 'task',
            entityId: task.id,
            isRead: false,
            actionUrl: `/department/${(itDepartment as any).departmentType || itDepartment.departmentType}/tasks`,
          });
        }
      }

      if (task.assignedTo && task.assignedTo !== req.user.id) {
        notifyTaskAssigned(task, task.assignedTo, req.user.id).catch(() => {});
      }

      let emailSent = false;
      if (sendEmailNotification && taskData.departmentId) {
        try {
          const itDepartment = await storage.getITDepartmentById(taskData.departmentId);
          if (itDepartment && itDepartment.managerId) {
            const manager = await storage.getUserById(itDepartment.managerId);
            if (manager && manager.email) {
              const { generateNotificationEmail, sendEmail: sendEmailFn } = await import('../email');
              const priorityLabels: Record<string, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة', urgent: 'عاجلة' };
              const dueText = taskData.dueDate ? `\n<br/>الموعد النهائي: ${new Date(taskData.dueDate).toLocaleDateString('ar-SA')}` : '';
              const html = generateNotificationEmail({
                recipientName: manager.name || manager.email,
                subject: `مهمة جديدة: ${task.title}`,
                message: `تم تكليفكم بمهمة جديدة من مدير تقنية المعلومات:<br/><br/><strong>${task.title}</strong><br/>${taskData.description || ''}<br/><br/>الأولوية: ${priorityLabels[taskData.priority] || taskData.priority}${dueText}`,
                actionUrl: `https://controlhub.jcsa.sa/department/${itDepartment.departmentType}/tasks`,
                actionText: 'عرض المهمة'
              });
              emailSent = await sendEmailFn(manager.email, `مهمة جديدة: ${task.title}`, html);
              logger.info(`[Email] Task notification ${emailSent ? 'sent' : 'failed'} for: ${task.title} to ${manager.email}`);
            }
          }
        } catch (emailError) {
          logger.error('[Email] Error sending task notification:', { error: emailError });
        }
      }

      invalidateDashboardCaches();
      res.json({ ...task, emailSent });
    } catch (error: any) {
      logger.error('Error creating task:', { error: error?.message || error, stack: error?.stack });
      handleDbError(error, res, 'إنشاء المهمة');
    }
  });

  app.put("/api/tasks/:id/status", authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseId(req.params.id, res);
      if (!taskId) return;
      const { status } = req.body;

      if (!status || !TASK_STATUSES.includes(status)) {
        return res.status(400).json({ 
          error: `حالة غير صالحة. القيم المسموح بها: ${TASK_STATUSES.join(', ')}` 
        });
      }

      const [existing] = await db.select({ status: tasks.status, departmentId: tasks.departmentId, assignedTo: tasks.assignedTo })
        .from(tasks).where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt))).limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      const statusRole = req.user?.role || '';
      const statusPortal = req.user?.portal || '';
      const isStatusPrivileged = statusRole === 'it_director' || statusRole === 'system_admin';

      if (!isStatusPrivileged && !isValidTransition('task', existing.status, status)) {
        const allowed = getAllowedTransitions('task', existing.status);
        return res.status(400).json({ 
          error: `لا يمكن تغيير الحالة من "${existing.status}" إلى "${status}". التحولات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
          allowedTransitions: allowed,
        });
      }

      if (!isStatusPrivileged && existing.assignedTo !== req.user?.id) {
        const statusUserDeptId = PORTAL_TO_DEPT_ID[statusPortal] || req.user?.itDepartmentId;
        if (statusUserDeptId && existing.departmentId && statusUserDeptId !== existing.departmentId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل مهمة من قسم آخر' });
        }
      }
      
      if (existing) {
        const isManager = ['it_director', 'system_admin', 'infrastructure_manager', 
          'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager'].includes(req.user?.role);
        const lockedStatuses = ['completed', 'cancelled', 'archived'];
        if (lockedStatuses.includes(existing.status) && !lockedStatuses.includes(status) && !isManager) {
          return res.status(403).json({ 
            error: `لا يمكن إعادة فتح مهمة ${existing.status === 'completed' ? 'منجزة' : existing.status === 'archived' ? 'مؤرشفة' : 'ملغية'} إلا بإذن المدير` 
          });
        }
      }

      const task = await storage.updateTaskStatus(taskId, status);
      if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'status_change',
        entityType: 'task',
        entityId: taskId,
        oldValue: JSON.stringify({ status: existing?.status }),
        newValue: JSON.stringify({ status }),
        details: `تم تغيير حالة مهمة من ${existing?.status} إلى ${status}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      invalidateDashboardCaches();
      res.json(task);
    } catch (error) {
      handleDbError(error, res, 'تحديث حالة المهمة');
    }
  });

  app.patch("/api/tasks/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [existingTask] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
      if (!existingTask) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      const patchRole = req.user?.role || '';
      const patchPortal = req.user?.portal || '';
      const isPatchPrivileged = patchRole === 'it_director' || patchRole === 'system_admin';
      if (!isPatchPrivileged && existingTask.assignedTo !== req.user?.id) {
        const patchUserDeptId = PORTAL_TO_DEPT_ID[patchPortal] || req.user?.itDepartmentId;
        if (patchUserDeptId && existingTask.departmentId && patchUserDeptId !== existingTask.departmentId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل مهمة من قسم آخر' });
        }
      }

      const safeData = stripProtectedFields(req.body);
      if ('title' in safeData && (!safeData.title || !String(safeData.title).trim())) {
        return res.status(400).json({ error: 'عنوان المهمة مطلوب' });
      }
      if (safeData.title) safeData.title = String(safeData.title).trim();
      if (safeData.description) safeData.description = String(safeData.description).trim();
      if ('assignedTo' in safeData) {
        const rawAssigned = safeData.assignedTo;
        if (rawAssigned === 'none' || rawAssigned === '' || rawAssigned === null || rawAssigned === undefined) {
          safeData.assignedTo = null;
        } else {
          const parsed = parseInt(String(rawAssigned), 10);
          safeData.assignedTo = isNaN(parsed) ? null : parsed;
        }
      }
      if ('dueDate' in safeData) {
        if (safeData.dueDate === '' || safeData.dueDate === null || safeData.dueDate === undefined) {
          safeData.dueDate = null;
        } else {
          safeData.dueDate = new Date(safeData.dueDate);
        }
      }
      const task = await storage.updateTask(id, safeData);
      if (!task) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      const newAssignedTo = safeData.assignedTo ? parseInt(safeData.assignedTo) : null;
      if (newAssignedTo && !isNaN(newAssignedTo) && newAssignedTo !== existingTask.assignedTo && newAssignedTo !== req.user?.id) {
        notifyTaskAssigned(task, newAssignedTo, req.user?.id).catch((err: any) => {
          logger.error(`Failed to notify reassigned user ${newAssignedTo} for task ${task.id}`, { error: err?.message });
        });
      }

      const changedFields: Record<string, any> = {};
      for (const key of Object.keys(safeData)) {
        if ((existingTask as any)[key] !== (safeData as any)[key]) {
          changedFields[key] = (existingTask as any)[key];
        }
      }

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'task',
        entityId: task.id,
        details: `تحديث مهمة: ${task.title}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(changedFields),
        newValue: JSON.stringify(safeData),
      });
      res.json(task);
    } catch (error) {
      logger.error('Error updating task:', { error });
      handleDbError(error, res, 'تحديث المهمة');
    }
  });

  app.patch("/api/tasks/:id/status", authenticateToken, async (req: any, res) => {
    try {
      const taskId = parseId(req.params.id, res);
      if (!taskId) return;
      const { status } = req.body;

      if (!status || !TASK_STATUSES.includes(status)) {
        return res.status(400).json({ 
          error: `حالة غير صالحة. القيم المسموح بها: ${TASK_STATUSES.join(', ')}` 
        });
      }

      const [existingPatch] = await db.select({ status: tasks.status, departmentId: tasks.departmentId, assignedTo: tasks.assignedTo })
        .from(tasks).where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt))).limit(1);
      if (!existingPatch) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      const patchRole = req.user?.role || '';
      const isPatchPrivileged = patchRole === 'it_director' || patchRole === 'system_admin';
      if (!isPatchPrivileged && !isValidTransition('task', existingPatch.status, status)) {
        const allowed = getAllowedTransitions('task', existingPatch.status);
        return res.status(400).json({ 
          error: `لا يمكن تغيير الحالة من "${existingPatch.status}" إلى "${status}". التحولات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
          allowedTransitions: allowed,
        });
      }

      if (existingPatch) {
        const patchStatusRole = req.user?.role || '';
        const patchStatusPortal = req.user?.portal || '';
        const isPatchStatusPrivileged = patchStatusRole === 'it_director' || patchStatusRole === 'system_admin';
        if (!isPatchStatusPrivileged && existingPatch.assignedTo !== req.user?.id) {
          const patchStatusDeptId = PORTAL_TO_DEPT_ID[patchStatusPortal] || req.user?.itDepartmentId;
          if (patchStatusDeptId && existingPatch.departmentId && patchStatusDeptId !== existingPatch.departmentId) {
            return res.status(403).json({ error: 'ليس لديك صلاحية لتعديل مهمة من قسم آخر' });
          }
        }
      }
      
      if (existingPatch) {
        const isManager = ['it_director', 'system_admin', 'infrastructure_manager', 
          'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager'].includes(req.user?.role);
        const lockedStatuses = ['completed', 'cancelled', 'archived'];
        if (lockedStatuses.includes(existingPatch.status) && !lockedStatuses.includes(status) && !isManager) {
          return res.status(403).json({ 
            error: `لا يمكن إعادة فتح مهمة ${existingPatch.status === 'completed' ? 'منجزة' : existingPatch.status === 'archived' ? 'مؤرشفة' : 'ملغية'} إلا بإذن المدير` 
          });
        }
      }

      const task = await storage.updateTaskStatus(taskId, status);
      if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'status_change',
        entityType: 'task',
        entityId: taskId,
        oldValue: JSON.stringify({ status: existingPatch?.status }),
        newValue: JSON.stringify({ status }),
        details: `تم تغيير حالة مهمة من ${existingPatch?.status} إلى ${status}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      invalidateDashboardCaches();
      res.json(task);
    } catch (error) {
      handleDbError(error, res, 'تحديث حالة المهمة');
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, async (_req: any, res) => {
    return res.status(403).json({ error: 'حذف المهام غير مسموح — يمكنك تغيير الحالة إلى مكتمل أو ملغي أو مؤرشف' });
  });

  // ==================== Tasks assigned by current user ====================
  app.get("/api/tasks/assigned-by-me", authenticateToken, requirePortal(['it_director', 'system_admin']), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const results = await db.select().from(tasks)
        .where(and(eq(tasks.assignedBy, userId), isNull(tasks.deletedAt)))
        .orderBy(sql`${tasks.createdAt} DESC`);
      res.json(results);
    } catch (error) {
      logger.error('Error fetching tasks assigned by user:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب المهام' });
    }
  });

  // ============================================================
  // IT DIRECTOR — Full Cross-Department Task Overview
  // ============================================================
  app.get("/api/director/tasks/overview", authenticateToken, requirePortal(['it_director', 'system_admin']), async (req: any, res) => {
    try {
      const assignee = db.select({ id: users.id, name: users.name, email: users.email }).from(users).as('assignee');
      const assigner = db.select({ id: users.id, name: users.name }).from(users).as('assigner');

      const rows = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          departmentId: tasks.departmentId,
          assignedTo: tasks.assignedTo,
          assignedBy: tasks.assignedBy,
          priority: tasks.priority,
          status: tasks.status,
          dueDate: tasks.dueDate,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          isEscalated: tasks.isEscalated,
          notes: tasks.notes,
          estimatedHours: tasks.estimatedHours,
          assigneeName: assignee.name,
          assigneeEmail: assignee.email,
          assignerName: assigner.name,
        })
        .from(tasks)
        .leftJoin(assignee, eq(tasks.assignedTo, assignee.id))
        .leftJoin(assigner, eq(tasks.assignedBy, assigner.id))
        .where(isNull(tasks.deletedAt))
        .orderBy(sql`${tasks.createdAt} DESC`);

      // Summary stats
      const byDept: Record<number, { total: number; pending: number; inProgress: number; completed: number; overdue: number; cancelled: number }> = {};
      const now = new Date();
      for (const t of rows) {
        const dId = t.departmentId || 0;
        if (!byDept[dId]) byDept[dId] = { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, cancelled: 0 };
        byDept[dId].total++;
        if (t.status === 'pending' || t.status === 'assigned') byDept[dId].pending++;
        else if (t.status === 'in_progress') byDept[dId].inProgress++;
        else if (t.status === 'completed') byDept[dId].completed++;
        else if (t.status === 'cancelled') byDept[dId].cancelled++;
        if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'cancelled') byDept[dId].overdue++;
      }

      res.json({ tasks: rows, byDept, total: rows.length });
    } catch (err: any) {
      logger.error('Error fetching director task overview:', { error: err });
      res.status(500).json({ error: 'حدث خطأ في جلب نظرة عامة على المهام' });
    }
  });

  app.get("/api/director/users/by-department/:deptId", authenticateToken, requirePortal(['it_director', 'system_admin']), async (req: any, res) => {
    try {
      const deptId = parseInt(req.params.deptId);
      if (isNaN(deptId)) return res.json([]);
      const portalNames = DEPT_ID_TO_PORTALS[deptId] || [];
      const conditions = [
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ];
      if (portalNames.length > 0) {
        conditions.push(
          sql`(${users.itDepartmentId} = ${deptId} OR (${users.itDepartmentId} IS NULL AND ${users.portal} IN (${sql.join(portalNames.map(p => sql`${p}`), sql`, `)})))`
        );
      } else {
        conditions.push(eq(users.itDepartmentId, deptId));
      }
      const result = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, jobTitle: users.jobTitle })
        .from(users)
        .where(and(...conditions));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ في جلب المستخدمين' });
    }
  });

  app.get("/api/director/planner/tasks", authenticateToken, requirePortal(['it_director', 'system_admin']), async (req: any, res) => {
    try {
      const ptAssignee = db.select({ id: users.id, name: users.name }).from(users).as('pt_assignee');
      const rows = await db
        .select({
          id: plannerTasks.id,
          title: plannerTasks.title,
          description: plannerTasks.description,
          priority: plannerTasks.priority,
          status: plannerTasks.status,
          progress: plannerTasks.progress,
          dueDate: plannerTasks.dueDate,
          assignedTo: plannerTasks.assignedTo,
          createdAt: plannerTasks.createdAt,
          assigneeName: ptAssignee.name,
          boardId: plannerTasks.boardId,
          bucketId: plannerTasks.bucketId,
        })
        .from(plannerTasks)
        .leftJoin(ptAssignee, eq(plannerTasks.assignedTo, ptAssignee.id))
        .orderBy(sql`${plannerTasks.createdAt} DESC`)
        .limit(100);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ في جلب مهام المخطط' });
    }
  });

  // ==================== Tasks CRUD with department filter ====================
  app.get("/api/tasks/it-department/:itDepartmentId", authenticateToken, async (req: any, res) => {
    try {
      const itDepartmentId = parseId(req.params.itDepartmentId, res);
      if (!itDepartmentId) return;

      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isPrivileged = userRole === 'system_admin' || userRole === 'it_director';
      if (!isPrivileged) {
        const userDeptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
        if (!userDeptId || userDeptId !== itDepartmentId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لعرض مهام قسم آخر' });
        }
      }

      const assignee = db.select({ id: users.id, name: users.name, email: users.email }).from(users).as('dept_assignee');
      const assigner = db.select({ id: users.id, name: users.name }).from(users).as('dept_assigner');

      const results = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        departmentId: tasks.departmentId,
        assignedTo: tasks.assignedTo,
        assignedBy: tasks.assignedBy,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        isEscalated: tasks.isEscalated,
        notes: tasks.notes,
        estimatedHours: tasks.estimatedHours,
        projectId: tasks.projectId,
        assigneeName: assignee.name,
        assigneeEmail: assignee.email,
        assignerName: assigner.name,
      }).from(tasks)
        .leftJoin(assignee, eq(tasks.assignedTo, assignee.id))
        .leftJoin(assigner, eq(tasks.assignedBy, assigner.id))
        .where(and(eq(tasks.departmentId, itDepartmentId), isNull(tasks.deletedAt)))
        .orderBy(sql`${tasks.createdAt} DESC`);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب المهام' });
    }
  });

  // ==================== Bulk Actions for Tasks ====================
  app.post('/api/tasks/bulk-status', authenticateToken, requirePortal([...ADMIN_PORTALS, ...IT_DIRECTOR_PORTALS, ...DEPARTMENT_PORTALS]), async (req: any, res) => {
    try {
      const { ids, status } = req.body;
      if (!ids?.length || !status) return res.status(400).json({ error: 'المعرفات والحالة مطلوبة' });
      if (!TASK_STATUSES.includes(status)) {
        return res.status(400).json({ error: `حالة غير صالحة. القيم المسموح بها: ${TASK_STATUSES.join(', ')}` });
      }
      if (!Array.isArray(ids) || ids.some((id: any) => typeof id !== 'number' || id <= 0)) {
        return res.status(400).json({ error: 'ids يجب أن تكون مصفوفة أرقام صحيحة موجبة' });
      }
      const userRole = req.user?.role || '';
      const userPortal = req.user?.portal || '';
      const isPrivileged = ['system_admin', 'it_director'].includes(userRole);
      const userDeptId = !isPrivileged ? (PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId) : null;

      const succeeded: number[] = [];
      const failed: { id: number; reason: string }[] = [];
      for (const id of ids) {
        try {
          const [task] = await db.select({ id: tasks.id, departmentId: tasks.departmentId }).from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
          if (!task) { failed.push({ id, reason: 'المهمة غير موجودة' }); continue; }
          if (!isPrivileged && userDeptId && task.departmentId && userDeptId !== task.departmentId) {
            failed.push({ id, reason: 'ليس لديك صلاحية على هذه المهمة' }); continue;
          }
          const [updated] = await db.update(tasks).set({ status, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
          if (updated) succeeded.push(id);
        } catch (e: any) {
          failed.push({ id, reason: e?.message || 'خطأ غير متوقع' });
        }
      }
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'bulk_update',
        entityType: 'task',
        entityId: 0,
        details: `تحديث جماعي لحالة ${succeeded.length} مهمة إلى ${status}${failed.length ? ` | فشل: ${failed.length}` : ''}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: null,
        newValue: JSON.stringify({ ids, status, failed: failed.length > 0 ? failed : undefined }),
      });
      invalidateDashboardCaches();
      res.json({ updated: succeeded.length, failed: failed.length > 0 ? failed : undefined });
    } catch (error) {
      handleDbError(error, res, 'التحديث الجماعي لحالة المهام');
    }
  });

  app.post('/api/tasks/bulk-delete', authenticateToken, async (_req: any, res) => {
    return res.status(403).json({ error: 'حذف المهام غير مسموح — يمكنك استخدام التحديث الجماعي لتغيير الحالة' });
  });

}
