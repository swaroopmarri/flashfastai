"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateCampaignContent } from "../../actions";
import { RichTextEditor } from "./RichTextEditor";
import { registerIdleAutosave } from "@/lib/idleAutosave";

export function ComposeForm({
  campaignId,
  initialSubject,
  initialBody,
  initialReplyTo,
  ownEmail,
  userId,
}: {
  campaignId: string;
  initialSubject: string;
  initialBody: string;
  initialReplyTo: string;
  ownEmail: string;
  userId: string;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [replyTo, setReplyTo] = useState(initialReplyTo);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  function markDirty() {
    setSaved(false);
  }

  async function save() {
    await updateCampaignContent(campaignId, subject, body, replyTo);
    setSaved(true);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await save();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  // Registered once so the 30-minute idle logout can save an in-progress
  // draft before it signs the user out -- reads the latest values via a
  // ref rather than re-registering (and thrashing the shared callback set)
  // on every keystroke.
  const latestRef = useRef({ subject, body, replyTo, saved, uploadingImage });
  latestRef.current = { subject, body, replyTo, saved, uploadingImage };

  useEffect(() => {
    return registerIdleAutosave(async () => {
      const current = latestRef.current;
      if (current.saved || current.uploadingImage) return;
      try {
        await updateCampaignContent(campaignId, current.subject, current.body, current.replyTo);
      } catch {
        // Best-effort: a failed autosave shouldn't block the idle sign-out.
      }
    });
  }, [campaignId]);

  const isBodyEmpty = !body.replace(/<[^>]+>/g, "").trim();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              markDirty();
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Body</label>
          <div className="mt-1">
            <RichTextEditor
              content={body}
              userId={userId}
              onChange={(html) => {
                setBody(html);
                markDirty();
              }}
              onUploadingChange={setUploadingImage}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reply-to" className="block text-sm font-medium text-gray-700">
            Reply-To{" "}
            <span className="font-normal text-gray-400">(optional override)</span>
          </label>
          <input
            id="reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => {
              setReplyTo(e.target.value);
              markDirty();
            }}
            placeholder={ownEmail}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Replies go to {replyTo.trim() || ownEmail} unless you set something else here.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={isPending || saved || uploadingImage}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploadingImage
            ? "Uploading image..."
            : isPending
              ? "Saving..."
              : saved
                ? "Saved"
                : "Save draft"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Live preview</p>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs text-gray-400">Subject</p>
          <p className="mb-4 font-medium text-gray-900">{subject || "(no subject)"}</p>
          <p className="mb-1 text-xs text-gray-400">Body</p>
          {!isBodyEmpty ? (
            <div
              className="prose prose-sm max-w-none text-sm text-gray-800"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-sm text-gray-400">(no body)</p>
          )}
          <hr className="my-3 border-gray-100" />
          <p className="text-xs text-gray-400">
            Don&apos;t want these emails?{" "}
            <span className="underline">Unsubscribe</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
