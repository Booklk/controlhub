import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Bot, User, Sparkles,
  Loader2, Copy, Check, ChevronRight, Mic, MicOff,
  ExternalLink, RotateCcw, Maximize2, Minimize2,
  AlertTriangle, TrendingUp, Search, Zap, Bell,
  ThumbsUp, ThumbsDown, Calendar, Clock, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth, getAuthHeaders as getStoredAuthHeaders } from '@/lib/auth';
import { ensureCSRFToken } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { NCA_KNOWLEDGE, DGA_KNOWLEDGE, NDMO_KNOWLEDGE, PLATFORM_KNOWLEDGE } from '@/data/mojeeb-knowledge';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  data?: any;
  links?: { text: string; href: string }[];
  suggestions?: string[];
  actions?: { label: string; href: string; type?: string }[];
  isLoading?: boolean;
  copied?: boolean;
  reaction?: 'liked' | 'disliked' | null;
  thinkingCategory?: string;
}

interface QuickChip {
  label: string;
  category: 'live' | 'compliance' | 'help' | 'alerts' | 'action';
  icon?: string;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function apiFetch(url: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getStoredAuthHeaders(),
    ...(opts?.headers as Record<string, string> || {}),
  };
  const method = (opts?.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await ensureCSRFToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers,
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── Portal detection ─────────────────────────────────────────────────────────
const PATH_TO_PORTAL: Record<string, string> = {
  '/admin': 'admin',
  '/it-director': 'it_director',
  '/department/cybersecurity': 'cybersecurity',
  '/department/infrastructure': 'infrastructure',
  '/department/digital-transformation': 'digital_transformation',
  '/department/support': 'support',
  '/dmo': 'dmo',
  '/committee': 'committee',
};
const PORTAL_LABELS: Record<string, string> = {
  admin: 'الإدارة', it_director: 'مدير التقنية', cybersecurity: 'الأمن السيبراني',
  infrastructure: 'البنية التحتية', digital_transformation: 'التحول الرقمي',
  support: 'الدعم الفني', dmo: 'مكتب البيانات', committee: 'اللجنة',
};
const PORTAL_COLORS: Record<string, string> = {
  admin: 'from-purple-500 to-purple-700',
  it_director: 'from-blue-500 to-blue-700',
  cybersecurity: 'from-red-500 to-red-700',
  infrastructure: 'from-green-500 to-green-700',
  digital_transformation: 'from-indigo-500 to-indigo-700',
  support: 'from-orange-500 to-orange-700',
  dmo: 'from-teal-500 to-teal-700',
  committee: 'from-yellow-500 to-yellow-700',
};
function detectPortal(location: string): string {
  for (const [path, portal] of Object.entries(PATH_TO_PORTAL)) {
    if (location.startsWith(path)) return portal;
  }
  return 'admin';
}

// ─── Local knowledge matching ─────────────────────────────────────────────────
function sm(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

function getLocalKnowledge(query: string): string | null {
  const q = query.toLowerCase();
  if (sm(q, ['ecc', 'ضوابط اساسية', 'essential cybersecurity', '108 ضابط'])) {
    if (sm(q, ['مجال 1', 'حوكمة', 'governance'])) return NCA_KNOWLEDGE.eccDomain1;
    if (sm(q, ['مجال 2', 'دفاع', 'defense'])) return NCA_KNOWLEDGE.eccDomain2;
    if (sm(q, ['مجال 3', 'مرونة', 'resilience'])) return NCA_KNOWLEDGE.eccDomain3;
    if (sm(q, ['مجال 4', 'سحابة', 'خارجية', 'cloud'])) return NCA_KNOWLEDGE.eccDomain4;
    return NCA_KNOWLEDGE.eccOverview;
  }
  if (sm(q, ['nca', 'الهيئة الوطنية', 'امن سيبراني', 'الأمن السيبراني']) && !sm(q, ['امتثال', 'نسبة']))
    return NCA_KNOWLEDGE.ncaAllFrameworks;
  if (sm(q, ['cscc', 'أنظمة حرجة', 'critical systems'])) return NCA_KNOWLEDGE.cscc;
  if (sm(q, ['ccc', 'سحابة', 'cloud cybersecurity'])) return NCA_KNOWLEDGE.ccc;
  if (sm(q, ['otcc', 'تقنية تشغيلية', 'ot', 'scada'])) return NCA_KNOWLEDGE.otcc;
  if (sm(q, ['tcc', 'عمل عن بعد', 'remote'])) return NCA_KNOWLEDGE.tcc;
  if (sm(q, ['dga', 'حكومة رقمية', 'digital government'])) return DGA_KNOWLEDGE.overview;
  if (sm(q, ['معايير التحول', '95 معيار', 'مناظير'])) return DGA_KNOWLEDGE.standards;
  if (sm(q, ['قياس', 'qiyas', 'gems'])) return DGA_KNOWLEDGE.qiyas;
  if (sm(q, ['ndmo', 'سدايا', 'sdaia', 'مكتب وطني'])) {
    if (sm(q, ['مجالات', '15', '77', '191'])) return NDMO_KNOWLEDGE.allDomains;
    return NDMO_KNOWLEDGE.overview;
  }
  if (sm(q, ['pdpl', 'خصوصية', 'بيانات شخصية', 'privacy'])) return NDMO_KNOWLEDGE.pdplDetailed;
  if (sm(q, ['تصنيف', 'classification', 'سري', 'مقيد'])) return NDMO_KNOWLEDGE.classification;
  if (sm(q, ['جودة البيانات', 'data quality', 'ابعاد الجودة'])) return NDMO_KNOWLEDGE.quality;
  if (sm(q, ['دورة حياة', 'lifecycle', 'ارشفة', 'اتلاف'])) return NDMO_KNOWLEDGE.domain11Lifecycle;
  if (sm(q, ['بيانات مفتوحة', 'open data'])) return NDMO_KNOWLEDGE.domain12OpenData;
  if (sm(q, ['مشاركة البيانات', 'data sharing', 'تبادل'])) return NDMO_KNOWLEDGE.domain13Sharing;
  if (sm(q, ['حوكمة البيانات', 'data governance', 'cdo', 'dpo'])) return NDMO_KNOWLEDGE.domain1Governance;
  if (sm(q, ['بيانات وصفية', 'metadata', 'data dictionary', 'data lineage'])) return NDMO_KNOWLEDGE.domain7Metadata;
  if (sm(q, ['ذكاء اعمال', 'bi', 'analytics', 'data warehouse'])) return NDMO_KNOWLEDGE.domain10BI;
  if (sm(q, ['بوابة', 'البوابات', 'portal', 'portals'])) return PLATFORM_KNOWLEDGE.portals;
  if (sm(q, ['كيف استخدم', 'دليل', 'تعليمات'])) return PLATFORM_KNOWLEDGE.howToGuide;
  return null;
}

// ─── Portal-specific quick chips ─────────────────────────────────────────────
const PORTAL_CHIPS: Record<string, QuickChip[]> = {
  cybersecurity: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'الحوادث الأمنية', category: 'live', icon: '🛡️' },
    { label: 'الثغرات الحرجة', category: 'live', icon: '🔍' },
    { label: 'نسبة الامتثال ECC', category: 'compliance', icon: '📋' },
    { label: 'ضوابط ECC-2:2024', category: 'compliance', icon: '📖' },
    { label: 'ملخص يومي', category: 'live', icon: '☀️' },
    { label: 'الإحالات الواردة', category: 'live', icon: '📨' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
  ],
  infrastructure: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'حالة الخوادم', category: 'live', icon: '🖥️' },
    { label: 'التذاكر المفتوحة', category: 'live', icon: '🎫' },
    { label: 'المهام المتأخرة', category: 'live', icon: '⏰' },
    { label: 'الإحالات غير المؤكدة', category: 'alerts', icon: '📨' },
    { label: 'إحصائيات القسم', category: 'live', icon: '📊' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
    { label: 'كيف أستخدم المنصة؟', category: 'help', icon: '❓' },
  ],
  dmo: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'طلبات DSR المعلقة', category: 'live', icon: '📄' },
    { label: 'نسبة الامتثال NDMO', category: 'compliance', icon: '📋' },
    { label: 'ضوابط NDMO', category: 'compliance', icon: '📖' },
    { label: 'تصنيف البيانات', category: 'compliance', icon: '🏷️' },
    { label: 'ملخص يومي', category: 'live', icon: '☀️' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
  ],
  support: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'كم تذكرة مفتوحة؟', category: 'live', icon: '🎫' },
    { label: 'تذاكري المسندة', category: 'live', icon: '👤' },
    { label: 'الإحالات غير المؤكدة', category: 'alerts', icon: '📨' },
    { label: 'مهام الدعم', category: 'live', icon: '✅' },
    { label: 'إحصائيات القسم', category: 'live', icon: '📊' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
    { label: 'كيف أستخدم المنصة؟', category: 'help', icon: '❓' },
  ],
  digital_transformation: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'المشاريع الرقمية النشطة', category: 'live', icon: '📁' },
    { label: 'معايير DGA', category: 'compliance', icon: '📖' },
    { label: 'مؤشرات الأداء', category: 'live', icon: '📊' },
    { label: 'إنتاجية الفريق', category: 'live', icon: '📈' },
    { label: 'إحصائيات القسم', category: 'live', icon: '📈' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
  ],
  it_director: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'وضع جميع الأقسام', category: 'live', icon: '🏢' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'قارن الأقسام', category: 'action', icon: '🏆' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'التذاكر المصعّدة', category: 'live', icon: '🎫' },
    { label: 'KPI التنفيذي', category: 'live', icon: '📊' },
    { label: 'إنتاجية الفريق', category: 'live', icon: '📈' },
    { label: 'ملخص يومي', category: 'live', icon: '☀️' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'الأطر التنظيمية', category: 'compliance', icon: '📋' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
  ],
  committee: [
    { label: 'الاجتماعات القادمة', category: 'live', icon: '🗓️' },
    { label: 'جلسات التصويت المفتوحة', category: 'live', icon: '🗳️' },
    { label: 'القرارات المعلقة', category: 'live', icon: '⚖️' },
    { label: 'مهام اللجنة', category: 'live', icon: '✅' },
    { label: 'محاضر الاجتماعات', category: 'live', icon: '📜' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'كيف أستخدم المنصة؟', category: 'help', icon: '❓' },
  ],
  admin: [
    { label: 'ما التنبيهات الحرجة؟', category: 'alerts', icon: '⚠️' },
    { label: 'ملخص يومي', category: 'live', icon: '☀️' },
    { label: 'ماذا أفعل الآن؟', category: 'action', icon: '🎯' },
    { label: 'نصائح وتوصيات', category: 'action', icon: '💡' },
    { label: 'إحصائيات المستخدمين', category: 'live', icon: '👥' },
    { label: 'التذاكر المفتوحة', category: 'live', icon: '🎫' },
    { label: 'ملخص الأسبوع', category: 'live', icon: '📅' },
    { label: 'الأطر التنظيمية', category: 'compliance', icon: '📋' },
    { label: 'حالة SLA', category: 'live', icon: '⏱️' },
    { label: 'عبء الفريق', category: 'live', icon: '👥' },
    { label: 'كيف أستخدم المنصة؟', category: 'help', icon: '❓' },
  ],
};

const CHIP_CATEGORY_COLORS: Record<string, string> = {
  alerts: 'border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20',
  action: 'border-[#c9a84c]/60 text-[#c9a84c] bg-[#c9a84c]/15 hover:bg-[#c9a84c]/25',
  live: 'border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20',
  compliance: 'border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20',
  help: 'border-green-500/40 text-green-300 bg-green-500/10 hover:bg-green-500/20',
};

// ─── Navigation links ─────────────────────────────────────────────────────────
function portalBasePath(portal: string): string {
  if (portal === 'it_director') return '/it-director';
  if (portal === 'infrastructure') return '/department/infrastructure';
  if (portal === 'cybersecurity') return '/department/cybersecurity';
  if (portal === 'digital_transformation') return '/department/digital-transformation';
  if (portal === 'support') return '/department/support';
  if (portal === 'dmo') return '/dmo';
  if (portal === 'committee') return '/committee';
  return '/admin';
}
function getLinksForQuery(query: string, portal: string): { text: string; href: string }[] {
  const q = query.toLowerCase();
  const base = portalBasePath(portal);
  const links: { text: string; href: string }[] = [];
  if (sm(q, ['ecc', 'nca', 'ثغر', 'حادث', 'سيبراني'])) links.push({ text: 'الأمن السيبراني', href: '/department/cybersecurity' });
  if (sm(q, ['ndmo', 'pdpl', 'بيانات', 'dsr', 'مشاركة'])) links.push({ text: 'مكتب البيانات', href: '/dmo' });
  if (sm(q, ['dga', 'رقمي', 'تحول'])) links.push({ text: 'التحول الرقمي', href: '/department/digital-transformation' });
  if (sm(q, ['تذكرة', 'تذاكر'])) links.push({ text: 'التذاكر', href: `${base}/tickets` });
  if (sm(q, ['مشروع', 'مشاريع'])) links.push({ text: 'المشاريع', href: portal === 'it_director' ? '/it-director/projects' : `${base}/projects` });
  if (sm(q, ['خادم', 'شبكة', 'بنية'])) links.push({ text: 'البنية التحتية', href: '/department/infrastructure' });
  return links.slice(0, 2);
}

// ─── Animated text rendering (typewriter effect) ──────────────────────────────
function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;
    if (!text) return;
    const speed = text.length > 300 ? 5 : text.length > 150 ? 10 : 15;
    const timer = setInterval(() => {
      const next = Math.min(indexRef.current + 3, text.length);
      indexRef.current = next;
      setDisplayed(text.slice(0, next));
      if (next >= text.length) {
        clearInterval(timer);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayed}{!done && <span className="inline-block w-0.5 h-3.5 bg-[#c9a84c] animate-pulse ml-0.5 align-middle" />}</span>;
}

// ─── Format content as rich text ─────────────────────────────────────────────
function formatContent(text: string, animate = false) {
  const lines = text.split('\n');
  const elements: any[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) { elements.push(<div key={key++} className="h-1.5" />); continue; }

    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} className="font-semibold text-[--color-gold]">{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });

    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      elements.push(<p key={key++} className="font-bold text-[--color-gold] mt-2 mb-0.5 text-[13px]">{line.slice(2, -2)}</p>);
    } else if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key++} className="flex gap-2 text-[13px] leading-relaxed">
          <span className="text-[--color-gold] mt-0.5 shrink-0 opacity-70">•</span>
          <span className="flex-1">{formatted.map((f, i) => <span key={i}>{f}</span>)}</span>
        </div>
      );
    } else if (/^[1-9][\.\)]\s/.test(line)) {
      const num = line.match(/^[1-9]/)?.[0];
      const rest = line.replace(/^[1-9][\.\)]\s/, '');
      const restParts = rest.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-[--color-gold]">{part.slice(2, -2)}</strong>;
        return <span key={i}>{part}</span>;
      });
      elements.push(
        <div key={key++} className="flex gap-2 text-[13px] leading-relaxed">
          <span className="text-[--color-gold] font-bold shrink-0 opacity-70">{num}.</span>
          <span className="flex-1">{restParts}</span>
        </div>
      );
    } else {
      elements.push(<p key={key++} className="text-[13px] leading-relaxed">{formatted}</p>);
    }
  }
  return elements;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function MiniProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

// ─── Data card component ──────────────────────────────────────────────────────
function DataCard({ data, intent }: { data: any; intent?: string }) {
  if (!data) return null;

  // ── ALERTS ──
  if (intent === 'alerts') {
    if (data.total === 0) return (
      <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
        <div className="text-2xl mb-1">✅</div>
        <div className="text-xs text-green-300 font-medium">النظام بخير — لا تنبيهات</div>
      </div>
    );
    const alertItems = [
      data.downServers > 0 && { label: 'خوادم متوقفة', value: data.downServers, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', icon: '🖥️' },
      data.escalatedReferrals > 0 && { label: 'إحالات مصعّدة', value: data.escalatedReferrals, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', icon: '⬆️' },
      data.criticalVulns > 0 && { label: 'ثغرات حرجة', value: data.criticalVulns, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: '🔴' },
      data.criticalTickets > 0 && { label: 'تذاكر حرجة', value: data.criticalTickets, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: '🎫' },
      data.openIncidents > 0 && { label: 'حوادث مفتوحة', value: data.openIncidents, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: '🛡️' },
      data.unackReferrals > 0 && { label: 'إحالات بدون رد', value: data.unackReferrals, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25', icon: '📨' },
      data.overdueTasks > 0 && { label: 'مهام متأخرة', value: data.overdueTasks, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25', icon: '⏰' },
      data.overdueReferrals > 0 && { label: 'تجاوزت SLA', value: data.overdueReferrals, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25', icon: '⏱️' },
    ].filter(Boolean) as { label: string; value: number; color: string; bg: string; icon: string }[];
    return (
      <div className="grid grid-cols-2 gap-1.5 mt-3">
        {alertItems.slice(0, 6).map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
            className={`${item.bg} border rounded-xl p-2.5 text-center`}>
            <div className="text-lg mb-0.5">{item.icon}</div>
            <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{item.label}</div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── ACTIONABLE PRIORITY LIST ──
  if (intent === 'actionable' && data.actionItems) {
    if (data.actionItems.length === 0) return (
      <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
        <div className="text-2xl mb-1">🌟</div>
        <div className="text-xs text-green-300 font-medium">لا إجراءات عاجلة — وضع مثالي!</div>
      </div>
    );
    const badgeColors: Record<string, string> = {
      'عاجل جداً': 'bg-red-500/20 text-red-300 border-red-500/40',
      'عاجل': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      'مهم جداً': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      'ينتظر': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      'أولوية عالية': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      'متأخرة': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      'اليوم': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    };
    const urgencyBorder: Record<string, string> = {
      'عاجل جداً': 'border-r-red-500',
      'عاجل': 'border-r-orange-400',
      'مهم جداً': 'border-r-orange-400',
      'ينتظر': 'border-r-yellow-400',
      'أولوية عالية': 'border-r-yellow-400',
      'متأخرة': 'border-r-orange-400',
      'اليوم': 'border-r-blue-400',
    };
    return (
      <div className="mt-3 space-y-1.5">
        {data.actionItems.slice(0, 5).map((item: any, i: number) => (
          <motion.a key={i} href={item.href}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10 border-r-[3px] ${urgencyBorder[item.badge || ''] || 'border-r-white/15'} hover:bg-white/10 hover:border-white/20 transition-all group`}>
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold text-white/50 shrink-0">
              {i + 1}
            </div>
            <span className="text-base shrink-0">{item.emoji}</span>
            <span className="text-[12px] text-white/80 flex-1 leading-snug group-hover:text-white transition-colors">{item.text}</span>
            {item.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColors[item.badge] || 'bg-white/10 text-white/50 border-white/20'} shrink-0 whitespace-nowrap`}>{item.badge}</span>}
          </motion.a>
        ))}
      </div>
    );
  }

  // ── ALL DEPARTMENTS OVERVIEW ──
  if (intent === 'overall_departments' && data.departments) {
    return (
      <div className="mt-3 space-y-1.5">
        {data.departments.map((dept: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
            className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
            <span className="text-sm shrink-0">{dept.health}</span>
            <span className="text-[12px] text-white/80 flex-1 font-medium">{dept.name}</span>
            <div className="flex gap-1.5 shrink-0">
              {dept.openTickets > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{dept.openTickets} تذكرة</span>}
              {dept.overdueTasks > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">{dept.overdueTasks} متأخرة</span>}
              {dept.unackRefs > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">📨 {dept.unackRefs}</span>}
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── PRODUCTIVITY SCORE ──
  if (intent === 'productivity') {
    const score = data.score || 0;
    const scoreColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : score >= 40 ? 'text-orange-400' : 'text-red-400';
    const barColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500';
    return (
      <div className="mt-3 space-y-2">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className={`text-3xl font-bold ${scoreColor}`}>{score}<span className="text-base text-white/60">/100</span></div>
          <div className="text-[10px] text-white/60 mt-1">مؤشر الأداء الإجمالي</div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${barColor}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[11px] text-white/50">إنجاز المهام</div>
            <div className="text-base font-bold text-blue-400">{data.completionRate}%</div>
            <MiniProgress value={data.completionRate} max={100} color="bg-blue-500" />
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[11px] text-white/50">حل التذاكر</div>
            <div className="text-base font-bold text-purple-400">{data.ticketResolutionRate}%</div>
            <MiniProgress value={data.ticketResolutionRate} max={100} color="bg-purple-500" />
          </div>
        </div>
        {data.overdueTasks > 0 && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <span className="text-sm">⏰</span>
            <div>
              <div className="text-[11px] text-red-300 font-medium">{data.overdueTasks} مهمة متأخرة</div>
              <div className="text-[10px] text-white/60">تؤثر سلباً على الأداء</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SEARCH RESULTS ──
  if (intent === 'search') {
    if (data.total === 0) return (
      <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-center">
        <Search className="w-6 h-6 text-white/20 mx-auto mb-1" />
        <div className="text-xs text-white/60">لا نتائج لـ "{data.searchTerm}"</div>
      </div>
    );
    return (
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {data.results?.tickets > 0 && (
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-center">
            <div className="text-lg font-bold text-blue-400">{data.results.tickets}</div>
            <div className="text-[10px] text-white/50">تذاكر</div>
          </div>
        )}
        {data.results?.tasks > 0 && (
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-center">
            <div className="text-lg font-bold text-purple-400">{data.results.tasks}</div>
            <div className="text-[10px] text-white/50">مهام</div>
          </div>
        )}
        {data.results?.projects > 0 && (
          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/25 text-center">
            <div className="text-lg font-bold text-green-400">{data.results.projects}</div>
            <div className="text-[10px] text-white/50">مشاريع</div>
          </div>
        )}
      </div>
    );
  }

  // ── LIVE REFERRALS ──
  if (intent === 'live_referrals') {
    const cards = [
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '📤' },
      { label: 'معلقة', value: data.pending, color: 'text-yellow-400', icon: '⏳' },
      { label: 'منجزة', value: data.completed || 0, color: 'text-green-400', icon: '✅' },
    ];
    if (data.unacknowledged > 0) cards.push({ label: 'بدون تأكيد', value: data.unacknowledged, color: 'text-orange-400', icon: '📨' });
    if (data.escalated > 0) cards.push({ label: 'مصعّدة', value: data.escalated, color: 'text-red-400', icon: '⬆️' });
    if (data.overdue > 0) cards.push({ label: 'تجاوزت SLA', value: data.overdue, color: 'text-red-400', icon: '🔴' });
    return (
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {cards.slice(0, 6).map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
            <div className="text-base mb-0.5">{card.icon}</div>
            <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{card.label}</div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── GENERIC CARDS ──
  const cards: { label: string; value: number | string; color: string; icon: string }[] = [];

  if (intent === 'live_tickets') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🎫' },
      { label: 'مفتوحة', value: data.open, color: 'text-yellow-400', icon: '📂' },
      { label: 'قيد التنفيذ', value: data.inProgress || 0, color: 'text-purple-400', icon: '⚙️' },
    );
    if (data.critical > 0) cards.push({ label: 'حرجة', value: data.critical, color: 'text-red-400', icon: '🔴' });
  } else if (intent === 'live_tasks') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '✅' },
      { label: 'معلقة', value: data.pending, color: 'text-yellow-400', icon: '⏳' },
      { label: 'مكتملة', value: data.completed || 0, color: 'text-green-400', icon: '✔️' },
    );
    if ((data.overdue || 0) > 0) cards.push({ label: 'متأخرة', value: data.overdue, color: 'text-red-400', icon: '🔴' });
  } else if (intent === 'live_projects') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '📁' },
      { label: 'نشطة', value: data.active, color: 'text-green-400', icon: '🚀' },
      { label: 'مكتملة', value: data.completed || 0, color: 'text-purple-400', icon: '✅' },
    );
    if ((data.delayed || 0) > 0) cards.push({ label: 'متأخرة', value: data.delayed, color: 'text-red-400', icon: '⚠️' });
  } else if (intent === 'live_servers') {
    cards.push(
      { label: 'إجمالي', value: data.total, color: 'text-blue-400', icon: '🖥️' },
      { label: 'تعمل', value: data.online, color: 'text-green-400', icon: '🟢' },
      { label: 'متوقفة', value: data.offline, color: 'text-red-400', icon: '🔴' },
      { label: 'صيانة', value: data.maintenance || 0, color: 'text-yellow-400', icon: '🟡' },
    );
  } else if (intent === 'live_incidents') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🛡️' },
      { label: 'مفتوحة', value: data.open, color: 'text-yellow-400', icon: '🔍' },
      { label: 'محلولة', value: data.resolved, color: 'text-green-400', icon: '✅' },
    );
    if (data.critical > 0) cards.push({ label: 'حرجة', value: data.critical, color: 'text-red-400', icon: '🔴' });
  } else if (intent === 'my_day') {
    const ds = data.dailyScore || 0;
    const dsColor = ds >= 80 ? 'text-green-400' : ds >= 60 ? 'text-yellow-400' : ds >= 40 ? 'text-orange-400' : 'text-red-400';
    const dsBar = ds >= 80 ? 'bg-green-500' : ds >= 60 ? 'bg-yellow-500' : ds >= 40 ? 'bg-orange-500' : 'bg-red-500';
    return (
      <div className="mt-3 space-y-2">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className={`text-3xl font-bold ${dsColor}`}>{ds}<span className="text-base text-white/60">/100</span></div>
          <div className="text-[10px] text-white/60 mt-1">مؤشر يومك</div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${ds}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${dsBar}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
            <div className="text-[10px] text-white/60 mb-0.5">تذاكر مفتوحة</div>
            <div className="flex items-end gap-1.5">
              <span className="text-xl font-bold text-blue-400">{data.openTickets}</span>
              {data.urgentTickets > 0 && <span className="text-[10px] text-red-400 mb-0.5">⚠️ {data.urgentTickets} حرجة</span>}
            </div>
            <div className="text-[10px] text-white/50">اليوم {data.todayCreated || 0} جديدة • أمس {data.yesterdayCreated || 0}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
            <div className="text-[10px] text-white/60 mb-0.5">مهام اليوم</div>
            <div className="flex items-end gap-1.5">
              <span className="text-xl font-bold text-green-400">{data.todayTasks}</span>
              <span className="text-[10px] text-green-300/60 mb-0.5">أنجزت {data.todayCompleted || 0}</span>
            </div>
            <div className="text-[10px] text-white/50">أمس أنجزت {data.yesterdayCompleted || 0}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className={`p-2 rounded-xl text-center border ${data.overdueTasks > 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-white/5 border-white/10'}`}>
            <div className={`text-lg font-bold ${data.overdueTasks > 0 ? 'text-red-400' : 'text-green-400'}`}>{data.overdueTasks}</div>
            <div className="text-[10px] text-white/60">متأخرة</div>
          </div>
          <div className={`p-2 rounded-xl text-center border ${data.unackRefs > 0 ? 'bg-orange-500/10 border-orange-500/25' : 'bg-white/5 border-white/10'}`}>
            <div className={`text-lg font-bold ${data.unackRefs > 0 ? 'text-orange-400' : 'text-green-400'}`}>{data.unackRefs || 0}</div>
            <div className="text-[10px] text-white/60">إحالات بدون رد</div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#c9a84c]">{data.completionRate || 0}%</div>
            <div className="text-[10px] text-white/60">نسبة الإنجاز</div>
          </div>
        </div>
      </div>
    );
  } else if (intent === 'live_kpi') {
    cards.push(
      { label: 'تذاكر مفتوحة', value: data.tickets?.open || 0, color: 'text-yellow-400', icon: '🎫' },
      { label: 'مهام معلقة', value: data.tasks?.pending || 0, color: 'text-orange-400', icon: '✅' },
      { label: 'مشاريع نشطة', value: data.projects?.active || 0, color: 'text-blue-400', icon: '📁' },
    );
    if ((data.tasks?.overdue || 0) > 0)
      cards.push({ label: 'مهام متأخرة', value: data.tasks.overdue, color: 'text-red-400', icon: '🔴' });
  } else if (intent === 'live_meetings') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🗓️' },
      { label: 'قادمة', value: data.upcoming, color: 'text-green-400', icon: '📅' },
      { label: 'هذا الشهر', value: data.thisMonth, color: 'text-purple-400', icon: '📆' },
    );
  } else if (intent === 'live_voting') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🗳️' },
      { label: 'مفتوحة', value: data.active, color: 'text-yellow-400', icon: '⚡' },
      { label: 'موافق عليها', value: data.approved || 0, color: 'text-green-400', icon: '✅' },
      { label: 'مرفوضة', value: data.rejected || 0, color: 'text-red-400', icon: '❌' },
    );
  } else if (intent === 'live_users') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '👥' },
      { label: 'نشطون', value: data.active, color: 'text-green-400', icon: '🟢' },
      { label: 'غير نشطين', value: (data.total || 0) - (data.active || 0), color: 'text-gray-400', icon: '⚪' },
    );
  } else if (intent === 'live_vulnerabilities') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🔍' },
      { label: 'مفتوحة', value: data.open, color: 'text-yellow-400', icon: '⚠️' },
    );
    if (data.critical > 0) cards.push({ label: 'حرجة', value: data.critical, color: 'text-red-400', icon: '🔴' });
    if (data.high > 0) cards.push({ label: 'عالية', value: data.high, color: 'text-orange-400', icon: '🟠' });
  } else if (intent === 'quick_create') {
    if (data?.created) {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-3">
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-sm font-medium text-green-300 mb-1">{data.type === 'ticket' ? 'تذكرة جديدة' : 'مهمة جديدة'}</div>
            <div className="text-xs text-white/60 mb-1">{data.title}</div>
            {data.refNumber && <div className="text-[10px] text-[#c9a84c] font-mono">{data.refNumber}</div>}
          </div>
        </motion.div>
      );
    }
    return null;
  } else if (intent === 'dept_compare') {
    if (data?.departments) {
      return (
        <div className="mt-3 space-y-1.5">
          {data.departments.map((dept: any, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
            const scoreColor2 = dept.score >= 70 ? 'text-green-400' : dept.score >= 50 ? 'text-yellow-400' : 'text-red-400';
            const barColor2 = dept.score >= 70 ? 'bg-green-500' : dept.score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            return (
              <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{medal}</span>
                  <span className="text-xs text-white/80 font-medium flex-1">{dept.name}</span>
                  <span className={"text-sm font-bold " + scoreColor2}>{dept.score}/100</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1.5">
                  <motion.div initial={{ width: 0 }} animate={{ width: dept.score + '%' }} transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={"h-full rounded-full " + barColor2} />
                </div>
                <div className="flex gap-2 text-[10px] text-white/60">
                  <span>📋 مهام: {dept.taskRate}%</span>
                  <span>🎫 تذاكر: {dept.ticketRate}%</span>
                  {dept.overdueTasks > 0 && <span className="text-red-400">⏰ {dept.overdueTasks}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    }
    return null;
  } else if (intent === 'smart_recommend') {
    if (data?.recommendations) {
      const catColors: Record<string, string> = {
        'عاجل': 'border-red-500/30 bg-red-500/10',
        'تحسين': 'border-yellow-500/25 bg-yellow-500/10',
        'استراتيجي': 'border-blue-500/25 bg-blue-500/10',
        'تطوير': 'border-green-500/25 bg-green-500/10',
        'تنظيم': 'border-purple-500/25 bg-purple-500/10',
        'نصيحة': 'border-[#c9a84c]/25 bg-[#c9a84c]/10',
        'قيادي': 'border-indigo-500/25 bg-indigo-500/10',
        'أمني': 'border-red-500/25 bg-red-500/10',
        'وقائي': 'border-orange-500/25 bg-orange-500/10',
        'امتثال': 'border-blue-500/25 bg-blue-500/10',
        'خدمة': 'border-teal-500/25 bg-teal-500/10',
      };
      return (
        <div className="mt-3 space-y-1.5">
          {data.stats && (
            <div className="grid grid-cols-4 gap-1 mb-2">
              {[
                { label: 'إنجاز المهام', value: `${data.stats.taskRate}%`, color: data.stats.taskRate >= 60 ? 'text-green-400' : 'text-yellow-400' },
                { label: 'حل التذاكر', value: `${data.stats.ticketRate}%`, color: data.stats.ticketRate >= 60 ? 'text-green-400' : 'text-yellow-400' },
                { label: 'تذاكر مفتوحة', value: data.stats.openTickets, color: data.stats.openTickets > 20 ? 'text-red-400' : 'text-blue-400' },
                { label: 'متأخرة', value: data.stats.overdueTasks, color: data.stats.overdueTasks > 0 ? 'text-red-400' : 'text-green-400' },
              ].map((s, i) => (
                <div key={i} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[8px] text-white/50 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {data.recommendations.slice(0, 6).map((rec: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={"p-2.5 rounded-xl border " + (catColors[rec.category] || 'border-white/10 bg-white/5')}>
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">{rec.emoji}</span>
                <div className="flex-1">
                  <span className="text-[11px] text-white/70 leading-snug">{rec.text}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-white/60">{rec.category}</span>
                    {rec.impact && <span className="text-[9px] text-white/40 italic">↳ {rec.impact}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }
    return null;
  } else if (intent === 'greeting') {
    if (data) {
      const healthLevel = data.criticalTickets > 0 ? 'critical' :
        (data.overdueTasks > 3 || data.pendingRefs > 2) ? 'warning' : 'good';
      const healthBar = healthLevel === 'critical' ? 'bg-red-500' : healthLevel === 'warning' ? 'bg-yellow-400' : 'bg-green-500';
      const healthLabel = healthLevel === 'critical' ? '🔴 يحتاج تدخل فوري' : healthLevel === 'warning' ? '🟡 يحتاج متابعة' : '🟢 وضع جيد';
      const healthBg = healthLevel === 'critical' ? 'bg-red-500/10 border-red-500/20' : healthLevel === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20';
      const healthText = healthLevel === 'critical' ? 'text-red-400' : healthLevel === 'warning' ? 'text-yellow-400' : 'text-green-400';

      const items = [
        data.criticalTickets > 0 && { label: 'تذاكر حرجة', value: data.criticalTickets, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', icon: '🔴' },
        data.overdueTasks > 0 && { label: 'مهام متأخرة', value: data.overdueTasks, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: '⏰' },
        data.openTickets > 0 && { label: 'تذاكر مفتوحة', value: data.openTickets, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', icon: '🎫' },
        data.pendingRefs > 0 && { label: 'إحالات معلقة', value: data.pendingRefs, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25', icon: '📨' },
        data.completedToday > 0 && { label: 'منجز اليوم', value: data.completedToday, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/25', icon: '✅' },
      ].filter(Boolean) as any[];

      return (
        <div className="mt-3 space-y-2">
          {/* Department health bar */}
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border ${healthBg}`}>
            <span className={`text-[11px] font-semibold ${healthText}`}>{healthLabel}</span>
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: healthLevel === 'critical' ? '90%' : healthLevel === 'warning' ? '55%' : '25%' }}
                transition={{ duration: 0.6, delay: 0.2 }} className={`h-full rounded-full ${healthBar}`} />
            </div>
          </motion.div>
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {items.slice(0, 6).map((item: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
                  className={`${item.bg} border rounded-xl p-2 text-center`}>
                  <div className="text-base mb-0.5">{item.icon}</div>
                  <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{item.label}</div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  } else if (intent === 'team_load') {
    return (
      <div className="mt-3 space-y-2">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className="text-sm mb-1">{data.loadStatus === 'heavy' ? '🔴' : data.loadStatus === 'medium' ? '🟡' : '🟢'}</div>
          <div className={`text-2xl font-bold ${data.loadStatus === 'heavy' ? 'text-red-400' : data.loadStatus === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.totalOpenItems}
          </div>
          <div className="text-[10px] text-white/60 mt-0.5">بند نشط</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-center">
            <div className="text-lg font-bold text-blue-400">{data.activeTickets}</div>
            <div className="text-[10px] text-white/60">تذاكر نشطة</div>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-center">
            <div className="text-lg font-bold text-purple-400">{data.activeTasks}</div>
            <div className="text-[10px] text-white/60">مهام جارية</div>
          </div>
          <div className={`p-2 rounded-xl text-center border ${data.overdueTasks > 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-white/5 border-white/10'}`}>
            <div className={`text-lg font-bold ${data.overdueTasks > 0 ? 'text-red-400' : 'text-green-400'}`}>{data.overdueTasks}</div>
            <div className="text-[10px] text-white/60">متأخرة</div>
          </div>
        </div>
      </div>
    );
  } else if (intent === 'sla_status') {
    return (
      <div className="mt-3 space-y-2">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className={"text-3xl font-bold " + (data.slaCompliance >= 90 ? 'text-green-400' : data.slaCompliance >= 75 ? 'text-yellow-400' : 'text-red-400')}>
            {data.slaCompliance}%
          </div>
          <div className="text-[10px] text-white/60 mt-1">التزام SLA</div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
            <motion.div initial={{ width: 0 }} animate={{ width: data.slaCompliance + '%' }} transition={{ duration: 0.8, ease: 'easeOut' }}
              className={"h-full rounded-full " + (data.slaCompliance >= 90 ? 'bg-green-500' : data.slaCompliance >= 75 ? 'bg-yellow-500' : 'bg-red-500')} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className={"p-2 rounded-xl text-center border " + (data.breachedTickets > 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-white/5 border-white/10')}>
            <div className={"text-lg font-bold " + (data.breachedTickets > 0 ? 'text-red-400' : 'text-green-400')}>{data.breachedTickets}</div>
            <div className="text-[10px] text-white/60">تجاوزت SLA</div>
          </div>
          <div className={"p-2 rounded-xl text-center border " + (data.nearBreachTickets > 0 ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-white/5 border-white/10')}>
            <div className={"text-lg font-bold " + (data.nearBreachTickets > 0 ? 'text-yellow-400' : 'text-green-400')}>{data.nearBreachTickets}</div>
            <div className="text-[10px] text-white/60">قريبة من الخرق</div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-lg font-bold text-blue-400">{data.openTickets}</div>
            <div className="text-[10px] text-white/60">مفتوحة</div>
          </div>
        </div>
      </div>
    );
  } else if (intent === 'weekly_summary') {
    return (
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
            <div className="text-[10px] text-white/60 mb-0.5">تذاكر هذا الأسبوع</div>
            <div className="flex items-end gap-1">
              <span className="text-xl font-bold text-blue-400">{data.thisWeekCreated}</span>
              {data.trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5 text-red-400 mb-0.5" /> : data.trend === 'down' ? <ArrowDownRight className="w-3.5 h-3.5 text-green-400 mb-0.5" /> : null}
            </div>
            <div className="text-[10px] text-white/50">{data.lastWeekCreated} الأسبوع الماضي</div>
          </div>
          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/25">
            <div className="text-[10px] text-white/60 mb-0.5">تذاكر حُلّت</div>
            <div className="text-xl font-bold text-green-400">{data.thisWeekResolved}</div>
            <div className="text-[10px] text-white/50">{data.lastWeekResolved} الأسبوع الماضي</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
          <div className="text-[10px] text-white/60 mb-1">إنجاز المهام</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-[#c9a84c]">{data.taskCompletionRate}%</div>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.taskCompletionRate}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${data.taskCompletionRate >= 80 ? 'bg-green-500' : data.taskCompletionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
              />
            </div>
          </div>
          {data.overdueTasks > 0 && <div className="text-[10px] text-red-400 mt-1">⏰ {data.overdueTasks} مهمة متأخرة</div>}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-center">
            <div className="text-base font-bold text-purple-400">{data.activeProjects}</div>
            <div className="text-[10px] text-white/60">مشاريع نشطة</div>
          </div>
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/25 text-center">
            <div className="text-base font-bold text-teal-400">{data.completedRefs}</div>
            <div className="text-[10px] text-white/60">إحالات منجزة</div>
          </div>
        </div>
      </div>
    );
  } else if (intent === 'my_tickets') {
    cards.push(
      { label: 'الإجمالي', value: data.total, color: 'text-blue-400', icon: '🎫' },
      { label: 'مفتوحة', value: data.open, color: 'text-yellow-400', icon: '📂' },
      { label: 'قيد التنفيذ', value: data.inProgress || 0, color: 'text-purple-400', icon: '⚙️' },
    );
    if (data.critical > 0) cards.push({ label: 'حرجة', value: data.critical, color: 'text-red-400', icon: '🔴' });
    if (data.breached > 0) cards.push({ label: 'تجاوزت SLA', value: data.breached, color: 'text-red-400', icon: '⏱️' });
  } else {
    return null;
  }

  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5 mt-3">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition-colors"
        >
          <div className="text-xl mb-0.5">{card.icon}</div>
          <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{card.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Smart Thinking indicator ────────────────────────────────────────────────
const THINKING_MESSAGES = [
  'جاري البحث في البيانات الحية...',
  'أحلّل المعطيات...',
  'أستعرض سجلات النظام...',
  'أجمع الأرقام...',
  'أحسب المؤشرات...',
  'أفحص الإحالات والتذاكر...',
  'أتحقق من حالة الأمتثال...',
  'أفحص مستويات SLA...',
];
function TypingIndicator({ query }: { query?: string }) {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % THINKING_MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);
  const q = (query || '').toLowerCase();
  const contextMsg =
    q.includes('تنبيه') || q.includes('تحذير') ? 'أفحص التنبيهات الحرجة...' :
    q.includes('تذكرة') || q.includes('تذاكر') ? 'أحصي التذاكر وأحالتها...' :
    q.includes('مهمة') || q.includes('مهام') ? 'أستعرض المهام والمواعيد...' :
    q.includes('مشروع') ? 'أفحص تقدم المشاريع...' :
    q.includes('سيرفر') || q.includes('خادم') ? 'أتحقق من حالة الخوادم...' :
    q.includes('امتثال') || q.includes('ecc') || q.includes('ndmo') ? 'أتحقق من بيانات الامتثال...' :
    q.includes('إحالة') || q.includes('إحالات') ? 'أفحص الإحالات وحالة SLA...' :
    q.includes('أسبوع') || q.includes('weekly') ? 'أقارن أداء الأسبوعين...' :
    q.includes('يوم') || q.includes('ملخص') ? 'أعدّ ملخصك اليومي...' :
    THINKING_MESSAGES[msgIndex];
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#e6c86e] flex items-center justify-center shrink-0 shadow-lg">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
          <Sparkles className="w-4 h-4 text-[#0a1628]" />
        </motion.div>
      </div>
      <div className="bg-white/10 border border-white/15 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 items-center">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.0, delay: i * 0.2 }}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={contextMsg}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-[11px] text-white/50 italic"
            >
              {contextMsg}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onSuggestionClick, onCopy, onReact, isExpanded, isLatest }: {
  msg: Message;
  onSuggestionClick: (s: string) => void;
  onCopy: (id: string, text: string) => void;
  onReact: (id: string, reaction: 'liked' | 'disliked') => void;
  isExpanded: boolean;
  isLatest: boolean;
}) {
  const isUser = msg.role === 'user';
  const [textDone, setTextDone] = useState(!isLatest || isUser);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg ${isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-[#c9a84c] to-[#e6c86e]'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-[#0a1628]" />}
      </div>
      <div className={`${isExpanded ? 'max-w-[80%]' : 'max-w-[85%]'} ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 relative group ${isUser
          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm'
          : 'bg-white/10 border border-white/15 text-white/90 rounded-bl-sm backdrop-blur-sm'
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{msg.content}</p>
          ) : (
            <div className="space-y-0.5">
              {isLatest && !textDone
                ? <TypewriterText text={msg.content} onComplete={() => setTextDone(true)} />
                : formatContent(msg.content)}
            </div>
          )}
          {!isUser && (
            <button
              onClick={() => onCopy(msg.id, msg.content)}
              className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
              title="نسخ"
            >
              {msg.copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/50" />}
            </button>
          )}
        </div>

        {!isUser && msg.data && <DataCard data={msg.data} intent={msg.intent} />}

        {!isUser && msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.actions.map((action, i) => {
              const isAskAction = action.href?.startsWith('#ask:');
              const askQuery = isAskAction ? decodeURIComponent(action.href.replace('#ask:', '')) : '';
              return isAskAction ? (
                <Button key={i} size="sm" variant="outline" onClick={() => onSuggestionClick(askQuery)}
                  className="h-7 text-xs border-[#c9a84c]/40 text-[#c9a84c] hover:bg-[#c9a84c]/10 gap-1">
                  <Zap className="w-3 h-3" />
                  {action.label}
                </Button>
              ) : (
                <a key={i} href={action.href}>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-[#c9a84c]/40 text-[#c9a84c] hover:bg-[#c9a84c]/10 gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {action.label}
                  </Button>
                </a>
              );
            })}
          </div>
        )}

        {!isUser && msg.links && msg.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.links.map((link, i) => (
              <a key={i} href={link.href}>
                <Badge variant="outline" className="text-xs border-white/20 text-white/60 hover:text-white hover:border-white/40 cursor-pointer gap-1">
                  <ChevronRight className="w-2.5 h-2.5" />
                  {link.text}
                </Badge>
              </a>
            ))}
          </div>
        )}

        {!isUser && (textDone || !isLatest) && msg.suggestions && msg.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {msg.suggestions.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                onClick={() => onSuggestionClick(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-[#c9a84c]/30 text-[#c9a84c]/80 hover:bg-[#c9a84c]/10 hover:text-[#c9a84c] hover:border-[#c9a84c]/60 transition-all"
              >
                {s}
              </motion.button>
            ))}
          </div>
        )}

        {/* Reactions + timestamp */}
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="text-[10px] text-white/25">
            {msg.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (textDone || !isLatest) && msg.intent !== 'welcome' && (
            <div className="flex items-center gap-1 mr-auto">
              <button
                onClick={() => onReact(msg.id, 'liked')}
                className={`p-1 rounded-md transition-all ${msg.reaction === 'liked' ? 'bg-green-500/20 text-green-400' : 'text-white/20 hover:text-green-400 hover:bg-green-500/10'}`}
                title="مفيد"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onReact(msg.id, 'disliked')}
                className={`p-1 rounded-md transition-all ${msg.reaction === 'disliked' ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-red-400 hover:bg-red-500/10'}`}
                title="غير مفيد"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Quick Chips Panel ────────────────────────────────────────────────────────
function QuickChipsPanel({ portal, onSelect }: { portal: string; onSelect: (q: string) => void }) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);
  const chips = PORTAL_CHIPS[portal] || PORTAL_CHIPS.admin;
  const filtered = activeCategory === 'all' ? chips : chips.filter(c => c.category === activeCategory);
  const visibleChips = expanded ? filtered : filtered.slice(0, 6);
  const availableCategories = ['action', 'alerts', 'live', 'compliance', 'help'].filter(cat =>
    chips.some(c => c.category === cat)
  );
  const categories = [
    { key: 'all', label: 'الكل', icon: '✨' },
    { key: 'action', label: 'إجراءات', icon: '🎯' },
    { key: 'alerts', label: 'تنبيهات', icon: '⚠️' },
    { key: 'live', label: 'بيانات', icon: '📊' },
    { key: 'compliance', label: 'امتثال', icon: '📋' },
    { key: 'help', label: 'مساعدة', icon: '❓' },
  ].filter(cat => cat.key === 'all' || availableCategories.includes(cat.key));

  return (
    <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent px-3 pt-2 pb-2">
      <div className="flex gap-1.5 mb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setExpanded(false); }}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
              activeCategory === cat.key
                ? 'bg-[#c9a84c]/20 border-[#c9a84c]/60 text-[#c9a84c] font-medium'
                : 'border-white/15 text-white/60 hover:text-white/70 hover:border-white/30'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
      <AnimatePresence>
        <div className="flex gap-1.5 flex-wrap">
          {visibleChips.map((chip, i) => (
            <motion.button
              key={chip.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelect(chip.label)}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1 ${CHIP_CATEGORY_COLORS[chip.category]}`}
            >
              <span className="text-xs">{chip.icon}</span>
              {chip.label}
            </motion.button>
          ))}
          {filtered.length > 6 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] px-2.5 py-1.5 rounded-full border border-white/15 text-white/50 hover:text-white/60 hover:border-white/30 transition-all"
            >
              {expanded ? 'أقل ▲' : `+${filtered.length - 6} أكثر ▼`}
            </button>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SmartAssistant() {
  const { user } = useAuth();
  const [location] = useLocation();
  const portal = detectPortal(location);
  const userName = (user as any)?.name || '';

  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Fetch unread notification count for badge
  const { data: notifData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: () => apiFetch('/api/notifications/unread-count'),
    refetchInterval: 60000,
    enabled: !!user,
    retry: false,
  });
  const unreadCount = (notifData as any)?.count || 0;

  // Restore messages from session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`mojeeb-messages-${portal}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const restored = parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
        if (restored.length > 0) setMessages(restored);
      }
    } catch {}
  }, [portal]);

  // Save messages to session
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toSave = messages.slice(-20).map(m => ({ ...m, copied: false }));
        sessionStorage.setItem(`mojeeb-messages-${portal}`, JSON.stringify(toSave));
      } catch {}
    }
  }, [messages, portal]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const chips = PORTAL_CHIPS[portal] || PORTAL_CHIPS.admin;
      const hour = new Date().getHours();
      const timeGreet = hour < 12 ? '☀️ صباح النور' : hour < 18 ? '🌤️ مرحباً' : '🌙 مساء الخير';
      const portalCtx: Record<string, string> = {
        cybersecurity: 'أنا هنا لمساعدتك في مراقبة الحوادث، الثغرات، ومستوى الامتثال الأمني.',
        infrastructure: 'أتابع معك حالة الخوادم، التذاكر المفتوحة، وعبء الفريق.',
        dmo: 'أساعدك في متابعة طلبات DSR، الامتثال لـ NDMO، وجودة البيانات.',
        support: 'أتابع تذاكر الدعم، الإحالات الواردة، ومستوى SLA معك.',
        digital_transformation: 'أتابع مشاريعك الرقمية، معايير DGA، وإنتاجية الفريق.',
        it_director: 'أقدم لك نظرة شاملة على جميع الأقسام والمؤشرات التنفيذية.',
        committee: 'أتابع اجتماعات اللجنة، جلسات التصويت، والقرارات المعلقة.',
        admin: 'أساعدك في إدارة المنصة، المستخدمين، والتنبيهات العامة.',
      };
      const welcome: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `${timeGreet} يا ${userName || 'مستخدم'}! 👋\n\nأنا **مجيب** — مساعدك الذكي في مركز التحكم JCSA.\n\n${portalCtx[portal] || 'أقدم لك معلومات دقيقة من البيانات الحية.'}\n\n**ما أقدر أساعدك فيه:**\n• 📊 بيانات حية: تذاكر، مهام، مشاريع، خوادم\n• ⚠️ تنبيهات وأولويات عاجلة\n• 📋 ضوابط الامتثال: NCA، NDMO، DGA\n• ⏱️ حالة SLA والإحالات بين الأقسام\n• 📅 ملخص يومي وأسبوعي مقارن\n\n💡 اسألني بالعربية أو اختر من الاقتراحات أدناه:`,
        timestamp: new Date(),
        intent: 'welcome',
        suggestions: chips.filter(c => c.category === 'action' || c.category === 'alerts').slice(0, 4).map(c => c.label),
      };
      setMessages([welcome]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: true } : m));
    setTimeout(() => setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: false } : m)), 2000);
  }, []);

  const handleReact = useCallback((id: string, reaction: 'liked' | 'disliked') => {
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m;
      return { ...m, reaction: m.reaction === reaction ? null : reaction };
    }));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setCurrentQuery(text.trim());
    setLoading(true);

    try {
      const localAnswer = getLocalKnowledge(text);
      if (localAnswer) {
        const links = getLinksForQuery(text, portal);
        await new Promise(r => setTimeout(r, 350));
        const chips = PORTAL_CHIPS[portal] || PORTAL_CHIPS.admin;
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: localAnswer,
          timestamp: new Date(),
          intent: 'knowledge',
          links,
          suggestions: chips.filter(c => c.category === 'compliance').slice(0, 3).map(c => c.label),
        }]);
        setLoading(false);
        if (!open) setHasNewMsg(true);
        return;
      }

      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const response = await apiFetch('/api/smart/mojeeb', {
        method: 'POST',
        body: JSON.stringify({ query: text, portal, history }),
      });

      const chips = PORTAL_CHIPS[portal] || PORTAL_CHIPS.admin;
      const suggestions = response.suggestions?.length
        ? response.suggestions
        : chips.slice(0, 3).map(c => c.label);

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.content || 'عذراً، لم أتمكن من فهم سؤالك. جرّب صياغة مختلفة.',
        timestamp: new Date(),
        intent: response.intent,
        data: response.data,
        links: response.links,
        suggestions,
        actions: response.actions,
      }]);
      if (!open) setHasNewMsg(true);
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'عذراً، حدث خطأ في الاتصال. تأكد من تسجيل الدخول وحاول مرة أخرى.',
        timestamp: new Date(),
        suggestions: ['ملخص يومي', 'التذاكر المفتوحة'],
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, messages, portal, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'ar-SA';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(`mojeeb-messages-${portal}`);
    setTimeout(() => {
      const chips = PORTAL_CHIPS[portal] || PORTAL_CHIPS.admin;
      setMessages([{
        id: 'welcome-reset',
        role: 'assistant',
        content: `تم مسح المحادثة. كيف يمكنني مساعدتك يا ${userName || 'مستخدم'}؟`,
        timestamp: new Date(),
        intent: 'welcome',
        suggestions: chips.filter(c => c.category === 'action' || c.category === 'alerts').slice(0, 3).map(c => c.label),
      }]);
    }, 100);
  }, [userName, portal]);

  const portalColor = PORTAL_COLORS[portal] || 'from-[#c9a84c] to-[#e6c86e]';
  const windowStyle = isExpanded
    ? { width: 'min(780px, 95vw)', height: 'min(85vh, 800px)' }
    : { width: '390px', height: '620px' };
  const latestBotId = [...messages].reverse().find(m => m.role === 'assistant')?.id;

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { setOpen(true); setHasNewMsg(false); }}
            className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-[#c9a84c] to-[#e6c86e] hover:from-[#b8973b] hover:to-[#d5b75d] transition-colors"
            data-testid="mojeeb-open-btn"
          >
            {/* Animated ring when new message */}
            {hasNewMsg && (
              <span className="absolute inset-0 rounded-full bg-[#c9a84c]/40 animate-ping" />
            )}
            <Bot className="w-6 h-6 text-[#0a1628] relative z-10" />
            {/* Unread notification badge */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-[#0a1628] flex items-center justify-center text-[10px] font-bold text-white px-1 z-20"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
            {/* New AI message dot */}
            {hasNewMsg && !unreadCount && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white z-20" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Window ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{
              ...windowStyle,
              background: 'linear-gradient(135deg, #0d1e3d 0%, #0a1628 60%, #061020 100%)',
              transition: 'width 0.3s ease, height 0.3s ease',
            }}
            data-testid="mojeeb-window"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${portalColor} flex items-center justify-center shadow-lg ring-2 ring-white/10`}>
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a1628] ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">مجيب</h3>
                    <Sparkles className="w-3 h-3 text-[#c9a84c]" />
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/25 font-medium">
                      {messages.length > 1 ? `${messages.length - 1} رسالة` : 'AI'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/45 mt-0.5">
                    {PORTAL_LABELS[portal] || 'المساعد الذكي'}
                    {' · '}
                    {loading
                      ? <span className="text-[#c9a84c]/80 animate-pulse">يعالج الطلب...</span>
                      : <span className="text-green-400/70">متصل</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Quick search button */}
                <button
                  onClick={() => { setInput('ابحث عن '); inputRef.current?.focus(); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/70 transition-colors"
                  title="بحث"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearHistory}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/70 transition-colors"
                  title="مسح المحادثة"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/70 transition-colors"
                  title={isExpanded ? 'تصغير' : 'تكبير'}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Chips */}
            <QuickChipsPanel portal={portal} onSelect={sendMessage} />

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
            >
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onSuggestionClick={s => sendMessage(s)}
                    onCopy={handleCopy}
                    onReact={handleReact}
                    isExpanded={isExpanded}
                    isLatest={msg.id === latestBotId}
                  />
                ))}
              </AnimatePresence>
              {loading && <TypingIndicator query={currentQuery} />}
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-white/10 bg-white/5 shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      portal === 'cybersecurity' ? 'اسألني: الثغرات الحرجة؟ نسبة ECC؟ الحوادث الأمنية؟' :
                      portal === 'infrastructure' ? 'اسألني: حالة الخوادم؟ المهام المتأخرة؟ عبء الفريق؟' :
                      portal === 'dmo' ? 'اسألني: DSR المعلقة؟ نسبة NDMO؟ تصنيف البيانات؟' :
                      portal === 'support' ? 'اسألني: تذاكري؟ حالة SLA؟ الإحالات الواردة؟' :
                      portal === 'it_director' ? 'اسألني: وضع الأقسام؟ ملخص الأسبوع؟ KPI التنفيذي؟' :
                      portal === 'committee' ? 'اسألني: الاجتماعات القادمة؟ جلسات التصويت؟' :
                      'اسألني: التنبيهات؟ ملخص يومي؟ ماذا أفعل الآن؟ ابحث عن...'
                    }
                    rows={1}
                    className="resize-none bg-white/10 border-white/20 text-white placeholder-white/30 text-sm rounded-xl min-h-[42px] max-h-[100px] py-2.5 px-3 focus:border-[#c9a84c]/50 focus:ring-[#c9a84c]/20 pr-3"
                    data-testid="mojeeb-input"
                    style={{ direction: 'rtl' }}
                    disabled={loading}
                  />
                </div>
                {((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ? (
                  <button
                    onClick={toggleVoice}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${listening
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                      : 'bg-white/10 border border-white/20 text-white/50 hover:text-white hover:bg-white/15'
                    }`}
                    title={listening ? 'إيقاف الاستماع' : 'الإدخال الصوتي'}
                  >
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                ) : null}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#c9a84c] to-[#e6c86e] text-[#0a1628] hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 shadow-lg"
                  data-testid="mojeeb-send"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[9px] text-white/20">Enter للإرسال • Shift+Enter لسطر جديد</p>
                {input.length > 0 && <p className="text-[9px] text-white/20">{input.length}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SmartAssistant;
