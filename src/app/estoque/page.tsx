"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { requestForToken, onMessageListener } from "@/lib/firebase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BellRing, Check, Bell, VolumeX, Volume2, Search, ArrowRight, ShieldCheck, X, Pencil, Trash2, FileDown, CheckSquare } from "lucide-react";
import { generateDailyReport } from "@/lib/pdfReport";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const ensureServiceWorkerAndToken = async () => {
        const token = await requestForToken();
        if (token) {
          const { error } = await supabase.from("device_tokens").upsert(
            { fcm_token: token, role: "estoque", active: true },
            { onConflict: 'fcm_token' }
          );
          if (error) throw error;
          toast.success("Dispositivo ativado para receber notificações!");
        } else {
          toast.warning("Não foi possível obter o token de notificação.");
        }
      };

      const requestPermission = async () => {
        try {
          if (!('Notification' in window)) {
            toast.error("Seu navegador não suporta notificações.");
            return;
          }

          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            toast.success("Permissão concedida! Registrando dispositivo...");
            await ensureServiceWorkerAndToken();
          } else {
            toast.error("Permissão de notificação negada.");
          }
        } catch (error) {
          console.error(error);
          toast.error("Erro ao solicitar permissão.");
        }
      };
      await requestPermission();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar dispositivo.");
    } finally {
      setIsRegistering(false);
    }
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

  const handleExportPDF = async () => {
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

  const handleExportYesterdayPDF = async () => {
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Hidden Audio Element for Notification Sound */}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />

      <div className="flex flex-col gap-4">
        {/* Row 1: Title + Sound Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Estoque</h2>
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

        {/* Row 2: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all duration-300 whitespace-nowrap"
            title="Exportar relatório de hoje em PDF"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            {isExporting ? 'Gerando...' : 'PDF Hoje'}
          </button>
          <button
            onClick={handleExportYesterdayPDF}
            disabled={isExportingYesterday}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold shadow-sm hover:bg-secondary/80 hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 transition-all duration-300 whitespace-nowrap"
            title="Exportar relatório de ontem em PDF"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            {isExportingYesterday ? 'Gerando...' : 'PDF Ontem'}
          </button>
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all duration-300 whitespace-nowrap hover:scale-[1.03] hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${
              selectMode
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
              <span className="absolute -top-2 -right-2 flex items-center justify-center bg-destructive text-destructive-foreground text-[11px] font-bold min-w-[22px] h-[22px] px-1 rounded-full shadow-sm z-10 animate-in zoom-in">
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${sale.status === 'novo' ? 'bg-primary/10 text-primary border border-primary/20' :
                          sale.status === 'visualizado' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            sale.status === 'separando' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                              sale.status === 'separado' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
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
                            <button onClick={() => handleDelete(sale.id)} className="text-muted-foreground hover:text-red-500 transition-all duration-300 p-1.5 rounded-md hover:bg-muted hover:scale-110 active:scale-90" title="Excluir Venda Permanentemente">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap mt-0.5">
                        {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {sale.status === 'novo' && (
                      <button
                        onClick={() => handleUpdateStatus(sale.id, 'visualizado')}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-500 h-10 rounded-lg text-sm font-semibold transition-all duration-300 hover:bg-amber-500/20 hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]"
                      >
                        Visualizado
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {sale.status === 'visualizado' && (
                      <button
                        onClick={() => handleUpdateStatus(sale.id, 'separando')}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-500 h-10 rounded-lg text-sm font-semibold transition-all duration-300 hover:bg-blue-500/20 hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]"
                      >
                        Separando
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {sale.status === 'separando' && (
                      <button
                        onClick={() => handleUpdateStatus(sale.id, 'separado')}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-emerald-500 text-white h-10 rounded-lg text-sm font-semibold transition-all duration-300 hover:bg-emerald-600 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                      >
                        Separado
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}

                    {sale.status === 'separado' && (
                      <button
                        onClick={() => handleUpdateStatus(sale.id, 'entregue_ou_retirado')}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 h-10 rounded-lg text-sm font-semibold transition-all duration-300 hover:opacity-90 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                      >
                        Entregue / Retirado
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    {sale.status === 'entregue_ou_retirado' && (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-muted text-muted-foreground h-10 rounded-lg text-sm font-semibold pointer-events-none">
                        <Check className="w-4 h-4" />
                        Pedido Finalizado
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
    </div>
  );
}
