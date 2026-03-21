'use client';

import { useEffect, useState } from 'react';
import { registerDeviceForNotifications, isStandalone, isIOS, isMobile } from '@/lib/notifications';
import { toast } from 'sonner';
import { Download, X, Share, PlusSquare, BellRing } from 'lucide-react';

export default function PWAManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. Handle Install Prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Auto-show if not dismissed before
      const isDismissed = localStorage.getItem('pwa_install_dismissed');
      if (!isStandalone() && isMobile() && !isDismissed) {
        setShowInstallModal(true);
      }
    };

    // 2. Handle iOS specific check
    const checkIOSPrompt = () => {
      const isDismissed = localStorage.getItem('pwa_install_dismissed');
      if (!isStandalone() && isIOS() && isMobile() && !isDismissed) {
        setShowInstallModal(true);
      }
    };

    // 3. Auto-Notification Request (if Standalone)
    const checkAutoNotification = async () => {
      if (isStandalone() && ('Notification' in window) && Notification.permission === 'default') {
        const role = window.location.pathname.includes('/estoque') ? 'estoque' : 'vendedor';
        const registered = await registerDeviceForNotifications(role);
        if (registered) {
          toast.success(`Notificações de ${role === 'estoque' ? 'estoque' : 'vendedor'} ativadas!`);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    checkIOSPrompt();
    checkAutoNotification();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallModal(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismissModal = () => {
    setShowInstallModal(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!mounted || !showInstallModal) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-md mx-auto bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <button onClick={dismissModal} className="p-1 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <h3 className="text-xl font-bold mb-2">Instalar Torres Notifica</h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Adicione nosso sistema à sua tela inicial para receber notificações em tempo real e ter acesso rápido.
          </p>

          {isIOS() ? (
            <div className="space-y-4 bg-muted/50 p-4 rounded-2xl border border-border/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instruções para iPhone:</p>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-background p-2 rounded-lg shadow-sm">
                  <Share className="w-4 h-4 text-primary" />
                </div>
                <span>Toque no botão de <strong>Compartilhar</strong> na barra do Safari.</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-background p-2 rounded-lg shadow-sm">
                  <PlusSquare className="w-4 h-4 text-primary" />
                </div>
                <span>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <PlusSquare className="w-5 h-5" />
              Instalar Agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
