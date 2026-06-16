import prisma from "../db.server";
import { getOrCreateShopSettings } from "../services/shopSettings.server";

export function getShopByDomain(shopifyDomain: string) {
  return prisma.shop.findUnique({
    where: { shopifyDomain },
  });
}

export async function getOrCreateShopByDomain(shopifyDomain: string) {
  const shop = await prisma.shop.upsert({
    where: { shopifyDomain },
    update: {},
    create: { shopifyDomain },
  });

  await getOrCreateShopSettings(shop.id);

  return shop;
}
