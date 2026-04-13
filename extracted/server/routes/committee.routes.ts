import type { Express } from "express";
import {
  storage, db, parseId, handleDbError, invalidateDashboardCaches,
  authenticateToken, sanitizeObject, stripProtectedFields,
  requireCommitteeRole, COMMITTEE_WRITE_ROLES, COMMITTEE_READ_ROLES, COMMITTEE_ADMIN_ROLES,
  requireDelete, RESOURCES,
  committeeDecisions, committeeMembers, decisionVotes, votingSessions, notifications, users,
  eq, and, sql, isNull, desc,
} from './shared';
import { logger } from '../security-middleware';

const SECRETARY_ROLES = ['system_admin', 'admin', 'committee_rapporteur', 'committee_specialist'];
const CHAIRMAN_ROLES = ['system_admin', 'admin', 'committee_chairman'];

async function notifyCommitteeMembers(opts: {
  excludeUserId?: number;
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: number;
  roleFilter?: string[];
}) {
  try {
    const members = await db.select({
      id: committeeMembers.id,
      userId: committeeMembers.userId,
      committeeRole: committeeMembers.committeeRole,
      isActive: committeeMembers.isActive,
    }).from(committeeMembers).where(eq(committeeMembers.isActive, true));

    const targetMembers = opts.roleFilter
      ? members.filter((m: any) => opts.roleFilter!.includes(m.committeeRole))
      : members;

    for (const member of targetMembers) {
      if (!member.userId || member.userId === opts.excludeUserId) continue;

      const existing = await db.select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, member.userId),
            eq(notifications.type, opts.type),
            opts.entityId ? eq(notifications.entityId, opts.entityId) : undefined,
            eq(notifications.isRead, false)
          )
        ).limit(1);
      if (existing.length > 0) continue;

      await db.insert(notifications).values({
        userId: member.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        priority: opts.priority || 'normal',
        actionUrl: opts.actionUrl || '/committee/decisions',
        entityType: opts.entityType || 'committee_decision',
        entityId: opts.entityId,
      });
    }
  } catch (error) {
    logger.error('Error sending committee notifications:', { error });
  }
}

export function registerCommitteeRoutes(app: Express) {

  app.get("/api/committee/members", authenticateToken, async (req, res) => {
    try {
      const members = await storage.getCommitteeMembers();
      res.json(members);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.get("/api/committee/decisions", authenticateToken, async (req, res) => {
    try {
      const creator = db.select({ id: users.id, name: users.name }).from(users).as('cd_creator');
      const decisions = await db.select({
        id: committeeDecisions.id,
        decisionNumber: committeeDecisions.decisionNumber,
        title: committeeDecisions.title,
        description: committeeDecisions.description,
        status: committeeDecisions.status,
        category: committeeDecisions.category,
        priority: committeeDecisions.priority,
        meetingId: committeeDecisions.meetingId,
        votesFor: committeeDecisions.votesFor,
        votesAgainst: committeeDecisions.votesAgainst,
        votesAbstain: committeeDecisions.votesAbstain,
        votingDeadline: committeeDecisions.votingDeadline,
        implementationDeadline: committeeDecisions.implementationDeadline,
        implementationStatus: committeeDecisions.implementationStatus,
        rejectionReason: committeeDecisions.rejectionReason,
        assignedTo: committeeDecisions.assignedTo,
        attachments: committeeDecisions.attachments,
        createdBy: committeeDecisions.createdBy,
        createdByName: creator.name,
        createdAt: committeeDecisions.createdAt,
        updatedAt: committeeDecisions.updatedAt,
      }).from(committeeDecisions)
        .leftJoin(creator, eq(committeeDecisions.createdBy, creator.id))
        .where(isNull(committeeDecisions.deletedAt))
        .orderBy(desc(committeeDecisions.createdAt));
      res.json(decisions);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.get("/api/committee/meetings", authenticateToken, async (req, res) => {
    try {
      const meetings = await storage.getCommitteeMeetings() as any[];
      if (meetings.length > 0) {
        const creatorIds = [...new Set(meetings.map((m: any) => m.createdBy).filter(Boolean))];
        if (creatorIds.length > 0) {
          const creators = await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} IN ${creatorIds}`);
          const nameMap = Object.fromEntries(creators.map(c => [c.id, c.name]));
          for (const m of meetings) {
            (m as any).createdByName = nameMap[m.createdBy] || null;
          }
        }
      }
      res.json(meetings);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.get("/api/committee/meetings/upcoming", authenticateToken, async (req, res) => {
    try {
      const meetings = await storage.getUpcomingMeetings();
      res.json(meetings);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.post("/api/committee/members", authenticateToken, requireCommitteeRole(COMMITTEE_ADMIN_ROLES), async (req: any, res) => {
    try {
      const data = sanitizeObject(req.body);
      if (data.email) {
        const existing = await db.select({ id: committeeMembers.id })
          .from(committeeMembers)
          .where(eq(committeeMembers.email, data.email.trim().toLowerCase()))
          .limit(1);
        if (existing.length > 0) {
          return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجّل مسبقاً في اللجنة' });
        }
      }
      const member = await storage.createCommitteeMember(data);
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create',
        entityType: 'committee_member',
        entityId: member.id,
        oldValue: null,
        newValue: member,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: 'إضافة عضو لجنة جديد',
      });
      invalidateDashboardCaches();
      res.status(201).json(member);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجّل مسبقاً في اللجنة' });
      }
      handleDbError(error, res, 'إضافة عضو اللجنة');
    }
  });

  app.post("/api/committee/decisions", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const year = new Date().getFullYear();
      const prefix = `DEC-${year}-`;
      let nextNum = 1;
      try {
        const maxResult = await db.execute(sql`
          SELECT COALESCE(MAX(
            CASE WHEN SPLIT_PART(decision_number, '-', 3) ~ '^\d+$'
                 THEN CAST(SPLIT_PART(decision_number, '-', 3) AS INTEGER)
                 ELSE 0 END
          ), 0) AS max_num
          FROM committee_decisions
          WHERE decision_number LIKE ${prefix + '%'}
        `);
        const row = (maxResult as any).rows?.[0] || (maxResult as any)[0];
        nextNum = (Number(row?.max_num) || 0) + 1;
      } catch (seqErr) {
        logger.warn('[Committee] Decision number sequence query failed, using fallback', { error: (seqErr as Error).message });
        const allDecs = await storage.getCommitteeDecisions();
        nextNum = allDecs.length + 1;
      }
      const { title, description, decisionType, type, priority, meetingId, votingDeadline, implementationDeadline, effectiveDate, assignedTo, attachments } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'عنوان القرار مطلوب' });
      }
      const deadlineValue = implementationDeadline || effectiveDate;
      const decisionData = {
        decisionNumber: req.body.decisionNumber || `DEC-${year}-${String(nextNum).padStart(4, '0')}`,
        title,
        description: description || null,
        category: decisionType || type || 'general',
        priority: priority || 'medium',
        status: 'draft',
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        meetingId: meetingId && !isNaN(parseInt(meetingId)) ? parseInt(meetingId) : null,
        votingDeadline: votingDeadline ? new Date(votingDeadline) : null,
        implementationDeadline: deadlineValue ? new Date(deadlineValue) : null,
        implementationStatus: null,
        assignedTo: assignedTo || null,
        attachments: Array.isArray(attachments) ? attachments : [],
        createdBy: req.user.id,
      };
      const decision = await storage.createCommitteeDecision(decisionData as any);
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'create',
        entityType: 'committee_decision',
        entityId: decision.id,
        oldValue: null,
        newValue: decision,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: 'إنشاء قرار لجنة جديد',
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_decision_created',
        title: 'قرار جديد',
        message: `تم إنشاء قرار جديد: ${title}`,
        priority: priority === 'urgent' || priority === 'critical' || priority === 'high' ? 'high' : 'normal',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: decision.id,
      });

      invalidateDashboardCaches();
      res.status(201).json(decision);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.patch("/api/committee/decisions/:id/submit", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const oldDecision = await storage.getCommitteeDecisionById(id);
      if (!oldDecision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (oldDecision.status !== 'draft') {
        return res.status(400).json({ error: 'لا يمكن تقديم قرار إلا إذا كان مسودة' });
      }
      const decision = await storage.updateCommitteeDecision(id, {
        status: 'pending_review',
        updatedAt: new Date(),
      });
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'submit_for_review',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify({ status: 'draft' }),
        newValue: JSON.stringify({ status: 'pending_review' }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `تقديم القرار "${oldDecision.title}" للمراجعة`,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_decision_submitted',
        title: 'قرار بانتظار المراجعة',
        message: `تم تقديم القرار "${oldDecision.title}" للمراجعة من قبل رئيس اللجنة`,
        priority: 'high',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
        roleFilter: ['chairman', 'vice_chairman'],
      });

      invalidateDashboardCaches();
      res.json(decision);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في تقديم القرار' });
    }
  });

  app.patch("/api/committee/decisions/:id/send-to-voting", authenticateToken, requireCommitteeRole(CHAIRMAN_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const oldDecision = await storage.getCommitteeDecisionById(id);
      if (!oldDecision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['pending_review', 'pending', 'review'].includes(oldDecision.status)) {
        return res.status(400).json({ error: 'القرار ليس في حالة تسمح بإرساله للتصويت' });
      }

      const { votingDeadline } = req.body;

      const [votingSession] = await db.insert(votingSessions).values({
        title: oldDecision.title,
        description: oldDecision.description || '',
        category: oldDecision.category,
        votingType: 'majority',
        status: 'active',
        startDate: new Date(),
        endDate: votingDeadline ? new Date(votingDeadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        quorumRequired: 50,
        createdBy: req.user.id,
      }).returning();

      const decision = await storage.updateCommitteeDecision(id, {
        status: 'voting',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        votingSessionId: votingSession.id,
        votingDeadline: votingDeadline ? new Date(votingDeadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        updatedAt: new Date(),
      });

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'send_to_voting',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify({ status: oldDecision.status }),
        newValue: JSON.stringify({ status: 'voting', votingSessionId: votingSession.id }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إرسال القرار "${oldDecision.title}" للتصويت`,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_voting_started',
        title: 'تصويت جديد',
        message: `تم فتح التصويت على القرار: "${oldDecision.title}" - يرجى التصويت`,
        priority: 'high',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
      });

      invalidateDashboardCaches();
      res.json(decision);
    } catch (error) {
      logger.error('Error sending decision to voting:', { error });
      res.status(500).json({ error: 'حدث خطأ في إرسال القرار للتصويت' });
    }
  });

  app.post("/api/committee/decisions/:id/vote", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const { vote, comments } = req.body;
      if (!vote || !['approve', 'reject', 'abstain'].includes(vote)) {
        return res.status(400).json({ error: 'قيمة التصويت غير صالحة' });
      }

      const decision = await storage.getCommitteeDecisionById(id);
      if (!decision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (decision.status !== 'voting') {
        return res.status(400).json({ error: 'التصويت غير مفتوح لهذا القرار' });
      }

      let [member] = await db.select().from(committeeMembers)
        .where(and(
          eq(committeeMembers.userId, req.user.id),
          eq(committeeMembers.isActive, true)
        )).limit(1);

      if (!member && ['system_admin'].includes(req.user.role)) {
        const [newMember] = await db.insert(committeeMembers).values({
          userId: req.user.id,
          name: req.user.fullName || req.user.name || req.user.email || 'مدير النظام',
          email: req.user.email || 'admin@system',
          committeeRole: 'chairman',
          isActive: true,
          canVote: true,
          canApprove: true,
        }).returning();
        member = newMember;
      }

      if (!member) {
        return res.status(403).json({ error: 'ليس لديك صلاحية التصويت — لست عضواً في اللجنة' });
      }

      if (!member.canVote) {
        return res.status(403).json({ error: 'ليس لديك صلاحية التصويت' });
      }

      const memberId = member.id;

      const existingVotes = await db.select().from(decisionVotes)
        .where(and(
          eq(decisionVotes.decisionId, id),
          eq(decisionVotes.memberId, memberId)
        ));

      if (existingVotes.length > 0) {
        return res.status(400).json({ error: 'لقد قمت بالتصويت مسبقاً على هذا القرار' });
      }

      try {
        await db.insert(decisionVotes).values({
          decisionId: id,
          votingSessionId: decision.votingSessionId || null,
          memberId,
          vote,
          comments: comments || null,
        });
      } catch (insertErr: any) {
        if (insertErr?.code === '23505') {
          return res.status(400).json({ error: 'لقد قمت بالتصويت مسبقاً على هذا القرار' });
        }
        throw insertErr;
      }

      const field = vote === 'approve' ? 'votes_for' : vote === 'reject' ? 'votes_against' : 'votes_abstain';
      await db.execute(sql`UPDATE committee_decisions SET ${sql.identifier(field)} = ${sql.identifier(field)} + 1, updated_at = NOW() WHERE id = ${id}`);

      if (decision.votingSessionId) {
        const vsField = vote === 'approve' ? 'votes_for' : vote === 'reject' ? 'votes_against' : 'votes_abstain';
        await db.execute(sql`UPDATE voting_sessions SET ${sql.identifier(vsField)} = ${sql.identifier(vsField)} + 1, updated_at = NOW() WHERE id = ${decision.votingSessionId}`);
      }

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'vote',
        entityType: 'committee_decision',
        entityId: id,
        details: `تصويت "${vote}" على القرار: ${decision.title}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_vote_cast',
        title: 'تصويت جديد',
        message: `تم تسجيل تصويت جديد على القرار: "${decision.title}"`,
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
        roleFilter: ['chairman', 'vice_chairman'],
      });

      invalidateDashboardCaches();
      res.json({ success: true, vote });
    } catch (error) {
      logger.error('Error casting vote on decision:', { error });
      res.status(500).json({ error: 'حدث خطأ في التصويت' });
    }
  });

  app.get("/api/committee/decisions/:id/votes", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const votes = await db.select({
        id: decisionVotes.id,
        memberId: decisionVotes.memberId,
        vote: decisionVotes.vote,
        comments: decisionVotes.comments,
        votedAt: decisionVotes.votedAt,
        memberName: committeeMembers.name,
        memberRole: committeeMembers.committeeRole,
      })
        .from(decisionVotes)
        .leftJoin(committeeMembers, eq(decisionVotes.memberId, committeeMembers.id))
        .where(eq(decisionVotes.decisionId, id))
        .orderBy(desc(decisionVotes.votedAt));
      res.json(votes);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في جلب نتائج التصويت' });
    }
  });

  app.get("/api/committee/decisions/:id/my-vote", authenticateToken, async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;

      const [member] = await db.select().from(committeeMembers)
        .where(and(
          eq(committeeMembers.userId, req.user.id),
          eq(committeeMembers.isActive, true)
        )).limit(1);

      const memberId = member ? member.id : req.user.id;

      const [vote] = await db.select().from(decisionVotes)
        .where(and(
          eq(decisionVotes.decisionId, id),
          eq(decisionVotes.memberId, memberId)
        )).limit(1);

      res.json({ voted: !!vote, vote: vote?.vote || null });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ' });
    }
  });

  app.patch("/api/committee/decisions/:id/chairman-approve", authenticateToken, requireCommitteeRole(CHAIRMAN_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const oldDecision = await storage.getCommitteeDecisionById(id);
      if (!oldDecision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (oldDecision.status !== 'voting') {
        return res.status(400).json({ error: 'لا يمكن اعتماد قرار إلا بعد مرحلة التصويت' });
      }

      const decision = await storage.updateCommitteeDecision(id, {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      });

      if (oldDecision.votingSessionId) {
        await db.update(votingSessions).set({
          status: 'closed',
          result: 'approved',
          updatedAt: new Date(),
        } as any).where(eq(votingSessions.id, oldDecision.votingSessionId));
      }

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'approve',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify({ status: 'voting' }),
        newValue: JSON.stringify({ status: 'approved' }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `اعتماد القرار "${oldDecision.title}" من رئيس اللجنة`,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_decision_approved',
        title: 'تم اعتماد القرار',
        message: `تم اعتماد القرار "${oldDecision.title}" من قبل رئيس اللجنة`,
        priority: 'high',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
      });

      invalidateDashboardCaches();
      res.json(decision);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في اعتماد القرار' });
    }
  });

  app.patch("/api/committee/decisions/:id/chairman-reject", authenticateToken, requireCommitteeRole(CHAIRMAN_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const oldDecision = await storage.getCommitteeDecisionById(id);
      if (!oldDecision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (!['pending_review', 'pending', 'review', 'voting'].includes(oldDecision.status)) {
        return res.status(400).json({ error: 'لا يمكن رفض هذا القرار في حالته الحالية' });
      }

      const { rejectionReason } = req.body;
      const decision = await storage.updateCommitteeDecision(id, {
        status: 'rejected',
        rejectionReason: rejectionReason || null,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      });

      if (oldDecision.votingSessionId) {
        await db.update(votingSessions).set({
          status: 'closed',
          result: 'rejected',
          updatedAt: new Date(),
        } as any).where(eq(votingSessions.id, oldDecision.votingSessionId));
      }

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'reject',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify({ status: oldDecision.status }),
        newValue: JSON.stringify({ status: 'rejected', rejectionReason }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `رفض القرار "${oldDecision.title}": ${rejectionReason || 'بدون سبب'}`,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_decision_rejected',
        title: 'تم رفض القرار',
        message: `تم رفض القرار "${oldDecision.title}" من قبل رئيس اللجنة${rejectionReason ? ': ' + rejectionReason : ''}`,
        priority: 'high',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
      });

      invalidateDashboardCaches();
      res.json(decision);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في رفض القرار' });
    }
  });

  app.put("/api/committee/decisions/:id", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const oldDecision = await storage.getCommitteeDecisionById(id);
      if (!oldDecision) return res.status(404).json({ error: 'القرار غير موجود' });

      const lockedStatuses = ['approved', 'finalized', 'implemented'];
      if (lockedStatuses.includes(oldDecision.status)) {
        const isAdmin = req.user?.role === 'system_admin';
        if (!isAdmin) {
          return res.status(403).json({ 
            error: `لا يمكن تعديل قرار بحالة "${oldDecision.status}". القرارات المعتمدة لا تُعدَّل إلا من مدير النظام.` 
          });
        }
      }

      const WORKFLOW_FIELDS = ['status', 'reviewedBy', 'reviewedAt', 'approvedBy', 'approvedAt', 
        'rejectionReason', 'votingSessionId', 'votesFor', 'votesAgainst', 'votesAbstain',
        'votes_for', 'votes_against', 'votes_abstain'];
      const sanitized = stripProtectedFields(req.body);
      for (const f of WORKFLOW_FIELDS) delete sanitized[f];
      if (sanitized.effectiveDate) {
        sanitized.implementationDeadline = new Date(sanitized.effectiveDate);
        delete sanitized.effectiveDate;
      }
      if (sanitized.decisionType) {
        sanitized.category = sanitized.decisionType;
        delete sanitized.decisionType;
      }
      const decision = await storage.updateCommitteeDecision(id, sanitized);
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'update',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify(oldDecision),
        newValue: JSON.stringify(decision),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: 'تحديث قرار اللجنة',
      });
      invalidateDashboardCaches();
      res.json(decision);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

  app.post("/api/committee/decisions/:id/attachments", authenticateToken, requireCommitteeRole(COMMITTEE_READ_ROLES), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const decision = await storage.getCommitteeDecisionById(id);
      if (!decision) return res.status(404).json({ error: 'القرار غير موجود' });
      if (decision.deletedAt) return res.status(404).json({ error: 'القرار غير موجود' });

      const { attachments: newFiles } = req.body;
      if (!Array.isArray(newFiles) || newFiles.length === 0) {
        return res.status(400).json({ error: 'يرجى إرفاق ملف واحد على الأقل' });
      }

      if (newFiles.length > 10) {
        return res.status(400).json({ error: 'الحد الأقصى 10 مرفقات في كل مرة' });
      }

      const DANGEROUS_URL = /^(javascript|data|vbscript):/i;
      for (const file of newFiles) {
        if (!file || typeof file !== 'object') {
          return res.status(400).json({ error: 'بيانات مرفق غير صالحة' });
        }
        if (!file.name || typeof file.name !== 'string' || file.name.length > 500) {
          return res.status(400).json({ error: 'اسم الملف مطلوب ويجب ألا يتجاوز 500 حرف' });
        }
        if (!file.url || typeof file.url !== 'string' || file.url.length > 2000) {
          return res.status(400).json({ error: 'رابط الملف مطلوب ويجب ألا يتجاوز 2000 حرف' });
        }
        if (DANGEROUS_URL.test(file.url.trim())) {
          return res.status(400).json({ error: 'رابط الملف غير مسموح' });
        }
        if (typeof file.size !== 'number' || file.size <= 0 || file.size > 100 * 1024 * 1024) {
          return res.status(400).json({ error: 'حجم الملف غير صالح' });
        }
        if (!file.type || typeof file.type !== 'string' || file.type.length > 200) {
          return res.status(400).json({ error: 'نوع الملف مطلوب' });
        }
      }

      const existing = Array.isArray(decision.attachments) ? decision.attachments : [];
      if (existing.length + newFiles.length > 50) {
        return res.status(400).json({ error: 'تجاوز الحد الأقصى لعدد المرفقات (50 مرفق)' });
      }
      const sanitizedFiles = newFiles.map((f: any) => ({
        name: String(f.name).slice(0, 500),
        url: String(f.url).slice(0, 2000),
        size: Number(f.size),
        type: String(f.type).slice(0, 200),
        uploadedAt: f.uploadedAt || new Date().toISOString(),
        uploadedBy: f.uploadedBy || req.user?.name || null,
      }));
      const merged = [...existing, ...sanitizedFiles];
      const updated = await storage.updateCommitteeDecision(id, { attachments: merged });

      await storage.createAuditLog({
        userId: req.user.id,
        action: 'update',
        entityType: 'committee_decision',
        entityId: id,
        oldValue: JSON.stringify({ attachments: existing }),
        newValue: JSON.stringify({ attachments: merged }),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: `إضافة ${newFiles.length} مرفق للقرار ${decision.decisionNumber}`,
      });

      await notifyCommitteeMembers({
        excludeUserId: req.user.id,
        type: 'committee_attachment_added',
        title: 'مرفق جديد',
        message: `تم إضافة مرفق جديد للقرار: ${decision.title}`,
        priority: 'normal',
        actionUrl: '/committee/decisions',
        entityType: 'committee_decision',
        entityId: id,
      });

      invalidateDashboardCaches();
      res.json(updated);
    } catch (error) {
      logger.error('[Committee] Error adding attachments:', { error });
      res.status(500).json({ error: 'حدث خطأ في إضافة المرفقات' });
    }
  });

  app.delete("/api/committee/decisions/:id", authenticateToken, requireDelete(RESOURCES.COMMITTEE_DECISIONS), async (req: any, res) => {
    try {
      const id = parseId(req.params.id, res);
      if (!id) return;
      const [existing] = await db.select({ id: committeeDecisions.id, status: committeeDecisions.status, title: committeeDecisions.title })
        .from(committeeDecisions).where(eq(committeeDecisions.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'القرار غير موجود' });
      }
      const protectedStatuses = ['approved', 'implemented', 'finalized'];
      if (protectedStatuses.includes(existing.status)) {
        return res.status(409).json({ error: `لا يمكن حذف قرار بحالة "${existing.status}". يجب أن يكون القرار مسودة أو مرفوضاً` });
      }
      await db.update(committeeDecisions).set({ deletedAt: new Date() }).where(eq(committeeDecisions.id, id));
      await storage.createAuditLog({
        userId: req.user?.id,
        action: 'delete',
        entityType: 'committee_decision',
        entityId: id,
        details: `حذف قرار اللجنة: ${existing.title}`,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        oldValue: JSON.stringify(existing),
        newValue: null,
      });
      invalidateDashboardCaches();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في حذف القرار' });
    }
  });

  app.post("/api/committee/meetings", authenticateToken, requireCommitteeRole(COMMITTEE_WRITE_ROLES), async (req, res) => {
    try {
      const mtgYear = new Date().getFullYear();
      const mtgPrefix = `MTG-${mtgYear}-`;
      let nextMtgNum = 1;
      try {
        const maxMtgResult = await db.execute(sql`
          SELECT COALESCE(MAX(
            CASE WHEN SPLIT_PART(meeting_number, '-', 3) ~ '^\d+$'
                 THEN CAST(SPLIT_PART(meeting_number, '-', 3) AS INTEGER)
                 ELSE 0 END
          ), 0) AS max_num
          FROM committee_meetings
          WHERE meeting_number LIKE ${mtgPrefix + '%'}
        `);
        const mtgRow = (maxMtgResult as any).rows?.[0] || (maxMtgResult as any)[0];
        nextMtgNum = (Number(mtgRow?.max_num) || 0) + 1;
      } catch (seqErr) {
        logger.warn('[Committee] Meeting number sequence query failed, using fallback', { error: (seqErr as Error).message });
        const allMeetings = await storage.getCommitteeMeetings();
        nextMtgNum = allMeetings.length + 1;
      }
      const meetingData = {
        ...req.body,
        meetingNumber: req.body.meetingNumber || `MTG-${mtgYear}-${String(nextMtgNum).padStart(4, '0')}`,
        scheduledDate: new Date(req.body.scheduledDate || req.body.date),
        createdBy: (req as any).user.id,
      };
      const meeting = await storage.createCommitteeMeeting(meetingData);
      await storage.createAuditLog({
        userId: (req as any).user.id,
        action: 'create',
        entityType: 'committee_meeting',
        entityId: meeting.id,
        oldValue: null,
        newValue: meeting,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        details: 'إنشاء اجتماع لجنة جديد',
      });

      await notifyCommitteeMembers({
        excludeUserId: (req as any).user.id,
        type: 'committee_meeting_created',
        title: 'اجتماع جديد',
        message: `تم جدولة اجتماع جديد: ${meeting.title}`,
        actionUrl: '/committee',
        entityType: 'committee_meeting',
        entityId: meeting.id,
      });

      invalidateDashboardCaches();
      res.status(201).json(meeting);
    } catch (error) {
      handleDbError(error, res, 'العملية');
    }
  });

}
