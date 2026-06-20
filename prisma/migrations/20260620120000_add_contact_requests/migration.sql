CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ContactRequest_shopId_createdAt_idx" ON "ContactRequest"("shopId", "createdAt");
CREATE INDEX "ContactRequest_shopDomain_createdAt_idx" ON "ContactRequest"("shopDomain", "createdAt");
CREATE INDEX "ContactRequest_type_idx" ON "ContactRequest"("type");
