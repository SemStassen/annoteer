import { operation } from "./errors";

export const adminRequest = <T>(
  endpoint: string,
  adminToken: string,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) =>
  operation(async () => {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `API returned ${response.status}`);
    return data;
  });
