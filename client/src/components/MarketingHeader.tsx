import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Crown, Settings, LogOut, Home, ChevronDown } from "lucide-react";

interface MarketingHeaderProps {
  showLogin?: boolean;
}

export function MarketingHeader({ showLogin = true }: MarketingHeaderProps) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { isPro } = useSubscription();

  const navLinks = [
    { href: "/pricing", label: "Pricing" },
    { href: "/api-access", label: "API" },
    { href: "/developers", label: "Developers" },
    { href: "/release-notes", label: "What's New" },
    { href: "/about", label: "About" },
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

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-bold">RD</span>
            </div>
            <span className="text-lg tracking-tight hidden sm:inline-block" data-testid="text-logo">
              Realtors Dashboard
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={location === link.href ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-9 w-16 animate-pulse bg-muted rounded-md" />
              <div className="h-9 w-20 animate-pulse bg-muted rounded-md" />
            </div>
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="button-user-menu-marketing">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block text-sm max-w-[120px] truncate">
                    {user.firstName || user.email?.split("@")[0]}
                  </span>
                  {isPro && <Badge variant="default" className="text-xs"><Crown className="h-3 w-3" /></Badge>}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")} data-testid="menu-dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="menu-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : showLogin ? (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" data-testid="button-login">Log In</Button>
              </Link>
              <Link href="/pricing">
                <Button data-testid="button-get-pro">Get Pro</Button>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
