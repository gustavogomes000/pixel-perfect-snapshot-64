import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppFloat from "./WhatsAppFloat";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen flex-col">
    <Header />
    <main className="flex-1 page-enter">{children}</main>
    <Footer />
    <WhatsAppFloat />
  </div>
);

export default Layout;
