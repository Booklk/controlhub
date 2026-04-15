import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, Trash2, ChevronDown, ChevronUp,
  Ticket, ClipboardList, FolderKanban, Shield, Server, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SmartBookmarksProps {
  portal: string;
  onNavigate?: (path: string) => void;
}

const ENTITY_ICONS: Record<string, any> = {
  ticket: Ticket,
  task: ClipboardList,
  project: FolderKanban,
  incident: Shield,
  server: Server,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-400',
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-emerald-500',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  critical: 'حرج',
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
};

export function SmartBookmarks({ portal, onNavigate }: SmartBookmarksProps) {
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const { data: bookmarks = [] } = useQuery<any[]>({
    queryKey: ['/api/bookmarks', portal],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/bookmarks?portal=${portal}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/bookmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks', portal] });
      toast({ title: 'تم إزالة من المفضلة' });
    }
  });

  const filteredBookmarks = searchQuery.trim()
    ? bookmarks.filter((bm: any) => bm.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : bookmarks;

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-0 pt-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">المفضلة</span>
          {bookmarks.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{bookmarks.length}</span>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-bookmarks">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-3 pb-3 px-4">
              {bookmarks.length > 3 && (
                <div className="relative mb-2">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث..."
                    className="w-full bg-muted/30 border border-border/50 rounded-md py-1.5 pr-7 pl-2 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:border-border"
                    data-testid="input-search-bookmarks"
                  />
                </div>
              )}

              {filteredBookmarks.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground/60">
                  {searchQuery ? 'لا توجد نتائج' : 'لا توجد عناصر محفوظة'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredBookmarks.map((bm: any) => {
                    const Icon = ENTITY_ICONS[bm.entityType] || Bookmark;
                    return (
                      <div
                        key={bm.id}
                        className="flex items-center justify-between py-2 px-2 rounded-md hover-elevate cursor-pointer group"
                        onClick={() => bm.url && onNavigate?.(bm.url)}
                        data-testid={`bookmark-item-${bm.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate leading-tight">{bm.title}</p>
                            {bm.subtitle && (
                              <p className="text-[10px] text-muted-foreground/40 truncate mt-0.5">{bm.subtitle}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {bm.priority && (
                            <span className={`text-[10px] ${PRIORITY_COLORS[bm.priority] || 'text-muted-foreground'}`}>
                              {PRIORITY_LABELS[bm.priority] || bm.priority}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="invisible group-hover:visible text-muted-foreground/40"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(bm.id); }}
                            data-testid={`button-remove-bookmark-${bm.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function BookmarkButton({ portal, entityType, entityId, title, subtitle, priority, status, url }: {
  portal: string; entityType: string; entityId: number; title: string;
  subtitle?: string; priority?: string; status?: string; url?: string;
}) {
  const { toast } = useToast();

  const { data: bookmarks = [] } = useQuery<any[]>({
    queryKey: ['/api/bookmarks', portal],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/bookmarks?portal=${portal}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const isBookmarked = Array.isArray(bookmarks) && bookmarks.some((b: any) => b.entityType === entityType && b.entityId === entityId);

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/bookmarks', { portal, entityType, entityId, title, subtitle, priority, status, url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks', portal] });
      toast({ title: 'تم الحفظ في المفضلة' });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/bookmarks/entity/${portal}/${entityType}/${entityId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookmarks', portal] });
      toast({ title: 'تم الإزالة من المفضلة' });
    }
  });

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => isBookmarked ? removeMutation.mutate() : addMutation.mutate()}
      className={isBookmarked ? 'text-[hsl(43_74%_49%)]' : ''}
      data-testid={`button-bookmark-${entityType}-${entityId}`}
    >
      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
    </Button>
  );
}
