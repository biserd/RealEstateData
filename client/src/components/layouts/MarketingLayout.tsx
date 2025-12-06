import { Footer } from "@/components/Footer";
import { MarketingHeader } from "@/components/MarketingHeader";

interface MarketingLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  customHeader?: React.ReactNode;
}

export function MarketingLayout({ children, showBackButton = true, customHeader }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {customHeader || <MarketingHeader />}
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
