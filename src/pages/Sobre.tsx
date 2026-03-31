import { Heart, Shield, Users, Stethoscope, GraduationCap, Scale, Landmark, Eye, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";
import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const PHOTO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699400706d955b03c8c19827/16e72069d_WhatsAppImage2026-02-17at023641.jpeg";

const pilares = [
  { icon: Heart, title: "Defesa da Mulher", desc: "Luta incansável pelos direitos das mulheres, combate à violência doméstica, promoção da saúde feminina e igualdade de oportunidades no mercado de trabalho." },
  { icon: Shield, title: "Proteção à Criança", desc: "Defesa dos direitos da criança e do adolescente, combate ao abuso infantil, garantia de educação de qualidade e acesso a saúde integral desde a primeira infância." },
  { icon: Users, title: "Família em Vulnerabilidade", desc: "Políticas efetivas de assistência social, geração de emprego e renda, moradia digna e programas de apoio para famílias em situação de risco e vulnerabilidade." },
  { icon: Stethoscope, title: "Saúde Pública", desc: "Defesa de um sistema de saúde acessível e de qualidade para todos os goianos." },
  { icon: GraduationCap, title: "Educação", desc: "Investimento em educação como base para o desenvolvimento e transformação social." },
  { icon: Scale, title: "Inclusão Social", desc: "Políticas públicas que garantam dignidade e oportunidades iguais para todos." },
  { icon: Landmark, title: "Transparência", desc: "Compromisso com a gestão pública transparente e prestação de contas à sociedade." },
  { icon: Lock, title: "Segurança", desc: "Ações voltadas para a segurança pública e o bem-estar das comunidades." },
];

const Sobre = () => (
  <Layout>
    {/* Header */}
    <section className="gradient-header-page py-16 md:py-20">
      <div className="container">
        <ScrollReveal>
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            Conheça a Dra. Fernanda
          </span>
        </ScrollReveal>

        <div className="mt-8 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <ScrollReveal delay={0.1}>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                Quem é a Dra. Fernanda{" "}
                <span className="text-primary">Sarelli?</span>
              </h1>
              <span className="mt-3 inline-flex rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-primary">
                CHAMA A DOUTORA
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="mt-8 space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Advogada criminalista, empresária bem-sucedida na advocacia, mulher goiana, mãe, esposa e cristã, a Dra. Fernanda Sarelli construiu uma trajetória marcada pela defesa da justiça, pelo compromisso social e pelo cuidado com as pessoas.
                </p>
                <p>
                  É pré-candidata a Deputada Estadual por Goiás nas eleições de 2026, levando consigo uma caminhada voltada à proteção das mulheres, das crianças e das famílias em situação de vulnerabilidade. Uma mulher forte e determinada, conhecedora da lei, preparada para fazer valer os direitos de quem mais precisa.
                </p>
                <p>
                  Nascida em Porangatu, recebeu o título de cidadã aparecidense em reconhecimento à sua trajetória de luta. Ao longo desta década, projetos e ações apoiados por ela já alcançaram mais de 100 mil famílias em vulnerabilidade em Goiás e diversas regiões do Brasil.
                </p>
                <p>
                  Com experiência jurídica, visão empreendedora e valores cristãos que orientam sua caminhada, acredita em políticas públicas responsáveis, humanas e acessíveis, que promovam igualdade, proteção social e o fortalecimento das famílias goianas.
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.3} direction="right">
            <div className="flex justify-center">
              <div className="h-72 w-72 md:h-96 md:w-96 rounded-2xl border-4 border-primary overflow-hidden shadow-xl">
                <img
                  src={PHOTO_URL}
                  alt="Dra. Fernanda Sarelli, advogada e pré-candidata a Deputada Estadual por Goiás"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>

    {/* 8 Bandeiras */}
    <section className="py-16 md:py-20">
      <div className="container">
        <ScrollReveal>
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Nossas Bandeiras</h2>
            <p className="mt-3 text-muted-foreground">O que move a nossa pré-campanha</p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pilares.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 0.08}>
              <div className="rounded-2xl border bg-card p-6 h-full transition-shadow hover:shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent mb-4">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="bg-secondary py-16 md:py-20">
      <div className="container text-center">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Juntos por Goiás</h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            Acreditamos que a mudança começa com participação e compromisso. Venha fazer parte dessa história.
          </p>
          <div className="mt-6 flex justify-center gap-4 flex-wrap">
            <Link
              to="/contato"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              Enviar Mensagem
            </Link>
            <a
              href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Faça Parte
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  </Layout>
);

export default Sobre;
