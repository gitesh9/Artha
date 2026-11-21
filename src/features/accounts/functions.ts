import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { CURRENCIES, toMinor } from "@/shared/money";
import { ACCOUNT_TYPES } from "@/shared/categories";

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { getDb } = await import("@/core/db/client");
    const { accountsRepo } = await import("./repository");
    const { transactionsRepo } = await import("../transactions/repository");
    const db = await getDb();
    const [accounts, sums] = await Promise.all([
      accountsRepo.list(db, context.userId),
      transactionsRepo.netByAccount(db, context.userId),
    ]);
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balanceMinor: a.openingBalanceMinor + (sums.get(a.id) ?? 0),
    }));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(60),
      type: z.enum(ACCOUNT_TYPES),
      currency: z.enum(CURRENCIES),
      openingBalance: z.number().finite(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { accountsRepo } = await import("./repository");
    await accountsRepo.create(await getDb(), {
      id: crypto.randomUUID(),
      userId: context.userId,
      name: data.name,
      type: data.type,
      currency: data.currency,
      openingBalanceMinor: toMinor(data.openingBalance, data.currency),
    });
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { accountsRepo } = await import("./repository");
    await accountsRepo.remove(await getDb(), context.userId, data.id);
    return { ok: true };
  });
