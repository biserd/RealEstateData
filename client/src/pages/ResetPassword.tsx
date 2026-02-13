import { useState } from "react";
import { Link, useLocation } from "wouter";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from "lucide-react";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expired, setExpired] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: ResetFormData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      if (!response.ok) {
        const err = await response.json();
        if (err.expired) {
          setExpired(true);
        }
        throw new Error(err.message || "Reset failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: Error) => {
      if (!expired) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: ResetFormData) => {
    resetMutation.mutate(data);
  };

  if (!token) {
    return (
      <>
        <SEO title="Reset Password" description="Reset your Realtors Dashboard password." />
        <div className="min-h-screen bg-background flex flex-col">
          <MarketingHeader showLogin={false} />
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">Invalid reset link</CardTitle>
                <CardDescription>
                  This password reset link is missing or invalid.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link href="/forgot-password">
                  <Button className="w-full" data-testid="link-request-new-reset">
                    Request a new reset link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                    Back to login
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  if (expired) {
    return (
      <>
        <SEO title="Reset Password" description="Reset your Realtors Dashboard password." />
        <div className="min-h-screen bg-background flex flex-col">
          <MarketingHeader showLogin={false} />
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">Link expired</CardTitle>
                <CardDescription>
                  This password reset link has expired. Please request a new one.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link href="/forgot-password">
                  <Button className="w-full" data-testid="link-request-new-reset">
                    Request a new reset link
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <SEO title="Password Reset" description="Your password has been reset successfully." />
        <div className="min-h-screen bg-background flex flex-col">
          <MarketingHeader showLogin={false} />
          <main className="flex-1 flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">Password reset</CardTitle>
                <CardDescription>
                  Your password has been updated. You can now log in with your new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-go-to-login"
                >
                  Go to login
                </Button>
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
      <SEO title="Reset Password" description="Choose a new password for your Realtors Dashboard account." />
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingHeader showLogin={false} />

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <KeyRound className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl">Set a new password</CardTitle>
              <CardDescription>
                Choose a strong password for your account.
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
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="At least 8 characters"
                              data-testid="input-new-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
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
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirm ? "text" : "password"}
                              placeholder="Confirm your password"
                              data-testid="input-confirm-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowConfirm(!showConfirm)}
                              data-testid="button-toggle-confirm"
                            >
                              {showConfirm ? (
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
                    disabled={resetMutation.isPending}
                    data-testid="button-reset-submit"
                  >
                    {resetMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    </>
  );
}
