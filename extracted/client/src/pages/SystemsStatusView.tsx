import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminNavGroups } from '@/lib/navigation';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, Building2, Server,
  Search, RefreshCw, Activity, Filter, Shield
} from 'lucide-react';

interface ExternalSystem {
  id: number;
  name: string;
  nameEn?: string;
  type: string;
  status: string;
  endpoint?: string;
  departmentId?: number;
  departmentName?: string;
  lastSyncAt?: string;
  createdAt: string;
}

const departmentNames: Record<number, string> = {
  1: 'الإدارة العامة',
  2: 'البنية التحتية والشبكات',
  3: 'الأمن السيبراني',
  4: 'التحول الرقمي',
  5: 'الدعم الفني',
  6: 'مكتب إدارة البيانات (DMO)',
};

export default function SystemsStatusView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const { data: systems = [], isLoading, refetch, isFetching } = useQuery<ExternalSystem[]>({
    queryKey: ['/api/external-systems'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/external-systems');
      const data = await response.json();
      setLastRefreshed(new Date());
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });

  const handleManualRefresh = () => {
    refetch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return (
          <Badge variant="gold" className="gap-1" data-testid="badge-status-connected">
            <CheckCircle className="w-3 h-3" />
            متصل
          </Badge>
        );
      case 'inactive':
      case 'disconnected':
        return (
          <Badge variant="navy" className="gap-1" data-testid="badge-status-disconnected">
            <XCircle className="w-3 h-3" />
            غير متصل
          </Badge>
        );
      case 'warning':
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1 border-[hsl(43_74%_49%)]/50 hub-stat-gold" data-testid="badge-status-warning">
            <AlertTriangle className="w-3 h-3" />
            تحذير
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1" data-testid="badge-status-unknown">
            <Clock className="w-3 h-3" />
            غير محدد
          </Badge>
        );
    }
  };

  const connectedCount = systems.filter(s => s.status === 'active' || s.status === 'connected').length;
  const disconnectedCount = systems.filter(s => s.status === 'inactive' || s.status === 'disconnected').length;
  const warningCount = systems.filter(s => s.status === 'warning' || s.status === 'pending').length;
  const healthScore = systems.length > 0 ? Math.round((connectedCount / systems.length) * 100) : 0;

  const uniqueDepartments = useMemo(() => {
    const deptIds = new Set<number>();
    systems.forEach(s => {
      if (s.departmentId) deptIds.add(s.departmentId);
    });
    return Array.from(deptIds).sort((a, b) => a - b);
  }, [systems]);

  const filteredSystems = useMemo(() => {
    return systems.filter(system => {
      const matchesSearch = searchQuery === '' ||
        system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (system.nameEn && system.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (system.type && system.type.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'connected') {
        matchesStatus = system.status === 'active' || system.status === 'connected';
      } else if (statusFilter === 'disconnected') {
        matchesStatus = system.status === 'inactive' || system.status === 'disconnected';
      } else if (statusFilter === 'warning') {
        matchesStatus = system.status === 'warning' || system.status === 'pending';
      }

      const matchesDepartment = departmentFilter === 'all' ||
        String(system.departmentId) === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [systems, searchQuery, statusFilter, departmentFilter]);

  return (
    <DashboardLayout
      title="حالة الأنظمة المتصلة"
      subtitle="عرض حالة الربط مع الأنظمة الخارجية (للعرض فقط)"
      navGroups={adminNavGroups}
      portalName="بوابة مدير النظام"
    >
      <div className="space-y-6">
        {/* Header Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-last-refreshed">
            <Clock className="w-4 h-4" />
            <span>آخر تحديث: {lastRefreshed.toLocaleTimeString('ar-SA')}</span>
            {isFetching && (
              <RefreshCw className="w-3 h-3 animate-spin hub-stat-gold" />
            )}
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={handleManualRefresh}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث يدوي
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-glow-gold animate-fadeInUp stagger-1" data-testid="card-health-score">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">نسبة الصحة</p>
                  <p className="text-3xl font-bold hub-stat-gold" data-testid="text-health-score">{healthScore}%</p>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(43_74%_49%)]/10">
                  <Shield className="w-6 h-6 hub-stat-gold" />
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full h-2 rounded-full bg-[hsl(222_47%_11%)]/20">
                  <div
                    className="h-2 rounded-full bg-[hsl(43_74%_49%)] transition-all duration-500"
                    style={{ width: `${healthScore}%` }}
                    data-testid="progress-health-score"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glow-gold animate-fadeInUp stagger-2" data-testid="card-connected-count">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">أنظمة متصلة</p>
                  <p className="text-3xl font-bold hub-stat-gold" data-testid="text-connected-count">{connectedCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(43_74%_49%)]/10">
                  <CheckCircle className="w-6 h-6 hub-stat-gold" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glow-gold animate-fadeInUp stagger-3" data-testid="card-disconnected-count">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">أنظمة غير متصلة</p>
                  <p className="text-3xl font-bold text-muted-foreground" data-testid="text-disconnected-count">{disconnectedCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(222_47%_11%)]/10">
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glow-gold animate-fadeInUp stagger-4" data-testid="card-warning-count">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">تحذيرات</p>
                  <p className="text-3xl font-bold hub-stat-gold" data-testid="text-warning-count">{warningCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-[hsl(43_74%_49%)]/10">
                  <AlertTriangle className="w-6 h-6 hub-stat-gold" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="card-premium animate-fadeInUp stagger-5" data-testid="card-filters">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span>تصفية</span>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="بحث بالاسم أو النوع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="حالة النظام" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="connected">متصل</SelectItem>
                  <SelectItem value="disconnected">غير متصل</SelectItem>
                  <SelectItem value="warning">تحذير</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-department-filter">
                  <SelectValue placeholder="الإدارة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الإدارات</SelectItem>
                  {uniqueDepartments.map(deptId => (
                    <SelectItem key={deptId} value={String(deptId)}>
                      {departmentNames[deptId] || `إدارة ${deptId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Systems List */}
        <Card className="card-premium animate-fadeInUp stagger-6" data-testid="card-systems-list">
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <Server className="w-5 h-5 hub-stat-gold" />
                قائمة الأنظمة الخارجية المتصلة
              </CardTitle>
              <CardDescription>
                عرض جميع الأنظمة المربوطة من قبل الإدارات المختلفة (للعرض فقط - الإدارة المسؤولة هي من تدير الربط)
              </CardDescription>
            </div>
            <Badge variant="secondary" data-testid="badge-results-count">
              {filteredSystems.length} / {systems.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4" data-testid="skeleton-loading">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredSystems.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-state">
                <Server className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                {systems.length === 0 ? (
                  <>
                    <p className="text-muted-foreground">لا توجد أنظمة خارجية مسجلة حاليا</p>
                    <p className="text-sm text-muted-foreground/70 mt-2">
                      الإدارات المختلفة ستقوم بربط أنظمتها من خلال بواباتها الخاصة
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">لا توجد نتائج مطابقة للتصفية</p>
                    <p className="text-sm text-muted-foreground/70 mt-2">
                      حاول تغيير معايير البحث أو التصفية
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSystems.map((system, index) => (
                  <div
                    key={system.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg transition-all hover:border-[hsl(43_74%_49%)]/30 animate-fadeInUp stagger-${Math.min(index + 1, 10)}`}
                    data-testid={`system-row-${system.id}`}
                  >
                    <div className="p-3 rounded-lg bg-[hsl(222_47%_11%)]/5">
                      <Server className="w-6 h-6 text-muted-foreground" />
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground" data-testid={`text-system-name-${system.id}`}>{system.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {system.departmentId ? departmentNames[system.departmentId] || 'غير محدد' : 'غير محدد'}
                        </span>
                        <span>|</span>
                        <span>{system.type || 'نظام خارجي'}</span>
                        {system.lastSyncAt && (
                          <>
                            <span>|</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              آخر مزامنة: {new Date(system.lastSyncAt).toLocaleDateString('ar-SA')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(system.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Note Card */}
        <Card className="border-[hsl(43_74%_49%)]/20 bg-[hsl(43_74%_49%)]/5" data-testid="card-note">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 hub-stat-gold mt-0.5" />
              <div>
                <p className="font-medium text-muted-foreground">ملاحظة هامة</p>
                <p className="text-sm text-muted-foreground mt-1">
                  هذه الصفحة للعرض فقط. لإدارة الربط مع الأنظمة الخارجية، يرجى التواصل مع الإدارة المسؤولة 
                  (البنية التحتية، التحول الرقمي، DMO، إلخ) التي قامت بإنشاء الربط.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
