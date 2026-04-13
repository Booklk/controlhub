import { useState, useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { SidebarHeader } from '@/components/ui/sidebar';
import jcsaShieldLogo from '@/assets/jcsa-shield-logo.png';

interface SidebarBrandingProps {
  portalName: string;
}

export function SidebarBranding({ portalName }: SidebarBrandingProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setLastUpdate(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SidebarHeader
      className="border-b border-white/[0.06] p-3 flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(10,22,40,0.95) 50%, rgba(201,168,76,0.04) 100%)',
      }}
    >
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
            <h1 className="font-bold text-[15px] text-white leading-tight tracking-tight" style={{ textShadow: '0 1px 6px rgba(201,168,76,0.15)' }}>
              Control Hub
            </h1>
            <p className="text-[11px] text-[hsl(43,74%,49%)] font-medium truncate mt-0.5 opacity-80">{portalName}</p>
            <p className="text-[9px] text-white/20 mt-0.5" title={lastUpdate.toLocaleString('ar-SA')}>
              آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </SidebarHeader>
  );
}
