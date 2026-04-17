import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin, ExternalLink, Shield, Heart, Users, Scale, MessageCircle, Facebook, Instagram, User, Mail, MapPinIcon, Loader2 } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

import { supabase } from "@/lib/supabaseDb";
import { getGaleriaAtiva } from "@/hooks/useGaleriaConfig";
import { useAgendaConfig } from "@/hooks/useAgendaConfig";
import Layout from "@/components/Layout";
import WaveDivider from "@/components/WaveDivider";
import ScrollReveal from "@/components/ScrollReveal";
import logoSarelli from "@/assets/logo-sarelli.png";
import logoNovo from "@/assets/logo-novo-partido.png";
import bannerPalanque from "@/assets/banner-palanque.jpg";
import bannerPalanqueMobile from "@/assets/banner-palanque-mobile.jpg";

const PHOTO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699400706d955b03c8c19827/16e72069d_WhatsAppImage2026-02-17at023641.jpeg";

const bandeiras = [
  {
    icon: Heart,
    title: "Defesa da Mulher",
    desc: "Compromisso com os direitos, saúde e proteção integral das mulheres goianas. Combate à violência, igualdade de oportunidades e empoderamento feminino.",
  },
  {
    icon: Shield,
    title: "Defesa da Criança",
    desc: "Proteção integral da infância e adolescência. Garantia de direitos fundamentais, combate ao abuso e acesso pleno à saúde e educação de qualidade.",
  },
  {
    icon: Users,
    title: "Famílias em Vulnerabilidade",
    desc: "Políticas públicas efetivas de assistência social, geração de emprego e renda, moradia digna e apoio integral às famílias em situação de risco.",
  },
  {
    icon: Scale,
    title: "Igualdade e Políticas Públicas",
    desc: "Promoção da igualdade, inclusão social e políticas públicas que garantam dignidade, cidadania e oportunidades para toda população goiana.",
  },
];

const redes = [
  { icon: MessageCircle, label: "WhatsApp", handle: "(62) 99323-7397", url: "https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli" },
  { icon: Facebook, label: "Facebook", handle: "@drafernandaSarelli", url: "https://www.facebook.com/people/Dra-Fernanda-Sarelli/61554974150545/" },
  { icon: Instagram, label: "Instagram", handle: "@drafernandasarelli", url: "https://www.instagram.com/drafernandasarelli/" },
];

interface HomeAlbum {
  id: string;
  nome: string;
  capa_url: string | null;
  fixado_home: boolean;
  atualizado_em: string;
  foto_count: number;
  first_photo_url: string | null;
}

const Index = () => {
  const [homeAlbuns, setHomeAlbuns] = useState<HomeAlbum[]>([]);
  const [galeriaAtiva, setGaleriaAtiva] = useState(false);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const { agendaAtiva } = useAgendaConfig();
  const { events: proximosEventos, loading: eventosLoading, error: eventosError } = useGoogleCalendar({ filter: "proximos", limit: 3, enabled: agendaAtiva });
  const eventos = Array.isArray(proximosEventos) ? proximosEventos : [];

  useEffect(() => {
    const loadGaleria = async () => {
      const [ativa, albumsResult, fotosResult] = await Promise.all([
        getGaleriaAtiva(),
        supabase.from("albuns" as any).select("*").order("ordem"),
        supabase.from("galeria_fotos").select("id, url_foto, album_id").eq("visivel", true),
      ]);

      setGaleriaAtiva(ativa);
      if (!ativa) return;

      const allAlbums = (albumsResult.data as any[] || []);
      const allFotos = (fotosResult.data as any[] || []);

      // Build album list with photo counts and first photo
      const albumsWithData: HomeAlbum[] = allAlbums.map((a: any) => {
        const albumFotos = allFotos.filter((f: any) => f.album_id === a.id);
        return {
          id: a.id,
          nome: a.nome,
          capa_url: a.capa_url || null,
          fixado_home: !!a.fixado_home,
          atualizado_em: a.atualizado_em,
          foto_count: albumFotos.length,
          first_photo_url: albumFotos[0]?.url_foto || null,
        };
      });

      // Sort: pinned first, then by atualizado_em desc
      albumsWithData.sort((a, b) => {
        if (a.fixado_home && !b.fixado_home) return -1;
        if (!a.fixado_home && b.fixado_home) return 1;
        return new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime();
      });

      // Show up to 6
      setHomeAlbuns(albumsWithData.slice(0, 6));
    };

    loadGaleria();
  }, []);

  return (
    <Layout>
      <section className="gradient-hero relative overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-primary-foreground/10"
              style={{
                width: 60 + i * 40,
                height: 60 + i * 40,
                left: `${10 + i * 20}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.3, 0.1], scale: [0, 1.2, 1], y: [0, -20, 0] }}
              transition={{ duration: 4, delay: 0.8 + i * 0.3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            />
          ))}
        </div>

        <div className="container relative z-10 py-10 sm:py-14 md:py-24">
          <div className="grid md:grid-cols-2 gap-1 md:gap-10 items-center">
            <div className="text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm mt-[-4px] md:mt-0">
                  <span className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
                  Pré-candidata 2026
                </span>
              </motion.div>

              {/* Mobile: show NOVO logo here (centered) | Desktop: show Sarelli logo */}
              <motion.div
                initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                <div className="mt-4 flex justify-center md:hidden">
                  <img src={logoNovo} alt="Partido NOVO - A gente respeita Goiás" className="h-40 sm:h-44 w-auto object-contain drop-shadow-md" />
                </div>
                <img src={logoNovo} alt="Partido NOVO - A gente respeita Goiás" className="mt-5 h-36 sm:h-40 md:h-44 w-auto object-contain drop-shadow-md hidden md:block" />
              </motion.div>

              <motion.p
                className="mt-4 text-primary-foreground/80 leading-relaxed max-w-md mx-auto md:mx-0"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
              >
                Pré-candidata a Deputada Estadual por Goiás pelo Partido NOVO, com compromisso real com a defesa da mulher e da família.
              </motion.p>

              <motion.div
                className="mt-6 flex flex-wrap justify-center md:justify-start gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              >
                {agendaAtiva && (
                  <Link
                    to="/agenda"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
                  >
                    <Calendar className="h-4 w-4" />
                    Ver Agenda
                  </Link>
                )}
                <a
                  href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-primary-foreground/40 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
                >
                  <Users className="h-4 w-4" />
                  Faça Parte
                </a>
              </motion.div>

              <motion.div
                className="mt-8 flex items-center gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-foreground">GO</p>
                  <p className="text-xs text-primary-foreground/70">Estado</p>
                </div>
                <div className="h-10 w-px bg-primary-foreground/20" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-foreground">2026</p>
                  <p className="text-xs text-primary-foreground/70">Eleições</p>
                </div>
                <Link
                  to="/sobre"
                  className="flex flex-col items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/30">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="text-xs">Sobre Mim</p>
                </Link>
              </motion.div>
            </div>

            {/* Hero image */}
            <div className="flex flex-col items-center justify-center order-first md:order-none mb-0 md:mb-0 gap-2 md:gap-5">
              <motion.div
                className="relative"
                initial={{ opacity: 0, scale: 0.5, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.9, delay: 0.1, type: "spring", stiffness: 100, damping: 15 }}
              >
                <div className="h-64 w-64 sm:h-80 sm:w-80 md:h-[28rem] md:w-[28rem] rounded-full border-4 border-primary overflow-hidden shadow-2xl ring-pulse relative">
                  {!heroImgLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-pink-300 to-pink-400 animate-pulse" />
                  )}
                  <img
                    src={PHOTO_URL}
                    alt="Dra. Fernanda Sarelli, advogada e pré-candidata a Deputada Estadual por Goiás"
                    className={`h-full w-full object-cover object-top transition-opacity duration-500 ${
                      heroImgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    fetchPriority="high"
                    loading="eager"
                    decoding="sync"
                    onLoad={() => setHeroImgLoaded(true)}
                  />
                </div>
              </motion.div>
              {/* Mobile: show Sarelli logo here | Desktop: show NOVO logo */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
              >
                <img src={logoSarelli} alt="Dra. Fernanda Sarelli - Chama a Doutora" className="max-w-[300px] sm:max-w-[340px] w-full object-contain md:hidden" />
                <img src={logoSarelli} alt="Dra. Fernanda Sarelli - Chama a Doutora" className="max-w-sm sm:max-w-md md:max-w-lg w-full object-contain hidden md:block" />
              </motion.div>
            </div>
          </div>
        </div>
        <WaveDivider />
      </section>

      <section className="py-16 md:py-20">
        <div className="container">
          <ScrollReveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">🏛️ Compromissos Institucionais</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Nossas Bandeiras</h2>
              <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
                Pilares fundamentais que guiam nossa atuação por um Goiás mais justo e inclusivo
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bandeiras.map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 0.1}>
                <div className="rounded-2xl border bg-card p-6 h-full card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent mb-4">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {agendaAtiva && (
      <section className="bg-secondary py-16 md:py-20">
        <div className="container">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Próximos Eventos</h2>
              <p className="mt-3 text-muted-foreground">Acompanhe a agenda de atividades</p>
            </div>
          </ScrollReveal>

          {eventosLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando eventos...</span>
            </div>
          ) : eventos.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">{eventosError ? "Agenda temporariamente indisponível." : "Nenhum evento próximo no momento."}</p>
          ) : (
            <div className="mt-10 space-y-4 max-w-3xl mx-auto">
              {eventos.map((e, i) => (
                <ScrollReveal key={e.id} delay={i * 0.1}>
                  <div className="flex gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-soft">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center h-16 w-16 rounded-xl bg-primary text-primary-foreground">
                      <span className="text-xl font-bold leading-none">{e.dia}</span>
                      <span className="text-xs font-semibold uppercase">{e.mes}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{e.titulo}</h3>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{e.hora}{e.horaFim && e.horaFim !== e.hora && ` – ${e.horaFim}`}</span>
                        {e.local && (
                          <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                            <MapPin className="h-3.5 w-3.5" />{e.local}
                          </a>
                        )}
                      </div>
                      {e.desc && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{e.desc}</p>}
                      <a
                        href={e.gcal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Adicionar à minha agenda
                      </a>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              to="/agenda"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              Ver agenda completa
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {!agendaAtiva && (
      <section className="bg-secondary py-16 md:py-20">
        <div className="container">
          <ScrollReveal>
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">🤝 Movimento em ação</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Juntos por um Novo Tempo</h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Lideranças, comunidade e compromisso lado a lado.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal>
            <div className="relative max-w-6xl mx-auto group">
              {/* Glow rosa suave */}
              <div className="absolute -inset-1.5 sm:-inset-2 rounded-[2rem] bg-primary/20 opacity-60 blur-lg -z-10" />
              {/* Moldura toda rosa, sem branco */}
              <div className="relative rounded-[1.75rem] overflow-hidden shadow-xl ring-2 ring-primary/70 outline outline-2 outline-primary/40 outline-offset-0">
                {/* Mobile/tablet: foto inteira sem cortar (contain). Desktop: cover focado no palco */}
                <div className="relative w-full aspect-[16/5] sm:aspect-[16/6] lg:aspect-[16/7] overflow-hidden banner-reveal bg-primary/10">
                  <picture>
                    <source media="(min-width: 1024px)" srcSet={bannerPalanque} />
                    <img
                      src={bannerPalanqueMobile}
                      alt="Doutora Fernanda Sarelli ao lado de lideranças e apoiadores no palco"
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-contain lg:object-cover lg:object-[center_22%] transition-transform duration-700 sm:group-hover:scale-[1.04]"
                    />
                  </picture>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
      )}

      {galeriaAtiva && homeAlbuns.length > 0 && (
      <section className="py-16 md:py-20">
        <div className="container">
          <ScrollReveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">📸 Registro das atividades</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Galeria de Fotos e Vídeos</h2>
              <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
                Acompanhe os eventos, ações sociais e encontros comunitários
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
            {homeAlbuns.map((album, i) => {
              const coverUrl = album.capa_url || album.first_photo_url;
              return (
                <ScrollReveal key={album.id} delay={i * 0.05}>
                  <Link
                    to={`/galeria?album=${album.id}`}
                    className="group block overflow-hidden rounded-xl sm:rounded-2xl border bg-card transition-shadow hover:shadow-lg active:scale-[0.98]"
                  >
                    <div className="aspect-square overflow-hidden relative bg-muted flex items-center justify-center">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={album.nome}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading={i < 4 ? "eager" : "lazy"}
                          decoding="async"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Calendar className="h-10 w-10" />
                          <span className="text-xs">Sem capa</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                        <p className="text-white text-sm sm:text-base font-semibold truncate">{album.nome}</p>
                        <p className="text-white/70 text-xs">{album.foto_count} foto(s)</p>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/galeria"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              Ver todas as pastas
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      )}

      <section className="py-16 md:py-20">
        <div className="container">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Redes Sociais</h2>
              <p className="mt-3 text-muted-foreground">Acompanhe nas redes oficiais</p>
            </div>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {redes.map((r, i) => (
              <ScrollReveal key={r.label} delay={i * 0.1}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center transition-shadow hover:shadow-lg group"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <r.icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="font-semibold">{r.label}</h3>
                  <p className="text-sm text-primary">{r.handle}</p>
                </a>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/redes-sociais"
              className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Ver todas as redes
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-secondary py-16 md:py-20">
        <div className="container text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Fale Conosco</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Quer saber mais sobre nossas propostas ou fazer parte da nossa equipe? Entre em contato.
            </p>
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center justify-center gap-2"><Mail className="h-4 w-4 text-primary" />contato@fernandasarelli.com.br</p>
              <p className="flex items-center justify-center gap-2"><MapPinIcon className="h-4 w-4 text-primary" />Goiânia — GO</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
              >
                Enviar Mensagem
              </a>
              <Link
                to="/integracao"
                className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Integração
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <a
              href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-primary p-5 text-primary-foreground transition-transform hover:scale-105"
            >
              <MessageCircle className="h-8 w-8 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm">Receba as informações direto em seu celular</p>
                <p className="text-lg font-bold">(62) 99323-7397</p>
              </div>
            </a>
          </ScrollReveal>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
