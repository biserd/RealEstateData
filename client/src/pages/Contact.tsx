import { Mail, MapPin, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingLayout } from "@/components/layouts";
import { SEO } from "@/components/SEO";

export default function Contact() {
  const contactInfo = [
    {
      icon: <Mail className="h-5 w-5" />,
      title: "Email",
      value: "hello@realtorsdashboard.com",
      href: "mailto:hello@realtorsdashboard.com",
    },
    {
      icon: <MapPin className="h-5 w-5" />,
      title: "Location",
      value: "New York, NY",
      href: null,
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: "Response Time",
      value: "1-2 business days",
      href: null,
    },
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Contact Us - Realtors Dashboard"
        description="Get in touch with the Realtors Dashboard team. Reach us at hello@realtorsdashboard.com or send a message — we typically reply within 1-2 business days."
        canonicalUrl="https://realtorsdashboard.com/contact"
      />
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="max-w-3xl mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-4 md:text-4xl">
            Contact Us
          </h1>
          <p className="text-lg text-muted-foreground">
            Have questions about our platform or need help with your account? We're here to help.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Send us a message
                </CardTitle>
                <CardDescription>Email is the supported contact channel.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  <p className="text-muted-foreground">Write to us for account support, billing questions, product feedback, partnerships, or data corrections. Include the affected URL and source evidence when reporting a data issue.</p>
                  <a href="mailto:hello@realtorsdashboard.com?subject=Realtors%20Dashboard%20inquiry">
                    <Button data-testid="button-email-contact"><Mail className="mr-2 h-4 w-4" />Email hello@realtorsdashboard.com</Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contactInfo.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.href ? (
                        <a 
                          href={item.href} 
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>FAQ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">How accurate is your data?</p>
                  <p className="text-sm text-muted-foreground">
                    Our data comes from official public sources and is validated regularly.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Is there a free trial?</p>
                  <p className="text-sm text-muted-foreground">
                    Yes. Pro and Premium start with a 14-day free trial. Cancel during the trial to avoid a charge.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Can I export my data?</p>
                  <p className="text-sm text-muted-foreground">
                    Yes, all reports and analyses can be exported in CSV or JSON format.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
