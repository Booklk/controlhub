/**
 * Compliance API Routes - واجهات الامتثال
 * PDPL & NDMO Controls
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  consentRecords, 
  dataBreaches, 
  processingRecords,
  ndmoAssessments,
  dataClassifications,
  privacyNotices,
  dataSubjectRequests,
  auditLogs
} from "@shared/schema";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import { requireView, requireCreate, requireUpdate, AuthenticatedRequest } from "../middleware/permissions";
import { PDPLRequirements, PDPLLabels } from "@shared/compliance/pdpl";
import { NDMODomains, NDMOPrinciples, NDMOLabels, ImplementationRoadmap } from "@shared/compliance/ndmo";
import { RESOURCES } from "@shared/permissions";
import { logger } from "../security-middleware";

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!(req as AuthenticatedRequest).user) {
    return res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" });
  }
  next();
};

const router = Router();

function parseIdLocal(raw: string, res: Response): number | null {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    res.status(400).json({ error: 'معرف غير صالح' });
    return null;
  }
  return n;
}

// ==================== PDPL Endpoints ====================

// Get PDPL requirements and labels
router.get("/pdpl/requirements", requireAuth, async (req: Request, res: Response) => {
  res.json({
    requirements: PDPLRequirements,
    labels: PDPLLabels,
    effective_date: "2024-09-14",
    regulator: "SDAIA - الهيئة السعودية للبيانات والذكاء الاصطناعي"
  });
});

// Get consent records
router.get("/pdpl/consents", requireAuth, requireView(RESOURCES.PDPL_CONSENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = await db.select()
      .from(consentRecords)
      .orderBy(desc(consentRecords.createdAt))
      .limit(100);
    
    res.json(records);
  } catch (error) {
    logger.error("Error fetching consent records:", { error });
    res.status(500).json({ error: "فشل في جلب سجلات الموافقة" });
  }
});

// Create consent record
router.post("/pdpl/consents", requireAuth, requireCreate(RESOURCES.PDPL_CONSENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { purpose, purposeAr, legalBasis, dataTypes, dataSubjectId, expiresAt } = req.body;
    
    const [record] = await db.insert(consentRecords).values({
      dataSubjectId,
      purpose,
      purposeAr,
      legalBasis,
      dataTypes,
      givenAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
      isActive: true,
      version: 1
    }).returning();
    
    res.status(201).json({ success: true, id: record.id });
  } catch (error) {
    logger.error("Error creating consent record:", { error });
    res.status(500).json({ error: "فشل في إنشاء سجل الموافقة" });
  }
});

// Withdraw consent
router.patch("/pdpl/consents/:id/withdraw", requireAuth, requireUpdate(RESOURCES.PDPL_CONSENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseIdLocal(req.params.id as string, res);
    if (!id) return;
    
    await db.update(consentRecords)
      .set({ 
        withdrawnAt: new Date(),
        isActive: false
      })
      .where(eq(consentRecords.id, id));
    
    res.json({ success: true, message: "تم سحب الموافقة بنجاح" });
  } catch (error) {
    logger.error("Error withdrawing consent:", { error });
    res.status(500).json({ error: "فشل في سحب الموافقة" });
  }
});

// Get data subject requests
router.get("/pdpl/dsr", requireAuth, requireView(RESOURCES.PDPL_CONSENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await db.select()
      .from(dataSubjectRequests)
      .orderBy(desc(dataSubjectRequests.createdAt))
      .limit(100);
    
    res.json(requests);
  } catch (error) {
    logger.error("Error fetching DSR:", { error });
    res.status(500).json({ error: "فشل في جلب طلبات أصحاب البيانات" });
  }
});

// Get data breaches
router.get("/pdpl/breaches", requireAuth, requireView(RESOURCES.PDPL_BREACHES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const breaches = await db.select()
      .from(dataBreaches)
      .orderBy(desc(dataBreaches.detectedAt))
      .limit(50);
    
    res.json(breaches);
  } catch (error) {
    logger.error("Error fetching breaches:", { error });
    res.status(500).json({ error: "فشل في جلب تقارير الاختراقات" });
  }
});

// Report data breach
router.post("/pdpl/breaches", requireAuth, requireCreate(RESOURCES.PDPL_BREACHES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      severity, affectedRecords, affectedDataTypes, 
      description, descriptionAr, rootCause 
    } = req.body;
    
    const [breach] = await db.insert(dataBreaches).values({
      detectedAt: new Date(),
      severity,
      affectedRecords,
      affectedDataTypes,
      description,
      descriptionAr,
      rootCause,
      status: "detected",
      reportedBy: req.user?.id
    }).returning();
    
    await db.insert(auditLogs).values({
      userId: req.user?.id,
      action: "data_breach_reported",
      actionCategory: "security",
      resource: "data_breaches",
      entityType: "data_breach",
      entityId: breach.id,
      severity: severity === "critical" ? "critical" : "high",
      details: `Data breach reported: ${affectedRecords} records affected`
    });
    
    res.status(201).json({ success: true, id: breach.id });
  } catch (error) {
    logger.error("Error reporting breach:", { error });
    res.status(500).json({ error: "فشل في تسجيل الاختراق" });
  }
});

// Get processing records (RoPA)
router.get("/pdpl/ropa", requireAuth, requireView(RESOURCES.PDPL_ROPA), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = await db.select()
      .from(processingRecords)
      .orderBy(desc(processingRecords.createdAt))
      .limit(100);
    
    res.json(records);
  } catch (error) {
    logger.error("Error fetching RoPA:", { error });
    res.status(500).json({ error: "فشل في جلب سجلات المعالجة" });
  }
});

// Create processing record
router.post("/pdpl/ropa", requireAuth, requireCreate(RESOURCES.PDPL_ROPA), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      activityName, activityNameAr, purpose, purposeAr,
      legalBasis, dataCategories, retentionPeriod,
      dpiaRequired, responsible
    } = req.body;
    
    const [record] = await db.insert(processingRecords).values({
      activityName,
      activityNameAr,
      purpose,
      purposeAr,
      legalBasis,
      dataCategories,
      retentionPeriod,
      dpiaRequired: dpiaRequired || false,
      dpiaCompleted: false,
      responsible,
      createdBy: req.user?.id
    }).returning();
    
    res.status(201).json({ success: true, id: record.id });
  } catch (error) {
    logger.error("Error creating RoPA:", { error });
    res.status(500).json({ error: "فشل في إنشاء سجل المعالجة" });
  }
});

// ==================== NDMO Endpoints ====================

// Get NDMO domains and principles
router.get("/ndmo/framework", requireAuth, async (req: Request, res: Response) => {
  res.json({
    domains: NDMODomains,
    principles: NDMOPrinciples,
    labels: NDMOLabels,
    roadmap: ImplementationRoadmap,
    totalDomains: 15,
    totalControls: 77,
    totalSpecifications: 191
  });
});

// Get NDMO assessments
router.get("/ndmo/assessments", requireAuth, requireView(RESOURCES.NDMO_ASSESSMENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fiscalYear = req.query.fiscalYear as string | undefined;
    
    let assessments;
    if (fiscalYear) {
      assessments = await db.select()
        .from(ndmoAssessments)
        .where(eq(ndmoAssessments.fiscalYear, parseInt(fiscalYear)))
        .orderBy(desc(ndmoAssessments.assessedAt))
        .limit(50);
    } else {
      assessments = await db.select()
        .from(ndmoAssessments)
        .orderBy(desc(ndmoAssessments.assessedAt))
        .limit(50);
    }
    
    res.json(assessments);
  } catch (error) {
    logger.error("Error fetching NDMO assessments:", { error });
    res.status(500).json({ error: "فشل في جلب تقييمات NDMO" });
  }
});

// Create NDMO assessment
router.post("/ndmo/assessments", requireAuth, requireCreate(RESOURCES.NDMO_ASSESSMENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { domainId, fiscalQuarter, fiscalYear, specifications, notes } = req.body;
    
    // Calculate overall score
    let totalScore = 0;
    if (specifications && specifications.length > 0) {
      totalScore = specifications.reduce((sum: number, spec: any) => sum + (spec.score || 0), 0) / specifications.length;
    }
    
    const [assessment] = await db.insert(ndmoAssessments).values({
      domainId,
      fiscalQuarter,
      fiscalYear,
      specifications: specifications || [],
      overallScore: Math.round(totalScore),
      assessedBy: req.user?.id,
      notes
    }).returning();
    
    res.status(201).json({ success: true, id: assessment.id });
  } catch (error) {
    logger.error("Error creating NDMO assessment:", { error });
    res.status(500).json({ error: "فشل في إنشاء تقييم NDMO" });
  }
});

// Submit assessment to NDMO
router.patch("/ndmo/assessments/:id/submit", requireAuth, requireUpdate(RESOURCES.NDMO_ASSESSMENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseIdLocal(req.params.id as string, res);
    if (!id) return;
    
    await db.update(ndmoAssessments)
      .set({ 
        submittedToNdmo: true,
        submittedAt: new Date()
      })
      .where(eq(ndmoAssessments.id, id));
    
    res.json({ success: true, message: "تم تقديم التقييم إلى NDMO بنجاح" });
  } catch (error) {
    logger.error("Error submitting to NDMO:", { error });
    res.status(500).json({ error: "فشل في تقديم التقييم" });
  }
});

// Get compliance dashboard summary
router.get("/ndmo/dashboard", requireAuth, requireView(RESOURCES.NDMO_ASSESSMENTS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get assessments for current year
    const assessments = await db.select()
      .from(ndmoAssessments)
      .where(eq(ndmoAssessments.fiscalYear, currentYear));
    
    // Calculate domain coverage
    const assessedDomains = new Set(assessments.map((a: any) => a.domainId));
    
    // Calculate average compliance score
    const avgScore = assessments.length > 0 
      ? Math.round(assessments.reduce((sum: number, a: any) => sum + (a.overallScore || 0), 0) / assessments.length)
      : 0;
    
    res.json({
      fiscalYear: currentYear,
      domainsAssessed: assessedDomains.size,
      totalDomains: 15,
      averageComplianceScore: avgScore,
      assessmentsCount: assessments.length,
      submittedCount: assessments.filter((a: any) => a.submittedToNdmo).length
    });
  } catch (error) {
    logger.error("Error fetching NDMO dashboard:", { error });
    res.status(500).json({ error: "فشل في جلب لوحة NDMO" });
  }
});

// ==================== Data Classification ====================

// Get data classifications
router.get("/classifications", requireAuth, requireView(RESOURCES.DATA_CLASSIFICATIONS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classifications = await db.select()
      .from(dataClassifications)
      .orderBy(desc(dataClassifications.createdAt))
      .limit(100);
    
    res.json(classifications);
  } catch (error) {
    logger.error("Error fetching classifications:", { error });
    res.status(500).json({ error: "فشل في جلب التصنيفات" });
  }
});

// Create data classification
router.post("/classifications", requireAuth, requireCreate(RESOURCES.DATA_CLASSIFICATIONS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      assetName, assetNameAr, assetType, classificationLevel,
      impactNational, impactOrganization, impactIndividual,
      containsPersonalData, containsSensitiveData,
      dataOwner, handlingInstructions, handlingInstructionsAr
    } = req.body;
    
    const [classification] = await db.insert(dataClassifications).values({
      assetName,
      assetNameAr,
      assetType,
      classificationLevel,
      impactNational,
      impactOrganization,
      impactIndividual,
      containsPersonalData: containsPersonalData || false,
      containsSensitiveData: containsSensitiveData || false,
      dataOwner,
      handlingInstructions,
      handlingInstructionsAr,
      approvedBy: req.user?.id
    }).returning();
    
    res.status(201).json({ success: true, id: classification.id });
  } catch (error) {
    logger.error("Error creating classification:", { error });
    res.status(500).json({ error: "فشل في إنشاء التصنيف" });
  }
});

// ==================== Privacy Notices ====================

// Get privacy notices
router.get("/privacy-notices", requireAuth, requireView(RESOURCES.PRIVACY_NOTICES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notices = await db.select()
      .from(privacyNotices)
      .where(eq(privacyNotices.isActive, true))
      .orderBy(desc(privacyNotices.effectiveDate))
      .limit(10);
    
    res.json(notices);
  } catch (error) {
    logger.error("Error fetching privacy notices:", { error });
    res.status(500).json({ error: "فشل في جلب إشعارات الخصوصية" });
  }
});

// Get active privacy notice
router.get("/privacy-notices/active", async (req: Request, res: Response) => {
  try {
    const [notice] = await db.select()
      .from(privacyNotices)
      .where(and(
        eq(privacyNotices.isActive, true),
        lte(privacyNotices.effectiveDate, new Date())
      ))
      .orderBy(desc(privacyNotices.effectiveDate))
      .limit(1);
    
    if (!notice) {
      return res.status(404).json({ error: "لا يوجد إشعار خصوصية فعال" });
    }
    
    res.json(notice);
  } catch (error) {
    logger.error("Error fetching active privacy notice:", { error });
    res.status(500).json({ error: "فشل في جلب إشعار الخصوصية" });
  }
});

// Create privacy notice
router.post("/privacy-notices", requireAuth, requireCreate(RESOURCES.PRIVACY_NOTICES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      version, effectiveDate, contentEn, contentAr,
      purposes, dataCategories, thirdPartySharing,
      crossBorderTransfers, dataSubjectRights,
      dpoName, dpoEmail, contactAddress
    } = req.body;
    
    const [notice] = await db.insert(privacyNotices).values({
      version,
      effectiveDate: new Date(effectiveDate),
      contentEn,
      contentAr,
      purposes: purposes || [],
      dataCategories: dataCategories || [],
      thirdPartySharing: thirdPartySharing || false,
      crossBorderTransfers: crossBorderTransfers || false,
      dataSubjectRights: dataSubjectRights || [],
      dpoName,
      dpoEmail,
      contactAddress,
      isActive: true,
      createdBy: req.user?.id
    }).returning();
    
    res.status(201).json({ success: true, id: notice.id });
  } catch (error) {
    logger.error("Error creating privacy notice:", { error });
    res.status(500).json({ error: "فشل في إنشاء إشعار الخصوصية" });
  }
});

// ==================== Compliance Overview ====================

// Get overall compliance status
router.get("/overview", requireAuth, requireView(RESOURCES.COMPLIANCE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // PDPL Stats
    const [consentCount] = await db.select({ count: sql<number>`count(*)` })
      .from(consentRecords)
      .where(eq(consentRecords.isActive, true));
    
    const [breachCount] = await db.select({ count: sql<number>`count(*)` })
      .from(dataBreaches)
      .where(eq(dataBreaches.status, "detected"));
    
    const [ropaCount] = await db.select({ count: sql<number>`count(*)` })
      .from(processingRecords);
    
    // NDMO Stats
    const ndmoStats = await db.select()
      .from(ndmoAssessments)
      .where(eq(ndmoAssessments.fiscalYear, currentYear));
    
    const assessedDomains = new Set(ndmoStats.map((a: any) => a.domainId));
    const avgNdmoScore = ndmoStats.length > 0 
      ? Math.round(ndmoStats.reduce((sum: number, a: any) => sum + (a.overallScore || 0), 0) / ndmoStats.length)
      : 0;
    
    // Classification Stats
    const [classificationCount] = await db.select({ count: sql<number>`count(*)` })
      .from(dataClassifications);
    
    res.json({
      pdpl: {
        activeConsents: Number(consentCount.count) || 0,
        openBreaches: Number(breachCount.count) || 0,
        processingRecords: Number(ropaCount.count) || 0,
        complianceStatus: breachCount.count === 0 ? "compliant" : "action_required"
      },
      ndmo: {
        domainsAssessed: assessedDomains.size,
        totalDomains: 15,
        averageScore: avgNdmoScore,
        submittedAssessments: ndmoStats.filter((a: any) => a.submittedToNdmo).length
      },
      dataClassification: {
        totalAssets: Number(classificationCount.count) || 0
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error fetching compliance overview:", { error });
    res.status(500).json({ error: "فشل في جلب نظرة عامة على الامتثال" });
  }
});

export default router;
