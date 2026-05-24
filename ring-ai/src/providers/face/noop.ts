import type { FaceProvider, FaceResult } from "./interface";

export class NoopFaceProvider implements FaceProvider {
  public async recognize(_frames: readonly Buffer[]): Promise<readonly FaceResult[]> {
    return [];
  }
}
