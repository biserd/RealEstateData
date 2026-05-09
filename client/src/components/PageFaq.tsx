import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
}

interface PageFaqProps {
  items: FaqItem[];
  title?: string;
}

export function PageFaq({ items, title = "Frequently asked questions" }: PageFaqProps) {
  if (!items || items.length === 0) return null;
  return (
    <Card data-testid="card-page-faq">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} data-testid={`faq-item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

const fmtPrice = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n).toLocaleString()}`;

export function buildUnitFaq(opts: {
  displayAddress: string;
  buildingAddress?: string | null;
  borough?: string | null;
  zipCode?: string | null;
  lastSalePrice?: number | null;
  lastSaleDate?: string | null;
  buildingMedianPrice?: number | null;
  buildingSalesCount?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
}): FaqItem[] {
  const items: FaqItem[] = [];
  const {
    displayAddress,
    buildingAddress,
    borough,
    zipCode,
    lastSalePrice,
    lastSaleDate,
    buildingMedianPrice,
    buildingSalesCount,
    beds,
    baths,
    sqft,
  } = opts;

  if (lastSalePrice && lastSaleDate) {
    items.push({
      q: `When did ${displayAddress} last sell?`,
      a: `On ${new Date(lastSaleDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} for ${fmtPrice(lastSalePrice)} (verified ACRIS public record).`,
    });
  }

  if (lastSalePrice && buildingMedianPrice && (buildingSalesCount ?? 0) >= 3) {
    const diff = Math.round(((lastSalePrice - buildingMedianPrice) / buildingMedianPrice) * 100);
    const dir = diff < 0 ? `${Math.abs(diff)}% below` : diff > 0 ? `${diff}% above` : "in line with";
    items.push({
      q: `How does this unit compare to other sales in ${buildingAddress || "the building"}?`,
      a: `The last recorded sale of ${fmtPrice(lastSalePrice)} sits ${dir} the building median of ${fmtPrice(buildingMedianPrice)} across ${buildingSalesCount} sales in the past 36 months.`,
    });
  }

  if (buildingMedianPrice && (buildingSalesCount ?? 0) >= 3) {
    items.push({
      q: `How active is the sales market at ${buildingAddress || "this building"}?`,
      a: `${buildingSalesCount} verified condo sales recorded in the past 36 months at a median price of ${fmtPrice(buildingMedianPrice)}.`,
    });
  }

  if (beds || baths || sqft) {
    const parts = [
      beds ? `${beds} bedroom${beds === 1 ? "" : "s"}` : null,
      baths ? `${baths} bathroom${baths === 1 ? "" : "s"}` : null,
      sqft ? `${sqft.toLocaleString()} square feet` : null,
    ].filter(Boolean).join(", ");
    items.push({
      q: `What is the floor plan of ${displayAddress}?`,
      a: `Public records list this unit as ${parts}.`,
    });
  }

  if (zipCode) {
    items.push({
      q: `What ZIP code is ${displayAddress} in?`,
      a: `${zipCode}${borough ? `, in ${borough}` : ""}. See the neighborhood report for ${zipCode} for market trends and comparable sales.`,
    });
  }

  return items;
}

export function buildPropertyFaq(opts: {
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  lastSalePrice?: number | null;
  lastSaleDate?: string | null;
  estimatedValue?: number | null;
  opportunityScore?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
}): FaqItem[] {
  const items: FaqItem[] = [];
  const {
    address, city, state, zipCode,
    lastSalePrice, lastSaleDate,
    estimatedValue, opportunityScore,
    beds, baths, sqft, yearBuilt, propertyType,
  } = opts;

  if (lastSalePrice && lastSaleDate) {
    items.push({
      q: `When did ${address} last sell?`,
      a: `On ${new Date(lastSaleDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} for ${fmtPrice(lastSalePrice)} (verified public record).`,
    });
  }

  if (estimatedValue) {
    items.push({
      q: `What is ${address} worth?`,
      a: `Our model estimates ${fmtPrice(estimatedValue)}${opportunityScore ? `, with an opportunity score of ${opportunityScore}/100` : ""}. See the methodology page for how this is calculated.`,
    });
  }

  if (beds || baths || sqft || yearBuilt) {
    const parts = [
      beds ? `${beds} bedroom${beds === 1 ? "" : "s"}` : null,
      baths ? `${baths} bathroom${baths === 1 ? "" : "s"}` : null,
      sqft ? `${sqft.toLocaleString()} square feet` : null,
      yearBuilt ? `built in ${yearBuilt}` : null,
    ].filter(Boolean).join(", ");
    items.push({
      q: `What are the basic details of ${address}?`,
      a: `Public records list this ${(propertyType || "property").toLowerCase()} as ${parts}.`,
    });
  }

  if (zipCode) {
    items.push({
      q: `What neighborhood is ${address} in?`,
      a: `${city ? `${city}, ` : ""}${state || ""} (ZIP ${zipCode}). See the neighborhood report for ${zipCode} for market trends and comparable sales.`,
    });
  }

  return items;
}
