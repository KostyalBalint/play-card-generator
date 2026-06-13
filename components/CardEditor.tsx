"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCardMeta } from "@/actions/cards";
import { createCustomBack, duplicateAsCustomBack, switchCardBack } from "@/actions/backs";
import { FaceForm } from "./FaceForm";
import { ChatPanel } from "./ChatPanel";
import type { Card, CardSet, FaceDraft, FaceWithImages } from "@/lib/types";
import { draftFromFace } from "@/lib/types";
import type { CardSuggestion } from "@/lib/chat";

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function CardEditor({
  card,
  set,
  front,
  back,
  sharedBacks,
  widthMm,
  heightMm,
}: {
  card: Card;
  set: CardSet;
  front: FaceWithImages;
  /** The face actually used as back: custom, shared, or set default (null = none anywhere) */
  back: FaceWithImages | null;
  sharedBacks: FaceWithImages[];
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"front" | "back">("front");
  const [frontDraft, setFrontDraft] = useState<FaceDraft>(() => draftFromFace(front));

  const backIsCustom = back != null && back.sharedBackSetId === null;
  const backIsShared = back != null && back.sharedBackSetId !== null;
  const usingDefault = card.backFaceId === null;

  function applySuggestion(s: CardSuggestion) {
    setTab("front");
    setFrontDraft({
      textLayout: s.textLayout,
      title: s.title ?? "",
      bodyText: s.bodyText ?? "",
      imagePrompt: s.imagePrompt,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <form
          action={(fd) => updateCardMeta(card.id, fd)}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label className="text-xs font-medium text-zinc-500">
            Name
            <input name="name" defaultValue={card.name} className={`${inputCls} mt-1 block w-48`} />
          </label>
          {set.showNumbers && (
            <label className="text-xs font-medium text-zinc-500">
              Number
              <input
                name="number"
                type="number"
                defaultValue={card.number ?? ""}
                className={`${inputCls} mt-1 block w-20`}
              />
            </label>
          )}
          <label className="text-xs font-medium text-zinc-500">
            Copies in PDF
            <input
              name="copies"
              type="number"
              min={1}
              defaultValue={card.copies}
              className={`${inputCls} mt-1 block w-20`}
            />
          </label>
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Save
          </button>
        </form>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
            {(["front", "back"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize ${
                  tab === t ? "bg-white shadow dark:bg-zinc-700" : "text-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "front" ? (
            <FaceForm
              face={front}
              widthMm={widthMm}
              heightMm={heightMm}
              draft={frontDraft}
              onDraftChange={setFrontDraft}
              backReferenceImageId={back?.activeImageId ?? null}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs font-medium text-zinc-500">Back source:</span>
                <select
                  className={inputCls}
                  value={usingDefault ? "__default" : backIsCustom ? "__custom" : card.backFaceId ?? "__default"}
                  onChange={(e) => {
                    const v = e.target.value;
                    startTransition(async () => {
                      if (v === "__default") await switchCardBack(card.id, null);
                      else if (v === "__custom") {
                        if (back) await duplicateAsCustomBack(card.id, back.id);
                        else await createCustomBack(card.id);
                      } else await switchCardBack(card.id, v);
                      router.refresh();
                    });
                  }}
                >
                  <option value="__default">Set default back</option>
                  {sharedBacks.map((b) => {
                    const base = b.basedOnFaceId
                      ? sharedBacks.find((s) => s.id === b.basedOnFaceId)
                      : null;
                    const label = b.variantLabel
                      ? `${base?.title ?? b.title ?? "Back"} – ${b.variantLabel}`
                      : b.title ?? b.id.slice(0, 6);
                    return (
                      <option key={b.id} value={b.id}>
                        Shared: {label}
                      </option>
                    );
                  })}
                  <option value="__custom">
                    {backIsCustom ? "Custom back (this card only)" : "Customize for this card…"}
                  </option>
                </select>
              </div>

              {back ? (
                <FaceForm
                  key={back.id}
                  face={back}
                  widthMm={widthMm}
                  heightMm={heightMm}
                  readOnly={!backIsCustom}
                  readOnlyNote={
                    backIsShared
                      ? usingDefault
                        ? "This is the set's default back, shared by other cards. Edit it on the set page, or choose “Customize for this card” to make a tweakable copy."
                        : "This is a shared back used by other cards. Edit it on the set page, or choose “Customize for this card” to make a tweakable copy."
                      : undefined
                  }
                />
              ) : (
                <p className="text-sm text-zinc-400">
                  No back design yet — the set has no default back. Pick “Customize for this card” to
                  create one, or add a shared back on the set page.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-[600px] xl:sticky xl:top-4">
        <ChatPanel setId={set.id} showNumbers={set.showNumbers} onApply={applySuggestion} />
      </div>
    </div>
  );
}
