export interface FaceResult {
  readonly label: string;
  readonly confidence: number;
  readonly box?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface FaceProvider {
  recognize(frames: readonly Buffer[]): Promise<readonly FaceResult[]>;
}
