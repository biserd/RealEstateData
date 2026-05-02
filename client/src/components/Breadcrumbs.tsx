import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { BreadcrumbsJsonLd, type BreadcrumbItem } from "./JsonLd";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  emitJsonLd?: boolean;
}

export function Breadcrumbs({
  items,
  className,
  emitJsonLd = true,
}: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  const fullItems: BreadcrumbItem[] = [
    { name: "Home", url: "/" },
    ...items,
  ];

  return (
    <>
      {emitJsonLd && <BreadcrumbsJsonLd items={fullItems} />}
      <nav
        aria-label="Breadcrumb"
        className={className}
        data-testid="nav-breadcrumbs"
      >
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {fullItems.map((item, idx) => {
            const isLast = idx === fullItems.length - 1;
            return (
              <li key={`${item.url}-${idx}`} className="flex items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
                {isLast ? (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                    data-testid={`breadcrumb-current`}
                  >
                    {idx === 0 ? <Home className="h-3.5 w-3.5" /> : item.name}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="hover:text-foreground hover:underline underline-offset-2"
                    data-testid={`breadcrumb-link-${idx}`}
                  >
                    {idx === 0 ? <Home className="h-3.5 w-3.5" /> : item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
