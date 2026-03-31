import { MessageCircle, Facebook, Instagram } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const redes = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    handle: "(62) 99323-7397",
    desc: "Receba informações direto no seu celular",
    url: "https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli",
  },
  {
    icon: Facebook,
    label: "Facebook",
    handle: "@drafernandaSarelli",
    desc: "Notícias, eventos e interação com a comunidade",
    url: "https://www.facebook.com/people/Dra-Fernanda-Sarelli/61554974150545/",
  },
  {
    icon: Instagram,
    label: "Instagram",
    handle: "@drafernandasarelli",
    desc: "Acompanhe os bastidores e atualizações diárias",
    url: "https://www.instagram.com/drafernandasarelli/",
  },
];

const RedesSociais = () => (
  <Layout>
    <PageHeader
      title="Redes"
      titleAccent="Sociais"
      subtitle="Conecte-se com a Dra. Fernanda Sarelli nas redes oficiais"
    />

    <section className="py-12 md:py-16">
      <div className="container max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {redes.map((r, i) => (
            <ScrollReveal key={r.label} delay={i * 0.1}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center transition-shadow hover:shadow-lg group h-full"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent group-hover:bg-primary transition-colors">
                  <r.icon className="h-8 w-8 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h3 className="text-lg font-bold">{r.label}</h3>
                <p className="text-sm font-medium text-primary">{r.handle}</p>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  </Layout>
);

export default RedesSociais;
