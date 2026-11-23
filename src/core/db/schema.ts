/**
 * Single source of truth for the database schema (Drizzle ORM, Postgres).
 * Auth tables follow Better Auth's expected shape; app tables are below.
 * After editing: `bun run db:generate` then `bun run db:migrate` (see ARCHITECTURE.md).
 */
import { pgTable, text, timestamp, boolean, bigint, date, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

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
    kind: text("kind").notNull(), // income, expense, transfer_in, transfer_out
    transferId: text("transfer_id"), // paired internal movements; never report as earnings/spending
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

/** Versioned, validated planning records. Payload contracts live in features/planning/schema.ts. */
export const financeRecord = pgTable("finance_record", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("finance_record_user_kind_idx").on(t.userId, t.kind)]);

export const fxSnapshot = pgTable("fx_snapshot", {
  base: text("base").primaryKey(),
  rateDate: date("rate_date").notNull(),
  rates: jsonb("rates").$type<Record<string, number>>().notNull(),
  refreshedAt: timestamp("refreshed_at").notNull().defaultNow(),
});

export const pushSubscription = pgTable("push_subscription", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  subscription: jsonb("subscription").notNull(),
  lastSentOn: date("last_sent_on"),
});

export const sharedGroup = pgTable("shared_group", { id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }), name: text("name").notNull(), currency: text("currency").notNull() });
export const groupMember = pgTable("group_member", { id: text("id").primaryKey(), groupId: text("group_id").notNull().references(() => sharedGroup.id, { onDelete: "cascade" }), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), approved: boolean("approved").notNull().default(false) }, t => [uniqueIndex("group_member_group_user_uq").on(t.groupId, t.userId)]);
export const groupInvite = pgTable("group_invite", { tokenHash: text("token_hash").primaryKey(), groupId: text("group_id").notNull().references(() => sharedGroup.id, { onDelete: "cascade" }), expiresAt: timestamp("expires_at").notNull() });
export const groupEntry = pgTable("group_entry", { id: text("id").primaryKey(), groupId: text("group_id").notNull().references(() => sharedGroup.id, { onDelete: "cascade" }), createdBy: text("created_by").notNull().references(() => user.id), kind: text("kind").notNull(), payload: jsonb("payload").notNull(), createdAt: timestamp("created_at").notNull().defaultNow() });
