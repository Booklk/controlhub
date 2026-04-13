import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'warning' | 'info';
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  variant = 'destructive',
  onConfirm,
  isPending = false,
}: ConfirmDialogProps) {
  const iconMap = {
    destructive: <Trash2 className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-[hsl(43_74%_49%)]" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const buttonClassMap = {
    destructive: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-[hsl(43_74%_49%)] hover:bg-[hsl(43_74%_44%)] text-[hsl(222_47%_11%)]',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" data-testid="dialog-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {iconMap[variant]}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <AlertDialogCancel data-testid="button-cancel-confirm">{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={buttonClassMap[variant]}
            data-testid="button-confirm-action"
          >
            {isPending ? 'جاري التنفيذ...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [config, setConfig] = useState({
    title: 'تأكيد الحذف',
    description: 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
    confirmText: 'حذف',
    variant: 'destructive' as 'destructive' | 'warning' | 'info',
  });

  const confirm = useCallback((action: () => void, options?: Partial<typeof config>) => {
    setPendingAction(() => action);
    if (options) setConfig(prev => ({ ...prev, ...options }));
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    pendingAction?.();
    setIsOpen(false);
    setPendingAction(null);
  }, [pendingAction]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setPendingAction(null);
  }, []);

  return {
    isOpen,
    confirm,
    dialogProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
      title: config.title,
      description: config.description,
      confirmText: config.confirmText,
      variant: config.variant,
      onConfirm: handleConfirm,
    },
  };
}
