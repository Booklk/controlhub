import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { infrastructureNavGroups } from "@/lib/navigation";
import { 
  HardDrive, Plus, RefreshCw, Database, 
  Cloud, Archive, CheckCircle,
  Trash2, FolderOpen, Activity,
  FileDown, FileSpreadsheet, Pencil
} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus } from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";


export default function InfrastructureStorage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newStorage, setNewStorage] = useState({
    name: "",
    storageType: "SAN",
    totalCapacityTb: "",
    status: "healthy"
  });

  const { data: storageUnits = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/infrastructure/storage'],
  });

  const createStorageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/infrastructure/storage', {
        name: data.name,
        storageType: data.storageType,
        totalCapacityTb: parseInt(data.totalCapacityTb) || 100,
        usedCapacityTb: 0,
        status: 'healthy',
        raidLevel: 'RAID-5',
        location: 'الموقع الرئيسي'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/storage'] });
      invalidateRelatedQueries('/api/infrastructure/storage');
      setIsAddDialogOpen(false);
      setNewStorage({ name: "", storageType: "SAN", totalCapacityTb: "", status: "healthy" });
      toast({ title: "تم إضافة وحدة التخزين بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة وحدة التخزين", variant: "destructive" });
    }
  });

  const deleteStorageMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/infrastructure/storage/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/storage'] });
      invalidateRelatedQueries('/api/infrastructure/storage');
      toast({ title: "تم حذف وحدة التخزين بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف وحدة التخزين", variant: "destructive" });
    }
  });

  const updateStorageMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `/api/infrastructure/storage/${id}`, {
        name: updateData.name,
        storageType: updateData.storageType,
        totalCapacityTb: parseInt(updateData.totalCapacityTb) || 100,
        status: updateData.status || 'healthy',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/storage'] });
      invalidateRelatedQueries('/api/infrastructure/storage');
      setIsAddDialogOpen(false);
      setEditing(null);
      setNewStorage({ name: "", storageType: "SAN", totalCapacityTb: "", status: "healthy" });
      toast({ title: "تم تحديث وحدة التخزين بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث وحدة التخزين", variant: "destructive" });
    }
  });

  const totalCapacity = storageUnits.reduce((a: number, s: any) => a + (s.totalCapacityTb || 0), 0);
  const usedCapacity = storageUnits.reduce((a: number, s: any) => a + (s.usedCapacityTb || 0), 0);
  const availableCapacity = totalCapacity - usedCapacity;

  const storageStats = [
    { label: "إجمالي المساحة", value: `${totalCapacity} TB`, icon: HardDrive, color: "gold" },
    { label: "المستخدم", value: `${usedCapacity} TB`, icon: Database, color: "navy" },
    { label: "المتاح", value: `${availableCapacity} TB`, icon: FolderOpen, color: "gold" },
    { label: "وحدات التخزين", value: `${storageUnits.length}`, icon: Archive, color: "navy" },
  ];

  const storageVolumes = storageUnits.map((s: any) => ({
    id: s.id,
    name: s.name || 'وحدة تخزين',
    total: s.totalCapacityTb || 0,
    used: s.usedCapacityTb || 0,
    type: s.storageType || 'unknown',
    status: s.status || 'unknown',
    _raw: s
  }));

  const recentOperations = storageUnits
    .filter((s: any) => s.updatedAt || s.createdAt)
    .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 4)
    .map((s: any) => ({
      action: "عملية تخزين",
      target: s.name || 'وحدة تخزين',
      size: `${s.totalCapacityTb || 0} TB`,
      time: s.updatedAt ? new Date(s.updatedAt).toLocaleString('ar-SA') : 'غير محدد',
      status: s.status === 'healthy' ? 'completed' : 'in_progress'
    }));


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير التخزين',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"وحدة التخزين","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"السعة (TB)","key":"capacity","width":20},{"header":"المستخدم (TB)","key":"used","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (storageUnits || []).map((item: any) => ({ name: item.name || '', type: item.storageType || item.type || '', capacity: item.totalCapacityTb?.toString() || '', used: item.usedCapacityTb?.toString() || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-storage-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير التخزين',
      columns: [{"header":"وحدة التخزين","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"السعة (TB)","key":"capacity","width":20},{"header":"المستخدم (TB)","key":"used","width":20},{"header":"الحالة","key":"status","width":20}],
      data: (storageUnits || []).map((item: any) => ({ name: item.name || '', type: item.storageType || item.type || '', capacity: item.totalCapacityTb?.toString() || '', used: item.usedCapacityTb?.toString() || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-storage-report',
    });
  };

  return (
    <DashboardLayout 
      title="إدارة التخزين" 
      subtitle="مراقبة وإدارة أنظمة التخزين"
      navGroups={infrastructureNavGroups}
      portalName="البنية التحتية"
    >
      <div className="space-y-5">
        <PageHeader
          icon={HardDrive}
          title="إدارة التخزين"
          subtitle="مراقبة وإدارة أنظمة وموارد التخزين"
          actions={
            <>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => { setEditing(null); setNewStorage({ name: "", storageType: "SAN", totalCapacityTb: "", status: "healthy" }); setIsAddDialogOpen(true); }} data-testid="button-add-storage"><Plus className="w-3.5 h-3.5" />إضافة وحدة</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المساحة" value={`${totalCapacity} TB`} icon={HardDrive} color="navy" />
          <KpiCard label="المستخدم" value={`${usedCapacity} TB`} icon={Database} color="gold" />
          <KpiCard label="المتاح" value={`${availableCapacity} TB`} icon={FolderOpen} color="success" />
          <KpiCard label="وحدات التخزين" value={storageUnits.length} icon={Archive} color="info" />
        </div>

        {/* Storage Volumes */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 hub-stat-gold" />
              وحدات التخزين
            </CardTitle>
          </CardHeader>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (!open) {
                    setEditing(null);
                    setNewStorage({ name: "", storageType: "SAN", totalCapacityTb: "", status: "healthy" });
                  }
                }}>
                  <DialogContent dir="rtl">
                    <DialogHeader>
                      <DialogTitle>{editing ? "تعديل وحدة التخزين" : "إضافة وحدة تخزين جديدة"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>اسم الوحدة</Label>
                        <Input
                          value={newStorage.name}
                          onChange={(e) => setNewStorage({ ...newStorage, name: e.target.value })}
                          placeholder="SAN Primary"
                          data-testid="input-storage-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>نوع التخزين</Label>
                        <Select value={newStorage.storageType} onValueChange={(v) => setNewStorage({ ...newStorage, storageType: v })}>
                          <SelectTrigger data-testid="select-storage-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SAN">SAN</SelectItem>
                            <SelectItem value="NAS">NAS</SelectItem>
                            <SelectItem value="Cloud">Cloud</SelectItem>
                            <SelectItem value="Archive">Archive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>السعة الإجمالية (TB)</Label>
                        <Input
                          type="number"
                          value={newStorage.totalCapacityTb}
                          onChange={(e) => setNewStorage({ ...newStorage, totalCapacityTb: e.target.value })}
                          placeholder="200"
                          data-testid="input-storage-capacity"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => {
                          setIsAddDialogOpen(false);
                          setEditing(null);
                          setNewStorage({ name: "", storageType: "SAN", totalCapacityTb: "", status: "healthy" });
                        }}>إلغاء</Button>
                        <Button
                          className="btn-gold"
                          onClick={() => {
                            if (editing) {
                              updateStorageMutation.mutate({ ...newStorage, id: editing.id });
                            } else {
                              createStorageMutation.mutate(newStorage);
                            }
                          }}
                          disabled={editing ? updateStorageMutation.isPending : createStorageMutation.isPending}
                          data-testid="button-submit-storage"
                        >
                          {editing
                            ? (updateStorageMutation.isPending ? "جاري التحديث..." : "تحديث الوحدة")
                            : (createStorageMutation.isPending ? "جاري الإضافة..." : "إضافة الوحدة")
                          }
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storageVolumes.map((volume, index) => (
                <div key={index} className={`p-4 bg-muted/30 rounded-lg animate-fadeInUp stagger-${index + 1}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {volume.type === 'Cloud' ? (
                        <Cloud className="w-5 h-5 hub-stat-gold" />
                      ) : volume.type === 'Archive' ? (
                        <Archive className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <HardDrive className="w-5 h-5 hub-stat-gold" />
                      )}
                      <span className="font-medium">{volume.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={volume.status === 'healthy' ? 'default' : 'secondary'}>
                        {volume.status === 'healthy' ? 'سليم' : 'تحذير'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-edit-storage-${volume.id}`}
                        onClick={() => {
                          const raw = volume._raw;
                          setEditing(raw);
                          setNewStorage({
                            name: raw.name || '',
                            storageType: raw.storageType || 'SAN',
                            totalCapacityTb: String(raw.totalCapacityTb || ''),
                            status: raw.status || 'healthy'
                          });
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-storage-${volume.id}`}
                        onClick={() => deleteStorageMutation.mutate(volume.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المستخدم: {volume.used} TB</span>
                      <span className="text-muted-foreground">الإجمالي: {volume.total} TB</span>
                    </div>
                    <Progress value={(volume.used / volume.total) * 100} className="h-3" />
                    <div className="text-left text-sm font-medium">
                      {Math.round((volume.used / volume.total) * 100)}% مستخدم
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Operations */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 hub-stat-gold" />
              العمليات الأخيرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOperations.map((op, index) => (
                <div key={index} className={`flex items-center justify-between p-3 bg-muted/30 rounded-lg animate-fadeInUp stagger-${index + 1}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${op.status === 'completed' ? 'hub-icon-gold' : 'hub-icon-navy'}`}>
                      {op.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 hub-stat-gold" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{op.action}</p>
                      <p className="text-sm text-muted-foreground">{op.target}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{op.size}</p>
                    <p className="text-sm text-muted-foreground">{op.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
