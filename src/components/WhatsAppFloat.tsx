import { MessageCircle } from "lucide-react";

const WhatsAppFloat = () => (
  <a
    href="https://wa.me/5562993237397?text=Ol%C3%A1%20Dra.%20Fernanda%20Sarelli"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Fale pelo WhatsApp"
    className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-[0_10px_20px_hsl(340_82%_55%/0.35)] transition-transform hover:scale-110 will-change-transform float-bounce"
  >
    <MessageCircle className="relative h-7 w-7 text-primary-foreground" />
  </a>
);

export default WhatsAppFloat;
