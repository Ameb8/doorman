export interface CaptionProvider {
  caption(frames: readonly Buffer[]): Promise<string>;
}
