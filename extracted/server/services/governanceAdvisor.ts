import { db } from "../db";
import { governanceFrameworks, governanceDomains, governanceControls, advisorResponses, governanceControlImplementations } from "@shared/schema";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { logger } from "../security-middleware";
import { exportToExcel } from "./exportService";

export class GovernanceAdvisor {

  async search(query: string, portal?: string, framework?: string): Promise<{
    controls: any[];
    advisorTips: any[];
    relatedDomains: any[];
  }> {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) {
      return { controls: [], advisorTips: [], relatedDomains: [] };
    }

    const searchConditions = keywords.map(kw => 
      or(
        ilike(governanceControls.nameAr, `%${kw}%`),
        ilike(governanceControls.nameEn, `%${kw}%`),
        ilike(governanceControls.descriptionAr, `%${kw}%`),
        ilike(governanceControls.description, `%${kw}%`),
        ilike(governanceControls.implementationGuideAr, `%${kw}%`),
        ilike(governanceControls.implementationGuide, `%${kw}%`),
        sql`${governanceControls.tags}::text ILIKE ${'%' + kw + '%'}`
      )
    );

    const controls = await db.select({
      id: governanceControls.id,
      code: governanceControls.code,
      nameAr: governanceControls.nameAr,
      nameEn: governanceControls.nameEn,
      descriptionAr: governanceControls.descriptionAr,
      description: governanceControls.description,
      objectiveAr: governanceControls.objectiveAr,
      implementationGuideAr: governanceControls.implementationGuideAr,
      implementationGuide: governanceControls.implementationGuide,
      priority: governanceControls.priority,
      tags: governanceControls.tags,
      applicablePortals: governanceControls.applicablePortals,
      frameworkId: governanceControls.frameworkId,
      domainId: governanceControls.domainId,
      domainName: governanceDomains.nameAr,
      domainNameEn: governanceDomains.nameEn,
      frameworkCode: governanceFrameworks.code,
      frameworkName: governanceFrameworks.nameAr,
    })
    .from(governanceControls)
    .leftJoin(governanceDomains, eq(governanceControls.domainId, governanceDomains.id))
    .leftJoin(governanceFrameworks, eq(governanceControls.frameworkId, governanceFrameworks.id))
    .where(and(
      or(...searchConditions),
      framework ? eq(governanceFrameworks.code, framework) : undefined
    ))
    .orderBy(governanceControls.sortOrder)
    .limit(30);

    const rankedControls = this.rankResults(controls, keywords, undefined, portal);

    const advisorConditions = keywords.map(kw =>
      or(
        ilike(advisorResponses.questionPattern, `%${kw}%`),
        sql`${advisorResponses.keywords}::text ILIKE ${'%' + kw + '%'}`,
        ilike(advisorResponses.responseAr, `%${kw}%`)
      )
    );

    const tips = await db.select().from(advisorResponses)
      .where(and(
        or(...advisorConditions),
        eq(advisorResponses.isActive, true)
      ))
      .orderBy(advisorResponses.sortOrder)
      .limit(10);

    const rankedTips = this.rankResults(tips, keywords, ['questionPattern', 'responseAr']);

    const domainConditions = keywords.map(kw =>
      or(
        ilike(governanceDomains.nameAr, `%${kw}%`),
        ilike(governanceDomains.nameEn, `%${kw}%`),
        ilike(governanceDomains.descriptionAr, `%${kw}%`)
      )
    );

    const domains = await db.select({
      id: governanceDomains.id,
      code: governanceDomains.code,
      nameAr: governanceDomains.nameAr,
      nameEn: governanceDomains.nameEn,
      descriptionAr: governanceDomains.descriptionAr,
      frameworkCode: governanceFrameworks.code,
      frameworkName: governanceFrameworks.nameAr,
    })
    .from(governanceDomains)
    .leftJoin(governanceFrameworks, eq(governanceDomains.frameworkId, governanceFrameworks.id))
    .where(or(...domainConditions))
    .limit(10);

    return {
      controls: rankedControls,
      advisorTips: rankedTips,
      relatedDomains: domains,
    };
  }

  async getFrameworks(): Promise<any[]> {
    return db.select().from(governanceFrameworks).where(eq(governanceFrameworks.isActive, true));
  }

  async getFrameworkDetail(code: string): Promise<any> {
    const [fw] = await db.select().from(governanceFrameworks).where(eq(governanceFrameworks.code, code));
    if (!fw) return null;
    const domains = await db.select().from(governanceDomains)
      .where(eq(governanceDomains.frameworkId, fw.id))
      .orderBy(governanceDomains.sortOrder);
    const controls = await db.select().from(governanceControls)
      .where(eq(governanceControls.frameworkId, fw.id))
      .orderBy(governanceControls.sortOrder);
    return { ...fw, domains, controls };
  }

  async getDomainControls(domainId: number): Promise<any[]> {
    return db.select({
      id: governanceControls.id,
      code: governanceControls.code,
      nameAr: governanceControls.nameAr,
      nameEn: governanceControls.nameEn,
      descriptionAr: governanceControls.descriptionAr,
      description: governanceControls.description,
      objectiveAr: governanceControls.objectiveAr,
      implementationGuideAr: governanceControls.implementationGuideAr,
      implementationGuide: governanceControls.implementationGuide,
      priority: governanceControls.priority,
      tags: governanceControls.tags,
      applicablePortals: governanceControls.applicablePortals,
    })
    .from(governanceControls)
    .where(eq(governanceControls.domainId, domainId))
    .orderBy(governanceControls.sortOrder);
  }

  async getControlDetail(controlId: number): Promise<any> {
    const [control] = await db.select({
      id: governanceControls.id,
      code: governanceControls.code,
      nameAr: governanceControls.nameAr,
      nameEn: governanceControls.nameEn,
      descriptionAr: governanceControls.descriptionAr,
      description: governanceControls.description,
      objectiveAr: governanceControls.objectiveAr,
      objective: governanceControls.objective,
      implementationGuideAr: governanceControls.implementationGuideAr,
      implementationGuide: governanceControls.implementationGuide,
      priority: governanceControls.priority,
      tags: governanceControls.tags,
      applicablePortals: governanceControls.applicablePortals,
      domainName: governanceDomains.nameAr,
      domainCode: governanceDomains.code,
      frameworkCode: governanceFrameworks.code,
      frameworkName: governanceFrameworks.nameAr,
    })
    .from(governanceControls)
    .leftJoin(governanceDomains, eq(governanceControls.domainId, governanceDomains.id))
    .leftJoin(governanceFrameworks, eq(governanceControls.frameworkId, governanceFrameworks.id))
    .where(eq(governanceControls.id, controlId));
    return control || null;
  }

  async getStats(): Promise<any> {
    const frameworks = await db.select().from(governanceFrameworks).where(eq(governanceFrameworks.isActive, true));
    const totalDomains = await db.select({ count: sql<number>`count(*)::int` }).from(governanceDomains);
    const totalControls = await db.select({ count: sql<number>`count(*)::int` }).from(governanceControls);
    const totalAdvisorResponses = await db.select({ count: sql<number>`count(*)::int` }).from(advisorResponses);
    return {
      frameworks: frameworks.length,
      frameworksList: frameworks.map((f: any) => ({ code: f.code, nameAr: f.nameAr, totalDomains: f.totalDomains, totalControls: f.totalControls })),
      totalDomains: totalDomains[0]?.count || 0,
      totalControls: totalControls[0]?.count || 0,
      totalAdvisorResponses: totalAdvisorResponses[0]?.count || 0,
    };
  }

  async getImplementationStatus(controlId: number, portal: string): Promise<any> {
    const [impl] = await db.select()
      .from(governanceControlImplementations)
      .where(and(
        eq(governanceControlImplementations.controlId, controlId),
        eq(governanceControlImplementations.portal, portal)
      ));
    return impl || null;
  }

  async getPortalImplementations(portal: string): Promise<any[]> {
    return db.select({
      id: governanceControlImplementations.id,
      controlId: governanceControlImplementations.controlId,
      portal: governanceControlImplementations.portal,
      status: governanceControlImplementations.status,
      notes: governanceControlImplementations.notes,
      evidence: governanceControlImplementations.evidence,
      updatedAt: governanceControlImplementations.updatedAt,
      controlCode: governanceControls.code,
      controlNameAr: governanceControls.nameAr,
      frameworkCode: governanceFrameworks.code,
    })
    .from(governanceControlImplementations)
    .leftJoin(governanceControls, eq(governanceControlImplementations.controlId, governanceControls.id))
    .leftJoin(governanceFrameworks, eq(governanceControls.frameworkId, governanceFrameworks.id))
    .where(eq(governanceControlImplementations.portal, portal));
  }

  async upsertImplementation(controlId: number, portal: string, data: {
    status: string;
    notes?: string;
    evidence?: string;
    updatedBy?: number;
  }): Promise<any> {
    const existing = await this.getImplementationStatus(controlId, portal);
    if (existing) {
      const [updated] = await db.update(governanceControlImplementations)
        .set({
          status: data.status,
          notes: data.notes || existing.notes,
          evidence: data.evidence || existing.evidence,
          updatedBy: data.updatedBy || existing.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(governanceControlImplementations.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(governanceControlImplementations)
        .values({
          controlId,
          portal,
          status: data.status,
          notes: data.notes || null,
          evidence: data.evidence || null,
          updatedBy: data.updatedBy || null,
        })
        .returning();
      return created;
    }
  }

  async getPortalComplianceStats(portal: string): Promise<any> {
    const portalControls = await db.select({
      id: governanceControls.id,
      code: governanceControls.code,
      nameAr: governanceControls.nameAr,
      priority: governanceControls.priority,
      applicablePortals: governanceControls.applicablePortals,
      frameworkCode: governanceFrameworks.code,
    })
    .from(governanceControls)
    .leftJoin(governanceFrameworks, eq(governanceControls.frameworkId, governanceFrameworks.id))
    .where(sql`${governanceControls.applicablePortals}::text ILIKE ${'%' + portal + '%'}`);

    const implementations = await this.getPortalImplementations(portal);
    const implMap = new Map(implementations.map((i: any) => [i.controlId, i.status]));

    let implemented = 0;
    let partial = 0;
    let notImplemented = 0;

    for (const ctrl of portalControls) {
      const status = implMap.get(ctrl.id) || 'not_implemented';
      if (status === 'implemented') implemented++;
      else if (status === 'partial') partial++;
      else notImplemented++;
    }

    const total = portalControls.length;
    const compliancePercentage = total > 0 ? Math.round(((implemented + partial * 0.5) / total) * 100) : 0;

    const byFramework: Record<string, { total: number; implemented: number; partial: number; notImplemented: number }> = {};
    for (const ctrl of portalControls) {
      const fw = ctrl.frameworkCode || 'unknown';
      if (!byFramework[fw]) byFramework[fw] = { total: 0, implemented: 0, partial: 0, notImplemented: 0 };
      byFramework[fw].total++;
      const status = implMap.get(ctrl.id) || 'not_implemented';
      if (status === 'implemented') byFramework[fw].implemented++;
      else if (status === 'partial') byFramework[fw].partial++;
      else byFramework[fw].notImplemented++;
    }

    return {
      total,
      implemented,
      partial,
      notImplemented,
      compliancePercentage,
      byFramework,
    };
  }

  async exportControlsExcel(portal?: string, framework?: string): Promise<Buffer> {
    let query = db.select({
      id: governanceControls.id,
      code: governanceControls.code,
      nameAr: governanceControls.nameAr,
      nameEn: governanceControls.nameEn,
      descriptionAr: governanceControls.descriptionAr,
      priority: governanceControls.priority,
      applicablePortals: governanceControls.applicablePortals,
      domainName: governanceDomains.nameAr,
      domainCode: governanceDomains.code,
      frameworkCode: governanceFrameworks.code,
      frameworkName: governanceFrameworks.nameAr,
    })
    .from(governanceControls)
    .leftJoin(governanceDomains, eq(governanceControls.domainId, governanceDomains.id))
    .leftJoin(governanceFrameworks, eq(governanceControls.frameworkId, governanceFrameworks.id));

    let conditions: any[] = [];
    if (framework) {
      conditions.push(eq(governanceFrameworks.code, framework));
    }
    if (portal) {
      conditions.push(sql`${governanceControls.applicablePortals}::text ILIKE ${'%' + portal + '%'}`);
    }

    const controls = conditions.length > 0
      ? await (query as any).where(and(...conditions)).orderBy(governanceControls.sortOrder)
      : await (query as any).orderBy(governanceControls.sortOrder);

    let implementations: any[] = [];
    if (portal) {
      implementations = await this.getPortalImplementations(portal);
    }
    const implMap = new Map(implementations.map((i: any) => [i.controlId, i]));

    const STATUS_LABELS: Record<string, string> = {
      'implemented': 'مطبق',
      'partial': 'مطبق جزئياً',
      'not_implemented': 'غير مطبق',
    };

    const PRIORITY_LABELS: Record<string, string> = {
      'critical': 'حرج',
      'high': 'عالي',
      'medium': 'متوسط',
      'low': 'منخفض',
    };

    const data = controls.map((ctrl: any) => {
      const impl = implMap.get(ctrl.id);
      return {
        frameworkCode: ctrl.frameworkCode || '',
        frameworkName: ctrl.frameworkName || '',
        domainName: ctrl.domainName || '',
        code: ctrl.code || '',
        nameAr: ctrl.nameAr || '',
        nameEn: ctrl.nameEn || '',
        descriptionAr: ctrl.descriptionAr || '',
        priority: PRIORITY_LABELS[ctrl.priority] || ctrl.priority || '',
        status: impl ? STATUS_LABELS[impl.status] || impl.status : STATUS_LABELS['not_implemented'],
        notes: impl?.notes || '',
      };
    });

    const columns = [
      { header: 'الإطار التنظيمي', key: 'frameworkCode', width: 15 },
      { header: 'اسم الإطار', key: 'frameworkName', width: 25 },
      { header: 'المجال', key: 'domainName', width: 25 },
      { header: 'رمز الضابط', key: 'code', width: 15 },
      { header: 'اسم الضابط (عربي)', key: 'nameAr', width: 35 },
      { header: 'اسم الضابط (إنجليزي)', key: 'nameEn', width: 35 },
      { header: 'الوصف', key: 'descriptionAr', width: 45 },
      { header: 'الأولوية', key: 'priority', width: 12 },
      { header: 'حالة التطبيق', key: 'status', width: 15 },
      { header: 'ملاحظات', key: 'notes', width: 30 },
    ];

    const portalLabel = portal ? ` - ${portal}` : '';
    const frameworkLabel = framework ? ` - ${framework}` : '';

    return exportToExcel(data, columns, {
      title: `تقرير الضوابط التنظيمية${portalLabel}${frameworkLabel}`,
      subtitle: `نادي سباقات الخيل - Control Hub | ${new Date().toLocaleDateString('ar-SA')}`,
      rtl: true,
    });
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['ما', 'هو', 'هي', 'في', 'من', 'على', 'إلى', 'عن', 'أن', 'هل', 'كيف', 'لماذا', 'متى', 'أين', 'الذي', 'التي', 'الذين', 'هذا', 'هذه', 'ذلك', 'تلك', 'و', 'أو', 'لكن', 'ثم', 'حتى', 'إذا', 'لو', 'بعد', 'قبل', 'مع', 'عند', 'يجب', 'يمكن', 'لا', 'لن', 'لم', 'ليس', 'كل', 'بعض', 'أي', 'الأخرى', 'ايش', 'شنو', 'وش', 'ابي', 'ابغى', 'the', 'is', 'are', 'was', 'what', 'how', 'why', 'when', 'where', 'which', 'who', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    const words = query
      .replace(/[؟?!.,:;()]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
    
    return Array.from(new Set(words));
  }

  private rankResults(items: any[], keywords: string[], searchFields?: string[], portal?: string): any[] {
    const fields = searchFields || ['nameAr', 'nameEn', 'descriptionAr', 'description', 'implementationGuideAr'];
    
    return items.map(item => {
      let score = 0;
      for (const kw of keywords) {
        for (const field of fields) {
          const val = (item as any)[field];
          if (val && typeof val === 'string') {
            const lower = val.toLowerCase();
            const kwLower = kw.toLowerCase();
            if (lower.includes(kwLower)) {
              score += field.includes('name') ? 10 : field.includes('description') ? 5 : 2;
            }
          }
        }
        const tags = (item as any).tags;
        if (tags && JSON.stringify(tags).toLowerCase().includes(kw.toLowerCase())) {
          score += 8;
        }
      }

      if (portal && (item as any).applicablePortals) {
        const portals = (item as any).applicablePortals;
        const portalList = Array.isArray(portals) ? portals : [];
        if (portalList.includes(portal)) {
          score += 15;
          (item as any).portalRelevant = true;
        }
      }

      return { ...item, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export const governanceAdvisor = new GovernanceAdvisor();
