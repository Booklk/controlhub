import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { exportToPDF, exportToExcel} from '@/lib/exports';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth, getAuthToken } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { dmoNavGroups } from "@/lib/navigation";
import { GlassCard, PremiumStatsCard, PremiumBadge, LoadingSpinner, EmptyState, GradientButton } from "@/components/PremiumComponents";
import { FileAttachment, AttachmentList, type FileAttachmentData } from "@/components/FileAttachment";
import { 
  Inbox, MessageSquare, FileText, Clock, CheckCircle, 
  Paperclip, Send,
  Download, Eye, ChevronLeft, Database, Tags,
  FileDown, FileSpreadsheet
} from "lucide-react";


interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface DmoRequest {
  id: number;
  title: string;
  description: string | null;
  requestType: string;
  priority: string;
  status: string;
  stewardId: number;
  requestedBy: number;
  dueDate: string | null;
  attachments: Attachment[] | null;
  createdAt: string;
  updatedAt: string;
}

interface RequestResponse {
  id: number;
  requestId: number;
  responderId: number;
  message: string;
  attachments: Attachment[] | null;
  isFromDmo: boolean;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-600/20 text-red-500 border-red-600/30 font-semibold",
  low: "hub-badge-navy",
  medium: "hub-badge-gold",
  high: "bg-[hsl(222_47%_11%)]/40 text-muted-foreground border-[hsl(222_47%_11%)]/50",
  critical: "bg-[hsl(222_47%_11%)] text-white border-[hsl(222_47%_11%)]",
};

const statusColors: Record<string, string> = {
  pending: "hub-badge-gold",
  in_progress: "hub-badge-navy",
  completed: "hub-badge-gold-solid",
  rejected: "bg-[hsl(222_47%_11%)]/60 text-white border-[hsl(222_47%_11%)]/70",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد المعالجة",
  completed: "مكتمل",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const priorityLabels: Record<string, string> = {
  urgent: "عاجلة",
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const requestTypeLabels: Record<string, string> = {
  data_update: "تحديث بيانات",
  data_quality: "جودة البيانات",
  access_request: "طلب وصول",
  report: "تقرير",
  classification: "تصنيف بيانات",
  other: "أخرى",
};

export default function DataStewardPortal() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<DmoRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [responseAttachments, setResponseAttachments] = useState<FileAttachmentData[]>([]);
  const [showRequestDetail, setShowRequestDetail] = useState(false);

  const { data: requests = [], isLoading } = useQuery<DmoRequest[]>({
    queryKey: ["/api/dmo-requests/my-requests"],
  });

  const { data: dataAssets = [] } = useQuery<any[]>({
    queryKey: ["/api/data-assets"],
  });

  const uniqueClassifications = Array.from(new Set(dataAssets.map((a: any) => a.classification).filter(Boolean))).length;

  const { data: requestDetail } = useQuery<{ request: DmoRequest; responses: RequestResponse[] }>({
    queryKey: ["/api/dmo-requests", selectedRequest?.id],
    queryFn: async () => {
      const res = await fetch(`/api/dmo-requests/${selectedRequest!.id}`, { headers: { Authorization: `Bearer ${getAuthToken()}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch request details');
      return res.json();
    },
    enabled: !!selectedRequest?.id,
  });

  const sendResponseMutation = useMutation({
    mutationFn: async ({ requestId, message, attachments }: { requestId: number; message: string; attachments?: FileAttachmentData[] }) => {
      const res = await apiRequest("POST", `/api/dmo-requests/${requestId}/responses`, { message, attachments });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إرسال الرد بنجاح" });
      setResponseMessage("");
      setResponseAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/dmo-requests", selectedRequest?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/dmo-requests/${requestId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث الحالة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/dmo-requests/my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dmo-requests", selectedRequest?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ في تحديث الحالة", description: error.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try {
      const token = getAuthToken();
      await fetch("/api/auth/logout", { method: "POST", credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      logout();
      setLocation("/login");
    } catch (error) {
      logout();
      setLocation("/login");
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const inProgressCount = requests.filter(r => r.status === "in_progress").length;
  const completedCount = requests.filter(r => r.status === "completed").length;

  const handleExportPDF = () => {
    const data = requests.map((r: DmoRequest) => ({
      title: r.title,
      requestType: requestTypeLabels[r.requestType] || r.requestType,
      priority: priorityLabels[r.priority] || r.priority,
      status: statusLabels[r.status] || r.status,
      createdAt: new Date(r.createdAt).toLocaleDateString('ar-SA'),
    }));
    const columns = [
      { header: 'العنوان', key: 'title' },
      { header: 'النوع', key: 'requestType' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'الحالة', key: 'status' },
      { header: 'التاريخ', key: 'createdAt' },
    ];
    exportToPDF({ data, columns, title: 'تقرير طلبات أمين البيانات', filename: 'data-steward-report', orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const data = requests.map((r: DmoRequest) => ({
      title: r.title,
      requestType: requestTypeLabels[r.requestType] || r.requestType,
      priority: priorityLabels[r.priority] || r.priority,
      status: statusLabels[r.status] || r.status,
      createdAt: new Date(r.createdAt).toLocaleDateString('ar-SA'),
    }));
    const columns = [
      { header: 'العنوان', key: 'title' },
      { header: 'النوع', key: 'requestType' },
      { header: 'الأولوية', key: 'priority' },
      { header: 'الحالة', key: 'status' },
      { header: 'التاريخ', key: 'createdAt' },
    ];
    exportToExcel({ data, columns, title: 'تقرير طلبات أمين البيانات', filename: 'data-steward-report' });
  };

  return (
    <DashboardLayout
      title="بوابة أمين البيانات"
      subtitle="إدارة تصنيف البيانات والطلبات"
      navGroups={dmoNavGroups}
      portalName="أمين البيانات"
    >
      <div className="space-y-8">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
            <FileDown className="w-4 h-4 ml-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 ml-2" />
            Excel
          </Button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <PremiumStatsCard 
            title="أصول البيانات" 
            value={dataAssets.length}
            icon={<Database className="w-7 h-7" />}
            subtitle="أصل بيانات مُدار"
            delay={0}
          />
          
          <PremiumStatsCard 
            title="التصنيفات" 
            value={uniqueClassifications}
            icon={<Tags className="w-7 h-7" />}
            subtitle="تصنيف نشط"
            delay={100}
          />
          
          <PremiumStatsCard 
            title="طلبات جديدة" 
            value={pendingCount}
            icon={<Inbox className="w-7 h-7" />}
            subtitle="تحتاج إلى معالجة"
            delay={200}
          />
          
          <PremiumStatsCard 
            title="مكتملة" 
            value={completedCount}
            icon={<CheckCircle className="w-7 h-7" />}
            subtitle="هذا الشهر"
            delay={300}
          />
        </div>

        {/* Requests List */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="p-6 border-b border-[hsl(43_74%_49%)]/20">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="hub-icon-gold">
                <MessageSquare className="w-5 h-5 hub-stat-gold" />
              </div>
              الطلبات الواردة
              <PremiumBadge variant="gold" size="sm">{requests.length} طلب</PremiumBadge>
            </h3>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <LoadingSpinner size="lg" />
                <p className="text-white/60 mt-4">جاري تحميل الطلبات...</p>
              </div>
            ) : requests.length === 0 ? (
              <EmptyState 
                icon={<Inbox className="w-10 h-10" />}
                title="لا توجد طلبات حالياً"
                description="ستظهر هنا الطلبات المرسلة من مكتب إدارة البيانات"
              />
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-xl bg-[hsl(222_47%_11%)]/40 border border-[hsl(43_74%_49%)]/10 hover:border-[hsl(43_74%_49%)]/30 transition-all"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRequestDetail(true);
                    }}
                    data-testid={`request-item-${request.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">{request.title}</h3>
                          <Badge className={statusColors[request.status] || statusColors.pending}>
                            {statusLabels[request.status] || request.status}
                          </Badge>
                          <Badge className={priorityColors[request.priority] || priorityColors.medium}>
                            {priorityLabels[request.priority] || request.priority}
                          </Badge>
                        </div>
                        <p className="text-white/60 text-sm line-clamp-2">{request.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {requestTypeLabels[request.requestType] || request.requestType}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(request.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                          {request.attachments && request.attachments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {request.attachments.length} مرفق
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="btn-icon-gold" data-testid={`button-view-request-${request.id}`}>
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Request Detail Dialog */}
        <Dialog open={showRequestDetail} onOpenChange={setShowRequestDetail}>
          <DialogContent className="max-w-3xl bg-[hsl(222_47%_11%)] border-[hsl(43_74%_49%)]/30" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <ChevronLeft className="w-5 h-5 hub-stat-gold" />
                تفاصيل الطلب
              </DialogTitle>
            </DialogHeader>
            
            {requestDetail && (
              <DialogBody className="space-y-6">
                {/* Request Info */}
                <div className="p-4 rounded-xl bg-[hsl(222_47%_15%)]/50 border border-[hsl(43_74%_49%)]/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{requestDetail.request.title}</h3>
                      <p className="text-white/60 mt-1">{requestDetail.request.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={statusColors[requestDetail.request.status]}>
                        {statusLabels[requestDetail.request.status]}
                      </Badge>
                      <Badge className={priorityColors[requestDetail.request.priority]}>
                        {priorityLabels[requestDetail.request.priority]}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 text-sm text-white/60">
                    <span>النوع: {requestTypeLabels[requestDetail.request.requestType]}</span>
                    <span>التاريخ: {new Date(requestDetail.request.createdAt).toLocaleDateString("ar-SA")}</span>
                  </div>

                  {requestDetail.request.attachments && requestDetail.request.attachments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[hsl(43_74%_49%)]/10">
                      <p className="text-sm text-white/60 mb-2">المرفقات:</p>
                      <div className="flex flex-wrap gap-2">
                        {requestDetail.request.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(43_74%_49%)]/10 hub-stat-gold hover:bg-[hsl(43_74%_49%)]/20 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-sm">{att.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Actions */}
                {requestDetail.request.status !== "completed" && (
                  <div className="flex gap-2">
                    {requestDetail.request.status === "pending" && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ requestId: requestDetail.request.id, status: "in_progress" })}
                        className="btn-navy"
                        data-testid="button-start-processing"
                      >
                        بدء المعالجة
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ requestId: requestDetail.request.id, status: "completed" })}
                      className="btn-gold flex items-center justify-center gap-2"
                      data-testid="button-complete"
                    >
                      <CheckCircle className="w-4 h-4" />
                      إكمال الطلب
                    </button>
                  </div>
                )}

                {/* Conversation */}
                <div className="space-y-4">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 hub-stat-gold" />
                    المحادثة
                  </h4>
                  
                  {requestDetail.responses.length === 0 ? (
                    <p className="text-white/40 text-center py-4">لا توجد ردود بعد</p>
                  ) : (
                    <div className="space-y-3">
                      {requestDetail.responses.map((response) => (
                        <div
                          key={response.id}
                          className={`p-4 rounded-xl ${
                            response.isFromDmo
                              ? "bg-[hsl(222_47%_20%)]/50 border-r-4 border-[hsl(222_47%_30%)]"
                              : "bg-[hsl(43_74%_49%)]/10 border-r-4 border-[hsl(43_74%_49%)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-medium ${response.isFromDmo ? "text-white/60" : "hub-stat-gold"}`}>
                              {response.isFromDmo ? "مكتب البيانات" : "أنت"}
                            </span>
                            <span className="text-xs text-white/40">
                              {new Date(response.createdAt).toLocaleString("ar-SA")}
                            </span>
                          </div>
                          <p className="text-white">{response.message}</p>
                          
                          {response.attachments && response.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {response.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-white/80 text-sm hover:bg-white/20"
                                >
                                  <Download className="w-3 h-3" />
                                  {att.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Form */}
                  <div className="pt-4 border-t border-[hsl(43_74%_49%)]/20 space-y-4">
                    <Textarea
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      placeholder="اكتب ردك هنا..."
                      className="bg-[hsl(222_47%_15%)] border-[hsl(43_74%_49%)]/20 text-white placeholder:text-white/40 min-h-[100px]"
                      data-testid="input-response"
                    />
                    
                    <FileAttachment
                      attachments={responseAttachments}
                      onAttachmentsChange={setResponseAttachments}
                      maxFiles={5}
                      maxFileSize={10 * 1024 * 1024}
                      dark
                    />
                    
                    <div className="flex justify-end items-center">
                      <button
                        onClick={() => {
                          if (responseMessage.trim() && selectedRequest) {
                            sendResponseMutation.mutate({
                              requestId: selectedRequest.id,
                              message: responseMessage,
                              attachments: responseAttachments.length > 0 ? responseAttachments : undefined,
                            });
                          }
                        }}
                        disabled={!responseMessage.trim() || sendResponseMutation.isPending}
                        className="btn-gold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-send-response"
                      >
                        <Send className="w-4 h-4" />
                        إرسال الرد
                        {responseAttachments.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-[hsl(222_47%_11%)]/20 text-xs">
                            {responseAttachments.length} مرفق
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </DialogBody>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
