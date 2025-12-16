import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Search, LogOut, Settings, ChevronDown, TrendingUp, Building2, Heart, Home, Crown, CreditCard, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
  showSearch?: boolean;
}

export function Header({ onMenuClick, showSearch = true }: HeaderProps) {
  const { user, logout } = useAuth();
  const { isPro, isPremium, isFree } = useSubscription();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/market-intelligence", label: "Market Explorer", icon: Search },
    { href: "/investment-opportunities", label: "Opportunity Screener", icon: Building2 },
    { href: "/up-and-coming", label: "Trending Areas", icon: TrendingUp },
    { href: "/saved-properties", label: "Watchlists", icon: Heart },
    { href: "/portfolio", label: "Portfolio", icon: BarChart3, premium: true },
  ];

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">RD</span>
                </div>
                <span>Realtors Dashboard</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={location === item.href ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-12 text-base",
                        location === item.href && "bg-muted"
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">RD</span>
          </div>
          <span className="hidden text-lg tracking-tight sm:inline-block" data-testid="text-logo">
            Realtors Dashboard
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={location === item.href ? "secondary" : "ghost"}
                size="sm"
                className="text-sm"
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {showSearch && (
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by ZIP, city, or address..."
                className="pl-10 bg-muted/50"
                data-testid="input-search"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 pl-2 pr-1" data-testid="button-user-menu">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.profileImageUrl || undefined} className="object-cover" />
                  <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.profileImageUrl || undefined} className="object-cover" />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"}
                    </span>
                    {isPro && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4" data-testid="badge-pro">
                        <Crown className="h-2.5 w-2.5 mr-0.5" />
                        PRO
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <Link href="/settings">
                <DropdownMenuItem data-testid="menu-settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </Link>
              {isFree ? (
                <Link href="/pricing">
                  <DropdownMenuItem data-testid="menu-upgrade" className="text-primary">
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </Link>
              ) : (
                <Link href="/pricing">
                  <DropdownMenuItem data-testid="menu-billing">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </DropdownMenuItem>
                </Link>
              )}
              {user?.role === "admin" && (
                <>
                  <DropdownMenuSeparator />
                  <Link href="/admin-console">
                    <DropdownMenuItem data-testid="menu-admin">
                      <Settings className="mr-2 h-4 w-4" />
                      Admin Console
                    </DropdownMenuItem>
                  </Link>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => logout()}
                className="cursor-pointer"
                data-testid="menu-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
