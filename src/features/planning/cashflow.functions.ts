import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/core/auth/middleware";
import { cashflowAdvice } from "./cashflow-service";
export const getCashflow = createServerFn({ method: "GET" }).middleware([requireUser]).handler(async ({ context }) => {
  const { getDb } = await import("@/core/db/client"), { accountsRepo } = await import("../accounts/repository"), { transactionsRepo } = await import("../transactions/repository"), { planningRepo } = await import("./repository"), { settingsRepo } = await import("../settings/repository"), { getRates,convertMinor } = await import("@/core/integrations/currency"), { minorFactor } = await import("@/shared/money");
  const db=await getDb(), [accounts,nets,records,transactions,settings]=await Promise.all([accountsRepo.list(db,context.userId),transactionsRepo.netByAccount(db,context.userId),planningRepo.list(db,context.userId),transactionsRepo.list(db,context.userId,{},100001),settingsRepo.get(db,context.userId)]);
  if(transactions.length>100000) throw new Error("Cash-reserve guidance exceeds its safe entry limit. No incomplete recommendation is shown.");
  const rates=await getRates(settings.baseCurrency), base=settings.baseCurrency;
  const convert=(value:number,currency:string)=>{const result=convertMinor(value,currency,base,rates,minorFactor);if(result===null)throw new Error(`Exchange rate unavailable for ${currency}. Cash-reserve suggestions are withheld.`);return result;};
  const balances=accounts.map(a=>({id:a.id,name:a.name,currency:base,balanceMinor:convert(a.openingBalanceMinor+(nets.get(a.id)??0),a.currency)}));
  const normalized=records.map(r=>({...r,payload:{...r.payload,currency:base,amountMinor:convert(r.payload.amountMinor,r.payload.currency),penaltyMinor:convert(r.payload.penaltyMinor,r.payload.currency)}}));
  const today=new Date().toISOString().slice(0,10), entries=transactions.map(t=>({...t,currency:base,amountMinor:convert(t.amountMinor,t.currency)}));
  const advice=cashflowAdvice(balances,normalized,entries,base,today);
  advice.alerts = advice.alerts.map(alert => { const bill=records.find(r=>r.id===alert.id), linked=accounts.find(a=>a.id===bill?.payload.accountId); return {...alert,alternatives:accounts.filter(a=>a.id!==linked?.id && a.currency===linked?.currency && convert(a.openingBalanceMinor+(nets.get(a.id)??0),a.currency)>=alert.shortfall).map(a=>a.name)}; });
  const threshold=convert(1000000,"INR");
  return { ...advice,suggestTransfer:!advice.missingHistory&&advice.surplus>threshold,baseCurrency:base,asOf:today,rates:{date:rates.date,source:rates.source??"Frankfurter / ECB",stale:rates.stale??false},accountCount:accounts.length };
});