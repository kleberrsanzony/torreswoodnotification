import { supabase } from "@/lib/supabase";
import { requestForToken } from "@/lib/firebase";
import { toast } from "sonner";

export const registerDeviceForNotifications = async (role: "estoque" | "vendedor" = "estoque") => {
  try {
    if (!('Notification' in window)) {
      console.warn("Este navegador não suporta notificações.");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log("Permissão de notificação negada.");
      return false;
    }

    const token = await requestForToken();
    if (token) {
      const { error } = await supabase.from("device_tokens").upsert(
        { fcm_token: token, role, active: true },
        { onConflict: 'fcm_token' }
      );
      if (error) throw error;
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro ao registrar dispositivo:", error);
    return false;
  }
};

export const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone || 
    window.matchMedia('(display-mode: standalone)').matches
  );
};

export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
