import { createContext, useContext, useState, type ReactNode } from "react";
import type { z } from "zod";
import type { navigationSchema } from "@/features/assistant/service";
type Draft = z.infer<typeof navigationSchema>;
const Context = createContext<{ draft: Draft | null; setDraft: (v: Draft | null) => void }>({ draft: null, setDraft: () => {} });
export const useDraft = () => useContext(Context);
export function DraftProvider({ children }: { children: ReactNode }) { const [draft, setDraft] = useState<Draft | null>(null); return <Context.Provider value={{ draft, setDraft }}>{children}</Context.Provider>; }