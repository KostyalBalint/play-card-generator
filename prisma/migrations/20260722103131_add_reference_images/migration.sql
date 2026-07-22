-- CreateTable
CREATE TABLE "ReferenceImage" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReferenceImage" ADD CONSTRAINT "ReferenceImage_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
