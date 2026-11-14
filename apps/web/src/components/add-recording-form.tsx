"use client";

import { useState, useTransition } from "react";
import { type AddRecordingActionResult, addRecordingAction } from "@/app/[lang]/songs/[slug]/recording-actions";

export interface AddRecordingLabels {
  readonly title: string;
  readonly placeholder: string;
  readonly submit: string;
  readonly added: string;
  readonly login: string;
  readonly invalid: string;
  readonly notFound: string;
  readonly duplicate: string;
  readonly unexpected: string;
}

function messageFor(result: AddRecordingActionResult, labels: AddRecordingLabels): string {
  if (result.ok) return labels.added;
  switch (result.code) {
    case "login":
      return labels.login;
    case "invalid_recording_url":
    case "required":
      return labels.invalid;
    case "recording_not_found":
      return labels.notFound;
    case "duplicate_recording":
      return labels.duplicate;
    default:
      return labels.unexpected;
  }
}

/** Paste a YouTube or Spotify link to add it to the song. */
export function AddRecordingForm({ songSlug, labels }: { songSlug: string; labels: AddRecordingLabels }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await addRecordingAction(songSlug, url);
      setMessage({ text: messageFor(result, labels), ok: result.ok });
      if (result.ok) setUrl("");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
      <label htmlFor="add-recording" className="eyebrow block">
        {labels.title}
      </label>
      <div className="flex gap-2">
        <input
          id="add-recording"
          type="url"
          inputMode="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={labels.placeholder}
          className="input min-w-0 flex-1 text-sm"
        />
        <button type="submit" className="btn-secondary min-h-10 shrink-0 px-3 text-sm" disabled={pending}>
          {labels.submit}
        </button>
      </div>
      {message && (
        <p role="status" className={`text-xs ${message.ok ? "text-secondary" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
