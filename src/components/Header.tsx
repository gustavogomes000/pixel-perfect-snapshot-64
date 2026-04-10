import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Instagram, Facebook, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useGaleriaConfig } from "@/hooks/useGaleriaConfig";
import logoHeader from "@/assets/logo-sarelli-header.png";
import logoNovo from "@/assets/logo-novo-partido.png";

const baseNavItems = [
  { label: "Sobre", path: "/sobre" },
  { label: "Agenda", path: "/agenda" },
  { label: "Galeria", path: "/galeria" },
  { label: "Redes Sociais", path: "/redes-sociais" },
  { label: "Integração", path: "/integracao" },
  { label: "Contato", path: "/contato" },
];

const socialLinks = [
  { icon: Instagram, label: "Instagram", url: "https://www.instagram.com/drafernandasarelli/" },
  { icon: Facebook, label: "Facebook", url: "https://www.facebook.com/people/Dra-Fernanda-Sarelli/61554974150545/" },
  { icon: MessageCircle, label: "WhatsApp", url: "https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli" },
];

const Header = () => {
  const [open, setOpen] = useState(false);
  const { galeriaAtiva } = useGaleriaConfig();
  const { pathname } = useLocation();

  const navItems = galeriaAtiva
    ? baseNavItems
    : baseNavItems.filter((item) => item.path !== "/galeria");

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/50">
      <div className="container flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <img src={logoHeader} alt="Dra. Fernanda Sarelli" className="h-14 sm:h-16 lg:h-20 w-auto object-contain" />
          <div className="h-8 sm:h-9 lg:h-10 w-px bg-muted-foreground/30" />
          <img src={logoNovo} alt="Partido NOVO" className="h-8 sm:h-9 lg:h-10 xl:h-11 w-auto max-w-[80px] sm:max-w-[95px] lg:max-w-[110px] xl:max-w-[124px] object-contain" />
        </Link>

        {/* Social icons + Nav desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2">
            {socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden rounded-lg p-2 text-foreground hover:bg-muted"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t lg:hidden bg-background"
          >
            <div className="container flex flex-col gap-3 py-4">
              {/* Social pill tabs */}
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((s, i) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      i === 0
                        ? "bg-primary text-primary-foreground"
                        : "border border-primary text-primary"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </a>
                ))}
              </div>

              {/* Nav items as bordered list */}
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors ${
                      pathname === item.path
                        ? "border-primary bg-accent text-primary"
                        : "border-border text-foreground hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/admin/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-border px-4 py-3.5 text-sm font-medium text-primary transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  Painel Admin
                </Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
