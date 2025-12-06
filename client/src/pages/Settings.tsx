import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Header } from "@/components/Header";
import { Key, Copy, RefreshCw, Trash2, AlertTriangle, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";

interface ApiKeyData {
  id: string;
  prefix: string;
  lastFour: string;
  name: string;
  status: string;
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
}

interface ApiKeyResponse {
  hasKey: boolean;
  apiKey: ApiKeyData | null;
}

interface GenerateKeyResponse {
  apiKey: ApiKeyData;
  rawKey: string;
  warning: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { isPro, isLoading: subLoading } = useSubscription();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiKeyData, isLoading } = useQuery<ApiKeyResponse>({
    queryKey: ["/api/api-keys"],
    enabled: isPro,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/api-keys/generate");
      return response.json();
    },
    onSuccess: (data: GenerateKeyResponse) => {
      setNewRawKey(data.rawKey);
      setShowGenerateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key generated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate API key", description: error.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiRequest("POST", `/api/api-keys/${keyId}/revoke`);
    },
    onSuccess: () => {
      setShowRevokeDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key revoked successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke API key", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (subLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and developer settings</p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>API Access</CardTitle>
                {isPro && <Badge variant="default">Pro</Badge>}
              </div>
              <CardDescription>
                Generate API keys to programmatically access Realtors Dashboard data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isPro ? (
                <UpgradePrompt
                  feature="API Access"
                  description="Upgrade to Pro to generate API keys and integrate with our data programmatically."
                />
              ) : (
                <div className="space-y-4">
                  {newRawKey && (
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <AlertTriangle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="space-y-3">
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Your new API key has been generated. Copy it now - you won't be able to see it again!
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-green-100 dark:bg-green-900 px-3 py-2 rounded text-sm font-mono break-all" data-testid="text-api-key">
                            {newRawKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(newRawKey)}
                            data-testid="button-copy-key"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {apiKeyData?.hasKey && apiKeyData.apiKey ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono" data-testid="text-key-display">
                              {apiKeyData.apiKey.prefix}****{apiKeyData.apiKey.lastFour}
                            </code>
                            <Badge variant={apiKeyData.apiKey.status === "active" ? "default" : "secondary"}>
                              {apiKeyData.apiKey.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Created: {new Date(apiKeyData.apiKey.createdAt).toLocaleDateString()}
                            {apiKeyData.apiKey.lastUsedAt && (
                              <> | Last used: {new Date(apiKeyData.apiKey.lastUsedAt).toLocaleDateString()}</>
                            )}
                            {apiKeyData.apiKey.requestCount > 0 && (
                              <> | {apiKeyData.apiKey.requestCount.toLocaleString()} requests</>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowGenerateDialog(true)}
                            data-testid="button-regenerate-key"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowRevokeDialog(true)}
                            data-testid="button-revoke-key"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No API key generated yet</p>
                      <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-key">
                        Generate API Key
                      </Button>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Developer Documentation</h4>
                      <p className="text-sm text-muted-foreground">
                        Learn how to integrate with our API
                      </p>
                    </div>
                    <Link href="/developers">
                      <Button variant="outline" data-testid="link-developers">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Docs
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {apiKeyData?.hasKey ? "Regenerate API Key" : "Generate API Key"}
            </DialogTitle>
            <DialogDescription>
              {apiKeyData?.hasKey
                ? "This will revoke your existing API key and generate a new one. Any integrations using the old key will stop working."
                : "Generate a new API key to access the Realtors Dashboard API programmatically."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-confirm-generate"
            >
              {generateMutation.isPending ? "Generating..." : "Generate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? Any integrations using this key will immediately stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => apiKeyData?.apiKey && revokeMutation.mutate(apiKeyData.apiKey.id)}
              disabled={revokeMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
