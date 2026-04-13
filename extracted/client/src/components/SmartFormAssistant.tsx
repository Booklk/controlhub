import { useState, useRef, useEffect } from "react";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, FileSpreadsheet, Mail, Upload, X, Check, 
  Wand2, Loader2, FileText, ChevronDown, AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

export interface ParsedFormData {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  dueDate?: string;
  assignee?: string;
  department?: string;
  status?: string;
  notes?: string;
  confidence?: number;
}

interface SmartFormAssistantProps {
  formType: 'task' | 'ticket' | 'project';
  onDataParsed: (data: ParsedFormData) => void;
  isVisible?: boolean;
}

export function SmartFormAssistant({ 
  formType, 
  onDataParsed,
  isVisible = true
}: SmartFormAssistantProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedFormData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const formLabels = {
    task: 'المهمة',
    ticket: 'التذكرة',
    project: 'المشروع'
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('formType', formType);

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 85));
      }, 200);

      const headers: Record<string, string> = {};
      const authToken = getAuthToken();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      try {
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
        const csrfData = await csrfRes.json();
        if (csrfData.csrfToken) headers['x-csrf-token'] = csrfData.csrfToken;
      } catch (e) { console.warn('Failed to fetch CSRF token for file upload', e); }
      const response = await fetch('/api/parse-file', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error('فشل في قراءة الملف');
      }

      const data = await response.json();
      setParsedData(data);

      toast({
        title: "تم قراءة الملف بنجاح",
        description: `نسبة الثقة: ${Math.round((data.confidence || 0.7) * 100)}%`,
      });

    } catch (error) {
      toast({
        title: "خطأ في قراءة الملف",
        description: "يرجى التأكد من صيغة الملف والمحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyData = () => {
    if (parsedData) {
      onDataParsed(parsedData);
      setParsedData(null);
      setIsExpanded(false);
      toast({
        title: "تم تعبئة النموذج",
        description: "يمكنك مراجعة البيانات وتعديلها قبل الحفظ",
      });
    }
  };

  const handleEmailImport = () => {
    emailInputRef.current?.click();
  };

  const handleEmailFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('formType', formType);

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 85));
      }, 200);

      const headers: Record<string, string> = {};
      const authToken2 = getAuthToken();
      if (authToken2) headers['Authorization'] = `Bearer ${authToken2}`;
      try {
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
        const csrfData = await csrfRes.json();
        if (csrfData.csrfToken) headers['x-csrf-token'] = csrfData.csrfToken;
      } catch (e) { console.warn('Failed to fetch CSRF token for email import', e); }

      const response = await fetch('/api/parse-file', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error('فشل في قراءة ملف البريد');
      }

      const data = await response.json();
      setParsedData(data);

      toast({
        title: "تم قراءة ملف البريد بنجاح",
        description: `نسبة الثقة: ${Math.round((data.confidence || 0.7) * 100)}%`,
      });

    } catch (error) {
      toast({
        title: "خطأ في قراءة ملف البريد",
        description: "يرجى التأكد من صيغة الملف (.eml أو .msg) والمحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      if (emailInputRef.current) {
        emailInputRef.current.value = '';
      }
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="border-[hsl(43_74%_49%)]/40 bg-gradient-to-r from-[hsl(43_74%_49%)]/5 via-white to-[hsl(43_74%_49%)]/5 shadow-lg mb-4 overflow-hidden ring-1 ring-[hsl(43_74%_49%)]/20">
      <CardContent className="p-0">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gold/5 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] flex items-center justify-center shadow-lg ring-2 ring-[hsl(43_74%_49%)]/30">
              <Wand2 className="h-5 w-5 text-[hsl(222_47%_11%)]" />
            </div>
            <div>
              <p className="font-semibold text-[hsl(222_47%_11%)] flex items-center gap-2">
                <Sparkles className="h-4 w-4 hub-stat-gold" />
                هل تريدني أن أملأ {formLabels[formType]} لك؟
              </p>
              <p className="text-sm text-[hsl(222_47%_11%)]/60">من ملف Excel أو بريدك الإلكتروني - أنا حاضر!</p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-navy/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-smart-file"
            />
            <input
              ref={emailInputRef}
              type="file"
              accept=".eml,.msg"
              className="hidden"
              onChange={handleEmailFileSelect}
              data-testid="input-email-file"
            />

            {isProcessing ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 text-gold animate-spin" />
                  <span className="text-navy font-medium">جاري قراءة الملف وتحليله...</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ) : parsedData ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-emerald-700 mb-2">تم استخراج البيانات التالية:</p>
                      <div className="space-y-1 text-sm">
                        {parsedData.title && (
                          <p><span className="text-emerald-700">العنوان:</span> {parsedData.title}</p>
                        )}
                        {parsedData.description && (
                          <p><span className="text-emerald-700">الوصف:</span> {parsedData.description.substring(0, 100)}...</p>
                        )}
                        {parsedData.priority && (
                          <p><span className="text-emerald-700">الأولوية:</span> {parsedData.priority}</p>
                        )}
                        {parsedData.category && (
                          <p><span className="text-emerald-700">التصنيف:</span> {parsedData.category}</p>
                        )}
                        {parsedData.dueDate && (
                          <p><span className="text-emerald-700">التاريخ:</span> {parsedData.dueDate}</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                          نسبة الثقة: {Math.round((parsedData.confidence || 0.7) * 100)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleApplyData}
                    className="flex-1 bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(43_74%_40%)] text-[hsl(222_47%_11%)] font-semibold shadow-lg"
                    data-testid="button-apply-parsed-data"
                  >
                    <Check className="h-4 w-4 ml-2" />
                    تطبيق على النموذج
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setParsedData(null)}
                    className="border-navy/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-w-[140px] border-green-200 gap-2 hover-elevate"
                  data-testid="button-import-excel"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>من ملف Excel</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleEmailImport}
                  className="flex-1 min-w-[140px] border-blue-200 gap-2 hover-elevate"
                  data-testid="button-import-email"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>من البريد</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-w-[140px] border-purple-200 gap-2 hover-elevate"
                  data-testid="button-import-text"
                >
                  <FileText className="h-4 w-4 text-purple-600" />
                  <span>من ملف نصي</span>
                </Button>
              </div>
            )}

            <p className="text-xs text-navy/50 text-center">
              سأقرأ الملف وأستخرج البيانات تلقائياً - يمكنك مراجعتها قبل التطبيق
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
