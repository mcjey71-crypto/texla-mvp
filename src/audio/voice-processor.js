// Audio runs off the UI thread. Only the granted push-to-talk turn emits samples.
class TexlaVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.transmitting = false;
    this.capture = new Int16Array(1600);
    this.used = 0;
    this.sum = 0;
    this.weight = 0;
    this.ring = new Float32Array(16000);
    this.read = 0;
    this.count = 0;
    this.phase = 0;
    this.playing = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === "capture") {
        this.transmitting = data.enabled;
        this.used = 0;
        this.sum = 0;
        this.weight = 0;
      }
      if (data.type === "drain" && this.count > 1) this.playing = true;
      if (data.type === "clear") {
        this.count = 0;
        this.read = 0;
        this.phase = 0;
        this.playing = false;
      }
      if (data.type === "play") {
        const samples = new Int16Array(data.samples);
        // Discard stale backlog rather than play delayed speech after a stalled tab.
        if (this.count + samples.length > 8000) {
          this.count = 0;
          this.read = 0;
          this.phase = 0;
          this.playing = false;
        }
        for (const sample of samples) {
          this.ring[(this.read + this.count) % this.ring.length] =
            sample / 32768;
          this.count++;
        }
        if (this.count >= 3200) this.playing = true;
      }
    };
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (this.transmitting && input) {
      const ratio = sampleRate / 16000;
      for (const value of input) {
        let remaining = 1;
        while (remaining > 0) {
          const portion = Math.min(remaining, ratio - this.weight);
          this.sum += value * portion;
          this.weight += portion;
          remaining -= portion;
          if (this.weight >= ratio - 1e-8) {
            const mono = Math.max(-1, Math.min(1, this.sum / ratio));
            this.capture[this.used++] = Math.round(mono * 32767);
            this.sum = 0;
            this.weight = 0;
            if (this.used === this.capture.length) {
              const samples = this.capture.buffer;
              this.port.postMessage({ type: "samples", samples }, [samples]);
              this.capture = new Int16Array(1600);
              this.used = 0;
            }
          }
        }
      }
    }
    const output = outputs[0]?.[0];
    if (output) {
      output.fill(0);
      if (this.playing)
        for (let i = 0; i < output.length; i++) {
          if (this.count < 2) {
            this.playing = false;
            break;
          }
          const first = this.ring[this.read],
            second = this.ring[(this.read + 1) % this.ring.length];
          output[i] = first + (second - first) * this.phase;
          this.phase += 16000 / sampleRate;
          while (this.phase >= 1 && this.count) {
            this.phase--;
            this.read = (this.read + 1) % this.ring.length;
            this.count--;
          }
        }
    }
    return true;
  }
}
registerProcessor("texla-voice", TexlaVoiceProcessor);
