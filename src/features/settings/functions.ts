import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { CURRENCIES } from "@/shared/money";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/core/db/client");
    const { settingsRepo } = await import("./repository");
    const { getRates } = await import("@/core/integrations/currency");
    const s = await settingsRepo.get(await getDb(), context.userId);
    const rates = await getRates(s.baseCurrency);
    return { baseCurrency: s.baseCurrency, rates };
  });

export const updateBaseCurrency = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({ baseCurrency: z.enum(CURRENCIES) }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { settingsRepo } = await import("./repository");
    await settingsRepo.setBaseCurrency(await getDb(), context.userId, data.baseCurrency);
    return { ok: true };
  });
