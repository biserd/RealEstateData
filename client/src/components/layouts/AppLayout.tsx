import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface AppLayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
}

export function AppLayout({ children, showSearch = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showSearch={showSearch} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
