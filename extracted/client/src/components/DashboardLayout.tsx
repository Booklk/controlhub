/**
 * DashboardLayout - Main layout orchestrator
 * 
 * Composes modular subcomponents from ./layout/:
 * - SidebarBranding, PortalSwitcher, SidebarSearch, NavGroupTabs
 * - TopHeader, ProfileDialog
 * 
 * To modify a specific section, edit the corresponding file in components/layout/.
 * To change colors/tokens, edit lib/theme.ts.
 */
import { ReactNode, useState, useMemo, isValidElement, createElement, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Home, ChevronLeft } from 'lucide-react';
import { itDirectorNavGroups, dmoNavGroups, filterNavGroupsByPermission, getNavGroupsForPortal, getPortalLabel } from '@/lib/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { PageOnboarding } from './PageOnboarding';
import { getPortalDefaultRoute } from '@shared/constants';
import { PORTAL_LABELS, LAYOUT } from '@/lib/theme';
import type { NavGroup } from '@/lib/navigation';

import { SidebarBranding } from './layout/SidebarBranding';
import { PortalSwitcher } from './layout/PortalSwitcher';
import { SidebarSearch } from './layout/SidebarSearch';
import { NavGroupTabs } from './layout/NavGroupTabs';
import { TopHeader } from './layout/TopHeader';
import { ProfileDialog } from './layout/ProfileDialog';
import { useI18n } from '@/lib/i18n';

// ─── Route Labels (breadcrumb translations) ───────────────────
const ROUTE_LABELS: Record<string, string> = {
  admin: "لوحة المشرف",
  users: "إدارة المستخدمين",
  audit: "سجل التدقيق",
  sessions: "الجلسات",
  reports: "التقارير",
  departments: "إدارات الأعمال",
  "systems-status": "حالة الأنظمة",
  "it-director": "مدير تقنية المعلومات",
  projects: "المشاريع",
  tickets: "التذاكر",
  escalations: "التصعيدات",
  referrals: "الإحالات",
  assets: "الأصول",
  kpis: "مؤشرات الأداء",
  teams: "الفرق",
  vendors: "الموردين",
  "external-systems": "الأنظمة الخارجية",
  "system-approvals": "موافقات الأنظمة",
  "email-integration": "البريد الإلكتروني",
  department: "الإدارة",
  infrastructure: "البنية التحتية",
  cybersecurity: "الأمن السيبراني",
  "digital-transformation": "التحول الرقمي",
  support: "الدعم الفني",
  dmo: "إدارة البيانات",
  committee: "اللجان",
  tasks: "المهام",
  servers: "الخوادم",
  network: "الشبكات",
  storage: "التخزين",
  monitoring: "المراقبة",
  incidents: "الحوادث الأمنية",
  vulnerabilities: "الثغرات الأمنية",
  threats: "تقييم المخاطر",
  initiatives: "المبادرات الرقمية",
  applications: "التطبيقات",
  cloud: "الخدمات السحابية",
  "knowledge-base": "قاعدة المعرفة",
  documents: "المستندات",
  "api-settings": "ربط الأنظمة",
  sla: "اتفاقيات SLA",
  "data-catalog": "فهرس البيانات",
  "data-dictionary": "قاموس البيانات",
  "data-quality": "جودة البيانات",
  stewards: "ممثلي البيانات",
  decisions: "القرارات",
  meetings: "الاجتماعات",
  voting: "التصويت",
  minutes: "محاضر الجلسات",
  members: "الأعضاء",
  settings: "الإعدادات",
  employee: "بوابة الموظفين",
  "feature-requests": "طلب مميزات",
  "regulatory-compliance": "الامتثال التنظيمي",
};

// ─── Types ────────────────────────────────────────────────────
interface NavItem {
  title: string;
  href: string;
  icon: ReactNode;
}

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  navItems?: NavItem[];
  navGroups?: NavGroup[];
  portalName: string;
  portalColor?: string;
  portalSwitcher?: boolean;
}

type PortalPath = 'it' | 'dmo';

interface NavMetrics {
  tasks: { pending: number };
  tickets: { open: number };
  approvals: { pending: number };
  notifications: { unread: number };
  security: { threats: number; vulnerabilities: number; incidents: number };
  projects: { active: number };
  escalations: { pending: number };
}

// ─── Badge Metric Mapping ─────────────────────────────────────
const BADGE_MAP: Record<string, (m: NavMetrics) => number> = {
  '/it-director/tasks': m => m.tasks.pending,
  '/it-director/tickets': m => m.tickets.open,
  '/it-director/projects': m => m.projects.active,
  '/it-director/escalations': m => m.escalations.pending,
  '/it-director/external-systems': m => m.approvals.pending,
  '/it-director/system-approvals': m => m.approvals.pending,
  '/department/cybersecurity/tasks': m => m.tasks.pending,
  '/department/cybersecurity/tickets': m => m.tickets.open,
  '/department/cybersecurity/incidents': m => m.security.incidents,
  '/department/cybersecurity/vulnerabilities': m => m.security.vulnerabilities,
  '/department/cybersecurity/threats': m => m.security.threats,
  '/department/infrastructure/tasks': m => m.tasks.pending,
  '/department/infrastructure/tickets': m => m.tickets.open,
  '/department/infrastructure/projects': m => m.projects.active,
  '/department/digital-transformation/tasks': m => m.tasks.pending,
  '/department/digital-transformation/tickets': m => m.tickets.open,
  '/department/support/tasks': m => m.tasks.pending,
  '/department/support/tickets': m => m.tickets.open,
  '/department/support/escalations': m => m.escalations.pending,
  '/committee/tasks': m => m.tasks.pending,
  '/admin/sessions': m => m.tasks.pending,
  '/dmo/notifications': m => m.notifications.unread,
  '/dmo/steward-requests': m => m.approvals.pending,
  '/dmo/governance-requests': m => m.approvals.pending,
  '/dmo/dsr': m => m.approvals.pending,
  '/dmo/incidents': m => m.security.incidents,
};

// ─── Sidebar Contents (inner component) ──────────────────────
function SidebarContents({ navItems = [], navGroups, portalName, onOpenProfile }: {
  navItems?: NavItem[];
  navGroups?: NavGroup[];
  portalName: string;
  onOpenProfile: () => void;
}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const { data: metrics } = useQuery<NavMetrics>({
    queryKey: ['/api/navigation/metrics'],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });

  const userPortal = user?.portal || '';
  const isITDirector = userPortal === 'it_director';
  const [activePortalPath, setActivePortalPath] = useState<PortalPath>(
    location.startsWith('/dmo') ? 'dmo' : 'it'
  );

  useEffect(() => {
    if (isITDirector) {
      if (location.startsWith('/dmo')) setActivePortalPath('dmo');
      else setActivePortalPath('it');
    }
  }, [location, isITDirector]);

  const resolvedNavGroups = useMemo(() => {
    if (isITDirector) {
      return activePortalPath === 'dmo' ? dmoNavGroups : itDirectorNavGroups;
    }
    const portalNav = getNavGroupsForPortal(userPortal);
    if (portalNav) return portalNav;
    return navGroups;
  }, [isITDirector, activePortalPath, userPortal, navGroups]);

  const handlePortalSwitch = (path: PortalPath) => {
    if (path === activePortalPath) return;
    setActivePortalPath(path);
    setLocation(path === 'dmo' ? '/dmo' : '/it-director');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuth.getState().token}` },
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
    logout();
    setLocation('/login');
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const isDMOManager = user?.role === 'dmo_manager' || user?.portal === 'it_director';

  useEffect(() => {
    if (!resolvedNavGroups) return;
    const activeGroup = resolvedNavGroups.find(g =>
      g.items.some(item => location === item.href)
    );
    if (activeGroup) {
      setSelectedGroupLabel(activeGroup.label);
    } else if (!selectedGroupLabel || !resolvedNavGroups.some(g => g.label === selectedGroupLabel)) {
      setSelectedGroupLabel(resolvedNavGroups.length > 0 ? resolvedNavGroups[0].label : null);
    }
  }, [location, resolvedNavGroups]);

  const getBadgeCount = (href: string): number => {
    if (!metrics) return 0;
    const getter = BADGE_MAP[href];
    return getter ? getter(metrics) : 0;
  };

  const filteredNavGroups = useMemo(() => {
    if (!resolvedNavGroups) return undefined;
    const userRole = user?.role || '';
    let groups = filterNavGroupsByPermission(resolvedNavGroups, userRole);

    groups = groups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.href === '/dmo/office-manager-dashboard' && !isDMOManager) return false;
        return true;
      }),
    })).filter(g => g.items.length > 0);

    if (sidebarSearch.trim()) {
      const q = sidebarSearch.trim().toLowerCase();
      groups = groups.map(g => ({
        ...g,
        items: g.items.filter(item =>
          item.title.toLowerCase().includes(q) || t(item.title).toLowerCase().includes(q)
        )
      })).filter(g => g.items.length > 0);
    }

    return groups;
  }, [resolvedNavGroups, isDMOManager, sidebarSearch, user?.role, t]);

  const visibleGroup = useMemo(() => {
    if (!filteredNavGroups || sidebarSearch.trim()) return null;
    return filteredNavGroups.find(g => g.label === selectedGroupLabel) || filteredNavGroups[0] || null;
  }, [filteredNavGroups, selectedGroupLabel, sidebarSearch]);

  const renderNavItem = (item: NavItem) => {
    const isActive = location === item.href;
    const iconElement = isValidElement(item.icon)
      ? item.icon
      : (typeof item.icon === 'function' ? createElement(item.icon as any, { className: "w-4 h-4 flex-shrink-0" }) : null);
    const badgeCount = getBadgeCount(item.href);

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={item.title}
          onClick={() => setLocation(item.href)}
          className={`cursor-pointer h-9 sidebar-item-glow hub-transition rounded-md ${
            isActive
              ? 'hub-sidebar-active sidebar-active-indicator'
              : 'hub-sidebar-inactive'
          }`}
          data-testid={`nav-${item.href.replace(/\//g, '-')}`}
        >
          <span className={`flex-shrink-0 ${isActive ? 'hub-stat-gold' : 'text-white/60'}`}>{iconElement}</span>
          <span className="truncate text-[13px] sidebar-text-fade leading-none">{t(item.title)}</span>
          {badgeCount > 0 && !isCollapsed && (
            <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 flex-shrink-0 hub-transition ${
              isActive
                ? 'hub-badge-gold'
                : badgeCount >= 5
                  ? 'hub-badge-danger'
                  : 'hub-badge-gold'
            }`} style={{ padding: '0 4px' }}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <SidebarBranding portalName={getPortalLabel(userPortal) || portalName} />

      {isITDirector && !isCollapsed && (
        <PortalSwitcher activePortalPath={activePortalPath} onSwitch={handlePortalSwitch} />
      )}

      {!isCollapsed && (
        <SidebarSearch value={sidebarSearch} onChange={setSidebarSearch} />
      )}

      {!isCollapsed && filteredNavGroups && !sidebarSearch.trim() && (
        <NavGroupTabs
          groups={filteredNavGroups}
          selectedLabel={selectedGroupLabel}
          onSelect={setSelectedGroupLabel}
          currentPath={location}
        />
      )}

      <SidebarContent ref={contentRef} className="scrollbar-premium overflow-y-auto pb-2">
        {sidebarSearch.trim() && filteredNavGroups && filteredNavGroups.length > 0 ? (
          filteredNavGroups.map((group, groupIndex) => (
            <SidebarGroup key={group.label} className="px-2 py-0.5">
              {groupIndex > 0 && <div className="mx-2 mb-1 border-t border-white/4" />}
              <SidebarGroupLabel className="text-[10px] font-medium px-2 uppercase tracking-widest h-7 text-white/50">
                <span className="flex items-center gap-1.5 truncate">
                  {group.icon && createElement(group.icon, { className: "w-3 h-3 flex-shrink-0 opacity-60" })}
                  <span className="truncate">{t(group.label)}</span>
                </span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5 mt-0.5">
                  {group.items.map(item => renderNavItem(item))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : visibleGroup ? (
          <SidebarGroup className="px-2 py-0.5">
            <SidebarGroupLabel className="text-[10px] font-medium px-2 uppercase tracking-widest h-7 hub-stat-gold opacity-50">
              <span className="flex items-center gap-1.5 truncate">
                {visibleGroup.icon && createElement(visibleGroup.icon, { className: "w-3 h-3 flex-shrink-0 opacity-60" })}
                <span className="truncate">{t(visibleGroup.label)}</span>
                <span className="text-[9px] text-white/60 font-normal tabular-nums">{visibleGroup.items.length}</span>
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 mt-0.5">
                {visibleGroup.items.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : sidebarSearch.trim() ? (
          <div className="p-4 text-center text-white/50 text-xs">
            {t('لا توجد بيانات')}
          </div>
        ) : (
          <SidebarGroup className="px-2 py-1">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {navItems.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/[0.05] p-2 flex-shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onOpenProfile}
              className="w-full text-white/60 hover:text-white/90 hover:bg-white/4"
              data-testid="button-sidebar-user"
            >
              <Avatar className="h-7 w-7 border border-white/10 flex-shrink-0">
                <AvatarFallback className="hub-badge-gold font-semibold text-[10px] rounded-full">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="min-w-0 flex-1 sidebar-text-fade">
                  <p className="text-xs font-medium truncate text-white/80">{user?.name}</p>
                  <p className="text-[10px] text-white/50 truncate">{user?.email}</p>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="w-full text-white/50 hover:text-red-400 hover:bg-red-500/8"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate text-xs">{t('تسجيل الخروج')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────
function InlineBreadcrumb() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const homeHref = user?.portal ? getPortalDefaultRoute(user.portal) : '/';

  const segments = location.split('/').filter(Boolean);
  if (segments.length <= 1) return null;

  const items = segments
    .filter(segment => !segment.match(/^\d+$/))
    .map((segment, index, arr) => ({
      label: t(ROUTE_LABELS[segment] || segment),
      href: index < arr.length - 1 ? '/' + arr.slice(0, index + 1).join('/') : undefined,
    }));

  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs mb-3 flex-wrap breadcrumb-animate" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
      <Link href={homeHref} className="flex items-center hub-stat-gold opacity-40 hover:opacity-70 hub-transition-fast" data-testid="link-breadcrumb-home">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronLeft className="w-3 h-3 text-white/60" />
          {item.href ? (
            <Link href={item.href} className="text-white/50 hover:text-white/70 transition-colors" data-testid={`link-breadcrumb-${index}`}>
              {item.label}
            </Link>
          ) : (
            <span className="text-white/60 font-medium" data-testid={`text-breadcrumb-${index}`}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Main Layout Component ────────────────────────────────────
export default function DashboardLayout({
  children,
  title,
  subtitle,
  navItems,
  navGroups,
  portalName,
}: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location]);

  const sidebarStyle = {
    "--sidebar-width": LAYOUT.sidebar.width,
    "--sidebar-width-icon": LAYOUT.sidebar.collapsedWidth,
    "--sidebar-background": "hsl(222 47% 9%)",
    "--sidebar-foreground": "hsl(0 0% 100%)",
    "--sidebar-border": "hsl(43 74% 49% / 0.1)",
    "--sidebar-accent": "hsl(43 74% 49% / 0.12)",
    "--sidebar-accent-foreground": "hsl(0 0% 100%)",
    "--sidebar-primary": "hsl(43 74% 49%)",
    "--sidebar-primary-foreground": "hsl(222 47% 11%)",
    "--sidebar-ring": "hsl(43 74% 49%)",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_11%)] to-[hsl(222_40%_14%)]" dir="rtl">
        <PageOnboarding />

        <Sidebar side="right" collapsible="icon" className="border-l border-white/[0.05]">
          <SidebarContents navItems={navItems} navGroups={navGroups} portalName={portalName} onOpenProfile={() => setProfileOpen(true)} />
        </Sidebar>

        <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
          <TopHeader title={title} subtitle={subtitle} onOpenProfile={() => setProfileOpen(true)} />

          <main ref={mainRef} className="flex-1 overflow-auto scrollbar-premium smooth-scroll">
            <div className="min-h-full bg-gradient-to-br from-[hsl(222_47%_8%)] via-[hsl(222_47%_10%)] to-[hsl(222_40%_12%)] p-4 lg:p-6">
              <div className="max-w-[1600px] mx-auto">
                <InlineBreadcrumb />
                <div className="page-enter" key={location}>
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        portalName={portalName}
      />
    </SidebarProvider>
  );
}
