import { useEffect, useRef, useState } from "react";
import { Mic, Radio, Volume2, VolumeX, X, ChevronDown, ChevronUp } from "lucide-react";
import type { SharedSession } from "./SharedSession";
import { WalkieSession } from "./WalkieSession";
export default function WalkieTalkie({ session }: { session: SharedSession }) {
  const [voice, setVoice] = useState<WalkieSession | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, refresh] = useState(0);
  const pointer = useRef<number | null>(null);
  useEffect(() => {
    const current = new WalkieSession(session);
    const unsubscribe = current.subscribe(() => refresh((n) => n + 1));
    setVoice(current);
    return () => {
      unsubscribe();
      current.destroy();
    };
  }, [session]);
  useEffect(() => {
    if (!voice?.sending && !voice?.pending) pointer.current = null;
  }, [voice, voice?.sending, voice?.pending]);
  if (!voice) return null;
  const speaker = voice.peers.find((peer) => peer.id === voice.floor?.peer);
  const occupied = !!voice.floor && voice.floor.peer !== session.voicePeer;
  const ready =
    voice.active && voice.peers.some((peer) => peer.id === session.voicePeer);
  return (
    <section
      className={`walkie-panel ${expanded ? "walkie-expanded" : "walkie-compact"} ${voice.active ? "walkie-active" : ""} ${voice.sending ? "walkie-sending" : ""}`}
      aria-label="Walkie-talkie del documento"
    >
      <div className="walkie-identity">
        <span className="walkie-emblem" aria-hidden="true">
          <Radio size={21} strokeWidth={1.35} />
        </span>
        <div className="walkie-heading">
          <span className="walkie-eyebrow">WALKIE-TALKIE</span>
          <strong>Voz del equipo</strong>
          <span className="walkie-presence">
            <i aria-hidden="true" />
            {voice.active
              ? `${voice.peers.length} en el canal`
              : "En este documento"}
          </span>
        </div>
      </div>
      <div
        className={`walkie-content ${voice.active ? "walkie-connected" : ""}`}
      >
        {!voice.active ? (
          <>
            <p className="walkie-description">
              Una conversación, en el mismo espacio de tus ideas.
              <span>
                Cada participante activa su audio para entrar al canal.
              </span>
            </p>
            <button
              className="walkie-join"
              disabled={
                !session.voiceConnected || !session.voiceAvailable || voice.busy
              }
              onClick={() => void voice.join()}
            >
              <Mic size={16} />
              {voice.busy ? "Preparando micrófono…" : "Activar walkie-talkie"}
            </button>
            {voice.busy && (
              <button onClick={() => voice.leave()}>Cancelar audio</button>
            )}
            {!session.voiceConnected ? (
              <small>Disponible al conectar con el documento compartido.</small>
            ) : (
              !session.voiceAvailable && (
                <small>
                  El administrador debe actualizar el servidor de colaboración
                  para activar el audio.
                </small>
              )
            )}
          </>
        ) : (
          <>
            <div className="walkie-controls">
              <button
                className="walkie-talk"
                disabled={!ready || occupied}
                aria-label="Mantener pulsado para hablar"
                title="Mantén pulsado para hablar; suelta para terminar. Con el botón enfocado: Espacio o Enter."
                aria-pressed={voice.sending}
                onPointerDown={(event) => {
                  if (event.button !== 0 || pointer.current !== null) return;
                  event.preventDefault();
                  pointer.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  voice.press();
                }}
                onPointerUp={(event) => {
                  if (pointer.current === event.pointerId) {
                    pointer.current = null;
                    voice.release();
                  }
                }}
                onPointerCancel={() => {
                  pointer.current = null;
                  voice.release();
                }}
                onLostPointerCapture={() => {
                  pointer.current = null;
                  voice.release();
                }}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    if (!event.repeat) voice.press();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    voice.release();
                  }
                }}
                onBlur={() => {
                  pointer.current = null;
                  voice.release();
                }}
                onContextMenu={(event) => event.preventDefault()}
              >
                <Mic size={18} />
                {voice.sending
                  ? "Transmitiendo…"
                  : voice.pending
                    ? "Solicitando turno…"
                    : occupied
                      ? "Canal ocupado"
                      : "Mantén pulsado para hablar"}
              </button>
              <button
                className="walkie-icon"
                onClick={() => voice.toggleMute()}
                aria-label={
                  voice.muted
                    ? "Activar sonido del walkie-talkie"
                    : "Silenciar sonido del walkie-talkie"
                }
                aria-pressed={voice.muted}
                title={voice.muted ? "Activar sonido" : "Silenciar sonido"}
              >
                {voice.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button
                className="walkie-icon"
                onClick={() => {
                  pointer.current = null;
                  voice.leave();
                }}
                aria-label="Desactivar walkie-talkie"
                title="Desactivar walkie-talkie"
              >
                <X size={17} />
              </button>
            </div>
            <p
              role="status"
              className={`walkie-status ${voice.sending || occupied ? "is-speaking" : ""}`}
            >
              <span className="walkie-status-dot" aria-hidden="true" />
              {voice.sending
                ? "Tu micrófono está transmitiendo."
                : speaker
                  ? `${speaker.name} está hablando.`
                  : ready
                    ? "Canal libre."
                    : "Conectando al canal…"}
              {voice.muted ? " Sonido silenciado." : ""}
            </p>
            <small className="walkie-hint">
              Al soltar dejas de transmitir · Hasta 30 s por turno · Sin
              grabación en Texla
            </small>
          </>
        )}
      </div>
      <button className="walkie-details-toggle walkie-icon" aria-label={expanded ? "Reducir walkie-talkie" : "Mostrar detalles del walkie-talkie"} aria-expanded={expanded} title={expanded ? "Reducir" : "Detalles del canal"} onClick={()=>{voice.release();setExpanded(value=>!value);}}>
        {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      {voice.notice && (
        <p className="walkie-note" role="status">
          {voice.notice}
        </p>
      )}
      {voice.error && (
        <p className="walkie-error" role="alert">
          {voice.error}
        </p>
      )}
    </section>
  );
}
