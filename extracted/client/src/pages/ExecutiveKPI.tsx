import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  FileText,
  FileDown
} from "lucide-react";
import { 
  adminNavGroups, 
  itDirectorNavGroups, 
  infrastructureNavGroups, 
  cybersecurityNavGroups, 
  digitalTransformationNavGroups, 
  supportNavGroups,
  dmoNavGroups
} from "@/lib/navigation";
import { useState } from "react";
import { TrendBadge } from "@/components/TrendBadge";

interface KPIData {
  departmentId: number;
  departmentName: string;
  openTickets: number;
  closedThisWeek: number;
  slaBreached: number;
  slaComplianceRate: number;
  overdueTasks: number;
  completedTasksThisMonth: number;
  avgResolutionHours: number;
  teamMembersCount: number;
  prevOpenTickets?: number;
  prevClosedThisWeek?: number;
  prevSLAComplianceRate?: number;
  prevOverdueTasks?: number;
}

export default function ExecutiveKPI() {
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data, isLoading, refetch, isFetching } = useQuery<KPIData[]>({
    queryKey: ["/api/kpi/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/kpi/summary");
      setLastUpdated(new Date());
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const getNavGroups = () => {
    if (user?.role === "system_admin") return adminNavGroups;
    if (user?.portal === "it_director") return itDirectorNavGroups;
    if (user?.portal === "infrastructure") return infrastructureNavGroups;
    if (user?.portal === "cybersecurity") return cybersecurityNavGroups;
    if (user?.portal === "digital_transformation") return digitalTransformationNavGroups;
    if (user?.portal === "support") return supportNavGroups;
    if (user?.portal === "dmo") return dmoNavGroups;
    return [];
  };

  const getSLAColor = (rate: number) => {
    if (rate >= 90) return "bg-emerald-500";
    if (rate >= 70) return "bg-amber-500";
    return "bg-rose-500";
  };

  const exportToPDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const kpiData = (data as any[]) || [];
    
    doc.setFontSize(18);
    doc.setTextColor(212, 175, 55);
    doc.text('KPI Executive Report - Control Hub JCSA', 148, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 148, 27, { align: 'center' });
    
    const headers = ['Department', 'Open Tickets', 'Closed/Week', 'SLA %', 'Overdue', 'Done/Month', 'Avg Hrs', 'Team'];
    const colWidths = [52, 26, 26, 22, 22, 26, 22, 22];
    const startX = 10;
    let y = 35;
    const rowH = 8;
    
    doc.setFillColor(26, 58, 107);
    doc.rect(startX, y, 277, rowH, 'F');
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(9);
    let x = startX + 2;
    headers.forEach((h, i) => { doc.text(h, x, y + 5.5); x += colWidths[i]; });
    y += rowH;
    
    kpiData.forEach((dept: any, idx: number) => {
      if (idx % 2 === 0) { doc.setFillColor(245, 247, 252); doc.rect(startX, y, 277, rowH, 'F'); }
      doc.setTextColor(30, 30, 30);
      const row = [dept.departmentName, String(dept.openTickets), String(dept.closedThisWeek), `${dept.slaComplianceRate}%`, String(dept.overdueTasks), String(dept.completedTasksThisMonth), `${dept.avgResolutionHours}h`, String(dept.teamMembersCount)];
      x = startX + 2;
      row.forEach((cell: string, i: number) => { doc.text(cell, x, y + 5.5); x += colWidths[i]; });
      y += rowH;
    });
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('Control Hub - JCSA © 2026', 148, 205, { align: 'center' });
    doc.save(`KPI-Report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <DashboardLayout
      title="لوحة مؤشرات الأداء التنفيذية"
      subtitle="متابعة مؤشرات الأداء الرئيسية للأقسام التقنية"
      navGroups={getNavGroups()}
      portalName={user?.portal === "it_director" ? "بوابة المدير العام" : "بوابة الإدارة"}
    >
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg hub-icon-gold">
              <BarChart3 className="w-6 h-6 hub-stat-gold" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">مؤشرات الأداء (KPIs)</h2>
              <p className="text-sm text-white/60">آخر تحديث: {lastUpdated.toLocaleTimeString("ar-SA")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="gap-2 border-white/10 text-white/70 hover:bg-white/5"
              data-testid="button-export-pdf"
              disabled={isLoading || !data}
            >
              <FileDown className="w-4 h-4" />
              تصدير PDF
            </Button>
            <Button 
              onClick={() => refetch()} 
              disabled={isFetching}
              variant="gold"
              className="gap-2"
              data-testid="button-refresh-kpi"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              تحديث البيانات
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="card-premium border-white/5 bg-[#0f1f3d]/50">
                <CardHeader className="border-b border-white/5">
                  <Skeleton className="h-7 w-48" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((j) => (
                      <div key={j} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {data?.map((dept) => (
              <Card key={dept.departmentId} className="card-premium border-white/5 bg-[#0f1f3d]/50 hover:border-[hsl(var(--gold))]/30 transition-all duration-300" data-testid={`kpi-card-dept-${dept.departmentId}`}>
                <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-bold text-[hsl(var(--gold))]">
                    {dept.departmentName}
                  </CardTitle>
                  <Badge variant="outline" className="gap-1.5 bg-white/5 border-white/10 text-white/70">
                    <Users className="w-3.5 h-3.5" />
                    {dept.teamMembersCount} أعضاء الفريق
                  </Badge>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {/* Open Tickets */}
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        التذاكر المفتوحة
                      </p>
                      <div className="flex items-end gap-2">
                        <p className={`text-2xl font-bold ${dept.openTickets > 10 ? "text-rose-400" : "text-white"}`} data-testid={`stat-open-tickets-${dept.departmentId}`}>
                          {dept.openTickets}
                        </p>
                        {dept.prevOpenTickets !== undefined && (
                          <TrendBadge current={dept.openTickets} previous={dept.prevOpenTickets} higherIsBetter={false} className="mb-1" />
                        )}
                      </div>
                    </div>

                    {/* Closed This Week */}
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        أُغلق هذا الأسبوع
                      </p>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-bold text-emerald-400" data-testid={`stat-closed-week-${dept.departmentId}`}>
                          {dept.closedThisWeek}
                        </p>
                        {dept.prevClosedThisWeek !== undefined && (
                          <TrendBadge current={dept.closedThisWeek} previous={dept.prevClosedThisWeek} higherIsBetter={true} className="mb-1" />
                        )}
                      </div>
                    </div>

                    {/* SLA Compliance */}
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          الالتزام بـ SLA
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${dept.slaComplianceRate >= 90 ? "text-emerald-400" : dept.slaComplianceRate >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                            {dept.slaComplianceRate}%
                          </span>
                          {dept.prevSLAComplianceRate !== undefined && (
                            <TrendBadge current={dept.slaComplianceRate} previous={dept.prevSLAComplianceRate} higherIsBetter={true} />
                          )}
                        </div>
                      </div>
                        <Progress 
                          value={dept.slaComplianceRate} 
                          className="h-1.5 bg-white/5" 
                          {...({ indicatorClassName: getSLAColor(dept.slaComplianceRate) } as any)}
                          data-testid={`stat-sla-rate-${dept.departmentId}`}
                        />
                    </div>

                    {/* Overdue Tasks */}
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        مهام متأخرة
                      </p>
                      <div className="flex items-end gap-2">
                        <p className={`text-2xl font-bold ${dept.overdueTasks > 0 ? "text-rose-400" : "text-emerald-400"}`} data-testid={`stat-overdue-tasks-${dept.departmentId}`}>
                          {dept.overdueTasks}
                        </p>
                        {dept.prevOverdueTasks !== undefined && (
                          <TrendBadge current={dept.overdueTasks} previous={dept.prevOverdueTasks} higherIsBetter={false} className="mb-1" />
                        )}
                      </div>
                    </div>

                    {/* Completed Tasks This Month */}
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        إنجاز المهام (شهر)
                      </p>
                      <p className="text-2xl font-bold text-white" data-testid={`stat-completed-month-${dept.departmentId}`}>
                        {dept.completedTasksThisMonth}
                      </p>
                    </div>

                    {/* Avg Resolution Hours */}
                    <div className="space-y-1">
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        متوسط وقت الحل
                      </p>
                      <p className="text-2xl font-bold text-white" data-testid={`stat-avg-hours-${dept.departmentId}`}>
                        {dept.avgResolutionHours} <span className="text-xs text-white/40 font-normal">ساعة</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
