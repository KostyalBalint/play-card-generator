-- CreateEnum
CREATE TYPE "SizePreset" AS ENUM ('POKER', 'TAROT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TextLayout" AS ENUM ('NONE', 'TITLE_BANNER', 'TEXT_BOX');

-- CreateEnum
CREATE TYPE "GenStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stylePrompt" TEXT NOT NULL,
    "sizePreset" "SizePreset" NOT NULL DEFAULT 'TAROT',
    "widthMm" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "heightMm" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "defaultBackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "frontFaceId" TEXT NOT NULL,
    "backFaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardFace" (
    "id" TEXT NOT NULL,
    "textLayout" "TextLayout" NOT NULL DEFAULT 'TITLE_BANNER',
    "title" TEXT,
    "bodyText" TEXT,
    "imagePrompt" TEXT,
    "activeImageId" TEXT,
    "sharedBackSetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardFace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "faceId" TEXT NOT NULL,
    "status" "GenStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedPrompt" TEXT NOT NULL,
    "filePath" TEXT,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_frontFaceId_key" ON "Card"("frontFaceId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_frontFaceId_fkey" FOREIGN KEY ("frontFaceId") REFERENCES "CardFace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_backFaceId_fkey" FOREIGN KEY ("backFaceId") REFERENCES "CardFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardFace" ADD CONSTRAINT "CardFace_sharedBackSetId_fkey" FOREIGN KEY ("sharedBackSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_faceId_fkey" FOREIGN KEY ("faceId") REFERENCES "CardFace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
