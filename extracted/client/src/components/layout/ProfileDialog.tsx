import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Briefcase, Building2 } from 'lucide-react';
import { PORTAL_LABELS } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    email: string;
    portal?: string;
    jobTitle?: string;
  } | null;
  portalName: string;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2);
}

function ProfileField({ icon: Icon, label, value, testId }: { icon: any; label: string; value: string; testId: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <Icon className="w-4 h-4 text-[hsl(var(--accent))]/50 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
        <p className="text-sm text-white/80 truncate" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

export function ProfileDialog({ open, onOpenChange, user, portalName }: ProfileDialogProps) {
  const { t, dir } = useI18n();
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hub-dialog text-white max-w-md" dir={dir} data-testid="dialog-profile">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 hub-stat-gold" />
            {t('الملف الشخصي')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-[hsl(var(--accent))]/10">
            <Avatar className="h-14 w-14 border-2 border-[hsl(var(--accent))]/40 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent))]/70 text-[hsl(var(--primary))] font-bold text-lg">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-white text-lg truncate" data-testid="text-profile-name">{user.name}</p>
              <p className="text-sm text-[hsl(var(--accent))]/60 truncate" data-testid="text-profile-portal">
                {user.portal ? t(PORTAL_LABELS[user.portal] || user.portal) : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <ProfileField icon={Mail} label={t('البريد الإلكتروني')} value={user.email} testId="text-profile-email" />
            {user.jobTitle && (
              <ProfileField icon={Briefcase} label={t('المسمى الوظيفي')} value={user.jobTitle} testId="text-profile-job" />
            )}
            <ProfileField icon={Building2} label={t('البوابة')} value={t(portalName)} testId="text-profile-portal-name" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
