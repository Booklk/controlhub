import { Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  const { t } = useI18n();
  return (
    <div className="px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
      <div className="relative">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/15 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={t('بحث...')}
          className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg py-1.5 pr-8 pl-3 text-[11px] text-white/70 placeholder:text-white/15 focus:outline-none focus:border-[hsl(43_74%_49%)]/15 focus:bg-white/[0.04] transition-all duration-300"
          data-testid="input-sidebar-search"
        />
      </div>
    </div>
  );
}
