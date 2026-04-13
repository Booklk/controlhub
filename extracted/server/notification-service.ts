import { db } from "./db";
import { notifications, tasks, itTickets, slaAgreements, users, regulatoryControls, votingSessions, committeeMembers, itProjects, alertRules, automationRules, itReferrals, itReferralHistory, escalations, itDepartments } from "@shared/schema";
import { eq, lt, and, ne, gte, lte, isNull, sql } from "drizzle-orm";
import { sendEmail } from "./email";
import {
  generateTaskAssignmentEmail,
  generateTicketCreatedEmail,
  generateTicketStatusUpdateEmail,
  generateProjectStatusEmail,
  generateEscalationEmail,
} from "./email-templates";

import { logger as appLogger } from './security-middleware';
const logger = {
  info: (msg: string, meta?: any) => appLogger.info(`[NotificationService] ${msg}`, meta || {}),
  error: (msg: string, meta?: any) => appLogger.error(`[NotificationService] ${msg}`, meta || {}),
};

async function getUserEmailPrefs(userId: number): Promise<{ email: string; name: string; enabled: boolean } | null> {
  try {
    const [user] = await db.select({
      email: users.email,
      name: users.name,
      enabled: users.emailNotificationsEnabled,
    }).from(users).where(eq(users.id, userId)).limit(1);
    return user ? { email: user.email, name: user.name, enabled: user.enabled } : null;
  } catch {
    return null;
  }
}

async function sendEmailNonBlocking(userId: number, subject: string, htmlGenerator: (name: string) => string) {
  getUserEmailPrefs(userId).then(async (prefs) => {
    if (!prefs || !prefs.enabled) return;
    try {
      await sendEmail(prefs.email, subject, htmlGenerator(prefs.name));
    } catch (err) {
      logger.error(`Email send failed for user ${userId}`, { err });
    }
  }).catch(() => {});
}

async function createNotificationSafe(data: {
  userId: number;
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: number;
}) {
  try {
    const existing = await db.select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, data.userId),
          eq(notifications.type, data.type),
          data.entityType ? eq(notifications.entityType, data.entityType) : undefined,
          data.entityId ? eq(notifications.entityId, data.entityId) : undefined,
          eq(notifications.isRead, false)
        )
      )
      .limit(1);

    if (existing.length > 0) return null;

    const [created] = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority || 'normal',
      isRead: false,
      actionUrl: data.actionUrl || null,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
    }).returning();
    return created;
  } catch (error) {
    logger.error('Failed to create notification', { error });
    return null;
  }
}

export async function notifyTicketCreated(ticket: any, creatorId: number) {
  try {
    
    if (ticket.assignedTo && ticket.assignedTo !== creatorId) {
      await createNotificationSafe({
        userId: ticket.assignedTo,
        type: 'ticket_assigned',
        title: 'تذكرة جديدة',
        message: `${ticket.title} — ${getPriorityLabel(ticket.priority)}`,
        priority: ticket.priority === 'urgent' || ticket.priority === 'critical' || ticket.priority === 'high' ? 'high' : 'normal',
        actionUrl: '/it-director/tickets',
        entityType: 'ticket',
        entityId: ticket.id,
      });
      sendEmailNonBlocking(ticket.assignedTo, `تذكرة جديدة: ${ticket.title}`, (name) =>
        generateTicketCreatedEmail({
          recipientName: name,
          ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
          ticketTitle: ticket.title,
          priority: ticket.priority || 'medium',
          category: ticket.category || 'عام',
          createdBy: 'النظام',
        })
      );
    }
    const admins = await db.select({ id: users.id }).from(users)
      .where(eq(users.portal, 'it_director'));
    for (const admin of admins) {
      if (admin.id !== creatorId) {
        await createNotificationSafe({
          userId: admin.id,
          type: 'ticket_created',
          title: 'تذكرة جديدة',
          message: `${ticket.title} — ${getPriorityLabel(ticket.priority)}`,
          priority: ticket.priority === 'urgent' || ticket.priority === 'critical' ? 'high' : 'normal',
          entityType: 'ticket',
          entityId: ticket.id,
        });
        sendEmailNonBlocking(admin.id, `تذكرة جديدة: ${ticket.title}`, (name) =>
          generateTicketCreatedEmail({
            recipientName: name,
            ticketNumber: ticket.ticketNumber || `TKT-${ticket.id}`,
            ticketTitle: ticket.title,
            priority: ticket.priority || 'medium',
            category: ticket.category || 'عام',
            createdBy: 'النظام',
          })
        );
      }
    }
  } catch (error) {
    logger.error('notifyTicketCreated error', { error });
  }
}

export async function notifyTicketStatusChanged(ticket: any, oldStatus: string, changedById: number) {
  try {
    const notifyUserIds: number[] = [];
    if (ticket.createdBy && ticket.createdBy !== changedById) {
      await createNotificationSafe({
        userId: ticket.createdBy,
        type: 'ticket_status_changed',
        title: 'تحديث حالة التذكرة',
        message: `${ticket.title} — ${getStatusLabel(oldStatus)} ← ${getStatusLabel(ticket.status)}`,
        priority: 'normal',
        actionUrl: '/it-director/tickets',
        entityType: 'ticket',
        entityId: ticket.id,
      });
      notifyUserIds.push(ticket.createdBy);
    }
    if (ticket.assignedTo && ticket.assignedTo !== changedById) {
      await createNotificationSafe({
        userId: ticket.assignedTo,
        type: 'ticket_status_changed',
        title: 'تحديث حالة التذكرة',
        message: `${ticket.title} — الحالة: ${getStatusLabel(ticket.status)}`,
        priority: 'normal',
        entityType: 'ticket',
        entityId: ticket.id,
      });
      notifyUserIds.push(ticket.assignedTo);
    }
    for (const uid of notifyUserIds) {
      sendEmailNonBlocking(uid, `تحديث التذكرة: ${ticket.title}`, (name) =>
        generateTicketStatusUpdateEmail({
          recipientName: name,
          ticketNumber: `TKT-${ticket.id}`,
          ticketTitle: ticket.title,
          oldStatus: getStatusLabel(oldStatus),
          newStatus: getStatusLabel(ticket.status),
          updatedBy: 'النظام',
        })
      );
    }
  } catch (error) {
    logger.error('notifyTicketStatusChanged error', { error });
  }
}

export async function notifyProjectCreated(project: any, creatorId: number) {
  try {
    
    if (project.managerId && project.managerId !== creatorId) {
      await createNotificationSafe({
        userId: project.managerId,
        type: 'project_assigned',
        title: 'مشروع جديد مسند إليك',
        message: `${project.nameAr || project.name}`,
        priority: 'high',
        actionUrl: '/it-director/projects',
        entityType: 'project',
        entityId: project.id,
      });
      sendEmailNonBlocking(project.managerId, `مشروع جديد: ${project.nameAr || project.name}`, (name) =>
        generateProjectStatusEmail({
          recipientName: name,
          projectCode: `PRJ-${project.id}`,
          projectTitle: project.nameAr || project.name,
          oldStatus: '',
          newStatus: 'جديد',
          progress: 0,
          updatedBy: 'النظام',
        })
      );
    }
  } catch (error) {
    logger.error('notifyProjectCreated error', { error });
  }
}

export async function notifyProjectStatusChanged(project: any, oldStatus: string, changedById: number) {
  try {
    const notifyUserIds: number[] = [];
    if (project.managerId && project.managerId !== changedById) {
      await createNotificationSafe({
        userId: project.managerId,
        type: 'project_status_changed',
        title: 'تحديث حالة المشروع',
        message: `${project.nameAr || project.name} — ${getStatusLabel(project.status)}`,
        priority: 'normal',
        entityType: 'project',
        entityId: project.id,
      });
      notifyUserIds.push(project.managerId);
    }
    
    const directors = await db.select({ id: users.id }).from(users)
      .where(eq(users.portal, 'it_director'));
    for (const dir of directors) {
      if (dir.id !== changedById) {
        await createNotificationSafe({
          userId: dir.id,
          type: 'project_status_changed',
          title: 'تحديث حالة المشروع',
          message: `${project.nameAr || project.name} — ${getStatusLabel(project.status)}`,
          priority: 'normal',
          entityType: 'project',
          entityId: project.id,
        });
        notifyUserIds.push(dir.id);
      }
    }
    const projectName = project.nameAr || project.name;
    for (const uid of Array.from(new Set(notifyUserIds))) {
      sendEmailNonBlocking(uid, `تحديث المشروع: ${projectName}`, (name) =>
        generateProjectStatusEmail({
          recipientName: name,
          projectCode: `PRJ-${project.id}`,
          projectTitle: projectName,
          oldStatus: getStatusLabel(oldStatus),
          newStatus: getStatusLabel(project.status),
          progress: project.progress || 0,
          updatedBy: 'النظام',
        })
      );
    }
  } catch (error) {
    logger.error('notifyProjectStatusChanged error', { error });
  }
}

export async function notifyTaskAssigned(task: any, assignedToId: number, assignedById: number) {
  try {
    if (assignedToId !== assignedById) {
      await createNotificationSafe({
        userId: assignedToId,
        type: 'task_assigned',
        title: 'مهمة جديدة مسندة إليك',
        message: `${task.title}${task.dueDate ? ' — ' + new Date(task.dueDate).toLocaleDateString('ar-SA') : ''}`,
        priority: task.priority === 'urgent' || task.priority === 'high' || task.priority === 'critical' ? 'high' : 'normal',
        entityType: 'task',
        entityId: task.id,
      });
      sendEmailNonBlocking(assignedToId, `مهمة جديدة: ${task.title}`, (name) =>
        generateTaskAssignmentEmail({
          recipientName: name,
          taskTitle: task.title,
          taskDescription: task.description || '',
          priority: task.priority || 'medium',
          dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA') : 'غير محدد',
          assignedBy: 'المدير',
          departmentName: 'تقنية المعلومات',
        })
      );
    }
  } catch (error) {
    logger.error('notifyTaskAssigned error', { error });
  }
}

export async function notifySLABreachCreated(breach: any, slaTitle: string) {
  try {
    
    const directors = await db.select({ id: users.id }).from(users)
      .where(eq(users.portal, 'it_director'));
    for (const dir of directors) {
      await createNotificationSafe({
        userId: dir.id,
        type: 'sla_breach',
        title: 'تجاوز اتفاقية SLA',
        message: `${slaTitle} — ${breach.impactLevel === 'critical' ? 'تأثير حرج' : breach.impactLevel === 'high' ? 'تأثير عالي' : 'تأثير متوسط'}`,
        priority: 'high',
        actionUrl: '/it-director/sla',
        entityType: 'sla_breach',
        entityId: breach.id,
      });
      sendEmailNonBlocking(dir.id, `تنبيه: تجاوز SLA - ${slaTitle}`, (name) =>
        generateEscalationEmail({
          recipientName: name,
          escalationType: 'تجاوز SLA',
          reason: `تجاوز اتفاقية مستوى الخدمة "${slaTitle}"`,
          priority: breach.impactLevel === 'critical' ? 'حرج' : 'عالي',
          escalatedBy: 'النظام',
          entityDetails: `SLA-${breach.id}: ${slaTitle}`,
        })
      );
    }
  } catch (error) {
    logger.error('notifySLABreachCreated error', { error });
  }
}

export async function checkOverdueTasksAndSLAs() {
  try {
    
    const now = new Date();

    const overdueTasks = await db.select().from(tasks)
      .where(
        and(
          lt(tasks.dueDate, now),
          ne(tasks.status, 'completed'),
          ne(tasks.status, 'cancelled'),
          ne(tasks.status, 'archived'),
          isNull(tasks.deletedAt)
        )
      );

    let autoEscalatedCount = 0;
    for (const task of overdueTasks) {
      const overdueHours = Math.floor((now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60));

      if (task.assignedTo) {
        await createNotificationSafe({
          userId: task.assignedTo,
          type: 'task_overdue',
          title: 'مهمة متأخرة',
          message: `${task.title} — تجاوزت الموعد النهائي بـ ${overdueHours} ساعة`,
          priority: 'high',
          entityType: 'task',
          entityId: task.id,
        });
      }

      if (overdueHours >= 48 && !task.isEscalated) {
        try {
          let deptManagerId: number | null = null;
          if (task.departmentId) {
            const [dept] = await db.select({ managerId: itDepartments.managerId }).from(itDepartments).where(eq(itDepartments.id, task.departmentId)).limit(1);
            deptManagerId = dept?.managerId || null;
          }

          const needsUpgrade = task.priority === 'low' || task.priority === 'medium';
          const newPriority = needsUpgrade ? 'high' : task.priority;

          await db.update(tasks).set({
            isEscalated: true,
            priority: newPriority,
            updatedAt: new Date(),
          } as any).where(eq(tasks.id, task.id));

          const escalateToUser = deptManagerId || task.assignedTo;
          if (escalateToUser) {
            await db.insert(escalations).values({
              entityType: 'task',
              entityId: task.id,
              reason: `تصعيد تلقائي — المهمة متأخرة بأكثر من 48 ساعة${needsUpgrade ? ` (رُفعت الأولوية إلى عالية)` : ''}`,
              escalatedFrom: task.assignedTo || escalateToUser,
              escalatedTo: escalateToUser,
              priority: 'high',
              status: 'pending',
            } as any);
          }

          if (deptManagerId) {
            await createNotificationSafe({
              userId: deptManagerId,
              type: 'task_auto_escalated',
              title: '⚠ تصعيد تلقائي لمهمة متأخرة',
              message: `${task.title} — متأخرة بـ ${overdueHours} ساعة${needsUpgrade ? ' (رُفعت الأولوية)' : ''}`,
              priority: 'high',
              entityType: 'task',
              entityId: task.id,
            });
          }

          const itDirectorsForTask = await db.select({ id: users.id }).from(users).where(eq(users.portal, 'it_director'));
          for (const dir of itDirectorsForTask) {
            if (dir.id !== deptManagerId) {
              await createNotificationSafe({
                userId: dir.id,
                type: 'task_auto_escalated',
                title: '⚠ تصعيد تلقائي لمهمة متأخرة',
                message: `${task.title} — متأخرة بـ ${overdueHours} ساعة`,
                priority: 'high',
                entityType: 'task',
                entityId: task.id,
              });
            }
          }

          autoEscalatedCount++;
        } catch (escErr) {
          logger.error(`Auto-escalation failed for task ${task.id}`, { error: escErr });
        }
      }
    }

    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const expiringSLAs = await db.select().from(slaAgreements)
      .where(
        and(
          eq(slaAgreements.status, 'active'),
          lte(slaAgreements.endDate, twoDaysFromNow),
          gte(slaAgreements.endDate, now)
        )
      );

    if (expiringSLAs.length > 0) {
      const directors = await db.select({ id: users.id }).from(users)
        .where(eq(users.portal, 'it_director'));
      for (const sla of expiringSLAs) {
        for (const dir of directors) {
          await createNotificationSafe({
            userId: dir.id,
            type: 'sla_expiring',
            title: 'اتفاقية SLA تقترب من الانتهاء',
            message: `${sla.title} — تنتهي خلال يومين`,
            priority: 'high',
            actionUrl: '/it-director/sla',
            entityType: 'sla_agreement',
            entityId: sla.id,
          });
        }
      }
    }

    const warningSLAs = await db.select().from(slaAgreements)
      .where(eq(slaAgreements.complianceStatus, 'warning'));

    if (warningSLAs.length > 0) {
      const directors = await db.select({ id: users.id }).from(users)
        .where(eq(users.portal, 'it_director'));
      for (const sla of warningSLAs) {
        for (const dir of directors) {
          await createNotificationSafe({
            userId: dir.id,
            type: 'sla_warning',
            title: 'تحذير SLA',
            message: `${sla.title} — الأداء قريب من الحد الأدنى`,
            priority: 'normal',
            actionUrl: '/it-director/sla',
            entityType: 'sla_agreement',
            entityId: sla.id,
          });
        }
      }
    }

    const ticketsWithSLA = await db.select().from(itTickets)
      .where(
        and(
          ne(itTickets.status, 'closed'),
          ne(itTickets.status, 'resolved'),
          lt(itTickets.slaDeadline, now),
          isNull(itTickets.deletedAt)
        )
      );

    const itDirectors = await db.select({ id: users.id }).from(users)
      .where(eq(users.portal, 'it_director'));

    for (const ticket of ticketsWithSLA) {
      if (ticket.assigneeId) {
        await createNotificationSafe({
          userId: ticket.assigneeId,
          type: 'ticket_sla_breach',
          title: 'تجاوز وقت SLA للتذكرة',
          message: `${ticket.ticketNumber} — ${ticket.title}`,
          priority: 'high',
          entityType: 'ticket',
          entityId: ticket.id,
          actionUrl: '/it-director/tickets',
        });
      } else {
        // Unassigned breached ticket - notify IT Directors
        for (const dir of itDirectors) {
          await createNotificationSafe({
            userId: dir.id,
            type: 'ticket_sla_breach_unassigned',
            title: 'تذكرة غير معيّنة تجاوزت SLA',
            message: `${ticket.ticketNumber} — ${ticket.title} (غير مُسندة)`,
            priority: 'high',
            entityType: 'ticket',
            entityId: ticket.id,
            actionUrl: '/it-director/tickets',
          });
        }
      }
    }

    // Check regulatory controls approaching due dates (7 days warning)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const approachingControls = await db.select().from(regulatoryControls)
      .where(
        and(
          ne(regulatoryControls.status, 'completed'),
          ne(regulatoryControls.status, 'not_applicable'),
          sql`${regulatoryControls.dueDate} IS NOT NULL`,
          lte(regulatoryControls.dueDate, sevenDaysFromNow),
          gte(regulatoryControls.dueDate, now)
        )
      );
    for (const control of approachingControls) {
      const daysLeft = Math.ceil((new Date(control.dueDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      for (const dir of itDirectors) {
        await createNotificationSafe({
          userId: dir.id,
          type: 'compliance_due_soon',
          title: 'ضابط امتثال يقترب موعده',
          message: `${control.title} — خلال ${daysLeft} يوم`,
          priority: daysLeft <= 2 ? 'high' : 'normal',
          entityType: 'regulatory_control',
          entityId: control.id,
          actionUrl: '/it-director/compliance',
        });
      }
    }
    const approachingControlsCount = approachingControls.length;

    // Auto-finalize expired voting sessions
    const expiredSessions = await db.select().from(votingSessions)
      .where(and(
        eq(votingSessions.status, 'open'),
        sql`${votingSessions.endDate} IS NOT NULL`,
        lt(votingSessions.endDate, now)
      ));

    let autoFinalizedCount = 0;
    for (const session of expiredSessions) {
      try {
        const totalVotes = (session.votesFor || 0) + (session.votesAgainst || 0) + (session.votesAbstain || 0);
        const activeMembers = await db.select({ id: committeeMembers.id }).from(committeeMembers)
          .where(eq(committeeMembers.isActive, true));
        const totalMembers = activeMembers.length;
        const quorumPct = session.quorumRequired || 50;
        const quorumMet = totalMembers > 0 && (totalVotes / totalMembers) * 100 >= quorumPct;

        let result: 'approved' | 'rejected' = 'rejected';
        if (quorumMet) {
          const vType = session.votingType || 'majority';
          if (vType === 'unanimous') {
            result = (session.votesAgainst === 0 && (session.votesFor || 0) > 0) ? 'approved' : 'rejected';
          } else if (vType === 'two_thirds') {
            result = totalVotes > 0 && ((session.votesFor || 0) / totalVotes) >= 0.667 ? 'approved' : 'rejected';
          } else {
            result = (session.votesFor || 0) > (session.votesAgainst || 0) ? 'approved' : 'rejected';
          }
        }

        await db.update(votingSessions).set({
          status: 'completed',
          result,
          updatedAt: new Date(),
        } as any).where(eq(votingSessions.id, session.id));

        const directors = await db.select({ id: users.id }).from(users).where(eq(users.portal, 'it_director'));
        for (const dir of directors) {
          await createNotificationSafe({
            userId: dir.id,
            type: 'voting_auto_finalized',
            title: 'إغلاق تلقائي لجلسة تصويت',
            message: `${session.title} — ${result === 'approved' ? '✓ موافقة' : '✗ رفض'}${quorumMet ? '' : ' (نصاب غير مكتمل)'}`,
            priority: 'normal',
            actionUrl: '/committee',
            entityType: 'voting_session',
            entityId: session.id,
          });
        }
        autoFinalizedCount++;
      } catch (err) {
        logger.error(`Auto-finalize voting session ${session.id} failed`, { err });
      }
    }

    logger.info(`Checked: ${overdueTasks.length} overdue tasks (${autoEscalatedCount} auto-escalated), ${expiringSLAs.length} expiring SLAs, ${ticketsWithSLA.length} SLA-breached tickets, ${approachingControlsCount} compliance controls due soon, ${autoFinalizedCount} voting sessions auto-finalized`);
  } catch (error) {
    logger.error('checkOverdueTasksAndSLAs error', { error });
  }
}

let checkInterval: NodeJS.Timeout | null = null;
let slaFastInterval: NodeJS.Timeout | null = null;

export async function sendWeeklyReports() {
  try {
    const userCheck = await hasActiveUsers();
    if (userCheck.dbError) {
      logger.error('Database error — skipping weekly reports (will retry next cycle)');
      return;
    }
    if (!userCheck.exists) {
      logger.info('No active users — skipping weekly reports');
      return;
    }
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 1. جمّع بيانات كل الأقسام
    const deptMap: Record<number, string> = {
      5: 'مكتب البيانات', 9: 'البنية التحتية', 10: 'الأمن السيبراني',
      11: 'التحول الرقمي', 12: 'الدعم الفني'
    };
    const portalToDept: Record<string, number> = {
      dmo: 5, infrastructure: 9, cybersecurity: 10,
      digital_transformation: 11, support: 12
    };
    
    // جلب كل التذاكر والمهام والمشاريع
    const [allTickets, allTasks, allProjects, allUsers] = await Promise.all([
      db.select().from(itTickets).where(isNull(itTickets.deletedAt)),
      db.select().from(tasks).where(isNull(tasks.deletedAt)),
      db.select().from(itProjects), // استخدم الجدول الصحيح
      db.select({ id: users.id, name: users.name, email: users.email, portal: users.portal, role: users.role, itDepartmentId: users.itDepartmentId, emailNotificationsEnabled: users.emailNotificationsEnabled }).from(users).where(eq(users.isActive, true))
    ]);
    
    // 2. أرسل لمدراء التقنية: تقرير شامل لكل الأقسام
    const directors = allUsers.filter((u: any) => u.portal === 'it_director' && u.emailNotificationsEnabled);
    for (const dir of directors) {
      const deptSummaries = Object.entries(deptMap).map(([deptId, deptName]) => {
        const dId = parseInt(deptId);
        const deptTickets = allTickets.filter((t: any) => t.itDepartmentId === dId);
        const openTickets = deptTickets.filter((t: any) => !['closed', 'resolved'].includes(t.status)).length;
        const closedThisWeek = deptTickets.filter((t: any) => t.updatedAt && new Date(t.updatedAt) >= weekAgo && ['closed', 'resolved'].includes(t.status)).length;
        const deptTasks = allTasks.filter((t: any) => t.departmentId === dId);
        const overdueTasks = deptTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && !['completed', 'cancelled'].includes(t.status)).length;
        return { deptName, openTickets, closedThisWeek, overdueTasks };
      });
      const html = generateWeeklyDirectorEmail(dir.name, deptSummaries, now);
      await sendEmail(dir.email, `التقرير الأسبوعي - مدير التقنية - ${now.toLocaleDateString('ar-SA')}`, html);
    }
    
    // 3. أرسل لكل مدير قسم: تقرير قسمه فقط
    const managerRoleSuffixes = ['infrastructure_manager', 'cybersecurity_manager', 'digital_manager', 'support_manager', 'dmo_manager', 'it_infrastructure_manager', 'it_cybersecurity_manager', 'it_digital_manager', 'it_support_manager'];
    const managers = allUsers.filter((u: any) => managerRoleSuffixes.some((r: string) => u.role === r) && u.emailNotificationsEnabled);
    
    for (const mgr of managers) {
      const deptId = mgr.itDepartmentId || portalToDept[mgr.portal || ''];
      if (!deptId) continue;
      const deptName = deptMap[deptId] || 'قسم التقنية';
      
      const deptTickets = allTickets.filter((t: any) => t.itDepartmentId === deptId);
      const openTickets = deptTickets.filter((t: any) => !['closed', 'resolved'].includes(t.status)).length;
      const closedThisWeek = deptTickets.filter((t: any) => t.updatedAt && new Date(t.updatedAt) >= weekAgo && ['closed', 'resolved'].includes(t.status)).length;
      const slaBreaches = deptTickets.filter((t: any) => t.slaDeadline && new Date(t.slaDeadline) < now && !['closed', 'resolved'].includes(t.status)).length;
      
      const deptTasks = allTasks.filter((t: any) => t.departmentId === deptId);
      const overdueTasks = deptTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && !['completed', 'cancelled'].includes(t.status)).length;
      const completedTasks = deptTasks.filter((t: any) => t.updatedAt && new Date(t.updatedAt) >= weekAgo && t.status === 'completed').length;
      
      const html = generateWeeklyManagerEmail(mgr.name, deptName, { openTickets, closedThisWeek, slaBreaches, overdueTasks, completedTasks }, now);
      await sendEmail(mgr.email, `التقرير الأسبوعي - ${deptName} - ${now.toLocaleDateString('ar-SA')}`, html);
    }
    
    logger.info(`Weekly reports sent: ${directors.length} directors, ${managers.length} managers`);
  } catch (error) {
    logger.error('sendWeeklyReports error', { error });
  }
}

function generateWeeklyDirectorEmail(name: string, depts: any[], date: Date): string {
  const rows = depts.map(d => `
    <tr style="border-bottom:1px solid #1e3a5f">
      <td style="padding:10px;color:#e2e8f0;font-weight:600">${d.deptName}</td>
      <td style="padding:10px;text-align:center;color:${d.openTickets > 10 ? '#f87171' : '#94a3b8'}">${d.openTickets}</td>
      <td style="padding:10px;text-align:center;color:#10b981">${d.closedThisWeek}</td>
      <td style="padding:10px;text-align:center;color:${d.overdueTasks > 0 ? '#f87171' : '#94a3b8'}">${d.overdueTasks}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head>
  <body style="background:#0a1628;font-family:Segoe UI,sans-serif;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#0f1f3d;border-radius:12px;border:1px solid rgba(212,175,55,0.3);overflow:hidden">
    <div style="background:linear-gradient(135deg,#1a3a6b,#0f1f3d);padding:24px;border-bottom:1px solid rgba(212,175,55,0.3)">
      <h1 style="color:#d4af37;margin:0;font-size:20px">📊 التقرير الأسبوعي — مدير التقنية</h1>
      <p style="color:#94a3b8;margin:8px 0 0">${date.toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
    </div>
    <div style="padding:24px">
      <p style="color:#e2e8f0">مرحباً ${name}،</p>
      <p style="color:#94a3b8">فيما يلي ملخص أداء الأقسام للأسبوع الماضي:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#1a3a6b">
            <th style="padding:10px;color:#d4af37;text-align:right">القسم</th>
            <th style="padding:10px;color:#d4af37;text-align:center">تذاكر مفتوحة</th>
            <th style="padding:10px;color:#d4af37;text-align:center">أُغلق هذا الأسبوع</th>
            <th style="padding:10px;color:#d4af37;text-align:center">مهام متأخرة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 24px;background:#0a1628;text-align:center;border-top:1px solid rgba(212,175,55,0.2)">
      <p style="color:#475569;font-size:12px;margin:0">Control Hub — JCSA © 2026</p>
    </div>
  </div></body></html>`;
}

function generateWeeklyManagerEmail(name: string, deptName: string, stats: any, date: Date): string {
  const items = [
    { label: 'تذاكر مفتوحة', value: stats.openTickets, alert: stats.openTickets > 10 },
    { label: 'تذاكر أُغلقت هذا الأسبوع', value: stats.closedThisWeek, alert: false },
    { label: 'تجاوزات SLA', value: stats.slaBreaches, alert: stats.slaBreaches > 0 },
    { label: 'مهام متأخرة', value: stats.overdueTasks, alert: stats.overdueTasks > 0 },
    { label: 'مهام أُنجزت هذا الأسبوع', value: stats.completedTasks, alert: false },
  ].map(i => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#1a3a6b;border-radius:8px;margin-bottom:8px">
      <span style="color:#e2e8f0">${i.label}</span>
      <span style="font-size:20px;font-weight:bold;color:${i.alert ? '#f87171' : '#10b981'}">${i.value}</span>
    </div>`).join('');
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head>
  <body style="background:#0a1628;font-family:Segoe UI,sans-serif;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#0f1f3d;border-radius:12px;border:1px solid rgba(212,175,55,0.3);overflow:hidden">
    <div style="background:linear-gradient(135deg,#1a3a6b,#0f1f3d);padding:24px;border-bottom:1px solid rgba(212,175,55,0.3)">
      <h1 style="color:#d4af37;margin:0;font-size:20px">📊 التقرير الأسبوعي — ${deptName}</h1>
      <p style="color:#94a3b8;margin:8px 0 0">${date.toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
    </div>
    <div style="padding:24px">
      <p style="color:#e2e8f0">مرحباً ${name}،</p>
      <p style="color:#94a3b8">ملخص أداء قسم ${deptName} للأسبوع الماضي:</p>
      ${items}
    </div>
    <div style="padding:16px 24px;background:#0a1628;text-align:center;border-top:1px solid rgba(212,175,55,0.2)">
      <p style="color:#475569;font-size:12px;margin:0">Control Hub — JCSA © 2026</p>
    </div>
  </div></body></html>`;
}

export async function checkAlertRules() {
  try {
    const now = new Date();
    const rules = await db.select().from(alertRules).where(eq(alertRules.isActive, true));
    
    for (const rule of rules) {
      let currentValue = 0;
      const deptFilter = rule.itDepartmentId;
      
      if (rule.metric === 'sla_breached') {
        const tickets = await db.select().from(itTickets)
          .where(deptFilter
            ? and(eq(itTickets.departmentId, deptFilter), isNull(itTickets.deletedAt))
            : isNull(itTickets.deletedAt));
        currentValue = tickets.filter((t: any) => t.slaDeadline && new Date(t.slaDeadline) < now && !['closed','resolved'].includes(t.status)).length;
      } else if (rule.metric === 'open_tickets') {
        const tickets = await db.select().from(itTickets)
          .where(deptFilter
            ? and(eq(itTickets.departmentId, deptFilter), isNull(itTickets.deletedAt))
            : isNull(itTickets.deletedAt));
        currentValue = tickets.filter((t: any) => !['closed','resolved'].includes(t.status)).length;
      } else if (rule.metric === 'overdue_tasks') {
        const allTasks = await db.select().from(tasks)
          .where(deptFilter
            ? and(eq(tasks.departmentId, deptFilter), isNull(tasks.deletedAt))
            : isNull(tasks.deletedAt));
        currentValue = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && !['completed','cancelled'].includes(t.status)).length;
      } else if (rule.metric === 'pending_tickets') {
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const tickets = await db.select().from(itTickets)
          .where(deptFilter
            ? and(eq(itTickets.departmentId, deptFilter), isNull(itTickets.deletedAt))
            : isNull(itTickets.deletedAt));
        currentValue = tickets.filter((t: any) => t.status === 'pending' && t.createdAt && new Date(t.createdAt) < threeDaysAgo).length;
      }
      
      let conditionMet = false;
      if (rule.operator === '>') conditionMet = currentValue > rule.threshold;
      else if (rule.operator === '>=') conditionMet = currentValue >= rule.threshold;
      else if (rule.operator === '<') conditionMet = currentValue < rule.threshold;
      else if (rule.operator === '<=') conditionMet = currentValue <= rule.threshold;
      else if (rule.operator === '=') conditionMet = currentValue === rule.threshold;
      
      if (!conditionMet) continue;
      
      const notifyRoles = (rule.notifyRoles as string[]) || [];
      if (notifyRoles.length === 0) continue;
      
      const targetUsers = await db.select().from(users).where(eq(users.isActive, true));
      
      const METRIC_LABELS: Record<string, string> = {
        sla_breached: 'تذاكر SLA منتهكة',
        open_tickets: 'تذاكر مفتوحة',
        overdue_tasks: 'مهام متأخرة',
        pending_tickets: 'تذاكر معلقة'
      };
      const metricLabel = METRIC_LABELS[rule.metric] || rule.metric;
      const message = `تنبيه: ${rule.name} — ${metricLabel} وصلت إلى ${currentValue} (الحد: ${rule.threshold})`;
      
      for (const u of targetUsers) {
        if (notifyRoles.includes(u.role)) {
          await createNotificationSafe({
            userId: u.id,
            type: 'system_alert',
            title: `⚠️ تنبيه ذكي: ${rule.name}`,
            message,
            priority: 'high',
            actionUrl: '/admin/alert-rules',
          });
        }
      }
    }
    logger.info(`Alert rules checked`);
  } catch (error) {
    logger.error('checkAlertRules error', { error });
  }
}

export async function runAutomationRules() {
  try {
    const now = new Date();
    const rules = await db.select().from(automationRules).where(eq(automationRules.isActive, true));
    
    for (const rule of rules) {
      if (rule.triggerType === 'ticket_pending_days') {
        const days = Number(rule.triggerValue);
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        
        const conditions = [
          eq(itTickets.status, 'pending'),
          isNull(itTickets.deletedAt),
        ];
        if (rule.itDepartmentId) conditions.push(eq(itTickets.departmentId, rule.itDepartmentId) as any);
        
        const pendingTickets = await db.select().from(itTickets).where(and(...conditions));
        const oldPending = pendingTickets.filter((t: any) => t.createdAt && new Date(t.createdAt) < cutoff);
        
        for (const ticket of oldPending) {
          if (rule.action === 'escalate' && ticket.status !== 'escalated') {
            await db.update(itTickets).set({ status: 'escalated', updatedAt: new Date() }).where(eq(itTickets.id, ticket.id));
            logger.info(`Automation: escalated ticket #${ticket.id}`);
          } else if (rule.action === 'change_priority') {
            await db.update(itTickets).set({ priority: (rule.actionValue || 'high') as any, updatedAt: new Date() }).where(eq(itTickets.id, ticket.id));
          } else if (rule.action === 'notify_manager') {
            const managers = await db.select().from(users).where(eq(users.isActive, true));
            for (const u of managers) {
              const isManager = (u.role as string)?.includes('manager') || u.role === 'it_director';
              const inDept = !ticket.departmentId || u.itDepartmentId === ticket.departmentId;
              if (isManager && inDept) {
                await createNotificationSafe({
                  userId: u.id, type: 'ticket_escalation',
                  title: `تنبيه أتمتة: تذكرة معلقة منذ ${days} أيام`,
                  message: `التذكرة #${(ticket as any).ticketNumber || ticket.id} لا تزال معلقة`,
                  priority: 'high', actionUrl: `/tickets/${ticket.id}`,
                });
              }
            }
          }
        }
      }
      await db.update(automationRules).set({ lastRunAt: now }).where(eq(automationRules.id, rule.id));
    }
    logger.info(`Automation rules run completed`);
  } catch (error) {
    logger.error('runAutomationRules error', { error });
  }
}

// ===================== AUTO-ESCALATION FOR REFERRALS =====================
export async function checkReferralEscalations() {
  try {
    const now = new Date();
    const DEPT_NAMES: Record<number, string> = { 1: 'البنية التحتية', 2: 'الأمن السيبراني', 3: 'التحول الرقمي', 4: 'الدعم الفني' };
    const DEPT_PATH: Record<number, string> = { 1: '/department/infrastructure/referrals', 2: '/department/cybersecurity/referrals', 3: '/department/digital-transformation/referrals', 4: '/department/support/referrals' };

    // Get all pending/accepted referrals that haven't been completed or rejected
    const activeReferrals = await db.select().from(itReferrals)
      .where(and(
        ne(itReferrals.status, 'completed'),
        ne(itReferrals.status, 'rejected'),
        ne(itReferrals.status, 'returned')
      ));

    let escalationCount = 0;
    for (const referral of activeReferrals) {
      const slaAckHours = referral.slaAcknowledgeHours || 4;
      const slaHours = referral.slaHours || 48;
      const createdAt = new Date(referral.createdAt);
      const ackDeadline = new Date(createdAt.getTime() + slaAckHours * 3600000);
      const fullDeadline = referral.dueDate ? new Date(referral.dueDate) : new Date(createdAt.getTime() + slaHours * 3600000);
      const currentLevel = referral.escalationLevel || 0;

      // Level 1 escalation: No acknowledgment within slaAckHours → notify dept manager
      if (
        currentLevel === 0 &&
        !referral.acknowledgedAt &&
        referral.status === 'pending' &&
        now > ackDeadline
      ) {
        await db.update(itReferrals)
          .set({ escalationLevel: 1, escalatedAt: now, updatedAt: now })
          .where(eq(itReferrals.id, referral.id));

        await db.insert(itReferralHistory).values({
          referralId: referral.id,
          action: 'auto_escalated_L1',
          performedById: 1,
          fromStatus: referral.status,
          toStatus: referral.status,
          notes: `تصعيد تلقائي المستوى 1: لم يتم تأكيد الاستلام خلال ${slaAckHours} ساعات`
        });

        // Find dept manager and notify
        const deptUsers = await db.select().from(users)
          .where(and(
            eq(users.itDepartmentId, referral.toDepartmentId),
            sql`${users.role} LIKE '%manager%'`
          ));

        for (const mgr of deptUsers) {
          await createNotificationSafe({
            userId: mgr.id,
            type: 'referral_escalated',
            title: '⚠️ إحالة بدون تأكيد استلام',
            message: `"${referral.title}" من ${DEPT_NAMES[referral.fromDepartmentId] || 'إدارة أخرى'} لم يتم تأكيد استلامها منذ ${slaAckHours} ساعات`,
            priority: 'high',
            entityType: 'it_referral',
            entityId: referral.id,
            actionUrl: DEPT_PATH[referral.toDepartmentId] || '/it-director/referrals',
          });
        }
        escalationCount++;
      }

      // Level 2 escalation: No response within full SLA → notify IT Director
      if (
        currentLevel <= 1 &&
        referral.status === 'pending' &&
        now > fullDeadline &&
        !referral.itDirectorEscalatedAt
      ) {
        await db.update(itReferrals)
          .set({ escalationLevel: 2, itDirectorEscalatedAt: now, updatedAt: now })
          .where(eq(itReferrals.id, referral.id));

        await db.insert(itReferralHistory).values({
          referralId: referral.id,
          action: 'auto_escalated_L2',
          performedById: 1,
          fromStatus: referral.status,
          toStatus: referral.status,
          notes: `تصعيد تلقائي المستوى 2: تجاوزت مهلة SLA الكاملة (${slaHours}h) — تم إبلاغ مدير تقنية المعلومات`
        });

        // Notify IT Director
        const directors = await db.select().from(users).where(eq(users.role, 'it_director' as any));
        for (const director of directors) {
          await createNotificationSafe({
            userId: director.id,
            type: 'referral_escalated',
            title: '🔴 إحالة تجاوزت SLA — تحتاج تدخلك',
            message: `"${referral.title}" من ${DEPT_NAMES[referral.fromDepartmentId] || 'إدارة'} إلى ${DEPT_NAMES[referral.toDepartmentId] || 'إدارة'} تجاوزت ${slaHours} ساعة بدون استجابة`,
            priority: 'high',
            entityType: 'it_referral',
            entityId: referral.id,
            actionUrl: '/it-director/referrals',
          });
        }
        escalationCount++;
      }
    }
    if (escalationCount > 0) logger.info(`Referral escalations: ${escalationCount} processed`);
  } catch (error) {
    logger.error('checkReferralEscalations error', { error });
  }
}

async function hasActiveUsers(): Promise<{ exists: boolean; dbError: boolean }> {
  try {
    const result = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).limit(1);
    return { exists: result.length > 0, dbError: false };
  } catch (err) {
    logger.error('Failed to check active users', { error: err });
    return { exists: false, dbError: true };
  }
}

export function startNotificationScheduler() {
  const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
  
  if (!isPrimaryInstance) {
    logger.info(`Skipping scheduler on cluster instance ${process.env.NODE_APP_INSTANCE} (only instance 0 runs scheduled jobs)`);
    return;
  }

  const checkAll = async () => {
    const userCheck = await hasActiveUsers();
    if (userCheck.dbError) {
      logger.error('Database error during user check — skipping scheduled checks (will retry next cycle)');
      return;
    }
    if (!userCheck.exists) {
      logger.info('No active users — skipping scheduled checks');
      return;
    }
    await checkOverdueTasksAndSLAs();
    await checkAlertRules();
    await runAutomationRules();
    await checkReferralEscalations();
  };
  checkAll();
  checkInterval = setInterval(checkAll, 10 * 60 * 1000);

  const checkSLAFast = async () => {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const newlyBreachedTickets = await db.select().from(itTickets)
        .where(
          and(
            ne(itTickets.status, 'closed'),
            ne(itTickets.status, 'resolved'),
            lt(itTickets.slaDeadline, now),
            gte(itTickets.slaDeadline, fiveMinAgo),
            isNull(itTickets.deletedAt)
          )
        );

      if (newlyBreachedTickets.length > 0) {
        const directors = await db.select({ id: users.id }).from(users).where(eq(users.portal, 'it_director'));
        for (const ticket of newlyBreachedTickets) {
          if (ticket.assigneeId) {
            await createNotificationSafe({
              userId: ticket.assigneeId,
              type: 'ticket_sla_breach_immediate',
              title: '🚨 انتهاك SLA الآن',
              message: `${ticket.ticketNumber} — ${ticket.title} — تجاوزت الوقت المحدد`,
              priority: 'high',
              entityType: 'ticket',
              entityId: ticket.id,
              actionUrl: '/it-director/tickets',
            });
          }
          for (const dir of directors) {
            await createNotificationSafe({
              userId: dir.id,
              type: 'ticket_sla_breach_immediate',
              title: '🚨 انتهاك SLA فوري',
              message: `${ticket.ticketNumber} — ${ticket.title}${!ticket.assigneeId ? ' (غير مُسندة)' : ''}`,
              priority: 'high',
              entityType: 'ticket',
              entityId: ticket.id,
              actionUrl: '/it-director/tickets',
            });
          }
        }
        logger.info(`SLA fast-check: ${newlyBreachedTickets.length} newly breached tickets detected`);
      }
    } catch (err) {
      logger.error('SLA fast-check error', { error: err });
    }
  };
  slaFastInterval = setInterval(checkSLAFast, 5 * 60 * 1000);
  
  function scheduleWeeklyReports() {
    const now = new Date();
    const nextSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(7, 0, 0, 0);
    let msUntil = nextSunday.getTime() - now.getTime();
    if (msUntil <= 0) {
      nextSunday.setDate(nextSunday.getDate() + 7);
      msUntil = nextSunday.getTime() - now.getTime();
    }
    setTimeout(() => {
      sendWeeklyReports();
      setInterval(sendWeeklyReports, 7 * 24 * 60 * 60 * 1000);
    }, msUntil);
    logger.info(`Weekly reports scheduled: next run in ${Math.round(msUntil / 3600000)}h`);
  }
  scheduleWeeklyReports();

  logger.info('Notification scheduler started (every 10 min + SLA fast-check every 5 min) — primary instance only');
}

export function stopNotificationScheduler() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  if (slaFastInterval) {
    clearInterval(slaFastInterval);
    slaFastInterval = null;
  }
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    urgent: 'عاجلة',
    critical: 'حرجة',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
  };
  return labels[priority] || priority;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'مفتوح',
    in_progress: 'قيد التنفيذ',
    pending: 'معلق',
    resolved: 'تم الحل',
    closed: 'مغلق',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    on_hold: 'معلق',
    planning: 'تخطيط',
    active: 'نشط',
  };
  return labels[status] || status;
}
