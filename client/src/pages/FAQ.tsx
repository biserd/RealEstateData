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

export default function FAQ() {
  const generalFAQs = [
    {
      question: "What is Realtors Dashboard?",
      answer: "Realtors Dashboard is an AI-powered real estate market intelligence platform that helps buyers, investors, and agents find undervalued properties and make data-driven decisions. We aggregate public data, apply rigorous analysis, and present actionable insights."
    },
    {
      question: "Which areas do you cover?",
      answer: "We currently cover New York, New Jersey, and Connecticut with comprehensive property and market data. We're actively expanding nationwide and will be adding more states soon."
    },
    {
      question: "How accurate is your data?",
      answer: "Our data comes from authoritative public sources including NYC Open Data (PLUTO, rolling sales, ACRIS transactions), Zillow Research, and county records. All data is validated regularly and processed through our quality pipeline to ensure accuracy."
    },
    {
      question: "How often is the data updated?",
      answer: "Our data is updated regularly as new records become available from our sources. Market aggregates and pricing trends are refreshed to reflect the latest transactions and valuations."
    },
  ];

  const featureFAQs = [
    {
      question: "What is the Opportunity Score?",
      answer: "The Opportunity Score is our proprietary 0-100 rating that identifies potentially undervalued properties. It considers factors like pricing relative to comparables, market trends, and property characteristics. Higher scores indicate greater potential opportunity."
    },
    {
      question: "How does the AI analysis work?",
      answer: "Our AI assistant analyzes properties using real data and market context. It provides pricing analysis, market comparisons, risk factors, and investment recommendations—all backed by citations from our data sources. No hallucinations, just evidence-based insights."
    },
    {
      question: "Can I save and track properties?",
      answer: "Yes! With a free account, you can create watchlists to save properties you're interested in. You'll receive alerts when there are updates to properties matching your criteria."
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
      question: "Do you offer refunds?",
      answer: "Yes, we offer a 14-day money-back guarantee for all subscriptions. If you're not satisfied, contact us within 14 days for a full refund."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
    },
  ];

  return (
    <MarketingLayout showBackButton={false}>
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
                <Accordion type="single" collapsible className="w-full">
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
                <Accordion type="single" collapsible className="w-full">
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
                <Accordion type="single" collapsible className="w-full">
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
