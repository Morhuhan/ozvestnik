// src/app/admin/components/RichTextEditorModal.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import { NodeSelection, TextSelection } from "prosemirror-state";

import { useToast } from "@/app/components/toast/ToastProvider";
import {
  MediaSinglePicker,
  type MediaItem,
} from "@/app/admin/components/MediaSinglePicker";

/* ─────────────────────────────  TYPES & ALLOWED MIME  ───────────────────────────── */

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;
type TiptapDoc = any;

type ToastInput = {
  title?: string;
  description?: string;
  type?: "success" | "error" | "info";
  duration?: number;
};

// должен соответствовать списку в lib/media.ts
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const isAllowedImageMime = (mime?: string | null) =>
  !!mime && ALLOWED_IMAGE_MIME.has(String(mime).toLowerCase());

/* ─────────────────────────────  HELPERS  ───────────────────────────── */

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };

function jsonSafeStringify(v: unknown) {
  return JSON.stringify(v ?? null);
}
function normalizePlain(s: string | null | undefined) {
  return String(s ?? "").replace(/\r\n/g, "\n").trim();
}
function tiptapToPlain(content: TiptapDoc | null | undefined): string {
  try {
    const paras: string[] =
      content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || [];
    return paras.join("\n\n");
  } catch {
    return "";
  }
}
function normalizeDocForCompare(doc: TiptapDoc | null | undefined): TiptapDoc {
  if (!doc || typeof doc !== "object") return EMPTY_DOC;
  return doc;
}
function clearStoredMarks(editor: EditorInstance | null) {
  if (!editor) return;
  const any = editor as any;
  const { state, view } = any;
  if (!state || !view) return;
  view.dispatch(state.tr.setStoredMarks([]));
}

/* ─────────────────────────────  IMAGE EXTENSION  ───────────────────────────── */

const ImageExtended = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-media-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id") || null,
        renderHTML: (attrs) =>
          attrs["data-media-id"] ? { "data-media-id": String(attrs["data-media-id"]) } : {},
      },
      width: { default: null },
      height: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },
});

/* ─────────────────────────────  PROPS  ───────────────────────────── */

export type RichTextEditorModalProps = {
  initialDoc?: TiptapDoc | null;
  initialPlain?: string;
  jsonFieldName?: string; // default: "contentJson"
  plainFieldName?: string; // default: "body"
};

/* ─────────────────────────────  COMPONENT  ───────────────────────────── */

export function RichTextEditorModal({
  initialDoc = null,
  initialPlain = "",
  jsonFieldName = "contentJson",
  plainFieldName = "body",
}: RichTextEditorModalProps) {
  const pushToast = useToast() as (t: ToastInput) => void;

  const [open, setOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [pickedImage, setPickedImage] = useState<MediaItem | null>(null);

  const [draftJson, setDraftJson] = useState<TiptapDoc | null>(initialDoc);
  const [draftPlain, setDraftPlain] = useState<string>(initialPlain || tiptapToPlain(initialDoc));

  const [savedJson, setSavedJson] = useState<TiptapDoc | null>(initialDoc);
  const [savedPlain, setSavedPlain] = useState<string>(initialPlain || tiptapToPlain(initialDoc));

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const plainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const didInitialSyncRef = useRef(false);

  // если выделена картинка — создаём параграф после неё и переносим каретку
  const jumpBelowImageIfImageSelected = (view: any) => {
    const { state } = view;
    if (!(state.selection instanceof NodeSelection)) return false;
    const sel = state.selection as NodeSelection;
    const node = sel.node;
    if (!node || node.type.name !== "image") return false;

    const after = sel.$from.pos + node.nodeSize;
    const tr = state.tr.insert(after, state.schema.nodes.paragraph.create());
    const resolved = tr.doc.resolve(after + 1);
    tr.setSelection(TextSelection.near(resolved));
    view.dispatch(tr);
    return true;
  };

  const isPrintableKey = (e: KeyboardEvent) =>
    e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

  // extensions
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        strike: false,
        code: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        underline: false,
        link: false,
      }),
      Bold.extend({ inclusive: false }),
      Italic.extend({ inclusive: false }),
      Underline.extend({ inclusive: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"],
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
          spellcheck: "false",
          "data-gramm": "false",
          "data-gramm_editor": "false",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ImageExtended.configure({
        allowBase64: false,
        inline: false,
      }),
      Placeholder.configure({ placeholder: "Напишите текст статьи…" }),
    ],
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialDoc ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class: "tiptap ProseMirror focus:outline-none prose prose-base sm:prose lg:prose-lg max-w-none",
        spellCheck: "true",
      },
      handleDrop: () => true,
      handlePaste: (_view, event) => {
        if (event.clipboardData?.files?.length) return true;
        return false;
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter" || isPrintableKey(event)) {
          const moved = jumpBelowImageIfImageSelected(view);
          if (moved) return false;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      const json = editor.getJSON();
      const text = editor.getText();
      setDraftJson(json);
      setDraftPlain(text.trim());
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(open);
  }, [editor, open]);

  useEffect(() => {
    if (!editor || didInitialSyncRef.current) return;
    const json = editor.getJSON();
    const text = normalizePlain(editor.getText());

    setSavedJson(json);
    setSavedPlain(text);
    setDraftJson(json);
    setDraftPlain(text);

    if (jsonInputRef.current) jsonInputRef.current.value = jsonSafeStringify(json);
    if (plainTextareaRef.current) plainTextareaRef.current.value = text;

    didInitialSyncRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (jsonInputRef.current) jsonInputRef.current.value = jsonSafeStringify(savedJson);
    if (plainTextareaRef.current) plainTextareaRef.current.value = savedPlain;
  }, [savedJson, savedPlain]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const selectors = [
      "button",
      "[href]",
      "input",
      "textarea",
      "[tabindex]:not([tabindex='-1'])",
      "[contenteditable='true']",
      "select",
   ].join(",");

    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(selectors)).filter(
        (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
      );

    const focusTimer = setTimeout(() => {
      if (editor) editor.chain().focus().run();
      else getFocusable()[0]?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editor]);

  const isDirty = () => {
    if (normalizePlain(draftPlain) !== normalizePlain(savedPlain)) return true;
    const a = jsonSafeStringify(normalizeDocForCompare(draftJson));
    const b = jsonSafeStringify(normalizeDocForCompare(savedJson));
    return a !== b;
  };

  const attemptClose = () => {
    if (isDirty()) {
      const ok = window.confirm("Вы уверены, что хотите закрыть без сохранения? Изменения будут потеряны.");
      if (!ok) return;
      pushToast({ type: "info", title: "Закрыто без сохранения" });
    }
    setOpen(false);
  };

  const onEditorShellMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    const prose = target.closest(".ProseMirror");
    if (!prose || prose === target) {
      e.preventDefault();
      editor.commands.focus("end");
      clearStoredMarks(editor);
    }
  };

  const applyBoldOnce = () => {
    if (!editor) return;
    const sel: any = (editor as any).state?.selection;
    if (!sel || sel.empty) return;
    editor.chain().focus().toggleBold().setTextSelection(sel.to).run();
    editor.commands.unsetAllMarks();
    clearStoredMarks(editor);
  };
  const applyItalicOnce = () => {
    if (!editor) return;
    const sel: any = (editor as any).state?.selection;
    if (!sel || sel.empty) return;
    editor.chain().focus().toggleItalic().setTextSelection(sel.to).run();
    editor.commands.unsetAllMarks();
    clearStoredMarks(editor);
  };
  const applyUnderlineOnce = () => {
    if (!editor) return;
    const sel: any = (editor as any).state?.selection;
    if (!sel || sel.empty) return;
    editor.chain().focus().toggleUnderline().setTextSelection(sel.to).run();
    editor.commands.unsetAllMarks();
    clearStoredMarks(editor);
  };

  const insertPickedImage = (m: MediaItem) => {
    if (!editor) return;
    if (m.kind !== "IMAGE" || !isAllowedImageMime(m.mime)) {
      const allowedStr = Array.from(ALLOWED_IMAGE_MIME)
        .map((s) => s.split("/")[1].toUpperCase())
        .join(", ");
      pushToast({
        type: "error",
        title: "Неподдерживаемый формат",
        description: `Этот элемент нельзя вставить как изображение (${m.mime}). Разрешены: ${allowedStr}.`,
      });
      return;
    }

    const url = `/admin/media/${m.id}/raw`;
    const alt = m.alt || m.title || m.filename || m.id;

    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "image",
          attrs: {
            src: url,
            alt,
            title: m.title ?? null,
            "data-media-id": m.id,
          },
        },
        { type: "paragraph" },
      ])
      .run();

    editor.commands.focus("end");
    setImagePickerOpen(false);
    setPickedImage(null);
  };

  return (
    <>
      <style jsx global>{`
        .ProseMirror a,
        .ProseMirror a:visited {
          color: #1d4ed8 !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem auto;
          border-radius: 0.5rem;
        }
        .editor-shell {
          min-height: 100%;
          cursor: text;
        }
        .editor-shell .ProseMirror {
          min-height: 100%;
        }
        .ProseMirror p:empty::before {
          content: " ";
          white-space: pre;
        }
      `}</style>

      <input ref={jsonInputRef} type="hidden" name={jsonFieldName} />
      <textarea ref={plainTextareaRef} name={plainFieldName} defaultValue={savedPlain} className="hidden" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
      >
        Открыть расширенный редактор
      </button>

      <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" hidden={!open}>
        <div className="absolute inset-0 bg-black/40" onClick={attemptClose} />
        <div
          ref={dialogRef}
          className="relative z-10 w-[min(1000px,95vw)] h-[80vh] bg-white rounded-xl shadow-xl border flex flex-col"
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Редактор статьи</div>
            <div className="flex gap-2">
              <button type="button" onClick={attemptClose} className="px-3 py-1.5 rounded border">
                Закрыть (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedJson(draftJson);
                  setSavedPlain(draftPlain);
                  if (jsonInputRef.current) jsonInputRef.current.value = jsonSafeStringify(draftJson);
                  if (plainTextareaRef.current) plainTextareaRef.current.value = draftPlain;
                  pushToast({
                    type: "success",
                    title: "Сохранено",
                    description: "Изменения редактора сохранены в форму.",
                  });
                }}
                className="px-3 py-1.5 rounded bg-black text-white"
              >
                Сохранить
              </button>
            </div>
          </div>

          <div className="px-4 py-2 border-b flex-shrink-0">
            {editor ? (
              <Toolbar
                editor={editor}
                onBold={applyBoldOnce}
                onItalic={applyItalicOnce}
                onUnderline={applyUnderlineOnce}
                onInsertImage={() => setImagePickerOpen(true)}
              />
            ) : null}
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div
              className="editor-shell h-full min-h-full border rounded-lg p-4"
              onMouseDown={onEditorShellMouseDown}
              role="presentation"
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Пикер изображений на базе MediaSinglePicker */}
      {imagePickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow w-full max-w-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Вставить картинку</div>
              <button type="button" onClick={() => setImagePickerOpen(false)} className="text-xl leading-none">
                ×
              </button>
            </div>

            <MediaSinglePicker
              name="__inline_image_picker__"
              label="Выберите изображение"
              acceptKinds={["IMAGE"]}
              onChange={(item) => setPickedImage(item)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setImagePickerOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
                onClick={() => {
                  if (!pickedImage) return;
                  insertPickedImage(pickedImage);
                }}
                disabled={!pickedImage}
              >
                Вставить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────  TOOLBAR  ───────────────────────────── */

function Toolbar({
  editor,
  onBold,
  onItalic,
  onUnderline,
  onInsertImage,
}: {
  editor: EditorInstance;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onInsertImage: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const rerender = () => setTick((x) => x + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const sel: any = (editor as any).state?.selection;
  const hasSelection = !!sel && !sel.empty;

  const active = {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
  };

  const baseBtn =
    "px-2 py-1 text-sm rounded border transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-gray-200";
  const on = "bg-black text-white border-black";
  const off = "bg-white hover:bg-gray-50";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={`${baseBtn} ${active.bold ? on : off}`}
        onClick={onBold}
        aria-pressed={active.bold}
        disabled={!hasSelection}
        title="Полужирный (по выделению)"
      >
        <span className="font-bold">B</span>
      </button>

      <button
        type="button"
        className={`${baseBtn} ${active.italic ? on : off}`}
        onClick={onItalic}
        aria-pressed={active.italic}
        disabled={!hasSelection}
        title="Курсив (по выделению)"
        style={{ fontStyle: "italic" }}
      >
        I
      </button>

      <button
        type="button"
        className={`${baseBtn} ${active.underline ? on : off}`}
        onClick={onUnderline}
        aria-pressed={active.underline}
        disabled={!hasSelection}
        title="Подчёркнутый (по выделению)"
        style={{ textDecoration: "underline" }}
      >
        U
      </button>

      <button
        type="button"
        className={`${baseBtn} ${off}`}
        onClick={onInsertImage}
        title="Вставить картинку из медиа-библиотеки"
        style={{ marginLeft: 8 }}
      >
        🖼 Картинка
      </button>

      <button
        type="button"
        className={`${baseBtn} ${off}`}
        title="Снять форматирование (сброс маркеров ввода)"
        onClick={() => {
          editor.commands.unsetAllMarks();
          clearStoredMarks(editor);
        }}
      >
        🖌 Очистить
      </button>
    </div>
  );
}
