/** Default categories. Add new ones here; they appear everywhere automatically. */
export const EXPENSE_CATEGORIES = [
  "Food", "Groceries", "Transport", "Rent", "Bills", "Shopping", "Health",
  "Entertainment", "Travel", "Education", "Subscriptions", "Family", "Other",
] as const;
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Interest", "Dividends", "Gift", "Other"] as const;
export const ACCOUNT_TYPES = ["bank", "cash", "card", "wallet"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
