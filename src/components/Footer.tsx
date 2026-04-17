import { Link } from "react-router-dom";
import { Instagram, Facebook, MessageCircle, Heart } from "lucide-react";
import { useAgendaConfig } from "@/hooks/useAgendaConfig";

const Footer = () => {
  const { agendaAtiva } = useAgendaConfig();
  return (
  <footer className="bg-footer text-footer-foreground">
    <div className="container py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Brand */}
        <div>
          <h3 className="text-lg font-bold text-primary-foreground">Dra. Fernanda Sarelli</h3>
          <p className="mt-2 text-sm">Pré-candidata a Deputada Estadual por Goiás 2026.</p>
        </div>

        {/* Navegação */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground mb-4">Navegação</h4>
          <nav className="flex flex-col gap-2 text-sm">
            <Link to="/" className="hover:text-primary-foreground transition-colors">Início</Link>
            <Link to="/sobre" className="hover:text-primary-foreground transition-colors">Sobre</Link>
            {agendaAtiva && <Link to="/agenda" className="hover:text-primary-foreground transition-colors">Agenda</Link>}
            <Link to="/contato" className="hover:text-primary-foreground transition-colors">Contato</Link>
          </nav>
        </div>

        {/* Contato */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground mb-4">Contato</h4>
          <div className="space-y-1 text-sm">
            <p>Goiânia — GO, Brasil</p>
            
            <p>(62) 99323-7397</p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <a href="https://www.instagram.com/drafernandasarelli/" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://www.facebook.com/people/Dra-Fernanda-Sarelli/61554974150545/" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="border-t border-primary-foreground/10">
      <div className="container flex flex-col sm:flex-row items-center justify-between py-4 text-xs">
        <p>© 2026 Dra. Fernanda Sarelli. Todos os direitos reservados.</p>
        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <Link to="/admin/login" className="text-primary-foreground/30 hover:text-primary-foreground/60 transition-colors mr-2">
            •
          </Link>
          <p className="flex items-center gap-1">
            Feito com <Heart className="h-3 w-3 fill-primary text-primary" /> para Goiás
          </p>
        </div>
      </div>
    </div>
  </footer>
  );
};

export default Footer;
