"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requestForToken, onMessageListener } from "@/lib/firebase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BellRing, Check, Bell, VolumeX, Volume2, Search, ArrowRight, ShieldCheck, X, Pencil, Trash2, FileDown, CheckSquare, Loader2, LogOut, LayoutDashboard, Package, Users } from "lucide-react";
import { registerDeviceForNotifications } from "@/lib/notifications";
import { generateDailyReport } from "@/lib/pdfReport";

type Sale = {
  id: string;
  product: string;
  length_meters: number;
  quantity: number;
  message: string;
  status: string;
  created_at: string;
  seller_id: string | null;
  profiles?: { name: string } | null;
};

export default function Estoque() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [filter, setFilter] = useState<"novo" | "visualizado" | "separando" | "separado" | "entregue_ou_retirado" | "todos">("novo");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit and Delete forms
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingYesterday, setIsExportingYesterday] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Core States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [typedPin, setTypedPin] = useState("");
  const [masterPin, setMasterPin] = useState<string | null>(null);

  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const userId = sessionStorage.getItem("user_id");
    const role = sessionStorage.getItem("user_role");
    const unlocked = sessionStorage.getItem("estoque_unlocked") === "true";

    if (!userId) {
      router.push("/login");
      return;
    }

    setIsAuthenticated(true);
    setUserRole(role);

    if (unlocked) {
      setIsUnlocked(true);
      setIsCheckingAuth(false);
    } else {
      setShowPinModal(true);
      fetchMasterPin();
      // Even if waiting for PIN, we're not checking basic auth anymore
      setIsCheckingAuth(false);
    }
  }, [router]);

  const fetchMasterPin = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("pin")
        .eq("name", "MASTER_PIN_CONFIG")
        .maybeSingle();

      if (data) {
        setMasterPin(data.pin);
      } else {
        // Fallback to default if not initialized yet
        setMasterPin("0000");
      }
    } catch (e) {
      setMasterPin("0000");
    }
  };

  const verifyActionPin = () => {
    // Both masterPin and a hardcoded backup to avoid total lockout
    if (typedPin === masterPin || typedPin === "0000" || typedPin === "35771419") {
      setIsUnlocked(true);
      setShowPinModal(false);
      sessionStorage.setItem("estoque_unlocked", "true");
      toast.success("Acesso liberado!");
    } else {
      toast.error("PIN incorreto!");
      setTypedPin("");
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/login");
  };

  useEffect(() => {
    if (!isUnlocked) return;

    // Initial fetch
    const fetchSales = async () => {
      setIsLoading(true);
      // Try to join with profiles
      let { data, error } = await supabase
        .from("sales")
        .select("*, profiles!seller_id(name)")
        .order("created_at", { ascending: false })
        .limit(50);

      // Fallback if seller_id column is not in cache yet
      if (error && (error.message?.includes("seller_id") || error.code === "PGRST204")) {
        console.warn("Schema cache out of sync, falling back to simple select");
        const fallback = await supabase
          .from("sales")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        data = fallback.data;
        error = fallback.error;
      }

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
            setSales((prev) => prev.filter((sale) => sale.id !== payload.old.id));
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
  }, [soundEnabled, isUnlocked]);

  const STATUS_FLOW = ["novo", "visualizado", "separando", "separado", "entregue_ou_retirado"];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "novo": return "Novo";
      case "visualizado": return "Visualizado";
      case "separando": return "Separando";
      case "separado": return "Separado";
      case "entregue_ou_retirado": return "Entregue";
      default: return status;
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("sales")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Pedido marcado como ${getStatusLabel(status)}!`);
    }
  };

  const moveStatus = (id: string, currentStatus: string, direction: 'prev' | 'next') => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (direction === 'next' && currentIndex < STATUS_FLOW.length - 1) {
      handleUpdateStatus(id, STATUS_FLOW[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      handleUpdateStatus(id, STATUS_FLOW[currentIndex - 1]);
    }
  };

  const handleRegisterDevice = async () => {
    setIsRegistering(true);
    const success = await registerDeviceForNotifications("estoque");
    if (success) {
      toast.success("Dispositivo ativado para receber notificações!");
    }
    setIsRegistering(false);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('sales').delete().eq('id', deletingId);
    if (error) {
      toast.error("Erro ao excluir venda.");
      console.error(error);
    } else {
      toast.success("Venda excluída com sucesso!");
    }
    setDeletingId(null);
  };


  const executeExportPDF = async () => {
    setIsExporting(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning('Nenhuma venda registrada hoje para exportar.');
        return;
      }

      generateDailyReport(data, today);
      toast.success(`PDF gerado com ${data.length} venda(s)!`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o relatório PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const executeExportYesterdayPDF = async () => {
    setIsExportingYesterday(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning('Nenhuma venda registrada ontem para exportar.');
        return;
      }

      generateDailyReport(data, yesterday);
      toast.success(`PDF de ontem gerado com ${data.length} venda(s)!`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o relatório PDF.');
    } finally {
      setIsExportingYesterday(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSales.map(s => s.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(false); // close modal
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) failed++;
    }
    if (failed > 0) {
      toast.error(`${failed} item(s) não puderam ser excluídos.`);
    } else {
      toast.success(`${ids.length} venda(s) excluída(s) com sucesso!`);
    }
    exitSelectMode();
  };

  const startEditing = (sale: Sale) => {
    setEditingId(sale.id);
    setEditMessage(sale.message);
  };

  const handleEditSave = async (id: string) => {
    if (!editMessage.trim()) {
      toast.error("A mensagem não pode estar vazia.");
      return;
    }
    const { error } = await supabase.from('sales').update({ message: editMessage }).eq('id', id);
    if (error) {
      toast.error("Erro ao salvar alterações.");
      console.error(error);
    } else {
      toast.success("Informações da venda atualizadas!");
      setEditingId(null);
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

  const filteredSales = sales.filter(s => {
    const matchesFilter = filter === "todos" || s.status === filter;
    const dateStr = format(new Date(s.created_at), "dd/MM/yyyy");
    const matchesSearch = s.message.toLowerCase().includes(searchQuery.toLowerCase()) || dateStr.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const PAGE_SIZE = 12;
  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);
  const paginatedSales = filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const novosCount = sales.filter(s => s.status === "novo").length;

  const STATUSES = [
    { value: "novo", label: "Novos" },
    { value: "visualizado", label: "Vistos" },
    { value: "separando", label: "Separando" },
    { value: "separado", label: "Separados" },
    { value: "entregue_ou_retirado", label: "Entregues" },
    { value: "todos", label: "Todos" },
  ] as const;

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Hidden Audio Element for Notification Sound */}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />

      <div className="flex flex-col gap-4">
        {/* Row 1: Title + Sound Toggle + Auth Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Estoque</h2>
            {userRole === 'admin' && <p className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">Administrador</p>}
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs shadow-sm hover:bg-slate-900 transition-all hover:scale-105 active:scale-95"
              >
                <LayoutDashboard className="w-4 h-4" />
                ADM
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-full transition-all duration-300 hover:scale-110 hover:bg-muted/80 active:scale-90 ${mounted && soundEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              title={mounted && soundEnabled ? "Som ativado" : "Som desativado"}
            >
              {!mounted ? (
                <VolumeX className="h-5 w-5" />
              ) : soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={executeExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all duration-300 whitespace-nowrap"
            title="Exportar relatório de hoje em PDF"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            {isExporting ? 'Gerando...' : 'PDF Hoje'}
          </button>
          <button
            onClick={executeExportYesterdayPDF}
            disabled={isExportingYesterday}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold shadow-sm hover:bg-secondary/80 hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all duration-300 whitespace-nowrap"
            title="Exportar relatório de ontem em PDF"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            {isExportingYesterday ? 'Gerando...' : 'PDF Ontem'}
          </button>
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all duration-300 whitespace-nowrap hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${selectMode
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            title={selectMode ? 'Cancelar seleção' : 'Selecionar itens'}
          >
            <CheckSquare className="h-4 w-4 shrink-0" />
            {selectMode ? 'Cancelar' : 'Selecionar'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRegisterDevice}
            disabled={isRegistering}
            className="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-[1.02] hover:shadow-md active:scale-95 text-sm font-medium transition-all duration-300"
          >
            <BellRing className="w-4 h-4" />
            {isRegistering ? "Ativando..." : "Receber Notificações"}
          </button>
          <button
            onClick={handleTestNotification}
            className="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-[1.02] hover:shadow-md active:scale-95 text-sm font-medium transition-all duration-300"
          >
            <Bell className="w-4 h-4" />
            Testar Notificação
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((statusTab) => (
          <button
            key={statusTab.value}
            onClick={() => { setFilter(statusTab.value as any); setCurrentPage(1); }}
            className={`relative flex-1 min-w-max flex items-center justify-center h-[42px] px-3 text-[13px] sm:text-sm font-semibold rounded-xl transition-all duration-300 border hover:scale-[1.03] hover:shadow-md active:scale-95 ${filter === statusTab.value
              ? "bg-card shadow-sm border-border text-foreground ring-1 ring-border"
              : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-border/50"
              }`}
          >
            <span>{statusTab.label}</span>
            {statusTab.value === "novo" && novosCount > 0 && (
              <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 flex items-center justify-center bg-red-600 text-white text-[11px] font-bold min-w-[20px] h-[20px] rounded-full shadow-md z-30 animate-in zoom-in">
                {novosCount > 99 ? '99+' : novosCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por vendedor, cliente, nota, produto ou data (ex: 21/03)..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-input bg-card text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pagination Controls (Top) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-input bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Anterior
          </button>

          <span className="text-sm text-muted-foreground font-medium">
            Página <span className="text-foreground font-bold">{currentPage}</span> de <span className="text-foreground font-bold">{totalPages}</span>
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-input bg-card hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm"
          >
            Próxima
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

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
          <>
            {/* Select-all bar */}
            {selectMode && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted rounded-xl border border-border">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginatedSales.length && paginatedSales.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  Selecionar todos ({paginatedSales.length})
                </label>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setIsBulkDeleting(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold shadow-sm hover:bg-destructive/90 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir {selectedIds.size} selecionado(s)
                  </button>
                )}
              </div>
            )}

            {paginatedSales.map((sale) => (
              <div key={sale.id} className="relative">
                {/* Checkbox overlay (only in selectMode) */}
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(sale.id)}
                    className={`absolute left-3 top-3 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(sale.id)
                      ? 'bg-primary border-primary'
                      : 'bg-card border-slate-300 hover:border-primary'
                      }`}
                  >
                    {selectedIds.has(sale.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </button>
                )}
                <div
                  className={`p-4 rounded-xl border transition-all ${selectMode ? 'pl-10 cursor-pointer' : ''} ${selectedIds.has(sale.id) ? 'ring-2 ring-primary' :
                    sale.status === 'novo' ? 'bg-card border-primary/20 shadow-sm border-l-4 border-l-primary' :
                      sale.status === 'visualizado' ? 'bg-amber-500/5 border-amber-500/20 border-l-4 border-l-amber-500' :
                        sale.status === 'separando' ? 'bg-blue-500/5 border-blue-500/20 border-l-4 border-l-blue-500' :
                          sale.status === 'separado' ? 'bg-emerald-500/5 border-emerald-500/20 border-l-4 border-l-emerald-500' :
                            'bg-muted/30 border-dashed border-border opacity-75'
                    }`}
                  onClick={() => selectMode && toggleSelect(sale.id)}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    {editingId === sale.id ? (
                      <div className="w-full mr-2 flex flex-col gap-2">
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className="w-full p-3 border border-input rounded-xl text-sm min-h-[110px] bg-background focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        />
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => handleEditSave(sale.id)} className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-primary/90 flex-1">Salvar Alterações</button>
                          <button onClick={() => setEditingId(null)} className="text-xs bg-muted text-muted-foreground px-4 py-2 rounded-lg font-semibold border border-border hover:bg-muted/80 flex-1">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-semibold text-[15px] leading-relaxed text-foreground whitespace-pre-line flex-1">
                        {sale.message}
                      </p>
                    )}

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${sale.status === 'novo' ? 'bg-primary/20 text-blue-400 border border-primary/30' :
                        sale.status === 'visualizado' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          sale.status === 'separando' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            sale.status === 'separado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              'bg-muted text-muted-foreground border border-border'
                        }`}>
                        {sale.status === 'entregue_ou_retirado' ? 'ENTREGUE/RETIR.' : sale.status}
                      </span>

                      <div className="flex items-center gap-1 mt-1 justify-end">
                        {editingId !== sale.id && (
                          <>
                            <button onClick={() => startEditing(sale)} className="text-muted-foreground hover:text-blue-500 transition-all duration-300 p-1.5 rounded-md hover:bg-muted hover:scale-110 active:scale-90" title="Editar Venda">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {userRole === 'admin' && (
                              <button onClick={() => handleDelete(sale.id)} className="text-muted-foreground hover:text-red-500 transition-all duration-300 p-1.5 rounded-md hover:bg-muted hover:scale-110 active:scale-90" title="Excluir Venda Permanentemente">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap mt-0.5">
                        {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {sale.status !== 'novo' && (
                      <button
                        onClick={() => moveStatus(sale.id, sale.status, 'prev')}
                        className="flex-1 min-w-[100px] flex items-center justify-center gap-2 bg-muted text-muted-foreground h-10 rounded-lg text-sm font-semibold transition-all duration-300 hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98] border border-border"
                      >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Voltar
                      </button>
                    )}

                    {sale.status !== 'entregue_ou_retirado' ? (
                      <button
                        onClick={() => moveStatus(sale.id, sale.status, 'next')}
                        className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] ${sale.status === 'novo' ? 'bg-primary text-primary-foreground hover:bg-primary/90' :
                          sale.status === 'visualizado' ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm' :
                            sale.status === 'separando' ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm' :
                              'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                          }`}
                      >
                        {sale.status === 'novo' ? 'Visto' :
                          sale.status === 'visualizado' ? 'Separar' :
                            sale.status === 'separando' ? 'Pronto' :
                              'Entregar'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 h-10 rounded-lg text-sm font-bold border border-emerald-200 dark:border-emerald-800/50 pointer-events-none">
                        <Check className="w-4 h-4" />
                        Finalizado
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/40 px-2 py-1 rounded-md border border-border">
                      <Package className="w-3.5 h-3.5 opacity-60" />
                      ID: {sale.id.slice(0, 8)}
                    </div>
                    {sale.profiles?.name && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                        <Users className="w-3 h-3" />
                        Vendedor: {sale.profiles.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-input bg-card hover:bg-muted hover:scale-[1.05] hover:shadow-md active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Anterior
          </button>

          <span className="text-sm text-muted-foreground font-medium">
            Página <span className="text-foreground font-bold">{currentPage}</span> de <span className="text-foreground font-bold">{totalPages}</span>
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-input bg-card hover:bg-muted hover:scale-[1.05] hover:shadow-md active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
          >
            Próxima
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-[1.25rem] shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-destructive" />
                Excluir Venda
              </h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Tem certeza que deseja apagar este bilhete de venda do sistema permanentemente? Esta ação **não** poderá ser desfeita.
              </p>
            </div>
            <div className="bg-muted p-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 text-sm font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-[1.25rem] shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-destructive" />
                Excluir {selectedIds.size} Venda(s)
              </h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Você está prestes a excluir <strong>{selectedIds.size} venda(s)</strong> permanentemente. Esta ação não poderá ser desfeita.
              </p>
            </div>
            <div className="bg-muted p-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsBulkDeleting(false)}
                className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-5 py-2.5 text-sm font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                Sim, Excluir Todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Access Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Área Restrita</h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Digite a senha extra para acessar o estoque e gerar relatórios.</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="DIGITE O PIN"
                  className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-200 placeholder:text-sm placeholder:tracking-normal"
                  value={typedPin}
                  onChange={(e) => setTypedPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  onKeyDown={(e) => e.key === 'Enter' && verifyActionPin()}
                />
              </div>

              <button
                onClick={verifyActionPin}
                className="w-full h-14 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                DESBLOQUEAR ACESSO
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full h-12 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
              >
                Voltar para Início
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
