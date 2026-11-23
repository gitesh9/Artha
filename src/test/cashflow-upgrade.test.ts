// @vitest-environment node
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { saveTransfer } from "@/features/transactions/transfers.repository";
import { transactionsRepo } from "@/features/transactions/repository";
import { summarize } from "@/features/analytics/service";
import { transactionTags, taggedNote } from "@/features/transactions/tags";
import { DEFAULT_PAYMENT_CHOICE, paymentShortfall, cashflowAdvice } from "@/features/planning/cashflow-service";
import { planningRepo } from "@/features/planning/repository";
import { closeSalary } from "@/features/planning/salary.repository";
import { saveSipPayment } from "@/features/planning/sip.repository";
import { closeBill } from "@/features/planning/bills.repository";
import { recordInput } from "@/features/planning/schema";
import { portfolio } from "@/features/planning/service";
import { googleConfigured } from "@/core/auth/google-policy";
it("tags support hospital and maintenance totals without losing notes", () => {
  expect(transactionTags(taggedNote("Apollo visit #Hospital", "hospital, car-maintenance"))).toEqual(["hospital", "car-maintenance"]);
  expect(() => taggedNote("a".repeat(200), "hospital")).toThrow("200");
});
it("obligations default not paid and calculate the exact linked-account shortfall", () => {
  expect(DEFAULT_PAYMENT_CHOICE).toBe("unpaid");
  expect(paymentShortfall(50000, 200000)).toBe(150000);
  expect(paymentShortfall(250000, 200000)).toBe(0);
});
it("reserve advice subtracts next 30 days of bills and a 15-day spending buffer across accounts", () => {
  const bill=recordInput.parse({id:crypto.randomUUID(),kind:"bill",payload:{name:"EMI",currency:"INR",amountMinor:200000,date:"2026-11-25",accountId:"salary"}});
  const result=cashflowAdvice([{id:"salary",name:"Salary",currency:"INR",balanceMinor:50000},{id:"savings",name:"Savings",currency:"INR",balanceMinor:2000000}],[bill],[{kind:"expense",currency:"INR",amountMinor:300000,occurredOn:"2026-11-01"}],"INR","2026-11-23");
  expect(result).toMatchObject({balance:2050000,obligations:200000,buffer:150000,surplus:1700000,suggestTransfer:true,emergencyMin:900000,emergencyMax:1800000});
  expect(result.alerts[0]).toMatchObject({shortfall:150000,alternatives:["Savings"]});
});
it("no expense history and placeholder Google credentials do not claim availability", () => {
  expect(cashflowAdvice([{id:"a",name:"A",currency:"INR",balanceMinor:3000000}],[],[],"INR","2026-11-23").suggestTransfer).toBe(false);
  expect(googleConfigured("dummy", "dummy-secret")).toBe(false);
  expect(googleConfigured("client.apps.googleusercontent.com", "replace-with-secret")).toBe(false);
  expect(googleConfigured("client.apps.googleusercontent.com", "GOCSPX-valid-test-secret")).toBe(true);
});
it("transfers are atomic, retry-safe, user-scoped and neutral in income/expense reports", async () => {
  const pg=new PGlite(), actual=drizzle(pg,{schema}); await migrate(actual,{migrationsFolder:"./drizzle"}); const db=actual as unknown as Db;
  try {
    await actual.insert(schema.user).values([{id:"owner",name:"Owner",email:"transfer-owner@example.test"},{id:"other",name:"Other",email:"transfer-other@example.test"}]);
    await actual.insert(schema.moneyAccount).values([{id:"salary",userId:"owner",name:"Salary",type:"bank",currency:"INR",openingBalanceMinor:1000000},{id:"savings",userId:"owner",name:"Savings",type:"bank",currency:"INR"},{id:"private",userId:"other",name:"Private",type:"bank",currency:"INR"}]);
    const data={clientId:crypto.randomUUID(),accountId:"salary",destinationId:"savings",amount:2000,occurredOn:"2026-11-23"};
    await saveTransfer(db,"owner",data); await saveTransfer(db,"owner",data);
    const rows=await transactionsRepo.list(db,"owner",{}), nets=await transactionsRepo.netByAccount(db,"owner");
    expect(rows.length).toBe(2);expect(nets.get("salary")).toBe(-200000);expect(nets.get("savings")).toBe(200000);expect(summarize(rows)).toMatchObject({income:0,expense:0,net:0});
    await expect(saveTransfer(db,"owner",{...data,destinationId:"private"})).rejects.toThrow("unavailable");
    await expect(saveTransfer(db,"owner",{...data,amount:3000})).rejects.toThrow("conflicts");
    expect((await transactionsRepo.list(db,"owner",{})).length).toBe(2);
  } finally {await pg.close();}
},30000);
it("salary changes balances only after an acknowledged credit and schedules next month once", async () => {
  const pg=new PGlite(), actual=drizzle(pg,{schema}); await migrate(actual,{migrationsFolder:"./drizzle"});const db=actual as unknown as Db;
  try {
    await actual.insert(schema.user).values({id:"owner",name:"Owner",email:"salary-owner@example.test"});await actual.insert(schema.moneyAccount).values({id:"bank",userId:"owner",name:"Bank",type:"bank",currency:"INR"});
    const salary=recordInput.parse({id:crypto.randomUUID(),kind:"salary",payload:{name:"Employer",currency:"INR",amountMinor:5000000,date:"2026-11-30",accountId:"bank",subtype:"monthly"}});await planningRepo.save(db,"owner",salary);
    expect((await transactionsRepo.netByAccount(db,"owner")).size).toBe(0); await expect(closeSalary(db,"owner",salary.id)).rejects.toThrow("acknowledged");
    await actual.insert(schema.transaction).values({id:salary.id,userId:"owner",accountId:"bank",kind:"income",amountMinor:5000000,currency:"INR",category:"Salary",occurredOn:"2026-11-30"});
    await closeSalary(db,"owner",salary.id);await closeSalary(db,"owner",salary.id);
    const rows=await planningRepo.list(db,"owner");expect(rows.length).toBe(2);expect(rows.find(r=>r.id!==salary.id)?.payload).toMatchObject({date:"2026-12-30",paid:false});expect((await transactionsRepo.netByAccount(db,"owner")).get("bank")).toBe(5000000);
  } finally {await pg.close();}
},30000);
it("linked SIP saves a single bank payment and actual units, then schedules the next unpaid purchase",async()=>{
  const pg=new PGlite(),actual=drizzle(pg,{schema});await migrate(actual,{migrationsFolder:"./drizzle"});const db=actual as unknown as Db;
  try {
    await actual.insert(schema.user).values({id:"owner",name:"Owner",email:"sip-owner@example.test"});await actual.insert(schema.moneyAccount).values({id:"bank",userId:"owner",name:"Bank",type:"bank",currency:"INR",openingBalanceMinor:1000000});
    const holding=recordInput.parse({id:crypto.randomUUID(),kind:"holding",payload:{name:"MF",currency:"INR",amountMinor:0,valueMinor:0,date:"2026-11-01",subtype:"mutual-fund"}});await planningRepo.save(db,"owner",holding);
    const bill=recordInput.parse({id:crypto.randomUUID(),kind:"bill",payload:{name:"Monthly SIP",currency:"INR",amountMinor:200000,date:"2026-11-23",subtype:"sip",accountId:"bank",linkedId:holding.id}});await planningRepo.save(db,"owner",bill);
    const data={clientId:bill.id,sipBillId:bill.id,accountId:"bank",amount:2000,occurredOn:"2026-11-23",units:20};await expect(saveSipPayment(db,"other",data)).rejects.toThrow("unavailable");await expect(saveSipPayment(db,"owner",{...data,units:0})).rejects.toThrow("units");
    await saveSipPayment(db,"owner",data);await saveSipPayment(db,"owner",data);await closeBill(db,"owner",bill.id);
    const records=await planningRepo.list(db,"owner");expect(records.filter(r=>r.kind==="flow").length).toBe(1);expect(portfolio(holding,records)).toMatchObject({cost:200000,quantity:20,valuationStale:true});expect((await transactionsRepo.list(db,"owner",{})).length).toBe(1);expect(records.find(r=>r.kind==="bill"&&r.id!==bill.id)?.payload).toMatchObject({date:"2026-12-23",paid:false});
  } finally {await pg.close();}
},30000);