import { retryDelayMs, shouldRetryProvider } from "@/lib/odds/marketSafety";

type FetchLike = typeof fetch;

export type ProviderQuota = {
  remainingCredits?: number;
  usedCredits?: number;
  lastRequestCost?: number;
};

export type ProviderRequestResult<T> = {
  data?: T;
  quota: ProviderQuota;
  status?: number;
  error?: string;
  exhausted?: boolean;
  rateLimited?: boolean;
};

export type ProviderRequestOptions = {
  timeoutMs: number;
  maxRetries: number;
  fetcher?: FetchLike;
};

function numberHeader(headers: Headers, name: string) {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value : undefined;
}

function quotaFromHeaders(headers: Headers): ProviderQuota {
  return {
    remainingCredits: numberHeader(headers, "x-requests-remaining"),
    usedCredits: numberHeader(headers, "x-requests-used"),
    lastRequestCost: numberHeader(headers, "x-requests-last"),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestProviderJson<T>(url: string, options: ProviderRequestOptions): Promise<ProviderRequestResult<T>> {
  const fetcher = options.fetcher ?? fetch;
  let last: ProviderRequestResult<T> = { quota: {}, error: "Provider request did not run" };

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetcher(url, { cache: "no-store", signal: controller.signal });
      const quota = quotaFromHeaders(response.headers);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const exhausted = response.status === 401 && /OUT_OF_USAGE_CREDITS/i.test(body);
        last = { quota, status: response.status, exhausted, rateLimited: response.status === 429, error: `Provider request failed: ${response.status}${body ? ` ${body.slice(0, 180)}` : ""}` };
        if (shouldRetryProvider(response.status, attempt, options.maxRetries) && !exhausted) {
          await sleep(retryDelayMs(attempt, Number(response.headers.get("retry-after"))));
          continue;
        }
        return last;
      }
      try {
        return { data: await response.json() as T, quota, status: response.status };
      } catch {
        return { quota, status: response.status, error: "Provider returned invalid JSON" };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      last = { quota: {}, error: timedOut ? "Provider request timed out" : error instanceof Error ? error.message : "Provider request failed" };
      if (attempt < options.maxRetries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      return last;
    } finally {
      clearTimeout(timeout);
    }
  }
  return last;
}
