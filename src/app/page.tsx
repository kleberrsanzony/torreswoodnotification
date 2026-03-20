"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SendHorizontal, Loader2 } from "lucide-react";

export default function Home() {
  const [product, setProduct] = useState("");
  const [length, setLength] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedMessage = `${quantity || "[qnt]"} ${product || "[produto]"} de ${length || "[medida]"} metros — vendido`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !length || !quantity) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setIsSubmitting(true);
    const finalMessage = `${quantity} ${product} de ${length} metros — vendido`;

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
      
      // Reset form
      setProduct("");
      setLength("");
      setQuantity("");
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
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Resumo da mensagem</p>
          <p className="font-medium text-foreground">{formattedMessage}</p>
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
