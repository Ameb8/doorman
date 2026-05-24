import type { EventRecord } from "./db";

export interface WebhookPayload {
  readonly version: "1";
  readonly event: EventRecord;
}

export async function notifyTargets(
  _targets: readonly string[],
  _payload: WebhookPayload,
  _secret?: string,
): Promise<void> {
  return;
}
