import type { CaptionProvider } from "./interface";

export class OpenAiCaptionProvider implements CaptionProvider {
  public constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  public async caption(_frames: readonly Buffer[]): Promise<string> {
    void this.apiKey;
    void this.model;
    throw new Error("OpenAiCaptionProvider not implemented");
  }
}
