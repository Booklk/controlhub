import { useEffect } from 'react';
import { useLocation } from 'wouter';

export function useKeyboardShortcuts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K = Open search (CommandPalette)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-testid="command-palette-trigger"]')?.click();
      }
      // Ctrl/Cmd + Shift + N = New ticket
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('shortcut:new-item'));
      }
      // Escape = Close dialogs
      if (e.key === 'Escape') {
        document.querySelector<HTMLButtonElement>('[data-dismiss="dialog"]')?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setLocation]);
}
