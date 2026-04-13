import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote, Plus, Pin, Trash2, Edit3, Check, X,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface QuickNotesProps {
  portal: string;
}

const NOTE_COLORS = [
  { value: 'default', label: 'افتراضي', bg: 'bg-card', border: 'border-border' },
  { value: 'blue', label: 'أزرق', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { value: 'green', label: 'أخضر', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { value: 'yellow', label: 'أصفر', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { value: 'red', label: 'أحمر', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  { value: 'purple', label: 'بنفسجي', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
];

export function QuickNotes({ portal }: QuickNotesProps) {
  const [expanded, setExpanded] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newColor, setNewColor] = useState('default');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();

  const { data: notes = [] } = useQuery<any[]>({
    queryKey: ['/api/quick-notes', portal],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/quick-notes?portal=${portal}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/quick-notes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes', portal] });
      setNewNote('');
      setNewColor('default');
      setShowAdd(false);
      toast({ title: 'تم إضافة الملاحظة' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/quick-notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes', portal] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/quick-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes', portal] });
      toast({ title: 'تم حذف الملاحظة' });
    }
  });

  const getColorClasses = (color: string) => {
    const c = NOTE_COLORS.find(nc => nc.value === color) || NOTE_COLORS[0];
    return `${c.bg} ${c.border}`;
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-0 pt-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">ملاحظات سريعة</span>
          {notes.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{notes.length}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-note">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-notes">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-3 pb-3 px-4 space-y-2">
              {showAdd && (
                <div className="space-y-2 p-2.5 rounded-md border bg-muted/20">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="اكتب ملاحظة..."
                    className="resize-none text-sm min-h-[50px]"
                    data-testid="input-new-note"
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      {NOTE_COLORS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => setNewColor(c.value)}
                          className={`w-4 h-4 rounded-full border ${c.bg} ${newColor === c.value ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`}
                          data-testid={`button-color-${c.value}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                        إلغاء
                      </Button>
                      <Button
                        size="sm"
                        disabled={!newNote.trim() || addMutation.isPending}
                        onClick={() => addMutation.mutate({ portal, content: newNote, color: newColor })}
                        data-testid="button-save-note"
                      >
                        حفظ
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {notes.length === 0 && !showAdd && (
                <div className="text-center py-6 text-xs text-muted-foreground/60">
                  لا توجد ملاحظات
                </div>
              )}

              <div className="space-y-1.5">
                {sortedNotes.map((note: any) => (
                  <div key={note.id} className={`p-2.5 rounded-md border ${getColorClasses(note.color)} relative`}>
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="resize-none text-sm min-h-[50px]"
                          data-testid={`input-edit-note-${note.id}`}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => updateMutation.mutate({ id: note.id, content: editContent })}>
                            <Check className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start gap-1.5">
                          {note.isPinned && <Pin className="w-3 h-3 text-[hsl(43_74%_49%)] shrink-0 mt-0.5" />}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1" data-testid={`text-note-${note.id}`}>{note.content}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground/40">
                            {new Date(note.updatedAt).toLocaleDateString('ar-SA')}
                          </span>
                          <div className="flex items-center gap-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateMutation.mutate({ id: note.id, isPinned: !note.isPinned })}
                              className={note.isPinned ? 'text-[hsl(43_74%_49%)]' : 'text-muted-foreground/40'}
                              data-testid={`button-pin-note-${note.id}`}
                            >
                              <Pin className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground/40"
                              onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                              data-testid={`button-edit-note-${note.id}`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground/40"
                              onClick={() => deleteMutation.mutate(note.id)}
                              data-testid={`button-delete-note-${note.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
