import { useState, useMemo } from "react";
import { Calendar, Clock, MapPin, Search, ExternalLink, ChevronDown, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ScrollReveal from "@/components/ScrollReveal";
import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { useGoogleCalendar, type CalendarEvent } from "@/hooks/useGoogleCalendar";

type Tab = "proximos" | "realizados" | "todos";

const EVENTS_PER_PAGE = 50;

/* Group events by month/year */
function groupByMonth(events: CalendarEvent[]) {
  const groups: { key: string; label: string; events: CalendarEvent[] }[] = [];
  const map = new Map<string, CalendarEvent[]>();

  for (const ev of events) {
    const d = new Date(ev.dataISO);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (!map.has(key)) {
      map.set(key, []);
      groups.push({ key, label, events: map.get(key)! });
    }
    map.get(key)!.push(ev);
  }
  return groups;
}

const tabConfig: { key: Tab; label: string }[] = [
  { key: "proximos", label: "Próximos" },
  { key: "realizados", label: "Realizados" },
  { key: "todos", label: "Todos" },
];

const Agenda = () => {
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<Tab>("proximos");
  const [visibleCount, setVisibleCount] = useState(EVENTS_PER_PAGE);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string> | null>(null);

  const { events, loading, error } = useGoogleCalendar({ filter: "all" });

  const filtrados = useMemo(() => events.filter((e) => {
    const q = busca.toLowerCase();
    const matchBusca =
      e.titulo.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q) ||
      e.desc.toLowerCase().includes(q);
    if (tab === "proximos") return matchBusca && !e.passado;
    if (tab === "realizados") return matchBusca && e.passado;
    return matchBusca;
  }), [events, busca, tab]);

  const sorted = useMemo(() => [...filtrados].sort((a, b) => {
    const dateA = new Date(a.dataISO).getTime();
    const dateB = new Date(b.dataISO).getTime();
    return tab === "realizados" ? dateB - dateA : dateA - dateB;
  }), [filtrados, tab]);

  // Group ALL sorted events by month, then paginate
  const allGroups = useMemo(() => groupByMonth(sorted), [sorted]);

  // Build visible groups with pagination
  const { visibleGroups, hasMore } = useMemo(() => {
    let count = 0;
    const result: typeof allGroups = [];
    for (const group of allGroups) {
      if (count >= visibleCount) break;
      const remaining = visibleCount - count;
      const sliced = group.events.slice(0, remaining);
      result.push({ ...group, events: sliced });
      count += sliced.length;
    }
    const totalEvents = sorted.length;
    return { visibleGroups: result, hasMore: visibleCount < totalEvents };
  }, [allGroups, visibleCount, sorted.length]);

  // Auto-collapse past months on "todos" tab, current month key
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  }, []);

  // Default collapsed state: past months start collapsed on "proximos"/"todos"
  const effectiveCollapsed = useMemo(() => {
    if (collapsedMonths !== null) return collapsedMonths;
    const auto = new Set<string>();
    if (tab === "proximos" || tab === "todos") {
      for (const g of allGroups) {
        if (g.key < currentMonthKey) auto.add(g.key);
      }
    }
    return auto;
  }, [collapsedMonths, tab, allGroups, currentMonthKey]);

  const totalProximos = events.filter((e) => !e.passado).length;
  const totalRealizados = events.filter((e) => e.passado).length;

  const toggleMonth = (key: string) => {
    setCollapsedMonths((prev) => {
      const base = prev !== null ? prev : effectiveCollapsed;
      const next = new Set(base);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleTabChange = (key: Tab) => {
    setTab(key);
    setVisibleCount(EVENTS_PER_PAGE);
    setBusca("");
    setCollapsedMonths(null);
  };

  return (
    <Layout>
      <PageHeader
        title="Agenda de"
        titleAccent="Eventos"
        subtitle="Acompanhe os próximos eventos e atividades da Dra. Fernanda Sarelli"
      />

      <section className="py-6 md:py-14">
        <div className="container max-w-3xl px-3 sm:px-6">

          {/* Tabs */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {tabConfig.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  tab === key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
                {key === "proximos" && !loading && (
                  <span className="ml-1.5 text-xs opacity-80">({totalProximos})</span>
                )}
                {key === "realizados" && !loading && (
                  <span className="ml-1.5 text-xs opacity-80">({totalRealizados})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar evento, cidade ou descrição..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setVisibleCount(EVENTS_PER_PAGE);
              }}
              className="pl-11 pr-10 h-11 rounded-full border-border bg-card shadow-sm"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results count when searching */}
          {busca && !loading && (
            <p className="text-sm text-muted-foreground mb-4">
              {sorted.length} resultado{sorted.length !== 1 ? "s" : ""} para "<span className="font-medium">{busca}</span>"
            </p>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card p-4 space-y-3 animate-pulse">
                  <div className="h-3 w-24 bg-muted rounded-full" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="flex gap-3">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-3 w-28 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os eventos. Tente novamente mais tarde.
              </p>
            </div>
          )}

          {/* Events grouped by month */}
          {!loading && !error && (
            <div className="space-y-6">
              {sorted.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed p-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum evento encontrado.</p>
                </div>
              )}

              {visibleGroups.map((group) => {
                const isCollapsed = effectiveCollapsed.has(group.key);
                return (
                  <div key={group.key}>
                    {/* Month header - clickable to collapse */}
                    <button
                      onClick={() => toggleMonth(group.key)}
                      className="flex items-center gap-2 mb-3 w-full text-left group"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-primary transition-transform" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-primary transition-transform" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                        {group.label}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        ({(allGroups.find(g => g.key === group.key)?.events.length || group.events.length)} evento{(allGroups.find(g => g.key === group.key)?.events.length || group.events.length) !== 1 ? "s" : ""})
                      </span>
                    </button>

                    {/* Events */}
                    {!isCollapsed && (
                      <div className="space-y-2.5">
                        {group.events.map((e, i) => (
                          <ScrollReveal key={e.id} delay={Math.min(i * 0.04, 0.2)}>
                            <div
                              className={`flex items-start gap-3.5 rounded-xl border bg-card px-4 py-3.5 transition-all hover:shadow-md hover:border-primary/20 ${
                                e.passado ? "opacity-50" : ""
                              }`}
                            >
                              {/* Compact date badge */}
                              <div className={`flex-shrink-0 flex flex-col items-center justify-center h-14 w-14 rounded-xl ${
                                e.passado
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary text-primary-foreground"
                              }`}>
                                <span className="text-lg font-bold leading-none">{e.dia}</span>
                                <span className="text-[0.6rem] font-semibold uppercase mt-0.5">{e.mes}</span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-sm leading-snug">{e.titulo}</h3>
                                  {e.passado && (
                                    <Badge variant="secondary" className="text-[0.6rem] shrink-0 py-0">
                                      Realizado
                                    </Badge>
                                  )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {e.hora}
                                    {e.horaFim && e.horaFim !== e.hora && ` – ${e.horaFim}`}
                                  </span>
                                  {e.local && (
                                    <a
                                      href={e.mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 hover:text-primary transition-colors min-w-0"
                                    >
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{e.local}</span>
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                    </a>
                                  )}
                                </div>

                                {e.desc && (
                                  <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2">{e.desc}</p>
                                )}

                                {!e.passado && (
                                  <a
                                    href={e.gcal}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[0.65rem] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    Adicionar à minha agenda
                                  </a>
                                )}
                              </div>
                            </div>
                          </ScrollReveal>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more button */}
              {hasMore && (
                <div className="pt-4 text-center">
                  <button
                    onClick={() => setVisibleCount((c) => c + EVENTS_PER_PAGE)}
                    className="rounded-full border border-primary/30 bg-card px-6 py-2.5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                  >
                    Mostrar mais ({sorted.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Agenda;
