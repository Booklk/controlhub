import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Languages } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import SmartNotificationCenter from '@/components/SmartNotificationCenter';
import CommandPalette from '@/components/CommandPalette';
import { useI18n } from '@/lib/i18n';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onOpenProfile: () => void;
}

export function TopHeader({ title, subtitle, onOpenProfile }: TopHeaderProps) {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();

  const initials = user ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U';

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  return (
    <header className="sticky top-0 z-30 h-12 header-glass border-b border-white/[0.05] flex items-center justify-between px-4 lg:px-6 gap-4 flex-shrink-0 transition-all duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-white/60 hover:text-white/80 hover:bg-white/8" data-testid="button-toggle-sidebar" />
        <div className="h-4 w-px bg-white/8 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white/90 truncate">{title}</h2>
        </div>
        {subtitle && (
          <>
            <div className="h-3 w-px bg-white/8 flex-shrink-0 hidden sm:block" />
            <p className="text-[11px] text-white/50 truncate hidden sm:block">{subtitle}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <CommandPalette />
        <SmartNotificationCenter />

        {/* Language Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLang}
          className="h-7 px-2 rounded-md hover:bg-white/6 text-white/50 hover:text-white/80 text-[11px] font-semibold gap-1 border border-white/8"
          data-testid="button-lang-toggle"
          title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          <Languages className="w-3 h-3" />
          <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </Button>

        <div className="h-4 w-px bg-white/8 mx-0.5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-md hover:bg-white/6"
              data-testid="button-user-menu"
            >
              <Avatar className="h-7 w-7 border border-white/10">
                <AvatarFallback className="bg-[hsl(var(--accent))]/15 hub-stat-gold text-[10px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-[hsl(var(--primary))] border-white/10 backdrop-blur-xl">
            <DropdownMenuLabel className="text-white/50 text-xs">{user?.name}</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/6" />
            <DropdownMenuItem onClick={onOpenProfile} className="text-white/60 hover:text-white hover:bg-white/6 cursor-pointer" data-testid="header-menu-settings">
              <Settings className="w-4 h-4 ml-2 text-white/60" />
              {t('الملف الشخصي')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
