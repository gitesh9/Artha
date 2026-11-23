import { queryOptions } from "@tanstack/react-query";
import { listPlanning } from "./functions";
import { getCashflow } from "./cashflow.functions";
export const planningQuery = queryOptions({ queryKey: ["money", "planning"], queryFn: () => listPlanning() });
export const cashflowQuery = queryOptions({ queryKey: ["money", "cashflow"], queryFn: () => getCashflow() });