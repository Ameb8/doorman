import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RingApi as RingApiInstance } from "ring-client-api";

interface SmokeConfig {
  ringEmail: string | undefined;
  ringPassword: string | undefined;
  ring2faCode: string | undefined;
  ringTokenPath: string;
  debugNotifications: boolean;
}

interface TokenFile {
  refreshToken: string;
  savedAt: number;
}

type RingClientApiModule = typeof import("ring-client-api");
type RingApiExport = RingClientApiModule["RingApi"];
type SmokeRingAuth =
  | {
      refreshToken: string;
    }
  | {
      email: string;
      password: string;
    };

interface SmokeRingApiConstructor {
  new (options: SmokeRingAuth): RingApiInstance;
}

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<RingClientApiModule>;

async function main(): Promise<void> {
  const config = loadSmokeConfig();
  const { RingApi } = await dynamicImport("ring-client-api");
  const ringApi = await buildRingApi(toSmokeRingApiConstructor(RingApi), config);

  const cameras = await ringApi.getCameras();

  if (cameras.length === 0) {
    throw new Error("Ring auth succeeded, but no cameras were returned for this account.");
  }

  for (const camera of cameras) {
    camera.onMotionStarted.subscribe(() => {
      console.log("ring motion started", {
        cameraId: camera.id,
        cameraName: camera.name,
        at: new Date().toISOString(),
      });
    });

    camera.onNewNotification.subscribe((notification) => {
      const summary = {
        cameraId: camera.id,
        cameraName: camera.name,
        category: notification.android_config.category,
        subtype: notification.data.event.ding.subtype,
        eventCreatedAt: notification.data.event.ding.created_at,
        at: new Date().toISOString(),
      };

      if (config.debugNotifications) {
        console.log("ring notification", summary, notification);
        return;
      }

      console.log("ring notification", summary);
    });

    console.log("subscribed to camera", {
      cameraId: camera.id,
      cameraName: camera.name,
    });
  }

  console.log("ring listen smoke ready", {
    cameraCount: cameras.length,
    tokenPath: config.ringTokenPath,
  });

  await waitForShutdown(ringApi);
}

async function buildRingApi(
  RingApi: SmokeRingApiConstructor,
  config: SmokeConfig,
): Promise<RingApiInstance> {
  const storedToken = await readStoredRefreshToken(config.ringTokenPath);

  if (storedToken !== undefined) {
    try {
      const ringApi = new RingApi({ refreshToken: storedToken });
      registerTokenPersistence(ringApi, config.ringTokenPath);
      await ringApi.getCameras();
      console.log("authenticated with stored Ring refresh token");
      return ringApi;
    } catch (error: unknown) {
      console.warn("Stored Ring token invalid or expired, falling back to credentials", {
        error: errorMessage(error),
      });
    }
  }

  if (config.ringEmail === undefined || config.ringPassword === undefined) {
    throw new Error(
      "No valid Ring refresh token found. Set RING_EMAIL and RING_PASSWORD for first-run auth.",
    );
  }

  const ringApi = new RingApi({
    email: config.ringEmail,
    password: config.ringPassword,
  });
  registerTokenPersistence(ringApi, config.ringTokenPath);

  try {
    await ringApi.restClient.getAuth(config.ring2faCode);
  } catch (error: unknown) {
    if (isTwoFactorError(error)) {
      throw new Error(
        "Ring 2FA required. Set RING_2FA_CODE, restart once, then remove it after the token is saved.",
      );
    }

    throw error;
  }

  const refreshToken = ringApi.restClient.refreshToken;

  if (refreshToken === undefined) {
    throw new Error("Ring authentication succeeded, but no refresh token was returned.");
  }

  await persistRefreshToken(config.ringTokenPath, refreshToken);
  await ringApi.getCameras();
  console.log("authenticated with Ring email/password and persisted refresh token");
  return ringApi;
}

function registerTokenPersistence(ringApi: RingApiInstance, tokenPath: string): void {
  ringApi.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
    persistRefreshToken(tokenPath, newRefreshToken)
      .then(() => {
        console.log("Ring refresh token updated and persisted");
      })
      .catch((error: unknown) => {
        console.error("Failed to persist Ring refresh token", {
          error: errorMessage(error),
        });
      });
  });
}

function toSmokeRingApiConstructor(RingApi: RingApiExport): SmokeRingApiConstructor {
  return RingApi as unknown as SmokeRingApiConstructor;
}

async function readStoredRefreshToken(tokenPath: string): Promise<string | undefined> {
  let rawToken: string;

  try {
    rawToken = await readFile(tokenPath, "utf8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const parsedToken = parseTokenFile(rawToken);
  return parsedToken.refreshToken;
}

async function persistRefreshToken(tokenPath: string, refreshToken: string): Promise<void> {
  const payload: TokenFile = {
    refreshToken,
    savedAt: Date.now(),
  };

  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function parseTokenFile(rawToken: string): TokenFile {
  const parsed: unknown = JSON.parse(rawToken);

  if (!isRecord(parsed)) {
    throw new Error("Ring token file must contain a JSON object.");
  }

  const { refreshToken, savedAt } = parsed;

  if (typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
    throw new Error("Ring token file is missing refreshToken.");
  }

  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) {
    throw new Error("Ring token file is missing numeric savedAt.");
  }

  return {
    refreshToken,
    savedAt,
  };
}

function loadSmokeConfig(): SmokeConfig {
  return {
    ringEmail: optionalEnv("RING_EMAIL"),
    ringPassword: optionalEnv("RING_PASSWORD"),
    ring2faCode: optionalEnv("RING_2FA_CODE"),
    ringTokenPath: optionalEnv("RING_TOKEN_PATH") ?? "./data/ring-token.json",
    debugNotifications: optionalEnv("RING_DEBUG_NOTIFICATIONS") === "true",
  };
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function isTwoFactorError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("2fa") || message.includes("two-factor");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function waitForShutdown(ringApi: RingApiInstance): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      ringApi.disconnect();
      resolve();
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

void main().catch((error: unknown) => {
  console.error("Fatal listen smoke error", errorMessage(error));
  process.exitCode = 1;
});
