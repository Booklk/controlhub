import { useState } from "react";
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import type { NavGroup } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  Edit2,
  Trash2,
  FolderOpen,
  RefreshCw,
  Upload,
  Archive,
  Lock,
  Unlock,
  Tag,
  Calendar,
  FileCheck,
  FilePlus,
  FileCode,
  FileSpreadsheet,
  File,
  AlertCircle,
} from "lucide-react";

interface DocumentManagementProps {
  departmentId: number;
  departmentName: string;
  navGroups: NavGroup[];
  portalName: string;
}

interface Document {
  id: number;
  departmentId: number;
  title: string;
  description: string | null;
  category: string;
  dataClassification: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  version: string;
  status: string;
  isConfidential: boolean;
  tags: string[] | null;
  createdBy: number | null;
  reviewDate: string | null;
  expiryDate: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

const categoryLabels: Record<string, string> = {
  policy: 'سياسة',
  procedure: 'إجراء',
  template: 'قالب',
  manual: 'دليل',
  contract: 'عقد',
  report: 'تقرير',
  other: 'أخرى',
};

const categoryIcons: Record<string, React.ReactNode> = {
  policy: <FileCheck className="w-4 h-4" />,
  procedure: <FileText className="w-4 h-4" />,
  template: <FileCode className="w-4 h-4" />,
  manual: <FolderOpen className="w-4 h-4" />,
  contract: <FileSpreadsheet className="w-4 h-4" />,
  report: <FileSpreadsheet className="w-4 h-4" />,
  other: <File className="w-4 h-4" />,
};

const statusLabels: Record<string, string> = {
  active: 'نشط',
  archived: 'مؤرشف',
  draft: 'مسودة',
};

const dataClassificationLabels: Record<string, string> = {
  public: 'عام',
  restricted: 'مقيد',
  confidential: 'سري',
  top_secret: 'سري للغاية',
};

const dataClassificationColors: Record<string, string> = {
  public: 'hub-badge-gold',
  internal: 'hub-badge-navy',
  confidential: 'hub-badge-gold',
  restricted: 'hub-card hub-stat-gold',
};

export default function DocumentManagement({ departmentId, departmentName, navGroups, portalName }: DocumentManagementProps) {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [newDocument, setNewDocument] = useState({
    title: '',
    description: '',
    category: 'policy',
    dataClassification: 'internal',
    fileName: '',
    version: '1.0',
    isConfidential: false,
    tags: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: [`/api/documents?departmentId=${departmentId}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Document>) => {
      const res = await apiRequest('POST', '/api/documents', {
        ...data,
        departmentId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
      setShowCreateDialog(false);
      setNewDocument({
        title: '',
        description: '',
        category: 'policy',
        dataClassification: 'internal',
        fileName: '',
        version: '1.0',
        isConfidential: false,
        tags: '',
      });
      toast({
        title: "تم الحفظ",
        description: "تم إضافة المستند بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في إضافة المستند",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
      toast({
        title: "تم الحذف",
        description: "تم حذف المستند بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في حذف المستند",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/documents/${id}`, { status: 'archived' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
      toast({
        title: "تم الأرشفة",
        description: "تم أرشفة المستند بنجاح",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Document> }) => {
      const res = await apiRequest('PUT', `/api/documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
      setShowCreateDialog(false);
      setEditingDoc(null);
      setNewDocument({
        title: '',
        description: '',
        category: 'policy',
        dataClassification: 'internal',
        fileName: '',
        version: '1.0',
        isConfidential: false,
        tags: '',
      });
      toast({
        title: "تم التحديث",
        description: "تم تعديل المستند بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في تعديل المستند",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setNewDocument({
      title: doc.title,
      description: doc.description || '',
      category: doc.category,
      dataClassification: doc.dataClassification,
      fileName: doc.fileName,
      version: doc.version,
      isConfidential: doc.isConfidential,
      tags: doc.tags ? doc.tags.join(', ') : '',
    });
    setSelectedFile(null);
    setShowViewDialog(false);
    setShowCreateDialog(true);
  };

  const handleDownload = async (doc: Document, preview = false) => {
    try {
      const res = await apiRequest('GET', `/api/documents/${doc.id}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'فشل في تحميل الملف');
      }
      const contentType = res.headers.get('Content-Type') || doc.fileType || 'application/octet-stream';
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: contentType });
      const url = URL.createObjectURL(blob);
      if (preview) {
        window.open(url, '_blank');
      } else {
        const link = window.document.createElement('a');
        link.href = url;
        link.setAttribute('download', doc.fileName || 'document');
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || (preview ? "الملف غير متوفر للعرض" : "الملف غير متوفر للتحميل"),
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNewDocument(prev => ({
        ...prev,
        fileName: file.name,
      }));
    }
  };

  const uploadDocumentFile = async (docId: number, file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' });
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken || '';
      const res = await fetch(`/api/documents/${docId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('_cht')}`,
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'خطأ في رفع الملف');
      }
      const result = await res.json();
      return result.fileUrl;
    } catch (error: any) {
      toast({ title: error.message || 'خطأ في رفع الملف', variant: 'destructive' });
      return null;
    }
  };

  const handleCreate = async () => {
    if (!newDocument.title.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال عنوان المستند",
        variant: "destructive",
      });
      return;
    }

    if (!editingDoc && !selectedFile && !newDocument.fileName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى رفع ملف أو إدخال اسم الملف",
        variant: "destructive",
      });
      return;
    }

    const tagsArray = newDocument.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (editingDoc) {
      const updateData: Partial<Document> = {
        title: newDocument.title,
        description: newDocument.description || null,
        category: newDocument.category,
        dataClassification: newDocument.dataClassification,
        version: newDocument.version,
        isConfidential: newDocument.isConfidential,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };

      setUploadingFile(true);
      try {
        updateMutation.mutate({ id: editingDoc.id, data: updateData });

        if (selectedFile) {
          await uploadDocumentFile(editingDoc.id, selectedFile);
          queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
        }
      } finally {
        setUploadingFile(false);
      }
      return;
    }

    setUploadingFile(true);
    try {
      const res = await apiRequest('POST', '/api/documents', {
        title: newDocument.title,
        description: newDocument.description || null,
        category: newDocument.category,
        dataClassification: newDocument.dataClassification,
        fileName: newDocument.fileName || (selectedFile ? selectedFile.name : 'document'),
        fileType: selectedFile ? selectedFile.type : null,
        fileSize: selectedFile ? selectedFile.size : null,
        version: newDocument.version,
        isConfidential: newDocument.isConfidential,
        tags: tagsArray.length > 0 ? tagsArray : null,
        departmentId,
      });
      const doc = await res.json();

      if (selectedFile && doc.id) {
        await uploadDocumentFile(doc.id, selectedFile);
      }

      queryClient.invalidateQueries({ queryKey: [`/api/documents?departmentId=${departmentId}`] });
      setShowCreateDialog(false);
      setSelectedFile(null);
      setEditingDoc(null);
      setNewDocument({
        title: '', description: '', category: 'policy', dataClassification: 'internal',
        fileName: '', version: '1.0', isConfidential: false, tags: '',
      });
      toast({ title: "تم الحفظ", description: "تم إضافة المستند بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل في إضافة المستند", variant: "destructive" });
    }
    setUploadingFile(false);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    
    const matchesTab = activeTab === "all" ||
      (activeTab === "active" && doc.status === "active") ||
      (activeTab === "archived" && doc.status === "archived") ||
      (activeTab === "confidential" && doc.isConfidential);
    
    return matchesSearch && matchesCategory && matchesTab;
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'غير محدد';
    if (bytes < 1024) return `${bytes} بايت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="w-8 h-8 hub-stat-gold" />;
    if (fileType.includes('pdf')) return <FileText className="w-8 h-8 hub-stat-gold" />;
    if (fileType.includes('word') || fileType.includes('doc')) return <FileText className="w-8 h-8 hub-stat-gold" />;
    if (fileType.includes('excel') || fileType.includes('sheet')) return <FileSpreadsheet className="w-8 h-8 hub-stat-gold" />;
    return <File className="w-8 h-8 hub-stat-gold" />;
  };

  const stats = {
    total: documents.length,
    active: documents.filter(d => d.status === 'active').length,
    archived: documents.filter(d => d.status === 'archived').length,
    confidential: documents.filter(d => d.isConfidential).length,
  };

  return (
    <DashboardLayout
      title={`إدارة المستندات - ${departmentName}`}
      navGroups={navGroups}
      portalName={portalName}
    >
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة المستندات</h1>
            <p className="text-foreground/70">رفع وتنظيم ومشاركة المستندات والملفات</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-foreground/20"
              data-testid="button-refresh-documents"
            >
              <RefreshCw className={`w-4 h-4 ml-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="hub-btn-gold"
              data-testid="button-create-document"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة مستند
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hub-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gold/70 text-sm">إجمالي المستندات</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <FolderOpen className="w-10 h-10 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gold/70 text-sm">مستندات نشطة</p>
                  <p className="text-2xl font-bold hub-stat-gold">{stats.active}</p>
                </div>
                <FileCheck className="w-10 h-10 hub-stat-gold" />
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gold/70 text-sm">مستندات مؤرشفة</p>
                  <p className="text-2xl font-bold text-white">{stats.archived}</p>
                </div>
                <Archive className="w-10 h-10 hub-stat-gold/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gold/70 text-sm">مستندات سرية</p>
                  <p className="text-2xl font-bold text-white">{stats.confidential}</p>
                </div>
                <Lock className="w-10 h-10 hub-stat-gold/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-foreground/20">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/30">
                  <TabsTrigger value="all" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
                    الكل ({stats.total})
                  </TabsTrigger>
                  <TabsTrigger value="active" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
                    نشط ({stats.active})
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
                    مؤرشف ({stats.archived})
                  </TabsTrigger>
                  <TabsTrigger value="confidential" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
                    سري ({stats.confidential})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في المستندات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 w-64 border-foreground/20"
                    data-testid="input-search-documents"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40 border-foreground/20" data-testid="select-category-filter">
                    <SelectValue placeholder="التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع التصنيفات</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground">لا توجد مستندات</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة مستند جديد</p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="hub-btn-gold"
                  data-testid="button-add-document-empty"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة مستند
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map(doc => (
                  <Card
                    key={doc.id}
                    className="border-foreground/10 hover:border-gold/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedDocument(doc);
                      setShowViewDialog(true);
                    }}
                    data-testid={`document-card-${doc.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          {getFileIcon(doc.fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground flex items-center gap-2">
                                {doc.title}
                                {doc.isConfidential && (
                                  <Lock className="w-4 h-4 hub-stat-gold" />
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {doc.description || doc.fileName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${doc.status === 'active' ? 'hub-badge-gold' : 'hub-badge-navy/60'}`}>
                                {statusLabels[doc.status]}
                              </Badge>
                              <Badge variant="outline" className="border-foreground/20">
                                {categoryIcons[doc.category]}
                                <span className="mr-1">{categoryLabels[doc.category]}</span>
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {doc.fileName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              {doc.downloadCount} تحميل
                            </span>
                            <span>الإصدار: {doc.version}</span>
                            <span>{new Date(doc.createdAt).toLocaleDateString('ar-SA')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 cursor-pointer" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="عرض التفاصيل"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowViewDialog(true);
                            }}
                            data-testid={`button-view-document-${doc.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="تحميل الملف"
                            onClick={() => handleDownload(doc)}
                            data-testid={`button-download-document-${doc.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="تعديل"
                            onClick={() => handleEdit(doc)}
                            data-testid={`button-edit-document-${doc.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="أرشفة"
                            onClick={() => archiveMutation.mutate(doc.id)}
                            data-testid={`button-archive-document-${doc.id}`}
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmAction(() => deleteMutation.mutate(doc.id), { title: 'تأكيد الحذف', description: 'هل أنت متأكد من حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.' })}
                            data-testid={`button-delete-document-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingDoc(null);
            setSelectedFile(null);
            setNewDocument({
              title: '', description: '', category: 'policy', dataClassification: 'internal',
              fileName: '', version: '1.0', isConfidential: false, tags: '',
            });
          }
        }}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingDoc ? 'تعديل المستند' : 'إضافة مستند جديد'}</DialogTitle>
              <DialogDescription>{editingDoc ? 'عدّل تفاصيل المستند' : 'أدخل تفاصيل المستند الجديد'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-right block">العنوان *</Label>
                <Input
                  id="title"
                  value={newDocument.title}
                  onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                  placeholder="عنوان المستند"
                  className="border-foreground/20 text-right"
                  data-testid="input-document-title"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-right block">الوصف</Label>
                <Textarea
                  id="description"
                  value={newDocument.description}
                  onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                  placeholder="وصف المستند..."
                  className="border-foreground/20 text-right"
                  rows={3}
                  data-testid="input-document-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category" className="text-right block">نوع المستند</Label>
                  <Select
                    value={newDocument.category}
                    onValueChange={(value) => setNewDocument({ ...newDocument, category: value })}
                  >
                    <SelectTrigger className="border-foreground/20" data-testid="select-document-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dataClassification" className="text-right block">تصنيف البيانات</Label>
                  <Select
                    value={newDocument.dataClassification}
                    onValueChange={(value) => setNewDocument({ ...newDocument, dataClassification: value })}
                  >
                    <SelectTrigger className="border-foreground/20" data-testid="select-data-classification">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(dataClassificationLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-right block mb-2">رفع الملف</Label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-foreground/20 rounded-lg cursor-pointer hover:border-[hsl(var(--gold))] transition-colors bg-muted/20">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv"
                    onChange={handleFileSelect}
                    data-testid="input-document-file"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-3 text-center">
                      <FileCheck className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} كيلوبايت</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">اضغط لاختيار ملف أو اسحبه هنا</p>
                      <p className="text-xs text-muted-foreground/60">PDF, Word, Excel, PowerPoint, صور</p>
                    </div>
                  )}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fileName" className="text-right block">اسم الملف</Label>
                  <Input
                    id="fileName"
                    value={newDocument.fileName}
                    onChange={(e) => setNewDocument({ ...newDocument, fileName: e.target.value })}
                    placeholder="يتم تعبئته تلقائياً عند رفع الملف"
                    className="border-foreground/20 text-right"
                    data-testid="input-document-filename"
                  />
                </div>
                <div>
                  <Label htmlFor="version" className="text-right block">الإصدار</Label>
                  <Input
                    id="version"
                    value={newDocument.version}
                    onChange={(e) => setNewDocument({ ...newDocument, version: e.target.value })}
                    placeholder="1.0"
                    className="border-foreground/20 text-right"
                    data-testid="input-document-version"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tags" className="text-right block">الوسوم (مفصولة بفواصل)</Label>
                <Input
                  id="tags"
                  value={newDocument.tags}
                  onChange={(e) => setNewDocument({ ...newDocument, tags: e.target.value })}
                  placeholder="سياسة، أمن، خصوصية"
                  className="border-foreground/20 text-right"
                  data-testid="input-document-tags"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isConfidential"
                  checked={newDocument.isConfidential}
                  onChange={(e) => setNewDocument({ ...newDocument, isConfidential: e.target.checked })}
                  className="w-4 h-4"
                  data-testid="checkbox-document-confidential"
                />
                <Label htmlFor="isConfidential" className="flex items-center gap-1">
                  <Lock className="w-4 h-4" />
                  مستند سري
                </Label>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingDoc(null);
                  setSelectedFile(null);
                  setNewDocument({
                    title: '', description: '', category: 'policy', dataClassification: 'internal',
                    fileName: '', version: '1.0', isConfidential: false, tags: '',
                  });
                }}
                className="border-foreground/20"
                data-testid="button-cancel-document"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleCreate}
                disabled={uploadingFile || createMutation.isPending || updateMutation.isPending}
                className="hub-btn-gold"
                data-testid="button-submit-document"
              >
                {uploadingFile ? 'جاري الرفع...' : (createMutation.isPending || updateMutation.isPending) ? 'جاري الحفظ...' : editingDoc ? 'تحديث المستند' : 'حفظ المستند'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                {selectedDocument?.title}
                {selectedDocument?.isConfidential && (
                  <Lock className="w-4 h-4 hub-stat-gold" />
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedDocument && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  {getFileIcon(selectedDocument.fileType)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{selectedDocument.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      الإصدار: {selectedDocument.version} • {formatFileSize(selectedDocument.fileSize)}
                      {selectedDocument.fileType && (
                        <span> • {selectedDocument.fileType.split('/').pop()?.toUpperCase()}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedDocument.fileUrl && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="عرض الملف"
                        onClick={() => handleDownload(selectedDocument, true)}
                        data-testid="button-preview-attachment"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="تحميل الملف"
                      onClick={() => handleDownload(selectedDocument)}
                      data-testid="button-download-attachment"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {selectedDocument.description && (
                  <div>
                    <Label className="text-muted-foreground">الوصف</Label>
                    <p className="text-foreground">{selectedDocument.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">التصنيف</Label>
                    <p className="text-foreground">{categoryLabels[selectedDocument.category]}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">الحالة</Label>
                    <p className="text-foreground">{statusLabels[selectedDocument.status]}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">تاريخ الإنشاء</Label>
                    <p className="text-foreground">{new Date(selectedDocument.createdAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">عدد التحميلات</Label>
                    <p className="text-foreground">{selectedDocument.downloadCount}</p>
                  </div>
                </div>
                {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">الوسوم</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedDocument.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="border-gold/30">
                          <Tag className="w-3 h-3 ml-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowViewDialog(false)}
                className="border-foreground/20"
                data-testid="button-close-document-view"
              >
                إغلاق
              </Button>
              {selectedDocument && selectedDocument.status !== 'archived' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    archiveMutation.mutate(selectedDocument.id);
                    setShowViewDialog(false);
                  }}
                  className="border-foreground/20"
                  data-testid="button-archive-document-view"
                >
                  <Archive className="w-4 h-4 ml-1" />
                  أرشفة
                </Button>
              )}
              {selectedDocument && (
                <Button
                  onClick={() => handleEdit(selectedDocument)}
                  className="hub-btn-gold"
                  data-testid="button-edit-document-view"
                >
                  <Edit2 className="w-4 h-4 ml-1" />
                  تعديل
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </DashboardLayout>
  );
}
