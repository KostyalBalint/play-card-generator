-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "mapId" TEXT;

-- CreateTable
CREATE TABLE "Map" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "masterId" TEXT,
    "backId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Map_masterId_key" ON "Map"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "Map_backId_key" ON "Map"("backId");

-- AddForeignKey
ALTER TABLE "Map" ADD CONSTRAINT "Map_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Map" ADD CONSTRAINT "Map_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "CardFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Map" ADD CONSTRAINT "Map_backId_fkey" FOREIGN KEY ("backId") REFERENCES "CardFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
