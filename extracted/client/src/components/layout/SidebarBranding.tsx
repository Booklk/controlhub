import { useSidebar } from '@/components/ui/sidebar';
import { SidebarHeader } from '@/components/ui/sidebar';
import jcsaShieldLogo from '@/assets/jcsa-shield-logo.png';

interface SidebarBrandingProps {
  portalName: string;
}

export function SidebarBranding({ portalName }: SidebarBrandingProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <SidebarHeader className="border-b border-white/[0.06] p-3 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
          <img
            src={jcsaShieldLogo}
            alt="JCSA"
            className="w-8 h-8 object-contain"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))' }}
            data-testid="img-sidebar-logo"
          />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1 sidebar-text-fade">
            <h1 className="font-bold text-[14px] text-white/85 leading-tight tracking-tight">Control Hub</h1>
            <p className="text-[10px] text-white/25 truncate mt-0.5">{portalName}</p>
          </div>
        )}
      </div>
    </SidebarHeader>
  );
}
