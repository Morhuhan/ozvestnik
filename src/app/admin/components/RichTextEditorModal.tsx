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
import { Node } from "@tiptap/core";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { useToast } from "@/app/components/toast/ToastProvider";
import { MediaSinglePicker, type MediaItem } from "@/app/admin/components/MediaSinglePicker";

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;
type TiptapDoc = any;

type ToastInput = {
  title?: string;
  description?: string;
  type?: "success" | "error" | "info";
  duration?: number;
};

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const isAllowedImageMime = (mime?: string | null) => !!mime && ALLOWED_IMAGE_MIME.has(String(mime).toLowerCase());

const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime"]);
const isAllowedVideoMime = (mime?: string | null) => !!mime && ALLOWED_VIDEO_MIME.has(String(mime).toLowerCase());

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };

function jsonSafeStringify(v: unknown) {
  return JSON.stringify(v ?? null);
}
function normalizePlain(s: string | null | undefined) {
  return String(s ?? "").replace(/\r\n/g, "\n").trim();
}
function tiptapToPlain(content: TiptapDoc | null | undefined): string {
  try {
    const paras: string[] = content?.content?.map((p: any) => p?.content?.map((t: any) => t?.text || "").join("")) || [];
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

const ImageExtended = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-media-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id") || null,
        renderHTML: (attrs) => (attrs["data-media-id"] ? { "data-media-id": String(attrs["data-media-id"]) } : {}),
      },
      width: { default: null },
      height: { default: null },
      alt: { default: null },
      title: { default: null },
      caption: { default: null },
    };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("image-node-wrapper");
      wrapper.style.cssText = "margin: 1.5rem auto; position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;";
      
      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      if (node.attrs.title) img.title = node.attrs.title;
      img.style.cssText = "max-width: 100%; height: auto; display: block; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);";
      
      wrapper.appendChild(img);
      
      if (node.attrs.title) {
        const caption = document.createElement("div");
        caption.classList.add("media-caption");
        caption.textContent = node.attrs.title;
        caption.style.cssText = "font-size: 0.875rem; color: #6b7280; text-align: center; font-style: italic; padding: 0 1rem;";
        wrapper.appendChild(caption);
      }
      
      wrapper.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === "function") {
          const pos = getPos();
          if (typeof pos === "number") {
            const nodeSelection = NodeSelection.create(editor.state.doc, pos);
            editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
          }
        }
      });
      
      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "image") return false;
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || "";
          if (updatedNode.attrs.title) {
            img.title = updatedNode.attrs.title;
          }
          
          const existingCaption = wrapper.querySelector(".media-caption");
          if (updatedNode.attrs.title) {
            if (existingCaption) {
              existingCaption.textContent = updatedNode.attrs.title;
            } else {
              const caption = document.createElement("div");
              caption.classList.add("media-caption");
              caption.textContent = updatedNode.attrs.title;
              caption.style.cssText = "font-size: 0.875rem; color: #6b7280; text-align: center; font-style: italic; padding: 0 1rem;";
              wrapper.appendChild(caption);
            }
          } else if (existingCaption) {
            existingCaption.remove();
          }
          
          return true;
        },
      };
    };
  },
});

const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      "data-media-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id") || null,
        renderHTML: (attrs) => (attrs["data-media-id"] ? { "data-media-id": String(attrs["data-media-id"]) } : {}),
      },
      width: { default: null },
      height: { default: null },
      poster: { default: null },
      title: { default: null },
      caption: { default: null },
      controls: { default: true },
      playsinline: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes, controls: "", playsinline: "" };
    return ["video", attrs];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("video-node-wrapper");
      wrapper.style.cssText = "margin: 1.5rem auto; position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;";
      
      const video = document.createElement("video");
      video.src = node.attrs.src;
      video.controls = true;
      video.playsInline = true;
      if (node.attrs.poster) video.poster = node.attrs.poster;
      if (node.attrs.title) video.title = node.attrs.title;
      video.style.cssText = "max-width: 100%; height: auto; display: block; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);";
      
      wrapper.appendChild(video);
      
      if (node.attrs.title) {
        const caption = document.createElement("div");
        caption.classList.add("media-caption");
        caption.textContent = node.attrs.title;
        caption.style.cssText = "font-size: 0.875rem; color: #6b7280; text-align: center; font-style: italic; padding: 0 1rem;";
        wrapper.appendChild(caption);
      }
      
      wrapper.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "VIDEO" || target.closest("video")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === "function") {
          const pos = getPos();
          if (typeof pos === "number") {
            const nodeSelection = NodeSelection.create(editor.state.doc, pos);
            editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
          }
        }
      });
      
      return {
        dom: wrapper,
        contentDOM: undefined,
        ignoreMutation: (mutation) => {
          return !wrapper.contains(mutation.target) || wrapper === mutation.target;
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== "video") return false;
          video.src = updatedNode.attrs.src;
          if (updatedNode.attrs.poster) {
            video.poster = updatedNode.attrs.poster;
          }
          if (updatedNode.attrs.title) {
            video.title = updatedNode.attrs.title;
          }
          
          const existingCaption = wrapper.querySelector(".media-caption");
          if (updatedNode.attrs.title) {
            if (existingCaption) {
              existingCaption.textContent = updatedNode.attrs.title;
            } else {
              const caption = document.createElement("div");
              caption.classList.add("media-caption");
              caption.textContent = updatedNode.attrs.title;
              caption.style.cssText = "font-size: 0.875rem; color: #6b7280; text-align: center; font-style: italic; padding: 0 1rem;";
              wrapper.appendChild(caption);
            }
          } else if (existingCaption) {
            existingCaption.remove();
          }
          
          return true;
        },
      };
    };
  },
});

export type RichTextEditorModalProps = {
  initialDoc?: TiptapDoc | null;
  initialPlain?: string;
  jsonFieldName?: string;
  plainFieldName?: string;
  initialFontSize?: string;
  initialLineHeight?: string;
  initialParagraphSpacing?: string;
};

export function RichTextEditorModal({
  initialDoc = null,
  initialPlain = "",
  jsonFieldName = "contentJson",
  plainFieldName = "body",
  initialFontSize = "16px",
  initialLineHeight = "1.75",
  initialParagraphSpacing = "1.5em",
}: RichTextEditorModalProps) {
  const pushToast = useToast() as (t: ToastInput) => void;

  const [open, setOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [pickedImage, setPickedImage] = useState<MediaItem | null>(null);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [pickedVideo, setPickedVideo] = useState<MediaItem | null>(null);

  const [draftJson, setDraftJson] = useState<TiptapDoc | null>(initialDoc);
  const [draftPlain, setDraftPlain] = useState<string>(initialPlain || tiptapToPlain(initialDoc));

  const [savedJson, setSavedJson] = useState<TiptapDoc | null>(initialDoc);
  const [savedPlain, setSavedPlain] = useState<string>(initialPlain || tiptapToPlain(initialDoc));

  const [fontSize, setFontSize] = useState<string>(initialFontSize);
  const [lineHeight, setLineHeight] = useState<string>(initialLineHeight);
  const [paragraphSpacing, setParagraphSpacing] = useState<string>(initialParagraphSpacing);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const plainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const didInitialSyncRef = useRef(false);

  const jumpBelowMediaIfSelected = (view: any) => {
    const { state } = view;
    if (!(state.selection instanceof NodeSelection)) return false;
    const sel = state.selection as NodeSelection;
    const node = sel.node;
    const isMedia = node && (node.type.name === "image" || node.type.name === "video");
    if (!isMedia) return false;
    const after = sel.$from.pos + node.nodeSize;
    const tr = state.tr.insert(after, state.schema.nodes.paragraph.create());
    const resolved = tr.doc.resolve(after + 1);
    tr.setSelection(TextSelection.near(resolved));
    view.dispatch(tr);
    return true;
  };

  const isPrintableKey = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

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
      Video,
      Placeholder.configure({ placeholder: "Напишите текст статьи…" }),
    ],
    []
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialDoc ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class: "tiptap ProseMirror focus:outline-none max-w-none px-2 sm:px-4",
        spellCheck: "true",
      },
      handleDrop: () => true,
      handlePaste: (_view, event) => {
        if (event.clipboardData?.files?.length) return true;
        return false;
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Enter" || isPrintableKey(event)) {
          const moved = jumpBelowMediaIfSelected(view);
          if (moved) return false;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          const { state } = view;
          if (state.selection instanceof NodeSelection) {
            const node = (state.selection as NodeSelection).node;
            if (node && (node.type.name === "image" || node.type.name === "video")) {
              return false;
            }
          }
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
        (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
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
    const caption = m.title || '';
    const alt = m.alt || m.title || '';
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "image",
          attrs: {
            src: url,
            alt,
            title: caption,
            caption,
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

  const insertPickedVideo = (m: MediaItem) => {
    if (!editor) return;
    if (m.kind !== "VIDEO" || !isAllowedVideoMime(m.mime)) {
      const allowedStr = Array.from(ALLOWED_VIDEO_MIME)
        .map((s) => s.split("/")[1]?.toUpperCase() || s)
        .join(", ");
      pushToast({
        type: "error",
        title: "Неподдерживаемый формат",
        description: `Этот элемент нельзя вставить как видео (${m.mime}). Разрешены: ${allowedStr}.`,
      });
      return;
    }
    const url = `/admin/media/${m.id}/raw`;
    const caption = m.title || '';
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "video",
          attrs: {
            src: url,
            title: caption,
            caption,
            "data-media-id": m.id,
          },
        },
        { type: "paragraph" },
      ])
      .run();
    editor.commands.focus("end");
    setVideoPickerOpen(false);
    setPickedVideo(null);
  };

  const handleSave = () => {
    setSavedJson(draftJson);
    setSavedPlain(draftPlain);
    if (jsonInputRef.current) jsonInputRef.current.value = jsonSafeStringify(draftJson);
    if (plainTextareaRef.current) plainTextareaRef.current.value = draftPlain;

    const form = jsonInputRef.current?.closest("form");
    if (form) {
      form.querySelectorAll('input[name="fontSize"], input[name="lineHeight"], input[name="paragraphSpacing"]').forEach(el => el.remove());

      const fontSizeInput = document.createElement("input");
      fontSizeInput.type = "hidden";
      fontSizeInput.name = "fontSize";
      fontSizeInput.value = fontSize;

      const lineHeightInput = document.createElement("input");
      lineHeightInput.type = "hidden";
      lineHeightInput.name = "lineHeight";
      lineHeightInput.value = lineHeight;

      const paragraphSpacingInput = document.createElement("input");
      paragraphSpacingInput.type = "hidden";
      paragraphSpacingInput.name = "paragraphSpacing";
      paragraphSpacingInput.value = paragraphSpacing;

      form.appendChild(fontSizeInput);
      form.appendChild(lineHeightInput);
      form.appendChild(paragraphSpacingInput);
    }

    pushToast({
      type: "success",
      title: "Сохранено",
      description: "Изменения редактора сохранены в форму.",
    });
  };

  const wordCount = draftPlain.split(/\s+/).filter(Boolean).length;
  const charCount = draftPlain.length;

  return (
    <>
      <style jsx global>{`
        .ProseMirror a,
        .ProseMirror a:visited {
          color: #2563eb !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .editor-shell {
          min-height: 100%;
          cursor: text;
        }
        .editor-shell .ProseMirror {
          min-height: 100%;
          font-size: ${fontSize};
          line-height: ${lineHeight};
          color: #171717;
        }
        .editor-shell .ProseMirror p {
          margin-bottom: ${paragraphSpacing};
          font-size: ${fontSize};
          line-height: ${lineHeight};
          color: #171717;
        }
        .editor-shell .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .ProseMirror p:empty::before {
          content: " ";
          white-space: pre;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          float: left;
        }
        .ProseMirror .image-node-wrapper.ProseMirror-selectednode,
        .ProseMirror .video-node-wrapper.ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 0.75rem;
        }
        .image-node-wrapper,
        .video-node-wrapper {
          user-select: none;
        }
        .ProseMirror strong {
          font-weight: 700;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
      `}</style>

      <input ref={jsonInputRef} type="hidden" name={jsonFieldName} />
      <textarea ref={plainTextareaRef} name={plainFieldName} defaultValue={savedPlain} className="hidden" />

      <button 
        type="button" 
        onClick={() => setOpen(true)} 
        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] transition-all"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Открыть расширенный редактор
        </span>
      </button>

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" hidden={!open}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={attemptClose} />
        <div
          ref={dialogRef}
          className="relative z-10 w-full sm:w-[min(1200px,95vw)] h-[100dvh] sm:h-[85vh] bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200 flex flex-col overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0 sm:rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="font-bold text-lg sm:text-xl text-gray-900">Редактор статьи</div>
              {isDirty() && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="3"/>
                  </svg>
                  Не сохранено
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={attemptClose} 
                className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 active:scale-95 transition-all text-sm sm:text-base"
              >
                <span className="hidden sm:inline">Закрыть (Esc)</span>
                <span className="sm:hidden">✕</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all text-sm sm:text-base"
              >
                Сохранить
              </button>
            </div>
          </div>

          <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
            {editor ? (
              <Toolbar
                editor={editor}
                onBold={applyBoldOnce}
                onItalic={applyItalicOnce}
                onUnderline={applyUnderlineOnce}
                onInsertImage={() => setImagePickerOpen(true)}
                onInsertVideo={() => setVideoPickerOpen(true)}
                fontSize={fontSize}
                setFontSize={setFontSize}
                lineHeight={lineHeight}
                setLineHeight={setLineHeight}
                paragraphSpacing={paragraphSpacing}
                setParagraphSpacing={setParagraphSpacing}
              />
            ) : null}
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              <div
                className="editor-shell bg-white border border-gray-200 rounded-xl shadow-sm min-h-[500px] p-4 sm:p-6"
                onMouseDown={onEditorShellMouseDown}
                role="presentation"
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-2 sm:py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span className="font-medium">{wordCount}</span> слов
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  <span className="font-medium">{charCount}</span> символов
                </span>
              </div>
              <div className="text-xs text-gray-500 hidden sm:block">
                Используйте Esc для закрытия
              </div>
            </div>
          </div>
        </div>
      </div>

      {imagePickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Вставить картинку</h3>
              <button 
                type="button" 
                onClick={() => setImagePickerOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <MediaSinglePicker
                name="__inline_image_picker__"
                label="Выберите изображение"
                acceptKinds={["IMAGE"]}
                onChange={(item) => setPickedImage(item)}
              />
            </div>

            <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
              <button 
                type="button" 
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 active:scale-95 transition-all" 
                onClick={() => setImagePickerOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
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

      {videoPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Вставить видео</h3>
              <button 
                type="button" 
                onClick={() => setVideoPickerOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <MediaSinglePicker
                name="__inline_video_picker__"
                label="Выберите видео"
                acceptKinds={["VIDEO"]}
                onChange={(item) => setPickedVideo(item)}
              />
            </div>

            <div className="flex gap-3 p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
              <button 
                type="button" 
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 active:scale-95 transition-all" 
                onClick={() => setVideoPickerOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                onClick={() => {
                  if (!pickedVideo) return;
                  insertPickedVideo(pickedVideo);
                }}
                disabled={!pickedVideo}
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

function Toolbar({
  editor,
  onBold,
  onItalic,
  onUnderline,
  onInsertImage,
  onInsertVideo,
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  paragraphSpacing,
  setParagraphSpacing,
}: {
  editor: EditorInstance;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onInsertImage: () => void;
  onInsertVideo: () => void;
  fontSize: string;
  setFontSize: (v: string) => void;
  lineHeight: string;
  setLineHeight: (v: string) => void;
  paragraphSpacing: string;
  setParagraphSpacing: (v: string) => void;
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
    "inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1";
  const on = "bg-blue-600 text-white border-blue-600 shadow-sm";
  const off = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400";

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${baseBtn} ${active.bold ? on : off}`}
          onClick={onBold}
          aria-pressed={active.bold}
          disabled={!hasSelection}
          title="Полужирный (по выделению)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 3h5a3 3 0 013 3v.5a3 3 0 01-1.5 2.598A3.5 3.5 0 0115 12.5V13a4 4 0 01-4 4H6a1 1 0 010-2h5a2 2 0 002-2v-.5a1.5 1.5 0 00-1.5-1.5H6a1 1 0 010-2h5.5A1 1 0 0013 8v-.5a1 1 0 00-1-1H6a1 1 0 110-2z" />
          </svg>
          <span className="hidden sm:inline">Жирный</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${active.italic ? on : off}`}
          onClick={onItalic}
          aria-pressed={active.italic}
          disabled={!hasSelection}
          title="Курсив (по выделению)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3h6a1 1 0 010 2h-1.5l-2 10H12a1 1 0 010 2H6a1 1 0 010-2h1.5l2-10H8a1 1 0 010-2z" />
          </svg>
          <span className="hidden sm:inline">Курсив</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${active.underline ? on : off}`}
          onClick={onUnderline}
          aria-pressed={active.underline}
          disabled={!hasSelection}
          title="Подчёркнутый (по выделению)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v9a3 3 0 11-6 0V4a1 1 0 112 0v9a1 1 0 102 0V4a1 1 0 011-1zM4 17a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">Подчёркнутый</span>
        </button>
      </div>

      <div className="hidden sm:block w-px h-6 bg-gray-300" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${baseBtn} ${off}`}
          onClick={onInsertImage}
          title="Вставить картинку из медиа-библиотеки"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="hidden lg:inline">Картинка</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${off}`}
          onClick={onInsertVideo}
          title="Вставить видео из медиа-библиотеки"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="hidden lg:inline">Видео</span>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="hidden lg:inline">Очистить</span>
        </button>
      </div>

      <div className="hidden sm:block w-px h-6 bg-gray-300" />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className="hidden sm:inline">Размер:</span>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className="hidden sm:inline">Интервал:</span>
          <select
            value={lineHeight}
            onChange={(e) => setLineHeight(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1.5">1.5</option>
            <option value="1.75">1.75</option>
            <option value="2">2</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className="hidden sm:inline">Отступ:</span>
          <select
            value={paragraphSpacing}
            onChange={(e) => setParagraphSpacing(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1em">1em</option>
            <option value="1.5em">1.5em</option>
            <option value="2em">2em</option>
          </select>
        </label>
      </div>
    </div>
  );
}