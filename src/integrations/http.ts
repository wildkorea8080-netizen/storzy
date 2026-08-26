export class ProviderHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly responseBody: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(`${provider} request failed with HTTP ${status}`);
  }
}

export function parseRetryAfter(value:string|null,now=Date.now()):number|null{
  if(!value)return null;const seconds=Number(value.trim()),raw=Number.isFinite(seconds)&&seconds>=0?seconds*1000:Date.parse(value)-now;
  if(!Number.isFinite(raw)||raw<0)return null;return Math.min(24*60*60*1000,Math.max(1000,Math.ceil(raw)));
}

export async function parseJsonResponse<T>(provider: string, response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) throw new ProviderHttpError(provider, response.status, body,parseRetryAfter(response.headers.get("retry-after")));
  if (!body.trim()) return undefined as T;
  return JSON.parse(body) as T;
}
