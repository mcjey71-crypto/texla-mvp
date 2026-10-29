import { strToU8, zipSync } from "fflate";
import {
  makeBackup,
  readBackup,
  MAX_BACKUP_BYTES,
  type SavedDocument,
} from "./backup";
import { imageBlob, bytes64, cacheImage } from "./imageAssets";
import {
  figures,
  mapFigureAssets,
  imageFilename,
  validImageAsset,
  MAX_FIGURES,
  type ImageAsset,
} from "./imageTypes";
import { exportLatex } from "./document";
export async function portableBackup(doc: SavedDocument): Promise<string> {
  const data = JSON.parse(makeBackup(doc));
  const attachments: { asset: ImageAsset; data: string }[] = [];
  const assets = new Map<string, ImageAsset>();
  for (const figure of figures(doc.content))
    if (!assets.has(figure.asset.id)) {
      const blob = await imageBlob(figure.asset);
      const { remote: _, ...local } = figure.asset;
      assets.set(local.id, local);
      attachments.push({
        asset: local,
        data: bytes64(new Uint8Array(await blob.arrayBuffer())),
      });
    }
  data.document.content = mapFigureAssets(doc.content, assets);
  if (attachments.length) data.images = attachments;
  const result = JSON.stringify(data, null, 2);
  if (new TextEncoder().encode(result).length > MAX_BACKUP_BYTES)
    throw new Error(
      "La copia supera 32 MB. Divide el documento antes de descargarla.",
    );
  return result;
}
export async function restoreImageBackup(raw: string) {
  const restored = readBackup(raw);
  const data = JSON.parse(raw);
  const replacements = new Map<string, ImageAsset>();
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.length > MAX_FIGURES)
      throw new Error("La copia contiene demasiadas imágenes.");
    const blobs: { asset: ImageAsset; blob: Blob }[] = [];
    for (const entry of data.images) {
      if (
        !validImageAsset(entry.asset) ||
        typeof entry.data !== "string" ||
        entry.data.length > 1_400_000 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data) ||
        replacements.has(entry.asset.id)
      )
        throw new Error("Una imagen de la copia no es válida.");
      const bytes = Uint8Array.from(atob(entry.data), (char) =>
        char.charCodeAt(0),
      );
      if (bytes.length !== entry.asset.size)
        throw new Error("Una imagen de la copia está incompleta.");
      const { remote: _, ...local } = entry.asset;
      const asset = { ...local, id: crypto.randomUUID() };
      replacements.set(entry.asset.id, asset);
      blobs.push({ asset, blob: new Blob([bytes], { type: asset.mime }) });
    }
    for (const figure of figures(restored.content))
      if (!figure.asset.remote && !replacements.has(figure.asset.id))
        throw new Error("Falta una imagen dentro de la copia.");
    for (const entry of blobs) await cacheImage(entry.asset, entry.blob);
  }
  for (const figure of figures(restored.content))
    if (!figure.asset.remote && !replacements.has(figure.asset.id))
      throw new Error("Falta una imagen dentro de la copia.");
  return {
    ...restored,
    content: mapFigureAssets(restored.content, replacements),
  };
}
export async function latexWithImages(doc: SavedDocument): Promise<Blob> {
  const files: Record<string, Uint8Array> = {
    "documento.tex": strToU8(
      exportLatex(
        doc.title,
        doc.content,
        doc.references,
        doc.citationStyle,
        doc.format,
      ),
    ),
  };
  for (const figure of figures(doc.content)) {
    const filename = imageFilename(figure.asset);
    if (!files[filename])
      files[filename] = new Uint8Array(
        await (await imageBlob(figure.asset)).arrayBuffer(),
      );
  }
  files["LEEME.txt"] = strToU8(
    "Extrae toda la carpeta y compila documento.tex con XeLaTeX, LuaLaTeX o pdfLaTeX. Conserva la carpeta imagenes junto al archivo .tex. Las imágenes se incluyen en PNG/JPG, sin enlaces ni claves de acceso.",
  );
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}
