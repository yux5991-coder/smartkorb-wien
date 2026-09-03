import { warn } from './log';

const USER_AGENT =
  'SmartKorbWien-DataPipeline/0.1 (grant prototype; contact: hello@smartkorb.example)';

export interface RequestOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Fetch with a timeout, a couple of retries and a descriptive user agent.
 *
 * Public sources such as the OpenStreetMap Overpass API ask for both a real
 * user agent and modest request rates — keep the retry count low and do not
 * parallelise beyond what the source documents.
 */
export const fetchText = async (url: string, options: RequestOptions = {}): Promise<string> => {
  const { headers = {}, method = 'GET', body, timeoutMs = 180_000, retries = 2 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}: ${await response.text()}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoff = 2000 * (attempt + 1);
        warn(`request failed (${String(error)}), retrying in ${backoff / 1000}s`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const fetchJson = async <T>(url: string, options: RequestOptions = {}): Promise<T> =>
  JSON.parse(await fetchText(url, options)) as T;
