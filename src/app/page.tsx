"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SendHorizontal, Loader2, ChevronDown, Check } from "lucide-react";

export default function Home() {
  const [product, setProduct] = useState("");
  const [length, setLength] = useState("");
  const [quantity, setQuantity] = useState("");
  
  // New Fields
  const [vendedor, setVendedor] = useState("");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVendedorOpen, setIsVendedorOpen] = useState(false);

  const vendedores = ['Kleber', 'Jackson', 'Deidiviane', 'Márcio', 'Mauro', 'Mayara'];

  // Formatar cabeçalho opcional
  const headerParts = [];
  if (vendedor) headerParts.push(`Vendedor: ${vendedor}`);
  if (cliente) headerParts.push(`Cliente: ${cliente}`);
  if (nota) headerParts.push(`Nota: ${nota}`);
  const headerText = headerParts.length > 0 ? headerParts.join(" | ") : "";

  const formattedMessage = `${headerText ? headerText + "\n" : ""}${quantity || "[qnt]"} ${product || "[produto]"} de ${length || "[medida]"} metros — vendido`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !length || !quantity) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setIsSubmitting(true);
    const finalMessage = `${headerText ? headerText + "\n" : ""}${quantity} ${product} de ${length} metros — vendido`;

    try {
      // 1. Insert into Supabase
      const { error: dbError } = await supabase.from("sales").insert({
        product,
        length_meters: parseFloat(length),
        quantity: parseInt(quantity, 10),
        message: finalMessage,
        status: "novo",
      });

      if (dbError) throw dbError;

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
      
      // Reset form (keeping vendedor as it usually remains the same for the session)
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Nova Venda</h2>
        <p className="text-muted-foreground">Registre os itens vendidos abaixo.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* NEW FIELDS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border pb-5 mb-1">
          <div className="flex flex-col gap-2">
            <label htmlFor="vendedor" className="text-sm font-medium">Vendedor</label>
            <div className="relative">
              <button
                id="vendedor"
                type="button"
                onClick={() => setIsVendedorOpen(!isVendedorOpen)}
                disabled={isSubmitting}
                className={`flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${!vendedor ? 'text-slate-500' : 'text-slate-900'}`}
              >
                {vendedor || "Selecione um vendedor"}
                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${isVendedorOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isVendedorOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsVendedorOpen(false)}></div>
                  <div className="absolute z-[60] top-[calc(100%+8px)] left-0 w-full bg-white/85 backdrop-blur-3xl border border-slate-200 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-[200px] overflow-y-auto p-1.5 flex flex-col gap-1">
                      {vendedores.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            setVendedor(v);
                            setIsVendedorOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors ${
                            vendedor === v 
                              ? 'bg-primary/10 text-primary font-medium' 
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {v}
                          {vendedor === v && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
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

        <div className="flex flex-col gap-2">
          <label htmlFor="product" className="text-sm font-medium">Produto</label>
          <input
            id="product"
            type="text"
            placeholder="Ex: caibros, vigas..."
            className="flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            disabled={isSubmitting}
            required
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
              required
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
              required
            />
          </div>
        </div>

        <div className="mt-2 rounded-xl bg-muted p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Resumo da mensagem</p>
          <p className="font-medium text-foreground whitespace-pre-line leading-relaxed">{formattedMessage}</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 w-full shadow-md active:scale-[0.98]"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <SendHorizontal className="mr-2 h-5 w-5" />
          )}
          {isSubmitting ? "Enviando..." : "Enviar Venda"}
        </button>
      </form>
    </div>
  );
}
