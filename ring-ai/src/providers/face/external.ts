import type { FaceProvider, FaceResult } from "./interface";

export class ExternalFaceProvider implements FaceProvider {
  public constructor(private readonly apiKey: string) {}

  public async recognize(_frames: readonly Buffer[]): Promise<readonly FaceResult[]> {
    void this.apiKey;
    throw new Error("ExternalFaceProvider not implemented");
  }
}
