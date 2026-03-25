"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { User, Lock, Loader2, ChevronRight, ShieldCheck } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export default function LoginPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, active")
      .eq("active", true)
      .order("name");

    if (error) {
      toast.error("Erro ao carregar vendedores");
      console.error(error);
    } else {
      setProfiles(data || []);
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !pin) return;

    setIsVerifying(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", selectedProfile.id)
      .eq("pin", pin)
      .single();

    if (error || !data) {
      toast.error("PIN incorreto!");
      setPin("");
    } else {
      toast.success(`Bem-vindo, ${data.name}!`);
      // Save full profile to sessionStorage
      sessionStorage.setItem("user_id", data.id);
      sessionStorage.setItem("user_name", data.name);
      sessionStorage.setItem("user_role", data.role);
      
      router.push("/");
    }
    setIsVerifying(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden transition-colors duration-300">
      {/* Decorative Circles */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md z-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-card border border-border shadow-xl flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-300">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">CALCCARD <span className="text-primary">TORRES</span></h1>
          <p className="text-muted-foreground font-medium">Selecione seu nome para entrar</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-border/50">
          {!selectedProfile ? (
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedProfile(profile)}
                  className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group shadow-sm active:scale-95 hover:pl-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{profile.name}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-all opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-6 py-2">
              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">Acessando como</p>
                  <p className="text-xl font-black text-foreground">{selectedProfile.name}</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setSelectedProfile(null); setPin(""); }}
                  className="ml-auto p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Trocar
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground ml-1">Senha PIN</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoFocus
                    className="w-full h-16 pl-12 pr-4 bg-muted border border-border rounded-2xl text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-center text-foreground"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    disabled={isVerifying}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying || !pin}
                className="w-full h-16 rounded-2xl bg-primary text-white font-black text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  "Entrar no Sistema"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-8 text-sm text-slate-400 font-medium">
          Sistema de Notificações Torres Casa & Construção
        </p>
      </div>
    </div>
  );
}
