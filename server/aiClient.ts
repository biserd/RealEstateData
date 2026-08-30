export const WORKERS_AI_MODEL = "@cf/zai-org/glm-5.3-flash" as const;

export type WorkersAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface WorkersAICompletionOptions {
  messages: WorkersAIMessage[];
  maxCompletionTokens: number;
  json?: boolean;
}

export interface WorkersAICompletion {
  content: string;
  finishReason: string | null;
  model: string;
}

let aiBinding: Ai | null = null;

/** Configure the native Workers AI binding once during Worker startup. */
export function configureWorkersAI(binding: Ai): void {
  aiBinding = binding;
}

export function isWorkersAIConfigured(): boolean {
  return aiBinding !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function normalizeCompletion(result: unknown): WorkersAICompletion {
  const body = asRecord(result);
  const choices = Array.isArray(body?.choices) ? body.choices : [];
  const choice = asRecord(choices[0]);
  const message = asRecord(choice?.message);
  const content = typeof message?.content === "string"
    ? message.content.trim()
    : typeof body?.response === "string"
      ? body.response.trim()
      : "";

  if (!content) {
    throw new Error("Workers AI returned an empty completion");
  }

  return {
    content,
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    model: typeof body?.model === "string" ? body.model : WORKERS_AI_MODEL,
  };
}

/**
 * Run the project's single approved model through the in-process Workers AI
 * binding. Low reasoning effort keeps routine real-estate analysis responsive
 * and limits generated reasoning tokens.
 */
export async function completeWithWorkersAI(
  options: WorkersAICompletionOptions,
): Promise<WorkersAICompletion> {
  if (!aiBinding) {
    throw new Error(
      "Workers AI is not configured. Run the application with Wrangler so the AI binding is available.",
    );
  }

  const result: unknown = await aiBinding.run(WORKERS_AI_MODEL, {
    messages: options.messages,
    max_completion_tokens: options.maxCompletionTokens,
    reasoning_effort: "low",
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
  });

  return normalizeCompletion(result);
}
