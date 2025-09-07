-- CreateTable
CREATE TABLE "public"."GuestBan" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT,
    "email" TEXT,
    "reason" TEXT,
    "until" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestBan_ipHash_key" ON "public"."GuestBan"("ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "GuestBan_email_key" ON "public"."GuestBan"("email");

-- CreateIndex
CREATE INDEX "GuestBan_until_idx" ON "public"."GuestBan"("until");

-- AddForeignKey
ALTER TABLE "public"."GuestBan" ADD CONSTRAINT "GuestBan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
