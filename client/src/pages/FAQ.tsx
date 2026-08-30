import { useState } from "react";
import { MarketingLayout } from "@/components/layouts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { HelpCircle, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import { FAQJsonLd } from "@/components/JsonLd";

export default function FAQ() {
  const generalFAQs = [
    {
      question: "What is Realtors Dashboard?",
      answer: "Realtors Dashboard is a source-backed NYC recorded-sales research platform. It publishes reproducible market snapshots, comparable-sale context, and deterministic opportunity scores with explicit coverage and freshness."
    },
    {
      question: "Which areas do you cover?",
      answer: "Verified parcel and unit detail currently focuses on NYC. Non-NYC New York, New Jersey, and Connecticut publish only when their source, identity, freshness, and quality gates pass. Every market response identifies its effective geography and dataset date."
    },
    {
      question: "How accurate is your data?",
      answer: "Current public detail data comes from named official NYC sources, including PLUTO, Department of Finance rolling sales, ACRIS transactions, and condo-unit identity records. A record is public only after source, geography, price, completeness, and quarantine checks pass."
    },
    {
      question: "How often is the data updated?",
      answer: "Updates are manually triggered. New source data is imported into a candidate dataset, audited, and then atomically published. Failed quality gates leave the previous publication active. Each data page shows its effective period and publication freshness."
    },
  ];

  const featureFAQs = [
    {
      question: "What is the Opportunity Score?",
      answer: "The Opportunity Score is our proprietary 0-100 rating that identifies potentially undervalued properties. It considers factors like pricing relative to comparables, market trends, and property characteristics. Higher scores indicate greater potential opportunity."
    },
    {
      question: "How does the AI analysis work?",
      answer: "Optional AI summaries use the facts already displayed on a property page. They can be incomplete or wrong and are not appraisals or investment recommendations; users should verify every material fact against the cited public record."
    },
    {
      question: "Can I save and track properties?",
      answer: "Accounts can save published properties and searches. Because the dataset refresh is manual rather than real time, saved items are not a live-listing alert service."
    },
    {
      question: "Can I export my data?",
      answer: "Yes, all reports and analyses can be exported in CSV or JSON format for use in your own analysis tools or presentations."
    },
  ];

  const pricingFAQs = [
    {
      question: "Is Realtors Dashboard free to use?",
      answer: "We offer free access to browse properties, view market data, and explore basic features. Premium features like AI analysis, Deal Memos, and advanced exports are available with a subscription."
    },
    {
      question: "Is there a free trial?",
      answer: "Yes. Pro and Premium start with a 14-day free trial. Your payment method is collected at signup, but you are not charged until the trial ends. Cancel during the trial to avoid a charge."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
    },
  ];

  const allFAQs = [...generalFAQs, ...featureFAQs, ...pricingFAQs];

  const [openGeneral, setOpenGeneral] = useState<string[]>(() => generalFAQs.map((_, i) => `general-${i}`));
  const [openFeature, setOpenFeature] = useState<string[]>(() => featureFAQs.map((_, i) => `feature-${i}`));
  const [openPricing, setOpenPricing] = useState<string[]>(() => pricingFAQs.map((_, i) => `pricing-${i}`));

  return (
    <MarketingLayout showBackButton={false}>
      <SEO
        title="Frequently Asked Questions - Realtors Dashboard"
        description="Answers to common questions about Realtors Dashboard, our real estate data sources, AI features, pricing, billing, and more."
        canonicalUrl="https://realtorsdashboard.com/faq"
      />
      <FAQJsonLd items={allFAQs} />
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-4 md:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground">
            Find answers to common questions about Realtors Dashboard, our features, and pricing.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              General Questions
            </h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="multiple" value={openGeneral} onValueChange={setOpenGeneral} className="w-full">
                  {generalFAQs.map((faq, index) => (
                    <AccordionItem key={index} value={`general-${index}`}>
                      <AccordionTrigger className="text-left" data-testid={`faq-general-${index}`}>
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Features & Data
            </h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="multiple" value={openFeature} onValueChange={setOpenFeature} className="w-full">
                  {featureFAQs.map((faq, index) => (
                    <AccordionItem key={index} value={`feature-${index}`}>
                      <AccordionTrigger className="text-left" data-testid={`faq-feature-${index}`}>
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Pricing & Billing
            </h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="multiple" value={openPricing} onValueChange={setOpenPricing} className="w-full">
                  {pricingFAQs.map((faq, index) => (
                    <AccordionItem key={index} value={`pricing-${index}`}>
                      <AccordionTrigger className="text-left" data-testid={`faq-pricing-${index}`}>
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        </div>

        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Still have questions?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Our team is here to help.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact">
                <Button data-testid="button-contact-us">Contact Us</Button>
              </Link>
              <a href="mailto:hello@realtorsdashboard.com">
                <Button variant="outline" data-testid="button-email-us">
                  Email hello@realtorsdashboard.com
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
