"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { requestForToken, onMessageListener } from "@/lib/firebase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BellRing, Check, Bell, VolumeX, Volume2, Search, ArrowRight, ShieldCheck } from "lucide-react";

type Sale = {
  id: string;
  product: string;
  length_meters: number;
  quantity: number;
  message: string;
  status: string;
  created_at: string;
};

export default function Estoque() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [filter, setFilter] = useState<"novo" | "todos">("novo");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchSales = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        toast.error("Erro ao carregar vendas");
        console.error(error);
      } else {
        setSales(data || []);
      }
      setIsLoading(false);
    };

    fetchSales();

    // Subscribe to Realtime Updates
    const channel = supabase
      .channel("supabase_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newSale = payload.new as Sale;
            setSales((prev) => [newSale, ...prev]);
            
            if (soundEnabled && audioRef.current) {
              audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedSale = payload.new as Sale;
            setSales((prev) =>
              prev.map((s) => (s.id === updatedSale.id ? updatedSale : s))
            );
          } else if (payload.eventType === "DELETE") {
            setSales((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Setup Firebase onMessage Listener for foreground notifications
    onMessageListener()
      .then((payload: any) => {
        toast.info(`Nova Venda: ${payload?.notification?.body}`);
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
        }
      })
      .catch((err) => console.log("failed: ", err));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("sales")
      .update({ status })
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Pedido marcado como ${status}!`);
    }
  };

  const handleRegisterDevice = async () => {
    setIsRegistering(true);
    try {
      const token = await requestForToken();
      if (token) {
        // Save token to DB
        const { error } = await supabase.from("device_tokens").upsert(
          { fcm_token: token, role: "estoque", active: true },
          { onConflict: 'fcm_token' }
        );
        if (error) throw error;
        toast.success("Dispositivo ativado para receber notificações!");
      } else {
        toast.warning("Não foi possível obter a permissão para notificações.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar dispositivo.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleTestNotification = async () => {
    try {
       await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Teste de Notificação",
          body: "Esta é uma notificação de teste.",
        }),
      });
      toast.success("Notificação enviada!");
    } catch (e) {
      toast.error("Erro ao testar notificação");
    }
  };

  const filteredSales = sales.filter(s => filter === "todos" || s.status === filter);
  const novosCount = sales.filter(s => s.status === "novo").length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Hidden Audio Element for Notification Sound */}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Estoque</h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-full transition-colors ${soundEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              title={soundEnabled ? "Som ativado" : "Som desativado"}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
           <button
             onClick={handleRegisterDevice}
             disabled={isRegistering}
             className="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium transition-colors"
           >
             <BellRing className="w-4 h-4" />
             {isRegistering ? "Ativando..." : "Receber Notificações"}
           </button>
           <button
             onClick={handleTestNotification}
             className="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium transition-colors"
           >
             <Bell className="w-4 h-4" />
             Testar Notificação
           </button>
        </div>
      </div>

      <div className="flex items-center bg-muted p-1 rounded-xl">
        <button
          onClick={() => setFilter("novo")}
          className={`flex-1 flex items-center justify-center h-10 text-sm font-medium rounded-lg transition-all ${filter === "novo" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Novos 
          {novosCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              {novosCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("todos")}
          className={`flex-1 flex items-center justify-center h-10 text-sm font-medium rounded-lg transition-all ${filter === "todos" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Todos
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <div 
              key={sale.id} 
              className={`p-4 rounded-xl border transition-all ${sale.status === 'novo' ? 'bg-card border-primary/20 shadow-sm border-l-4 border-l-primary' : sale.status === 'visto' ? 'bg-muted/50 border-border' : 'bg-muted/30 border-dashed border-border opacity-75'}`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="font-semibold text-[15px] leading-tight text-foreground">
                  {sale.message}
                </p>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    sale.status === 'novo' ? 'bg-primary/10 text-primary' :
                    sale.status === 'visto' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {sale.status === 'novo' ? 'NOVO' : sale.status === 'visto' ? 'EM ESPERA' : 'SEPARADO'}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {format(new Date(sale.created_at), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                {sale.status === 'novo' && (
                  <button
                    onClick={() => handleUpdateStatus(sale.id, 'visto')}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary h-10 rounded-lg text-sm font-semibold transition-colors hover:bg-primary/20"
                  >
                    Visto
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                
                {(sale.status === 'novo' || sale.status === 'visto') && (
                  <button
                    onClick={() => handleUpdateStatus(sale.id, 'separado')}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 rounded-lg text-sm font-semibold transition-colors hover:bg-primary/90"
                  >
                    Separado
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}

                {sale.status === 'separado' && (
                  <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 h-10 rounded-lg text-sm font-semibold pointer-events-none">
                    <Check className="w-4 h-4" />
                    Item Finalizado
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
