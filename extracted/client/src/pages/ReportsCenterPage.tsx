import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { dmoNavGroups } from "@/lib/navigation";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { FileText, FileDown, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Shield, Clock, Building2 } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  'حرجة': 'bg-red-500/20 text-red-400',
  'عالية': 'bg-amber-500/20 text-amber-400',
  'متوسطة': 'bg-blue-500/20 text-blue-400',
};

export default function ReportsCenterPage() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/reports/templates"] });
  const { data: history = [] } = useQuery<any[]>({ queryKey: ["/api/reports/history"] });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports/generate", { reportType, period });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedReport(data);
      toast({ title: `تم إصدار التقرير: ${data.metadata?.reportNumber}` });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleExportPDF = () => {
    if (!generatedReport) return;
    const sections = generatedReport.sections || [];
    const allRows: any[] = [];
    sections.forEach((s: any) => {
      if (Array.isArray(s.data)) {
        s.data.forEach((r: any) => allRows.push(r));
      } else if (typeof s.data === 'object') {
        Object.entries(s.data).forEach(([k, v]) => allRows.push({ البند: k.replace(/_/g, ' '), القيمة: String(v) }));
      }
    });
    exportToPDF({
      title: generatedReport.metadata?.title || 'تقرير',
      subtitle: `${generatedReport.metadata?.organization} - ${generatedReport.metadata?.reportNumber}`,
      columns: [{ header: 'البند', key: 'البند', width: 50 }, { header: 'القيمة', key: 'القيمة', width: 50 }],
      data: allRows, filename: `report-${generatedReport.metadata?.reportNumber}`, orientation: 'portrait',
    });
  };

  return (
    <DashboardLayout title="مركز التقارير الرسمية" portalName="dmo" navGroups={dmoNavGroups}>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[hsl(43_74%_49%)]/15"><FileText className="w-6 h-6 hub-stat-gold" /></div>
          <div>
            <h1 className="text-xl font-bold">مركز التقارير الرسمية</h1>
            <p className="text-sm text-muted-foreground">إصدار تقارير موثقة بأرقام مرجعية وبيانات حقيقية من PostgreSQL</p>
          </div>
        </div>

        {/* إصدار تقرير جديد */}
        <Card className="card-premium border-[hsl(43_74%_49%)]/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 hub-stat-gold"><FileText className="w-4 h-4" /> إصدار تقرير جديد</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">نوع التقرير</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger><SelectValue placeholder="اختر نوع التقرير..." /></SelectTrigger>
                  <SelectContent>{templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.nameAr} ({t.category})</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">الفترة</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="quarterly">ربع سنوي</SelectItem>
                    <SelectItem value="yearly">سنوي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => generateMutation.mutate()} disabled={!reportType || generateMutation.isPending} className="hub-btn-gold gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                إصدار التقرير
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* التقرير المُصدر */}
        {generatedReport && (
          <Card className="card-premium border-[hsl(43_74%_49%)]/20">
            {/* رأس التقرير الرسمي */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold hub-stat-gold">{generatedReport.metadata?.title}</h2>
                  <p className="text-sm text-muted-foreground">{generatedReport.metadata?.organization}</p>
                </div>
                <div className="text-left space-y-1">
                  <Badge className="bg-[hsl(43_74%_49%)]/20 text-[hsl(43_74%_49%)]">{generatedReport.metadata?.reportNumber}</Badge>
                  <p className="text-xs text-muted-foreground">{new Date(generatedReport.metadata?.generatedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span>الفترة: {generatedReport.metadata?.periodCovered}</span>
                <span>·</span>
                <span>أصدره: {generatedReport.metadata?.generatedBy}</span>
                <span>·</span>
                <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">{generatedReport.metadata?.classification}</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-1.5"><FileDown className="w-3.5 h-3.5" /> PDF</Button>
                <Button size="sm" variant="outline" className="gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Button>
              </div>
            </div>

            {/* أقسام التقرير */}
            <CardContent className="p-6 space-y-6">
              {generatedReport.sections?.map((section: any, idx: number) => (
                <div key={idx} className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-sm border-b border-white/10 pb-2">
                    <Building2 className="w-4 h-4 hub-stat-gold" />
                    {section.title}
                    {section.framework && <Badge variant="outline" className="text-xs">{section.framework}</Badge>}
                  </h3>
                  {Array.isArray(section.data) ? (
                    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10">
                      {Object.keys(section.data[0] || {}).map(k => <th key={k} className="p-2 text-right text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</th>)}
                    </tr></thead><tbody>
                      {section.data.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          {Object.values(row).map((v, j) => <td key={j} className="p-2 text-xs">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody></table></div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(section.data || {}).map(([key, val]) => (
                        <div key={key} className="p-3 rounded-lg bg-white/5">
                          <p className="text-xs text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                          <p className="font-bold mt-1">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* الملخص */}
              {generatedReport.summary && Object.keys(generatedReport.summary).length > 0 && (
                <div className="p-4 rounded-xl bg-[hsl(43_74%_49%)]/10 border border-[hsl(43_74%_49%)]/20">
                  <h3 className="font-semibold text-sm mb-3 hub-stat-gold">ملخص التقرير</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(generatedReport.summary).map(([k, v]) => (
                      <div key={k}><p className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</p><p className="font-bold">{String(v)}</p></div>
                    ))}
                  </div>
                </div>
              )}

              {/* التوصيات */}
              {generatedReport.recommendations?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 hub-stat-gold" /> التوصيات</h3>
                  <div className="space-y-2">
                    {generatedReport.recommendations.map((rec: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                        <Badge className={PRIORITY_STYLES[rec.priority] || 'bg-gray-500/20'}>{rec.priority}</Badge>
                        <p className="text-sm">{rec.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* سجل التقارير */}
        {history.length > 0 && (
          <Card className="card-premium">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 hub-stat-gold" /> سجل التقارير المُصدرة</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10">
                <th className="p-2 text-right text-xs text-muted-foreground">النوع</th>
                <th className="p-2 text-right text-xs text-muted-foreground">الحالة</th>
                <th className="p-2 text-right text-xs text-muted-foreground">المدة</th>
                <th className="p-2 text-right text-xs text-muted-foreground">التاريخ</th>
              </tr></thead><tbody>
                {history.slice(0, 20).map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2 text-xs">{r.reportTitle}</td>
                    <td className="p-2"><Badge className={r.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{r.status === 'success' ? 'ناجح' : 'فشل'}</Badge></td>
                    <td className="p-2 text-xs">{r.duration_ms}ms</td>
                    <td className="p-2 text-xs">{new Date(r.started_at).toLocaleDateString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
