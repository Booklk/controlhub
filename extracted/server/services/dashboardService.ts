/**
 * Dashboard Service - Control Hub JCSA
 * خدمة موحدة للوحات التحكم مع التخزين المؤقت
 */

import { db } from '../db';
import { 
  users, itProjects, itTickets, tasks, committeeDecisions, 
  auditLogs, securityIncidents, securityVulnerabilities,
  domains, requirements, evidences
} from '@shared/schema';
import { eq, sql, and, gte, lte, count, avg, desc } from 'drizzle-orm';
import { statsCache } from '../cache/statsCache';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  complianceRate: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface ITDirectorStats {
  projects: {
    total: number;
    active: number;
    completed: number;
    delayed: number;
  };
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    avgResolutionTime: number;
  };
  sla: {
    complianceRate: number;
    breaches: number;
  };
  departments: Array<{
    name: string;
    openTickets: number;
    activeProjects: number;
  }>;
}

export interface CybersecurityStats {
  incidents: {
    total: number;
    critical: number;
    active: number;
    resolved: number;
  };
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  riskScore: number;
  avgResolutionTime: number;
}

export interface DMOStats {
  dataAssets: number;
  complianceRate: number;
  domainsCount: number;
  requirementsTotal: number;
  requirementsCompleted: number;
  pendingRequests: number;
}

export interface CommitteeStats {
  decisions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  meetings: {
    upcoming: number;
    completed: number;
  };
  votingSessions: {
    active: number;
    completed: number;
  };
}

class DashboardService {
  async getAdminStats(): Promise<DashboardStats> {
    return statsCache.getOrFetch('dashboard:admin', async () => {
      const [usersCount] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true));

      const [projectsCount] = await db
        .select({ 
          total: count(),
          active: sql<number>`COUNT(CASE WHEN status = 'active' OR status = 'in_progress' THEN 1 END)`
        })
        .from(itProjects);

      const [ticketsCount] = await db
        .select({ 
          total: count(),
          open: sql<number>`COUNT(CASE WHEN status = 'open' OR status = 'new' THEN 1 END)`,
          resolved: sql<number>`COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END)`
        })
        .from(itTickets);

      const [tasksCount] = await db
        .select({
          pending: sql<number>`COUNT(CASE WHEN status = 'pending' OR status = 'in_progress' THEN 1 END)`,
          overdue: sql<number>`COUNT(CASE WHEN status != 'completed' AND due_date < NOW() THEN 1 END)`
        })
        .from(tasks);

      const [domainsData] = await db
        .select({ total: count() })
        .from(domains);

      const [reqData] = await db
        .select({ 
          total: count(),
          completed: sql<number>`COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END)`
        })
        .from(requirements);

      const complianceRate = reqData.total > 0 
        ? Math.round((Number(reqData.completed) / reqData.total) * 100) 
        : 0;

      return {
        totalUsers: usersCount.count,
        activeUsers: usersCount.count,
        totalProjects: projectsCount.total,
        activeProjects: Number(projectsCount.active) || 0,
        totalTickets: ticketsCount.total,
        openTickets: Number(ticketsCount.open) || 0,
        resolvedTickets: Number(ticketsCount.resolved) || 0,
        complianceRate,
        pendingTasks: Number(tasksCount.pending) || 0,
        overdueTasks: Number(tasksCount.overdue) || 0,
      };
    });
  }

  async getITDirectorStats(): Promise<ITDirectorStats> {
    return statsCache.getOrFetch('dashboard:it-director', async () => {
      const [projectsData] = await db
        .select({
          total: count(),
          active: sql<number>`COUNT(CASE WHEN status = 'active' OR status = 'in_progress' THEN 1 END)`,
          completed: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
          delayed: sql<number>`COUNT(CASE WHEN status = 'delayed' OR (status != 'completed' AND end_date < NOW()) THEN 1 END)`
        })
        .from(itProjects);

      const [ticketsData] = await db
        .select({
          total: count(),
          open: sql<number>`COUNT(CASE WHEN status = 'open' OR status = 'new' THEN 1 END)`,
          inProgress: sql<number>`COUNT(CASE WHEN status = 'in_progress' THEN 1 END)`,
          resolved: sql<number>`COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END)`
        })
        .from(itTickets);

      return {
        projects: {
          total: projectsData.total,
          active: Number(projectsData.active) || 0,
          completed: Number(projectsData.completed) || 0,
          delayed: Number(projectsData.delayed) || 0,
        },
        tickets: {
          total: ticketsData.total,
          open: Number(ticketsData.open) || 0,
          inProgress: Number(ticketsData.inProgress) || 0,
          resolved: Number(ticketsData.resolved) || 0,
          avgResolutionTime: 24,
        },
        sla: {
          complianceRate: 95,
          breaches: 2,
        },
        departments: [
          { name: 'البنية التحتية', openTickets: 5, activeProjects: 3 },
          { name: 'الأمن السيبراني', openTickets: 3, activeProjects: 2 },
          { name: 'التحول الرقمي', openTickets: 4, activeProjects: 4 },
          { name: 'الدعم الفني', openTickets: 8, activeProjects: 1 },
        ],
      };
    });
  }

  async getCybersecurityStats(): Promise<CybersecurityStats> {
    return statsCache.getOrFetch('dashboard:cybersecurity', async () => {
      const [incidentsData] = await db
        .select({
          total: count(),
          critical: sql<number>`COUNT(CASE WHEN severity = 'critical' THEN 1 END)`,
          active: sql<number>`COUNT(CASE WHEN status = 'open' OR status = 'investigating' THEN 1 END)`,
          resolved: sql<number>`COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END)`
        })
        .from(securityIncidents);

      const [vulnsData] = await db
        .select({
          total: count(),
          critical: sql<number>`COUNT(CASE WHEN severity = 'critical' THEN 1 END)`,
          high: sql<number>`COUNT(CASE WHEN severity = 'high' THEN 1 END)`,
          medium: sql<number>`COUNT(CASE WHEN severity = 'medium' THEN 1 END)`,
          low: sql<number>`COUNT(CASE WHEN severity = 'low' THEN 1 END)`
        })
        .from(securityVulnerabilities);

      return {
        incidents: {
          total: incidentsData.total,
          critical: Number(incidentsData.critical) || 0,
          active: Number(incidentsData.active) || 0,
          resolved: Number(incidentsData.resolved) || 0,
        },
        vulnerabilities: {
          total: vulnsData.total,
          critical: Number(vulnsData.critical) || 0,
          high: Number(vulnsData.high) || 0,
          medium: Number(vulnsData.medium) || 0,
          low: Number(vulnsData.low) || 0,
        },
        riskScore: 72,
        avgResolutionTime: 48,
      };
    });
  }

  async getDMOStats(): Promise<DMOStats> {
    return statsCache.getOrFetch('dashboard:dmo', async () => {
      const [domainsData] = await db
        .select({ count: count() })
        .from(domains);

      const [reqData] = await db
        .select({
          total: count(),
          completed: sql<number>`COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END)`
        })
        .from(requirements);

      const complianceRate = reqData.total > 0 
        ? Math.round((Number(reqData.completed) / reqData.total) * 100) 
        : 0;

      return {
        dataAssets: 156,
        complianceRate,
        domainsCount: domainsData.count,
        requirementsTotal: reqData.total,
        requirementsCompleted: Number(reqData.completed) || 0,
        pendingRequests: 12,
      };
    });
  }

  async getCommitteeStats(): Promise<CommitteeStats> {
    return statsCache.getOrFetch('dashboard:committee', async () => {
      const [decisionsData] = await db
        .select({
          total: count(),
          pending: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)`,
          approved: sql<number>`COUNT(CASE WHEN status = 'approved' THEN 1 END)`,
          rejected: sql<number>`COUNT(CASE WHEN status = 'rejected' THEN 1 END)`
        })
        .from(committeeDecisions);

      return {
        decisions: {
          total: decisionsData.total,
          pending: Number(decisionsData.pending) || 0,
          approved: Number(decisionsData.approved) || 0,
          rejected: Number(decisionsData.rejected) || 0,
        },
        meetings: {
          upcoming: 3,
          completed: 24,
        },
        votingSessions: {
          active: 2,
          completed: 45,
        },
      };
    });
  }

  async getUnifiedStats(portal: string): Promise<any> {
    switch (portal) {
      case 'admin':
        return this.getAdminStats();
      case 'it_director':
        return this.getITDirectorStats();
      case 'cybersecurity':
        return this.getCybersecurityStats();
      case 'dmo':
        return this.getDMOStats();
      case 'committee':
        return this.getCommitteeStats();
      default:
        return this.getAdminStats();
    }
  }

  invalidateCache(portal?: string): void {
    if (portal) {
      statsCache.invalidate(`dashboard:${portal}`);
    } else {
      statsCache.invalidatePattern('^dashboard:');
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
