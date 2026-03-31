const WaveDivider = ({ className = "", flip = false }: { className?: string; flip?: boolean }) => (
  <div className={`w-full overflow-hidden leading-none ${flip ? "rotate-180" : ""} ${className}`}>
    <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-16 md:h-24">
      <path
        d="M0,40 C360,100 1080,0 1440,60 L1440,100 L0,100 Z"
        fill="white"
      />
    </svg>
  </div>
);

export default WaveDivider;
