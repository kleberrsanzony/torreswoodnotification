"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SendHorizontal, Loader2, ChevronDown, Check, Plus, Trash2, Pencil, X, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";

interface SaleItem {
  product: string;
  length: string;
  quantity: string;
}

export default function Home() {
  // Single product inputs (temporary)
  const [product, setProduct] = useState("");
  const [length, setLength] = useState("");
  const [quantity, setQuantity] = useState("");

  // List of added items
  const [items, setItems] = useState<SaleItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Header Fields
  const [vendedor, setVendedor] = useState("");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVendedorOpen, setIsVendedorOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState("");

  const router = useRouter();

  useEffect(() => {
    const userId = sessionStorage.getItem("user_id");
    const userName = sessionStorage.getItem("user_name");
    
    if (!userId || !userName) {
      router.push("/login");
    } else {
      setVendedor(userName);
      setIsCheckingAuth(false);
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/login");
  };

  const handleAddItem = () => {
    if (!product || !length || !quantity) {
      toast.error("Preencha produto, medida e quantidade para adicionar.");
      return;
    }
    const newItem: SaleItem = { product, length, quantity };
    setItems([...items, newItem]);
    
    // Reset individual inputs
    setProduct("");
    setLength("");
    setQuantity("");
    toast.success("Item adicionado à lista!");
  };

  const handleStartEdit = (index: number) => {
    const item = items[index];
    setProduct(item.product);
    setLength(item.length);
    setQuantity(item.quantity);
    setEditingIndex(index);
    toast.info("Editando item...");
  };

  const handleSaveEdit = () => {
    if (!product || !length || !quantity) {
      toast.error("Preencha todos os campos para salvar a edição.");
      return;
    }
    const updatedItems = [...items];
    updatedItems[editingIndex!] = { product, length, quantity };
    setItems(updatedItems);
    setEditingIndex(null);
    
    // Reset individual inputs
    setProduct("");
    setLength("");
    setQuantity("");
    toast.success("Item atualizado!");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setProduct("");
    setLength("");
    setQuantity("");
  };

  const handleRemoveItem = (index: number) => {
    if (editingIndex === index) {
      handleCancelEdit();
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Formatar cabeçalho
  const headerParts = [];
  if (vendedor) headerParts.push(`Vendedor: ${vendedor} | TORRES`);
  if (cliente) headerParts.push(`Cliente: ${cliente}`);
  if (nota) headerParts.push(`Nota: ${nota}`);
  const headerText = headerParts.length > 0 ? headerParts.join(" | ") : "";

  // Formatar a mensagem final
  const buildMessage = (itemList: SaleItem[]) => {
    if (itemList.length === 0) return "";
    const itemsLines = itemList.map(item => `${item.quantity} ${item.product} de ${item.length} metros`).join("\n");
    return `${headerText ? headerText + "\n" : ""}${itemsLines}\n— vendido`;
  };

  const formattedMessagePreview = items.length > 0 
    ? buildMessage(items) 
    : (product || length || quantity) 
      ? `${headerText ? headerText + "\n" : ""}${quantity || "[qnt]"} ${product || "[produto]"} de ${length || "[medida]"} metros — vendido`
      : "Adicione itens para ver o resumo...";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalItems = [...items];
    
    // If there's something in the current inputs but not added to list, add it automatically
    // (Only if not in editing mode, as editing mode implies the item is already in the list)
    if (editingIndex === null && product && length && quantity) {
      finalItems.push({ product, length, quantity });
    }

    if (finalItems.length === 0) {
      toast.error("Por favor, adicione pelo menos um produto.");
      return;
    }

    setIsSubmitting(true);
    const finalMessage = buildMessage(finalItems);

    try {
      // 1. Check for Duplicate Nota
      if (nota.trim()) {
        const { data: existingNota } = await supabase
          .from("sales")
          .select("id")
          .eq("nota", nota.trim())
          .maybeSingle();
        
        if (existingNota) {
          setErrorModalMsg(`A Nota #${nota} já foi registrada anteriormente por outro vendedor ou em outra venda!`);
          setShowErrorModal(true);
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Insert into Supabase
      const saleData: any = {
        product: finalItems.length > 1 ? `Venda com ${finalItems.length} itens` : finalItems[0].product,
        length_meters: finalItems.length === 1 ? parseFloat(finalItems[0].length) : 0,
        quantity: finalItems.length === 1 ? parseInt(finalItems[0].quantity, 10) : finalItems.length,
        message: finalMessage,
        status: "novo",
        seller_id: sessionStorage.getItem("user_id"),
        nota: nota.trim() || null,
      };

      let { error: dbError } = await supabase.from("sales").insert(saleData);

      // Fallback if 'nota' column doesn't exist yet
      if (dbError && dbError.message?.includes("nota")) {
        console.warn("Coluna 'nota' não encontrada. Tentando registrar sem o campo...");
        delete saleData.nota;
        const { error: fallbackError } = await supabase.from("sales").insert(saleData);
        if (fallbackError) throw fallbackError;
      } else if (dbError && (dbError.message?.includes("seller_id") || dbError.code === "PGRST204")) {
        // Fallback if seller_id column not yet in cache
        console.warn("Aguardando sincronização do banco... Registrando sem vínculo temporariamente.");
        delete saleData.seller_id;
        const { error: fallbackError } = await supabase.from("sales").insert(saleData);
        if (fallbackError) throw fallbackError;
      } else if (dbError) {
        throw dbError;
      }

      // 2. Trigger Push Notification to Estoque
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Nova Venda Registrada",
          body: finalMessage,
        }),
      });

      if (!res.ok) {
        console.warn("Falha ao enviar notificação push, mas a venda foi registrada.");
      }

      toast.success("Venda enviada para o estoque com sucesso!");

      // Reset form
      setItems([]);
      setEditingIndex(null);
      setProduct("");
      setLength("");
      setQuantity("");
      setCliente("");
      setNota("");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao registrar venda: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Venda</h2>
          <p className="text-muted-foreground">Registre os itens vendidos abaixo.</p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* HEADER FIELDS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Vendedor</label>
            <div className="flex items-center gap-3 h-12 w-full rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm text-foreground font-bold">
              <UserIcon className="w-4 h-4 text-primary" />
              {vendedor}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="cliente" className="text-sm font-medium">Cliente</label>
            <input
              id="cliente"
              type="text"
              placeholder="Nome do cliente"
              className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="nota" className="text-sm font-medium">Nº Nota/Pedido</label>
            <input
              id="nota"
              type="text"
              placeholder="Ex: 12345"
              className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ITEMS LIST (IF ANY) */}
        {items.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Itens Adicionados</h3>
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 animate-in slide-in-from-left-2 ${
                    editingIndex === idx 
                      ? 'bg-primary/10 border-primary ring-2 ring-primary/20' 
                      : 'bg-primary/5 border-primary/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{item.quantity} {item.product}</span>
                    <span className="text-xs text-muted-foreground">{item.length} metros</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleStartEdit(idx)}
                      disabled={isSubmitting}
                      className={`p-2 transition-colors ${editingIndex === idx ? 'text-primary' : 'text-muted-foreground hover:text-blue-500'}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleRemoveItem(idx)}
                      disabled={isSubmitting}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INPUT FIELDS FOR NEW/EDIT ITEM */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-4 transition-all duration-300 ${
          editingIndex !== null 
            ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10' 
            : 'bg-muted/30 border-dashed border-border'
        }`}>
          <div className="flex items-center justify-between">
            <label htmlFor="product" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {editingIndex !== null ? "Editando Item" : "Novo Produto"}
            </label>
            {editingIndex !== null && (
              <button 
                onClick={handleCancelEdit}
                className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" /> Cancelar Edição
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <input
              id="product"
              type="text"
              placeholder="Ex: caibros, vigas..."
              className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="length" className="text-sm font-medium">Medida (metros)</label>
              <input
                id="length"
                type="number"
                step="0.01"
                placeholder="Ex: 3"
                className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="quantity" className="text-sm font-medium">Quantidade</label>
              <input
                id="quantity"
                type="number"
                placeholder="Ex: 4"
                className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {editingIndex !== null ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md transition-all hover:bg-blue-700 active:scale-95"
              >
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="px-4 flex items-center justify-center h-11 rounded-xl bg-muted border border-border text-sm font-bold transition-all hover:bg-muted/80 active:scale-95"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddItem}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm font-bold shadow-sm transition-all hover:bg-primary/10 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Adicionar à Lista
            </button>
          )}
        </div>

        {/* PREVIEW AND SEND */}
        <div className="mt-2 rounded-xl bg-muted p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Resumo da mensagem</p>
          <p className="font-medium text-foreground whitespace-pre-line leading-relaxed italic opacity-80">{formattedMessagePreview}</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 h-14 w-full shadow-md active:scale-[0.98]"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <SendHorizontal className="mr-2 h-5 w-5" />
          )}
          {isSubmitting ? "Enviando..." : items.length > 0 ? `Enviar Venda (${items.length} itens)` : "Enviar Venda"}
        </button>
      </div>
      {/* Duplicate Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                <X className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-foreground tracking-tight mb-2">Nota Duplicada!</h2>
              <p className="text-muted-foreground font-medium text-sm leading-relaxed mb-8">
                {errorModalMsg}
              </p>
              <button 
                onClick={() => setShowErrorModal(false)}
                className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
              >
                ENTENDI, VOU CONFERIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
