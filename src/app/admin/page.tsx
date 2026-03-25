"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  UserPlus, 
  Users, 
  Shield, 
  LogOut, 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Loader2, 
  Lock, 
  X,
  UserCheck,
  UserX
} from "lucide-react";

interface Profile {
  id: string;
  name: string;
  pin: string;
  role: string;
  active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    pin: "",
    role: "seller",
    active: true
  });
  const [masterPin, setMasterPin] = useState("");
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const role = sessionStorage.getItem("user_role");
    if (role !== "admin") {
      toast.error("Acesso negado.");
      router.push("/");
    } else {
      setIsCheckingAuth(false);
      fetchProfiles();
      fetchMasterPin();
    }
  }, []);

  const fetchMasterPin = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("pin")
      .eq("name", "MASTER_PIN_CONFIG")
      .single();

    if (data) {
      setMasterPin(data.pin);
    } else {
      // Initialize if not exists
      await supabase.from("profiles").insert([{
        name: "MASTER_PIN_CONFIG",
        pin: "0000",
        role: "admin",
        active: false
      }]);
      setMasterPin("0000");
    }
  };

  const updateMasterPin = async () => {
    if (!masterPin) return;
    setIsUpdatingMaster(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pin: masterPin })
      .eq("name", "MASTER_PIN_CONFIG");

    if (error) toast.error("Erro ao atualizar!");
    else toast.success("Senha atualizada!");
    setIsUpdatingMaster(false);
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar usuários");
    } else {
      setProfiles(data || []);
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    router.push("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.pin) {
      toast.error("Nome e PIN são obrigatórios");
      return;
    }

    setIsSaving(true);
    if (editingProfile) {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", editingProfile.id);

      if (error) {
        toast.error("Erro ao atualizar");
      } else {
        toast.success("Atualizado!");
        setIsModalOpen(false);
        fetchProfiles();
      }
    } else {
      const { error } = await supabase
        .from("profiles")
        .insert([formData]);

      if (error) {
        toast.error("Erro ao criar");
      } else {
        toast.success("Criado!");
        setIsModalOpen(false);
        fetchProfiles();
      }
    }
    setIsSaving(false);
  };

  const openNewUser = () => {
    setEditingProfile(null);
    setFormData({ name: "", pin: "", role: "seller", active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      pin: profile.pin,
      role: profile.role,
      active: profile.active
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (profile: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !profile.active })
      .eq("id", profile.id);

    if (error) {
      toast.error("Erro ao alterar");
    } else {
      fetchProfiles();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir permanentemente?")) {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      if (error) toast.error("Erro ao excluir");
      else fetchProfiles();
    }
  };

  if (isCheckingAuth) return null;

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/estoque")} className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button onClick={handleLogout} className="text-rose-500 font-bold text-sm uppercase">Sair</button>
      </div>

      <div>
        <h1 className="text-4xl font-black tracking-tighter text-foreground">Usuários</h1>
        <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest mt-1">Gestão de Equipe</p>
      </div>

      <button 
        onClick={openNewUser}
        className="flex items-center justify-center gap-3 w-full h-14 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-200 active:scale-95 transition-all"
      >
        <UserPlus className="w-5 h-5" /> NOVO VENDEDOR
      </button>

      {/* Global Config Section */}
      <div className="bg-card border border-border p-6 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight text-foreground">Configurações Extras</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Senha para Estoque & PDFs</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nova Senha"
            className="flex-1 h-12 bg-muted border border-border rounded-xl px-4 font-mono font-bold text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            value={masterPin}
            onChange={(e) => setMasterPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <button 
            onClick={updateMasterPin}
            disabled={isUpdatingMaster}
            className="h-12 px-6 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center"
          >
            {isUpdatingMaster ? <Loader2 className="w-4 h-4 animate-spin" /> : "SALVAR"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3 pb-20">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 font-bold">Carregando...</div>
        ) : profiles.map((p) => (
          <div key={p.id} className={`p-5 rounded-3xl border transition-all duration-300 ${p.active ? 'bg-card border-border shadow-sm shadow-black/5 hover:shadow-md' : 'bg-muted/30 border-dashed border-border opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${p.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-primary/10 text-primary'}`}>
                  {p.role === 'admin' ? <Shield className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-lg text-foreground leading-tight truncate">{p.name}</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${p.role === 'admin' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {p.role === 'admin' ? 'ADMIN' : 'VENDEDOR'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(p)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleToggleActive(p)} className={`p-2 transition-colors ${p.active ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-400'}`}>
                  {p.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                </button>
                {p.name !== 'Kleber' && <button onClick={() => handleDelete(p.id)} className="p-2 text-muted-foreground hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-muted-foreground">
                <Lock className="w-3.5 h-3.5 opacity-40" /> PIN: {p.pin}
              </div>
              <span className={`text-[10px] font-black ${p.active ? 'text-emerald-500' : 'text-muted-foreground'}`}>{p.active ? 'ATIVO' : 'INATIVO'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <form onSubmit={handleSubmit} className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tight text-foreground">{editingProfile ? "Editar" : "Novo Usuário"}</h2>
              <button onClick={() => setIsModalOpen(false)} type="button" className="p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4 text-foreground">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Nome</label>
                <input type="text" required className="w-full h-12 px-4 bg-muted border border-border rounded-xl font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-muted-foreground" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-1">PIN</label>
                <input type="text" required className="w-full h-12 px-4 bg-muted border border-border rounded-xl font-mono font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none transition-all" value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, "")})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData({...formData, role: 'seller'})} className={`h-12 rounded-xl border font-bold text-sm transition-all ${formData.role === 'seller' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-muted/50 border-border text-muted-foreground'}`}>Vendedor</button>
                <button type="button" onClick={() => setFormData({...formData, role: 'admin'})} className={`h-12 rounded-xl border font-bold text-sm transition-all ${formData.role === 'admin' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-sm' : 'bg-muted/50 border-border text-muted-foreground'}`}>Admin</button>
              </div>
              <button type="submit" disabled={isSaving} className="w-full h-14 bg-blue-600 text-white font-black rounded-2xl shadow-lg mt-4">{isSaving ? "Salvando..." : "SALVAR"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
