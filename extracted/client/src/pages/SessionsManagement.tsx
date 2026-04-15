import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  LayoutDashboard, Users, Shield, Settings, FileCheck, Activity,
  Monitor, Smartphone, Globe, Clock, LogOut, RefreshCw, AlertTriangle
, FileDown, FileSpreadsheet} from 'lucide-react';
import { exportToPDF, exportToExcel} from '@/lib/exports';


interface Session {
  id: number;
  userId: number;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivity: string;
  expiresAt: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}

export default function SessionsManagement() {
  const { toast } = useToast();

  const { data: sessions = [], isLoading, refetch } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest('DELETE', `/api/sessions/${sessionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({ title: 'تم إنهاء الجلسة بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const terminateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/sessions/terminate-all');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({ title: 'تم إنهاء جميع الجلسات بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="w-5 h-5" />;
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const getDeviceName = (userAgent: string | null) => {
    if (!userAgent) return 'جهاز غير معروف';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'متصفح آخر';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffMins < 1440) return `منذ ${Math.floor(diffMins / 60)} ساعة`;
    return `منذ ${Math.floor(diffMins / 1440)} يوم`;
  };

  const isSessionExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const activeSessions = sessions.filter(s => !isSessionExpired(s.expiresAt));


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الجلسات',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"المستخدم","key":"user","width":30},{"header":"عنوان IP","key":"ip","width":25},{"header":"وقت الدخول","key":"loginTime","width":30},{"header":"الحالة","key":"status","width":20}],
      data: (sessions || []).map((item: any) => ({ user: item.user?.name || '', ip: item.ipAddress || '', loginTime: item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : '', status: new Date(item.expiresAt) > new Date() ? 'نشط' : 'منتهي' })),
      filename: 'sessions-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الجلسات',
      columns: [{"header":"المستخدم","key":"user","width":30},{"header":"عنوان IP","key":"ip","width":25},{"header":"وقت الدخول","key":"loginTime","width":30},{"header":"الحالة","key":"status","width":20}],
      data: (sessions || []).map((item: any) => ({ user: item.user?.name || '', ip: item.ipAddress || '', loginTime: item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : '', status: new Date(item.expiresAt) > new Date() ? 'نشط' : 'منتهي' })),
      filename: 'sessions-report',
    });
  };

  return (
    <DashboardLayout
      title="إدارة الجلسات النشطة"
      subtitle="مراقبة وإدارة جلسات المستخدمين"
      navGroups={adminNavGroups}
      portalName="بوابة مدير النظام"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الجلسات النشطة</p>
                  <p className="text-3xl font-bold hub-stat-gold">{activeSessions.length}</p>
                </div>
                <div className="p-3 rounded-full bg-[hsl(43_74%_49%)]/10">
                  <Activity className="w-6 h-6 hub-stat-gold" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الجلسات</p>
                  <p className="text-3xl font-bold text-muted-foreground">{sessions.length}</p>
                </div>
                <div className="p-3 rounded-full bg-[hsl(222_47%_11%)]/10">
                  <Monitor className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">جلسات منتهية</p>
                  <p className="text-3xl font-bold text-muted-foreground">{sessions.length - activeSessions.length}</p>
                </div>
                <div className="p-3 rounded-full bg-[hsl(222_47%_11%)]/10">
                  <AlertTriangle className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 hub-stat-gold" />
                  الجلسات النشطة
                </CardTitle>
                <CardDescription>قائمة بجميع الجلسات المفتوحة حالياً</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-sessions">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="gap-2 bg-[hsl(222_47%_11%)] text-white" data-testid="button-terminate-all">
                      <LogOut className="w-4 h-4" />
                      إنهاء جميع الجلسات
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد إنهاء جميع الجلسات</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم إنهاء جميع الجلسات النشطة. سيتم تسجيل خروج جميع المستخدمين من النظام.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => terminateAllMutation.mutate()} disabled={terminateAllMutation.isPending}
                        className="bg-[hsl(222_47%_11%)] text-white"
                      >
                        تأكيد الإنهاء
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري تحميل الجلسات...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا توجد جلسات نشطة</div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const expired = isSessionExpired(session.expiresAt);
                  
                  return (
                    <div 
                      key={session.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        expired 
                          ? 'border-[hsl(222_47%_11%)]/30 bg-[hsl(222_47%_11%)]/5' 
                          : 'border-border hover:border-[hsl(43_74%_49%)]/30'
                      }`}
                      data-testid={`session-item-${session.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${expired ? 'bg-[hsl(222_47%_11%)]/10' : 'bg-[hsl(222_47%_11%)]/10'}`}>
                          {getDeviceIcon(session.userAgent)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getDeviceName(session.userAgent)}</span>
                            {expired ? (
                              <Badge variant="outline" className="text-xs text-muted-foreground border-[hsl(222_47%_11%)]/30">
                                منتهية
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-[hsl(43_74%_49%)]/20 hub-stat-gold">
                                نشطة
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(session.lastActivity)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground"
                            data-testid={`button-terminate-session-${session.id}`}
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد إنهاء الجلسة</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم إنهاء هذه الجلسة وتسجيل خروج المستخدم.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => terminateSessionMutation.mutate(session.id)} disabled={terminateSessionMutation.isPending}
                              className="bg-[hsl(222_47%_11%)] text-white"
                            >
                              إنهاء الجلسة
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
