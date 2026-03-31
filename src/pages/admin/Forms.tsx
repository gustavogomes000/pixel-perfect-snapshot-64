import { useEffect, useState } from "react";
import { Search, Download, Phone, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseDb";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";

interface Mensagem {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  mensagem: string;
  criado_em: string;
  endereco_ip: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  user_agent: string | null;
  latitude: number | null;
  longitude: number | null;
  lida: boolean;
}

const Forms = () => {
  useAdmin();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  

  useEffect(() => {
    const load = async () => {
      let query = supabase.from("mensagens_contato").select("*").order("criado_em", { ascending: false });
      if (dateFrom) query = query.gte("criado_em", dateFrom);
      if (dateTo) query = query.lte("criado_em", dateTo + "T23:59:59");
      const { data } = await query;
      if (data) setMensagens(data as Mensagem[]);
    };
    load();
  }, [dateFrom, dateTo]);

  const filtered = mensagens.filter((m) => {
    const s = search.toLowerCase();
    return m.nome.toLowerCase().includes(s) || m.telefone.includes(s);
  });

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((m) => ({
        Nome: m.nome,
        Telefone: m.telefone,
        Email: m.email || "",
        Mensagem: m.mensagem,
        Data: new Date(m.criado_em).toLocaleString("pt-BR"),
        IP: m.endereco_ip || "",
        Cidade: m.cidade || "",
        Estado: m.estado || "",
        País: m.pais || "",
        Latitude: m.latitude || "",
        Longitude: m.longitude || "",
        UserAgent: m.user_agent || "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Formulários");
    XLSX.writeFile(wb, `formularios_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-bold">Formulários</h2>
          <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={exportExcel}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 sm:w-32 h-9 text-sm" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 sm:w-32 h-9 text-sm" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>

        {/* Desktop table */}
        <div className="hidden lg:block rounded-2xl border bg-card overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="p-4 text-xs font-semibold">Nome</th>
                <th className="p-4 text-xs font-semibold">Telefone</th>
                <th className="p-4 text-xs font-semibold">E-mail</th>
                <th className="p-4 text-xs font-semibold">Mensagem</th>
                <th className="p-4 text-xs font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="p-4 text-sm font-medium">{m.nome}</td>
                  <td className="p-4 text-sm">{m.telefone}</td>
                  <td className="p-4 text-sm text-muted-foreground">{m.email || "—"}</td>
                  <td className="p-4 text-sm max-w-[300px] truncate">{m.mensagem}</td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(m.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-5 space-y-2">
              <p className="font-semibold">{m.nome}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{m.telefone}</div>
              {m.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{m.email}</div>}
              <p className="text-sm text-muted-foreground">{m.mensagem}</p>
              <p className="text-xs text-muted-foreground">{formatDate(m.criado_em)}</p>
            </div>
          ))}
        </div>

        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum registro encontrado.</p>}
      </div>
    </AdminLayout>
  );
};

export default Forms;
