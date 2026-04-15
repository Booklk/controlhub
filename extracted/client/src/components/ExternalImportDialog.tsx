import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingButton } from "@/components/LoadingButton";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Database, Wifi, WifiOff, Download, CheckCircle, AlertTriangle,
  Server, Shield, Settings, RefreshCw, FileText, Inbox, Loader2
} from "lucide-react";

interface ImportResult {
  success: boolean;
  imported: any[];
  skipped: number;
  total: number;
  message?: string;
}

interface ExternalImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: number;
  departmentName: string;
  targetType: "tickets" | "tasks";
  invalidateKey: string;
}

export function ExternalImportDialog({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  targetType,
  invalidateKey,
}: ExternalImportDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("outlook");
  const [outlookConfig, setOutlookConfig] = useState({
    subjectFilter: targetType === "tickets" ? "تذكرة" : "مهمة",
    maxEmails: "50",
  });
  const [oracleConfig, setOracleConfig] = useState({
    host: "",
    port: "1521",
    serviceName: "",
    username: "",
    password: "",
    tableName: "",
    titleColumn: "TITLE",
    descriptionColumn: "DESCRIPTION",
    priorityColumn: "PRIORITY",
    statusColumn: "STATUS",
    maxRows: "100",
    customQuery: "",
    useCustomQuery: false,
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const targetLabel = targetType === "tickets" ? "التذاكر" : "المهام";

  const outlookStatus = useQuery<{ configured: boolean; host: string; user: string }>({
    queryKey: ["/api/import/outlook-status"],
    enabled: open,
  });

  const outlookImportMutation = useMutation({
    mutationFn: async (config: typeof outlookConfig) => {
      const res = await apiRequest("POST", `/api/import/outlook-${targetType}`, {
        ...config,
        departmentId,
        maxEmails: parseInt(config.maxEmails),
      });
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      if (data.imported?.length > 0) {
        toast({ title: `✅ تم استيراد ${data.imported.length} ${targetLabel} من Outlook` });
      }
    },
    onError: (error: Error) => toast({ description: error.message, title: `خطأ في استيراد ${targetLabel} من Outlook`, variant: "destructive" }),
  });

  const oracleTestMutation = useMutation({
    mutationFn: async (config: typeof oracleConfig) => {
      const res = await apiRequest("POST", "/api/import/oracle-test", {
        host: config.host,
        port: parseInt(config.port),
        serviceName: config.serviceName,
        username: config.username,
        password: config.password,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "✅ تم الاتصال بـ Oracle بنجاح", description: data.serverVersion });
      } else {
        toast({ title: "فشل الاتصال", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => toast({ description: error.message, title: "خطأ في اختبار الاتصال", variant: "destructive" }),
  });

  const oracleImportMutation = useMutation({
    mutationFn: async (config: typeof oracleConfig) => {
      const res = await apiRequest("POST", `/api/import/oracle-${targetType}`, {
        host: config.host,
        port: parseInt(config.port),
        serviceName: config.serviceName,
        username: config.username,
        password: config.password,
        tableName: config.tableName,
        titleColumn: config.titleColumn,
        descriptionColumn: config.descriptionColumn,
        priorityColumn: config.priorityColumn,
        statusColumn: config.statusColumn,
        maxRows: parseInt(config.maxRows),
        customQuery: config.useCustomQuery ? config.customQuery : undefined,
        departmentId,
      });
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      if (data.imported?.length > 0) {
        toast({ title: `✅ تم استيراد ${data.imported.length} ${targetLabel} من Oracle` });
      }
    },
    onError: (error: Error) => toast({ description: error.message, title: `خطأ في استيراد ${targetLabel} من Oracle`, variant: "destructive" }),
  });

  const resetState = () => {
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white/98 backdrop-blur-xl border-navy/10" data-testid="dialog-external-import">

        {importResult ? (
          <div className="py-6 text-center space-y-4">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${importResult.imported?.length > 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {importResult.imported?.length > 0
                ? <CheckCircle className="w-7 h-7 text-emerald-600" />
                : <AlertTriangle className="w-7 h-7 text-amber-600" />
              }
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy">
                {importResult.imported?.length > 0 ? "تم الاستيراد بنجاح" : "لا توجد عناصر جديدة للاستيراد"}
              </h3>
              <p className="text-sm text-navy/60 mt-1">
                {importResult.imported?.length > 0
                  ? `تم استيراد ${importResult.imported.length} ${targetLabel} جديدة${importResult.skipped > 0 ? ` — تم تخطي ${importResult.skipped} مكررة` : ''}`
                  : importResult.message || `لم يتم العثور على ${targetLabel} جديدة`
                }
              </p>
            </div>

            {importResult.imported?.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-right max-h-40 overflow-y-auto">
                {importResult.imported.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                    <Badge variant="outline" className="text-xs">{item.ticketNumber || item.id}</Badge>
                    <span className="text-navy/80 truncate mr-2 flex-1">{item.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} data-testid="button-close-import">
                إغلاق
              </Button>
              <Button className="bg-navy text-white hover:bg-navy/90" onClick={resetState} data-testid="button-import-more">
                <RefreshCw className="w-4 h-4 ml-2" /> استيراد المزيد
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-navy text-xl flex items-center gap-2">
                <Download className="w-5 h-5 text-gold" /> استيراد {targetLabel} — {departmentName}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-navy/5">
                <TabsTrigger value="outlook" className="flex items-center gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-outlook">
                  <Mail className="w-4 h-4" /> Outlook
                </TabsTrigger>
                <TabsTrigger value="oracle" className="flex items-center gap-1.5 data-[state=active]:bg-orange-600 data-[state=active]:text-white" data-testid="tab-oracle">
                  <Database className="w-4 h-4" /> Oracle
                </TabsTrigger>
              </TabsList>

              <TabsContent value="outlook" className="space-y-4 mt-4">
                {outlookStatus.isLoading && (
                  <div className="p-3 rounded-lg border bg-slate-50 border-slate-200 text-sm flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                    <p className="text-slate-600">جاري فحص اتصال Outlook...</p>
                  </div>
                )}
                {outlookStatus.isError && (
                  <div className="p-3 rounded-lg border bg-red-50 border-red-200 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">تعذر فحص حالة Outlook — تحقق من إعدادات الخادم</p>
                  </div>
                )}
                {outlookStatus.data && (
                <div className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${outlookStatus.data?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  {outlookStatus.data?.configured
                    ? <Wifi className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    : <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`font-medium ${outlookStatus.data?.configured ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {outlookStatus.data?.configured ? 'الاتصال بـ Outlook مُهيَّأ' : 'يتطلب تكوين بيانات الاعتماد'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {outlookStatus.data?.configured
                        ? `الخادم: ${outlookStatus.data.host} | المستخدم: ${outlookStatus.data.user}`
                        : 'يرجى ضبط SMTP_USER و SMTP_PASS في متغيرات البيئة'}
                    </p>
                  </div>
                </div>
                )}

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800 space-y-1">
                  <p className="font-medium">كيف يعمل الاستيراد من Outlook؟</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                    <li>يتصل النظام بصندوق بريد Outlook عبر IMAP</li>
                    <li>يقرأ الرسائل غير المقروءة خلال آخر 7 أيام</li>
                    <li>يُنشئ {targetType === "tickets" ? "تذكرة" : "مهمة"} لكل رسالة تحتوي على كلمة الفلتر</li>
                    <li>يتجاهل الرسائل المستوردة مسبقاً تلقائياً</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-navy/80 text-sm font-medium">فلتر الموضوع (Subject)</Label>
                  <Input
                    value={outlookConfig.subjectFilter}
                    onChange={(e) => setOutlookConfig({ ...outlookConfig, subjectFilter: e.target.value })}
                    placeholder={targetType === "tickets" ? "مثال: تذكرة، ticket، دعم" : "مثال: مهمة، task، تكليف"}
                    className="border-navy/20 focus:border-gold"
                    data-testid="input-outlook-subject-filter"
                  />
                  <p className="text-xs text-navy/40">استورد فقط الإيميلات التي يحتوي موضوعها على هذا النص</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-navy/80 text-sm font-medium">الحد الأقصى للرسائل</Label>
                  <Select value={outlookConfig.maxEmails} onValueChange={(v) => setOutlookConfig({ ...outlookConfig, maxEmails: v })}>
                    <SelectTrigger className="border-navy/20" data-testid="select-max-emails">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 رسالة</SelectItem>
                      <SelectItem value="50">50 رسالة</SelectItem>
                      <SelectItem value="100">100 رسالة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
                  <LoadingButton
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => outlookImportMutation.mutate(outlookConfig)}
                    disabled={!outlookStatus.data?.configured}
                    loading={outlookImportMutation.isPending}
                    loadingText="جاري الاستيراد..."
                    data-testid="button-start-outlook-import"
                  >
                    <Download className="w-4 h-4 ml-2" /> بدء الاستيراد من Outlook
                  </LoadingButton>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="oracle" className="space-y-4 mt-4">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-xs text-orange-800 space-y-1">
                  <p className="font-medium flex items-center gap-1"><Database className="w-3.5 h-3.5" /> الاستيراد من Oracle Database</p>
                  <ul className="list-disc list-inside space-y-0.5 text-orange-700">
                    <li>اتصل بقاعدة بيانات Oracle الخارجية واستورد البيانات كـ{targetLabel}</li>
                    <li>حدد جدول المصدر وأعمدة البيانات أو استخدم استعلام مخصص</li>
                    <li>يتم تعيين كل صف كـ{targetType === "tickets" ? "تذكرة" : "مهمة"} جديدة في النظام</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-navy/80 text-sm font-medium">عنوان الخادم</Label>
                    <Input
                      value={oracleConfig.host}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, host: e.target.value })}
                      placeholder="192.168.1.100"
                      className="border-navy/20 text-left dir-ltr"
                      dir="ltr"
                      data-testid="input-oracle-host"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-navy/80 text-sm font-medium">المنفذ</Label>
                    <Input
                      value={oracleConfig.port}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, port: e.target.value })}
                      placeholder="1521"
                      className="border-navy/20 text-left"
                      dir="ltr"
                      data-testid="input-oracle-port"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-navy/80 text-sm font-medium">اسم الخدمة (Service Name / SID)</Label>
                  <Input
                    value={oracleConfig.serviceName}
                    onChange={(e) => setOracleConfig({ ...oracleConfig, serviceName: e.target.value })}
                    placeholder="ORCL"
                    className="border-navy/20 text-left"
                    dir="ltr"
                    data-testid="input-oracle-service"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-navy/80 text-sm font-medium">اسم المستخدم</Label>
                    <Input
                      value={oracleConfig.username}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, username: e.target.value })}
                      className="border-navy/20 text-left"
                      dir="ltr"
                      data-testid="input-oracle-user"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-navy/80 text-sm font-medium">كلمة المرور</Label>
                    <Input
                      type="password"
                      value={oracleConfig.password}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, password: e.target.value })}
                      className="border-navy/20 text-left"
                      dir="ltr"
                      data-testid="input-oracle-pass"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <LoadingButton
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      if (!oracleConfig.host || isNaN(parseInt(oracleConfig.port))) {
                        toast({ title: "خطأ", description: "عنوان الخادم والمنفذ مطلوبان", variant: "destructive" });
                        return;
                      }
                      oracleTestMutation.mutate(oracleConfig);
                    }}
                    loading={oracleTestMutation.isPending}
                    loadingText="جاري الاختبار..."
                    disabled={!oracleConfig.host || !oracleConfig.username}
                    data-testid="button-test-oracle"
                  >
                    <Shield className="w-4 h-4 ml-1" /> اختبار الاتصال
                  </LoadingButton>
                </div>

                <div className="border-t border-navy/10 pt-3 space-y-3">
                  <p className="text-sm font-medium text-navy/80">تعيين مصدر البيانات</p>

                  <div className="space-y-1.5">
                    <Label className="text-navy/80 text-sm font-medium">اسم الجدول</Label>
                    <Input
                      value={oracleConfig.tableName}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, tableName: e.target.value })}
                      placeholder={targetType === "tickets" ? "HELPDESK_TICKETS" : "TASK_ASSIGNMENTS"}
                      className="border-navy/20 text-left"
                      dir="ltr"
                      data-testid="input-oracle-table"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-navy/80 text-xs">عمود العنوان</Label>
                      <Input
                        value={oracleConfig.titleColumn}
                        onChange={(e) => setOracleConfig({ ...oracleConfig, titleColumn: e.target.value })}
                        placeholder="TITLE"
                        className="border-navy/20 text-left text-sm"
                        dir="ltr"
                        data-testid="input-col-title"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-navy/80 text-xs">عمود الوصف</Label>
                      <Input
                        value={oracleConfig.descriptionColumn}
                        onChange={(e) => setOracleConfig({ ...oracleConfig, descriptionColumn: e.target.value })}
                        placeholder="DESCRIPTION"
                        className="border-navy/20 text-left text-sm"
                        dir="ltr"
                        data-testid="input-col-desc"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-navy/80 text-xs">عمود الأولوية</Label>
                      <Input
                        value={oracleConfig.priorityColumn}
                        onChange={(e) => setOracleConfig({ ...oracleConfig, priorityColumn: e.target.value })}
                        placeholder="PRIORITY"
                        className="border-navy/20 text-left text-sm"
                        dir="ltr"
                        data-testid="input-col-priority"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-navy/80 text-xs">الحد الأقصى للصفوف</Label>
                      <Select value={oracleConfig.maxRows} onValueChange={(v) => setOracleConfig({ ...oracleConfig, maxRows: v })}>
                        <SelectTrigger className="border-navy/20" data-testid="select-oracle-max-rows">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50 صف</SelectItem>
                          <SelectItem value="100">100 صف</SelectItem>
                          <SelectItem value="200">200 صف</SelectItem>
                          <SelectItem value="500">500 صف</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={oracleConfig.useCustomQuery}
                      onChange={(e) => setOracleConfig({ ...oracleConfig, useCustomQuery: e.target.checked })}
                      className="rounded border-navy/30"
                      data-testid="checkbox-custom-query"
                    />
                    <Label className="text-navy/70 text-xs cursor-pointer">استخدام استعلام SQL مخصص بدلاً من الجدول</Label>
                  </div>

                  {oracleConfig.useCustomQuery && (
                    <div className="space-y-1.5">
                      <Label className="text-navy/80 text-sm font-medium">استعلام SQL مخصص</Label>
                      <Textarea
                        value={oracleConfig.customQuery}
                        onChange={(e) => setOracleConfig({ ...oracleConfig, customQuery: e.target.value })}
                        placeholder={`SELECT title, description, priority FROM ${oracleConfig.tableName || 'TABLE_NAME'} WHERE status = 'OPEN'`}
                        className="border-navy/20 text-left font-mono text-xs min-h-[80px]"
                        dir="ltr"
                        data-testid="input-custom-query"
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
                  <LoadingButton
                    className="bg-orange-600 text-white hover:bg-orange-700"
                    onClick={() => oracleImportMutation.mutate(oracleConfig)}
                    disabled={!oracleConfig.host || !oracleConfig.username || (!oracleConfig.tableName && !oracleConfig.customQuery)}
                    loading={oracleImportMutation.isPending}
                    loadingText="جاري الاستيراد..."
                    data-testid="button-start-oracle-import"
                  >
                    <Download className="w-4 h-4 ml-2" /> بدء الاستيراد من Oracle
                  </LoadingButton>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
