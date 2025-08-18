-- CreateTable
CREATE TABLE "public"."EmailToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'READER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_token_key" ON "public"."EmailToken"("token");

-- CreateIndex
CREATE INDEX "EmailToken_email_idx" ON "public"."EmailToken"("email");

-- CreateIndex
CREATE INDEX "EmailToken_expiresAt_idx" ON "public"."EmailToken"("expiresAt");
