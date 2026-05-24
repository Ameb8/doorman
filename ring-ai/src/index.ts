import { loadConfig } from "./config";
import { DedupGuard } from "./dedup";
import * as db from "./db";
import { startHealthServer } from "./health";
import { extractFrames } from "./ingest";
import { notifyTargets } from "./notifier";
import { GeminiCaptionProvider } from "./providers/caption/gemini";
import { OpenAiCaptionProvider } from "./providers/caption/openai";
import { ExternalFaceProvider } from "./providers/face/external";
import { LocalFaceProvider } from "./providers/face/local";
import { NoopFaceProvider } from "./providers/face/noop";

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  void config;
  void DedupGuard;
  void db;
  void startHealthServer;
  void extractFrames;
  void notifyTargets;
  void GeminiCaptionProvider;
  void OpenAiCaptionProvider;
  void ExternalFaceProvider;
  void LocalFaceProvider;
  void NoopFaceProvider;

  console.log("ring-ai skeleton ready");
}

void bootstrap().catch((error: unknown) => {
  console.error("Fatal startup error", error);
  process.exitCode = 1;
});
