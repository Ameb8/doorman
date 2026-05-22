# AGENTS.md

Instructions for LLM coding agents working on this repository.

## Source of Truth

- Treat `design.md` as the current product and architecture reference unless code already implements a newer, internally consistent behavior.
- If implementation and `design.md` conflict, prefer the behavior that preserves the documented constraints: single-process Node.js, low latency, provider-swappable AI, easy self-hosting, and webhook-only output.
- Do not introduce a dashboard, queue service, broker, Redis, BullMQ, or multi-service orchestration beyond the optional local face-recognition sidecar unless explicitly requested.
- Keep changes scoped. This project is designed for home self-hosting on constrained hardware.

## Project Intent

Doorman is a self-hosted virtual doorman for Ring camera events. It listens for motion, extracts keyframes, performs face recognition and scene captioning, stores structured results, and posts webhook payloads to external systems such as Home Assistant.

Primary goals:

- Low event-to-webhook latency.
- Minimal operational burden: `docker compose up` should be enough for normal use.
- Provider flexibility through environment variables, not code edits.
- Raspberry Pi 4 compatibility as the baseline hardware target.

## Expected Architecture

The main application is a Node.js TypeScript service.

Expected modules:

- `src/index.ts`: startup, config load, Ring client initialization, event subscription, health endpoint.
- `src/config.ts`: environment parsing and validation; fail fast on invalid configuration.
- `src/ingest.ts`: Ring media retrieval and FFmpeg keyframe extraction.
- `src/dedup.ts`: in-memory per-camera deduplication window.
- `src/db.ts`: SQLite schema, migrations, inserts, and query helpers using `better-sqlite3`.
- `src/notifier.ts`: webhook dispatch, optional HMAC signing, one retry for 5xx responses.
- `src/health.ts`: minimal HTTP health endpoint on port 3000.
- `src/providers/face/`: face provider interface and implementations.
- `src/providers/caption/`: caption provider interface and implementations.
- `sidecar/`: optional Python HTTP service for local face recognition only.

If the repository has not yet been scaffolded, create this structure rather than inventing a different layout.

## Event Handling Rules

- Ring motion subscribers must not await the full event pipeline.
- Use fire-and-log behavior from subscription callbacks:

```ts
camera.onMotion.subscribe((motion) => {
  handleMotionEvent(motion).catch((err) => logger.error(err));
});
```

- The event pipeline should deduplicate before expensive work.
- Extract exactly three JPEG keyframes by default.
- Run independent inference tasks in parallel with `Promise.all`.
- Persist the merged event result before webhook dispatch.
- Webhook failures should be logged and should not crash the process.

Target flow:

1. Receive Ring motion event.
2. Drop duplicate camera events inside `DEDUP_WINDOW_MS`.
3. Download media and extract keyframes with FFmpeg.
4. Run face recognition and scene captioning concurrently.
5. Save event metadata, faces, caption, and raw Ring payload to SQLite.
6. POST the versioned payload to configured webhook targets.

## Provider Rules

- Providers must be selected through configuration, not hardcoded.
- Keep provider contracts small and stable.
- Face recognition consumes one frame by default.
- Captioning consumes all extracted frames by default.
- New AI capabilities should follow the same pattern:
  - define an interface under `src/providers/<task>/interface.ts`;
  - implement providers under `src/providers/<task>/`;
  - select implementation in `config.ts`;
  - add the task to `handleMotionEvent` with `Promise.all` when independent.

Expected face interface:

```ts
interface FaceProvider {
  recognize(frame: Buffer): Promise<FaceResult[]>;
}

interface FaceResult {
  name: string;
  confidence: number;
  bbox: [number, number, number, number];
}
```

Expected caption interface:

```ts
interface CaptionProvider {
  describe(frames: Buffer[]): Promise<string>;
}
```

## Local Face Sidecar Rules

- The Python sidecar exists only for `FACE_PROVIDER=local`.
- The Node service should interact with the sidecar through HTTP and should not know the model implementation.
- Sidecar endpoint:

```http
POST /recognize
Content-Type: image/jpeg
```

- Sidecar response is a JSON array of face results.
- Known faces are loaded from a mounted `/faces` directory at startup.
- Do not require retraining to add faces; users should add JPEGs and restart the sidecar.
- Rate-limit local sidecar calls in the Node client with `p-queue`.
- Default local face concurrency is `2` for Raspberry Pi 4 compatibility.

## Storage Rules

- Use SQLite through `better-sqlite3`.
- Store raw event metadata and inference results.
- Do not persist raw frames by default.
- Optional frame persistence must be controlled by `STORE_FRAMES=true`.
- If frame persistence is enabled, write JPEG files to `FRAMES_DIR` and store paths, not blobs, in SQLite.

Expected event fields:

- UUID event ID.
- Ring camera ID and camera name.
- occurrence timestamp in Unix milliseconds.
- faces JSON.
- caption.
- raw Ring payload JSON.
- creation timestamp.

## Webhook Rules

- Webhook output is the only supported integration surface.
- Payloads must be stable and versioned.
- Include booleans for `known_faces_present` and `unknown_faces_present`.
- Support comma-separated `WEBHOOK_TARGETS`.
- If `WEBHOOK_SECRET` is set, sign requests with HMAC-SHA256 in `X-Ring-Signature`.
- Retry once after a short delay on 5xx responses only.
- Log failures and continue.

## Configuration Rules

- All runtime configuration should come from environment variables.
- Validate configuration on startup and fail fast with actionable errors.
- Keep `.env.example` aligned with `config.ts`.
- Do not require users to edit source code to switch AI providers.

Important variables from the design:

- `RING_EMAIL`
- `RING_PASSWORD`
- `RING_2FA_CODE`
- `FACE_PROVIDER`
- `FACE_API_KEY`
- `FACE_SIDECAR_URL`
- `FACE_CONCURRENCY`
- `CAPTION_PROVIDER`
- `CAPTION_API_KEY`
- `CAPTION_MODEL`
- `WEBHOOK_TARGETS`
- `WEBHOOK_SECRET`
- `DEDUP_WINDOW_MS`
- `STORE_FRAMES`
- `FRAMES_DIR`
- `DB_PATH`
- `LOG_LEVEL`

## Docker and Runtime Rules

- The primary service should run on Node 20.
- Docker images must support `linux/arm64` and `linux/amd64`.
- Keep Docker Compose simple.
- The face sidecar should be behind a Compose profile such as `local-face`.
- The main service should expose port 3000 only for health checks.
- Persist SQLite data under `/data`.
- Mount `/frames` only for optional keyframe storage.
- Mount `/faces` read-only into the sidecar.

## Performance Constraints

- Optimize for latency over throughput.
- Avoid queue infrastructure; in-process concurrency limits are acceptable where needed.
- Do not serialize independent AI calls.
- Avoid memory-heavy dependencies unless necessary.
- Keep Raspberry Pi 4 as the minimum viable hardware.
- Prefer streaming or buffer-based media handling over unnecessary disk writes.

## Coding Standards

- Use TypeScript for the Node service.
- Use typed interfaces at provider boundaries.
- Keep modules small and purpose-specific.
- Prefer explicit error handling around network, Ring API, FFmpeg, database, and webhook operations.
- Keep log messages useful for unattended home-server operation.
- Do not log secrets, API keys, passwords, HMAC secrets, raw images, or full webhook URLs containing tokens.
- Use structured JSON parsing/serialization instead of ad hoc string manipulation.
- Keep public payload field names stable unless bumping the payload `version`.

## Testing Expectations

When code exists, add or update focused tests for:

- config validation and provider selection;
- deduplication window behavior;
- webhook payload generation and HMAC signing;
- notifier retry behavior;
- provider adapters with mocked HTTP calls;
- database migration and insert behavior.

Do not require live Ring, OpenAI, Gemini, or face-recognition services in unit tests. Use mocks or local fixtures.

## Documentation Expectations

- Keep `README.md` user-facing and operational.
- Keep `design.md` architecture-facing.
- Keep this file agent-facing.
- Update `.env.example` when adding or changing configuration.
- Update Docker Compose examples when changing runtime services, mounts, or ports.

## Avoid

- Awaiting long-running event handling inside Ring subscription callbacks.
- Storing raw keyframes unless explicitly enabled.
- Hardcoding provider names, API keys, model IDs, or webhook URLs.
- Making provider implementations leak into core event orchestration.
- Expanding the sidecar beyond local face recognition without explicit direction.
