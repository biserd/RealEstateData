import { MarketingLayout } from "@/components/layouts";

export default function Privacy() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 1, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Realtors Dashboard ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our real estate 
              market intelligence platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information in the following ways:
            </p>
            <h3 className="text-lg font-medium mb-2">Account Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you create an account, we collect your name, email address, and authentication credentials 
              through our identity provider (Replit Auth).
            </p>
            <h3 className="text-lg font-medium mb-2">Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We automatically collect information about how you interact with our Service, including pages viewed, 
              properties searched, watchlist items, and AI chat conversations.
            </p>
            <h3 className="text-lg font-medium mb-2">Device Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              We collect information about the device you use to access our Service, including IP address, 
              browser type, operating system, and device identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve our Service</li>
              <li>Personalize your experience and deliver relevant content</li>
              <li>Process your requests and manage your account</li>
              <li>Send you notifications about properties and market updates</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Service Providers:</strong> With third-party vendors who assist in operating our platform</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>With Your Consent:</strong> When you have given us permission to share</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information 
              against unauthorized access, alteration, disclosure, or destruction. This includes encryption, 
              secure server infrastructure, and regular security assessments. However, no method of transmission 
              over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide 
              you services. We may retain certain information for longer periods as required by law or for 
              legitimate business purposes such as analytics and fraud prevention.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience, analyze usage, 
              and deliver personalized content. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for individuals under the age of 18. We do not knowingly collect 
              personal information from children. If we become aware that we have collected data from a child, 
              we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes 
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at{" "}
              <a href="mailto:hello@realtorsdashboard.com" className="text-primary hover:underline">
                hello@realtorsdashboard.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </MarketingLayout>
  );
}
