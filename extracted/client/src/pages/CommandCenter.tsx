import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Shield, Activity, Server, AlertTriangle, CheckCircle2,
  Clock, Users, Ticket, Zap, Globe, Database, Cpu,
  TrendingUp, TrendingDown, Minus,
  AlertCircle, Lock, Eye, FileCheck, BarChart3,
  Radio, Layers, ShieldAlert, Bug,
  ArrowLeft, Maximize2, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display.toLocaleString("ar-SA")}</>;
}

// ─── Pulse Dot ───────────────────────────────────────────────────────────────
function PulseDot({ color = "emerald", size = 2 }: { color?: string; size?: number }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-400",
    red: "bg-red-400",
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    gold: "bg-yellow-400",
    slate: "bg-slate-400",
  };
  const pingColors: Record<string, string> = {
    emerald: "bg-emerald-400",
    red: "bg-red-400",
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    gold: "bg-yellow-400",
    slate: "bg-slate-400",
  };
  const s = `w-${size} h-${size}`;
  return (
    <span className="relative flex shrink-0" style={{ width: size * 4, height: size * 4 }}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingColors[color]} opacity-60`} />
      <span className={`relative inline-flex rounded-full ${s} ${colors[color]}`} style={{ width: size * 4, height: size * 4 }} />
    </span>
  );
}

// ─── SVG Ring Gauge ──────────────────────────────────────────────────────────
function RingGauge({ value, color, size = 80, strokeWidth = 7, label }: {
  value: number; color: string; size?: number; strokeWidth?: number; label?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const cx = size / 2, cy = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white leading-none">{value}%</span>
        {label && <span className="text-[9px] text-white/50 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

// ─── Live Clock ──────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = time.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const d = time.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="text-right">
      <div className="font-mono text-2xl font-bold text-white tracking-widest" style={{ fontVariantNumeric: "tabular-nums" }}>{t}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{d}</div>
    </div>
  );
}

// ─── Dept Health Card ────────────────────────────────────────────────────────
const DEPT_CONFIG = [
  { key: "infrastructure", label: "البنية التحتية", icon: Server, href: "/department/infrastructure", color: "#3b82f6" },
  { key: "cybersecurity", label: "الأمن السيبراني", icon: Shield, href: "/department/cybersecurity", color: "#ef4444" },
  { key: "digital_transformation", label: "التحول الرقمي", icon: Zap, href: "/department/digital-transformation", color: "#a855f7" },
  { key: "support", label: "الدعم الفني", icon: Activity, href: "/department/support", color: "#22c55e" },
  { key: "dmo", label: "إدارة البيانات", icon: Database, href: "/dmo", color: "#f59e0b" },
  { key: "committee", label: "اللجان", icon: Users, href: "/committee", color: "#06b6d4" },
];

type DeptHealth = { status: "good" | "warning" | "critical" | "unknown"; score: number; openTickets: number; openTasks: number };

function DeptHealthCard({ dept, health, delay = 0 }: { dept: typeof DEPT_CONFIG[0]; health: DeptHealth; delay?: number }) {
  const statusColor = health.status === "good" ? "emerald" : health.status === "warning" ? "amber" : health.status === "unknown" ? "slate" : "red";
  const statusLabel = health.status === "good" ? "سليم" : health.status === "warning" ? "تحذير" : health.status === "unknown" ? "—" : "حرج";
  const Icon = dept.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-3.5 overflow-hidden group hover:border-white/20 transition-all duration-300 cursor-pointer"
    >
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 50% 0%, ${dept.color}18 0%, transparent 70%)` }} />

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${dept.color}20`, border: `1px solid ${dept.color}40` }}>
            <Icon className="w-4 h-4" style={{ color: dept.color }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-white leading-tight">{dept.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <PulseDot color={statusColor} size={2} />
          <span className={`text-[10px] font-medium ${statusColor === "emerald" ? "text-emerald-400" : statusColor === "amber" ? "text-amber-400" : "text-red-400"}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Ticket className="w-3 h-3 text-white/40" />
            <span className="text-[11px] text-white/60">{health.openTickets} تذكرة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-white/40" />
            <span className="text-[11px] text-white/60">{health.openTasks} مهمة</span>
          </div>
        </div>
        <RingGauge value={health.score} color={dept.color} size={56} strokeWidth={5} />
      </div>
    </motion.div>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────
const ACTION_ICONS: Record<string, typeof Eye> = {
  create: CheckCircle2, update: RefreshCw, delete: AlertCircle,
  login: Eye, logout: Lock, export: FileCheck, default: Activity,
};
const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-400", update: "text-blue-400", delete: "text-red-400",
  login: "text-purple-400", logout: "text-slate-400", export: "text-amber-400", default: "text-white/60",
};

function ActivityItem({ log, index }: { log: any; index: number }) {
  const action = log.action?.toLowerCase()?.split("_")[0] || "default";
  const Icon = ACTION_ICONS[action] || ACTION_ICONS.default;
  const color = ACTION_COLORS[action] || ACTION_COLORS.default;
  const ago = (() => {
    const d = new Date(log.createdAt);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "الآن";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
    return d.toLocaleDateString("ar-SA");
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-2.5 py-2 border-b border-white/5 last:border-0"
    >
      <div className="mt-0.5 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
        <Icon className={`w-3 h-3 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-white/80 leading-tight truncate">
          {log.description || `${log.action} — ${log.entityType || ""}`}
        </p>
        <p className="text-[10px] text-white/35 mt-0.5">{log.userName || "النظام"} · {ago}</p>
      </div>
    </motion.div>
  );
}

// ─── Server Status Grid ───────────────────────────────────────────────────────
function ServerGrid({ servers }: { servers: any[] }) {
  if (!servers.length) {
    return <p className="text-xs text-white/30 text-center py-4">لا توجد خوادم مسجلة</p>;
  }
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {servers.slice(0, 24).map((s: any, i: number) => {
        const status = s.status?.toLowerCase() || "unknown";
        const color = status === "active" || status === "online" ? "bg-emerald-400" :
          status === "maintenance" ? "bg-amber-400" :
          status === "down" || status === "offline" || status === "error" ? "bg-red-400" : "bg-slate-500";
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            title={`${s.name} — ${s.status}`}
            className={`w-full aspect-square rounded-sm ${color} opacity-80 hover:opacity-100 transition-opacity cursor-default`}
            style={{ boxShadow: status === "active" || status === "online" ? "0 0 6px rgba(52,211,153,0.5)" : "none" }}
          />
        );
      })}
    </div>
  );
}

// ─── Big Metric Card ──────────────────────────────────────────────────────────
function BigMetricCard({ label, value, icon: Icon, color, trend, unit = "", delay = 0 }: {
  label: string; value: number; icon: typeof Activity;
  color: string; trend?: "up" | "down" | "stable"; unit?: string; delay?: number;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-white/30";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="relative rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4 overflow-hidden"
    >
      <div className="absolute inset-0 rounded-xl"
        style={{ background: `radial-gradient(circle at 100% 100%, ${color}12 0%, transparent 60%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] text-white/50 font-medium">{label}</p>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white leading-none">
            <AnimatedCounter value={value} />
          </span>
          {unit && <span className="text-xs text-white/40 mb-1">{unit}</span>}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span className="text-[10px]">{trend === "up" ? "ارتفاع" : trend === "down" ? "انخفاض" : "ثابت"}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ count, label, color }: { count: number; label: string; color: "red" | "amber" }) {
  if (count === 0) return null;
  const bg = color === "red" ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30";
  const text = color === "red" ? "text-red-400" : "text-amber-400";
  const Icon = color === "red" ? AlertTriangle : AlertCircle;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg}`}
    >
      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
        <Icon className={`w-4 h-4 ${text} shrink-0`} />
      </motion.div>
      <span className={`text-xs font-semibold ${text}`}>
        {count} {label}
      </span>
    </motion.div>
  );
}

// ─── Compliance Bar ───────────────────────────────────────────────────────────
function ComplianceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommandCenter() {
  const { user } = useAuth();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Data Queries ─────────────────────────────────────────────────────────
  const { data: govScore } = useQuery<any>({
    queryKey: ["/api/governance/score"],
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: adminStats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: auditLogs } = useQuery<any[]>({
    queryKey: ["/api/audit-logs"],
    select: (d: any) => (Array.isArray(d) ? d : d?.logs || []).slice(0, 25),
    refetchInterval: 3 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: servers = [] } = useQuery<any[]>({
    queryKey: ["/api/infrastructure/servers"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: monitoring } = useQuery<any>({
    queryKey: ["/api/infrastructure/monitoring"],
    select: (d: any) => {
      const arr = Array.isArray(d) ? d : d?.data || [];
      return {
        total: arr.length,
        critical: arr.filter((a: any) => a.status === "critical").length,
        warning: arr.filter((a: any) => a.status === "warning").length,
      };
    },
    refetchInterval: 3 * 60 * 1000,
    staleTime: 90 * 1000,
  });

  const { data: incidents = [] } = useQuery<any[]>({
    queryKey: ["/api/security-incidents"],
    select: (d: any) => Array.isArray(d) ? d : d?.incidents || [],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: vulns = [] } = useQuery<any[]>({
    queryKey: ["/api/security/vulnerabilities"],
    select: (d: any) => Array.isArray(d) ? d : d?.vulnerabilities || [],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { data: tickets } = useQuery<any>({
    queryKey: ["/api/it-tickets"],
    select: (d: any) => {
      const arr = Array.isArray(d) ? d : d?.tickets || [];
      return {
        total: arr.length,
        open: arr.filter((t: any) => t.status !== "closed" && t.status !== "resolved").length,
        slaBreached: arr.filter((t: any) => t.slaBreached || t.status === "sla_breached").length,
        urgent: arr.filter((t: any) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length,
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch real per-dept task stats (uses director tasks overview)
  const { data: deptTaskStats } = useQuery<{ byDept: Record<number, { total: number; pending: number; inProgress: number; completed: number; overdue: number }> }>({
    queryKey: ["/api/director/tasks/overview"],
    select: (d: any) => ({ byDept: d.byDept || {} }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Compute dept health from REAL data only — no Math.random()
  const DEPT_TO_ID: Record<string, number> = { infrastructure: 9, cybersecurity: 10, digital_transformation: 11, support: 12 };
  const deptHealth: Record<string, DeptHealth> = {};

  DEPT_CONFIG.forEach(d => {
    const deptId = DEPT_TO_ID[d.key];
    const taskStat = deptTaskStats?.byDept?.[deptId];
    const openTasks = taskStat ? (taskStat.pending + taskStat.inProgress) : 0;

    // Score: use govScore for infra/cyber, else use compliance rate, else 0 (unknown)
    let score = 0;
    if (d.key === "infrastructure") score = Math.round(govScore?.operationalScore ?? 0);
    else if (d.key === "cybersecurity") score = Math.round(govScore?.securityScore ?? 0);
    else if (d.key === "support" && tickets) score = tickets.open === 0 ? 90 : tickets.slaBreached === 0 ? 80 : Math.max(40, 80 - tickets.slaBreached * 5);
    else if (govScore?.complianceRate) score = Math.round(govScore.complianceRate);

    const st: DeptHealth["status"] = score === 0 ? "unknown" as any : score >= 80 ? "good" : score >= 60 ? "warning" : "critical";
    deptHealth[d.key] = {
      status: st as any,
      score,
      openTickets: d.key === "support" ? (tickets?.open ?? 0) : 0,
      openTasks,
    };
  });

  // Support ticket count override
  if (tickets) {
    deptHealth.support.openTickets = tickets.open;
  }

  const overallScore = govScore?.overallScore ?? adminStats?.complianceRate ?? 0;
  const complianceRate = govScore?.complianceRate ?? adminStats?.complianceRate ?? 0;
  const securityScore = govScore?.securityScore ?? 0;
  const openTicketsTotal = tickets?.open || adminStats?.openTickets || 0;
  const activeIncidents = incidents.filter((i: any) => i.status !== "resolved" && i.status !== "closed").length;
  const criticalVulns = vulns.filter((v: any) => v.severity === "critical" || v.severity === "high").length;
  const totalServers = Array.isArray(servers) ? servers.length : 0;
  const activeServers = Array.isArray(servers) ? servers.filter((s: any) => s.status === "active" || s.status === "online").length : 0;
  const criticalAlerts = monitoring?.critical || 0;
  const warningAlerts = monitoring?.warning || 0;

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date());
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050b18] text-white overflow-auto" dir="rtl">
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(202,138,4,0.06) 0%, transparent 60%)" }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />
      </div>

      <div className="relative z-10 p-4 space-y-4 max-w-[1800px] mx-auto">
        {/* ── Top Bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/it-director">
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white text-xs">
                <ArrowLeft className="w-3.5 h-3.5" />
                العودة
              </button>
            </Link>
            <div className="flex items-center gap-2.5">
              <motion.div
                className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center"
                animate={{ boxShadow: ["0 0 10px rgba(202,138,4,0.2)", "0 0 20px rgba(202,138,4,0.4)", "0 0 10px rgba(202,138,4,0.2)"] }}
                transition={{ repeat: Infinity, duration: 3 }}
              >
                <Radio className="w-4 h-4 text-yellow-400" />
              </motion.div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">مركز القيادة الحي</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PulseDot color="emerald" size={1.5} />
                  <span className="text-[10px] text-emerald-400 font-medium">بث مباشر</span>
                  <span className="text-[10px] text-white/30 mr-1">آخر تحديث: {lastRefresh.toLocaleTimeString("ar-SA")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Alert banners */}
            <div className="flex items-center gap-2">
              <AlertBanner count={criticalAlerts} label="تنبيهات حرجة" color="red" />
              <AlertBanner count={activeIncidents} label="حوادث نشطة" color="red" />
              <AlertBanner count={warningAlerts} label="تحذيرات" color="amber" />
            </div>
            <button
              onClick={handleRefresh}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              title="تحديث"
            >
              <RefreshCw className="w-3.5 h-3.5 text-white/50" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              title="ملء الشاشة"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white/50" />
            </button>
            <LiveClock />
          </div>
        </div>

        {/* ── Row 1: Big KPI Metrics ────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <BigMetricCard label="نقاط الحوكمة" value={overallScore} icon={BarChart3} color="#f59e0b" trend="up" unit="%" delay={0} />
          <BigMetricCard label="التذاكر المفتوحة" value={openTicketsTotal} icon={Ticket} color="#3b82f6" trend={openTicketsTotal > 20 ? "up" : "stable"} delay={0.07} />
          <BigMetricCard label="الحوادث النشطة" value={activeIncidents} icon={ShieldAlert} color="#ef4444" trend={activeIncidents > 0 ? "up" : "stable"} delay={0.14} />
          <BigMetricCard label="الثغرات الحرجة" value={criticalVulns} icon={Bug} color="#f97316" trend={criticalVulns > 5 ? "up" : "stable"} delay={0.21} />
          <BigMetricCard label="الخوادم النشطة" value={activeServers} icon={Server} color="#22c55e" trend="stable" unit={`/ ${totalServers}`} delay={0.28} />
          <BigMetricCard label="تنبيهات الرصد" value={monitoring?.total || 0} icon={Eye} color="#a855f7" trend={criticalAlerts > 0 ? "up" : "stable"} delay={0.35} />
        </div>

        {/* ── Row 2: Main Content ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Left: Dept Health + Gauges ── */}
          <div className="space-y-4">
            {/* Compliance Gauges */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-semibold text-white/80">مؤشرات الامتثال والأمن</h3>
              </div>
              <div className="flex items-center justify-around mb-4">
                <div className="text-center">
                  <RingGauge value={Math.round(complianceRate)} color="#f59e0b" size={88} strokeWidth={8} label="الامتثال" />
                  <p className="text-[10px] text-white/40 mt-1">PDPL / NDMO</p>
                </div>
                <div className="text-center">
                  <RingGauge value={Math.round(securityScore)} color="#ef4444" size={88} strokeWidth={8} label="الأمن" />
                  <p className="text-[10px] text-white/40 mt-1">Security Score</p>
                </div>
                <div className="text-center">
                  <RingGauge value={Math.round(govScore?.operationalScore ?? 0)} color="#22c55e" size={88} strokeWidth={8} label="التشغيل" />
                  <p className="text-[10px] text-white/40 mt-1">Operational</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <ComplianceBar label="PDPL" value={Math.round(complianceRate)} color="#f59e0b" />
                <ComplianceBar label="NDMO" value={Math.round(complianceRate * 0.95)} color="#06b6d4" />
                <ComplianceBar label="NCA ECC" value={Math.round(securityScore)} color="#ef4444" />
                <ComplianceBar label="ISO 27001" value={Math.round(securityScore * 0.9)} color="#a855f7" />
              </div>
            </motion.div>

            {/* Server Grid */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-semibold text-white/80">حالة الخوادم</h3>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />نشط</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />صيانة</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />معطل</span>
                </div>
              </div>
              <ServerGrid servers={Array.isArray(servers) ? servers : []} />
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-white/40">إجمالي: {totalServers} خادم</span>
                <span className="text-emerald-400 font-medium">
                  {totalServers > 0 ? Math.round((activeServers / totalServers) * 100) : 100}% نشط
                </span>
              </div>
            </motion.div>
          </div>

          {/* ── Center: Dept Health Grid ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4 h-full"
            >
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-semibold text-white/80">صحة الإدارات</h3>
                <div className="mr-auto flex items-center gap-2 text-[10px] text-white/30">
                  <span className="flex items-center gap-1"><PulseDot color="emerald" size={1.5} />سليم</span>
                  <span className="flex items-center gap-1"><PulseDot color="amber" size={1.5} />تحذير</span>
                  <span className="flex items-center gap-1"><PulseDot color="red" size={1.5} />حرج</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEPT_CONFIG.map((dept, i) => (
                  <Link key={dept.key} href={dept.href}>
                    <DeptHealthCard dept={dept} health={deptHealth[dept.key] || { status: "good", score: 75, openTickets: 0, openTasks: 0 }} delay={0.1 + i * 0.08} />
                  </Link>
                ))}
              </div>

              {/* Overall score display */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 rounded-xl bg-gradient-to-l from-yellow-500/10 to-transparent border border-yellow-500/20 p-3 flex items-center gap-3"
              >
                <div className="text-center">
                  <RingGauge value={Math.round(overallScore)} color="#f59e0b" size={72} strokeWidth={7} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">نقاط الحوكمة الكلية</p>
                  <p className="text-[11px] text-white/40 mt-1">Overall Governance Score</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">تحسن مقارنة بالشهر الماضي</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* ── Right: Live Activity Feed ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4 h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Radio className="w-3.5 h-3.5 text-red-400" />
                  </motion.div>
                  <h3 className="text-xs font-semibold text-white/80">سجل النشاط الحي</h3>
                </div>
                <span className="text-[10px] text-white/30">{auditLogs?.length || 0} حدث</span>
              </div>

              <div className="space-y-0 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                {auditLogs?.length ? (
                  <AnimatePresence>
                    {auditLogs.map((log: any, i: number) => (
                      <ActivityItem key={log.id} log={log} index={i} />
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-white/30">جاري تحميل السجلات...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Row 3: Quick Links ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-white/8 bg-white/4 backdrop-blur-sm p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-yellow-400" />
            <h3 className="text-xs font-semibold text-white/80">الوصول السريع</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { label: "التذاكر", href: "/it-director/tickets", icon: Ticket, color: "#3b82f6" },
              { label: "الحوادث", href: "/department/cybersecurity/incidents", icon: ShieldAlert, color: "#ef4444" },
              { label: "الثغرات", href: "/department/cybersecurity/vulnerabilities", icon: Bug, color: "#f97316" },
              { label: "الخوادم", href: "/department/infrastructure/servers", icon: Server, color: "#22c55e" },
              { label: "الرصد", href: "/department/infrastructure/monitoring", icon: Eye, color: "#a855f7" },
              { label: "المشاريع", href: "/it-director/projects", icon: CheckCircle2, color: "#06b6d4" },
              { label: "التصعيدات", href: "/it-director/escalations", icon: AlertTriangle, color: "#f59e0b" },
              { label: "مؤشرات KPI", href: "/it-director/kpi", icon: BarChart3, color: "#ec4899" },
            ].map((item, i) => (
              <Link key={item.href} href={item.href}>
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="w-full flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border border-white/8 hover:border-white/20 bg-white/3 hover:bg-white/8 transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}18`, border: `1px solid ${item.color}35` }}>
                    <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" style={{ color: item.color }} />
                  </div>
                  <span className="text-[11px] text-white/60 group-hover:text-white/90 transition-colors">{item.label}</span>
                </motion.button>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] text-white/20 pb-2">
          <span>نظام مركز التحكم — نادي سباقات الخيل السعودي</span>
          <span>Control Hub v2.0 · JCSA IT Command Center</span>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}
