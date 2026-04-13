import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { infrastructureNavGroups } from "@/lib/navigation";
import { 
  Server, Plus, Search, RefreshCw, Activity, 
  HardDrive, Cpu, MemoryStick, Network, CheckCircle, 
  XCircle, Settings,
  Clock, Pencil, FileDown, FileSpreadsheet
} from "lucide-react";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";

export default function InfrastructureServers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedServer, setSelectedServer] = useState<any>(null);
  const [monitorServer, setMonitorServer] = useState<any>(null);
  const [newServer, setNewServer] = useState({
    name: "",
    nameAr: "",
    type: "physical",
    ipAddress: "",
    os: "",
    cpu: "",
    ram: "",
    storage: "",
    location: "",
    description: ""
  });

  const { data: servers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/infrastructure/servers'],
  });

  const createServerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/infrastructure/servers', {
        name: data.nameAr || data.name,
        hostname: data.name,
        ipAddress: data.ipAddress,
        serverType: data.type,
        operatingSystem: data.os,
        cpuCores: parseInt(data.cpu) || 4,
        ramGb: parseInt(data.ram) || 16,
        storageGb: parseInt(data.storage) || 500,
        location: data.location,
        status: 'online',
        purpose: data.description
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/servers'] });
      invalidateRelatedQueries('/api/infrastructure/servers');
      setIsAddDialogOpen(false);
      setNewServer({ name: "", nameAr: "", type: "physical", ipAddress: "", os: "", cpu: "", ram: "", storage: "", location: "", description: "" });
      toast({ title: "تم إضافة الخادم بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    }
  });

  const deleteServerMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/infrastructure/servers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/servers'] });
      invalidateRelatedQueries('/api/infrastructure/servers');
      toast({ title: "تم حذف الخادم بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    }
  });

  const updateServerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/infrastructure/servers/${id}`, {
        name: data.nameAr || data.name,
        hostname: data.name,
        ipAddress: data.ipAddress,
        serverType: data.type,
        operatingSystem: data.os,
        cpuCores: parseInt(data.cpu) || 4,
        ramGb: parseInt(data.ram) || 16,
        storageGb: parseInt(data.storage) || 500,
        location: data.location,
        purpose: data.description
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/servers'] });
      invalidateRelatedQueries('/api/infrastructure/servers');
      setIsAddDialogOpen(false);
      setEditing(null);
      setNewServer({ name: "", nameAr: "", type: "physical", ipAddress: "", os: "", cpu: "", ram: "", storage: "", location: "", description: "" });
      toast({ title: "تم تعديل الخادم بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      online: "bg-[hsl(43_74%_49%)]/20 hub-stat-gold border-[hsl(43_74%_49%)]/30",
      offline: "bg-[hsl(222_47%_11%)]/20 text-muted-foreground border-[hsl(222_47%_11%)]/30",
      maintenance: "bg-[hsl(222_47%_11%)]/10 text-muted-foreground/70 border-[hsl(222_47%_11%)]/20",
    };
    const labels: Record<string, string> = {
      online: "متصل",
      offline: "غير متصل",
      maintenance: "صيانة",
    };
    return <Badge className={styles[status] || styles.offline}>{labels[status] || status}</Badge>;
  };

  const filteredServers = servers.filter((server: any) => {
    const matchesSearch = !searchQuery ||
                         server.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         server.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || server.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: servers.length,
    online: servers.filter((s: any) => s.status === 'online').length,
    offline: servers.filter((s: any) => s.status === 'offline').length,
    maintenance: servers.filter((s: any) => s.status === 'maintenance').length,
  };


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الخوادم',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الخادم","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"عنوان IP","key":"ip","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (servers || []).map((item: any) => ({ name: item.name || item.hostname || '', type: item.type || item.serverType || '', ip: item.ipAddress || item.ip || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-servers-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الخوادم',
      columns: [{"header":"الخادم","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"عنوان IP","key":"ip","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (servers || []).map((item: any) => ({ name: item.name || item.hostname || '', type: item.type || item.serverType || '', ip: item.ipAddress || item.ip || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-servers-report',
    });
  };

  return (
    <DashboardLayout 
      title="إدارة الخوادم" 
      subtitle="مراقبة وإدارة خوادم البنية التحتية"
      navGroups={infrastructureNavGroups}
      portalName="البنية التحتية"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Server}
          title="إدارة الخوادم"
          subtitle="مراقبة وإدارة الخوادم والبنية التحتية"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث عن خادم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-servers" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-status-filter"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="online">متصل</SelectItem>
                  <SelectItem value="offline">غير متصل</SelectItem>
                  <SelectItem value="maintenance">صيانة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-server"><Plus className="w-3.5 h-3.5" />إضافة خادم</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي الخوادم" value={stats.total} icon={Server} color="navy" />
          <KpiCard label="متصل" value={stats.online} icon={CheckCircle} color="success" />
          <KpiCard label="غير متصل" value={stats.offline} icon={XCircle} color={stats.offline > 0 ? "danger" : "muted"} />
          <KpiCard label="صيانة" value={stats.maintenance} icon={Settings} color={stats.maintenance > 0 ? "gold" : "muted"} />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setEditing(null);
                  setNewServer({ name: "", nameAr: "", type: "physical", ipAddress: "", os: "", cpu: "", ram: "", storage: "", location: "", description: "" });
                }
              }}>
                <DialogContent className="max-w-2xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>{editing ? 'تعديل الخادم' : 'إضافة خادم جديد'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>اسم الخادم (عربي)</Label>
                      <Input
                        value={newServer.nameAr}
                        onChange={(e) => setNewServer({ ...newServer, nameAr: e.target.value })}
                        placeholder="خادم قاعدة البيانات"
                        data-testid="input-server-name-ar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم الخادم (إنجليزي)</Label>
                      <Input
                        value={newServer.name}
                        onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                        placeholder="Database Server"
                        data-testid="input-server-name-en"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع الخادم</Label>
                      <Select value={newServer.type} onValueChange={(v) => setNewServer({ ...newServer, type: v })}>
                        <SelectTrigger data-testid="select-server-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="physical">فيزيائي</SelectItem>
                          <SelectItem value="virtual">افتراضي</SelectItem>
                          <SelectItem value="cloud">سحابي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>عنوان IP</Label>
                      <Input
                        value={newServer.ipAddress}
                        onChange={(e) => setNewServer({ ...newServer, ipAddress: e.target.value })}
                        placeholder="192.168.1.100"
                        data-testid="input-server-ip"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نظام التشغيل</Label>
                      <Input
                        value={newServer.os}
                        onChange={(e) => setNewServer({ ...newServer, os: e.target.value })}
                        placeholder="Ubuntu 22.04 LTS"
                        data-testid="input-server-os"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>المعالج</Label>
                      <Input
                        value={newServer.cpu}
                        onChange={(e) => setNewServer({ ...newServer, cpu: e.target.value })}
                        placeholder="Intel Xeon 8 Cores"
                        data-testid="input-server-cpu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الذاكرة</Label>
                      <Input
                        value={newServer.ram}
                        onChange={(e) => setNewServer({ ...newServer, ram: e.target.value })}
                        placeholder="64 GB"
                        data-testid="input-server-ram"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>التخزين</Label>
                      <Input
                        value={newServer.storage}
                        onChange={(e) => setNewServer({ ...newServer, storage: e.target.value })}
                        placeholder="1 TB SSD"
                        data-testid="input-server-storage"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>الموقع</Label>
                      <Input
                        value={newServer.location}
                        onChange={(e) => setNewServer({ ...newServer, location: e.target.value })}
                        placeholder="مركز البيانات الرئيسي"
                        data-testid="input-server-location"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>الوصف</Label>
                      <Textarea
                        value={newServer.description}
                        onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                        placeholder="وصف الخادم والغرض منه..."
                        data-testid="input-server-description"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
                    <Button 
                      className="btn-gold" 
                      onClick={() => {
                        if (editing) {
                          updateServerMutation.mutate({ id: editing.id, data: newServer });
                        } else {
                          createServerMutation.mutate(newServer);
                        }
                      }}
                      disabled={editing ? updateServerMutation.isPending : createServerMutation.isPending}
                      data-testid="button-submit-server"
                    >
                      {editing
                        ? (updateServerMutation.isPending ? "جاري التعديل..." : "تعديل الخادم")
                        : (createServerMutation.isPending ? "جاري الإضافة..." : "إضافة الخادم")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

        {/* Servers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="card-premium animate-pulse">
                <CardContent className="p-6">
                  <div className="h-32 bg-muted/50 rounded-lg" />
                </CardContent>
              </Card>
            ))
          ) : filteredServers.length === 0 ? (
            <Card className="col-span-full card-premium">
              <CardContent className="p-12 text-center">
                <Server className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد خوادم</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة خادم جديد للبنية التحتية</p>
                <Button className="btn-gold" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة خادم
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredServers.map((server: any, index: number) => (
              <Card key={server.id} className={`card-premium card-hover animate-fadeInUp stagger-${(index % 5) + 1}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${server.status === 'online' ? 'hub-icon-gold' : 'hub-icon-navy'}`}>
                        <Server className={`w-5 h-5 ${server.status === 'online' ? 'hub-stat-gold' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold">{server.nameAr || server.name}</h4>
                        <p className="text-sm text-muted-foreground">{server.ipAddress}</p>
                      </div>
                    </div>
                    {getStatusBadge(server.status)}
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">المعالج:</span>
                      <span>{server.cpu || "غير محدد"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MemoryStick className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">الذاكرة:</span>
                      <span>{server.ram || "غير محدد"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <HardDrive className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">التخزين:</span>
                      <span>{server.storage || "غير محدد"}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">استخدام CPU</span>
                      <span className="font-medium">{server.cpuUsage || 45}%</span>
                    </div>
                    <Progress value={server.cpuUsage || 45} className="h-2 mt-1" />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-details-${server.id}`} onClick={() => setSelectedServer(server)}>
                      <Settings className="w-4 h-4 ml-1" />
                      التفاصيل
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-monitor-${server.id}`} onClick={() => setMonitorServer(server)}>
                      <Activity className="w-4 h-4 ml-1" />
                      مراقبة
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setEditing(server);
                        setNewServer({
                          name: server.hostname || server.name || "",
                          nameAr: server.nameAr || server.name || "",
                          type: server.serverType || server.type || "physical",
                          ipAddress: server.ipAddress || "",
                          os: server.operatingSystem || server.os || "",
                          cpu: server.cpu || String(server.cpuCores || ""),
                          ram: server.ram || String(server.ramGb || ""),
                          storage: server.storage || String(server.storageGb || ""),
                          location: server.location || "",
                          description: server.purpose || server.description || ""
                        });
                        setIsAddDialogOpen(true);
                      }}
                      data-testid={`button-edit-server-${server.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        confirmAction(() => deleteServerMutation.mutate(server.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا الخادم؟ لا يمكن التراجع عن هذا الإجراء.' });
                      }}
                      disabled={deleteServerMutation.isPending}
                      data-testid={`button-delete-${server.id}`}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

      <Dialog open={!!selectedServer} onOpenChange={(open) => { if (!open) setSelectedServer(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 hub-stat-gold" />
              تفاصيل الخادم
            </DialogTitle>
          </DialogHeader>
          {selectedServer && (
            <div className="space-y-3 mt-2" data-testid="dialog-server-details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">الاسم</span>
                  <p className="font-medium" data-testid="detail-server-name">{selectedServer.hostname || selectedServer.name || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">النوع</span>
                  <p className="font-medium" data-testid="detail-server-type">{selectedServer.serverType || selectedServer.type || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">نظام التشغيل</span>
                  <p className="font-medium" data-testid="detail-server-os">{selectedServer.operatingSystem || selectedServer.os || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">المعالج</span>
                  <p className="font-medium" data-testid="detail-server-cpu">{selectedServer.cpu || selectedServer.cpuCores || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">الذاكرة</span>
                  <p className="font-medium" data-testid="detail-server-ram">{selectedServer.ram || selectedServer.ramGb || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">التخزين</span>
                  <p className="font-medium" data-testid="detail-server-storage">{selectedServer.storage || selectedServer.storageGb || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">عنوان IP</span>
                  <p className="font-medium" data-testid="detail-server-ip">{selectedServer.ipAddress || "غير محدد"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">الحالة</span>
                  <div data-testid="detail-server-status">{getStatusBadge(selectedServer.status)}</div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">استخدام CPU</span>
                <div className="flex items-center gap-2">
                  <Progress value={selectedServer.cpuUsage || 45} className="h-2 flex-1" />
                  <span className="text-sm font-medium" data-testid="detail-server-cpu-usage">{selectedServer.cpuUsage || 45}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">الوصف</span>
                <p className="text-sm" data-testid="detail-server-description">{selectedServer.purpose || selectedServer.description || "لا يوجد وصف"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!monitorServer} onOpenChange={(open) => { if (!open) setMonitorServer(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 hub-stat-gold" />
              مراقبة الخادم
            </DialogTitle>
          </DialogHeader>
          {monitorServer && (
            <div className="space-y-4 mt-2" data-testid="dialog-server-monitor">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{monitorServer.nameAr || monitorServer.name}</h4>
                <div data-testid="monitor-server-status">{getStatusBadge(monitorServer.status)}</div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1"><Cpu className="w-4 h-4 text-muted-foreground" /> استخدام المعالج</span>
                    <span className="font-medium" data-testid="monitor-cpu-value">{monitorServer.cpuUsage || 45}%</span>
                  </div>
                  <Progress value={monitorServer.cpuUsage || 45} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1"><MemoryStick className="w-4 h-4 text-muted-foreground" /> استخدام الذاكرة</span>
                    <span className="font-medium" data-testid="monitor-memory-value">{monitorServer.memoryUsage || 62}%</span>
                  </div>
                  <Progress value={monitorServer.memoryUsage || 62} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1"><HardDrive className="w-4 h-4 text-muted-foreground" /> استخدام القرص</span>
                    <span className="font-medium" data-testid="monitor-disk-value">{monitorServer.diskUsage || 38}%</span>
                  </div>
                  <Progress value={monitorServer.diskUsage || 38} className="h-2" />
                </div>
              </div>
              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1"><Network className="w-4 h-4 text-muted-foreground" /> الشبكة - الوارد</span>
                  <span className="font-medium" data-testid="monitor-network-in">{monitorServer.networkIn || "125 MB/s"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1"><Network className="w-4 h-4 text-muted-foreground" /> الشبكة - الصادر</span>
                  <span className="font-medium" data-testid="monitor-network-out">{monitorServer.networkOut || "89 MB/s"}</span>
                </div>
              </div>
              <div className="border-t border-border/50 pt-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> آخر تحديث</span>
                  <span data-testid="monitor-last-updated">{monitorServer.lastUpdated || new Date().toLocaleString('ar-SA')}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </DashboardLayout>
  );
}
