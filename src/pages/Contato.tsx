import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseDb";
import ScrollReveal from "@/components/ScrollReveal";
import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import {
  getVisitorId,
  resolveLocation,
  getCachedGeo,
  waitForGPS,
  onFormFocus,
  getFormFillTime,
  resetFormTracking,
  updateLocationViaEdge,
  getGeoMode,
} from "@/lib/tracking";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20),
  email: z.string().trim().email("E-mail inválido").max(255).or(z.literal("")).optional(),
  mensagem: z.string().trim().min(1, "Mensagem é obrigatória").max(2000),
});

type FormData = z.infer<typeof schema>;

const Contato = () => {
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Trigger GPS request on any form focus
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handler = () => onFormFocus();
    form.addEventListener("focusin", handler, { passive: true });
    return () => form.removeEventListener("focusin", handler);
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const cookie_visitante = getVisitorId();

      // FIX 5: Wait up to 5s for GPS polling sessionStorage every 500ms
      let geo = getCachedGeo();
      if (!geo || geo.geo_layer !== "gps") {
        try {
          geo = await waitForGPS(5000, 500);
        } catch { /* use whatever we have */ }
      }
      if (!geo) geo = await resolveLocation().catch(() => null);

      const url = `${SUPABASE_URL}/functions/v1/track-capture`;

      const res = await fetch(url, {
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
          mensagem: data.mensagem,
          dominio_origem: window.location.hostname,
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

      if (!result.success) throw new Error(result.error);

      toast.success("Mensagem enviada com sucesso!");
      reset();
      resetFormTracking();

      // If GPS resolves later, update the record
      if (!geo?.latitude) {
        resolveLocation().then((laterGeo) => {
          if (laterGeo.latitude) {
            fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                action: "update-location",
                cookie_visitante,
                table: "mensagens_contato",
                ...laterGeo,
              }),
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Entre em"
        titleAccent="Contato"
        subtitle="Queremos ouvir você. Envie sua mensagem ou sugestão."
      />

      <section className="py-12 md:py-16">
        <div className="container max-w-4xl">
          <div className="grid md:grid-cols-[1fr_1.5fr] gap-10">
            {/* Info */}
            <ScrollReveal>
              <div>
                <h2 className="text-2xl font-bold">Informações</h2>
                <div className="mt-6 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent flex-shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">E-mail</p>
                      <p className="font-medium">contato@fernandasarelli.com.br</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent flex-shrink-0">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">(62) 99323-7397</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Localização</p>
                      <p className="font-medium">Goiânia — GO, Brasil</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Form */}
            <ScrollReveal delay={0.15}>
              <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border bg-card p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input id="nome" placeholder="Seu nome" {...register("nome")} className="mt-1" />
                    {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input id="telefone" placeholder="(62) 99999-9999" {...register("telefone")} className="mt-1" />
                    {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone.message}</p>}
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} className="mt-1" />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
                <div className="mt-4">
                  <Label htmlFor="mensagem">Mensagem *</Label>
                  <Textarea id="mensagem" rows={5} placeholder="Escreva sua mensagem..." {...register("mensagem")} className="mt-1" />
                  {errors.mensagem && <p className="text-sm text-destructive mt-1">{errors.mensagem.message}</p>}
                </div>
                <Button type="submit" size="lg" className="w-full mt-6 rounded-full" disabled={loading}>
                  <Send className="mr-2 h-4 w-4" />
                  {loading ? "Enviando..." : "Enviar Mensagem"}
                </Button>
              </form>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contato;
