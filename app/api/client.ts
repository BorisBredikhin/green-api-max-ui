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

export const buildUrl = (
  methodPath: string,
  credentials: Pick<GreenApiCredentials, "idInstance" | "apiTokenInstance" | "baseUrl">
): string => {
  const { idInstance, apiTokenInstance, baseUrl } = credentials;
  const base = baseUrl.replace(/\/$/, "");
  const path = methodPath.replace(/^\//, "");
  return `${base}/waInstance${idInstance}/${path}/${apiTokenInstance}`;
};

export type RequestOptions = RequestInit & {
  credentials?: GreenApiCredentials;
};

import axios, { type AxiosRequestConfig } from "axios";

export const greenApiFetch = async <T = unknown>(
  methodPath: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { credentials, ...init } = options;

  if (!credentials) {
    throw new Error("greenApiFetch requires credentials");
  }

  const url = buildUrl(methodPath, credentials);
  const { signal, ...restInit } = init;
  const config: AxiosRequestConfig = {
    ...restInit,
    url,
    headers: {
      "Content-Type": "application/json",
      ...(restInit.headers as Record<string, string> || {}),
    },
  };
  if (signal) {
    config.signal = signal as unknown as AxiosRequestConfig["signal"];
  }

  const response = await axios.request<T>(config);

  const contentType = response.headers?.["content-type"] || response.headers?.["Content-Type"] || "";
  if (typeof contentType === "string" && contentType.includes("application/json")) {
    return response.data as T;
  }

  if (typeof response.data === "string") {
    return response.data as unknown as T;
  }

  return response.data as T;
};
