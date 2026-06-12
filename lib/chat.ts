import { z } from "zod";

export const suggestCardSchema = z.object({
  name: z.string().describe("Short card name"),
  number: z.number().int().optional().describe("TimeStories-style card number, if relevant"),
  textLayout: z.enum(["NONE", "TITLE_BANNER", "TEXT_BOX"]),
  title: z.string().optional().describe("Title rendered on the card image. Keep short."),
  bodyText: z
    .string()
    .optional()
    .describe("Body text rendered on the card image. Max ~30 words, image models garble long text."),
  imagePrompt: z
    .string()
    .describe("Scene/art description for the image generator. No style words — the set style is added automatically."),
});

export type CardSuggestion = z.infer<typeof suggestCardSchema>;
