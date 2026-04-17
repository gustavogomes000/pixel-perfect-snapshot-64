import { useEffect, useState } from "react";
import { Key, UserPlus, Trash2, RefreshCw, Copy, Pencil, KeyRound, LogOut, Calendar, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseDb";
import { useAdmin, painelLogout } from "@/hooks/useAdmin";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseDb";
import { invalidateSiteConfig } from "@/hooks/useSiteConfig";

const PAINEL_AUTH_URL = `${SUPABASE_URL}/functions/v1/painel-auth`;

async function painelApi(body: Record<string, unknown>) {
  const res = await fetch(PAINEL_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

interface PainelUser {
  id: string;
  nome: string;
}

const SettingsPage = () => {
  useAdmin();
  const navigate = useNavigate();
  const [apiToken, setApiToken] = useState("");
  const [agendaAtiva, setAgendaAtiva] = useState(true);
  const [galeriaAtiva, setGaleriaAtiva] = useState(true);
  const [users, setUsers] = useState<PainelUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] = useState<PainelUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [resetUser, setResetUser] = useState<PainelUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: tokenData } = await supabase.from("configuracoes" as any).select("valor").eq("chave", "api_token").maybeSingle();
    if (tokenData) setApiToken((tokenData as any).valor || "");

    const { data: cfgRows } = await supabase
      .from("configuracoes" as any)
      .select("chave, valor")
      .in("chave", ["agenda_ativa", "galeria_ativa"]);
    const map: Record<string, string> = {};
    for (const r of (cfgRows as any[]) || []) map[r.chave] = r.valor;
    setAgendaAtiva(String(map.agenda_ativa ?? "true").toLowerCase() === "true");
    setGaleriaAtiva(String(map.galeria_ativa ?? "true").toLowerCase() === "true");

    try {
      const data = await painelApi({ action: "list" });
      if (data?.users) setUsers(data.users);
    } catch {
      console.error("Erro ao carregar usuários");
    }
  };

  const saveConfig = async (chave: string, valor: boolean) => {
    const { data: existing } = await supabase
      .from("configuracoes" as any)
      .select("id")
      .eq("chave", chave)
      .maybeSingle();
    if (existing) {
      await supabase.from("configuracoes" as any).update({ valor: String(valor) } as any).eq("chave", chave);
    } else {
      await supabase.from("configuracoes" as any).insert({ chave, valor: String(valor) } as any);
    }
    invalidateSiteConfig();
  };

  const toggleAgenda = async (checked: boolean) => {
    setAgendaAtiva(checked);
    try {
      await saveConfig("agenda_ativa", checked);
      toast.success(checked ? "Agenda ativada no site" : "Agenda desativada no site");
    } catch { toast.error("Erro ao salvar"); setAgendaAtiva(!checked); }
  };

  const toggleGaleria = async (checked: boolean) => {
    setGaleriaAtiva(checked);
    try {
      await saveConfig("galeria_ativa", checked);
      toast.success(checked ? "Galeria ativada no site" : "Galeria desativada no site");
    } catch { toast.error("Erro ao salvar"); setGaleriaAtiva(!checked); }
  };

  const regenerateToken = async () => {
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await supabase.from("configuracoes" as any).update({ valor: newToken } as any).eq("chave", "api_token");
    setApiToken(newToken);
    toast.success("Token regenerado");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const createUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) { toast.error("Preencha usuário e senha"); return; }
    if (newUsername.length < 3) { toast.error("Usuário deve ter pelo menos 3 caracteres"); return; }
    if (newPassword.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }

    setCreating(true);
    try {
      const data = await painelApi({ action: "create", nome: newUsername.trim(), senha: newPassword });
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`Usuário "${newUsername}" criado!`);
      setNewUsername(""); setNewPassword("");
      loadData();
    } catch { toast.error("Erro ao criar usuário"); }
    finally { setCreating(false); }
  };

  const removeUser = async (userId: string, nome: string) => {
    try {
      const data = await painelApi({ action: "delete", user_id: userId });
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`Usuário "${nome}" removido`);
      loadData();
    } catch { toast.error("Erro ao remover usuário"); }
  };

  const handleEditUsername = async () => {
    if (!editingUser || !editUsername.trim()) return;
    if (editUsername.length < 3) { toast.error("Nome deve ter pelo menos 3 caracteres"); return; }

    setEditSaving(true);
    try {
      const data = await painelApi({ action: "update-name", user_id: editingUser.id, nome: editUsername.trim() });
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Nome atualizado!");
      setEditingUser(null);
      loadData();
    } catch { toast.error("Erro ao atualizar nome"); }
    finally { setEditSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword.trim()) return;
    if (resetPassword.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }

    setResetSaving(true);
    try {
      const data = await painelApi({ action: "reset-password", user_id: resetUser.id, senha: resetPassword });
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Senha redefinida!");
      setResetUser(null); setResetPassword("");
    } catch { toast.error("Erro ao redefinir senha"); }
    finally { setResetSaving(false); }
  };

  const handleLogout = () => { painelLogout(); navigate("/admin/login"); };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold">Configurações</h2>
        </div>

        {/* API Token */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Token da API</h3>
          </div>
          <div className="flex gap-1.5">
            <Input value={apiToken} readOnly className="font-mono text-[10px] h-9" />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(apiToken)}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={regenerateToken}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Use como Bearer Token no header Authorization.</p>
        </div>

        {/* User Management */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Gerenciar Usuários</h3>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <Input placeholder="Nome de usuário" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="off" className="h-9 text-sm" />
              <Input placeholder="Senha" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="h-9 text-sm" />
            </div>
            <Button onClick={createUser} disabled={creating} className="rounded-full w-full h-9 text-sm">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>

          <div className="space-y-2 pt-4 border-t">
            {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>}
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                <p className="text-sm font-medium">{u.nome}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setEditUsername(u.nome); }} title="Editar nome"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setResetUser(u); setResetPassword(""); }} title="Redefinir senha"><KeyRound className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeUser(u.id, u.nome)} className="text-destructive hover:bg-destructive/10" title="Remover"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Nome de Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Novo nome</Label><Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="mt-1" autoComplete="off" /></div>
            <Button onClick={handleEditUsername} disabled={editSaving} className="w-full rounded-full">{editSaving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir Senha — {resetUser?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Nova senha</Label><Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="mt-1" placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></div>
            <Button onClick={handleResetPassword} disabled={resetSaving} className="w-full rounded-full">{resetSaving ? "Salvando..." : "Redefinir Senha"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SettingsPage;
