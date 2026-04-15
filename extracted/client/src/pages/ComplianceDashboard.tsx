import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield, CheckCircle2, Clock, AlertCircle, Target, BarChart3,
  Building2
} from 'lucide-react';
import type { NavGroup } from '@/lib/navigation';
import { Link } from 'wouter';

interface BodyStats {
  regulatoryBody: string;
  label: string;
  labelEn: string;
  portal: string;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  complianceRate: number;
  byCategory: Record<string, { total: number; completed: number; inProgress: number }>;
}

interface DashboardData {
  overall: { total: number; completed: number; rate: number };
  bodies: BodyStats[];
}

const BODY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  NCA: { bg: 'bg-red-500/10', text: 'text-red-500', ring: 'ring-red-500/20' },
  NDMO: { bg: 'bg-blue-500/10', text: 'text-blue-500', ring: 'ring-blue-500/20' },
  DGA: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
};

const BODY_LINKS: Record<string, string> = {
  NCA: '/department/cybersecurity/regulatory-compliance',
  NDMO: '/dmo/regulatory-compliance',
  DGA: '/department/digital-transformation/regulatory-compliance',
};

const BODY_ICONS: Record<string, typeof Shield> = {
  NCA: Shield,
  NDMO: Building2,
  DGA: Target,
};

function ComplianceRing({ rate, size = 120, strokeWidth = 10, color }: { rate: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="currentColor" strokeWidth={strokeWidth}
          className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="currentColor" strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-1000 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{rate}%</span>
        <span className="text-[10px] text-muted-foreground">امتثال</span>
      </div>
    </div>
  );
}

interface ComplianceDashboardProps {
  navGroups: NavGroup[];
  portalName: string;
}

export default function ComplianceDashboard({ navGroups, portalName }: ComplianceDashboardProps) {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['/api/regulatory-controls/dashboard'],
    queryFn: () => apiRequest('GET', '/api/regulatory-controls/dashboard').then(r => r.json()),
  });

  const getComplianceColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-500';
    if (rate >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <DashboardLayout title="لوحة الامتثال التنظيمي" navGroups={navGroups} portalName={portalName}>
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">لوحة قياس الامتثال التنظيمي</h1>
          <p className="text-sm text-muted-foreground mt-1">
            متابعة نسبة الامتثال للجهات التنظيمية الثلاث
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !data ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد بيانات</CardContent></Card>
        ) : data.overall.total === 0 ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-10 px-6">
                <div className="flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-2xl hub-icon-gold flex items-center justify-center">
                    <Shield className="w-8 h-8 hub-stat-gold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">لوحة الامتثال التنظيمي</h2>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      لم يتم تسجيل ضوابط تنظيمية بعد. تظهر هنا نسب الامتثال بعد أن تقوم الإدارات بإدخال ضوابط الجهات التنظيمية الخاصة بها.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {data?.bodies?.map(body => {
                const colors = BODY_COLORS[body.regulatoryBody] || BODY_COLORS.NCA;
                const Icon = BODY_ICONS[body.regulatoryBody] || Shield;
                const link = BODY_LINKS[body.regulatoryBody] || '#';
                return (
                  <Card key={body.regulatoryBody} data-testid={`card-body-${body.regulatoryBody}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{body.labelEn}</CardTitle>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{body.label}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">لم يتم إدخال ضوابط بعد</p>
                      <Link href={link}>
                        <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-${body.regulatoryBody}`}>
                          <BarChart3 className="w-4 h-4 ml-1.5" />
                          ابدأ بإدخال الضوابط
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ComplianceRing
                    rate={data.overall.rate}
                    size={140}
                    strokeWidth={12}
                    color={getComplianceColor(data.overall.rate)}
                  />
                  <div className="flex-1 text-center md:text-right">
                    <h2 className="text-lg font-bold">نسبة الامتثال الإجمالية</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {data.overall.completed} ضابط مكتمل من أصل {data.overall.total} ضابط
                    </p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4">
                      {data?.bodies?.map(b => (
                        <div key={b.regulatoryBody} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${BODY_COLORS[b.regulatoryBody]?.bg || 'bg-muted'}`} />
                          <span className="text-xs text-muted-foreground">{b.labelEn}: {b.complianceRate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-500" data-testid="text-overall-completed">{data.overall.completed}</p>
                      <p className="text-[10px] text-muted-foreground">مكتمل</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-500">{data.bodies.reduce((s, b) => s + b.inProgress, 0)}</p>
                      <p className="text-[10px] text-muted-foreground">تحت الإجراء</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{data.bodies.reduce((s, b) => s + b.notStarted, 0)}</p>
                      <p className="text-[10px] text-muted-foreground">لم تبدأ</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {data?.bodies?.map(body => {
                const colors = BODY_COLORS[body.regulatoryBody] || BODY_COLORS.NCA;
                const Icon = BODY_ICONS[body.regulatoryBody] || Shield;
                const link = BODY_LINKS[body.regulatoryBody] || '#';
                return (
                  <Card key={body.regulatoryBody} data-testid={`card-body-${body.regulatoryBody}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{body.labelEn}</CardTitle>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{body.label}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {body.total} ضابط
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-center">
                        <ComplianceRing
                          rate={body.complianceRate}
                          size={100}
                          strokeWidth={8}
                          color={getComplianceColor(body.complianceRate)}
                        />
                      </div>

                      <div className="space-y-2">
                        {[
                          { label: 'مكتمل', value: body.completed, color: 'bg-emerald-500', icon: CheckCircle2 },
                          { label: 'تحت الإجراء', value: body.inProgress, color: 'bg-amber-500', icon: Clock },
                          { label: 'لم تبدأ', value: body.notStarted, color: 'bg-gray-400', icon: AlertCircle },
                        ].map(item => (
                          <div key={item.label} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <item.icon className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{item.label}</span>
                              </div>
                              <span className="font-medium">{item.value} / {body.total}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                                style={{ width: `${body.total > 0 ? Math.round((item.value / body.total) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {Object.keys(body.byCategory).length > 0 && (
                        <div className="border-t border-border/50 pt-3">
                          <p className="text-xs font-medium mb-2">التصنيفات</p>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-premium">
                            {Object.entries(body.byCategory).map(([cat, data]) => (
                              <div key={cat} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="truncate text-muted-foreground flex-1">{cat}</span>
                                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                  {data.completed}/{data.total}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Link href={link}>
                        <Button variant="outline" size="sm" className="w-full mt-2" data-testid={`button-view-${body.regulatoryBody}`}>
                          <BarChart3 className="w-4 h-4 ml-1.5" />
                          عرض الضوابط والتفاصيل
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-sm">ملخص التصنيفات لجميع الجهات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data?.bodies?.map(body => (
                    <div key={body.regulatoryBody}>
                      <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${BODY_COLORS[body.regulatoryBody]?.bg || 'bg-muted'}`} />
                        {body.labelEn}
                      </p>
                      {Object.entries(body.byCategory).length > 0 ? (
                        <div className="space-y-1">
                          {Object.entries(body.byCategory).map(([cat, catData]) => {
                            const catRate = catData.total > 0 ? Math.round((catData.completed / catData.total) * 100) : 0;
                            return (
                              <div key={cat} className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground truncate flex-1">{cat}</span>
                                <div className="w-16 h-1 bg-muted rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className={`h-full rounded-full ${catRate >= 80 ? 'bg-emerald-500' : catRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                                    style={{ width: `${catRate}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono w-8 text-left flex-shrink-0">{catRate}%</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">لا توجد بيانات</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
