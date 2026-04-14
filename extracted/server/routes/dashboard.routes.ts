import type { Express } from "express";
import {
  storage, db, logger, cache, TTL, authenticateToken,
  sql, eq, and, or, isNull, notInArray,
  itTickets, itProjects, tasks, externalSystems, notifications,
  securityThreats, securityVulnerabilities, securityIncidents,
  knowledgeBase, users, itReferrals, committeeDecisions, meetingMinutes,
  plannerTasks, plannerBoards, escalations,
  requirePortalAndPermission, RESOURCES, ACTIONS,
  PORTAL_TO_DEPT_ID, dataSubjectRequests, slaBreaches,
} from "./shared";

export function registerDashboardRoutes(app: Express) {
  // ==================== Governance Score API ====================

  app.get("/api/governance/score", authenticateToken, async (req: any, res) => {
    try {
      const cached = cache.get<any>('governance_score');
      if (cached) return res.json(cached);

      const [ticketCounts, taskCounts, logs] = await Promise.all([
        db.execute(sql`
          SELECT
            count(*)::int as total,
            count(*) FILTER (WHERE status IN ('closed', 'resolved'))::int as closed,
            count(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed', 'resolved'))::int as sla_breaches
          FROM it_tickets
        `),
        db.execute(sql`
          SELECT
            count(*)::int as total,
            count(*) FILTER (WHERE status IN ('completed', 'archived'))::int as completed,
            count(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'archived', 'cancelled') AND due_date IS NOT NULL)::int as overdue
          FROM tasks WHERE deleted_at IS NULL
        `),
        storage.getAuditLogs(500),
      ]);

      const ticketRow = (ticketCounts as any).rows?.[0] || ticketCounts[0] || { total: 1, closed: 0, sla_breaches: 0 };
      const taskRow = (taskCounts as any).rows?.[0] || taskCounts[0] || { total: 1, completed: 0, overdue: 0 };

      const totalTickets = Number(ticketRow.total) || 1;
      const closedTickets = Number(ticketRow.closed) || 0;
      const slaBreaches = Number(ticketRow.sla_breaches) || 0;

      const totalTasks = Number(taskRow.total) || 1;
      const completedTasks = Number(taskRow.completed) || 0;
      const overdueTasks = Number(taskRow.overdue) || 0;

      const operationalScore = Math.round(((closedTickets / totalTickets) * 50) + ((completedTasks / totalTasks) * 50));
      const securityScore = Math.max(0, Math.round(100 - (slaBreaches * 5)));
      const baseCompliance = Math.round(((completedTasks / totalTasks) * 40) + ((closedTickets / totalTickets) * 30) + (overdueTasks === 0 ? 30 : Math.max(0, 30 - overdueTasks * 3)));
      const complianceRate = Math.min(100, Math.max(0, baseCompliance));
      const riskScore = Math.min(100, Math.round(overdueTasks * 3 + slaBreaches * 5));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayLogs = logs.filter((l: any) => new Date(l.createdAt) >= todayStart);
      const activitySource = todayLogs.length >= 3 ? todayLogs : logs.slice(0, 15);

      const recentActivities = activitySource.slice(0, 15).map((log: any, i: number) => {
        const actionMap: Record<string, string> = {
          login: 'سجل دخول',
          logout: 'سجل خروج',
          create: 'أنشأ',
          update: 'عدّل',
          delete: 'حذف',
          view: 'اطّلع على',
        };
        const typeMap: Record<string, string> = {
          login: 'login',
          logout: 'login',
          create: 'create',
          update: 'update',
          delete: 'delete',
          view: 'update',
        };
        const entityLabels: Record<string, string> = {
          user: 'مستخدم',
          ticket: 'تذكرة',
          task: 'مهمة',
          project: 'مشروع',
          session: 'جلسة',
        };

        const date = new Date(log.createdAt);
        const now = new Date();
        const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
        let timeStr = 'الآن';
        if (diffMin >= 60) timeStr = `منذ ${Math.floor(diffMin / 60)} ساعة`;
        else if (diffMin > 0) timeStr = `منذ ${diffMin} دقيقة`;

        return {
          id: log.id || i,
          user: log.details?.includes('@') ? log.details.split(' ')[0] : 'مستخدم',
          action: actionMap[log.action] || log.action,
          target: entityLabels[log.entityType || ''] || log.entityType || 'عنصر',
          time: timeStr,
          type: typeMap[log.action] || 'update',
          portal: log.resource || '',
        };
      });

      const result = {
        overallScore: Math.round((complianceRate + securityScore + operationalScore + (100 - riskScore)) / 4),
        complianceRate,
        securityScore,
        operationalScore,
        riskScore,
        metrics: {
          totalTickets,
          closedTickets,
          slaBreaches,
          totalTasks,
          completedTasks,
          overdueTasks,
          todayActivities: todayLogs.length,
        },
        recentActivities,
        riskMatrix: [
          { likelihood: 1, impact: 1, count: Math.max(0, 2 - slaBreaches) },
          { likelihood: 1, impact: 2, count: Math.min(3, overdueTasks) },
          { likelihood: 1, impact: 3, count: 0 },
          { likelihood: 2, impact: 1, count: Math.min(2, Math.floor(overdueTasks / 2)) },
          { likelihood: 2, impact: 2, count: Math.min(3, slaBreaches) },
          { likelihood: 2, impact: 3, count: Math.min(1, Math.floor(slaBreaches / 3)) },
          { likelihood: 3, impact: 1, count: 1 },
          { likelihood: 3, impact: 2, count: Math.min(2, Math.floor(slaBreaches / 2)) },
          { likelihood: 3, impact: 3, count: Math.min(1, Math.floor(slaBreaches / 5)) },
        ],
      };
      cache.set('governance_score', result, TTL.GOVERNANCE_SCORE);
      res.json(result);
    } catch (error) {
      logger.error('Governance score error:', { error });
      res.status(500).json({ error: 'حدث خطأ في حساب مؤشر الحوكمة' });
    }
  });

  // ==================== Dashboard Stats Routes ====================
  
  app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
      const cached = cache.get<any>('dashboard_stats');
      if (cached) return res.json(cached);

      const stats = await storage.getDashboardStats();
      cache.set('dashboard_stats', stats, TTL.DASHBOARD_STATS);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/admin-charts", authenticateToken, requirePortalAndPermission(['admin'], RESOURCES.AUDIT_LOGS as any, ACTIONS.VIEW as any), async (req, res) => {
    try {
      const cached = cache.get<any>('admin_charts');
      if (cached) return res.json(cached);

      const logs = await storage.getAuditLogs(1000);
      
      const actionCounts: Record<string, number> = {};
      logs.forEach(log => {
        const action = log.action || 'other';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      });
      
      const actionLabels: Record<string, string> = {
        login: 'تسجيل دخول',
        logout: 'تسجيل خروج',
        create: 'إنشاء',
        update: 'تعديل',
        delete: 'حذف',
        view: 'عرض',
      };
      
      const auditLogsByType = Object.entries(actionCounts).map(([action, count]) => ({
        type: actionLabels[action] || action,
        count
      })).sort((a, b) => b.count - a.count).slice(0, 6);
      
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const monthlyLogins: Record<string, { logins: number; newUsers: number }> = {};
      
      const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const monthName = arabicMonths[date.getMonth()];
        monthlyLogins[monthName] = { logins: 0, newUsers: 0 };
      }
      
      logs.forEach(log => {
        const logDate = new Date(log.createdAt);
        if (logDate >= sixMonthsAgo) {
          const monthName = arabicMonths[logDate.getMonth()];
          if (monthlyLogins[monthName]) {
            if (log.action === 'login') {
              monthlyLogins[monthName].logins++;
            }
            if (log.action === 'create' && log.entityType === 'user') {
              monthlyLogins[monthName].newUsers++;
            }
          }
        }
      });
      
      const userActivityData = Object.entries(monthlyLogins).map(([month, data]) => ({
        month,
        logins: data.logins,
        newUsers: data.newUsers
      }));
      
      const result = { auditLogsByType, userActivityData };
      cache.set('admin_charts', result, TTL.ADMIN_CHARTS);
      res.json(result);
    } catch (error) {
      logger.error('Admin charts error:', { error });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/it-director", authenticateToken, async (req: any, res) => {
    try {
      const allowedRoles = ['system_admin', 'admin', 'it_director'];
      if (!allowedRoles.includes(req.user?.role)) {
        return res.status(403).json({ error: 'غير مصرح لك بالوصول لهذه البيانات' });
      }
      const cached = cache.get<any>('it_director_stats');
      if (cached) return res.json(cached);

      const stats = await storage.getITDirectorStats();
      cache.set('it_director_stats', stats, TTL.DASHBOARD_STATS);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/cybersecurity", authenticateToken, async (req, res) => {
    try {
      const cached = cache.get<any>('cybersecurity_stats');
      if (cached) return res.json(cached);

      const stats = await storage.getCybersecurityStats();
      cache.set('cybersecurity_stats', stats, TTL.DASHBOARD_STATS);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/navigation/metrics", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const cacheKey = `nav_metrics_${userId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const [
        allTasks, allTickets, pendingApprovals,
        unreadNotifications, activeThreats,
        openVulnerabilities, activeIncidents,
        pendingProjects, openEscalations
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(
          isNull(tasks.deletedAt),
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'assigned'), eq(tasks.status, 'in_progress'))
        )),
        db.select({ count: sql<number>`count(*)` }).from(itTickets).where(
          or(eq(itTickets.status, 'open'), eq(itTickets.status, 'in_progress'), eq(itTickets.status, 'assigned'))
        ),
        db.select({ count: sql<number>`count(*)` }).from(externalSystems).where(eq(externalSystems.approvalStatus, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
        db.select({ count: sql<number>`count(*)` }).from(securityThreats).where(or(eq(securityThreats.status, 'active'), eq(securityThreats.status, 'investigating'))),
        db.select({ count: sql<number>`count(*)` }).from(securityVulnerabilities).where(or(eq(securityVulnerabilities.status, 'open'), eq(securityVulnerabilities.status, 'in_progress'))),
        db.select({ count: sql<number>`count(*)` }).from(securityIncidents).where(or(eq(securityIncidents.status, 'open'), eq(securityIncidents.status, 'investigating'))),
        db.select({ count: sql<number>`count(*)` }).from(itProjects).where(or(eq(itProjects.status, 'planning'), eq(itProjects.status, 'in_progress'))),
        db.select({ count: sql<number>`count(*)` }).from(escalations).where(eq(escalations.status, 'pending'))
      ]);

      const navResult = {
        tasks: { pending: Number(allTasks[0]?.count || 0) },
        tickets: { open: Number(allTickets[0]?.count || 0) },
        approvals: { pending: Number(pendingApprovals[0]?.count || 0) },
        notifications: { unread: Number(unreadNotifications[0]?.count || 0) },
        security: {
          threats: Number(activeThreats[0]?.count || 0),
          vulnerabilities: Number(openVulnerabilities[0]?.count || 0),
          incidents: Number(activeIncidents[0]?.count || 0)
        },
        projects: { active: Number(pendingProjects[0]?.count || 0) },
        escalations: { pending: Number(openEscalations[0]?.count || 0) }
      };
      cache.set(cacheKey, navResult, TTL.NAVIGATION_METRICS);
      res.json(navResult);
    } catch (error) {
      logger.error('Nav metrics error:', { error: (error as Error).message });
      res.json({
        tasks: { pending: 0 },
        tickets: { open: 0 },
        approvals: { pending: 0 },
        notifications: { unread: 0 },
        security: { threats: 0, vulnerabilities: 0, incidents: 0 },
        projects: { active: 0 },
        escalations: { pending: 0 }
      });
    }
  });

  app.get("/api/dashboard/infrastructure", authenticateToken, async (req: any, res) => {
    try {
      const deptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || 9;
      const cacheKey = `infrastructure_stats_${deptId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM infrastructure_servers) as total_servers,
          (SELECT count(*) FROM infrastructure_servers WHERE status = 'online') as online_servers,
          (SELECT count(*) FROM infrastructure_servers WHERE status = 'offline') as offline_servers,
          (SELECT count(*) FROM infrastructure_servers WHERE status = 'maintenance') as maint_servers,
          (SELECT count(*) FROM infrastructure_networks) as total_networks,
          (SELECT count(*) FROM infrastructure_networks WHERE status = 'active') as active_networks,
          (SELECT count(*) FROM infrastructure_storage) as total_storage,
          (SELECT coalesce(sum(total_capacity_tb), 0) FROM infrastructure_storage) as total_capacity,
          (SELECT coalesce(sum(used_capacity_tb), 0) FROM infrastructure_storage) as used_capacity,
          (SELECT count(*) FROM infrastructure_monitoring WHERE status NOT IN ('normal','resolved')) as active_alerts,
          (SELECT count(*) FROM infrastructure_monitoring WHERE status = 'critical') as critical_alerts,
          (SELECT count(*) FROM infrastructure_monitoring WHERE status = 'warning') as warning_alerts,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId}) as total_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('open','in_progress','assigned')) as open_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('resolved','closed')) as resolved_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
          (SELECT coalesce(avg(extract(epoch from (updated_at - created_at)) / 3600), 0) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('resolved','closed')) as avg_resolution_hours,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId}) as total_projects,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId} AND status IN ('planning','in_progress')) as active_projects,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId} AND status = 'completed') as completed_projects,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL) as total_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status IN ('pending','assigned','in_progress')) as pending_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status = 'completed') as completed_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled','archived')) as overdue_tasks,
          (SELECT count(*) FROM users WHERE it_department_id = ${deptId} AND deleted_at IS NULL AND is_active = true) as staff_count,
          (SELECT count(*) FROM it_referrals WHERE from_department_id = ${deptId} OR to_department_id = ${deptId}) as total_referrals,
          (SELECT count(*) FROM it_referrals WHERE (from_department_id = ${deptId} OR to_department_id = ${deptId}) AND status IN ('pending','in_progress')) as active_referrals
      `);
      const r = result.rows[0] as any;
      const totalCap = Number(r?.total_capacity || 0);
      const usedCap = Number(r?.used_capacity || 0);
      const totalTasks = Number(r?.total_tasks || 0);
      const completedTasks = Number(r?.completed_tasks || 0);
      const totalTickets = Number(r?.total_tickets || 0);
      const resolvedTickets = Number(r?.resolved_tickets || 0);
      const data = {
        servers: { total: Number(r?.total_servers || 0), online: Number(r?.online_servers || 0), offline: Number(r?.offline_servers || 0), maintenance: Number(r?.maint_servers || 0) },
        networks: { total: Number(r?.total_networks || 0), active: Number(r?.active_networks || 0) },
        storage: { total: Number(r?.total_storage || 0), totalCapacityGB: totalCap, usedCapacityGB: usedCap, usagePercent: totalCap > 0 ? Math.round((usedCap / totalCap) * 100) : 0 },
        monitoring: { activeAlerts: Number(r?.active_alerts || 0), critical: Number(r?.critical_alerts || 0), warning: Number(r?.warning_alerts || 0) },
        tickets: { total: totalTickets, open: Number(r?.open_tickets || 0), resolved: resolvedTickets, slaBreaches: Number(r?.sla_breaches || 0), avgResolutionHours: Number(Number(r?.avg_resolution_hours || 0).toFixed(1)), resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0 },
        projects: { total: Number(r?.total_projects || 0), active: Number(r?.active_projects || 0), completed: Number(r?.completed_projects || 0) },
        tasks: { total: totalTasks, pending: Number(r?.pending_tasks || 0), completed: completedTasks, overdue: Number(r?.overdue_tasks || 0), completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
        staff: { total: Number(r?.staff_count || 0) },
        referrals: { total: Number(r?.total_referrals || 0), active: Number(r?.active_referrals || 0) },
      };
      cache.set(cacheKey, data, TTL.INFRASTRUCTURE_STATS);
      res.json(data);
    } catch (error) {
      logger.error('Infrastructure dashboard error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/support", authenticateToken, async (req: any, res) => {
    try {
      const deptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || 12;
      const cacheKey = `support_stats_${deptId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId}) as total_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('open','assigned')) as open_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status = 'in_progress') as progress_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status = 'resolved') as resolved_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status = 'closed') as closed_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND priority IN ('high','critical')) as high_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('closed','resolved')) as sla_breaches,
          (SELECT coalesce(avg(extract(epoch from (updated_at - created_at)) / 3600), 0) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('resolved','closed')) as avg_resolution,
          (SELECT count(*) FROM sla_agreements) as total_sla,
          (SELECT count(*) FROM sla_agreements WHERE status = 'active') as active_sla,
          (SELECT count(*) FROM customer_satisfaction) as satisfaction_count,
          (SELECT coalesce(avg(rating), 0) FROM customer_satisfaction) as avg_rating,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL) as total_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status IN ('pending','assigned','in_progress')) as pending_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status = 'completed') as completed_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled','archived')) as overdue_tasks,
          (SELECT count(*) FROM escalations) as total_escalations,
          (SELECT count(*) FROM escalations WHERE status = 'pending') as pending_escalations,
          (SELECT count(*) FROM users WHERE it_department_id = ${deptId} AND deleted_at IS NULL AND is_active = true) as total_agents,
          (SELECT count(*) FROM it_referrals WHERE from_department_id = ${deptId} OR to_department_id = ${deptId}) as total_referrals,
          (SELECT count(*) FROM it_referrals WHERE (from_department_id = ${deptId} OR to_department_id = ${deptId}) AND status IN ('pending','in_progress')) as active_referrals
      `);
      const r = result.rows[0] as any;
      const resolvedCount = Number(r?.resolved_tickets || 0);
      const closedCount = Number(r?.closed_tickets || 0);
      const totalCount = Number(r?.total_tickets || 0);
      const resolutionRate = totalCount > 0 ? Math.round(((resolvedCount + closedCount) / totalCount) * 100) : 0;
      const avgResHours = Number(r?.avg_resolution || 0);
      const totalTasks = Number(r?.total_tasks || 0);
      const completedTasks = Number(r?.completed_tasks || 0);
      const data = {
        tickets: { total: totalCount, open: Number(r?.open_tickets || 0), inProgress: Number(r?.progress_tickets || 0), resolved: resolvedCount, closed: closedCount, highPriority: Number(r?.high_tickets || 0), slaBreaches: Number(r?.sla_breaches || 0), avgResolutionHours: Number(avgResHours.toFixed(1)), resolutionRate },
        sla: { total: Number(r?.total_sla || 0), active: Number(r?.active_sla || 0) },
        satisfaction: { totalResponses: Number(r?.satisfaction_count || 0), avgRating: Number(Number(r?.avg_rating || 0).toFixed(1)) },
        tasks: { total: totalTasks, pending: Number(r?.pending_tasks || 0), completed: completedTasks, overdue: Number(r?.overdue_tasks || 0), completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
        escalations: { total: Number(r?.total_escalations || 0), pending: Number(r?.pending_escalations || 0) },
        agents: { total: Number(r?.total_agents || 0) },
        referrals: { total: Number(r?.total_referrals || 0), active: Number(r?.active_referrals || 0) },
      };
      cache.set(cacheKey, data, TTL.SUPPORT_STATS);
      res.json(data);
    } catch (error) {
      logger.error('Support dashboard error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/digital-transformation", authenticateToken, async (req: any, res) => {
    try {
      const deptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || 11;
      const cacheKey = `digital_stats_${deptId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM digital_initiatives) as total_initiatives,
          (SELECT count(*) FROM digital_initiatives WHERE status = 'active') as active_initiatives,
          (SELECT count(*) FROM digital_initiatives WHERE status = 'completed') as completed_initiatives,
          (SELECT count(*) FROM digital_initiatives WHERE status = 'planning') as planning_initiatives,
          (SELECT coalesce(avg(progress), 0) FROM digital_initiatives) as avg_progress,
          (SELECT count(*) FROM digital_applications) as total_apps,
          (SELECT count(*) FROM digital_applications WHERE status = 'active') as active_apps,
          (SELECT count(*) FROM cloud_services) as total_cloud,
          (SELECT count(*) FROM cloud_services WHERE status = 'active') as active_cloud,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId}) as total_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('open','in_progress','assigned')) as open_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('resolved','closed')) as resolved_tickets,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId}) as total_projects,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId} AND status IN ('planning','in_progress')) as active_projects,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId} AND status = 'completed') as completed_projects,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL) as total_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status IN ('pending','assigned','in_progress')) as pending_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status = 'completed') as completed_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled','archived')) as overdue_tasks,
          (SELECT count(*) FROM users WHERE it_department_id = ${deptId} AND deleted_at IS NULL AND is_active = true) as staff_count,
          (SELECT count(*) FROM it_referrals WHERE from_department_id = ${deptId} OR to_department_id = ${deptId}) as total_referrals,
          (SELECT count(*) FROM it_referrals WHERE (from_department_id = ${deptId} OR to_department_id = ${deptId}) AND status IN ('pending','in_progress')) as active_referrals
      `);
      const r = result.rows[0] as any;
      const totalTasks = Number(r?.total_tasks || 0);
      const completedTasks = Number(r?.completed_tasks || 0);
      const data = {
        initiatives: { total: Number(r?.total_initiatives || 0), active: Number(r?.active_initiatives || 0), completed: Number(r?.completed_initiatives || 0), planning: Number(r?.planning_initiatives || 0), avgProgress: Math.round(Number(r?.avg_progress || 0)) },
        applications: { total: Number(r?.total_apps || 0), active: Number(r?.active_apps || 0) },
        cloud: { total: Number(r?.total_cloud || 0), active: Number(r?.active_cloud || 0) },
        tickets: { total: Number(r?.total_tickets || 0), open: Number(r?.open_tickets || 0), resolved: Number(r?.resolved_tickets || 0) },
        projects: { total: Number(r?.total_projects || 0), active: Number(r?.active_projects || 0), completed: Number(r?.completed_projects || 0) },
        tasks: { total: totalTasks, pending: Number(r?.pending_tasks || 0), completed: completedTasks, overdue: Number(r?.overdue_tasks || 0), completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
        staff: { total: Number(r?.staff_count || 0) },
        referrals: { total: Number(r?.total_referrals || 0), active: Number(r?.active_referrals || 0) },
      };
      cache.set(cacheKey, data, TTL.DIGITAL_STATS);
      res.json(data);
    } catch (error) {
      logger.error('Digital transformation dashboard error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== DMO Dashboard ====================
  app.get("/api/dashboard/dmo", authenticateToken, async (req: any, res) => {
    try {
      const deptId = req.user?.itDepartmentId || PORTAL_TO_DEPT_ID[req.user?.portal] || 5;
      const cacheKey = `dmo_stats_${deptId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM requirements) as total_requirements,
          (SELECT count(*) FROM requirements WHERE status = 'approved') as approved_requirements,
          (SELECT count(*) FROM requirements WHERE status = 'pending') as pending_requirements,
          (SELECT count(*) FROM evidences WHERE deleted_at IS NULL) as total_evidences,
          (SELECT count(*) FROM evidences WHERE deleted_at IS NULL AND status = 'pending') as pending_evidences,
          (SELECT count(*) FROM evidences WHERE deleted_at IS NULL AND status = 'approved') as approved_evidences,
          (SELECT count(*) FROM evidences WHERE deleted_at IS NULL AND status = 'rejected') as rejected_evidences,
          (SELECT count(*) FROM compliance_reports) as total_reports,
          (SELECT count(*) FROM compliance_reports WHERE status = 'completed') as completed_reports,
          (SELECT count(*) FROM data_assets) as total_assets,
          (SELECT count(*) FROM data_assets WHERE classification = 'top_secret') as secret_assets,
          (SELECT count(*) FROM data_assets WHERE classification = 'confidential') as confidential_assets,
          (SELECT count(*) FROM data_assets WHERE classification = 'restricted') as restricted_assets,
          (SELECT count(*) FROM data_assets WHERE classification = 'public') as public_assets,
          (SELECT count(*) FROM consent_records WHERE is_active = true) as active_consents,
          (SELECT count(*) FROM consent_records) as total_consents,
          (SELECT count(*) FROM data_breaches) as total_breaches,
          (SELECT count(*) FROM data_breaches WHERE status IN ('open','investigating')) as active_breaches,
          (SELECT count(*) FROM processing_records) as total_processing,
          (SELECT count(*) FROM privacy_notices WHERE is_active = true) as active_notices,
          (SELECT count(*) FROM data_subject_requests) as total_dsr,
          (SELECT count(*) FROM data_subject_requests WHERE status = 'pending') as pending_dsr,
          (SELECT count(*) FROM data_subject_requests WHERE status = 'completed') as completed_dsr,
          (SELECT count(*) FROM ndmo_assessments) as total_ndmo,
          (SELECT coalesce(avg(overall_score), 0) FROM ndmo_assessments) as avg_ndmo_score,
          (SELECT count(*) FROM data_risks) as total_risks,
          (SELECT count(*) FROM data_risks WHERE risk_level IN ('high','critical')) as high_risks,
          (SELECT count(*) FROM data_agreements) as total_agreements,
          (SELECT count(*) FROM data_agreements WHERE status = 'active') as active_agreements,
          (SELECT count(*) FROM training_courses) as total_courses,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId}) as total_tickets,
          (SELECT count(*) FROM it_tickets WHERE department_id = ${deptId} AND status IN ('open','in_progress','assigned')) as open_tickets,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL) as total_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status IN ('pending','assigned','in_progress')) as pending_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND status = 'completed') as completed_tasks,
          (SELECT count(*) FROM tasks WHERE department_id = ${deptId} AND deleted_at IS NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled','archived')) as overdue_tasks,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId}) as total_projects,
          (SELECT count(*) FROM it_projects WHERE it_department_id = ${deptId} AND status IN ('planning','in_progress')) as active_projects,
          (SELECT count(*) FROM users WHERE it_department_id = ${deptId} AND deleted_at IS NULL AND is_active = true) as staff_count,
          (SELECT count(*) FROM it_referrals WHERE from_department_id = ${deptId} OR to_department_id = ${deptId}) as total_referrals
      `);
      const r = result.rows[0] as any;
      const totalTasks = Number(r?.total_tasks || 0);
      const completedTasks = Number(r?.completed_tasks || 0);
      const totalReqs = Number(r?.total_requirements || 0);
      const approvedReqs = Number(r?.approved_requirements || 0);
      const totalEvidences = Number(r?.total_evidences || 0);
      const approvedEvs = Number(r?.approved_evidences || 0);

      const data = {
        compliance: {
          requirements: { total: totalReqs, approved: approvedReqs, pending: Number(r?.pending_requirements || 0), coverageRate: totalReqs > 0 ? Math.round((approvedReqs / totalReqs) * 100) : 0 },
          evidences: { total: totalEvidences, pending: Number(r?.pending_evidences || 0), approved: approvedEvs, rejected: Number(r?.rejected_evidences || 0), completionRate: totalEvidences > 0 ? Math.round((approvedEvs / totalEvidences) * 100) : 0 },
          reports: { total: Number(r?.total_reports || 0), completed: Number(r?.completed_reports || 0) },
          ndmo: { total: Number(r?.total_ndmo || 0), avgScore: Math.round(Number(r?.avg_ndmo_score || 0)) },
        },
        dataGovernance: {
          assets: { total: Number(r?.total_assets || 0), topSecret: Number(r?.secret_assets || 0), confidential: Number(r?.confidential_assets || 0), restricted: Number(r?.restricted_assets || 0), public: Number(r?.public_assets || 0) },
          risks: { total: Number(r?.total_risks || 0), highCritical: Number(r?.high_risks || 0) },
          agreements: { total: Number(r?.total_agreements || 0), active: Number(r?.active_agreements || 0) },
          courses: { total: Number(r?.total_courses || 0) },
        },
        privacy: {
          consents: { total: Number(r?.total_consents || 0), active: Number(r?.active_consents || 0) },
          breaches: { total: Number(r?.total_breaches || 0), active: Number(r?.active_breaches || 0) },
          processing: { total: Number(r?.total_processing || 0) },
          notices: { active: Number(r?.active_notices || 0) },
          dsr: { total: Number(r?.total_dsr || 0), pending: Number(r?.pending_dsr || 0), completed: Number(r?.completed_dsr || 0) },
        },
        operations: {
          tickets: { total: Number(r?.total_tickets || 0), open: Number(r?.open_tickets || 0) },
          tasks: { total: totalTasks, pending: Number(r?.pending_tasks || 0), completed: completedTasks, overdue: Number(r?.overdue_tasks || 0), completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
          projects: { total: Number(r?.total_projects || 0), active: Number(r?.active_projects || 0) },
          staff: { total: Number(r?.staff_count || 0) },
          referrals: { total: Number(r?.total_referrals || 0) },
        },
      };
      cache.set(cacheKey, data, TTL.DASHBOARD_STATS);
      res.json(data);
    } catch (error) {
      logger.error('DMO dashboard error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  app.get("/api/dashboard/committee", authenticateToken, async (req: any, res) => {
    try {
      const cached = cache.get<any>('committee_stats');
      if (cached) return res.json(cached);

      const result = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM committee_decisions) as total_decisions,
          (SELECT count(*) FROM committee_decisions WHERE status = 'approved') as approved_decisions,
          (SELECT count(*) FROM committee_decisions WHERE status = 'rejected') as rejected_decisions,
          (SELECT count(*) FROM committee_decisions WHERE status = 'pending') as pending_decisions,
          (SELECT count(*) FROM committee_decisions WHERE status = 'in_review') as review_decisions,
          (SELECT count(*) FROM committee_meetings) as total_meetings,
          (SELECT count(*) FROM committee_meetings WHERE status = 'scheduled') as scheduled_meetings,
          (SELECT count(*) FROM committee_meetings WHERE status = 'completed') as completed_meetings,
          (SELECT count(*) FROM committee_members) as total_members,
          (SELECT count(*) FROM committee_members WHERE is_active = true) as active_members,
          (SELECT count(*) FROM decision_votes) as total_votes,
          (SELECT count(*) FROM meeting_minutes) as total_minutes
      `);
      const r = result.rows[0] as any;
      const data = {
        decisions: { total: Number(r?.total_decisions || 0), approved: Number(r?.approved_decisions || 0), rejected: Number(r?.rejected_decisions || 0), pending: Number(r?.pending_decisions || 0), inReview: Number(r?.review_decisions || 0) },
        meetings: { total: Number(r?.total_meetings || 0), scheduled: Number(r?.scheduled_meetings || 0), completed: Number(r?.completed_meetings || 0) },
        members: { total: Number(r?.total_members || 0), active: Number(r?.active_members || 0) },
        votes: { total: Number(r?.total_votes || 0) },
        minutes: { total: Number(r?.total_minutes || 0) }
      };
      cache.set('committee_stats', data, TTL.COMMITTEE_STATS);
      res.json(data);
    } catch (error) {
      logger.error('Committee dashboard error:', { error: (error as Error).message });
      res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
  });

  // ==================== Global Search Route ====================
  
  app.get("/api/search", authenticateToken, async (req: any, res) => {
    try {
      const { q, category } = req.query;
      const query = (q as string || '').trim().toLowerCase();
      const userPortal = req.user?.portal;
      const userRole = req.user?.role;
      const isAdmin = userRole === 'system_admin' || userRole === 'admin';
      const isITPortal = userPortal === 'admin' || userPortal === 'it_director' ||
        userPortal === 'infrastructure' || userPortal === 'cybersecurity' ||
        userPortal === 'digital_transformation' || userPortal === 'support' ||
        userPortal === 'dmo' || userPortal === 'it_department';
      
      if (!query || query.length < 2) {
        return res.json({ results: [], categories: [] });
      }

      const results: any[] = [];
      const categoryCounts: Record<string, number> = {
        all: 0, ticket: 0, project: 0, task: 0, kb: 0, user: 0, referral: 0, decision: 0, meeting: 0,
      };

      const searchPattern = `%${query}%`;

      // Helper: compute relevance score for a result
      const computeScore = (title: string, subtitle: string, type: string, extras?: { priority?: string; status?: string; createdAt?: any }) => {
        let score = 0;
        const lTitle = (title || '').toLowerCase();
        const lSubtitle = (subtitle || '').toLowerCase();
        // Exact title match
        if (lTitle === query) score += 100;
        // Title starts with query
        else if (lTitle.startsWith(query)) score += 80;
        // Title contains query
        else if (lTitle.includes(query)) score += 60;
        // Subtitle match
        if (lSubtitle.includes(query)) score += 20;
        // Boost high priority items
        if (extras?.priority === 'urgent' || extras?.priority === 'critical') score += 15;
        else if (extras?.priority === 'high') score += 10;
        // Boost active items
        if (extras?.status === 'open' || extras?.status === 'in_progress' || extras?.status === 'active') score += 10;
        // Recency boost
        if (extras?.createdAt) {
          const age = Date.now() - new Date(extras.createdAt).getTime();
          const dayMs = 86400000;
          if (age < dayMs) score += 20;
          else if (age < 7 * dayMs) score += 10;
          else if (age < 30 * dayMs) score += 5;
        }
        return score;
      };

      // Helper: highlight matching text
      const highlightMatch = (text: string) => {
        if (!text) return { text, highlights: [] };
        const lower = text.toLowerCase();
        const idx = lower.indexOf(query);
        if (idx === -1) return { text, highlights: [] };
        return {
          text,
          highlights: [{ start: idx, end: idx + query.length }],
        };
      };

      // Type icon mapping
      const typeIcons: Record<string, { icon: string; color: string; label: string }> = {
        ticket: { icon: 'Ticket', color: '#3b82f6', label: 'تذكرة' },
        project: { icon: 'FolderKanban', color: '#8b5cf6', label: 'مشروع' },
        task: { icon: 'CheckSquare', color: '#10b981', label: 'مهمة' },
        kb: { icon: 'BookOpen', color: '#f59e0b', label: 'قاعدة معرفة' },
        user: { icon: 'User', color: '#6366f1', label: 'مستخدم' },
        referral: { icon: 'ArrowRightLeft', color: '#ec4899', label: 'إحالة' },
        decision: { icon: 'Gavel', color: '#14b8a6', label: 'قرار' },
        meeting: { icon: 'Calendar', color: '#f97316', label: 'محضر اجتماع' },
      };
      
      if ((!category || category === 'all' || category === 'ticket') && isITPortal) {
        const ticketConditions: any[] = [
          isNull(itTickets.deletedAt),
          or(
            sql`LOWER(${itTickets.title}) LIKE ${searchPattern}`,
            sql`LOWER(${itTickets.description}) LIKE ${searchPattern}`,
            sql`CAST(${itTickets.id} AS TEXT) LIKE ${searchPattern}`
          )
        ];
        if (!isAdmin && userPortal !== 'it_director') {
          const deptId = PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId;
          if (deptId) ticketConditions.push(eq(itTickets.departmentId, deptId));
          else ticketConditions.push(eq(itTickets.assigneeId, req.user?.id));
        }
        const matchedTickets = await db.select({
          id: itTickets.id, title: itTickets.title, status: itTickets.status,
          priority: itTickets.priority, description: itTickets.description,
          createdAt: itTickets.createdAt
        }).from(itTickets).where(and(...ticketConditions)).limit(8);
        
        const portalBase = userPortal === 'it_director' || isAdmin ? '/it-director' :
          userPortal === 'support' ? '/department/support' :
          userPortal === 'cybersecurity' ? '/department/cybersecurity' :
          userPortal === 'infrastructure' ? '/department/infrastructure' :
          userPortal === 'digital_transformation' ? '/department/digital-transformation' :
          userPortal === 'dmo' ? '/dmo' : '/it-director';
        
        matchedTickets.forEach((t: any) => {
          const subtitle = `#${t.id} • ${t.status === 'open' ? 'مفتوحة' : t.status === 'in_progress' ? 'قيد العمل' : t.status === 'resolved' ? 'محلولة' : t.status}`;
          results.push({
            id: `ticket-${t.id}`, type: 'ticket',
            title: t.title, subtitle,
            priority: t.priority, status: t.status,
            url: `${portalBase}/tickets`,
            createdAt: t.createdAt,
            score: computeScore(t.title, subtitle, 'ticket', { priority: t.priority, status: t.status, createdAt: t.createdAt }),
            titleHighlight: highlightMatch(t.title),
            typeIcon: typeIcons.ticket,
          });
        });
        categoryCounts.ticket = matchedTickets.length;
      }
      
      if ((!category || category === 'all' || category === 'project') && isITPortal) {
        const matchedProjects = await db.select({
          id: itProjects.id, nameAr: itProjects.nameAr, nameEn: itProjects.nameEn,
          description: itProjects.description, status: itProjects.status
        }).from(itProjects)
          .where(or(
            sql`LOWER(${itProjects.nameAr}) LIKE ${searchPattern}`,
            sql`LOWER(COALESCE(${itProjects.nameEn},'')) LIKE ${searchPattern}`,
            sql`LOWER(COALESCE(${itProjects.description},'')) LIKE ${searchPattern}`
          )).limit(6);
        
        matchedProjects.forEach((p: any) => {
          const subtitle = p.nameEn || '';
          results.push({
            id: `project-${p.id}`, type: 'project',
            title: p.nameAr, subtitle,
            status: p.status,
            url: `/it-director/projects`,
            score: computeScore(p.nameAr, subtitle, 'project', { status: p.status }),
            titleHighlight: highlightMatch(p.nameAr),
            typeIcon: typeIcons.project,
          });
        });
        categoryCounts.project = matchedProjects.length;
      }
      
      if (!category || category === 'all' || category === 'task') {
        try {
          const taskConditions: any[] = [
            or(
              sql`LOWER(${plannerTasks.title}) LIKE ${searchPattern}`,
              sql`LOWER(COALESCE(${plannerTasks.description},'')) LIKE ${searchPattern}`
            )
          ];
          if (!isAdmin && userPortal !== 'it_director') {
            taskConditions.push(eq(plannerTasks.assignedTo, req.user?.id));
          }
          const matchedTasks = await db.select({
            id: plannerTasks.id, title: plannerTasks.title,
            status: plannerTasks.status, priority: plannerTasks.priority,
            dueDate: plannerTasks.dueDate, boardId: plannerTasks.boardId
          }).from(plannerTasks).where(and(...taskConditions)).limit(8);
          
          matchedTasks.forEach((t: any) => {
            const subtitle = t.dueDate ? `تستحق: ${new Date(t.dueDate).toLocaleDateString('ar-SA')}` : (t.status || '');
            results.push({
              id: `task-${t.id}`, type: 'task',
              title: t.title, subtitle,
              status: t.status, priority: t.priority,
              url: userPortal === 'employee' ? '/employee/planner' : `/${userPortal}/planner`,
              score: computeScore(t.title, subtitle, 'task', { priority: t.priority, status: t.status }),
              titleHighlight: highlightMatch(t.title),
              typeIcon: typeIcons.task,
            });
          });
          categoryCounts.task = matchedTasks.length;
        } catch (taskErr: any) {
          logger.warn('Search: planner_tasks query failed, skipping', { message: taskErr?.message });
        }
      }

      if (!category || category === 'all' || category === 'kb') {
        const matchedKB = await db.select({
          id: knowledgeBase.id, title: knowledgeBase.title,
          category: knowledgeBase.category, views: knowledgeBase.views
        }).from(knowledgeBase)
          .where(or(
            sql`LOWER(${knowledgeBase.title}) LIKE ${searchPattern}`,
            sql`LOWER(COALESCE(${knowledgeBase.content},'')) LIKE ${searchPattern}`
          )).limit(5);
        
        matchedKB.forEach((k: any) => {
          const subtitle = k.category ? `تصنيف: ${k.category}` : `${k.views || 0} مشاهدة`;
          results.push({
            id: `kb-${k.id}`, type: 'kb',
            title: k.title, subtitle,
            url: `/dmo/knowledge-base`,
            score: computeScore(k.title, subtitle, 'kb'),
            titleHighlight: highlightMatch(k.title),
            typeIcon: typeIcons.kb,
          });
        });
        categoryCounts.kb = matchedKB.length;
      }

      if ((!category || category === 'all' || category === 'user') && (isAdmin || userPortal === 'it_director')) {
        const matchedUsers = await db.select({
          id: users.id, name: users.name, nameEn: users.nameEn,
          email: users.email, role: users.role, portal: users.portal
        }).from(users)
          .where(and(
            or(
              sql`LOWER(COALESCE(${users.name},'')) LIKE ${searchPattern}`,
              sql`LOWER(COALESCE(${users.nameEn},'')) LIKE ${searchPattern}`,
              sql`LOWER(${users.email}) LIKE ${searchPattern}`
            ),
            isNull(users.deletedAt)
          )).limit(5);
        
        matchedUsers.forEach((u: any) => {
          const title = u.name || u.nameEn || u.email;
          const subtitle = u.email;
          results.push({
            id: `user-${u.id}`, type: 'user',
            title, subtitle,
            role: u.role, portal: u.portal,
            url: `/admin/users`,
            score: computeScore(title, subtitle, 'user'),
            titleHighlight: highlightMatch(title),
            typeIcon: typeIcons.user,
          });
        });
        categoryCounts.user = matchedUsers.length;
      }
      
      if ((!category || category === 'all' || category === 'referral') && isITPortal) {
        const refConditions: any[] = [
          or(
            sql`LOWER(COALESCE(${itReferrals.title},'')) LIKE ${searchPattern}`,
            sql`LOWER(COALESCE(${itReferrals.description},'')) LIKE ${searchPattern}`,
            sql`CAST(${itReferrals.id} AS TEXT) LIKE ${searchPattern}`
          )
        ];
        if (!isAdmin && userPortal !== 'it_director') {
          const deptId = PORTAL_TO_DEPT_ID[userPortal] ?? req.user?.itDepartmentId;
          if (deptId) {
            refConditions.push(or(eq(itReferrals.fromDepartmentId, deptId), eq(itReferrals.toDepartmentId, deptId)));
          }
        }
        const matchedRefs = await db.select({
          id: itReferrals.id, title: itReferrals.title, status: itReferrals.status,
          priority: itReferrals.priority, createdAt: itReferrals.createdAt
        }).from(itReferrals).where(and(...refConditions)).limit(6);
        
        const refPortalBase = userPortal === 'it_director' || isAdmin ? '/it-director' :
          userPortal === 'support' ? '/department/support' :
          userPortal === 'cybersecurity' ? '/department/cybersecurity' :
          userPortal === 'infrastructure' ? '/department/infrastructure' :
          userPortal === 'digital_transformation' ? '/department/digital-transformation' :
          userPortal === 'dmo' ? '/dmo' : '/it-director';
        
        matchedRefs.forEach((r: any) => {
          const title = r.title || `إحالة #${r.id}`;
          const subtitle = `#${r.id} • ${r.status === 'pending' ? 'معلقة' : r.status === 'acknowledged' ? 'مستلمة' : r.status === 'completed' ? 'مكتملة' : r.status}`;
          results.push({
            id: `referral-${r.id}`, type: 'referral',
            title, subtitle,
            priority: r.priority, status: r.status,
            url: `${refPortalBase}/referrals`,
            createdAt: r.createdAt,
            score: computeScore(title, subtitle, 'referral', { priority: r.priority, status: r.status, createdAt: r.createdAt }),
            titleHighlight: highlightMatch(title),
            typeIcon: typeIcons.referral,
          });
        });
        categoryCounts.referral = matchedRefs.length;
      }

      if ((!category || category === 'all' || category === 'decision') && 
          (isAdmin || userPortal === 'it_director' || userPortal === 'committee')) {
        try {
          const matchedDecisions = await db.select({
            id: committeeDecisions.id, title: committeeDecisions.title,
            status: committeeDecisions.status, priority: committeeDecisions.priority,
            createdAt: committeeDecisions.createdAt
          }).from(committeeDecisions)
            .where(or(
              sql`LOWER(${committeeDecisions.title}) LIKE ${searchPattern}`,
              sql`LOWER(COALESCE(${committeeDecisions.description},'')) LIKE ${searchPattern}`
            )).limit(5);
          
          matchedDecisions.forEach((d: any) => {
            const subtitle = d.createdAt ? `تاريخ: ${new Date(d.createdAt).toLocaleDateString('ar-SA')}` : (d.status || '');
            results.push({
              id: `decision-${d.id}`, type: 'decision',
              title: d.title, subtitle,
              status: d.status, priority: d.priority,
              url: '/committee/decisions',
              score: computeScore(d.title, subtitle, 'decision', { priority: d.priority, status: d.status, createdAt: d.createdAt }),
              titleHighlight: highlightMatch(d.title),
              typeIcon: typeIcons.decision,
            });
          });
          categoryCounts.decision = matchedDecisions.length;
        } catch (decErr: any) {
          logger.warn('Search: committee_decisions query failed', { message: decErr?.message });
        }
      }

      if ((!category || category === 'all' || category === 'meeting') && 
          (isAdmin || userPortal === 'it_director' || userPortal === 'committee')) {
        try {
          const matchedMinutes = await db.select({
            id: meetingMinutes.id, title: meetingMinutes.title,
            status: meetingMinutes.status, createdAt: meetingMinutes.createdAt
          }).from(meetingMinutes)
            .where(or(
              sql`LOWER(${meetingMinutes.title}) LIKE ${searchPattern}`,
              sql`LOWER(COALESCE(${meetingMinutes.content},'')) LIKE ${searchPattern}`
            )).limit(5);
          
          matchedMinutes.forEach((m: any) => {
            const subtitle = m.createdAt ? `محضر: ${new Date(m.createdAt).toLocaleDateString('ar-SA')}` : '';
            results.push({
              id: `meeting-${m.id}`, type: 'meeting',
              title: m.title, subtitle,
              status: m.status,
              url: '/committee/minutes',
              score: computeScore(m.title, subtitle, 'meeting', { status: m.status, createdAt: m.createdAt }),
              titleHighlight: highlightMatch(m.title),
              typeIcon: typeIcons.meeting,
            });
          });
          categoryCounts.meeting = matchedMinutes.length;
        } catch (meetErr: any) {
          logger.warn('Search: meeting_minutes query failed', { message: meetErr?.message });
        }
      }

      categoryCounts.all = results.length;

      // Sort results by relevance score (highest first)
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      const categories = Object.entries(categoryCounts)
        .filter(([id]) => id === 'all' || categoryCounts[id] > 0)
        .map(([id, count]) => ({
          id, count,
          label: id === 'all' ? 'الكل' : id === 'ticket' ? 'التذاكر' :
                 id === 'project' ? 'المشاريع' : id === 'task' ? 'المهام' :
                 id === 'kb' ? 'المعرفة' : id === 'user' ? 'المستخدمون' :
                 id === 'referral' ? 'الإحالات' : id === 'decision' ? 'القرارات' :
                 id === 'meeting' ? 'المحاضر' : id,
          icon: typeIcons[id]?.icon || null,
          color: typeIcons[id]?.color || null,
        }));

      res.json({ results, categories, query: q });
    } catch (error: any) {
      logger.error('Search error:', { error, message: error?.message, code: error?.code });
      res.status(500).json({ error: 'حدث خطأ في البحث' });
    }
  });

  // ==================== My Day endpoint ====================
  app.get("/api/my-day", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userPortal = req.user?.portal;
      const userRole = req.user?.role;
      const isAdmin = userRole === 'system_admin' || userRole === 'admin';
      const isDirector = userRole === 'it_director';
      const isPrivileged = isAdmin || isDirector;
      const userDeptId = isPrivileged ? null : (PORTAL_TO_DEPT_ID[userPortal] || req.user?.itDepartmentId || null);

      const cacheKey = `my_day_${userId}_${userPortal}`;
      const cachedMyDay = cache.get<any>(cacheKey);
      if (cachedMyDay) return res.json(cachedMyDay);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

      let myTasks: any[] = [];
      let completedToday: any[] = [];
      let pendingApprovals: any[] = [];
      try {
        myTasks = await db.select({
          id: plannerTasks.id, title: plannerTasks.title,
          status: plannerTasks.status, priority: plannerTasks.priority,
          dueDate: plannerTasks.dueDate, boardId: plannerTasks.boardId
        }).from(plannerTasks)
          .where(and(
            eq(plannerTasks.assignedTo, userId),
            notInArray(plannerTasks.status, ['done', 'cancelled'])
          ))
          .orderBy(plannerTasks.dueDate)
          .limit(20);

        completedToday = await db.select({ id: plannerTasks.id })
          .from(plannerTasks)
          .where(and(
            eq(plannerTasks.assignedTo, userId),
            eq(plannerTasks.status, 'done'),
            sql`${plannerTasks.updatedAt} >= ${today.toISOString()}`
          ));

        const isManager = userRole?.includes('manager') || userRole?.includes('director') || isAdmin;
        if (isManager) {
          const boardsOwned = await db.select({ id: plannerBoards.id })
            .from(plannerBoards)
            .where(eq(plannerBoards.createdBy, userId));
          const boardIds = boardsOwned.map((b: any) => b.id);
          if (boardIds.length > 0) {
            pendingApprovals = await db.select({
              id: plannerTasks.id, title: plannerTasks.title, assignedTo: plannerTasks.assignedTo
            }).from(plannerTasks)
              .where(and(
                sql`${plannerTasks.boardId} = ANY(ARRAY[${sql.join(boardIds.map((id: number) => sql`${id}`), sql`, `)}])`,
                eq(plannerTasks.status, 'pending_approval')
              ))
              .limit(5);
          }
        }
      } catch (plannerErr: any) {
        logger.warn('My-day: planner_tasks query failed, using empty defaults', { message: plannerErr?.message });
      }

      const overdueTasks = myTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < today);
      const dueTodayTasks = myTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow);
      const upcomingTasks = myTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) >= tomorrow && new Date(t.dueDate) < weekEnd);

      const ticketConditions: any[] = [
        isNull(itTickets.deletedAt),
        eq(itTickets.assigneeId, userId),
        notInArray(itTickets.status, ['resolved', 'closed']),
      ];
      if (userDeptId) ticketConditions.push(eq(itTickets.departmentId, userDeptId));
      const myTickets = await db.select({
        id: itTickets.id, title: itTickets.title, status: itTickets.status,
        priority: itTickets.priority, slaDeadline: itTickets.slaDeadline, createdAt: itTickets.createdAt
      }).from(itTickets)
        .where(and(...ticketConditions))
        .orderBy(itTickets.slaDeadline)
        .limit(5);

      const totalDueToday = dueTodayTasks.length;
      const productivity = totalDueToday > 0
        ? Math.min(100, Math.round((completedToday.length / (totalDueToday + completedToday.length)) * 100))
        : completedToday.length > 0 ? 100 : 0;

      let portalStats: Record<string, number> = {};
      try {
        const effectivePortal = userPortal || 'admin';
        if (effectivePortal === 'cybersecurity' || isPrivileged) {
          const incRes = await db.select({ count: sql<number>`count(*)` })
            .from(securityIncidents)
            .where(or(eq(securityIncidents.status, 'open'), eq(securityIncidents.status, 'investigating')));
          portalStats.openIncidents = Number(incRes[0]?.count || 0);
        }
        if (effectivePortal === 'cybersecurity' || isPrivileged) {
          const vulnRes = await db.select({ count: sql<number>`count(*)` })
            .from(securityVulnerabilities)
            .where(and(eq(securityVulnerabilities.severity, 'critical'), eq(securityVulnerabilities.status, 'open')));
          portalStats.criticalVulns = Number(vulnRes[0]?.count || 0);
        }
        if (effectivePortal === 'infrastructure' || isPrivileged) {
          const srvRes = await db.execute(sql`SELECT count(*) as c FROM infrastructure_servers WHERE status = 'offline'`);
          portalStats.downServers = Number((srvRes as any).rows?.[0]?.c || (srvRes as any)[0]?.c || 0);
        }
        if (effectivePortal === 'dmo' || isPrivileged) {
          const dsrRes = await db.select({ count: sql<number>`count(*)` })
            .from(dataSubjectRequests)
            .where(eq(dataSubjectRequests.status, 'pending'));
          portalStats.pendingDSR = Number(dsrRes[0]?.count || 0);
        }
        if (effectivePortal === 'support' || isPrivileged) {
          const slaRes = await db.execute(sql`
            SELECT count(*)::int as c FROM it_tickets
            WHERE department_id = 12 AND sla_deadline IS NOT NULL
            AND sla_deadline < NOW() AND status NOT IN ('closed', 'resolved')
          `);
          portalStats.slaBreaches = Number((slaRes as any).rows?.[0]?.c || (slaRes as any)[0]?.c || 0);
        }
        if (effectivePortal === 'digital_transformation' || isPrivileged) {
          const projRes = await db.execute(sql`
            SELECT count(*)::int as c FROM it_projects
            WHERE it_department_id = 11 AND status IN ('planning', 'in_progress')
          `);
          portalStats.activeProjects = Number((projRes as any).rows?.[0]?.c || (projRes as any)[0]?.c || 0);
        }
        const refDeptId = userDeptId || null;
        if (refDeptId) {
          const refRes = await db.select({ count: sql<number>`count(*)` })
            .from(itReferrals)
            .where(and(eq(itReferrals.toDepartmentId, refDeptId), eq(itReferrals.status, 'pending')));
          portalStats.pendingReferrals = Number(refRes[0]?.count || 0);
        } else if (isPrivileged) {
          const refRes = await db.select({ count: sql<number>`count(*)` })
            .from(itReferrals)
            .where(eq(itReferrals.status, 'pending'));
          portalStats.pendingReferrals = Number(refRes[0]?.count || 0);
        }
        const critDeptConditions: any[] = [
          isNull(itTickets.deletedAt),
          or(eq(itTickets.priority, 'critical'), eq(itTickets.priority, 'urgent')),
          notInArray(itTickets.status, ['closed', 'resolved']),
        ];
        if (userDeptId) critDeptConditions.push(eq(itTickets.departmentId, userDeptId));
        const critRes = await db.select({ count: sql<number>`count(*)` })
          .from(itTickets)
          .where(and(...critDeptConditions));
        portalStats.criticalTickets = Number(critRes[0]?.count || 0);
      } catch (portalErr: any) {
        logger.warn('My-day: portal stats query failed', { message: portalErr?.message });
      }

      const myDayResult = {
        stats: {
          overdue: overdueTasks.length,
          dueToday: dueTodayTasks.length,
          upcoming: upcomingTasks.length,
          completedToday: completedToday.length,
          openTickets: myTickets.length,
          pendingApprovals: pendingApprovals.length,
          productivity,
          ...portalStats,
        },
        overdueTasks,
        dueTodayTasks,
        upcomingTasks,
        myTickets,
        pendingApprovals,
      };
      cache.set(cacheKey, myDayResult, 5 * 60 * 1000);
      res.json(myDayResult);
    } catch (error) {
      logger.error('My day error:', { error });
      res.status(500).json({ error: 'حدث خطأ في جلب بيانات اليوم' });
    }
  });
}
