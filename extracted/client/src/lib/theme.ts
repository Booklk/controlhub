/**
 * Control Hub - Centralized Design Token System
 * نظام التصميم المركزي - نادي سباقات الخيل
 * 
 * ⚡ SINGLE SOURCE OF TRUTH for all design values
 * To update the platform's look, modify ONLY this file.
 * All components reference these tokens.
 */

// ─── Core Color Palette ───────────────────────────────────────
export const PALETTE = {
  navy: {
    h: 222, s: 47,
    50: 'hsl(222, 47%, 95%)',
    100: 'hsl(222, 47%, 90%)',
    200: 'hsl(222, 47%, 80%)',
    300: 'hsl(222, 47%, 60%)',
    400: 'hsl(222, 47%, 40%)',
    500: 'hsl(222, 47%, 25%)',
    600: 'hsl(222, 47%, 18%)',
    700: 'hsl(222, 47%, 14%)',
    800: 'hsl(222, 47%, 11%)',
    900: 'hsl(222, 47%, 8%)',
    950: 'hsl(222, 47%, 5%)',
  },
  gold: {
    h: 43, s: 74,
    50: 'hsl(43, 74%, 95%)',
    100: 'hsl(43, 74%, 90%)',
    200: 'hsl(43, 74%, 80%)',
    300: 'hsl(43, 74%, 65%)',
    400: 'hsl(43, 74%, 55%)',
    500: 'hsl(43, 74%, 49%)',
    600: 'hsl(43, 74%, 42%)',
    700: 'hsl(43, 74%, 35%)',
    800: 'hsl(43, 74%, 28%)',
    900: 'hsl(43, 74%, 20%)',
  },
  gray: {
    50: 'hsl(220, 14%, 98%)',
    100: 'hsl(220, 14%, 96%)',
    200: 'hsl(220, 14%, 91%)',
    300: 'hsl(220, 14%, 80%)',
    400: 'hsl(220, 14%, 60%)',
    500: 'hsl(220, 9%, 46%)',
    600: 'hsl(220, 14%, 35%)',
    700: 'hsl(220, 14%, 25%)',
    800: 'hsl(220, 14%, 18%)',
    900: 'hsl(220, 14%, 12%)',
  },
} as const;

export const COLORS = {
  navy: PALETTE.navy,
  gold: PALETTE.gold,
  gray: PALETTE.gray,
  status: {
    success: 'hsl(142, 76%, 36%)',
    successBg: 'hsl(142, 76%, 95%)',
    warning: 'hsl(38, 92%, 50%)',
    warningBg: 'hsl(38, 92%, 95%)',
    error: 'hsl(0, 84%, 60%)',
    errorBg: 'hsl(0, 84%, 95%)',
    info: 'hsl(199, 89%, 48%)',
    infoBg: 'hsl(199, 89%, 95%)',
  },
};

// ─── Semantic Dashboard Tokens ────────────────────────────────
export const DASHBOARD = {
  bg: {
    page: `linear-gradient(135deg, ${PALETTE.navy[900]} 0%, ${PALETTE.navy[800]} 50%, hsl(222, 40%, 14%) 100%)`,
    sidebar: PALETTE.navy[900],
    header: 'rgba(14, 19, 33, 0.8)',
    card: `${PALETTE.navy[800]}99`,
    cardSolid: PALETTE.navy[800],
    input: 'rgba(255,255,255,0.03)',
    inputHover: 'rgba(255,255,255,0.05)',
    active: `${PALETTE.gold[500]}1A`,
    hover: 'rgba(255,255,255,0.04)',
  },
  border: {
    subtle: 'rgba(255,255,255,0.05)',
    default: 'rgba(255,255,255,0.08)',
    active: `${PALETTE.gold[500]}26`,
    gold: `${PALETTE.gold[500]}1A`,
  },
  text: {
    primary: 'rgba(255,255,255,0.90)',
    secondary: 'rgba(255,255,255,0.60)',
    tertiary: 'rgba(255,255,255,0.35)',
    muted: 'rgba(255,255,255,0.20)',
    gold: PALETTE.gold[500],
    goldMuted: `${PALETTE.gold[500]}B3`,
  },
  accent: PALETTE.gold[500],
  accentHover: PALETTE.gold[600],
} as const;

// ─── Tailwind Class Helpers ───────────────────────────────────
// Commonly-used class strings to avoid repetition.
// Import `tw` and use:  className={tw.card}
export const tw = {
  card: 'hub-card',
  cardHover: 'hub-card hub-card-hover',
  cardGold: 'hub-card hub-card-gold',
  statCard: 'hub-card',
  
  badge: {
    gold: 'hub-badge-gold',
    success: 'hub-badge-success',
    warning: 'hub-badge-warning',
    danger: 'hub-badge-danger',
    info: 'hub-badge-info',
    neutral: 'hub-badge-neutral',
  },

  input: 'hub-input',
  goldButton: 'hub-btn-gold',
  heading: 'text-white/90 font-bold',
  subheading: 'text-white/50 text-sm',
  label: 'hub-label',
  divider: 'border-white/[0.05]',
  
  sidebarActive: 'hub-sidebar-active',
  sidebarInactive: 'hub-sidebar-inactive',

  table: {
    wrapper: 'hub-table-wrapper',
    head: 'hub-table-head',
    th: 'hub-th',
    row: 'hub-table-row',
    td: 'hub-td',
    cell: 'hub-td',
  },

  section: {
    header: 'hub-section-header',
    title: 'hub-section-title',
    subtitle: 'hub-section-subtitle',
  },

  dialog: {
    content: 'hub-dialog',
    header: 'hub-dialog-header',
    body: 'hub-dialog-body',
    footer: 'hub-dialog-footer',
  },

  icon: {
    gold: 'hub-icon-gold',
    navy: 'hub-icon-navy',
    success: 'hub-icon-success',
    danger: 'hub-icon-danger',
    info: 'hub-icon-info',
  },

  severity: {
    critical: 'hub-badge-danger',
    high: 'hub-badge-gold',
    medium: 'hub-badge-info',
    low: 'hub-badge-neutral',
  },
} as const;

// ─── Chart Configuration ──────────────────────────────────────
export const CHART_THEME = {
  colors: [
    PALETTE.gold[500],
    PALETTE.navy[500],
    'hsl(199, 89%, 48%)',
    'hsl(142, 76%, 36%)',
    'hsl(0, 84%, 60%)',
    PALETTE.navy[300],
    PALETTE.gold[300],
  ],
  pieColors: [
    PALETTE.gold[500],
    PALETTE.navy[500],
    'hsl(199, 89%, 48%)',
    'hsl(142, 76%, 36%)',
    'hsl(0, 84%, 60%)',
  ],
  tooltip: {
    backgroundColor: PALETTE.navy[800],
    border: `1px solid ${PALETTE.gold[500]}33`,
    borderRadius: '10px',
    color: '#fff',
    fontSize: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    padding: '8px 12px',
  },
  axisStyle: {
    stroke: 'rgba(255,255,255,0.08)',
    fill: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  grid: {
    stroke: 'rgba(255,255,255,0.04)',
    strokeDasharray: '3 3',
  },
  area: {
    goldFill: { id: 'hubGoldFill', startOpacity: 0.35, endOpacity: 0, color: PALETTE.gold[500] },
    navyFill: { id: 'hubNavyFill', startOpacity: 0.25, endOpacity: 0, color: PALETTE.navy[300] },
  },
} as const;

// ─── Shadows ──────────────────────────────────────────────────
export const SHADOWS = {
  sm: '0 1px 2px 0 rgb(30 41 59 / 0.05)',
  md: '0 4px 6px -1px rgb(30 41 59 / 0.1), 0 2px 4px -2px rgb(30 41 59 / 0.1)',
  lg: '0 10px 15px -3px rgb(30 41 59 / 0.1), 0 4px 6px -4px rgb(30 41 59 / 0.1)',
  xl: '0 20px 25px -5px rgb(30 41 59 / 0.1), 0 8px 10px -6px rgb(30 41 59 / 0.1)',
  gold: `0 4px 14px 0 ${PALETTE.gold[500]}40`,
  goldLg: `0 10px 25px -3px ${PALETTE.gold[500]}4D`,
  navy: `0 4px 14px 0 ${PALETTE.navy[800]}33`,
  navyLg: `0 10px 25px -3px ${PALETTE.navy[800]}40`,
  inner: 'inset 0 2px 4px 0 rgb(30 41 59 / 0.05)',
  card: '0 2px 12px -2px rgba(0,0,0,0.25)',
  cardHover: '0 6px 20px -4px rgba(0,0,0,0.35)',
};

// ─── Gradients ────────────────────────────────────────────────
export const GRADIENTS = {
  navyGold: `linear-gradient(135deg, ${PALETTE.navy[800]} 0%, ${PALETTE.navy[600]} 50%, ${PALETTE.gold[500]} 100%)`,
  goldNavy: `linear-gradient(135deg, ${PALETTE.gold[500]} 0%, ${PALETTE.gold[600]} 50%, ${PALETTE.navy[800]} 100%)`,
  navy: `linear-gradient(135deg, ${PALETTE.navy[700]} 0%, ${PALETTE.navy[900]} 100%)`,
  gold: `linear-gradient(135deg, ${PALETTE.gold[400]} 0%, ${PALETTE.gold[600]} 100%)`,
  subtle: `linear-gradient(135deg, ${PALETTE.gray[50]} 0%, ${PALETTE.gray[100]} 100%)`,
  subtleDark: `linear-gradient(135deg, ${PALETTE.navy[700]} 0%, ${PALETTE.navy[900]} 100%)`,
  radialGold: `radial-gradient(circle at 30% 30%, ${PALETTE.gold[400]}, ${PALETTE.gold[600]})`,
  radialNavy: `radial-gradient(circle at 30% 30%, ${PALETTE.navy[600]}, ${PALETTE.navy[900]})`,
  shimmer: `linear-gradient(90deg, transparent 0%, ${PALETTE.gold[500]}1A 50%, transparent 100%)`,
  page: DASHBOARD.bg.page,
};

// ─── Layout Constants ─────────────────────────────────────────
export const LAYOUT = {
  sidebar: {
    width: '18rem',
    collapsedWidth: '3.5rem',
  },
  header: {
    height: '3rem',
  },
  maxContentWidth: '1600px',
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
};

export const BORDER_RADIUS = LAYOUT.borderRadius;

export const SPACING = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
};

export const TYPOGRAPHY = {
  fontFamily: "'IBM Plex Sans Arabic', ui-sans-serif, system-ui, sans-serif",
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
};

export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
};

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ─── Status & Priority (Tailwind class maps) ─────────────────
export const STATUS_COLORS = {
  pending: {
    bg: 'bg-[hsl(43,74%,49%)]/10',
    text: 'text-[hsl(43,74%,49%)]',
    border: 'border-[hsl(43,74%,49%)]/30',
    icon: 'text-[hsl(43,74%,49%)]',
    cls: 'hub-badge-gold',
  },
  assigned: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: 'text-sky-400',
    cls: 'hub-badge-info',
  },
  in_progress: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: 'text-sky-400',
    cls: 'hub-badge-info',
  },
  completed: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    cls: 'hub-badge-success',
  },
  resolved: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    cls: 'hub-badge-success',
  },
  closed: {
    bg: 'bg-white/5',
    text: 'text-white/40',
    border: 'border-white/10',
    icon: 'text-white/40',
    cls: 'hub-badge-neutral',
  },
  rejected: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    cls: 'hub-badge-danger',
  },
  cancelled: {
    bg: 'bg-white/5',
    text: 'text-white/40',
    border: 'border-white/10',
    icon: 'text-white/40',
    cls: 'hub-badge-neutral',
  },
  open: {
    bg: 'bg-[hsl(43,74%,49%)]/10',
    text: 'text-[hsl(43,74%,49%)]',
    border: 'border-[hsl(43,74%,49%)]/30',
    icon: 'text-[hsl(43,74%,49%)]',
    cls: 'hub-badge-gold',
  },
  active: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: 'text-sky-400',
    cls: 'hub-badge-info',
  },
  investigating: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    cls: 'hub-badge-warning',
  },
};

export const PRIORITY_COLORS = {
  low: {
    bg: 'bg-white/5',
    text: 'text-white/50',
    border: 'border-white/10',
    cls: 'hub-badge-neutral',
  },
  medium: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    cls: 'hub-badge-info',
  },
  high: {
    bg: 'bg-[hsl(43,74%,49%)]/15',
    text: 'text-[hsl(43,74%,49%)]',
    border: 'border-[hsl(43,74%,49%)]/30',
    cls: 'hub-badge-gold',
  },
  critical: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    cls: 'hub-badge-danger',
  },
  urgent: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/35',
    cls: 'hub-badge-danger',
  },
};

export function getStatusColor(status: string) {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
}

export function getPriorityColor(priority: string) {
  return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium;
}

export function getSeverityBadgeClass(severity: string) {
  const map: Record<string, string> = {
    critical: tw.severity.critical,
    high: tw.severity.high,
    medium: tw.severity.medium,
    low: tw.severity.low,
  };
  return map[severity] || tw.severity.medium;
}

// ─── Portal Config ────────────────────────────────────────────
export const PORTAL_LABELS: Record<string, string> = {
  admin: 'مشرف النظام',
  it_director: 'مدير تقنية المعلومات',
  cybersecurity: 'الأمن السيبراني',
  infrastructure: 'البنية التحتية',
  digital_transformation: 'التحول الرقمي',
  support: 'الدعم الفني',
  dmo: 'إدارة البيانات',
  committee: 'اللجان',
  employee: 'موظف',
};

// ─── Status Labels (Arabic) ──────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  assigned: 'تم التعيين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  resolved: 'تم الحل',
  closed: 'مغلق',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
  open: 'مفتوح',
  active: 'نشط',
  investigating: 'قيد التحقيق',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  critical: 'حرج',
  urgent: 'عاجل',
};

export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'حرج',
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
};
