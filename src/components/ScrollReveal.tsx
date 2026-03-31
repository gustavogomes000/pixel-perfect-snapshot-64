import { ReactNode, useRef, useEffect, useState } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

const hiddenClass: Record<string, string> = {
  up: "opacity-0 translate-y-5",
  down: "opacity-0 -translate-y-5",
  left: "opacity-0 translate-x-5",
  right: "opacity-0 -translate-x-5",
};

const ScrollReveal = ({ children, className, delay = 0, direction = "up" }: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out will-change-[opacity,transform] ${
        visible ? "opacity-100 translate-x-0 translate-y-0" : hiddenClass[direction]
      } ${className ?? ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
