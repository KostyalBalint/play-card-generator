// One-off smoke-test seed: creates a demo set with two cards and a shared default back.
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
const set = await prisma.cardSet.create({
  data: {
    name: "Noir Mystery (demo)",
    description: "Smoke-test set",
    stylePrompt:
      "1920s film noir illustration, muted sepia and teal palette, dramatic chiaroscuro lighting, vintage pulp magazine art style with subtle film grain",
    sizePreset: "TAROT",
    widthMm: 70,
    heightMm: 120,
  },
});

const back = await prisma.cardFace.create({
  data: {
    sharedBackSetId: set.id,
    textLayout: "TITLE_BANNER",
    title: "NOIR",
    imagePrompt:
      "Ornate symmetrical card back design with an art-deco magnifying glass motif in the center, geometric border",
  },
});
await prisma.cardSet.update({ where: { id: set.id }, data: { defaultBackId: back.id } });

await prisma.card.create({
  data: {
    set: { connect: { id: set.id } },
    name: "The Detective",
    number: 1,
    orderIndex: 0,
    front: {
      create: {
        textLayout: "TITLE_BANNER",
        title: "The Detective",
        imagePrompt:
          "A weary private detective in a trench coat and fedora standing under a flickering streetlamp in the rain",
      },
    },
  },
});

await prisma.card.create({
  data: {
    set: { connect: { id: set.id } },
    name: "Smoking Gun",
    number: 2,
    orderIndex: 1,
    copies: 2,
    front: {
      create: {
        textLayout: "TEXT_BOX",
        title: "Smoking Gun",
        bodyText: "A revolver, still warm. One bullet missing.",
        imagePrompt: "A revolver lying on a mahogany desk next to scattered case files, wisps of smoke",
      },
    },
  },
});

const faces = await prisma.cardFace.findMany({ select: { id: true, title: true } });
console.log(JSON.stringify({ setId: set.id, backId: back.id, faces }, null, 2));
await prisma.$disconnect();
}

main();
