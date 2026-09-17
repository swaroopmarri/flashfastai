"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { createClient } from "@/utils/supabase/client";

// Emails get flagged as spam far more easily when they carry large images,
// and Gmail clips any message over ~102KB (pushing the rest behind a "view
// entire message" link) -- so every pasted image is downscaled and
// re-encoded before it ever reaches storage, keeping the email itself small
// regardless of what the user copied.
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.72;
const BUCKET = "campaign-images";

function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image."));
    };
    img.src = objectUrl ?? (source as string);
  });
}

async function compressImage(source: File | Blob | string): Promise<Blob> {
  const img = await loadImageElement(source);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function uploadImage(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function replaceImageSrc(editor: Editor, oldSrc: string, newSrc: string) {
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === oldSrc) {
      editor.view.dispatch(
        editor.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: newSrc }),
      );
      return false;
    }
    return true;
  });
}

export function RichTextEditor({
  content,
  onChange,
  onUploadingChange,
  userId,
}: {
  content: string;
  onChange: (html: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  userId: string;
}) {
  const [uploading, setUploadingState] = useState(0);
  const setUploading = (updater: (n: number) => number) => {
    setUploadingState((n) => {
      const next = updater(n);
      onUploadingChange?.(next > 0);
      return next;
    });
  };
  const [uploadError, setUploadError] = useState<string | null>(null);
  const processingSrcs = useRef<Set<string>>(new Set());

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "min-h-[16rem] max-w-none rounded-b-md border border-t-0 border-gray-300 px-3 py-2 text-sm focus:outline-none prose prose-sm prose-table:border prose-td:border prose-th:border",
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            const pos = view.state.selection.from;
            void handleImageBlob(file, pos);
            return true;
          }
        }
        // Anything else (formatted text, an Excel/Outlook table, etc.) falls
        // through to TipTap's default HTML paste handling, which is what
        // turns a pasted spreadsheet range into a real <table>.
        return false;
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      scanForEmbeddedImages(editor);
    },
    immediatelyRender: false,
  });

  async function handleImageBlob(file: File | Blob, insertPos: number) {
    setUploadError(null);
    setUploading((n) => n + 1);
    try {
      const compressed = await compressImage(file);
      const url = await uploadImage(userId, compressed);
      editor?.chain().focus().insertContentAt(insertPos, { type: "image", attrs: { src: url } }).run();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not upload image.");
    } finally {
      setUploading((n) => n - 1);
    }
  }

  // Rich-text paste (e.g. from Outlook/Word) can carry images inline as
  // base64 data URLs rather than as separate clipboard files -- those need
  // the same downscale-and-host treatment, or the saved campaign body ends
  // up with megabytes of inline data driving the same spam/clipping risk
  // the file-paste path exists to avoid.
  function scanForEmbeddedImages(editor: Editor) {
    const found: string[] = [];
    editor.state.doc.descendants((node) => {
      const src = node.attrs?.src as string | undefined;
      if (node.type.name === "image" && src?.startsWith("data:") && !processingSrcs.current.has(src)) {
        found.push(src);
      }
    });
    for (const src of found) {
      processingSrcs.current.add(src);
      setUploading((n) => n + 1);
      (async () => {
        try {
          const compressed = await compressImage(src);
          const url = await uploadImage(userId, compressed);
          replaceImageSrc(editor, src, url);
        } catch (e) {
          setUploadError(e instanceof Error ? e.message : "Could not upload a pasted image.");
        } finally {
          setUploading((n) => n - 1);
        }
      })();
    }
  }

  // Keep the editor in sync if the parent resets `content` out from under
  // it (e.g. loading a different campaign) without fighting the user's
  // in-progress typing on every keystroke.
  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-gray-300 bg-gray-50 px-2 py-1">
        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")}>
          B
        </ToolbarButton>
        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")}>
          List
        </ToolbarButton>
        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")}>
          1. List
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() =>
            editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          + Table
        </ToolbarButton>
        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
          Clear format
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      {uploading > 0 && (
        <p className="mt-1 text-xs text-indigo-600">Uploading image…</p>
      )}
      {uploadError && (
        <p className="mt-1 text-xs text-red-600">{uploadError}</p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Paste an image or a table (e.g. from Excel) directly into the body. Images are
        automatically resized to keep the email small. An unsubscribe link is added
        automatically.
      </p>
    </div>
  );
}

function ToolbarButton({
  editor,
  onClick,
  active,
  children,
}: {
  editor: Editor | null;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={!editor}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium ${
        active ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-200"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
