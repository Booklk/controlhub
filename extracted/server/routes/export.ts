/**
 * Export Routes - Excel Export Endpoints
 * Control Hub - JCSA
 * كل بوابة تصدر بياناتها الخاصة
 */

import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db';
import {
  users, itTickets, itProjects, auditLogs, domains, requirements,
  dataAssets, dataRisks, securityIncidents, dataAgreements,
  tasks, itAssets, securityVulnerabilities, securityThreats,
  infrastructureServers, infrastructureNetworks, infrastructureStorage,
  digitalInitiatives, digitalApplications, cloudServices,
  escalations, vendors, slaAgreements, kpiMetrics,
  committeeDecisions, committeeMeetings,
  dataDictionary, dataStewards, itReferrals,
} from '@shared/schema';
import { desc, eq, and, isNull } from 'drizzle-orm';
import { logger } from '../security-middleware';
import { PORTAL_TO_DEPT_ID } from './shared';

import {
  exportToExcel,
  exportUsers,
  exportTickets,
  exportProjects,
  exportAuditLogs,
  exportComplianceReport,
  exportReferrals,
} from '../services/exportService';
import { requirePortal } from '../middleware/permissions';

const router = Router();

const EXPORT_PORTALS = ['admin', 'it_director', 'cybersecurity', 'infrastructure', 'digital_transformation', 'support', 'dmo', 'committee'];

const requireExportAccess = [
  requirePortal(EXPORT_PORTALS),
];

// ====== Admin exports ======
router.get('/users', requirePortal(['admin', 'it_director']), async (req: Request, res: Response) => {
  try {
    const allUsers = await db.select().from(users);
    const buffer = await exportUsers(allUsers);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export users error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/audit-logs', requirePortal(['admin']), async (req: Request, res: Response) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(1000);
    const buffer = await exportAuditLogs(logs);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export audit logs error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== IT Director + Admin exports ======
router.get('/tickets', requirePortal(['admin', 'it_director', 'support', 'infrastructure', 'cybersecurity', 'digital_transformation', 'dmo']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isDirectorOrAdmin = user?.role === 'it_director' || user?.role === 'system_admin';
    let allTickets;
    if (isDirectorOrAdmin) {
      allTickets = await db.select().from(itTickets)
        .where(isNull(itTickets.deletedAt))
        .orderBy(desc(itTickets.createdAt));
    } else {
      const deptId = PORTAL_TO_DEPT_ID[user?.portal] || user?.itDepartmentId;
      if (deptId) {
        allTickets = await db.select().from(itTickets)
          .where(and(isNull(itTickets.deletedAt), eq(itTickets.departmentId, deptId)))
          .orderBy(desc(itTickets.createdAt));
      } else {
        allTickets = [];
      }
    }
    const buffer = await exportTickets(allTickets);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export tickets error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/projects', requirePortal(['admin', 'it_director', 'infrastructure', 'digital_transformation', 'cybersecurity', 'support', 'dmo']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isDirectorOrAdmin = user?.role === 'it_director' || user?.role === 'system_admin';
    let allProjects;
    if (isDirectorOrAdmin) {
      allProjects = await db.select().from(itProjects).where(isNull(itProjects.deletedAt)).orderBy(desc(itProjects.createdAt));
    } else {
      const deptId = PORTAL_TO_DEPT_ID[user?.portal] || user?.itDepartmentId;
      if (deptId) {
        allProjects = await db.select().from(itProjects)
          .where(and(eq(itProjects.itDepartmentId, deptId), isNull(itProjects.deletedAt)))
          .orderBy(desc(itProjects.createdAt));
      } else {
        allProjects = [];
      }
    }
    const buffer = await exportProjects(allProjects);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export projects error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/tasks', ...requireExportAccess, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isDirectorOrAdmin = user?.role === 'it_director' || user?.role === 'system_admin';
    let allTasks;
    if (isDirectorOrAdmin) {
      allTasks = await db.select().from(tasks)
        .where(isNull(tasks.deletedAt))
        .orderBy(desc(tasks.createdAt));
    } else {
      const deptId = PORTAL_TO_DEPT_ID[user?.portal] || user?.itDepartmentId;
      if (deptId) {
        allTasks = await db.select().from(tasks)
          .where(and(isNull(tasks.deletedAt), eq(tasks.departmentId, deptId)))
          .orderBy(desc(tasks.createdAt));
      } else {
        allTasks = await db.select().from(tasks)
          .where(and(isNull(tasks.deletedAt), eq(tasks.assignedTo, user?.id)))
          .orderBy(desc(tasks.createdAt));
      }
    }
    const columns = [
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'الوصف', key: 'description', width: 40 },
      { header: 'الحالة', key: 'statusAr', width: 15 },
      { header: 'الأولوية', key: 'priorityAr', width: 12 },
      { header: 'رقم القسم', key: 'departmentId', width: 15 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 18 },
    ];
    const statusMap: Record<string, string> = { open: 'مفتوح', in_progress: 'قيد التنفيذ', completed: 'مكتمل', closed: 'مغلق', pending: 'معلق', assigned: 'مسند', review: 'مراجعة', archived: 'مؤرشف', cancelled: 'ملغي' };
    const priorityMap: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالي', critical: 'حرج', urgent: 'عاجل' };
    const formatted = allTasks.map((t: any) => ({ ...t, statusAr: statusMap[t.status || ''] || t.status, priorityAr: priorityMap[t.priority || ''] || t.priority }));
    const buffer = await exportToExcel(formatted, columns, { title: 'المهام', subtitle: `إجمالي: ${allTasks.length} مهمة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export tasks error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Compliance (admin, it_director, dmo) ======
router.get('/compliance-report', requirePortal(['admin', 'it_director', 'dmo']), async (req: Request, res: Response) => {
  try {
    const allDomains = await db.select().from(domains);
    const allRequirements = await db.select().from(requirements);
    const domainStats = allDomains.map((domain: any) => {
      const domainReqs = allRequirements.filter((r: any) => r.domainId === domain.id);
      const total = domainReqs.length;
      const completed = domainReqs.filter((r: any) => r.complianceLevel === 'full').length;
      const partial = domainReqs.filter((r: any) => r.complianceLevel === 'partial').length;
      const notStarted = domainReqs.filter((r: any) => r.complianceLevel === 'none' || !r.complianceLevel).length;
      const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { domainName: domain.nameAr || domain.nameEn, totalRequirements: total, completed, inProgress: partial, notStarted, complianceRate };
    });
    const totalReqs = allRequirements.length;
    const totalCompleted = allRequirements.filter((r: any) => r.complianceLevel === 'full').length;
    const overallCompliance = totalReqs > 0 ? Math.round((totalCompleted / totalReqs) * 100) : 0;
    const buffer = await exportComplianceReport({ overallCompliance, domains: domainStats });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export compliance error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/compliance', requirePortal(['admin', 'it_director', 'dmo']), async (req: Request, res: Response) => {
  try {
    const allDomains = await db.select().from(domains);
    const allRequirements = await db.select().from(requirements);
    const domainStats = allDomains.map((domain: any) => {
      const domainReqs = allRequirements.filter((r: any) => r.domainId === domain.id);
      const total = domainReqs.length;
      const completed = domainReqs.filter((r: any) => r.complianceLevel === 'full').length;
      const partial = domainReqs.filter((r: any) => r.complianceLevel === 'partial').length;
      const notStarted = domainReqs.filter((r: any) => r.complianceLevel === 'none' || !r.complianceLevel).length;
      const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { domainName: domain.nameAr || domain.nameEn, totalRequirements: total, completed, inProgress: partial, notStarted, complianceRate };
    });
    const totalReqs = allRequirements.length;
    const totalCompleted = allRequirements.filter((r: any) => r.complianceLevel === 'full').length;
    const overallCompliance = totalReqs > 0 ? Math.round((totalCompleted / totalReqs) * 100) : 0;
    const buffer = await exportComplianceReport({ overallCompliance, domains: domainStats });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export compliance error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== DMO exports ======
router.get('/data-assets', requirePortal(['dmo', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allAssets = await db.select().from(dataAssets).orderBy(desc(dataAssets.createdAt));
    const columns = [
      { header: 'اسم الأصل', key: 'name', width: 25 },
      { header: 'نوع البيانات', key: 'dataType', width: 15 },
      { header: 'التصنيف', key: 'classification', width: 15 },
      { header: 'النظام المصدر', key: 'system', width: 20 },
      { header: 'المالك', key: 'owner', width: 20 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 18 },
    ];
    const buffer = await exportToExcel(allAssets, columns, { title: 'الأصول البيانية', subtitle: `إجمالي: ${allAssets.length} أصل`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-assets.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export data-assets error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/data-dictionary', requirePortal(['dmo', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allDict = await db.select().from(dataDictionary).orderBy(desc(dataDictionary.createdAt));
    const columns = [
      { header: 'المصطلح', key: 'term', width: 20 },
      { header: 'التعريف', key: 'definition', width: 35 },
      { header: 'نوع البيانات', key: 'dataType', width: 15 },
      { header: 'التصنيف', key: 'category', width: 15 },
      { header: 'القاعدة التجارية', key: 'businessRule', width: 30 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 18 },
    ];
    const formatted = allDict.map((d: any) => ({ ...d }));
    const buffer = await exportToExcel(formatted, columns, { title: 'قاموس البيانات', subtitle: `إجمالي: ${allDict.length} حقل`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-dictionary.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export data-dictionary error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/data-risks', requirePortal(['dmo', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allRisks = await db.select().from(dataRisks).orderBy(desc(dataRisks.createdAt));
    const riskLevelMap: Record<string, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
    const columns = [
      { header: 'المخاطرة', key: 'title', width: 30 },
      { header: 'الوصف', key: 'description', width: 40 },
      { header: 'المستوى', key: 'riskLevelAr', width: 12 },
      { header: 'الاحتمالية', key: 'likelihood', width: 12 },
      { header: 'الأثر', key: 'impact', width: 12 },
      { header: 'خطة التخفيف', key: 'mitigationPlan', width: 30 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];
    const formatted = allRisks.map((r: any) => ({ ...r, riskLevelAr: riskLevelMap[r.riskLevel || ''] || r.riskLevel }));
    const buffer = await exportToExcel(formatted, columns, { title: 'سجل المخاطر', subtitle: `إجمالي: ${allRisks.length} مخاطرة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-risks.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export data-risks error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/security-incidents', requirePortal(['dmo', 'cybersecurity', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allIncidents = await db.select().from(securityIncidents).orderBy(desc(securityIncidents.createdAt));
    const severityMap: Record<string, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };
    const statusMap: Record<string, string> = { open: 'مفتوح', investigating: 'قيد التحقيق', contained: 'محتوى', resolved: 'تم الحل', closed: 'مغلق' };
    const columns = [
      { header: 'رقم البلاغ', key: 'incidentNumber', width: 15 },
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'الخطورة', key: 'severityAr', width: 12 },
      { header: 'الحالة', key: 'statusAr', width: 15 },
      { header: 'الوصف', key: 'description', width: 40 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 18 },
    ];
    const formatted = allIncidents.map((i: any) => ({ ...i, severityAr: severityMap[i.severity || ''] || i.severity, statusAr: statusMap[i.status || ''] || i.status }));
    const buffer = await exportToExcel(formatted, columns, { title: 'البلاغات الأمنية', subtitle: `إجمالي: ${allIncidents.length} بلاغ`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=security-incidents.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export security-incidents error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/data-agreements', requirePortal(['dmo', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allAgreements = await db.select().from(dataAgreements).orderBy(desc(dataAgreements.createdAt));
    const columns = [
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'الجهة الثانية', key: 'partyName', width: 25 },
      { header: 'النوع', key: 'agreementType', width: 15 },
      { header: 'تاريخ البداية', key: 'startDate', width: 15 },
      { header: 'تاريخ الانتهاء', key: 'endDate', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];
    const buffer = await exportToExcel(allAgreements, columns, { title: 'اتفاقيات مشاركة البيانات', subtitle: `إجمالي: ${allAgreements.length} اتفاقية`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-agreements.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export data-agreements error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/data-stewards', requirePortal(['dmo', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allStewards = await db.select().from(dataStewards).orderBy(desc(dataStewards.createdAt));
    const columns = [
      { header: 'الاسم', key: 'name', width: 25 },
      { header: 'البريد الإلكتروني', key: 'email', width: 30 },
      { header: 'الإدارة', key: 'department', width: 20 },
      { header: 'الدور', key: 'role', width: 15 },
      { header: 'الحالة', key: 'statusAr', width: 12 },
    ];
    const formatted = allStewards.map((s: any) => ({ ...s, statusAr: s.isActive ? 'نشط' : 'غير نشط' }));
    const buffer = await exportToExcel(formatted, columns, { title: 'ممثلو بيانات الأعمال', subtitle: `إجمالي: ${allStewards.length} ممثل`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-stewards.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export data-stewards error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Cybersecurity exports ======
router.get('/vulnerabilities', requirePortal(['cybersecurity', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allVulns = await db.select().from(securityVulnerabilities).orderBy(desc(securityVulnerabilities.createdAt));
    const columns = [
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'الخطورة', key: 'severity', width: 12 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'النظام المتأثر', key: 'affectedSystem', width: 20 },
      { header: 'تاريخ الاكتشاف', key: 'createdAt', width: 18 },
    ];
    const buffer = await exportToExcel(allVulns, columns, { title: 'الثغرات الأمنية', subtitle: `إجمالي: ${allVulns.length} ثغرة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=vulnerabilities.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export vulnerabilities error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/threats', requirePortal(['cybersecurity', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allThreats = await db.select().from(securityThreats).orderBy(desc(securityThreats.createdAt));
    const columns = [
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'النوع', key: 'threatType', width: 15 },
      { header: 'الخطورة', key: 'severity', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'تاريخ الاكتشاف', key: 'detectedAt', width: 18 },
    ];
    const buffer = await exportToExcel(allThreats, columns, { title: 'التهديدات الأمنية', subtitle: `إجمالي: ${allThreats.length} تهديد`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=threats.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export threats error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Infrastructure exports ======
router.get('/servers', requirePortal(['infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allServers = await db.select().from(infrastructureServers);
    const columns = [
      { header: 'اسم الخادم', key: 'name', width: 25 },
      { header: 'النوع', key: 'serverType', width: 15 },
      { header: 'نظام التشغيل', key: 'operatingSystem', width: 20 },
      { header: 'IP', key: 'ipAddress', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'الموقع', key: 'location', width: 20 },
    ];
    const buffer = await exportToExcel(allServers, columns, { title: 'الخوادم', subtitle: `إجمالي: ${allServers.length} خادم`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=servers.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export servers error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/networks', requirePortal(['infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allNetworks = await db.select().from(infrastructureNetworks);
    const columns = [
      { header: 'اسم الشبكة', key: 'name', width: 25 },
      { header: 'النوع', key: 'networkType', width: 15 },
      { header: 'النطاق', key: 'subnet', width: 20 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];
    const buffer = await exportToExcel(allNetworks, columns, { title: 'الشبكات', subtitle: `إجمالي: ${allNetworks.length} شبكة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=networks.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export networks error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/storage', requirePortal(['infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allStorage = await db.select().from(infrastructureStorage);
    const columns = [
      { header: 'اسم التخزين', key: 'name', width: 25 },
      { header: 'النوع', key: 'storageType', width: 15 },
      { header: 'السعة (TB)', key: 'totalCapacityTb', width: 15 },
      { header: 'المستخدم (TB)', key: 'usedCapacityTb', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];
    const buffer = await exportToExcel(allStorage, columns, { title: 'التخزين', subtitle: `إجمالي: ${allStorage.length} وحدة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=storage.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export storage error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/it-assets', requirePortal(['infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allAssets = await db.select().from(itAssets).orderBy(desc(itAssets.createdAt));
    const columns = [
      { header: 'رمز الأصل', key: 'assetCode', width: 15 },
      { header: 'اسم الأصل', key: 'nameAr', width: 25 },
      { header: 'النوع', key: 'assetType', width: 15 },
      { header: 'الموقع', key: 'location', width: 20 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'الشركة المصنعة', key: 'manufacturer', width: 20 },
      { header: 'تاريخ الشراء', key: 'purchaseDate', width: 15 },
    ];
    const buffer = await exportToExcel(allAssets, columns, { title: 'أصول تقنية المعلومات', subtitle: `إجمالي: ${allAssets.length} أصل`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=it-assets.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export it-assets error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Digital Transformation exports ======
router.get('/digital-initiatives', requirePortal(['digital_transformation', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allInitiatives = await db.select().from(digitalInitiatives).orderBy(desc(digitalInitiatives.createdAt));
    const columns = [
      { header: 'رمز المبادرة', key: 'initiativeCode', width: 15 },
      { header: 'اسم المبادرة', key: 'title', width: 30 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'التقدم %', key: 'progress', width: 12 },
      { header: 'تاريخ البدء', key: 'startDate', width: 15 },
      { header: 'تاريخ الانتهاء المستهدف', key: 'targetEndDate', width: 18 },
    ];
    const buffer = await exportToExcel(allInitiatives, columns, { title: 'مبادرات التحول الرقمي', subtitle: `إجمالي: ${allInitiatives.length} مبادرة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=digital-initiatives.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export digital-initiatives error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/digital-applications', requirePortal(['digital_transformation', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allApps = await db.select().from(digitalApplications).orderBy(desc(digitalApplications.createdAt));
    const columns = [
      { header: 'رمز التطبيق', key: 'appCode', width: 15 },
      { header: 'اسم التطبيق', key: 'nameAr', width: 25 },
      { header: 'النوع', key: 'appType', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'المنصة', key: 'platform', width: 15 },
      { header: 'المورد', key: 'vendor', width: 20 },
    ];
    const buffer = await exportToExcel(allApps, columns, { title: 'التطبيقات الرقمية', subtitle: `إجمالي: ${allApps.length} تطبيق`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=digital-applications.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export digital-applications error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/cloud-services', requirePortal(['digital_transformation', 'infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allCloud = await db.select().from(cloudServices).orderBy(desc(cloudServices.createdAt));
    const columns = [
      { header: 'رمز الخدمة', key: 'serviceCode', width: 15 },
      { header: 'اسم الخدمة', key: 'nameAr', width: 25 },
      { header: 'المزود', key: 'provider', width: 20 },
      { header: 'النوع', key: 'serviceType', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'التكلفة الشهرية', key: 'monthlyCost', width: 15 },
    ];
    const buffer = await exportToExcel(allCloud, columns, { title: 'الخدمات السحابية', subtitle: `إجمالي: ${allCloud.length} خدمة`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=cloud-services.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export cloud-services error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Support exports ======
router.get('/escalations', requirePortal(['support', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allEscalations = await db.select().from(escalations).orderBy(desc(escalations.createdAt));
    const columns = [
      { header: 'نوع الكيان', key: 'entityType', width: 15 },
      { header: 'السبب', key: 'reason', width: 30 },
      { header: 'الأولوية', key: 'priority', width: 12 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'تاريخ التصعيد', key: 'createdAt', width: 18 },
    ];
    const buffer = await exportToExcel(allEscalations, columns, { title: 'التصعيدات', subtitle: `إجمالي: ${allEscalations.length} تصعيد`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=escalations.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export escalations error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/vendors', requirePortal(['support', 'infrastructure', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allVendors = await db.select().from(vendors).orderBy(desc(vendors.createdAt));
    const columns = [
      { header: 'اسم المورد', key: 'name', width: 25 },
      { header: 'نوع المورد', key: 'vendorType', width: 20 },
      { header: 'جهة التواصل', key: 'contactPerson', width: 20 },
      { header: 'البريد الإلكتروني', key: 'contactEmail', width: 25 },
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'التقييم', key: 'rating', width: 10 },
    ];
    const buffer = await exportToExcel(allVendors, columns, { title: 'الموردون', subtitle: `إجمالي: ${allVendors.length} مورد`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=vendors.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export vendors error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/sla', requirePortal(['support', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allSLA = await db.select().from(slaAgreements).orderBy(desc(slaAgreements.createdAt));
    const columns = [
      { header: 'اسم الاتفاقية', key: 'title', width: 30 },
      { header: 'نوع الخدمة', key: 'serviceType', width: 15 },
      { header: 'القيمة المستهدفة', key: 'targetValue', width: 15 },
      { header: 'الوحدة', key: 'targetUnit', width: 12 },
      { header: 'القيمة الحالية', key: 'currentValue', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];
    const buffer = await exportToExcel(allSLA, columns, { title: 'اتفاقيات مستوى الخدمة', subtitle: `إجمالي: ${allSLA.length} اتفاقية`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sla-agreements.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export SLA error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== Committee exports ======
router.get('/committee-decisions', requirePortal(['committee', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allDecisions = await db.select().from(committeeDecisions).orderBy(desc(committeeDecisions.createdAt));
    const columns = [
      { header: 'رقم القرار', key: 'decisionNumber', width: 15 },
      { header: 'العنوان', key: 'title', width: 30 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'الأولوية', key: 'priority', width: 12 },
      { header: 'تاريخ القرار', key: 'createdAt', width: 18 },
    ];
    const buffer = await exportToExcel(allDecisions, columns, { title: 'قرارات اللجان', subtitle: `إجمالي: ${allDecisions.length} قرار`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=committee-decisions.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export committee-decisions error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/committee-meetings', requirePortal(['committee', 'it_director', 'admin']), async (req: Request, res: Response) => {
  try {
    const allMeetings = await db.select().from(committeeMeetings).orderBy(desc(committeeMeetings.createdAt));
    const columns = [
      { header: 'رقم الاجتماع', key: 'meetingNumber', width: 15 },
      { header: 'عنوان الاجتماع', key: 'title', width: 30 },
      { header: 'التاريخ', key: 'scheduledDate', width: 15 },
      { header: 'الوقت', key: 'startTime', width: 12 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'الموقع', key: 'location', width: 20 },
    ];
    const buffer = await exportToExcel(allMeetings, columns, { title: 'اجتماعات اللجان', subtitle: `إجمالي: ${allMeetings.length} اجتماع`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=committee-meetings.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export committee-meetings error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== KPIs (all managers) ======
router.get('/kpis', requirePortal(['admin', 'it_director', 'dmo']), async (req: Request, res: Response) => {
  try {
    const allKPIs = await db.select().from(kpiMetrics).orderBy(desc(kpiMetrics.createdAt));
    const columns = [
      { header: 'المؤشر', key: 'metricName', width: 30 },
      { header: 'النوع', key: 'metricType', width: 15 },
      { header: 'القيمة الفعلية', key: 'actualValue', width: 15 },
      { header: 'القيمة المستهدفة', key: 'targetValue', width: 15 },
      { header: 'الوحدة', key: 'unit', width: 12 },
      { header: 'الفترة', key: 'period', width: 12 },
      { header: 'الاتجاه', key: 'trend', width: 12 },
    ];
    const buffer = await exportToExcel(allKPIs, columns, { title: 'مؤشرات الأداء', subtitle: `إجمالي: ${allKPIs.length} مؤشر`, rtl: true });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=kpis.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export KPIs error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

// ====== IT Referrals export ======
router.get('/it-referrals', requirePortal(['admin', 'it_director']), async (req: Request, res: Response) => {
  try {
    const allReferrals = await db.select().from(itReferrals).orderBy(desc(itReferrals.createdAt));
    const buffer = await exportReferrals(allReferrals);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=it-referrals.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Export referrals error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في تصدير البيانات' });
  }
});

router.get('/weekly-report', requirePortal(['admin', 'it_director']), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const [
      allTickets, allTasks, allProjects, allReferrals_data,
    ] = await Promise.all([
      db.select().from(itTickets).where(isNull(itTickets.deletedAt)).orderBy(desc(itTickets.createdAt)),
      db.select().from(tasks).where(isNull(tasks.deletedAt)).orderBy(desc(tasks.createdAt)),
      db.select().from(itProjects).where(isNull(itProjects.deletedAt)).orderBy(desc(itProjects.createdAt)),
      db.select().from(itReferrals).orderBy(desc(itReferrals.createdAt)),
    ]);

    const thisWeekTickets = allTickets.filter((t: any) => new Date(t.createdAt) >= thisWeekStart);
    const lastWeekTickets = allTickets.filter((t: any) => {
      const d = new Date(t.createdAt);
      return d >= lastWeekStart && d < thisWeekStart;
    });
    const thisWeekTasks = allTasks.filter((t: any) => new Date(t.createdAt) >= thisWeekStart);
    const lastWeekTasks = allTasks.filter((t: any) => {
      const d = new Date(t.createdAt);
      return d >= lastWeekStart && d < thisWeekStart;
    });
    const thisWeekResolved = allTickets.filter((t: any) =>
      ['resolved', 'closed'].includes((t.status || '').toLowerCase()) &&
      t.updatedAt && new Date(t.updatedAt) >= thisWeekStart
    );
    const lastWeekResolved = allTickets.filter((t: any) =>
      ['resolved', 'closed'].includes((t.status || '').toLowerCase()) &&
      t.updatedAt && new Date(t.updatedAt) >= lastWeekStart && new Date(t.updatedAt) < thisWeekStart
    );
    const completedTasksThisWeek = allTasks.filter((t: any) =>
      ['completed', 'done'].includes((t.status || '').toLowerCase()) &&
      t.updatedAt && new Date(t.updatedAt) >= thisWeekStart
    );
    const completedTasksLastWeek = allTasks.filter((t: any) =>
      ['completed', 'done'].includes((t.status || '').toLowerCase()) &&
      t.updatedAt && new Date(t.updatedAt) >= lastWeekStart && new Date(t.updatedAt) < thisWeekStart
    );

    const openTickets = allTickets.filter((t: any) => ['open', 'in_progress', 'assigned'].includes((t.status || '').toLowerCase()));
    const overdueTasks = allTasks.filter((t: any) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now && !['completed', 'done'].includes((t.status || '').toLowerCase());
    });
    const activeProjects = allProjects.filter((p: any) => ['planning', 'in_progress'].includes((p.status || '').toLowerCase()));
    const pendingReferrals = allReferrals_data.filter((r: any) => !['completed', 'closed', 'rejected'].includes((r.status || '').toLowerCase()));

    const trendPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const pct = Math.round(((curr - prev) / prev) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Control Hub - JCSA';
    workbook.created = now;

    const ws = workbook.addWorksheet('التقرير الأسبوعي', { views: [{ rightToLeft: true }] });
    ws.columns = [
      { width: 35 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 },
    ];

    const titleRow = ws.addRow(['التقرير الأسبوعي للعمليات - Control Hub']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 5);
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 35;

    const dateRow = ws.addRow([`الفترة: ${thisWeekStart.toLocaleDateString('ar-SA')} - ${now.toLocaleDateString('ar-SA')}`]);
    ws.mergeCells(dateRow.number, 1, dateRow.number, 5);
    dateRow.getCell(1).font = { size: 11, color: { argb: 'FF64748B' } };
    dateRow.getCell(1).alignment = { horizontal: 'center' };
    ws.addRow([]);

    const sectionRow = ws.addRow(['ملخص مقارنة الأسبوع']);
    ws.mergeCells(sectionRow.number, 1, sectionRow.number, 5);
    sectionRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFC9A227' } };
    sectionRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2248' } };
    sectionRow.height = 28;

    const hdr = ws.addRow(['المؤشر', 'هذا الأسبوع', 'الأسبوع الماضي', 'التغيير', 'الحالة']);
    hdr.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254A8F' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFC9A227' } } };
    });

    const kpiRows = [
      ['تذاكر جديدة', thisWeekTickets.length, lastWeekTickets.length, trendPct(thisWeekTickets.length, lastWeekTickets.length), thisWeekTickets.length <= lastWeekTickets.length ? '✅ تحسن' : '⚠️ زيادة'],
      ['تذاكر محلولة', thisWeekResolved.length, lastWeekResolved.length, trendPct(thisWeekResolved.length, lastWeekResolved.length), thisWeekResolved.length >= lastWeekResolved.length ? '✅ تحسن' : '⚠️ تراجع'],
      ['مهام جديدة', thisWeekTasks.length, lastWeekTasks.length, trendPct(thisWeekTasks.length, lastWeekTasks.length), '—'],
      ['مهام مكتملة', completedTasksThisWeek.length, completedTasksLastWeek.length, trendPct(completedTasksThisWeek.length, completedTasksLastWeek.length), completedTasksThisWeek.length >= completedTasksLastWeek.length ? '✅ تحسن' : '⚠️ تراجع'],
    ];
    kpiRows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((c, col) => {
        c.alignment = { horizontal: col === 1 ? 'right' : 'center', vertical: 'middle' };
        c.font = { size: 11 };
        if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    });

    ws.addRow([]);
    const statsSection = ws.addRow(['الحالة الحالية']);
    ws.mergeCells(statsSection.number, 1, statsSection.number, 5);
    statsSection.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFC9A227' } };
    statsSection.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2248' } };
    statsSection.height = 28;

    const statsData = [
      ['إجمالي التذاكر', allTickets.length, 'التذاكر المفتوحة', openTickets.length, ''],
      ['إجمالي المهام', allTasks.length, 'المهام المتأخرة', overdueTasks.length, overdueTasks.length > 0 ? '⚠️' : '✅'],
      ['إجمالي المشاريع', allProjects.length, 'المشاريع النشطة', activeProjects.length, ''],
      ['إجمالي الإحالات', allReferrals_data.length, 'الإحالات المعلقة', pendingReferrals.length, ''],
    ];
    statsData.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((c, col) => {
        c.alignment = { horizontal: col === 1 || col === 3 ? 'right' : 'center', vertical: 'middle' };
        c.font = { size: 11, bold: col === 2 || col === 4 };
        if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E8' } };
      });
    });

    ws.addRow([]);
    const deptSection = ws.addRow(['توزيع التذاكر حسب الأقسام']);
    ws.mergeCells(deptSection.number, 1, deptSection.number, 5);
    deptSection.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFC9A227' } };
    deptSection.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2248' } };
    deptSection.height = 28;

    const deptNames: Record<number, string> = { 1: 'البنية التحتية', 2: 'الأمن السيبراني', 3: 'التحول الرقمي', 4: 'الدعم الفني', 5: 'إدارة البيانات' };
    const deptHdr = ws.addRow(['القسم', 'إجمالي التذاكر', 'مفتوحة', 'محلولة', 'هذا الأسبوع']);
    deptHdr.eachCell(c => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254A8F' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    [1, 2, 3, 4, 5].forEach(deptId => {
      const deptTickets = allTickets.filter((t: any) => t.departmentId === deptId);
      const deptOpen = deptTickets.filter((t: any) => ['open', 'in_progress', 'assigned'].includes((t.status || '').toLowerCase()));
      const deptResolved = deptTickets.filter((t: any) => ['resolved', 'closed'].includes((t.status || '').toLowerCase()));
      const deptThisWeek = deptTickets.filter((t: any) => new Date(t.createdAt) >= thisWeekStart);
      ws.addRow([deptNames[deptId] || `قسم ${deptId}`, deptTickets.length, deptOpen.length, deptResolved.length, deptThisWeek.length]);
    });

    ws.addRow([]);
    const footerRow = ws.addRow([`تم الإنشاء: ${now.toLocaleDateString('ar-SA')} ${now.toLocaleTimeString('ar-SA')} — Control Hub © JCSA`]);
    ws.mergeCells(footerRow.number, 1, footerRow.number, 5);
    footerRow.getCell(1).font = { size: 9, color: { argb: 'FF94A3B8' }, italic: true };
    footerRow.getCell(1).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=weekly-operations-report.xlsx');
    res.send(buffer);
  } catch (error: any) {
    logger.error('Weekly report export error:', { message: error?.message });
    res.status(500).json({ error: 'فشل في إنشاء التقرير الأسبوعي' });
  }
});

export default router;
