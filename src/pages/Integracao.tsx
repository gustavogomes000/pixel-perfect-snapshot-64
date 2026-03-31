import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Users, MessageCircle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseDb";
import ScrollReveal from "@/components/ScrollReveal";
import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { getCachedGeo, getGeoMode, getVisitorId, resolveLocation, waitForGPS } from "@/lib/tracking";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20),
  email: z.string().trim().email("E-mail inválido").max(255).or(z.literal("")).optional(),
  mensagem: z.string().trim().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

const canais = [
  {
    icon: MessageCircle,
    label: "Whatsapp",
    handle: "(62) 99323-7397",
    url: "https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli",
  },
  {
    icon: Facebook,
    label: "Facebook",
    handle: "@drafernandaSarelli",
    url: "https://www.facebook.com/people/Dra-Fernanda-Sarelli/61554974150545/",
  },
  {
    icon: Instagram,
    label: "Instagram",
    handle: "@drafernandasarelli",
    url: "https://www.instagram.com/drafernandasarelli/",
  },
];

const Integracao = () => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const cookie_visitante = getVisitorId();
      let geo = getCachedGeo();
      if (!geo || geo.geo_layer !== "gps") {
        try {
          geo = await waitForGPS(5000, 500);
        } catch {
          // use fallback below
        }
      }
      if (!geo) geo = await resolveLocation().catch(() => null);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/track-capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "form",
          nome: data.nome,
          telefone: data.telefone,
          email: data.email || null,
          mensagem: data.mensagem || "Cadastro via Integração",
          cookie_visitante,
          user_agent: navigator.userAgent,
          precisao_localizacao: getGeoMode(),
          ...(geo ? {
            cidade: geo.cidade,
            estado: geo.estado,
            pais: geo.pais,
            bairro: geo.bairro,
            cep: geo.cep,
            rua: geo.rua,
            endereco_completo: geo.endereco_completo,
            latitude: geo.latitude,
            longitude: geo.longitude,
            zona_eleitoral: geo.zona_eleitoral,
          } : {}),
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Falha ao registrar cadastro");

      toast.success("Cadastro enviado com sucesso!");
      reset();
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Faça Parte da"
        titleAccent="Integração"
        subtitle="Junte-se a nós na construção de um futuro melhor para Goiás"
      />

      <section className="py-12 md:py-16">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-2 gap-10">
            {/* Form */}
            <ScrollReveal>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Cadastre-se</h2>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input id="nome" placeholder="Seu nome" {...register("nome")} className="mt-1" />
                    {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
                    <Input id="telefone" placeholder="(62) 99999-9999" {...register("telefone")} className="mt-1" />
                    {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="mt-1" />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="mensagem">Mensagem</Label>
                    <Textarea id="mensagem" rows={4} placeholder="Como deseja contribuir?" {...register("mensagem")} className="mt-1" />
                  </div>
                  <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
                    <Send className="mr-2 h-4 w-4" />
                    {loading ? "Enviando..." : "Enviar Cadastro"}
                  </Button>
                </form>
              </div>
            </ScrollReveal>

            {/* Canais Oficiais */}
            <ScrollReveal delay={0.15}>
              <div>
                <h2 className="text-2xl font-bold mb-2">Canais Oficiais</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Conecte-se diretamente com a equipe da Dra. Fernanda Sarelli pelos nossos canais oficiais.
                </p>

                <div className="space-y-3">
                  {canais.map((c) => (
                    <a
                      key={c.label}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 rounded-xl border p-4 transition-shadow hover:shadow-md group"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent group-hover:bg-primary transition-colors flex-shrink-0">
                        <c.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
                      </div>
                      <div>
                        <p className="font-semibold">{c.label}</p>
                        <p className="text-sm text-muted-foreground">{c.handle}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Integracao;
