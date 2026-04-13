import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Home, Users, FileText, Settings, Shield, Server, Zap, Headphones,
  Database, BarChart3, Bell, Calendar, CheckSquare, Folder, Lock, LogOut,
  Activity, AlertTriangle, Briefcase, ClipboardList, Clock, Ticket,
  BookOpen, User, FolderOpen, Loader2, TrendingUp, Hash, ArrowLeftRight, Gavel, FileCheck
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface CommandItemType {
  id: string; title: string; subtitle?: string; icon: JSX.Element;
  action: () => void; keywords?: string[]; category: 'navigation' | 'actions' | 'settings' | 'recent';
  shortcut?: string;
}

interface SearchResult {
  id: string; type: 'ticket' | 'task' | 'project' | 'kb' | 'user';
  title: string; subtitle?: string; priority?: string; status?: string; url: string;
}

interface SearchResponse {
  results: SearchResult[];
  categories: { id: string; label: string; count: number }[];
}

const TYPE_CONFIG: Record<string, { icon: JSX.Element; color: string; label: string }> = {
  ticket: { icon: <Ticket className="w-3.5 h-3.5" />, color: 'text-blue-400', label: 'تذكرة' },
  task: { icon: <CheckSquare className="w-3.5 h-3.5" />, color: 'text-amber-400', label: 'مهمة' },
  project: { icon: <FolderOpen className="w-3.5 h-3.5" />, color: 'text-purple-400', label: 'مشروع' },
  kb: { icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-emerald-400', label: 'معرفة' },
  user: { icon: <User className="w-3.5 h-3.5" />, color: 'text-cyan-400', label: 'مستخدم' },
  referral: { icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: 'text-orange-400', label: 'إحالة' },
  decision: { icon: <Gavel className="w-3.5 h-3.5" />, color: 'text-rose-400', label: 'قرار' },
  meeting: { icon: <FileCheck className="w-3.5 h-3.5" />, color: 'text-indigo-400', label: 'محضر' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-600/30 text-red-200',
  critical: 'bg-red-500/20 text-red-300',
  high: 'bg-orange-500/20 text-orange-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-slate-500/20 text-slate-300',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجلة', critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 250);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hub-recent-searches') || '[]'); }
    catch { return []; }
  });

  const addRecentSearch = useCallback((term: string) => {
    if (!term.trim() || term.length < 2) return;
    setRecentSearches(prev => {
      const updated = [term, ...prev.filter(s => s !== term)].slice(0, 5);
      localStorage.setItem('hub-recent-searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const { data: searchData, isFetching } = useQuery<SearchResponse>({
    queryKey: debouncedQuery.length >= 2 ? [`/api/search?q=${encodeURIComponent(debouncedQuery)}`] : ['/api/search-disabled'],
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  const navigateTo = useCallback((path: string) => {
    setLocation(path); setOpen(false);
  }, [setLocation]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    addRecentSearch(result.title);
    navigateTo(result.url);
  }, [addRecentSearch, navigateTo]);

  const portal = user?.portal?.toLowerCase() || '';
  const role = user?.role?.toLowerCase() || '';
  const isAdmin = role.includes('admin') || role.includes('system');

  const portalBasePath = (() => {
    if (portal === 'it_director') return '/it-director';
    if (portal === 'infrastructure') return '/department/infrastructure';
    if (portal === 'cybersecurity') return '/department/cybersecurity';
    if (portal === 'digital_transformation') return '/department/digital-transformation';
    if (portal === 'support') return '/department/support';
    if (portal === 'dmo') return '/dmo';
    if (portal === 'committee') return '/committee';
    return '/admin';
  })();

  const commands: CommandItemType[] = [
    { id: 'admin', title: 'لوحة الإدارة', subtitle: 'الصفحة الرئيسية للمدير', icon: <Home className="w-4 h-4" />, action: () => navigateTo('/admin'), keywords: ['admin', 'home'], category: 'navigation', shortcut: 'A' },
    { id: 'users', title: 'إدارة المستخدمين', subtitle: 'عرض وإدارة المستخدمين', icon: <Users className="w-4 h-4" />, action: () => navigateTo('/admin/users'), keywords: ['users', 'members'], category: 'navigation' },
    { id: 'audit', title: 'سجل التدقيق', subtitle: 'عرض سجلات النظام', icon: <FileText className="w-4 h-4" />, action: () => navigateTo('/admin/audit'), keywords: ['audit', 'logs'], category: 'navigation' },
    { id: 'it-director', title: 'بوابة مدير تقنية المعلومات', subtitle: 'المحور المركزي', icon: <Briefcase className="w-4 h-4" />, action: () => navigateTo('/it-director'), keywords: ['it', 'director'], category: 'navigation' },
    { id: 'projects', title: 'إدارة المشاريع', subtitle: 'عرض وإدارة المشاريع', icon: <Folder className="w-4 h-4" />, action: () => navigateTo(portal === 'it_director' ? '/it-director/projects' : `${portalBasePath}/projects`), keywords: ['projects'], category: 'navigation' },
    { id: 'tickets', title: 'إدارة التذاكر', subtitle: 'عرض وإدارة التذاكر', icon: <ClipboardList className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/tickets`), keywords: ['tickets', 'support'], category: 'navigation', shortcut: 'T' },
    { id: 'planner', title: 'مخطط المهام', subtitle: 'عرض وتنظيم المهام', icon: <Calendar className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/planner`), keywords: ['planner', 'kanban', 'tasks'], category: 'navigation' },
    { id: 'tasks', title: 'المهام', subtitle: 'عرض وإدارة المهام', icon: <CheckSquare className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/tasks`), keywords: ['tasks', 'مهام'], category: 'navigation' },
    { id: 'sla', title: 'مراقبة SLA', subtitle: 'تتبع اتفاقيات مستوى الخدمة', icon: <Activity className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/sla`), keywords: ['sla', 'service'], category: 'navigation' },
    { id: 'referrals', title: 'الإحالات', subtitle: 'إحالات بين الأقسام', icon: <Ticket className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/referrals`), keywords: ['referrals', 'إحالات'], category: 'navigation' },
    { id: 'infrastructure', title: 'البنية التحتية', subtitle: 'الخوادم والشبكات', icon: <Server className="w-4 h-4" />, action: () => navigateTo('/department/infrastructure'), keywords: ['infrastructure'], category: 'navigation' },
    { id: 'cybersecurity', title: 'الأمن السيبراني', subtitle: 'الحماية والأمان', icon: <Shield className="w-4 h-4" />, action: () => navigateTo('/department/cybersecurity'), keywords: ['security', 'cyber'], category: 'navigation' },
    { id: 'digital', title: 'التحول الرقمي', subtitle: 'المشاريع الرقمية', icon: <Zap className="w-4 h-4" />, action: () => navigateTo('/department/digital-transformation'), keywords: ['digital'], category: 'navigation' },
    { id: 'support', title: 'الدعم الفني', subtitle: 'دعم المستخدمين', icon: <Headphones className="w-4 h-4" />, action: () => navigateTo('/department/support'), keywords: ['support'], category: 'navigation' },
    { id: 'dmo', title: 'مكتب إدارة البيانات', subtitle: 'حوكمة البيانات', icon: <Database className="w-4 h-4" />, action: () => navigateTo('/dmo'), keywords: ['dmo', 'data'], category: 'navigation' },
    { id: 'committee', title: 'بوابة اللجان', subtitle: 'الحوكمة والقرارات', icon: <Users className="w-4 h-4" />, action: () => navigateTo('/committee'), keywords: ['committee'], category: 'navigation' },
    { id: 'new-ticket', title: 'إنشاء تذكرة جديدة', subtitle: 'رفع تذكرة دعم فني', icon: <ClipboardList className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/tickets`), keywords: ['new', 'ticket'], category: 'actions', shortcut: 'N' },
    { id: 'reports', title: 'التقارير والإحصاءات', subtitle: 'لوحة KPI التنفيذية', icon: <BarChart3 className="w-4 h-4" />, action: () => navigateTo(`${portalBasePath}/kpi`), keywords: ['reports', 'stats', 'kpi'], category: 'actions' },
    { id: 'notifications', title: 'مركز الإشعارات', subtitle: 'عرض جميع الإشعارات', icon: <Bell className="w-4 h-4" />, action: () => { setOpen(false); window.dispatchEvent(new Event('open-notifications')); }, keywords: ['notifications'], category: 'actions' },
    { id: 'logout', title: 'تسجيل الخروج', subtitle: 'الخروج من النظام', icon: <LogOut className="w-4 h-4" />, action: () => { logout(); setOpen(false); }, keywords: ['logout'], category: 'settings' },
  ];

  const filteredCommands = commands.filter(cmd => {
    if (!user) return cmd.category === 'settings';
    if (cmd.id === 'admin' || cmd.id === 'users' || cmd.id === 'audit') return isAdmin;
    if (cmd.id === 'it-director') return isAdmin || portal === 'it_director';
    if (cmd.id === 'infrastructure') return isAdmin || portal === 'it_director' || portal === 'infrastructure';
    if (cmd.id === 'cybersecurity') return isAdmin || portal === 'it_director' || portal === 'cybersecurity';
    if (cmd.id === 'digital') return isAdmin || portal === 'it_director' || portal === 'digital_transformation';
    if (cmd.id === 'support') return isAdmin || portal === 'it_director' || portal === 'support';
    if (cmd.id === 'dmo') return isAdmin || portal === 'it_director' || portal === 'dmo';
    if (cmd.id === 'committee') return isAdmin || portal === 'it_director' || portal === 'committee' || portal === 'dmo';
    return true;
  });

  const navigationItems = filteredCommands.filter(c => c.category === 'navigation');
  const actionItems = filteredCommands.filter(c => c.category === 'actions');

  const isSearching = debouncedQuery.length >= 2;
  const hasResults = searchData && searchData.results.length > 0;

  const groupedResults: Record<string, SearchResult[]> = {};
  if (searchData?.results) {
    searchData.results.forEach(r => {
      if (!groupedResults[r.type]) groupedResults[r.type] = [];
      groupedResults[r.type].push(r);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors"
        data-testid="button-command-palette"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">بحث سريع...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="rounded-lg border shadow-2xl" shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder="ابحث عن تذاكر، مهام، مشاريع، إحالات، قرارات..."
              className="h-12"
              value={searchQuery}
              onValueChange={setSearchQuery}
              data-testid="command-palette-input"
            />
            {isFetching && (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <CommandList className="max-h-[480px]">
            {/* Live Search Results */}
            {isSearching && (
              <>
                {isFetching && !hasResults && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                    <p>جاري البحث...</p>
                  </div>
                )}

                {!isFetching && !hasResults && (
                  <CommandEmpty>
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <Search className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm">لم يتم العثور على نتائج لـ "{debouncedQuery}"</p>
                      <p className="text-xs mt-1 opacity-60">جرّب كلمات مختلفة أو استخدم التنقل السريع أدناه</p>
                    </div>
                  </CommandEmpty>
                )}

                {hasResults && Object.entries(groupedResults).map(([type, items]) => {
                  const cfg = TYPE_CONFIG[type];
                  if (!cfg || !items.length) return null;
                  return (
                    <CommandGroup key={type} heading={
                      <div className="flex items-center gap-1.5">
                        <span className={cn("flex items-center", cfg.color)}>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                        <Badge variant="secondary" className="h-4 text-[9px] px-1 py-0 mr-1">{items.length}</Badge>
                      </div>
                    }>
                      {items.map(result => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleResultSelect(result)}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                          data-testid={`search-result-${result.id}`}
                        >
                          <div className={cn("p-1.5 rounded-md bg-muted/50 shrink-0", cfg.color)}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {result.priority && (
                            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0", PRIORITY_COLORS[result.priority] || 'bg-muted text-muted-foreground')}>
                              {PRIORITY_LABELS[result.priority] || result.priority}
                            </span>
                          )}
                          {result.status && !result.priority && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {result.status}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}

            {/* Recent Searches - shown when no query */}
            {!isSearching && recentSearches.length > 0 && (
              <CommandGroup heading="عمليات بحث سابقة">
                {recentSearches.map((term, i) => (
                  <CommandItem key={`recent-${i}`} value={`recent-${i}`}
                    onSelect={() => setSearchQuery(term)}
                    className="flex items-center gap-3 px-4 py-2 cursor-pointer text-sm"
                    data-testid={`command-recent-${i}`}>
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{term}</span>
                    <TrendingUp className="w-3 h-3 text-muted-foreground/40 mr-auto" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Navigation - shown when no query or short query */}
            {!isSearching && (
              <>
                <CommandGroup heading="التنقل السريع">
                  {navigationItems.map((item) => (
                    <CommandItem key={item.id} value={item.id}
                      onSelect={() => { addRecentSearch(item.title); item.action(); }}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      data-testid={`command-nav-${item.id}`}>
                      <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10 text-[hsl(43_74%_49%)] shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                      </div>
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="الإجراءات">
                  {actionItems.map((item) => (
                    <CommandItem key={item.id} value={item.id}
                      onSelect={() => { addRecentSearch(item.title); item.action(); }}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      data-testid={`command-action-${item.id}`}>
                      <div className="p-2 rounded-lg bg-[hsl(43_74%_49%)]/10 text-[hsl(43_74%_49%)] shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="الحساب">
                  <CommandItem value="logout"
                    onSelect={() => { logout(); setOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer text-destructive"
                    data-testid="command-logout">
                    <div className="p-2 rounded-lg bg-muted shrink-0">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">تسجيل الخروج</p>
                      <p className="text-xs text-muted-foreground">الخروج من النظام</p>
                    </div>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">↑↓</kbd>
                <span>تنقل</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Enter</kbd>
                <span>انتقال</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSearching && hasResults && (
                <span className="text-[10px] text-muted-foreground/60">
                  {searchData?.results.length} نتيجة
                </span>
              )}
              <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Esc</kbd>
              <span>إغلاق</span>
            </div>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
