import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest, invalidateRelatedQueries } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { PageHeader, KpiCard } from '@/components/Quality';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, Edit, Trash2, UserCheck, UserX,
  FileDown, FileSpreadsheet, Eye, KeyRound, LogOut, Mail,
  Clock, ShieldCheck, Ticket, Activity, RefreshCw,
  Phone, Briefcase, Building2, Calendar, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToPDF, exportToExcel } from '@/lib/exports';

const createUserSchema = z.object({
  name: z.string().min(1, { message: 'الاسم مطلوب' }).max(200),
  email: z.string().email({ message: 'البريد الإلكتروني غير صحيح' })
    .refine((e) => e.endsWith('@jcsa.sa'), { message: 'البريد يجب أن يكون بنطاق @jcsa.sa' }),
  departmentId: z.number().optional(),
  role: z.string().min(1, { message: 'الدور مطلوب' }),
  portal: z.string().min(1, { message: 'البوابة مطلوبة' }),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface User {
  id: number;
  email: string;
  name: string;
  nameEn: string | null;
  phone: string | null;
  jobTitle: string | null;
  role: string;
  portal: string;
  departmentId: number | null;
  isActive: boolean;
  isActivated: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserStats {
  ticketsCreated: number;
  activeSessions: number;
  totalAuditLogs: number;
  lastLoginAt: string | null;
  recentActivity: Array<{
    id: number;
    action: string;
    entityType: string;
    details: string | null;
    createdAt: string;
  }>;
}

const roleLabels: Record<string, string> = {
  system_admin: 'مدير النظام',
  it_director: 'المدير العام لتقنية المعلومات والتحول الرقمي',
  it_infrastructure_manager: 'مدير إدارة البنية التحتية والشبكات',
  it_cybersecurity_manager: 'مدير إدارة الأمن السيبراني',
  it_digital_manager: 'مدير إدارة التحول الرقمي',
  it_support_manager: 'مدير إدارة الدعم الفني',
  it_infrastructure_staff: 'موظف البنية التحتية والشبكات',
  it_cybersecurity_staff: 'موظف الأمن السيبراني',
  it_digital_staff: 'موظف التحول الرقمي',
  it_support_staff: 'موظف الدعم الفني',
  dmo_manager: 'مدير مكتب إدارة البيانات',
  dmo_staff: 'موظف مكتب إدارة البيانات',
  data_steward: 'أمين البيانات',
  data_representative: 'ممثل البيانات',
  committee_chairman: 'رئيس اللجنة',
  committee_vice_chairman: 'نائب رئيس اللجنة',
  committee_rapporteur: 'مقرر اللجنة',
  committee_member: 'عضو اللجنة',
  employee: 'موظف',
};

const portalLabels: Record<string, string> = {
  admin: 'بوابة الإدارة',
  it_director: 'بوابة مدير تقنية المعلومات',
  infrastructure: 'بوابة البنية التحتية والشبكات',
  cybersecurity: 'بوابة الأمن السيبراني',
  digital_transformation: 'بوابة التحول الرقمي',
  support: 'بوابة الدعم الفني',
  dmo: 'بوابة مكتب إدارة البيانات',
  committee: 'بوابة اللجنة',
  data_rep: 'بوابة ممثل البيانات',
  steward: 'بوابة أمين البيانات',
};

const roleToPortal: Record<string, string> = {
  system_admin: 'admin',
  it_director: 'it_director',
  it_infrastructure_manager: 'infrastructure',
  it_cybersecurity_manager: 'cybersecurity',
  it_digital_manager: 'digital_transformation',
  it_support_manager: 'support',
  it_infrastructure_staff: 'infrastructure',
  it_cybersecurity_staff: 'cybersecurity',
  it_digital_staff: 'digital_transformation',
  it_support_staff: 'support',
  dmo_manager: 'dmo',
  dmo_staff: 'dmo',
  data_steward: 'steward',
  data_representative: 'data_rep',
  committee_chairman: 'committee',
  committee_vice_chairman: 'committee',
  committee_rapporteur: 'committee',
  committee_member: 'committee',
  employee: 'employee',
};

function getUserInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('');
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'لم يسجل دخول';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return date.toLocaleDateString('ar-SA');
}

const PROTECTED_EMAIL = 'controlhub@jcsa.sa';

export default function UsersManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [portalFilter, setPortalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false);

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', departmentId: undefined, role: 'data_representative', portal: 'data_rep' },
    mode: 'onChange',
  });

  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/users', viewingUser?.id, 'stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/users/${viewingUser!.id}/stats`);
      return res.json();
    },
    enabled: !!viewingUser && isViewSheetOpen,
  });

  // Mutations
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest('PUT', `/api/users/${id}/toggle`, { isActive });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      invalidateRelatedQueries('/api/users');
      if (viewingUser?.id === vars.id) setViewingUser(prev => prev ? { ...prev, isActive: vars.isActive } : null);
      toast({ title: vars.isActive ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب' });
    },
    onError: (error: Error) => toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }),
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserFormData) => {
      const portal = roleToPortal[userData.role] || userData.portal;
      const res = await apiRequest('POST', '/api/users', {
        name: userData.name,
        email: userData.email,
        departmentId: userData.departmentId || null,
        role: userData.role,
        portal,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      invalidateRelatedQueries('/api/users');
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: 'تم إنشاء المستخدم بنجاح', description: 'سيتم إرسال رابط التفعيل عبر البريد الإلكتروني' });
    },
    onError: (error: Error) => toast({ title: 'حدث خطأ في إنشاء المستخدم', description: error.message, variant: 'destructive' }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await apiRequest('PUT', `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      invalidateRelatedQueries('/api/users');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({ title: 'تم تحديث المستخدم بنجاح' });
    },
    onError: (error: Error) => toast({ title: 'حدث خطأ في تحديث المستخدم', description: error.message, variant: 'destructive' }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      invalidateRelatedQueries('/api/users');
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setIsViewSheetOpen(false);
      toast({ title: 'تم حذف المستخدم بنجاح' });
    },
    onError: (error: Error) => toast({ title: 'حدث خطأ في حذف المستخدم', description: error.message, variant: 'destructive' }),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/users/${id}/sessions`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', viewingUser?.id, 'stats'] });
      toast({ title: 'تم إلغاء جميع جلسات المستخدم بنجاح' });
    },
    onError: (error: Error) => toast({ title: 'حدث خطأ في إلغاء الجلسات', description: error.message, variant: 'destructive' }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/users/${id}/reset-password`);
      return res.json();
    },
    onSuccess: () => toast({ title: 'تم إرسال رابط إعادة ضبط كلمة المرور عبر البريد الإلكتروني' }),
    onError: (error: Error) => toast({ title: 'حدث خطأ في إرسال رابط الاسترداد', description: error.message, variant: 'destructive' }),
  });

  const resendActivationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/users/${id}/resend-activation`);
      return res.json();
    },
    onSuccess: () => toast({ title: 'تم إرسال رابط التفعيل بنجاح' }),
    onError: (error: Error) => toast({ title: 'حدث خطأ في إرسال رابط التفعيل', description: error.message, variant: 'destructive' }),
  });

  // Filtering
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPortal = portalFilter === 'all' || u.portal === portalFilter;
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive) ||
      (statusFilter === 'pending' && !u.isActivated);
    return matchSearch && matchPortal && matchStatus;
  });

  const activeCount = users.filter(u => u.isActive).length;
  const pendingCount = users.filter(u => !u.isActivated).length;
  const adminCount = users.filter(u => u.portal === 'admin' || u.portal === 'it_director').length;

  const handleViewUser = (user: User) => { setViewingUser(user); setIsViewSheetOpen(true); };
  const handleEditUser = (user: User) => { setEditingUser(user); setIsEditDialogOpen(true); };
  const handleDeleteConfirm = (user: User) => { setUserToDelete(user); setIsDeleteDialogOpen(true); };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      id: editingUser.id,
      data: { name: editingUser.name, role: editingUser.role, portal: editingUser.portal, phone: editingUser.phone, jobTitle: editingUser.jobTitle, itDepartmentId: editingUser.itDepartmentId },
    });
  };

  const onSubmit = (data: CreateUserFormData) => createUserMutation.mutate(data);

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير المستخدمين - JCSA Control Hub',
      subtitle: 'نادي سباقات الخيل السعودي',
      columns: [
        { header: 'الاسم', key: 'name', width: 30 },
        { header: 'البريد الإلكتروني', key: 'email', width: 35 },
        { header: 'الدور', key: 'role', width: 35 },
        { header: 'البوابة', key: 'portal', width: 25 },
        { header: 'الحالة', key: 'status', width: 20 },
        { header: 'آخر دخول', key: 'lastLogin', width: 25 },
      ],
      data: filteredUsers.map(u => ({
        name: u.name,
        email: u.email,
        role: roleLabels[u.role] || u.role,
        portal: portalLabels[u.portal] || u.portal,
        status: u.isActive ? 'نشط' : 'معطل',
        lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA') : 'لم يسجل',
      })),
      filename: 'users-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير المستخدمين',
      columns: [
        { header: 'الاسم', key: 'name' },
        { header: 'البريد الإلكتروني', key: 'email' },
        { header: 'الدور', key: 'role' },
        { header: 'البوابة', key: 'portal' },
        { header: 'الحالة', key: 'status' },
        { header: 'آخر دخول', key: 'lastLogin' },
      ],
      data: filteredUsers.map(u => ({
        name: u.name,
        email: u.email,
        role: roleLabels[u.role] || u.role,
        portal: portalLabels[u.portal] || u.portal,
        status: u.isActive ? 'نشط' : 'معطل',
        lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA') : 'لم يسجل',
      })),
      filename: 'users-report',
    });
  };

  return (
    <DashboardLayout title="إدارة المستخدمين" subtitle="إضافة وتعديل وإدارة حسابات المستخدمين" navGroups={adminNavGroups} portalName="بوابة مدير النظام">
      <div className="space-y-5">
        <PageHeader
          icon={Users}
          title="إدارة المستخدمين"
          subtitle="إضافة وتعديل وإدارة حسابات المستخدمين"
          actions={
            <>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportPDF} data-testid="button-export-pdf" title="PDF"><FileDown className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleExportExcel} data-testid="button-export-excel" title="Excel"><FileSpreadsheet className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh" title="تحديث"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-user-header"><Plus className="w-3.5 h-3.5" />إضافة مستخدم</Button>
            </>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المستخدمين" value={users.length} icon={Users} color="navy" />
          <KpiCard label="الحسابات النشطة" value={activeCount} icon={UserCheck} color="success" />
          <KpiCard label="بانتظار التفعيل" value={pendingCount} icon={Clock} color={pendingCount > 0 ? "gold" : "muted"} />
          <KpiCard label="مسؤولو النظام" value={adminCount} icon={ShieldCheck} color="navy" />
        </div>

        {/* Main Table */}
        <Card className="card-premium">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 hub-stat-gold" />
                قائمة المستخدمين ({filteredUsers.length})
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="بحث بالاسم أو البريد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-10 w-52" data-testid="input-search-users" />
                </div>
                <Select value={portalFilter} onValueChange={setPortalFilter}>
                  <SelectTrigger className="w-44" data-testid="select-portal-filter"><SelectValue placeholder="كل البوابات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل البوابات</SelectItem>
                    {Object.entries(portalLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">معطل</SelectItem>
                    <SelectItem value="pending">بانتظار التفعيل</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleExportPDF} data-testid="button-export-pdf-desktop" title="تصدير PDF"><FileDown className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" onClick={handleExportExcel} data-testid="button-export-excel-desktop" title="تصدير Excel"><FileSpreadsheet className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-desktop" title="تحديث"><RefreshCw className="w-4 h-4" /></Button>
                <Dialog open={isAddDialogOpen} onOpenChange={open => { setIsAddDialogOpen(open); if (!open) form.reset(); }}>
                  <DialogTrigger asChild>
                    <Button className="btn-gold gap-2" data-testid="button-add-user"><Plus className="w-4 h-4" />إضافة مستخدم</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md" dir="rtl">
                    <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogBody className="space-y-4">
                          <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>الاسم الكامل *</FormLabel>
                              <FormControl><Input placeholder="محمد أحمد العمري" {...field} data-testid="input-new-user-name" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                              <FormLabel>البريد الإلكتروني *</FormLabel>
                              <FormControl><Input type="email" placeholder="username@jcsa.sa" {...field} data-testid="input-new-user-email" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem>
                              <FormLabel>الدور *</FormLabel>
                              <Select value={field.value} onValueChange={v => { field.onChange(v); const p = roleToPortal[v]; if (p) form.setValue('portal', p); }}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-new-user-role"><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                              {form.watch('role') && roleToPortal[form.watch('role')] && (
                                <p className="text-xs text-muted-foreground mt-1">البوابة: {portalLabels[roleToPortal[form.watch('role')]] || roleToPortal[form.watch('role')]}</p>
                              )}
                            </FormItem>
                          )} />
                        </DialogBody>
                        <DialogFooter className="gap-2">
                          <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); form.reset(); }} data-testid="button-cancel-add-user">إلغاء</Button>
                          <Button type="submit" disabled={createUserMutation.isPending || !form.formState.isValid} className="btn-gold" data-testid="button-confirm-add-user">
                            {createUserMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا يوجد مستخدمون يطابقون البحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-muted-foreground text-sm">
                      <th className="text-right py-3 px-4 font-medium">المستخدم</th>
                      <th className="text-right py-3 px-4 font-medium hidden md:table-cell">الدور</th>
                      <th className="text-right py-3 px-4 font-medium hidden lg:table-cell">البوابة</th>
                      <th className="text-right py-3 px-4 font-medium">الحالة</th>
                      <th className="text-right py-3 px-4 font-medium hidden md:table-cell">آخر دخول</th>
                      <th className="text-right py-3 px-4 font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b hover:bg-muted/40 transition-colors cursor-pointer"
                        data-testid={`user-row-${user.id}`}
                        onClick={() => handleViewUser(user)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${user.isActive ? 'bg-[hsl(var(--hub-navy))]' : 'bg-muted-foreground/40'}`}>
                              {getUserInitials(user.name)}
                            </div>
                            <div>
                              <p className="font-medium leading-tight">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <Badge variant="outline" className="text-xs font-normal">{roleLabels[user.role] || user.role}</Badge>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          <Badge className="hub-badge-navy text-xs">{portalLabels[user.portal] || user.portal}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {user.isActive
                              ? <Badge className="hub-badge-gold text-xs w-fit">نشط</Badge>
                              : <Badge variant="outline" className="text-xs w-fit text-muted-foreground">معطل</Badge>
                            }
                            {!user.isActivated && (
                              <Badge variant="outline" className="text-xs w-fit text-amber-400 border-amber-400/30">لم يُفعَّل</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {formatRelativeTime(user.lastLoginAt)}
                        </td>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`} title="الإجراءات">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleViewUser(user)} data-testid={`button-view-user-${user.id}`}>
                                <Eye className="w-4 h-4 ml-2" />عرض الملف الشخصي
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                                <Edit className="w-4 h-4 ml-2" />تعديل البيانات
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleUserMutation.mutate({ id: user.id, isActive: !user.isActive })}
                                disabled={user.email?.toLowerCase() === PROTECTED_EMAIL}
                                data-testid={`button-toggle-user-${user.id}`}
                              >
                                {user.isActive
                                  ? <><UserX className="w-4 h-4 ml-2" />تعطيل الحساب</>
                                  : <><UserCheck className="w-4 h-4 ml-2" />تفعيل الحساب</>}
                              </DropdownMenuItem>
                              {!user.isActivated && (
                                <DropdownMenuItem onClick={() => resendActivationMutation.mutate(user.id)} data-testid={`button-resend-activation-${user.id}`}>
                                  <Mail className="w-4 h-4 ml-2" />إعادة إرسال التفعيل
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(user.id)} data-testid={`button-reset-password-${user.id}`}>
                                <KeyRound className="w-4 h-4 ml-2" />إعادة ضبط كلمة المرور
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => revokeSessionsMutation.mutate(user.id)} data-testid={`button-revoke-sessions-${user.id}`}>
                                <LogOut className="w-4 h-4 ml-2" />إلغاء جميع الجلسات
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteConfirm(user)}
                                disabled={user.email?.toLowerCase() === PROTECTED_EMAIL}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4 ml-2" />حذف المستخدم
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ====== View User Profile Sheet ====== */}
        <Sheet open={isViewSheetOpen} onOpenChange={open => { setIsViewSheetOpen(open); if (!open) setViewingUser(null); }}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto" dir="rtl" data-testid="sheet-user-profile">
            {viewingUser && (
              <>
                <SheetHeader className="mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${viewingUser.isActive ? 'bg-[hsl(var(--hub-navy))]' : 'bg-muted-foreground/40'}`}>
                      {getUserInitials(viewingUser.name)}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-xl leading-tight">{viewingUser.name}</SheetTitle>
                      <p className="text-sm text-muted-foreground truncate">{viewingUser.email}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {viewingUser.isActive
                          ? <Badge className="hub-badge-gold text-xs">نشط</Badge>
                          : <Badge variant="outline" className="text-xs text-muted-foreground">معطل</Badge>}
                        {viewingUser.isActivated
                          ? <Badge className="bg-emerald-500/20 text-emerald-400 text-xs border-0">مُفعَّل</Badge>
                          : <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">لم يُفعَّل</Badge>}
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3" onClick={() => { setIsViewSheetOpen(false); handleEditUser(viewingUser); }} data-testid="button-sheet-edit">
                    <Edit className="w-4 h-4" /><span className="text-xs">تعديل</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3" onClick={() => resetPasswordMutation.mutate(viewingUser.id)} disabled={resetPasswordMutation.isPending} data-testid="button-sheet-reset-password">
                    <KeyRound className="w-4 h-4" /><span className="text-xs">كلمة المرور</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3" onClick={() => revokeSessionsMutation.mutate(viewingUser.id)} disabled={revokeSessionsMutation.isPending} data-testid="button-sheet-revoke">
                    <LogOut className="w-4 h-4" /><span className="text-xs">إلغاء الجلسات</span>
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className={`flex flex-col gap-1 h-auto py-3 ${!viewingUser.isActive ? 'text-emerald-400 border-emerald-400/30' : 'text-destructive border-destructive/30'}`}
                    onClick={() => toggleUserMutation.mutate({ id: viewingUser.id, isActive: !viewingUser.isActive })}
                    disabled={viewingUser.email?.toLowerCase() === PROTECTED_EMAIL || toggleUserMutation.isPending}
                    data-testid="button-sheet-toggle"
                  >
                    {viewingUser.isActive
                      ? <><UserX className="w-4 h-4" /><span className="text-xs">تعطيل</span></>
                      : <><UserCheck className="w-4 h-4" /><span className="text-xs">تفعيل</span></>}
                  </Button>
                  {!viewingUser.isActivated && (
                    <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3" onClick={() => resendActivationMutation.mutate(viewingUser.id)} disabled={resendActivationMutation.isPending} data-testid="button-sheet-resend">
                      <Mail className="w-4 h-4" /><span className="text-xs">إرسال تفعيل</span>
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    className="flex flex-col gap-1 h-auto py-3 text-destructive border-destructive/30"
                    onClick={() => { setIsViewSheetOpen(false); handleDeleteConfirm(viewingUser); }}
                    disabled={viewingUser.email?.toLowerCase() === PROTECTED_EMAIL}
                    data-testid="button-sheet-delete"
                  >
                    <Trash2 className="w-4 h-4" /><span className="text-xs">حذف</span>
                  </Button>
                </div>

                <Separator className="mb-5" />

                {/* Stats */}
                {statsLoading ? (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                ) : userStats ? (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'تذاكر أنشأها', value: userStats.ticketsCreated, icon: Ticket, color: 'hub-stat-gold' },
                      { label: 'جلسات نشطة', value: userStats.activeSessions, icon: Activity, color: 'text-emerald-400' },
                      { label: 'سجلات التدقيق', value: userStats.totalAuditLogs, icon: ShieldCheck, color: 'text-sky-400' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-center" data-testid={`stat-${s.label}`}>
                        <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                        <p className="text-xl font-bold tabular-nums">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* User Details */}
                <div className="space-y-2 mb-5">
                  <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">بيانات المستخدم</h3>
                  {[
                    { icon: ShieldCheck, label: 'الدور', value: roleLabels[viewingUser.role] || viewingUser.role },
                    { icon: Building2, label: 'البوابة', value: portalLabels[viewingUser.portal] || viewingUser.portal },
                    { icon: Briefcase, label: 'المسمى الوظيفي', value: viewingUser.jobTitle || '—' },
                    { icon: Phone, label: 'رقم الجوال', value: viewingUser.phone || '—' },
                    { icon: Calendar, label: 'تاريخ الإنشاء', value: new Date(viewingUser.createdAt).toLocaleDateString('ar-SA') },
                    { icon: Clock, label: 'آخر تسجيل دخول', value: formatRelativeTime(viewingUser.lastLoginAt) },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                      <div className="hub-icon-gold flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center">
                        <row.icon className="w-4 h-4 hub-stat-gold" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <p className="font-medium text-sm truncate">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Activity */}
                {userStats && userStats.recentActivity.length > 0 && (
                  <>
                    <Separator className="mb-4" />
                    <div>
                      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">آخر الأنشطة</h3>
                      <div className="space-y-2">
                        {userStats.recentActivity.map(log => (
                          <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-muted/30">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-xs">{log.action} — <span className="text-muted-foreground">{log.entityType}</span></p>
                              {log.details && <p className="text-muted-foreground text-xs truncate">{log.details}</p>}
                              <p className="text-muted-foreground text-xs mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={open => { setIsEditDialogOpen(open); if (!open) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>تعديل بيانات المستخدم</DialogTitle></DialogHeader>
            {editingUser && (
              <>
                <DialogBody className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg mb-2">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--hub-navy))] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {getUserInitials(editingUser.name)}
                    </div>
                    <div>
                      <p className="font-medium">{editingUser.name}</p>
                      <p className="text-xs text-muted-foreground">{editingUser.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">الاسم الكامل</label>
                    <Input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} data-testid="input-edit-name" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">المسمى الوظيفي</label>
                    <Input value={editingUser.jobTitle || ''} onChange={e => setEditingUser({ ...editingUser, jobTitle: e.target.value })} placeholder="مثال: مدير إدارة التحول الرقمي" data-testid="input-edit-jobtitle" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">رقم الجوال</label>
                    <Input value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} placeholder="+966 5xxxxxxxx" data-testid="input-edit-phone" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">الدور</label>
                    <Select value={editingUser.role} onValueChange={v => setEditingUser({ ...editingUser, role: v, portal: roleToPortal[v] || editingUser.portal })}>
                      <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">الإدارة التقنية</label>
                    <Select value={String(editingUser.itDepartmentId || '')} onValueChange={v => {
                      const deptId = parseInt(v);
                      const DEPT_MAP: Record<number, { staff: string; manager: string; portal: string }> = {
                        5: { staff: 'dmo_staff', manager: 'dmo_manager', portal: 'dmo' },
                        9: { staff: 'it_infrastructure_staff', manager: 'it_infrastructure_manager', portal: 'infrastructure' },
                        10: { staff: 'it_cybersecurity_staff', manager: 'it_cybersecurity_manager', portal: 'cybersecurity' },
                        11: { staff: 'it_digital_staff', manager: 'it_digital_manager', portal: 'digital_transformation' },
                        12: { staff: 'it_support_staff', manager: 'it_support_manager', portal: 'support' },
                      };
                      const info = DEPT_MAP[deptId];
                      if (info) {
                        const isManager = editingUser.role?.includes('manager');
                        setEditingUser({ ...editingUser, itDepartmentId: deptId, role: isManager ? info.manager : info.staff, portal: info.portal });
                      } else {
                        setEditingUser({ ...editingUser, itDepartmentId: deptId });
                      }
                    }}>
                      <SelectTrigger data-testid="select-edit-dept"><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">مكتب إدارة البيانات</SelectItem>
                        <SelectItem value="9">البنية التحتية</SelectItem>
                        <SelectItem value="10">الأمن السيبراني</SelectItem>
                        <SelectItem value="11">التحول الرقمي</SelectItem>
                        <SelectItem value="12">الدعم الفني</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">البوابة والدور (تُحدَّث تلقائياً عند تغيير الإدارة)</p>
                    <p className="font-medium text-sm mt-1">{portalLabels[editingUser.portal] || editingUser.portal} · {roleLabels[editingUser.role] || editingUser.role}</p>
                  </div>
                </DialogBody>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingUser(null); }} data-testid="button-cancel-edit">إلغاء</Button>
                  <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending} className="btn-gold" data-testid="button-save-edit">
                    {updateUserMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={open => { setIsDeleteDialogOpen(open); if (!open) setUserToDelete(null); }}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>تأكيد حذف المستخدم</DialogTitle></DialogHeader>
            <DialogBody>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">{userToDelete?.name}</p>
                  <p className="text-sm text-muted-foreground">{userToDelete?.email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا المستخدم؟ هذا الإجراء لا يمكن التراجع عنه وستُحذف جميع بيانات الجلسات المرتبطة به.</p>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setUserToDelete(null); }} data-testid="button-cancel-delete">إلغاء</Button>
              <Button onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} disabled={deleteUserMutation.isPending} variant="destructive" data-testid="button-confirm-delete">
                {deleteUserMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
