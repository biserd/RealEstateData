import { useState } from "react";
import { Send, Bot, User, Loader2, AlertCircle, FileText, ExternalLink, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AIResponse, ConfidenceLevel } from "@shared/schema";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AIResponse;
  timestamp: Date;
}

interface AIChatProps {
  propertyId?: string;
  geoId?: string;
  contextLabel?: string;
  onSendMessage?: (message: string) => Promise<AIResponse>;
}

export function AIChat({ propertyId, geoId, contextLabel, onSendMessage }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getConfidenceBadgeVariant = (level: ConfidenceLevel) => {
    switch (level) {
      case "High":
        return "default";
      case "Medium":
        return "secondary";
      case "Low":
        return "outline";
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      if (onSendMessage) {
        const response = await onSendMessage(input.trim());
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answerSummary,
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const response: AIResponse = {
          answerSummary: "I'm sorry, but I'm currently unable to process your request. Please try again later.",
          keyNumbers: [],
          evidence: [],
          confidence: "Low",
          limitations: ["AI service not connected"],
        };
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answerSummary,
          response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "Is this property priced fairly?",
    "What are the key risks?",
    "How does this compare to the neighborhood?",
    "Explain the opportunity score",
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">Market Intelligence Assistant</h3>
          {contextLabel && (
            <p className="text-xs text-muted-foreground">{contextLabel}</p>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-1.5 shrink-0">
                  <Shield className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Data-Grounded Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    All responses are based on real property data, comparable sales, and market statistics. 
                    Look for evidence citations to see exactly what data backs each insight.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Property records
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Sales history
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Market trends
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <Button
                    key={question}
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal py-2 text-left text-xs"
                    onClick={() => setInput(question)}
                    data-testid={`suggested-question-${question.slice(0, 10)}`}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={cn(
                    "max-w-[80%] space-y-2",
                    message.role === "user" && "text-right"
                  )}
                >
                  <div
                    className={cn(
                      "inline-block rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                  </div>

                  {message.response && (
                    <div className="space-y-3">
                      {message.response.keyNumbers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.response.keyNumbers.map((num, i) => (
                            <Card key={i} className="inline-block">
                              <CardContent className="px-3 py-2">
                                <p className="text-xs text-muted-foreground">{num.label}</p>
                                <p className="font-bold tabular-nums">
                                  {num.value}
                                  {num.unit && <span className="text-xs font-normal"> {num.unit}</span>}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant={getConfidenceBadgeVariant(message.response.confidence)}
                              className="cursor-help"
                            >
                              {message.response.confidence} Confidence
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            <p className="text-xs">
                              {message.response.confidence === "High"
                                ? "Analysis backed by strong evidence and multiple data sources."
                                : message.response.confidence === "Medium"
                                ? "Based on available data with some assumptions."
                                : "Limited data available—take this as directional guidance only."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {message.response.evidence.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Evidence:</p>
                          <div className="space-y-1">
                            {message.response.evidence.slice(0, 3).map((ev, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                              >
                                <FileText className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span>{ev.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.response.limitations.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          <span>{message.response.limitations[0]}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-lg bg-muted px-4 py-2">
                  <p className="text-sm text-muted-foreground">Analyzing data...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this property or market..."
            className="min-h-[44px] resize-none"
            disabled={isLoading}
            data-testid="input-ai-chat"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px]"
            data-testid="button-send-ai-chat"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Responses are grounded in market data. Not financial advice.
        </p>
      </div>
    </div>
  );
}
