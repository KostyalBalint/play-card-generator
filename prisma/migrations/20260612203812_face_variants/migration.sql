-- AlterTable
ALTER TABLE "CardFace" ADD COLUMN     "basedOnFaceId" TEXT,
ADD COLUMN     "variantLabel" TEXT;

-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "sourceImageId" TEXT;

-- AddForeignKey
ALTER TABLE "CardFace" ADD CONSTRAINT "CardFace_basedOnFaceId_fkey" FOREIGN KEY ("basedOnFaceId") REFERENCES "CardFace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
