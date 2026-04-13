import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { dmoNavGroups } from "@/lib/navigation";
import { exportToExcel } from "@/lib/exports";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Search, Play, Database, Table2, GitCompare, Shield, FileDown, Loader2, Server, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";

const COLORS = ['#c9a227', '#1e3a5f', '#2d4a6f', '#ef4444', '#059669', '#6366f1'];

export default function DataAnalyticsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("query");
  const [selectedConn, setSelectedConn] = useState("");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM ");
  const [selectedTable, setSelectedTable] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  const { data: connections = [] } = useQuery<any[]>({ queryKey: ["/api/database-connections"] });
  const { data: tables = [] } = useQuery<any[]>({ queryKey: ["/api/discovered-tables"] });
  const { data: qualityReport, isLoading: qualityLoading } = useQuery<any>({ queryKey: ["/api/analytics/quality-report"], staleTime: 5 * 60 * 1000 });
  const { data: queryStats } = useQuery<any>({ queryKey: ["/api/analytics/query-stats"] });

  const queryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/analytics/query", { connectionId: parseInt(selectedConn), query: sqlQuery, maxRows: 500 });
      return res.json();
    },
    onError: (e: Error) => toast({ title: "خطأ في الاستعلام", description: e.message, variant: "destructive" }),
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      const t = tables.find((t: any) => t.id === parseInt(selectedTable));
      const res = await apiRequest("POST", "/api/analytics/profile-table", { connectionId: t?.connectionId, tableName: t?.tableName });
      return res.json();
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const compareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/analytics/compare-sources", {
        sourceA: { connectionId: parseInt(compareA) }, sourceB: { connectionId: parseInt(compareB) },
      });
      return res.json();
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout title="أدوات التحليل المتقدمة" portalName="dmo" navGroups={dmoNavGroups}>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[hsl(43_74%_49%)]/15"><Search className="w-6 h-6 hub-stat-gold" /></div>
          <div>
            <h1 className="text-xl font-bold">أدوات التحليل المتقدمة</h1>
            <p className="text-sm text-muted-foreground">استعلام وتحليل البيانات من كافة المصادر المتصلة</p>
          </div>
          {queryStats && (
            <Badge variant="outline" className="mr-auto">{queryStats.totalQueries} استعلام آخر 30 يوم</Badge>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList className="grid w-full grid-cols-4 bg-[hsl(222_47%_11%)]/50">
            <TabsTrigger value="query">محلل الاستعلامات</TabsTrigger>
            <TabsTrigger value="profile">بروفايل الجداول</TabsTrigger>
            <TabsTrigger value="compare">مقارنة المصادر</TabsTrigger>
            <TabsTrigger value="quality">تقرير الجودة</TabsTrigger>
          </TabsList>

          {/* ===== محلل الاستعلامات ===== */}
          <TabsContent value="query" className="space-y-4 mt-4">
            <Card className="card-premium">
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">مصدر البيانات</label>
                    <Select value={selectedConn} onValueChange={setSelectedConn}>
                      <SelectTrigger><SelectValue placeholder="اختر مصدر البيانات..." /></SelectTrigger>
                      <SelectContent>{connections.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.databaseType})</SelectItem>
                      ))}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => queryMutation.mutate()} disabled={!selectedConn || !sqlQuery || queryMutation.isPending} className="hub-btn-gold gap-2">
                    {queryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    تنفيذ
                  </Button>
                </div>
                <Textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} className="font-mono text-sm min-h-[100px] bg-[hsl(222_47%_11%)]/30" dir="ltr" placeholder="SELECT * FROM table_name LIMIT 100" />
              </CardContent>
            </Card>
            {queryMutation.data && (
              <Card className="card-premium">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Table2 className="w-4 h-4 hub-stat-gold" />
                      النتائج ({queryMutation.data.totalRows} صف · {queryMutation.data.duration}ms)
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => exportToExcel({ title: 'نتائج الاستعلام', columns: queryMutation.data.columns.map((c: string) => ({ header: c, key: c, width: 20 })), data: queryMutation.data.rows, filename: 'query-results' })} className="gap-1.5">
                      <FileDown className="w-3.5 h-3.5" /> تصدير
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[400px]">
                  <table className="w-full text-sm"><thead><tr className="border-b border-white/10">
                    {queryMutation.data.columns.map((col: string) => <th key={col} className="p-2 text-right text-xs text-muted-foreground">{col}</th>)}
                  </tr></thead><tbody>
                    {queryMutation.data.rows.slice(0, 100).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        {queryMutation.data.columns.map((col: string) => <td key={col} className="p-2 text-xs">{String(row[col] ?? '—')}</td>)}
                      </tr>
                    ))}
                  </tbody></table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== بروفايل الجداول ===== */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">اختر جدول</label>
                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                      <SelectTrigger><SelectValue placeholder="اختر جدول..." /></SelectTrigger>
                      <SelectContent>{tables.slice(0, 100).map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.tableName} ({t.rowCount} صف)</SelectItem>
                      ))}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => profileMutation.mutate()} disabled={!selectedTable || profileMutation.isPending} className="hub-btn-gold gap-2">
                    {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    تحليل
                  </Button>
                </div>
              </CardContent>
            </Card>
            {profileMutation.data && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">الصفوف</p>
                    <p className="text-xl font-bold hub-stat-gold">{profileMutation.data.totalRows?.toLocaleString()}</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">الأعمدة</p>
                    <p className="text-xl font-bold hub-stat-gold">{profileMutation.data.totalColumns}</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">المصدر</p>
                    <p className="text-sm font-bold">{profileMutation.data.source?.type}</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">الجدول</p>
                    <p className="text-sm font-bold truncate">{profileMutation.data.tableName}</p>
                  </CardContent></Card>
                </div>
                <Card className="card-premium">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تحليل الأعمدة</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {profileMutation.data.columns?.map((col: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{col.name} <Badge variant="outline" className="text-xs mr-2">{col.type}</Badge></span>
                          <span className="text-xs text-muted-foreground">{col.distinctValues} قيمة فريدة</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-xs text-muted-foreground mb-1">القيم الفارغة ({col.nullPercent}%)</p><Progress value={col.nullPercent} className="h-1.5" /></div>
                          <div><p className="text-xs text-muted-foreground mb-1">التفرد ({col.uniqueness}%)</p><Progress value={col.uniqueness} className="h-1.5" /></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ===== مقارنة المصادر ===== */}
          <TabsContent value="compare" className="space-y-4 mt-4">
            <Card className="card-premium">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">المصدر الأول</label>
                    <Select value={compareA} onValueChange={setCompareA}>
                      <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{connections.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">المصدر الثاني</label>
                    <Select value={compareB} onValueChange={setCompareB}>
                      <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{connections.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => compareMutation.mutate()} disabled={!compareA || !compareB || compareMutation.isPending} className="hub-btn-gold mt-3 gap-2">
                  {compareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                  مقارنة
                </Button>
              </CardContent>
            </Card>
            {compareMutation.data && (
              <div className="grid grid-cols-2 gap-4">
                {['sourceA', 'sourceB'].map((key, idx) => {
                  const s = compareMutation.data[key];
                  return (
                    <Card key={key} className="card-premium">
                      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="w-4 h-4 hub-stat-gold" />{s.name}</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <Badge variant="outline">{s.type}</Badge>
                        <p className="text-xs text-muted-foreground">{s.host} / {s.database}</p>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="text-center"><p className="text-lg font-bold hub-stat-gold">{s.tables}</p><p className="text-xs text-muted-foreground">جداول</p></div>
                          <div className="text-center"><p className="text-lg font-bold">{s.rows?.toLocaleString()}</p><p className="text-xs text-muted-foreground">صفوف</p></div>
                          <div className="text-center"><p className="text-lg font-bold">{s.columns}</p><p className="text-xs text-muted-foreground">أعمدة</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== تقرير الجودة ===== */}
          <TabsContent value="quality" className="space-y-4 mt-4">
            {qualityLoading ? <Skeleton className="h-64" /> : qualityReport && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-3xl font-bold hub-stat-gold">{qualityReport.overallScore}%</p>
                    <p className="text-xs text-muted-foreground">درجة الجودة الشاملة</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold">{qualityReport.assets?.total}</p>
                    <p className="text-xs text-muted-foreground">أصول البيانات</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold">{qualityReport.catalog?.tables}</p>
                    <p className="text-xs text-muted-foreground">جداول مكتشفة</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold">{qualityReport.risks?.total}</p>
                    <p className="text-xs text-muted-foreground">المخاطر</p>
                    <p className="text-xs text-red-400">{qualityReport.risks?.critical} حرجة</p>
                  </CardContent></Card>
                  <Card className="card-premium"><CardContent className="p-3 text-center">
                    <p className="text-xl font-bold">{qualityReport.risks?.mitigationRate}%</p>
                    <p className="text-xs text-muted-foreground">نسبة المعالجة</p>
                  </CardContent></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="card-premium">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">تصنيف الأصول</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart><Pie data={[
                          { name: 'سري للغاية', value: qualityReport.assets?.classification?.topSecret || 0 },
                          { name: 'سري', value: qualityReport.assets?.classification?.confidential || 0 },
                          { name: 'مقيد', value: qualityReport.assets?.classification?.restricted || 0 },
                          { name: 'عام', value: qualityReport.assets?.classification?.public || 0 },
                        ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={70} innerRadius={35} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                        </Pie><Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} /></PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="card-premium">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">المخاطر حسب المستوى</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: 'حرجة', value: qualityReport.risks?.critical || 0 },
                          { name: 'عالية', value: qualityReport.risks?.high || 0 },
                          { name: 'متوسطة', value: qualityReport.risks?.medium || 0 },
                          { name: 'منخفضة', value: qualityReport.risks?.low || 0 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>{[0,1,2,3].map(i => <Cell key={i} fill={['#ef4444','#f59e0b','#c9a227','#059669'][i]} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
