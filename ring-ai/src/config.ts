export type FaceProviderName = "local" | "external" | "none";
export type CaptionProviderName = "openai" | "gemini";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  // Ring auth
  ringEmail: string | undefined;
  ringPassword: string | undefined;
  ring2faCode: string | undefined;
  ringTokenPath: string;

  // Providers
  faceProvider: FaceProviderName;
  faceApiKey: string | undefined;
  faceSidecarUrl: string;
  faceConcurrency: number;

  captionProvider: CaptionProviderName;
  captionApiKey: string;
  captionModel: string;

  // Webhooks
  webhookTargets: string[];
  webhookSecret: string | undefined;

  // Pipeline
  dedupWindowMs: number;
  storeFrames: boolean;
  framesDir: string | undefined;

  // Storage
  dbPath: string;

  // Observability
  logLevel: LogLevel;
}

const faceProviders = ["local", "external", "none"] as const;
const captionProviders = ["openai", "gemini"] as const;
const logLevels = ["debug", "info", "warn", "error"] as const;

export function loadConfig(): Config {
  const errors: string[] = [];

  const ringEmail = optionalString("RING_EMAIL");
  const ringPassword = optionalString("RING_PASSWORD");
  const ring2faCode = optionalString("RING_2FA_CODE");
  const ringTokenPath = optionalString("RING_TOKEN_PATH") ?? "/data/ring-token.json";

  const faceProvider = parseEnum("FACE_PROVIDER", faceProviders, "none", errors);
  const faceApiKey = optionalString("FACE_API_KEY");
  const faceSidecarUrl = optionalString("FACE_SIDECAR_URL") ?? "http://face-sidecar:5000";
  const faceConcurrency = parsePositiveInteger("FACE_CONCURRENCY", 2, errors);

  const captionProvider = parseEnum("CAPTION_PROVIDER", captionProviders, undefined, errors);
  const captionApiKey = requiredString("CAPTION_API_KEY", errors);
  const configuredCaptionModel = optionalString("CAPTION_MODEL");

  const webhookTargets = parseWebhookTargets(errors);
  const webhookSecret = optionalString("WEBHOOK_SECRET");

  const dedupWindowMs = parsePositiveInteger("DEDUP_WINDOW_MS", 30_000, errors);
  const storeFrames = parseBoolean("STORE_FRAMES", false, errors);
  const framesDir = optionalString("FRAMES_DIR");

  const dbPath = optionalString("DB_PATH") ?? "/data/ring-ai.db";
  const logLevel = parseEnum("LOG_LEVEL", logLevels, "info", errors);

  if (faceProvider === "external" && faceApiKey === undefined) {
    errors.push("FACE_API_KEY is required when FACE_PROVIDER=external");
  }

  if (storeFrames && framesDir === undefined) {
    errors.push("FRAMES_DIR is required when STORE_FRAMES=true");
  }

  if (errors.length > 0) {
    failConfig(errors);
  }

  if (
    faceProvider === undefined ||
    captionProvider === undefined ||
    captionApiKey === undefined ||
    logLevel === undefined
  ) {
    failConfig(["Internal configuration validation failed"]);
  }

  return {
    ringEmail,
    ringPassword,
    ring2faCode,
    ringTokenPath,
    faceProvider,
    faceApiKey,
    faceSidecarUrl,
    faceConcurrency,
    captionProvider,
    captionApiKey,
    captionModel: configuredCaptionModel ?? defaultCaptionModel(captionProvider),
    webhookTargets,
    webhookSecret,
    dedupWindowMs,
    storeFrames,
    framesDir,
    dbPath,
    logLevel,
  };
}

function optionalString(name: string): string | undefined {
  const value = process.env[name];

  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredString(name: string, errors: string[]): string | undefined {
  const value = optionalString(name);

  if (value === undefined) {
    errors.push(`${name} is required`);
  }

  return value;
}

function parseEnum<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T | undefined,
  errors: string[],
): T | undefined {
  const value = optionalString(name);

  if (value === undefined) {
    if (fallback === undefined) {
      errors.push(`${name} is required and must be one of: ${allowed.join(", ")}`);
    }

    return fallback;
  }

  if (isAllowedValue(value, allowed)) {
    return value;
  }

  errors.push(`${name} must be one of: ${allowed.join(", ")}; received "${value}"`);
  return fallback;
}

function parsePositiveInteger(name: string, fallback: number, errors: string[]): number {
  const value = optionalString(name);

  if (value === undefined) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    errors.push(`${name} must be a positive base-10 integer; received "${value}"`);
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    errors.push(`${name} must be a positive base-10 integer; received "${value}"`);
    return fallback;
  }

  return parsed;
}

function parseBoolean(name: string, fallback: boolean, errors: string[]): boolean {
  const value = optionalString(name);

  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  errors.push(`${name} must be "true", "false", or empty; received "${value}"`);
  return fallback;
}

function parseWebhookTargets(errors: string[]): string[] {
  const rawValue = optionalString("WEBHOOK_TARGETS");
  const targets = rawValue?.split(",").map((target) => target.trim()).filter(Boolean) ?? [];

  if (targets.length === 0) {
    errors.push("WEBHOOK_TARGETS must contain at least one non-empty target");
  }

  return targets;
}

function defaultCaptionModel(provider: CaptionProviderName): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "gemini":
      return "gemini-1.5-flash";
  }
}

function isAllowedValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function failConfig(errors: string[]): never {
  for (const error of errors) {
    console.error(`[config] ${error}`);
  }

  process.exit(1);
}
