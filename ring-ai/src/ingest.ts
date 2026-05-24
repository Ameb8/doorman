import type { RingCamera } from "ring-client-api";

export interface MotionEventLike {
  readonly id?: string;
}

export async function extractFrames(
  _camera: RingCamera,
  _event: MotionEventLike,
): Promise<Buffer[]> {
  throw new Error("extractFrames not implemented");
}
