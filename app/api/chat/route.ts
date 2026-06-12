import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { CHAT_MODEL } from "@/lib/openai";
import { suggestCardSchema } from "@/lib/chat";

export const maxDuration = 60;

const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages, setId }: { messages: UIMessage[]; setId: string } = await req.json();

  const set = await prisma.cardSet.findUnique({
    where: { id: setId },
    include: { cards: { orderBy: { orderIndex: "asc" }, include: { front: true } } },
  });
  if (!set) return new Response("Set not found", { status: 404 });

  const existingCards = set.cards
    .map(
      (c) =>
        `- ${set.showNumbers && c.number != null ? `#${c.number} ` : ""}${c.name} (${c.front.textLayout}${c.front.title ? `, title: "${c.front.title}"` : ""})`,
    )
    .join("\n");

  const system = `You are a creative assistant helping design two-sided playing cards in the style of T.I.M.E Stories: themed decks where every card shares one visual style.

Current card set: "${set.name}"
${set.description ? `Description: ${set.description}` : ""}
Visual style prompt (automatically prepended to every image generation): ${set.stylePrompt || "(not set yet)"}
Card size: ${set.widthMm}x${set.heightMm} mm, portrait.

Existing cards in the set:
${existingCards || "(none yet)"}

Guidelines:
- Whenever you propose a concrete card, CALL the suggest_card tool — once per card. You may call it several times in one reply.
- All card text is rendered BY THE IMAGE MODEL onto the artwork, so keep titles short and body text under ~30 words. Long text will be garbled.
- The imagePrompt should describe the scene and composition only; never repeat the set's style prompt.
- Avoid duplicating existing cards.
${set.showNumbers ? "- Cards in this set are numbered; keep numbering consistent with the existing cards." : "- Cards in this set are NOT numbered; never set the number field."}
- Stay on the set's theme and answer questions about card design, balance, and flavor.`;

  const result = streamText({
    model: provider(CHAT_MODEL),
    system,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      suggest_card: tool({
        description:
          "Propose a concrete card for the set. The user sees the suggestion with buttons to apply it to the current card or create a new card from it.",
        inputSchema: suggestCardSchema,
        execute: async (input) => input,
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
