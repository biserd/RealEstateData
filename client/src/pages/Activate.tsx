import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

const activateSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ActivateFormData = z.infer<typeof activateSchema>;

export default function Activate() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activated, setActivated] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setTokenError("No activation token provided. Please check your email for the activation link.");
    }
  }, [token]);

  const form = useForm<ActivateFormData>({
    resolver: zodResolver(activateSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (data: ActivateFormData) => {
      const response = await apiRequest("POST", "/api/auth/activate", {
        token,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setActivated(true);
      toast({
        title: "Account activated!",
        description: "Welcome to Realtors Dashboard. Redirecting...",
      });
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error: Error) => {
      const message = error.message.includes("410")
        ? "Your activation link has expired. Click below to request a new one."
        : error.message.includes("400")
        ? "Invalid activation link. Please check your email for the correct link."
        : "Activation failed. Please try again.";
      
      if (error.message.includes("410")) {
        setTokenError(message);
      } else {
        toast({
          title: "Activation failed",
          description: message,
          variant: "destructive",
        });
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/resend-activation", { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Activation email sent",
        description: "Check your email for a new activation link.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to resend",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ActivateFormData) => {
    activateMutation.mutate(data);
  };

  if (activated) {
    return (
      <>
        <SEO 
          title="Account Activated"
          description="Your Realtors Dashboard account has been activated."
        />
        <div className="min-h-screen bg-background flex flex-col">
          <MarketingHeader showLogin={false} />
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-2xl">Account Activated!</CardTitle>
                <CardDescription>
                  Your Pro subscription is ready. Redirecting to dashboard...
                </CardDescription>
              </CardHeader>
            </Card>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  if (tokenError) {
    return (
      <>
        <SEO 
          title="Activation Error"
          description="There was a problem with your activation link."
        />
        <div className="min-h-screen bg-background flex flex-col">
          <MarketingHeader showLogin={false} />
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Activation Link Problem</CardTitle>
                <CardDescription className="mt-2">
                  {tokenError}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Need a new activation link? Enter your email below.
                </p>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const email = formData.get("email") as string;
                    if (email) resendMutation.mutate(email);
                  }}
                  className="space-y-3"
                >
                  <Input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    data-testid="input-resend-email"
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={resendMutation.isPending}
                    data-testid="button-resend"
                  >
                    {resendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send New Activation Link
                  </Button>
                </form>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Activate Your Account"
        description="Set your password to activate your Realtors Dashboard Pro account."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingHeader showLogin={false} />
        
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-lg font-bold">RD</span>
              </div>
              <CardTitle className="text-2xl">Activate Your Account</CardTitle>
              <CardDescription>
                Set a password to complete your Pro subscription setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Create Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Minimum 8 characters"
                              data-testid="input-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              data-testid="input-confirm-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              data-testid="button-toggle-confirm-password"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={activateMutation.isPending}
                    data-testid="button-activate"
                  >
                    {activateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Activate Account
                  </Button>
                </form>
              </Form>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-sm mb-2">Your Pro benefits include:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Unlimited property unlocks</li>
                  <li>AI-powered Deal Memo generator</li>
                  <li>PDF report exports</li>
                  <li>Full comps data</li>
                  <li>Developer API access</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
}
