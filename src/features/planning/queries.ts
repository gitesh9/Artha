import { queryOptions } from "@tanstack/react-query";
import { listPlanning } from "./functions";
export const planningQuery = queryOptions({ queryKey: ["money", "planning"], queryFn: () => listPlanning() });