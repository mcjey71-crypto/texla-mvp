import type { SharedSession } from "./SharedSession";
import { fromBase64, toBase64 } from "../shared/collaboration";
import {
  VOICE_MAX_TURN_MS,
  validVoiceData,
  type VoiceMessage,
  type VoicePeer,
  type VoiceFloor,
} from "../shared/voice";
export class WalkieSession {
  active = false;
  busy = false;
  sending = false;
  pending = false;
  muted = false;
  error = "";
  notice = "";
  peers: VoicePeer[] = [];
  floor: VoiceFloor | null = null;
  private listeners = new Set<() => void>();
  private audio?: AudioContext;
  private stream?: MediaStream;
  private processor?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private output?: GainNode;
  private wanted = false;
  private turn = "";
  private receivedTurn = "";
  private generation = 0;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private joinTimer?: ReturnType<typeof setTimeout>;
  private monitor?: ReturnType<typeof setInterval>;
  private lastReceived = 0;
  private lastSent = 0;
  private unsubscribe: () => void;
  private unsubscribeVoice: () => void;
  constructor(readonly session: SharedSession) {
    this.unsubscribeVoice = session.subscribeVoice(this.message);
    this.unsubscribe = session.subscribe(() => {
      if ((this.active || this.busy) && !session.voiceConnected) {
        this.leave();
        this.error =
          "Se cortó la conexión. Activa el walkie-talkie de nuevo al reconectar.";
        this.emit();
      }
    });
    window.addEventListener("blur", this.release);
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.visibility);
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit = () => {
    for (const listener of this.listeners) listener();
  };
  private visibility = () => {
    if (document.visibilityState === "hidden") this.release();
  };
  private onPageHide = () => this.leave();
  async join() {
    if (this.busy || this.active || this.destroyed) return;
    this.error = "";
    this.notice = "";
    if (!this.session.voiceConnected || !this.session.voiceAvailable) {
      this.error =
        "El servidor de este documento necesita la actualización de audio.";
      this.emit();
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.AudioContext ||
      !window.AudioWorkletNode
    ) {
      this.error =
        "Este navegador no admite el audio de Texla. Usa una versión reciente de Chrome, Edge, Firefox o Safari en HTTPS.";
      this.emit();
      return;
    }
    const generation = ++this.generation;
    this.busy = true;
    this.emit();
    try {
      const audio = new AudioContext({ latencyHint: "interactive" });
      this.audio = audio;
      // Resume in the click gesture, before a microphone permission prompt can consume it.
      await audio.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.destroyed || generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        track.onended = () => {
          this.leave();
          this.error =
            "El micrófono se desconectó. Comprueba el dispositivo y vuelve a activar el walkie-talkie.";
          this.emit();
        };
      });
      await audio.audioWorklet.addModule(
        new URL("./audio/voice-processor.js?no-inline", import.meta.url).href,
      );
      if (this.destroyed || generation !== this.generation) return;
      const processor = new AudioWorkletNode(audio, "texla-voice", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.processor = processor;
      this.output = audio.createGain();
      this.output.gain.value = this.muted ? 0 : 1;
      processor.connect(this.output).connect(audio.destination);
      this.source = audio.createMediaStreamSource(stream);
      this.source.connect(processor);
      processor.port.onmessage = ({ data }) => {
        if (
          data.type !== "samples" ||
          !this.wanted ||
          !this.sending ||
          !this.turn
        )
          return;
        // Samples are little-endian PCM16 on supported browser platforms.
        if (
          !this.session.sendVoice({
            type: "voice:audio",
            turn: this.turn,
            data: toBase64(new Uint8Array(data.samples)),
          })
        ) {
          this.release();
          this.error =
            "La conexión de audio está saturada. Suelta el botón y vuelve a intentarlo.";
          this.emit();
        } else this.lastSent = Date.now();
      };
      processor.onprocessorerror = () => {
        this.leave();
        this.error =
          "El navegador interrumpió el audio. Vuelve a activar el walkie-talkie.";
        this.emit();
      };
      audio.onstatechange = () => {
        if (this.active && audio.state !== "running") {
          this.release();
          this.error =
            "El audio está pausado por el navegador. Desactiva y vuelve a activar el walkie-talkie.";
          this.emit();
        }
      };
      this.active = true;
      const name =
        this.session.awareness.getLocalState()?.user?.name || "Invitado";
      if (!this.session.sendVoice({ type: "voice:join", name }))
        throw new Error("No hay conexión con el canal de audio.");
      this.joinTimer = setTimeout(() => {
        if (!this.peers.some((peer) => peer.id === this.session.voicePeer)) {
          this.leave();
          this.error =
            "El servidor no respondió al canal de audio. Vuelve a intentarlo.";
          this.emit();
        }
      }, 5000);
      this.monitor = setInterval(() => {
        if (this.sending && Date.now() - this.lastSent > 1500) {
          this.release();
          this.error =
            "Se interrumpió el micrófono. Vuelve a pulsar para hablar.";
          this.emit();
        }
        if (
          this.floor &&
          Date.now() - this.lastReceived > 3000 &&
          this.floor.peer !== this.session.voicePeer
        ) {
          this.floor = null;
          this.processor?.port.postMessage({ type: "clear" });
          this.emit();
        }
      }, 500);
    } catch (error) {
      if (generation !== this.generation || this.destroyed) return;
      this.leave();
      const name = error instanceof DOMException ? error.name : "";
      this.error =
        name === "NotAllowedError"
          ? "Permite el micrófono en los ajustes del navegador y vuelve a activar el walkie-talkie."
          : name === "NotFoundError"
            ? "No se encontró un micrófono. Conecta uno y vuelve a intentarlo."
            : error instanceof Error
              ? error.message
              : "No se pudo activar el audio.";
    } finally {
      if (generation === this.generation) this.busy = false;
      this.emit();
    }
  }
  press = () => {
    if (
      !this.active ||
      this.busy ||
      this.wanted ||
      !this.session.voiceConnected ||
      this.audio?.state !== "running" ||
      (this.floor && this.floor.peer !== this.session.voicePeer)
    )
      return;
    this.error = "";
    this.notice = "";
    this.wanted = true;
    this.pending = true;
    this.turn = crypto.randomUUID();
    if (!this.session.sendVoice({ type: "voice:take", turn: this.turn })) {
      this.release();
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.release();
      this.error = "No se pudo obtener el turno. Vuelve a pulsar para hablar.";
      this.emit();
    }, 3000);
    this.emit();
  };
  release = () => {
    this.wanted = false;
    this.pending = false;
    this.sending = false;
    this.processor?.port.postMessage({ type: "capture", enabled: false });
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    if (this.turn)
      this.session.sendVoice({ type: "voice:stop", turn: this.turn });
    this.turn = "";
    clearTimeout(this.timer);
    this.emit();
  };
  private message = (message: VoiceMessage) => {
    if (!this.active) return;
    if (message.type === "voice:error") {
      this.leave();
      this.error = message.message;
      this.emit();
      return;
    }
    if (message.type === "voice:state") {
      if (this.floor && !message.floor)
        this.processor?.port.postMessage({ type: "drain" });
      this.peers = message.peers;
      this.floor = message.floor;
      this.lastReceived = Date.now();
      if (message.peers.some((peer) => peer.id === this.session.voicePeer))
        clearTimeout(this.joinTimer);
      const owns = message.floor?.peer === this.session.voicePeer;
      if (owns && message.floor?.turn === this.turn && this.wanted) {
        if (!this.sending) {
          this.pending = false;
          this.sending = true;
          this.lastSent = Date.now();
          this.stream?.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
          this.processor?.port.postMessage({ type: "capture", enabled: true });
          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            this.release();
            this.notice =
              "Turno de 30 segundos terminado. Puedes volver a pulsar para continuar.";
            this.emit();
          }, VOICE_MAX_TURN_MS);
        }
      } else if (owns) {
        this.session.sendVoice({
          type: "voice:stop",
          turn: message.floor!.turn,
        });
      } else if (this.sending || this.pending) {
        this.release();
      }
      this.emit();
      return;
    }
    if (
      message.type === "voice:audio" &&
      validVoiceData(message.data) &&
      message.peer !== this.session.voicePeer
    ) {
      if (
        !this.floor ||
        this.floor.peer !== message.peer ||
        this.floor.turn !== message.turn
      )
        return;
      this.lastReceived = Date.now();
      if (this.muted) return;
      if (this.receivedTurn !== message.turn) {
        this.receivedTurn = message.turn;
        this.processor?.port.postMessage({ type: "clear" });
      }
      const bytes = fromBase64(message.data);
      this.processor?.port.postMessage(
        { type: "play", samples: bytes.buffer },
        [bytes.buffer],
      );
    }
  };
  toggleMute() {
    this.muted = !this.muted;
    if (this.output) this.output.gain.value = this.muted ? 0 : 1;
    this.processor?.port.postMessage({ type: "clear" });
    this.emit();
  }
  leave() {
    ++this.generation;
    this.release();
    if (this.active) this.session.sendVoice({ type: "voice:leave" });
    this.active = false;
    this.busy = false;
    this.peers = [];
    this.floor = null;
    this.receivedTurn = "";
    clearTimeout(this.joinTimer);
    clearInterval(this.monitor);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = undefined;
    if (this.processor) {
      this.processor.port.onmessage = null;
      this.processor.onprocessorerror = null;
      this.processor.disconnect();
      this.processor.port.close();
    }
    this.processor = undefined;
    this.source?.disconnect();
    this.source = undefined;
    this.output?.disconnect();
    this.output = undefined;
    const audio = this.audio;
    this.audio = undefined;
    if (audio) {
      audio.onstatechange = null;
      void audio.close().catch(() => {});
    }
    this.emit();
  }
  destroy() {
    this.destroyed = true;
    this.leave();
    this.unsubscribe();
    this.unsubscribeVoice();
    window.removeEventListener("blur", this.release);
    window.removeEventListener("pagehide", this.onPageHide);
    document.removeEventListener("visibilitychange", this.visibility);
    this.listeners.clear();
  }
}
