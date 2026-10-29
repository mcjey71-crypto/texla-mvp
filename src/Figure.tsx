import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useState } from "react";
import { imageBlob } from "./imageAssets";
import { validFigure, type FigureAttributes } from "./imageTypes";

function FigureView({
  node,
  editor,
  getPos,
  selected,
  extension,
}: NodeViewProps) {
  const figure = node.attrs as FigureAttributes;
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [number, setNumber] = useState(1);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let objectUrl = "";
    setUrl("");
    setError("");
    if (!validFigure(figure)) {
      setError("La imagen no es válida.");
      return;
    }
    void imageBlob(figure.asset)
      .then((blob) => {
        if (live) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((error) => {
        if (live)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo abrir la imagen.",
          );
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [JSON.stringify(figure.asset), retry]);
  useEffect(() => {
    const update = () => {
      const position = getPos();
      let n = 0;
      editor.state.doc.descendants((child, pos) => {
        if (child.type.name === "figure" && pos <= (position ?? -1)) n++;
      });
      setNumber(n || 1);
    };
    update();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor, getPos]);
  if (!validFigure(figure))
    return (
      <NodeViewWrapper className="figure-error">
        Imagen no válida
      </NodeViewWrapper>
    );
  return (
    <NodeViewWrapper
      as="figure"
      className={`texla-figure ${selected ? "figure-selected" : ""}`}
      data-figure-number={number}
      data-figure-id={figure.id}
      contentEditable={false}
      style={{
        width: `${figure.width}%`,
        marginLeft: figure.align === "left" ? 0 : "auto",
        marginRight: figure.align === "right" ? 0 : "auto",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={figure.alt || figure.caption || `Figura ${number}`}
          width={figure.asset.width}
          height={figure.asset.height}
          onError={() => setError("La imagen no se pudo mostrar.")}
          draggable={false}
        />
      ) : (
        <div className="figure-placeholder">{error || "Cargando imagen…"}</div>
      )}
      {error && (
        <div className="figure-error" role="status">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>
            Reintentar imagen
          </button>
        </div>
      )}
      <figcaption>
        <strong>Figura {number}.</strong>
        {figure.caption && ` ${figure.caption}`}
        {figure.source && (
          <span className="figure-source">Fuente: {figure.source}</span>
        )}
      </figcaption>
      {editor.isEditable && (
        <div className="figure-actions">
          <button
            onClick={() => {
              const position = getPos();
              if (position !== undefined)
                extension.options.onEdit(figure, position);
            }}
          >
            Editar imagen
          </button>
          <button
            aria-label={`Quitar figura ${number}`}
            onClick={() => {
              const position = getPos();
              if (position !== undefined)
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: position, to: position + node.nodeSize })
                  .run();
            }}
          >
            Quitar
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
export const Figure = Node.create<{
  onEdit: (attributes: FigureAttributes, pos: number) => void;
}>({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { onEdit: () => {} };
  },
  addAttributes() {
    return {
      id: { default: "" },
      asset: { default: null },
      caption: { default: "" },
      source: { default: "" },
      alt: { default: "" },
      width: { default: 100 },
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-texla-figure]",
        getAttrs: (element) => {
          try {
            const value = JSON.parse(
              element.getAttribute("data-texla-figure") || "",
            );
            return validFigure(value) ? value : false;
          } catch {
            return false;
          }
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(
        { "data-texla-figure": JSON.stringify(node.attrs) },
        { class: HTMLAttributes.class || "texla-figure" },
      ),
      ["figcaption", node.attrs.caption || "Figura"],
    ];
  },
  renderText({ node }) {
    return `\n[Figura: ${node.attrs.caption || node.attrs.alt || "Imagen"}]\n`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});
