-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "labelOverlay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overlayCaption" TEXT;
