-- CreateTable
CREATE TABLE "public"."EmailLog" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "ipHash" TEXT,
    "type" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_email_idx" ON "public"."EmailLog"("email");

-- CreateIndex
CREATE INDEX "EmailLog_ipHash_idx" ON "public"."EmailLog"("ipHash");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "public"."EmailLog"("type");
