-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "enforceValidation" BOOLEAN NOT NULL DEFAULT true,
    "blockMessage" TEXT NOT NULL DEFAULT 'Only {available} left in stock ??? please reduce the quantity.',
    "defaultBuffer" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "onboardedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "totalOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "buffer" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lowStockThreshold" DECIMAL(18,4),
    "costPerUnit" DECIMAL(18,4),
    "anchorProductId" TEXT,
    "anchorMetafieldId" TEXT,
    "reconcileMode" TEXT NOT NULL DEFAULT 'respectManual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMember" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT,
    "inventoryItemId" TEXT,
    "sku" TEXT,
    "title" TEXT,
    "consumesPerUnit" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "finishedVariantId" TEXT NOT NULL,
    "finishedProductId" TEXT,
    "salePrice" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomComponent" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "poolId" TEXT,
    "variantId" TEXT,
    "qtyPerFinished" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "costPerUnit" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "delta" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopifyEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopId_key" ON "Shop"("shopId");

-- CreateIndex
CREATE INDEX "Pool_shopId_idx" ON "Pool"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_shopId_name_key" ON "Pool"("shopId", "name");

-- CreateIndex
CREATE INDEX "PoolMember_variantId_idx" ON "PoolMember"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMember_poolId_variantId_key" ON "PoolMember"("poolId", "variantId");

-- CreateIndex
CREATE INDEX "Bom_shopId_idx" ON "Bom"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_shopId_finishedVariantId_key" ON "Bom"("shopId", "finishedVariantId");

-- CreateIndex
CREATE INDEX "BomComponent_bomId_idx" ON "BomComponent"("bomId");

-- CreateIndex
CREATE INDEX "BomComponent_poolId_idx" ON "BomComponent"("poolId");

-- CreateIndex
CREATE INDEX "LedgerEntry_shopId_idx" ON "LedgerEntry"("shopId");

-- CreateIndex
CREATE INDEX "LedgerEntry_poolId_idx" ON "LedgerEntry"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_poolId_reason_sourceId_key" ON "LedgerEntry"("poolId", "reason", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_shopifyEventId_key" ON "WebhookEvent"("shopifyEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_shopId_topic_idx" ON "WebhookEvent"("shopId", "topic");

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

