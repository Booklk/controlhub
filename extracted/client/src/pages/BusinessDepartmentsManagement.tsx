import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import DashboardLayout from '@/components/DashboardLayout';
import { adminNavGroups } from '@/lib/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import {
  Building2, Plus, Pencil, Trash2, Search, RefreshCw, FileDown, FileSpreadsheet,
  CheckCircle2, XCircle
} from 'lucide-react';
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { PageHeader, KpiCard } from '@/components/Quality';
import { LoadingButton } from '@/components/LoadingButton';

// ==================== Zod Validation Schemas ====================
const departmentFormSchema = z.object({
  nameAr: z.string()
    .min(2, { message: 'اسم القسم بالعربي مطلوب (2 أحرف على الأقل)' })
    .refine(val => /[\u0600-\u06FF]/.test(val), {
      message: 'يجب أن يحتوي الاسم على أحرف عربية'
    }),
  nameEn: z.string().optional().refine(val => !val || val.length === 0 || /^[a-zA-Z\s]+$/.test(val), {
    message: 'الاسم بالإنجليزي يجب أن يحتوي على أحرف إنجليزية فقط'
  }),
  code: z.string()
    .min(1, { message: 'رمز القسم مطلوب' })
    .regex(/^[A-Z0-9_]+$/, { message: 'رمز القسم غير صحيح (يجب أن يكون أحرف كبيرة وأرقام وشرطات سفلية فقط)' }),
  managerId: z.number().optional(),
  description: z.string()
    .max(500, { message: 'الوصف يجب ألا يتجاوز 500 حرف' })
    .optional(),
  isActive: z.boolean().default(true),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;


interface Department {
  id: number;
  nameAr: string;
  nameEn: string | null;
  code: string;
  description: string | null;
  managerId: number | null;
  parentId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BusinessDepartmentsManagement() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  // Add form
  const addForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      code: '',
      description: '',
      isActive: true,
    },
  });

  // Edit form
  const editForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      code: '',
      description: '',
      isActive: true,
    },
  });

  const { data: departments = [], isLoading, refetch } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    staleTime: 15 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      const res = await apiRequest('POST', '/api/departments', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({ title: 'تم إضافة الإدارة بنجاح' });
      setIsAddOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في إضافة الإدارة', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DepartmentFormValues }) => {
      const res = await apiRequest('PUT', `/api/departments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({ title: 'تم تحديث الإدارة بنجاح' });
      setIsEditOpen(false);
      setSelectedDepartment(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في تحديث الإدارة', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/departments/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({ title: 'تم حذف الإدارة بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'حدث خطأ في حذف الإدارة', description: error.message, variant: 'destructive' });
    },
  });

  const handleExportPDF = () => {
    exportToPDF({
      title: 'إدارات الأعمال',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الاسم', key: 'nameAr', width: 40 },
        { header: 'الرمز', key: 'code', width: 20 },
        { header: 'الحالة', key: 'statusLabel', width: 20 },
        { header: 'الوصف', key: 'description', width: 50 },
      ],
      data: departments.map(d => ({
        ...d,
        statusLabel: d.isActive ? 'فعّالة' : 'غير فعّالة',
        description: d.description || '-',
      })),
      filename: `departments-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'إدارات الأعمال',
      columns: [
        { header: 'الاسم', key: 'nameAr' },
        { header: 'الرمز', key: 'code' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'الوصف', key: 'description' },
      ],
      data: departments.map(d => ({
        ...d,
        statusLabel: d.isActive ? 'فعّالة' : 'غير فعّالة',
        description: d.description || '-',
      })),
      filename: `departments-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const filteredDepartments = departments.filter(dept =>
    dept.nameAr?.includes(searchTerm) ||
    (dept.nameEn && dept.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (dept: Department) => {
    setSelectedDepartment(dept);
    editForm.reset({
      nameAr: dept.nameAr,
      nameEn: dept.nameEn || '',
      code: dept.code,
      description: dept.description || '',
      isActive: dept.isActive,
    });
    setIsEditOpen(true);
  };

  const handleDelete = (dept: Department) => {
    confirmAction(() => deleteMutation.mutate(dept.id), { title: 'تأكيد الحذف', description: `هل أنت متأكد من حذف إدارة "${dept.nameAr}"؟ لا يمكن التراجع عن هذا الإجراء.` });
  };

  return (
    <DashboardLayout
      title="إدارات الأعمال"
      subtitle="إدارة قائمة إدارات الأعمال للنادي"
      navGroups={adminNavGroups}
      portalName="admin"
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Building2}
          title="إدارة الأقسام التجارية"
          subtitle="إدارة قائمة إدارات الأعمال للنادي"
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي الإدارات" value={departments.length} icon={Building2} color="navy" />
          <KpiCard label="الإدارات الفعّالة" value={departments.filter(d => d.isActive).length} icon={CheckCircle2} color="success" />
          <KpiCard label="غير فعّالة" value={departments.filter(d => !d.isActive).length} icon={XCircle} color={departments.filter(d => !d.isActive).length > 0 ? "danger" : "muted"} />
          <KpiCard label="نتائج البحث" value={filteredDepartments.length} icon={Search} color="gold" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث عن إدارة..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-10 w-64"
                data-testid="input-search-department"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-departments"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <Dialog open={isAddOpen} onOpenChange={(open) => {
            if (!open) {
              addForm.reset();
            }
            setIsAddOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="btn-gold" data-testid="button-add-department">
                <Plus className="w-4 h-4 ml-2" />
                إضافة إدارة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">إضافة إدارة جديدة</DialogTitle>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(values => createMutation.mutate(values))} className="grid gap-4 py-4">
                  <FormField
                    control={addForm.control}
                    name="nameAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">الاسم بالعربي *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="مثال: إدارة السباقات"
                            data-testid="input-name-ar"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="nameEn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">الاسم بالإنجليزي</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Racing Department"
                            dir="ltr"
                            data-testid="input-name-en"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">الرمز *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="مثال: RACING"
                            dir="ltr"
                            onChange={e => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">الوصف</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="وصف مختصر للإدارة..."
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>الحالة</FormLabel>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{field.value ? 'فعّالة' : 'غير فعّالة'}</span>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-is-active"
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsAddOpen(false)} type="button">إلغاء</Button>
                    <LoadingButton
                      className="btn-gold"
                      loading={createMutation.isPending}
                      loadingText="جاري الحفظ..."
                      type="submit"
                      data-testid="button-save-department"
                    >
                      إضافة الإدارة
                    </LoadingButton>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDepartments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">لا توجد إدارات</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'لم يتم العثور على نتائج للبحث' : 'أضف أول إدارة أعمال للنادي'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setIsAddOpen(true)}
                  className="btn-gold"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة إدارة
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map(dept => (
              <Card key={dept.id} className="card-premium hover-elevate transition-all" data-testid={`department-card-${dept.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{dept.nameAr}</CardTitle>
                      {dept.nameEn && (
                        <p className="text-sm text-muted-foreground" dir="ltr">{dept.nameEn}</p>
                      )}
                    </div>
                    <Badge
                      className={dept.isActive
                        ? 'hub-badge-gold hub-stat-gold border-accent/30'
                        : 'bg-primary/10 text-muted-foreground'
                      }
                    >
                      {dept.isActive ? 'فعّالة' : 'غير فعّالة'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{dept.code}</Badge>
                    </div>
                    {dept.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{dept.description}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(dept)}
                        data-testid={`button-edit-${dept.id}`}
                      >
                        <Pencil className="w-4 h-4 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleDelete(dept)}
                        data-testid={`button-delete-${dept.id}`}
                      >
                        <Trash2 className="w-4 h-4 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditOpen} onOpenChange={(open) => {
          if (!open) {
            editForm.reset();
            setSelectedDepartment(null);
          }
          setIsEditOpen(open);
        }}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">تعديل الإدارة</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(values => selectedDepartment && updateMutation.mutate({ id: selectedDepartment.id, data: values }))} className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="nameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">الاسم بالعربي *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-edit-name-ar"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="nameEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">الاسم بالإنجليزي</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          dir="ltr"
                          data-testid="input-edit-name-en"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">الرمز *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          dir="ltr"
                          onChange={e => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-edit-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">الوصف</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="input-edit-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>الحالة</FormLabel>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{field.value ? 'فعّالة' : 'غير فعّالة'}</span>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-edit-is-active"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsEditOpen(false)} type="button">إلغاء</Button>
                  <LoadingButton
                    className="btn-gold"
                    loading={updateMutation.isPending}
                    loadingText="جاري التحديث..."
                    type="submit"
                    data-testid="button-update-department"
                  >
                    تحديث الإدارة
                  </LoadingButton>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
