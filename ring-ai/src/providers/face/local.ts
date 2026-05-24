import type { FaceProvider, FaceResult } from "./interface";

export class LocalFaceProvider implements FaceProvider {
  public constructor(
    private readonly sidecarUrl: string,
    private readonly concurrency: number,
  ) {}

  public async recognize(_frames: readonly Buffer[]): Promise<readonly FaceResult[]> {
    void this.sidecarUrl;
    void this.concurrency;
    throw new Error("LocalFaceProvider not implemented");
  }
}
