import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  cacheImage,
  imageBlob,
  prepareImage,
  uploadImage,
} from "./imageAssets";
import { type FigureAttributes, type ImageAsset } from "./imageTypes";
export default function ImageDialog({
  initial,
  session,
  remoteRequired,
  onApply,
}: {
  initial?: FigureAttributes;
  session: Session | null;
  remoteRequired: boolean;
  onApply: (figure: FigureAttributes) => void;
}) {
  const [asset, setAsset] = useState<ImageAsset | undefined>(initial?.asset);
  const [blob, setBlob] = useState<Blob>();
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState(initial?.caption || "");
  const [source, setSource] = useState(initial?.source || "");
  const [alt, setAlt] = useState(initial?.alt || "");
  const [width, setWidth] = useState(initial?.width || 100);
  const [align, setAlign] = useState<FigureAttributes["align"]>(
    initial?.align || "center",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    let live = true;
    let url = "";
    if (blob) {
      url = URL.createObjectURL(blob);
      setPreview(url);
    } else if (asset)
      void imageBlob(asset)
        .then((value) => {
          if (live) {
            url = URL.createObjectURL(value);
            setPreview(url);
          }
        })
        .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob, asset]);
  async function select(file?: File) {
    if (!file) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    try {
      const value = await prepareImage(file, controller.signal);
      if (controller.signal.aborted) return;
      setAsset(value.asset);
      setBlob(value.blob);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo preparar la imagen.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function insert() {
    if (!asset) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    try {
      if (blob) await cacheImage(asset, blob);
      let ready = asset;
      if (remoteRequired && !asset.remote) {
        if (!session)
          throw new Error(
            "Inicia sesión para subir imágenes a un documento compartido.",
          );
        ready = await uploadImage(asset, session);
      }
      if (controller.signal.aborted) return;
      onApply({
        id: initial?.id || crypto.randomUUID(),
        asset: ready,
        caption: caption.trim(),
        source: source.trim(),
        alt: alt.trim(),
        width,
        align,
      });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo insertar la imagen.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="image-dialog">
      <h2 id="modal-title">
        {initial ? "Editar figura" : "Añadir una imagen"}
      </h2>
      <p>
        Flujogramas, fotografías y figuras de tu proyecto, con numeración
        automática. Hasta 20 figuras por documento.
      </p>
      <label className="image-upload">
        {initial ? "Cambiar archivo" : "Seleccionar imagen"}
        <input
          type="file"
          aria-label="Archivo de imagen"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            void select(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <small>
          PNG, JPG o WebP · hasta 10 MB. Se optimiza a un máximo de 2400 píxeles
          y 1 MB.
        </small>
      </label>
      {preview && (
        <div className="image-preview">
          <img
            src={preview}
            alt="Vista previa de la imagen"
            style={{ width: `${width}%` }}
          />
        </div>
      )}
      <label className="field-label">
        Pie de figura
        <input
          value={caption}
          maxLength={500}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Diagrama del proceso de investigación"
        />
      </label>
      <label className="field-label">
        Fuente o crédito (opcional)
        <input
          value={source}
          maxLength={500}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Elaboración propia, autor o referencia"
        />
      </label>
      <label className="field-label">
        Descripción accesible
        <input
          value={alt}
          maxLength={300}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Describe lo que muestra la imagen"
        />
      </label>
      <div className="image-layout">
        <label>
          Ancho: {width}%
          <input
            aria-label="Ancho de imagen"
            type="range"
            min={25}
            max={100}
            step={5}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <label>
          Alineación
          <select
            aria-label="Alineación de imagen"
            value={align}
            onChange={(event) =>
              setAlign(event.target.value as FigureAttributes["align"])
            }
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      </div>
      <p className="privacy-note">
        {remoteRequired
          ? "El archivo se guarda cifrado en Supabase y puede verse desde los documentos que lo incluyan."
          : "La imagen se guarda en este navegador. La copia editable descargada incluye el archivo; para compartirlo por enlace necesitarás iniciar sesión y activar el almacenamiento en la nube."}
      </p>
      <button
        className="primary-button"
        disabled={!asset || busy}
        onClick={() => void insert()}
      >
        {busy
          ? "Preparando imagen…"
          : initial
            ? "Guardar figura"
            : "Insertar imagen"}
      </button>
      {error && (
        <p role="alert" className="import-error">
          {error}
        </p>
      )}
    </div>
  );
}
