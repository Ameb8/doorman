import type { CaptionProvider } from "./interface";

export class GeminiCaptionProvider implements CaptionProvider {
  public constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  public async caption(_frames: readonly Buffer[]): Promise<string> {
    void this.apiKey;
    void this.model;
    throw new Error("GeminiCaptionProvider not implemented");
  }
}
