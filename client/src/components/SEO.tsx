import { useEffect } from "react";

const DEFAULT_TITLE = "Realtors Dashboard - Real Estate Market Intelligence";
const DEFAULT_DESCRIPTION = "Find underpriced properties and understand market pricing with AI-powered real estate intelligence. Currently covering NY, NJ, CT with more states coming soon.";

interface SEOProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  noIndex?: boolean;
}

export function SEO({ 
  title, 
  description, 
  canonicalUrl,
  ogImage = "/og-image.png",
  ogType = "website",
  noIndex = false,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes("Realtors Dashboard") 
      ? title 
      : `${title} | Realtors Dashboard`;
    
    const previousTitle = document.title;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const getMeta = (name: string, property = false): string | null => {
      const attr = property ? "property" : "name";
      const meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      return meta?.content || null;
    };

    const prevDescription = getMeta("description");
    const prevOgTitle = getMeta("og:title", true);
    const prevOgDescription = getMeta("og:description", true);
    const prevOgType = getMeta("og:type", true);
    const prevOgImage = getMeta("og:image", true);
    const prevTwitterCard = getMeta("twitter:card");
    const prevTwitterTitle = getMeta("twitter:title");
    const prevTwitterDescription = getMeta("twitter:description");
    const prevTwitterImage = getMeta("twitter:image");

    setMeta("description", description);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:type", ogType, true);
    if (ogImage) {
      setMeta("og:image", ogImage, true);
    }
    
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    if (ogImage) {
      setMeta("twitter:image", ogImage);
    }

    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) {
        robotsMeta.remove();
      }
    }

    let prevCanonical: string | null = null;
    if (canonicalUrl) {
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      prevCanonical = canonical?.href || null;
      
      let canonicalLink = canonical;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("description", DEFAULT_DESCRIPTION);
      setMeta("og:title", DEFAULT_TITLE, true);
      setMeta("og:description", DEFAULT_DESCRIPTION, true);
      setMeta("og:type", "website", true);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", DEFAULT_TITLE);
      setMeta("twitter:description", DEFAULT_DESCRIPTION);
      
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        canonical.remove();
      }
    };
  }, [title, description, canonicalUrl, ogImage, ogType, noIndex]);

  return null;
}
