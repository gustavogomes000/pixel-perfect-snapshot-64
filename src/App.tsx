import { ComponentPropsWithoutRef, forwardRef, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TrackingProvider from "@/components/TrackingProvider";
import Index from "./pages/Index";

// Lazy load non-critical routes
const Sobre = lazy(() => import("./pages/Sobre"));
const Agenda = lazy(() => import("./pages/Agenda"));
const RedesSociais = lazy(() => import("./pages/RedesSociais"));
const Integracao = lazy(() => import("./pages/Integracao"));
const Contato = lazy(() => import("./pages/Contato"));
const GaleriaPublica = lazy(() => import("./pages/Galeria"));
const AdminLoginPage = lazy(() => import("./pages/admin/Login"));
const Gallery = lazy(() => import("./pages/admin/Gallery"));
const Forms = lazy(() => import("./pages/admin/Forms"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ValidarCaptura = lazy(() => import("./pages/ValidarCaptura"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const AppShell = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <TrackingProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/redes-sociais" element={<RedesSociais />} />
              <Route path="/integracao" element={<Integracao />} />
              <Route path="/contato" element={<Contato />} />
              <Route path="/galeria" element={<GaleriaPublica />} />
              <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/galeria" element={<Gallery />} />
              <Route path="/admin/formularios" element={<Forms />} />
              <Route path="/admin/configuracoes" element={<SettingsPage />} />
              <Route path="/validar-captura" element={<ValidarCaptura />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TrackingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function App(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={["contents", className].filter(Boolean).join(" ")}
      {...props}
    >
      <AppShell />
    </div>
  );
});

App.displayName = "App";

export default App;
