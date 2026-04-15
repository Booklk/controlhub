import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import type { NavGroup } from "@/lib/navigation";
import { PageHeader, KpiCard } from "@/components/Quality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Monitor, Server, Laptop, HardDrive, Printer, Router, Smartphone, Package, FileDown, FileSpreadsheet } from "lucide-react";
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';

interface DepartmentAssetsPageProps {
  departmentId: number;
  departmentName: string;
  navItems: any[];
  navGroups?: NavGroup[];
  portalName: string;
}

const categoryLabels: Record<string, { label: string; icon: any }> = {
  computer: { label: "حاسب آلي", icon: Monitor },
  laptop: { label: "لابتوب", icon: Laptop },
  server: { label: "خادم", icon: Server },
  storage: { label: "تخزين", icon: HardDrive },
  printer: { label: "طابعة", icon: Printer },
  network: { label: "شبكات", icon: Router },
  mobile: { label: "جوال", icon: Smartphone },
  other: { label: "أخرى", icon: Package }
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "hub-badge-success" },
  maintenance: { label: "صيانة", color: "bg-yellow-100 text-yellow-800" },
  retired: { label: "متقاعد", color: "hub-badge-neutral" },
  broken: { label: "معطل", color: "bg-red-100 text-red-800" }
};

export default function DepartmentAssetsPage({ departmentId, departmentName, navItems, navGroups, portalName }: DepartmentAssetsPageProps) {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  const [form, setForm] = useState({
    assetTag: "", name: "", nameAr: "", category: "computer",
    manufacturer: "", model: "", serialNumber: "",
    purchaseDate: "", warrantyExpiry: "", status: "active",
    location: "", notes: ""
  });

  const { data: assets = [], isLoading: assetsLoading, isError: assetsError } = useQuery<any[]>({ 
    queryKey: [`/api/it-assets?departmentId=${departmentId}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/it-assets", { ...data, departmentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-assets?departmentId=${departmentId}`] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "تم إضافة الأصل" });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في إضافة الأصل', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/it-assets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-assets?departmentId=${departmentId}`] });
      setIsDialogOpen(false);
      setEditing(null);
      toast({ title: "تم تحديث الأصل" });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في تحديث الأصل', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/it-assets/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/it-assets?departmentId=${departmentId}`] });
      toast({ title: "تم حذف الأصل" });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ في حذف الأصل', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setForm({
      assetTag: "", name: "", nameAr: "", category: "computer",
      manufacturer: "", model: "", serialNumber: "",
      purchaseDate: "", warrantyExpiry: "", status: "active",
      location: "", notes: ""
    });
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({
      assetTag: item.assetTag || "",
      name: item.name || "",
      nameAr: item.nameAr || "",
      category: item.category || "computer",
      manufacturer: item.manufacturer || "",
      model: item.model || "",
      serialNumber: item.serialNumber || "",
      purchaseDate: item.purchaseDate?.split('T')[0] || "",
      warrantyExpiry: item.warrantyExpiry?.split('T')[0] || "",
      status: item.status || "active",
      location: item.location || "",
      notes: item.notes || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nameAr?.trim() && !form.name?.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الأصل التقني", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'أصول تقنية المعلومات',
      subtitle: 'نادي سباقات الخيل — مركز التحكم',
      columns: [
        { header: 'الاسم', key: 'name', width: 40 },
        { header: 'النوع', key: 'categoryLabel', width: 25 },
        { header: 'الحالة', key: 'statusLabel', width: 25 },
        { header: 'الموقع', key: 'location', width: 30 },
      ],
      data: assets.map((a: any) => ({
        ...a,
        categoryLabel: categoryLabels[a.category]?.label || a.category,
        statusLabel: statusLabels[a.status]?.label || a.status,
        location: a.location || '-',
      })),
      filename: `department-assets-${new Date().toISOString().split('T')[0]}`,
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'أصول تقنية المعلومات',
      columns: [
        { header: 'الاسم', key: 'name' },
        { header: 'النوع', key: 'categoryLabel' },
        { header: 'الحالة', key: 'statusLabel' },
        { header: 'الموقع', key: 'location' },
      ],
      data: assets.map((a: any) => ({
        ...a,
        categoryLabel: categoryLabels[a.category]?.label || a.category,
        statusLabel: statusLabels[a.status]?.label || a.status,
        location: a.location || '-',
      })),
      filename: `department-assets-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const stats = {
    total: assets.length,
    active: assets.filter((a: any) => a.status === 'active').length,
    maintenance: assets.filter((a: any) => a.status === 'maintenance').length,
    broken: assets.filter((a: any) => a.status === 'broken').length
  };

  if (assetsLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>;
  if (assetsError) return <div className="flex items-center justify-center h-64 text-destructive">حدث خطأ في جلب البيانات. يرجى تحديث الصفحة.</div>;

  return (
    <DashboardLayout
      title="أصول تقنية المعلومات"
      subtitle={`إدارة الأصول المعينة لـ ${departmentName}`}
      navItems={navItems}
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-5" dir="rtl">
        <PageHeader
          icon={Package}
          title="أصول تقنية المعلومات"
          subtitle={`إدارة الأصول المعينة لـ ${departmentName}`}
          actions={
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsDialogOpen(true)} data-testid="button-add-asset"><Plus className="w-3.5 h-3.5" />إضافة أصل</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الأصول" value={stats.total} icon={Package} color="navy" />
          <KpiCard label="أصول نشطة" value={stats.active} icon={Monitor} color="success" />
          <KpiCard label="قيد الصيانة" value={stats.maintenance} icon={Server} color={stats.maintenance > 0 ? "gold" : "muted"} />
          <KpiCard label="معطلة" value={stats.broken} icon={HardDrive} color={stats.broken > 0 ? "danger" : "muted"} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">قائمة الأصول ({assets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg">لا توجد أصول مسجلة</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رمز الأصل</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>الشركة المصنعة</TableHead>
                    <TableHead>الموديل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الموقع</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset: any) => {
                    const CategoryIcon = categoryLabels[asset.category]?.icon || Package;
                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm">{asset.assetTag || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              {asset.nameAr && <div className="text-sm text-muted-foreground">{asset.nameAr}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{categoryLabels[asset.category]?.label || asset.category}</TableCell>
                        <TableCell>{asset.manufacturer || "-"}</TableCell>
                        <TableCell>{asset.model || "-"}</TableCell>
                        <TableCell>
                          <Badge className={statusLabels[asset.status]?.color || "bg-gray-100"}>
                            {statusLabels[asset.status]?.label || asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{asset.location || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(asset)} data-testid={`button-edit-asset-${asset.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-600" disabled={deleteMutation.isPending} onClick={() => confirmAction(() => deleteMutation.mutate(asset.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا الأصل؟ لا يمكن التراجع عن هذا الإجراء.' })} data-testid={`button-delete-asset-${asset.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل الأصل" : "إضافة أصل جديد"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>رمز الأصل</Label>
                  <Input value={form.assetTag} onChange={e => setForm({...form, assetTag: e.target.value})} placeholder="IT-001" data-testid="input-asset-tag" />
                </div>
                <div>
                  <Label>الاسم (إنجليزي) *</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="input-asset-name" />
                </div>
                <div>
                  <Label>الاسم (عربي)</Label>
                  <Input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} data-testid="input-asset-name-ar" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>الفئة</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger data-testid="select-asset-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الشركة المصنعة</Label>
                  <Input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} data-testid="input-asset-manufacturer" />
                </div>
                <div>
                  <Label>الموديل</Label>
                  <Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} data-testid="input-asset-model" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>الرقم التسلسلي</Label>
                  <Input value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} data-testid="input-asset-serial" />
                </div>
                <div>
                  <Label>تاريخ الشراء</Label>
                  <Input type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} data-testid="input-asset-purchase-date" />
                </div>
                <div>
                  <Label>انتهاء الضمان</Label>
                  <Input type="date" value={form.warrantyExpiry} onChange={e => setForm({...form, warrantyExpiry: e.target.value})} data-testid="input-asset-warranty" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الحالة</Label>
                  <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger data-testid="select-asset-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الموقع</Label>
                  <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} data-testid="input-asset-location" />
                </div>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} data-testid="input-asset-notes" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-asset">إلغاء</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="btn-gold" data-testid="button-submit-asset">
                {createMutation.isPending || updateMutation.isPending ? 'جاري...' : editing ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
