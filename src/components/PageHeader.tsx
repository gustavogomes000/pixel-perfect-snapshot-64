import WaveDivider from "./WaveDivider";

const PageHeader = ({ title, titleAccent, subtitle }: { title: string; titleAccent: string; subtitle: string }) => (
  <section className="gradient-hero relative text-center overflow-hidden">
    <div className="container py-16 md:py-20 relative z-10">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground">
        {title} <span className="text-primary-foreground">{titleAccent}</span>
      </h1>
      <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">{subtitle}</p>
    </div>
    <WaveDivider />
  </section>
);

export default PageHeader;
