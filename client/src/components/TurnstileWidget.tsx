import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action: "login" | "register" | "forgot_password";
  onToken: (token: string | null) => void;
  onEnabledChange?: (enabled: boolean) => void;
}

let scriptPromise: Promise<void> | null = null;
const TURNSTILE_SITE_KEY = "0x4AAAAAAEhj75hc4gIoOsCg";

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-rd-turnstile="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.rdTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({ action, onToken, onEnabledChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? TURNSTILE_SITE_KEY
    : null;

  useEffect(() => {
    onEnabledChange?.(Boolean(siteKey));
    return () => onEnabledChange?.(false);
  }, [onEnabledChange, siteKey]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let widgetId: string | undefined;
    let active = true;
    loadTurnstileScript().then(() => {
      if (!active || !containerRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: "auto",
        appearance: "interaction-only",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }).catch(() => onToken(null));
    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex min-h-0 justify-center" data-testid="turnstile-widget" />;
}
