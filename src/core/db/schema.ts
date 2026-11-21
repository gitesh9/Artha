/**
 * Single source of truth for the database schema (Drizzle ORM, Postgres).
 * Auth tables follow Better Auth's expected shape; app tables are below.
 * After editing: `bun run db:generate` then `bun run db:migrate` (see ARCHITECTURE.md).
 */
import { pgTable, text, timestamp, boolean, bigint, date, index, uniqueIndex } from "drizzle-orm/pg-core";

// ---------- Auth (Better Auth) ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---------- App ----------
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  baseCurrency: text("base_currency").notNull().default("INR"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Money accounts: bank, cash, card, wallet. Amounts are integer minor units (paise/cents). */
export const moneyAccount = pgTable(
  "money_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // AccountType
    currency: text("currency").notNull(),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("money_account_user_idx").on(t.userId)],
);

export const transaction = pgTable(
  "transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().references(() => moneyAccount.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "income" | "expense"
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    category: text("category").notNull(),
    note: text("note"),
    occurredOn: date("occurred_on").notNull(), // YYYY-MM-DD
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("transaction_user_date_idx").on(t.userId, t.occurredOn)],
);

/** Monthly budget per category, in the user's base currency. */
export const budget = pgTable(
  "budget",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    monthlyLimitMinor: bigint("monthly_limit_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_user_category_uq").on(t.userId, t.category)],
);
