import axios, { type AxiosRequestConfig } from "axios";

export const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim();
  }
  return "https://3100.api.green-api.com";
};

export type GreenApiCredentials = {
  idInstance: string;
  apiTokenInstance: string;
  baseUrl: string;
};

export type GreenApiUrlOptions = {
  /**
   * Path segments that go *after* the token. DeleteNotification is the one
   * method that needs this: its `receiptId` trails the token, i.e.
   * `{baseUrl}/waInstance{id}/deleteNotification/{token}/{receiptId}`.
   */
  afterToken?: string;
};

/**
 * Method paths use the camelCase names from the MAX API docs and are placed
 * between the instance id and the token, e.g.
 * `{baseUrl}/waInstance{id}/checkAccount/{token}`.
 */
export const buildUrl = (
  methodPath: string,
  credentials: Pick<GreenApiCredentials, "idInstance" | "apiTokenInstance" | "baseUrl">,
  options: GreenApiUrlOptions = {}
): string => {
  const { idInstance, apiTokenInstance, baseUrl } = credentials;
  const base = baseUrl.replace(/\/$/, "");
  const path = methodPath.replace(/^\//, "");
  const suffix = options.afterToken
    ? `/${options.afterToken.replace(/^\//, "")}`
    : "";
  return `${base}/waInstance${idInstance}/${path}/${apiTokenInstance}${suffix}`;
};

/** Error bodies look like `{ statusCode, timestamp, path, message }` or `{ status, reason }`. */
type GreenApiErrorBody = {
  message?: unknown;
  reason?: unknown;
};

const readBodyText = (body: unknown): string | undefined => {
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof body !== "object" || body === null) return undefined;

  const { message, reason } = body as GreenApiErrorBody;
  for (const candidate of [message, reason]) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return undefined;
};

/**
 * Thrown for any non-2xx response. `status` is the HTTP status so callers can
 * branch on documented codes — e.g. CheckAccount returns 469 when the MAX
 * account-lookup quota is exhausted.
 */
export class GreenApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GreenApiError";
    this.status = status;
  }
}

export type GreenApiRequestConfig = Omit<AxiosRequestConfig, "url" | "baseURL"> & {
  credentials: GreenApiCredentials;
  /** See {@link GreenApiUrlOptions.afterToken}. Not an axios option. */
  afterToken?: string;
};

export const greenApiRequest = async <T>(
  methodPath: string,
  config: GreenApiRequestConfig
): Promise<T> => {
  const { credentials, headers, afterToken, ...rest } = config;

  try {
    const response = await axios.request<T>({
      ...rest,
      url: buildUrl(methodPath, credentials, { afterToken }),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = readBodyText(error.response?.data);
      throw new GreenApiError(
        detail ?? error.message ?? "Запрос к GREEN API не выполнен",
        status
      );
    }
    throw error;
  }
};