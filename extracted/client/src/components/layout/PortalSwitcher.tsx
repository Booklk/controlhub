import { Monitor, Database } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type PortalPath = 'it' | 'dmo';

interface PortalSwitcherProps {
  activePortalPath: PortalPath;
  onSwitch: (path: PortalPath) => void;
}

export function PortalSwitcher({ activePortalPath, onSwitch }: PortalSwitcherProps) {
  const { t } = useI18n();
  const tabs: { path: PortalPath; label: string; icon: typeof Monitor }[] = [
    { path: 'it', label: t('تقنية المعلومات'), icon: Monitor },
    { path: 'dmo', label: t('إدارة البيانات'), icon: Database },
  ];

  return (
    <div className="px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
      <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
        {tabs.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => onSwitch(path)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all duration-300 ${
              activePortalPath === path
                ? 'bg-[hsl(43_74%_49%)]/10 text-[hsl(43_74%_49%)]/80 border border-[hsl(43_74%_49%)]/12'
                : 'text-white/50 hover:text-white/55 hover:bg-white/[0.03]'
            }`}
            data-testid={`button-portal-switch-${path}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
