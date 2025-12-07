import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Code, Key, Zap, Shield, Book, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const codeExamples = {
  curl: `curl -X GET "https://api.realtorsdashboard.com/api/external/properties?state=NY&limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`,
  javascript: `const response = await fetch(
  'https://api.realtorsdashboard.com/api/external/properties?state=NY&limit=10',
  {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    }
  }
);
const data = await response.json();
console.log(data);`,
  python: `import requests

response = requests.get(
    'https://api.realtorsdashboard.com/api/external/properties',
    params={'state': 'NY', 'limit': 10},
    headers={'x-api-key': 'YOUR_API_KEY'}
)
data = response.json()
print(data)`,
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code copied to clipboard" });
  };

  return (
    <div className="relative">
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={copyCode}
        data-testid={`button-copy-${language}`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function Developers() {
  return (
    <>
      <SEO 
        title="API Documentation - Developer Guide"
        description="Complete API documentation with code examples in cURL, JavaScript, and Python. Build real estate applications with our property data API."
      />
      <div className="min-h-screen bg-background">
      <MarketingHeader />
      
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Developer Documentation</Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-developers-title">
            Realtors Dashboard API
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Integrate real estate market intelligence directly into your applications
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover-elevate">
            <CardHeader>
              <Key className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Easy Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Simple API key authentication. Generate your key in Settings and start making requests.
              </p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardHeader>
              <Zap className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Real-Time Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Access up-to-date property data, market statistics, and opportunity scores.
              </p>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardHeader>
              <Shield className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Rate Limited</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                10 requests per second burst rate with 10,000 daily quota. Clear headers for reliable integrations.
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="getting-started" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="getting-started" data-testid="tab-getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="authentication" data-testid="tab-authentication">Authentication</TabsTrigger>
            <TabsTrigger value="endpoints" data-testid="tab-endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="errors" data-testid="tab-errors">Errors & Limits</TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>Get up and running in minutes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium">Get your API Key</h4>
                      <p className="text-muted-foreground">
                        Navigate to <Link href="/settings" className="text-primary hover:underline">Settings</Link> and generate your API key. Pro subscription required.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium">Make your first request</h4>
                      <p className="text-muted-foreground mb-3">
                        Include your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header.
                      </p>
                      <Tabs defaultValue="curl" className="w-full">
                        <TabsList>
                          <TabsTrigger value="curl">cURL</TabsTrigger>
                          <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                          <TabsTrigger value="python">Python</TabsTrigger>
                        </TabsList>
                        <TabsContent value="curl">
                          <CodeBlock code={codeExamples.curl} language="curl" />
                        </TabsContent>
                        <TabsContent value="javascript">
                          <CodeBlock code={codeExamples.javascript} language="javascript" />
                        </TabsContent>
                        <TabsContent value="python">
                          <CodeBlock code={codeExamples.python} language="python" />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium">Parse the response</h4>
                      <p className="text-muted-foreground">
                        All responses are JSON with a <code className="bg-muted px-1 rounded">success</code> field and <code className="bg-muted px-1 rounded">data</code> containing your results.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authentication" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Key Authentication</CardTitle>
                <CardDescription>Secure access to the API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  All API requests must include your API key in the <code className="bg-muted px-2 py-1 rounded">x-api-key</code> header.
                </p>
                <CodeBlock
                  code={`x-api-key: rd_live_xxxxxxxxxxxxxxxxxxxx`}
                  language="header"
                />
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Security Best Practices</h4>
                  <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>Never expose your API key in client-side code</li>
                    <li>Store your key in environment variables</li>
                    <li>Regenerate your key if you suspect it's been compromised</li>
                    <li>API keys are tied to your subscription - if it lapses, the key stops working</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Endpoints</CardTitle>
                <CardDescription>All the data you need</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">GET</Badge>
                      <code className="font-mono text-sm">/api/external/properties</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Search and filter properties across NY, NJ, and CT.
                    </p>
                    <div className="text-sm">
                      <strong>Query Parameters:</strong>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        <li><code>state</code> - Filter by state (NY, NJ, CT)</li>
                        <li><code>cities</code> - Comma-separated city names</li>
                        <li><code>zipCodes</code> - Comma-separated ZIP codes</li>
                        <li><code>propertyTypes</code> - Filter by property type</li>
                        <li><code>opportunityScoreMin</code> - Minimum opportunity score (0-100)</li>
                        <li><code>priceMin</code> / <code>priceMax</code> - Price range</li>
                        <li><code>limit</code> - Results per page (max 100)</li>
                        <li><code>offset</code> - Pagination offset</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">GET</Badge>
                      <code className="font-mono text-sm">/api/external/properties/:id</code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get detailed information about a specific property.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">GET</Badge>
                      <code className="font-mono text-sm">/api/external/market-stats</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Get market statistics for a geographic area.
                    </p>
                    <div className="text-sm">
                      <strong>Query Parameters:</strong>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        <li><code>geoType</code> - Type of geography (state, county, city, zip)</li>
                        <li><code>geoId</code> - Geography identifier</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">GET</Badge>
                      <code className="font-mono text-sm">/api/external/comps/:propertyId</code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Get comparable properties for valuation analysis.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">GET</Badge>
                      <code className="font-mono text-sm">/api/external/up-and-coming</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Get trending ZIP codes based on our proprietary algorithm.
                    </p>
                    <div className="text-sm">
                      <strong>Query Parameters:</strong>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        <li><code>state</code> - Filter by state (optional)</li>
                        <li><code>limit</code> - Number of results (max 50)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Codes</CardTitle>
                <CardDescription>Understanding API responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Badge variant="destructive">401</Badge>
                    <div>
                      <p className="font-medium">Unauthorized</p>
                      <p className="text-sm text-muted-foreground">Missing or invalid API key</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Badge variant="destructive">400</Badge>
                    <div>
                      <p className="font-medium">Bad Request</p>
                      <p className="text-sm text-muted-foreground">Missing required parameters</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Badge variant="destructive">404</Badge>
                    <div>
                      <p className="font-medium">Not Found</p>
                      <p className="text-sm text-muted-foreground">Resource doesn't exist</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Badge variant="destructive">429</Badge>
                    <div>
                      <p className="font-medium">Too Many Requests</p>
                      <p className="text-sm text-muted-foreground">Rate limit exceeded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Badge variant="destructive">500</Badge>
                    <div>
                      <p className="font-medium">Internal Server Error</p>
                      <p className="text-sm text-muted-foreground">Something went wrong on our end</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limits</CardTitle>
                <CardDescription>Fair usage policy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  API requests are rate limited to ensure fair usage and service stability. There are two types of limits:
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">10</p>
                    <p className="text-sm text-muted-foreground">Requests per second (burst)</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">10,000</p>
                    <p className="text-sm text-muted-foreground">Requests per day (quota)</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">100</p>
                    <p className="text-sm text-muted-foreground">Max results per request</p>
                  </div>
                </div>
                <div className="text-sm space-y-2">
                  <div>
                    <strong>Burst Limit:</strong>
                    <p className="text-muted-foreground">Prevents rapid-fire requests. Limited to 10 requests per second with a sliding window.</p>
                  </div>
                  <div>
                    <strong>Daily Quota:</strong>
                    <p className="text-muted-foreground">Total API calls per day. Resets at midnight UTC. Monitor via response headers.</p>
                  </div>
                </div>
                <div className="text-sm">
                  <strong>Rate Limit Headers:</strong>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                    <li><code>X-RateLimit-Limit</code> - Maximum requests per window</li>
                    <li><code>X-RateLimit-Remaining</code> - Remaining requests in daily quota</li>
                    <li><code>X-RateLimit-Reset</code> - Unix timestamp when daily quota resets</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-12" />

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Generate your API key and start building integrations today.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/settings">
              <Button data-testid="button-go-to-settings">
                <Key className="h-4 w-4 mr-2" />
                Get API Key
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" data-testid="button-view-pricing">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
      </div>
    </>
  );
}
