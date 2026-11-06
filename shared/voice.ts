// Ephemeral, room-scoped audio. Never include these messages in a Yjs update.
export const VOICE_VERSION = 1;
export const VOICE_RATE = 16000;
export const VOICE_SAMPLES = 1600; // 100 ms of mono PCM16, little endian.
export const VOICE_MAX_TURN_MS = 30000;
export const VOICE_LEASE_MS = 2000;
export type VoicePeer = { id: string; name: string };
export type VoiceFloor = { peer: string; turn: string; started: number };
export type VoiceMessage =
  | { type: "voice:state"; peers: VoicePeer[]; floor: VoiceFloor | null }
  | { type: "voice:audio"; peer: string; turn: string; data: string }
  | { type: "voice:error"; message: string };
export type VoiceCommand =
  | { type: "voice:join"; name: string }
  | { type: "voice:leave" }
  | { type: "voice:take"; turn: string }
  | { type: "voice:stop"; turn: string }
  | { type: "voice:audio"; turn: string; data: string };
export const validTurn = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
export function validVoiceData(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === 4268 &&
    /^[A-Za-z0-9+/]{4267}=$/.test(value)
  );
}
