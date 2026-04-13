import { ChevronLeft, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getPortalDefaultRoute } from "@shared/constants";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

const routeLabels: Record<string, string> = {
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
  decisions: "القرارات",
  meetings: "الاجتماعات",
  voting: "التصويت",
  minutes: "محاضر الجلسات",
  members: "الأعضاء",
  settings: "الإعدادات",
  employee: "بوابة الموظفين",
};

export function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const homeHref = user?.portal ? getPortalDefaultRoute(user.portal) : '/';
  
  const autoItems: BreadcrumbItem[] = items || location
    .split("/")
    .filter(Boolean)
    .map((segment, index, arr) => ({
      label: routeLabels[segment] || segment,
      href: index < arr.length - 1 ? "/" + arr.slice(0, index + 1).join("/") : undefined
    }));

  if (autoItems.length === 0) return null;

  return (
    <nav 
      className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap"
      aria-label="Breadcrumb"
      data-testid="nav-breadcrumb"
    >
      {showHome && (
        <>
          <Link href={homeHref}>
            <a className="flex items-center hover:text-foreground transition-colors" data-testid="link-breadcrumb-home">
              <Home className="w-4 h-4" />
            </a>
          </Link>
          <ChevronLeft className="w-4 h-4 text-muted-foreground/50" />
        </>
      )}
      
      {autoItems.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          {item.href ? (
            <Link href={item.href}>
              <a 
                className="hover:text-foreground transition-colors"
                data-testid={`link-breadcrumb-${index}`}
              >
                {item.label}
              </a>
            </Link>
          ) : (
            <span className="text-foreground font-medium" data-testid={`text-breadcrumb-${index}`}>
              {item.label}
            </span>
          )}
          {index < autoItems.length - 1 && (
            <ChevronLeft className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </nav>
  );
}
