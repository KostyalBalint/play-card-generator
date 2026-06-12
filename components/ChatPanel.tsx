"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createCard } from "@/actions/cards";
import type { CardSuggestion } from "@/lib/chat";

export function ChatPanel({
  setId,
  onApply,
}: {
  setId: string;
  onApply?: (suggestion: CardSuggestion) => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { setId } }),
  });
  const busy = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-800">
        Card assistant
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-400">
            Ask for card ideas, names, flavor text or image prompts — suggestions appear with one-click
            apply buttons.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            {m.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "ml-8 bg-blue-50 dark:bg-blue-950"
                        : "mr-4 bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    {part.text}
                  </div>
                );
              }
              if (part.type === "tool-suggest_card" && "input" in part && part.input) {
                const s = part.input as CardSuggestion;
                if (!s.name) return null;
                return (
                  <div
                    key={i}
                    className="mr-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950"
                  >
                    <div className="font-semibold">
                      {s.number != null ? `#${s.number} ` : ""}
                      {s.name}
                    </div>
                    {s.title && <div className="text-xs">Title: {s.title}</div>}
                    {s.bodyText && <div className="text-xs">Text: {s.bodyText}</div>}
                    {s.imagePrompt && (
                      <div className="mt-1 text-xs text-zinc-500">{s.imagePrompt}</div>
                    )}
                    <div className="mt-2 flex gap-2">
                      {onApply && (
                        <button
                          onClick={() => onApply(s)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                        >
                          Apply to current card
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await createCard(setId, s);
                          router.refresh();
                        }}
                        className="rounded border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300"
                      >
                        Create as new card
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
        {busy && <div className="text-xs text-zinc-400">Thinking…</div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. suggest three clue cards…"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
