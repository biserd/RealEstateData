import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MarketingLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  customHeader?: React.ReactNode;
}

export function MarketingLayout({ children, showBackButton = true, customHeader }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {customHeader || (
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
            {showBackButton ? (
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            ) : (
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">TI</span>
                </div>
                <span className="text-lg tracking-tight">TriState Intel</span>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>
      )}
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
