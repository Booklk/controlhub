import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { exportToPDF, exportToExcel } from '@/lib/exports';
import DashboardLayout from '@/components/DashboardLayout';
import { itDirectorNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  FileDown, FileSpreadsheet, Trophy, ArrowUpDown, ChevronDown, ChevronUp,
  Building2, Users, Ticket, CheckCircle, Clock, AlertTriangle, FolderKanban,
  Shield, Gauge, Crown,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
interface DepartmentAnalytics {
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  staffCount: number;
  openTickets: number;
  totalTickets: number;
  resolutionRate: number;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  taskCompletionRate: number;
  overdueTasks: number;
  activeProjects: number;
  totalProjects: number;
  slaComplianceRate: number;
  healthScore: number;
}

type SortKey = 'departmentName' | 'staffCount' | 'openTickets' | 'resolutionRate'
  | 'totalTasks' | 'taskCompletionRate' | 'overdueTasks' | 'activeProjects'
  | 'slaComplianceRate' | 'healthScore';

// ─── Helpers ───────────────────────────────────────────────────
const GOLD = '#c9a227';
const NAVY = '#1a3a6b';

function rateColor(v: number): string {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

function rateBg(v: number): string {
  if (v >= 80) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 60) return 'bg-amber-500/10 text-amber-400';
  return 'bg-rose-500/10 text-rose-400';
}

function barColor(v: number): string {
  if (v >= 80) return '#34d399';
  if (v >= 60) return '#fbbf24';
  return '#f87171';
}

const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

// ─── Column definitions ────────────────────────────────────────
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'departmentName', label: 'الإدارة' },
  { key: 'staffCount', label: 'الموظفين' },
  { key: 'openTickets', label: 'التذاكر المفتوحة' },
  { key: 'resolutionRate', label: 'نسبة الحل' },
  { key: 'totalTasks', label: 'المهام' },
  { key: 'taskCompletionRate', label: 'نسبة الإنجاز' },
  { key: 'overdueTasks', label: 'المتأخرة' },
  { key: 'activeProjects', label: 'المشاريع' },
  { key: 'slaComplianceRate', label: 'SLA' },
  { key: 'healthScore', label: 'درجة الصحة' },
];

// ─── Component ─────────────────────────────────────────────────
export default function DepartmentComparisonPage() {
  const [sortKey, setSortKey] = useState<SortKey>('healthScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedDept, setExpandedDept] = useState<number | null>(null);

  // Fetch department analytics
  const { data: departments, isLoading } = useQuery<DepartmentAnalytics[]>({
    queryKey: ['/api/data-warehouse/department-analytics'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/data-warehouse/department-analytics');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sorting logic
  const sorted = useMemo(() => {
    if (!departments) return [];
    return [...departments].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'ar') : bv.localeCompare(av, 'ar');
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [departments, sortKey, sortDir]);

  // Top 3 by health score
  const top3 = useMemo(() => {
    if (!departments) return [];
    return [...departments].sort((a, b) => b.healthScore - a.healthScore).slice(0, 3);
  }, [departments]);

  // Chart data
  const healthChartData = useMemo(() =>
    sorted.map(d => ({ name: d.departmentName, value: d.healthScore })),
    [sorted]
  );
  const taskChartData = useMemo(() =>
    sorted.map(d => ({ name: d.departmentName, value: d.taskCompletionRate })),
    [sorted]
  );
  const ticketChartData = useMemo(() =>
    sorted.map(d => ({ name: d.departmentName, value: d.resolutionRate })),
    [sorted]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // Export handlers
  function handleExportPDF() {
    if (!sorted.length) return;
    exportToPDF({
      title: 'مقارنة أداء الإدارات',
      subtitle: `تقرير مقارنة ${sorted.length} إدارات`,
      filename: 'department-comparison',
      orientation: 'landscape',
      columns: COLUMNS.map(c => ({ header: c.label, key: c.key })),
      data: sorted.map(d => ({
        departmentName: d.departmentName,
        staffCount: d.staffCount,
        openTickets: d.openTickets,
        resolutionRate: `${d.resolutionRate}%`,
        totalTasks: d.totalTasks,
        taskCompletionRate: `${d.taskCompletionRate}%`,
        overdueTasks: d.overdueTasks,
        activeProjects: d.activeProjects,
        slaComplianceRate: `${d.slaComplianceRate}%`,
        healthScore: `${d.healthScore}%`,
      })),
    });
  }

  function handleExportExcel() {
    if (!sorted.length) return;
    exportToExcel({
      title: 'مقارنة أداء الإدارات',
      filename: 'department-comparison',
      columns: COLUMNS.map(c => ({ header: c.label, key: c.key })),
      data: sorted.map(d => ({
        departmentName: d.departmentName,
        staffCount: d.staffCount,
        openTickets: d.openTickets,
        resolutionRate: d.resolutionRate,
        totalTasks: d.totalTasks,
        taskCompletionRate: d.taskCompletionRate,
        overdueTasks: d.overdueTasks,
        activeProjects: d.activeProjects,
        slaComplianceRate: d.slaComplianceRate,
        healthScore: d.healthScore,
      })),
    });
  }

  // ─── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout title="مقارنة أداء الإدارات" portalName="مدير تقنية المعلومات" navGroups={itDirectorNavGroups}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl bg-white/5" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="مقارنة أداء الإدارات" portalName="مدير تقنية المعلومات" navGroups={itDirectorNavGroups}>
      <div className="space-y-6">
        {/* ── Header + Export ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">مقارنة أداء الإدارات</h1>
            <p className="text-sm text-white/50 mt-1">عرض شامل لأداء جميع الإدارات جنباً إلى جنب</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 border-[hsl(43_74%_49%)]/30 text-white hover:bg-[hsl(43_74%_49%)]/10" onClick={handleExportPDF}>
              <FileDown className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-[hsl(43_74%_49%)]/30 text-white hover:bg-[hsl(43_74%_49%)]/10" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* ── Top 3 ranking cards ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((dept, idx) => (
            <Card key={dept.departmentId} className="relative overflow-hidden border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
              <div className="absolute top-3 left-3">
                <div className={`flex items-center gap-1 ${MEDAL_COLORS[idx]}`}>
                  <Crown className="w-5 h-5" />
                  <span className="text-sm font-bold">#{idx + 1}</span>
                </div>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[hsl(43_74%_49%)]" />
                  {dept.departmentName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${rateColor(dept.healthScore)}`}>
                    {dept.healthScore}%
                  </span>
                  <span className="text-sm text-white/40">درجة الصحة</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-white/40">الإنجاز</p>
                    <p className={`font-semibold ${rateColor(dept.taskCompletionRate)}`}>{dept.taskCompletionRate}%</p>
                  </div>
                  <div>
                    <p className="text-white/40">SLA</p>
                    <p className={`font-semibold ${rateColor(dept.slaComplianceRate)}`}>{dept.slaComplianceRate}%</p>
                  </div>
                  <div>
                    <p className="text-white/40">الحل</p>
                    <p className={`font-semibold ${rateColor(dept.resolutionRate)}`}>{dept.resolutionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Comparison table ───────────────────────────────── */}
        <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart className="w-5 h-5 text-[hsl(43_74%_49%)]" />
              جدول المقارنة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[hsl(222_47%_9%)]">
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-right text-white/60 font-medium cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-[hsl(43_74%_49%)]" /> : <ChevronDown className="w-3 h-3 text-[hsl(43_74%_49%)]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(dept => (
                    <>
                      <tr
                        key={dept.departmentId}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setExpandedDept(expandedDept === dept.departmentId ? null : dept.departmentId)}
                      >
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[hsl(43_74%_49%)]" />
                            {dept.departmentName}
                            {expandedDept === dept.departmentId ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80">{dept.staffCount}</td>
                        <td className="px-4 py-3 text-white/80">{dept.openTickets}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${rateBg(dept.resolutionRate)}`}>
                            {dept.resolutionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80">{dept.totalTasks}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${rateBg(dept.taskCompletionRate)}`}>
                            {dept.taskCompletionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={dept.overdueTasks > 0 ? 'text-rose-400 font-semibold' : 'text-white/80'}>
                            {dept.overdueTasks}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80">{dept.activeProjects}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${rateBg(dept.slaComplianceRate)}`}>
                            {dept.slaComplianceRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${rateBg(dept.healthScore)}`}>
                            {dept.healthScore}%
                          </span>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expandedDept === dept.departmentId && (
                        <tr key={`${dept.departmentId}-detail`} className="bg-[hsl(222_47%_9%)]/60">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <DetailStat icon={Users} label="إجمالي الموظفين" value={dept.staffCount} />
                              <DetailStat icon={Ticket} label="إجمالي التذاكر" value={dept.totalTickets} />
                              <DetailStat icon={CheckCircle} label="المهام المكتملة" value={dept.completedTasks} />
                              <DetailStat icon={FolderKanban} label="إجمالي المشاريع" value={dept.totalProjects} />
                              <DetailStat icon={Clock} label="التذاكر المفتوحة" value={dept.openTickets} />
                              <DetailStat icon={AlertTriangle} label="المهام المتأخرة" value={dept.overdueTasks} color={dept.overdueTasks > 0 ? 'text-rose-400' : undefined} />
                              <DetailStat icon={Shield} label="امتثال SLA" value={`${dept.slaComplianceRate}%`} color={rateColor(dept.slaComplianceRate)} />
                              <DetailStat icon={Gauge} label="درجة الصحة" value={`${dept.healthScore}%`} color={rateColor(dept.healthScore)} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Charts section ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ComparisonChart title="درجة الصحة" icon={<Gauge className="w-5 h-5 text-[hsl(43_74%_49%)]" />} data={healthChartData} />
          <ComparisonChart title="نسبة إنجاز المهام" icon={<CheckCircle className="w-5 h-5 text-[hsl(43_74%_49%)]" />} data={taskChartData} />
          <ComparisonChart title="نسبة حل التذاكر" icon={<Ticket className="w-5 h-5 text-[hsl(43_74%_49%)]" />} data={ticketChartData} />
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function DetailStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
      <Icon className="w-5 h-5 text-[hsl(43_74%_49%)] shrink-0" />
      <div>
        <p className="text-xs text-white/40">{label}</p>
        <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

function ComparisonChart({ title, icon, data }: { title: string; icon: React.ReactNode; data: { name: string; value: number }[] }) {
  return (
    <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(222_47%_13%)]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-white flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} width={100} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(222 47% 11%)', border: '1px solid hsl(43 74% 49% / 0.3)', borderRadius: 8, color: '#fff', direction: 'rtl' }}
              formatter={(v: number) => [`${v}%`, title]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={barColor(entry.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
