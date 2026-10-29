import type { DocNode } from "./document";
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_FIGURES = 20;
export const IMAGE_BUCKET = "texla-images";
export type ImageAsset = {
  id: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  size: number;
  remote?: { path: string; key: string; iv: string };
};
export type FigureAttributes = {
  id: string;
  asset: ImageAsset;
  caption: string;
  source: string;
  alt: string;
  width: number;
  align: "left" | "center" | "right";
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validImageAsset(value: unknown): value is ImageAsset {
  const a = value as ImageAsset;
  return (
    !!a &&
    uuid.test(a.id) &&
    ["image/png", "image/jpeg"].includes(a.mime) &&
    Number.isInteger(a.width) &&
    a.width > 0 &&
    a.width <= 2400 &&
    Number.isInteger(a.height) &&
    a.height > 0 &&
    a.height <= 2400 &&
    Number.isInteger(a.size) &&
    a.size > 0 &&
    a.size <= MAX_IMAGE_BYTES &&
    (!a.remote ||
      (typeof a.remote.path === "string" &&
        a.remote.path.split("/").length === 2 &&
        uuid.test(a.remote.path.split("/")[0]) &&
        a.remote.path.split("/")[1] === `${a.id}.bin` &&
        /^[A-Za-z0-9_-]{43}$/.test(a.remote.key) &&
        /^[A-Za-z0-9_-]{16}$/.test(a.remote.iv)))
  );
}
export function validFigure(value: unknown): value is FigureAttributes {
  const a = value as FigureAttributes;
  return (
    !!a &&
    uuid.test(a.id) &&
    validImageAsset(a.asset) &&
    typeof a.caption === "string" &&
    a.caption.length <= 500 &&
    typeof a.source === "string" &&
    a.source.length <= 500 &&
    typeof a.alt === "string" &&
    a.alt.length <= 300 &&
    Number.isInteger(a.width) &&
    a.width >= 25 &&
    a.width <= 100 &&
    ["left", "center", "right"].includes(a.align)
  );
}
export function figures(node: DocNode): FigureAttributes[] {
  return node.type === "figure" && validFigure(node.attrs)
    ? [node.attrs]
    : (node.content || []).flatMap(figures);
}
export function mapFigureAssets(
  node: DocNode,
  assets: Map<string, ImageAsset>,
): DocNode {
  return node.type === "figure" && validFigure(node.attrs)
    ? {
        ...node,
        attrs: {
          ...node.attrs,
          asset: assets.get(node.attrs.asset.id) || node.attrs.asset,
        },
      }
    : {
        ...node,
        ...(node.content
          ? {
              content: node.content.map((child) =>
                mapFigureAssets(child, assets),
              ),
            }
          : {}),
      };
}
export const imageFilename = (asset: ImageAsset) =>
  `imagenes/${asset.id}.${asset.mime === "image/png" ? "png" : "jpg"}`;
export function hasImageSignature(bytes: Uint8Array, mime: ImageAsset["mime"]) {
  return mime === "image/png"
    ? bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71 &&
        bytes[4] === 13 &&
        bytes[5] === 10 &&
        bytes[6] === 26 &&
        bytes[7] === 10
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}
