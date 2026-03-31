-- AlterTable
ALTER TABLE "ChatbotSession" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'ONBOARDING',
ADD COLUMN     "onboardingStep" TEXT NOT NULL DEFAULT 'GREETING';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "preferredLocations" TEXT[],
ADD COLUMN     "preferredRoles" TEXT[];

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatbotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
