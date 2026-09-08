export const GEMINI_FALLBACK_CHAT_MODELS = [
  process.env.GEMINI_CHAT_MODEL || "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

export const GEMINI_CHAT_MODEL = GEMINI_FALLBACK_CHAT_MODELS[0];
export const GEMINI_EMBED_MODEL = "gemini-embedding-001";

/**
 * Checks if an error is a transient Google Gemini error
 * (503 Service Unavailable, 429 Quota Exceeded / Rate Limit, 500 Internal, 404 Deprecated, or network timeout).
 */
export function isTransientGeminiError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: number })?.status;
  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 404 ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("quota") ||
    msg.includes("resource has been exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  );
}

/**
 * Wraps a promise with a timeout to prevent hanging on congested API calls.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 10000,
  label = "Gemini operation"
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Executes an operation with automatic failover across models (e.g. 3.7-flash -> 3.5-flash-lite).
 * If the primary model fails with a transient error (e.g. 503 high demand or 429 quota),
 * it seamlessly attempts the next model in the fallback list.
 */
export async function executeWithModelFallback<T>(
  fn: (modelName: string) => Promise<T>,
  options?: {
    timeoutMs?: number;
    models?: string[];
  }
): Promise<{ result: T; modelUsed: string; fallbackOccurred: boolean }> {
  const models = options?.models ?? GEMINI_FALLBACK_CHAT_MODELS;
  const timeoutMs = options?.timeoutMs ?? 10000;
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      const result = await withTimeout(
        fn(modelName),
        timeoutMs,
        `Gemini API (${modelName})`
      );
      return {
        result,
        modelUsed: modelName,
        fallbackOccurred: i > 0,
      };
    } catch (err) {
      lastError = err;
      const isTransient = isTransientGeminiError(err);
      console.warn(
        `Gemini model "${modelName}" failed (${isTransient ? "transient / high demand" : "error"}):`,
        err instanceof Error ? err.message : err
      );

      // If there are more models in the fallback chain, continue
      if (i < models.length - 1) {
        continue;
      }
    }
  }

  throw lastError;
}
