export class DedupGuard {
  private readonly lastSeenByCamera = new Map<string, number>();

  public constructor(private readonly windowMs: number) {
    if (!Number.isInteger(windowMs) || windowMs <= 0) {
      throw new Error("Dedup window must be a positive integer");
    }
  }

  public shouldProcess(cameraId: string, nowMs = Date.now()): boolean {
    const lastSeenMs = this.lastSeenByCamera.get(cameraId);

    if (lastSeenMs !== undefined && nowMs - lastSeenMs < this.windowMs) {
      return false;
    }

    this.lastSeenByCamera.set(cameraId, nowMs);
    return true;
  }
}
