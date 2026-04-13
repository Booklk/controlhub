import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { infrastructureNavGroups } from "@/lib/navigation";
import { 
  Network, Plus, Search, RefreshCw, Activity, Wifi, 
  Router, Globe, Shield, CheckCircle,
  ArrowUpDown, Signal, Cable, Settings,
  FileDown, FileSpreadsheet, Pencil, Trash2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToPDF, exportToExcel, formatStatus} from '@/lib/exports';
import { PageHeader, KpiCard } from "@/components/Quality";

export default function InfrastructureNetwork() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newNetwork, setNewNetwork] = useState({
    name: "",
    networkType: "LAN",
    subnet: "",
    vlanId: ""
  });

  const { data: networkDevices = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/infrastructure/networks'],
  });

  const createNetworkMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/infrastructure/networks', {
        name: data.name,
        networkType: data.networkType,
        subnet: data.subnet || "192.168.0.0/24",
        vlanId: parseInt(data.vlanId) || 1,
        status: 'active',
        gatewayIp: "192.168.0.1",
        dnsServers: "8.8.8.8",
        location: 'الموقع الرئيسي'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/networks'] });
      invalidateRelatedQueries('/api/infrastructure/networks');
      setIsAddDialogOpen(false);
      setNewNetwork({ name: "", networkType: "LAN", subnet: "", vlanId: "" });
      toast({ title: "تم إضافة الشبكة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة الشبكة", variant: "destructive" });
    }
  });

  const deleteNetworkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/infrastructure/networks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/networks'] });
      invalidateRelatedQueries('/api/infrastructure/networks');
      toast({ title: "تم حذف الشبكة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف الشبكة", variant: "destructive" });
    }
  });

  const updateNetworkMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `/api/infrastructure/networks/${id}`, {
        name: updateData.name,
        networkType: updateData.networkType,
        subnet: updateData.subnet || "192.168.0.0/24",
        vlanId: parseInt(updateData.vlanId) || 1,
        status: 'active',
        gatewayIp: "192.168.0.1",
        dnsServers: "8.8.8.8",
        location: 'الموقع الرئيسي'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/infrastructure/networks'] });
      invalidateRelatedQueries('/api/infrastructure/networks');
      setIsAddDialogOpen(false);
      setEditing(null);
      setNewNetwork({ name: "", networkType: "LAN", subnet: "", vlanId: "" });
      toast({ title: "تم تحديث الشبكة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث الشبكة", variant: "destructive" });
    }
  });

  const stats = {
    routers: networkDevices.filter((d: any) => d.type === 'router').length,
    switches: networkDevices.filter((d: any) => d.type === 'switch').length,
    firewalls: networkDevices.filter((d: any) => d.type === 'firewall').length,
    accessPoints: networkDevices.filter((d: any) => d.type === 'access_point').length,
  };

  const networkStats = [
    { label: "الموجّهات", value: stats.routers, icon: Router, status: stats.routers > 0 ? "online" : "offline" },
    { label: "المحوّلات", value: stats.switches, icon: ArrowUpDown, status: stats.switches > 0 ? "online" : "offline" },
    { label: "الجدران النارية", value: stats.firewalls, icon: Shield, status: stats.firewalls > 0 ? "online" : "offline" },
    { label: "نقاط الوصول", value: stats.accessPoints, icon: Wifi, status: stats.accessPoints > 0 ? "online" : "offline" },
  ];

  const bandwidthUsage = networkDevices.length > 0 
    ? networkDevices.slice(0, 4).map((d: any) => ({
      name: d.name || 'شبكة غير مسمّاة',
      usage: d.bandwidthUsage || d.usedBandwidth || 0,
      speed: d.speed || d.bandwidth || 'غير محدد',
      status: d.status || 'unknown'
    }))
    : [];


  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير الشبكات',
      subtitle: 'JCSA - Control Hub',
      columns: [{"header":"الجهاز","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (networkDevices || []).map((item: any) => ({ name: item.name || '', type: item.type || item.deviceType || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-network-report',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: 'تقرير الشبكات',
      columns: [{"header":"الجهاز","key":"name","width":35},{"header":"النوع","key":"type","width":25},{"header":"الحالة","key":"status","width":20}],
      data: (networkDevices || []).map((item: any) => ({ name: item.name || '', type: item.type || item.deviceType || '', status: formatStatus(item.status || '') })),
      filename: 'infrastructure-network-report',
    });
  };

  return (
    <DashboardLayout 
      title="إدارة الشبكات" 
      subtitle="مراقبة وإدارة البنية التحتية للشبكات"
      navGroups={infrastructureNavGroups}
      portalName="البنية التحتية"
    >
      <div className="space-y-5">
        <PageHeader
          icon={Network}
          title="إدارة الشبكات"
          subtitle="مراقبة وإدارة أجهزة ومقاطع الشبكة"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث عن جهاز شبكة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-44 bg-background" data-testid="input-search-network" />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} data-testid="button-refresh"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportPDF} data-testid="button-export-pdf"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportExcel} data-testid="button-export-excel"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-network"><Plus className="w-3.5 h-3.5" />إضافة شبكة</Button>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="الموجّهات" value={stats.routers} icon={Router} color={stats.routers > 0 ? "navy" : "muted"} />
          <KpiCard label="المحوّلات" value={stats.switches} icon={ArrowUpDown} color={stats.switches > 0 ? "gold" : "muted"} />
          <KpiCard label="الجدران النارية" value={stats.firewalls} icon={Shield} color={stats.firewalls > 0 ? "success" : "muted"} />
          <KpiCard label="نقاط الوصول" value={stats.accessPoints} icon={Wifi} color={stats.accessPoints > 0 ? "info" : "muted"} />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setEditing(null);
                  setNewNetwork({ name: "", networkType: "LAN", subnet: "", vlanId: "" });
                }
              }}>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>{editing ? "تعديل الشبكة" : "إضافة شبكة جديدة"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>اسم الشبكة</Label>
                      <Input
                        value={newNetwork.name}
                        onChange={(e) => setNewNetwork({ ...newNetwork, name: e.target.value })}
                        placeholder="شبكة المكاتب"
                        data-testid="input-network-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع الشبكة</Label>
                      <Select value={newNetwork.networkType} onValueChange={(v) => setNewNetwork({ ...newNetwork, networkType: v })}>
                        <SelectTrigger data-testid="select-network-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LAN">LAN</SelectItem>
                          <SelectItem value="WAN">WAN</SelectItem>
                          <SelectItem value="VPN">VPN</SelectItem>
                          <SelectItem value="DMZ">DMZ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>نطاق IP (Subnet)</Label>
                      <Input
                        value={newNetwork.subnet}
                        onChange={(e) => setNewNetwork({ ...newNetwork, subnet: e.target.value })}
                        placeholder="192.168.1.0/24"
                        data-testid="input-network-subnet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>VLAN ID</Label>
                      <Input
                        type="number"
                        value={newNetwork.vlanId}
                        onChange={(e) => setNewNetwork({ ...newNetwork, vlanId: e.target.value })}
                        placeholder="100"
                        data-testid="input-network-vlan"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
                      <Button
                        className="btn-gold"
                        onClick={() => {
                          if (editing) {
                            updateNetworkMutation.mutate({ ...newNetwork, id: editing.id });
                          } else {
                            createNetworkMutation.mutate(newNetwork);
                          }
                        }}
                        disabled={editing ? updateNetworkMutation.isPending : createNetworkMutation.isPending}
                        data-testid="button-submit-network"
                      >
                        {editing
                          ? (updateNetworkMutation.isPending ? "جاري التحديث..." : "تحديث الشبكة")
                          : (createNetworkMutation.isPending ? "جاري الإضافة..." : "إضافة الشبكة")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

        {/* Networks List */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 hub-stat-gold" />
              قائمة الشبكات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-60" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : networkDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا توجد شبكات مسجلة</div>
            ) : (
              <div className="space-y-3">
                {networkDevices
                  .filter((network: any) => !searchQuery || network.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((network: any) => (
                  <div key={network.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg" data-testid={`row-network-${network.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10">
                        <Network className="w-5 h-5 hub-stat-gold" />
                      </div>
                      <div>
                        <p className="font-medium">{network.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{network.networkType || network.type || 'LAN'}</Badge>
                          {network.subnet && <span className="text-xs text-muted-foreground">{network.subnet}</span>}
                          {network.vlanId && <span className="text-xs text-muted-foreground">VLAN: {network.vlanId}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={network.status === 'active' ? 'default' : 'secondary'}>
                        {network.status === 'active' ? 'نشط' : network.status || 'غير محدد'}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(network);
                          setNewNetwork({
                            name: network.name || "",
                            networkType: network.networkType || network.type || "LAN",
                            subnet: network.subnet || "",
                            vlanId: network.vlanId?.toString() || ""
                          });
                          setIsAddDialogOpen(true);
                        }}
                        data-testid={`button-edit-network-${network.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteNetworkMutation.mutate(network.id)}
                        disabled={deleteNetworkMutation.isPending}
                        data-testid={`button-delete-network-${network.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bandwidth Usage */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 hub-stat-gold" />
              استخدام النطاق الترددي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bandwidthUsage.map((item, index) => (
                <div key={index} className={`p-4 bg-muted/30 rounded-lg animate-fadeInUp stagger-${index + 1}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 hub-stat-gold" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{item.speed}</Badge>
                      <span className="font-bold">{item.usage}%</span>
                    </div>
                  </div>
                  <Progress value={item.usage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network Topology */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5 hub-stat-gold" />
              طوبولوجيا الشبكة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative p-8 bg-muted/20 rounded-lg min-h-[300px]">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="p-4 bg-[hsl(222_47%_11%)] rounded-xl text-white text-center">
                  <Router className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">Core Router</span>
                </div>
              </div>
              
              {/* Connected devices around core */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <div className="p-3 bg-[hsl(43_74%_49%)]/20 rounded-lg text-center border border-[hsl(43_74%_49%)]/30">
                  <Globe className="w-6 h-6 mx-auto mb-1 hub-stat-gold" />
                  <span className="text-xs">Internet</span>
                </div>
              </div>
              
              <div className="absolute bottom-4 left-1/4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <ArrowUpDown className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">Switch A</span>
                </div>
              </div>
              
              <div className="absolute bottom-4 right-1/4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <ArrowUpDown className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">Switch B</span>
                </div>
              </div>
              
              <div className="absolute top-1/2 left-4 -translate-y-1/2">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <Shield className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">Firewall</span>
                </div>
              </div>
              
              <div className="absolute top-1/2 right-4 -translate-y-1/2">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <Wifi className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">Access Points</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </DashboardLayout>
  );
}
