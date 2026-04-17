import { ReactNode, useEffect, useRef, useState } from "react";

interface ParallaxRevealCardProps {
  children: ReactNode;
  className?: string;
  /** Atraso em ms para escalonar cards adjacentes */
  delay?: number;
}

/**
 * Card que revela seu conteúdo de forma progressiva conforme o usuário rola.
 * Usa IntersectionObserver com múltiplos thresholds para criar um efeito
 * "parallax reveal": o conteúdo intensifica (opacity + translateY + scale)
 * conforme o card se aproxima do centro da tela.
 *
 * Respeita prefers-reduced-motion.
 */
const ParallaxRevealCard = ({ children, className = "", delay = 0 }: ParallaxRevealCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 → 1
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current) {
      setProgress(1);
      return;
    }

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Quando o topo do card está a 90% da viewport → 0
      // Quando o centro do card está a 50% da viewport → 1
      const start = vh * 0.9;
      const end = vh * 0.4;
      const top = rect.top;
      let p: number;
      if (top >= start) p = 0;
      else if (top <= end) p = 1;
      else p = (start - top) / (start - end);
      setProgress(Math.max(0, Math.min(1, p)));
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const opacity = progress;
  const translateY = (1 - progress) * 32; // px
  const scale = 0.96 + progress * 0.04;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity,
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
};

export default ParallaxRevealCard;
