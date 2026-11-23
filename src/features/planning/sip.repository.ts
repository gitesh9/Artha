import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { financeRecord, transaction } from "@/core/db/schema";
import { atomicWrite } from "@/core/db/atomic.server";
import { accountsRepo } from "../accounts/repository";
import { planningRepo } from "./repository";
import { recordInput, payloadSchema } from "./schema";
import { pairedId } from "../transactions/transfer-service";
import { toMinor } from "@/shared/money";
export async function saveSipPayment(db: Db, userId: string, data: { clientId: string; sipBillId: string; accountId: string; amount: number; occurredOn: string; note?: string | undefined; units?: number | undefined }) {
  const records = await planningRepo.list(db,userId), bill = records.find(r=>r.id===data.sipBillId && r.kind==="bill" && r.payload.subtype==="sip"), holding = records.find(r=>r.id===bill?.payload.linkedId && r.kind==="holding"), account=(await accountsRepo.list(db,userId)).find(a=>a.id===data.accountId);
  if (!bill || !holding || !account || account.currency!==bill.payload.currency || holding.payload.currency!==account.currency || toMinor(data.amount,account.currency)!==bill.payload.amountMinor) throw new Error("SIP payment or linked account/holding is unavailable.");
  if (["stock","mutual-fund"].includes(holding.payload.subtype) && (!data.units || data.units<=0)) throw new Error("Enter the actual units received for this SIP.");
  const flowId=await pairedId(`sip-flow:${data.sipBillId}`), amountMinor=bill.payload.amountMinor;
  const payment={id:data.clientId,userId,accountId:account.id,kind:"expense",amountMinor,currency:account.currency,category:"Investments",note:data.note||null,occurredOn:data.occurredOn};
  const flow=recordInput.parse({id:flowId,kind:"flow",payload:payloadSchema.parse({name:bill.payload.name,currency:account.currency,amountMinor,date:data.occurredOn,linkedId:holding.id,subtype:"buy",quantity:data.units??0,note:"Confirmed linked SIP purchase; valuation remains manual"})});
  const [existing] = await db.select().from(transaction).where(eq(transaction.id,payment.id));
  const [oldFlow] = await db.select().from(financeRecord).where(eq(financeRecord.id,flowId));
  if (existing && (existing.userId!==userId || existing.accountId!==payment.accountId || existing.amountMinor!==amountMinor || existing.kind!=="expense" || existing.currency!==payment.currency || existing.occurredOn!==payment.occurredOn || existing.note!==payment.note)) throw new Error("SIP payment conflicts with an existing entry.");
  if (oldFlow && (oldFlow.userId!==userId || oldFlow.kind!=="flow" || JSON.stringify(recordInput.parse({id:oldFlow.id,kind:oldFlow.kind,payload:oldFlow.payload}).payload)!==JSON.stringify(flow.payload))) throw new Error("SIP purchase conflicts with an existing entry.");
  await atomicWrite(db,tx=>[tx.insert(transaction).values(payment).onConflictDoUpdate({target:transaction.id,set:{amountMinor:sql`case when ${transaction.userId} = excluded.user_id and ${transaction.accountId} = excluded.account_id and ${transaction.kind} = excluded.kind and ${transaction.amountMinor} = excluded.amount_minor and ${transaction.currency} = excluded.currency and ${transaction.occurredOn} = excluded.occurred_on and ${transaction.note} is not distinct from excluded.note then ${transaction.amountMinor} else null end`}}),tx.insert(financeRecord).values({id:flow.id,userId,kind:"flow",payload:flow.payload}).onConflictDoUpdate({target:financeRecord.id,set:{userId:sql`case when ${financeRecord.userId} = excluded.user_id and ${financeRecord.kind} = excluded.kind and ${financeRecord.payload} = excluded.payload then ${financeRecord.userId} else null end`}})]);
  const saved=await db.select().from(financeRecord).where(and(eq(financeRecord.userId,userId),inArray(financeRecord.id,[flowId])));
  if (saved.length!==1) throw new Error("SIP purchase not acknowledged. Retry with the same identifier.");
  return {ok:true};
}