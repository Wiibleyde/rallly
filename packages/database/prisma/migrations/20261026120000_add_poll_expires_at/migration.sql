-- AlterTable
ALTER TABLE "polls" ADD COLUMN "expires_at" DATE;

-- CreateIndex
CREATE INDEX "polls_expires_at_idx" ON "polls"("expires_at");
