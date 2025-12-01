import { MarketingLayout } from "@/components/layouts";

export default function Terms() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 1, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using TriState Intel ("the Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our Service. We reserve the right to modify these 
              terms at any time, and such modifications will be effective immediately upon posting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              TriState Intel provides real estate market intelligence, property analysis, and investment opportunity 
              identification services for properties in New York, New Jersey, and Connecticut. Our platform offers 
              market data, property valuations, opportunity scoring, and AI-powered analysis tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              To access certain features of the Service, you must create an account. You are responsible for 
              maintaining the confidentiality of your account credentials and for all activities that occur under 
              your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Accuracy and Limitations</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to provide accurate and up-to-date information, TriState Intel does not guarantee 
              the accuracy, completeness, or reliability of any data or analysis provided through the Service. 
              Our market data is sourced from public records and third-party providers, and may contain errors 
              or omissions. Users should independently verify all information before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Not Financial Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              The information provided by TriState Intel is for informational purposes only and does not constitute 
              financial, legal, or investment advice. Our opportunity scores, market analysis, and AI-generated 
              insights are tools to assist your research, not recommendations to buy, sell, or hold any property. 
              Always consult with qualified professionals before making real estate investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, features, and functionality of the Service, including but not limited to text, graphics, 
              logos, algorithms, and software, are the exclusive property of TriState Intel and are protected by 
              copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or 
              create derivative works without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Prohibited Uses</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Scrape, crawl, or extract data for commercial purposes without authorization</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Transmit malware or other harmful code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, TriState Intel shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including but not limited to loss of 
              profits, data, or business opportunities, arising from your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your access to the Service at any time, with or 
              without cause, and with or without notice. Upon termination, your right to use the Service will 
              immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:legal@tristateintel.com" className="text-primary hover:underline">
                legal@tristateintel.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
