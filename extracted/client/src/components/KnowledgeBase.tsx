import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, KpiCard } from "@/components/Quality";
import type { NavGroup } from "@/lib/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Tag,
  FolderOpen,
  RefreshCw,
  ThumbsUp,
  MessageSquare,
} from "lucide-react";

interface KnowledgeBaseProps {
  departmentId: number;
  departmentName: string;
  navGroups: NavGroup[];
  basePath: string;
}

interface Article {
  id: number;
  departmentId: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: string;
  views: number;
  helpful: number;
  authorId: number;
  authorName?: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

const categoryLabels: Record<string, string> = {
  procedure: 'إجراء',
  solution: 'حل مشكلة',
  guide: 'دليل',
  faq: 'أسئلة شائعة',
  policy: 'سياسة',
  best_practice: 'أفضل الممارسات',
  troubleshooting: 'استكشاف الأخطاء',
};

const categoryIcons: Record<string, React.ReactNode> = {
  procedure: <FileText className="w-4 h-4" />,
  solution: <Lightbulb className="w-4 h-4" />,
  guide: <BookOpen className="w-4 h-4" />,
  faq: <MessageSquare className="w-4 h-4" />,
  policy: <AlertCircle className="w-4 h-4" />,
  best_practice: <CheckCircle2 className="w-4 h-4" />,
  troubleshooting: <AlertCircle className="w-4 h-4" />,
};

export default function KnowledgeBase({ departmentId, departmentName, navGroups, basePath }: KnowledgeBaseProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    category: 'guide',
    tags: '',
  });

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: [`/api/knowledge-base?departmentId=${departmentId}`],
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: typeof newArticle) => {
      const res = await apiRequest('POST', '/api/knowledge-base', {
        ...data,
        departmentId,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-base?departmentId=${departmentId}`] });
      setShowCreateDialog(false);
      setNewArticle({ title: '', content: '', category: 'guide', tags: '' });
      toast({ title: "تم بنجاح", description: "تم إنشاء المقال" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const markHelpfulMutation = useMutation({
    mutationFn: async (articleId: number) => {
      const res = await apiRequest('POST', `/api/knowledge-base/${articleId}/helpful`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-base?departmentId=${departmentId}`] });
      toast({ title: "شكراً لملاحظاتك!" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: [`/api/knowledge-base?departmentId=${departmentId}`] });
    setIsRefreshing(false);
    toast({ title: "تم التحديث", description: "تم تحديث قاعدة المعرفة" });
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'featured' && article.isFeatured) ||
      (activeTab === 'recent' && new Date(article.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesCategory && matchesTab;
  });

  const stats = {
    total: articles.length,
    procedures: articles.filter(a => a.category === 'procedure').length,
    solutions: articles.filter(a => a.category === 'solution').length,
    guides: articles.filter(a => a.category === 'guide').length,
    featured: articles.filter(a => a.isFeatured).length,
  };

  return (
    <DashboardLayout
      title={`قاعدة المعرفة - ${departmentName}`}
      subtitle="المقالات والإجراءات والحلول التقنية"
      navGroups={navGroups}
      portalName={departmentName}
    >
      <div className="space-y-5">
        <PageHeader
          icon={BookOpen}
          title="قاعدة المعرفة"
          subtitle="المقالات والإجراءات والحلول التقنية"
          actions={
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="بحث في قاعدة المعرفة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 h-9 text-sm w-52 bg-background" data-testid="input-search-kb" />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-category-filter"><SelectValue placeholder="جميع الفئات" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفئات</SelectItem>
                  {Object.entries(categoryLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} data-testid="button-refresh-kb"><RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
              <Button className="btn-gold h-9 gap-1.5 text-xs" onClick={() => setShowCreateDialog(true)} data-testid="button-create-article"><Plus className="w-3.5 h-3.5" />مقال جديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="إجمالي المقالات" value={stats.total} icon={BookOpen} color="navy" />
          <KpiCard label="الإجراءات" value={stats.procedures} icon={FileText} color="navy" />
          <KpiCard label="الحلول" value={stats.solutions} icon={Lightbulb} color="gold" />
          <KpiCard label="مقالات مميزة" value={stats.featured} icon={Star} color="gold" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="all" data-testid="tab-all">الكل</TabsTrigger>
            <TabsTrigger value="featured" data-testid="tab-featured">مميزة</TabsTrigger>
            <TabsTrigger value="recent" data-testid="tab-recent">حديثة</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredArticles.length === 0 ? (
              <Card className="border-dashed border-[hsl(43_74%_49%)]/30">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مقالات بعد'}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2" data-testid="button-add-article-empty">
                    <Plus className="w-4 h-4" />
                    إضافة مقال
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map(article => (
                  <Card 
                    key={article.id} 
                    className="border-[hsl(43_74%_49%)]/20 hover-elevate cursor-pointer group"
                    onClick={() => {
                      setSelectedArticle(article);
                      setShowArticleDialog(true);
                    }}
                    data-testid={`card-article-${article.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10">
                            {categoryIcons[article.category] || <FileText className="w-4 h-4 hub-stat-gold" />}
                          </div>
                          {article.isFeatured && (
                            <Star className="w-4 h-4 hub-stat-gold fill-[hsl(43_74%_49%)]" />
                          )}
                        </div>
                        <Badge variant="outline" className="border-[hsl(43_74%_49%)]/30 text-xs">
                          {categoryLabels[article.category] || article.category}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-2 line-clamp-2">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {article.content.substring(0, 150)}...
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {article.views || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3" />
                            {article.helpful || 0}
                          </span>
                        </div>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(article.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {article.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{article.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة مقال جديد</DialogTitle>
              <DialogDescription>أضف مقالاً أو إجراءً أو حلاً لقاعدة المعرفة</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label className="text-right block">عنوان المقال</Label>
                <Input
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  placeholder="أدخل عنوان المقال"
                  className="text-right"
                  data-testid="input-article-title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">الفئة</Label>
                <Select
                  value={newArticle.category}
                  onValueChange={(value) => setNewArticle({ ...newArticle, category: value })}
                >
                  <SelectTrigger data-testid="select-article-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-right block">المحتوى</Label>
                <Textarea
                  value={newArticle.content}
                  onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                  placeholder="اكتب محتوى المقال هنا..."
                  className="text-right min-h-[200px]"
                  data-testid="input-article-content"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">الوسوم (Tags)</Label>
                <Input
                  value={newArticle.tags}
                  onChange={(e) => setNewArticle({ ...newArticle, tags: e.target.value })}
                  placeholder="أدخل الوسوم مفصولة بفواصل (مثال: شبكة, سيرفر, صيانة)"
                  className="text-right"
                  data-testid="input-article-tags"
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-article">
                إلغاء
              </Button>
              <Button 
                onClick={() => createArticleMutation.mutate(newArticle)}
                disabled={!newArticle.title || !newArticle.content || createArticleMutation.isPending}
                data-testid="button-submit-article"
              >
                {createArticleMutation.isPending ? 'جاري الحفظ...' : 'حفظ المقال'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
          <DialogContent className="max-w-3xl" dir="rtl">
            {selectedArticle && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-[hsl(43_74%_49%)]/30">
                      {categoryLabels[selectedArticle.category]}
                    </Badge>
                    {selectedArticle.isFeatured && (
                      <Badge className="bg-[hsl(43_74%_49%)]/20 text-[hsl(43_74%_35%)]">
                        <Star className="w-3 h-3 ml-1" />
                        مميز
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-xl">{selectedArticle.title}</DialogTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(selectedArticle.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {selectedArticle.views || 0} مشاهدة
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      {selectedArticle.helpful || 0} وجدوه مفيداً
                    </span>
                  </div>
                </DialogHeader>
                <DialogBody>
                  <div className="prose prose-sm max-w-none text-right">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {selectedArticle.content}
                    </div>
                  </div>
                  {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      {selectedArticle.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </DialogBody>
                <DialogFooter className="gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      markHelpfulMutation.mutate(selectedArticle.id);
                    }}
                    className="gap-2"
                    data-testid="button-mark-helpful"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    مفيد
                  </Button>
                  <Button variant="outline" onClick={() => setShowArticleDialog(false)} data-testid="button-close-article">
                    إغلاق
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
