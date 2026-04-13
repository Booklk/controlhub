import { createElement } from 'react';
import { Layers } from 'lucide-react';
import type { NavGroup } from '@/lib/navigation';

interface NavGroupTabsProps {
  groups: NavGroup[];
  selectedLabel: string | null;
  onSelect: (label: string) => void;
  currentPath: string;
}

export function NavGroupTabs({ groups, selectedLabel, onSelect, currentPath }: NavGroupTabsProps) {
  if (groups.length <= 1) return null;

  return (
    <div className="px-3 py-2 border-b border-white/[0.05] flex-shrink-0">
      <div className="flex flex-wrap gap-1 justify-center">
        {groups.map((group) => {
          const isSelected = selectedLabel === group.label;
          const hasActiveItem = group.items.some(item => currentPath === item.href);
          const GroupIcon = group.icon || Layers;
          return (
            <button
              key={group.label}
              onClick={() => onSelect(group.label)}
              title={group.label}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                isSelected
                  ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]/70 border border-[hsl(var(--accent))]/15'
                  : hasActiveItem
                    ? 'text-[hsl(var(--accent))]/50 hover:text-[hsl(var(--accent))]/70 hover:bg-white/[0.04]'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
              }`}
              data-testid={`group-tab-${group.label}`}
            >
              <GroupIcon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
