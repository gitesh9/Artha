import { eq } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { userSettings } from "@/core/db/schema";

export const settingsRepo = {
  async get(db: Db, userId: string) {
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return row ?? { userId, baseCurrency: "INR", updatedAt: new Date() };
  },
  async setBaseCurrency(db: Db, userId: string, baseCurrency: string) {
    await db
      .insert(userSettings)
      .values({ userId, baseCurrency })
      .onConflictDoUpdate({ target: userSettings.userId, set: { baseCurrency, updatedAt: new Date() } });
  },
};
