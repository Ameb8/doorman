import type { FaceResult } from "./providers/face/interface";

export interface EventRecord {
  readonly id: string;
  readonly cameraId: string;
  readonly cameraName: string;
  readonly motionId: string | undefined;
  readonly startedAt: string;
  readonly faces: readonly FaceResult[];
  readonly caption: string | undefined;
  readonly framePaths: readonly string[];
  readonly rawEvent: unknown;
}

export function init(_dbPath: string): void {
  return;
}

export function saveEvent(record: EventRecord): EventRecord {
  return record;
}
