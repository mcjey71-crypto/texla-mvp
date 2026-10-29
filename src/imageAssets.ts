import type { Session } from "@supabase/supabase-js";
import { databaseFor, publicImageUrl } from "./supabase";
import {
  figures,
  mapFigureAssets,
  validImageAsset,
  hasImageSignature,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_INPUT_BYTES,
  IMAGE_BUCKET,
  type ImageAsset,
} from "./imageTypes";
import type { SavedDocument } from "./backup";

type StoredAsset = {
  id: string;
  blob: Blob;
  published?: Record<string, NonNullable<ImageAsset["remote"]>>;
  confirmed?: Record<string, boolean>;
};
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("texla-image-assets-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("assets", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "No se pudo abrir el almacenamiento de imágenes del navegador.",
        ),
      );
  });
}
async function stored(id: string): Promise<StoredAsset | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("assets", "readonly")
        .objectStore("assets")
        .get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
async function put(value: StoredAsset) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            "No hay espacio disponible para guardar la imagen en este navegador.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function cacheImage(asset: ImageAsset, blob: Blob) {
  if (
    !validImageAsset(asset) ||
    blob.size !== asset.size ||
    !hasImageSignature(
      new Uint8Array(await blob.slice(0, 8).arrayBuffer()),
      asset.mime,
    )
  )
    throw new Error("El archivo de imagen no es válido.");
  const old = await stored(asset.id);
  await put({
    id: asset.id,
    blob,
    published: old?.published,
    confirmed: old?.confirmed,
  });
}
const bytes64 = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
const encode = (bytes: Uint8Array) =>
  bytes64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = (text: string) =>
  Uint8Array.from(
    atob(text.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
export { bytes64 };

export async function prepareImage(
  file: File,
  signal: AbortSignal,
): Promise<{ asset: ImageAsset; blob: Blob }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Selecciona una imagen PNG, JPG o WebP.");
  if (!file.size || file.size > MAX_IMAGE_INPUT_BYTES)
    throw new Error("La imagen debe pesar como máximo 10 MB.");
  signal.throwIfAborted();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "No se pudo leer la imagen. Prueba con otro archivo PNG o JPG.",
    );
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error(
        "La imagen es demasiado grande. Redúcela a menos de 40 megapíxeles.",
      );
    const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 8; attempt++) {
      signal.throwIfAborted();
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la imagen.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("No se pudo optimizar la imagen.")),
          mime,
          0.9,
        ),
      );
      if (blob.size <= MAX_IMAGE_BYTES) {
        signal.throwIfAborted();
        return {
          asset: {
            id: crypto.randomUUID(),
            mime,
            width: canvas.width,
            height: canvas.height,
            size: blob.size,
          },
          blob,
        };
      }
      scale *= 0.8;
    }
    throw new Error(
      "La imagen sigue siendo demasiado pesada. Reduce su resolución antes de subirla.",
    );
  } finally {
    bitmap.close();
  }
}

const pending = new Map<string, Promise<Blob>>();
export async function imageBlob(asset: ImageAsset): Promise<Blob> {
  if (!validImageAsset(asset))
    throw new Error("La referencia de imagen no es válida.");
  const key = JSON.stringify(asset);
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    let local: StoredAsset | undefined;
    try {
      local = await stored(asset.id);
    } catch {
      /* Remote images can still load if browser storage is unavailable. */
    }
    if (
      local?.blob.size === asset.size &&
      hasImageSignature(
        new Uint8Array(await local.blob.slice(0, 8).arrayBuffer()),
        asset.mime,
      )
    )
      return local.blob;
    if (!asset.remote)
      throw new Error(
        "Esta imagen solo estaba guardada en otro navegador. Abre una copia editable que incluya sus imágenes.",
      );
    const response = await fetch(publicImageUrl(asset.remote.path), {
      signal: AbortSignal.timeout(20000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok)
      throw new Error(
        "No se pudo descargar la imagen. Revisa tu conexión o el almacenamiento de la cuenta.",
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("La descarga de imagen está vacía.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES + 64) {
        await reader.cancel();
        throw new Error("La imagen supera el tamaño permitido.");
      }
      chunks.push(value);
    }
    const encrypted = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      encrypted.set(chunk, offset);
      offset += chunk.length;
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      decode(asset.remote.key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    let plain: ArrayBuffer;
    try {
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(asset.remote.iv) },
        cryptoKey,
        encrypted,
      );
    } catch {
      throw new Error(
        "No se pudo verificar la imagen cifrada. Conserva tu copia original.",
      );
    }
    if (
      plain.byteLength !== asset.size ||
      !hasImageSignature(new Uint8Array(plain), asset.mime)
    )
      throw new Error("La imagen descargada no es válida.");
    const blob = new Blob([plain], { type: asset.mime });
    try {
      await cacheImage(asset, blob);
    } catch {
      /* Rendering does not require a cache write. */
    }
    return blob;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

const uploading = new Map<string, Promise<ImageAsset>>();
export async function uploadImage(
  asset: ImageAsset,
  session: Session,
): Promise<ImageAsset> {
  const id = `${session.user.id}/${asset.id}`;
  if (uploading.has(id)) return uploading.get(id)!;
  const task = navigator.locks
    ? navigator.locks.request(`texla-image-${id}`, () =>
        uploadLocked(asset, session),
      )
    : uploadLocked(asset, session);
  uploading.set(id, task);
  try {
    return await task;
  } finally {
    uploading.delete(id);
  }
}
async function uploadLocked(
  asset: ImageAsset,
  session: Session,
): Promise<ImageAsset> {
  if (asset.remote) return asset;
  const blob = await imageBlob(asset);
  const local = await stored(asset.id);
  let remote = local?.published?.[session.user.id];
  if (remote && local?.confirmed?.[session.user.id])
    return { ...asset, remote };
  if (!remote) {
    const key = crypto.getRandomValues(new Uint8Array(32)),
      iv = crypto.getRandomValues(new Uint8Array(12));
    remote = {
      path: `${session.user.id}/${asset.id}.bin`,
      key: encode(key),
      iv: encode(iv),
    };
    await put({
      id: asset.id,
      blob,
      published: { ...local?.published, [session.user.id]: remote },
    });
  }
  const key = await crypto.subtle.importKey(
    "raw",
    decode(remote.key),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: decode(remote.iv) },
    key,
    await blob.arrayBuffer(),
  );
  const { error } = await databaseFor(session)
    .storage.from(IMAGE_BUCKET)
    .upload(remote.path, encrypted, {
      contentType: "application/octet-stream",
      upsert: false,
    });
  if (error && !["409", "Duplicate"].includes(String(error.statusCode))) {
    if (/bucket|row.level|policy|not found/i.test(error.message))
      throw Object.assign(
        new Error(
          "Activa el almacenamiento de imágenes en Supabase ejecutando el script de imágenes del proyecto. La imagen local se conserva.",
        ),
        { code: "TEXLA_IMAGES_SETUP" },
      );
    throw new Error(
      "No se pudo subir la imagen. Revisa tu conexión y el espacio disponible en Supabase.",
    );
  }
  await put({
    id: asset.id,
    blob,
    published: { ...local?.published, [session.user.id]: remote },
    confirmed: { ...local?.confirmed, [session.user.id]: true },
  });
  return { ...asset, remote };
}
export async function publishDocumentImages<
  T extends Pick<SavedDocument, "content">,
>(doc: T, session: Session | null): Promise<T> {
  const assets = new Map<string, ImageAsset>();
  for (const figure of figures(doc.content))
    if (!assets.has(figure.asset.id)) {
      if (!figure.asset.remote && !session)
        throw new Error(
          "Para compartir imágenes, inicia sesión y activa el almacenamiento de imágenes en Supabase.",
        );
      assets.set(
        figure.asset.id,
        figure.asset.remote
          ? figure.asset
          : await uploadImage(figure.asset, session!),
      );
    }
  return assets.size
    ? { ...doc, content: mapFigureAssets(doc.content, assets) }
    : doc;
}
