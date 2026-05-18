export type SourceType = "csv_upload" | "mcp";

export type Account = {
  id: string;
  name: string;
  /** `customer` = business/customer account; legacy bank/investment/credit still supported. */
  type: "customer" | "bank" | "investment" | "credit" | "other";
  /** Primary sort metric for prioritization. */
  balance: number;
  currency: string;
  sourceType: SourceType;
  sourceRef: string;
  updatedAt: string;
  /** Business dashboard columns (stage, tickets, summary, etc.). */
  metadata?: Record<string, string>;
};

export type Transaction = {
  id: string;
  accountId: string;
  postedAt: string;
  description: string;
  amount: number;
};

export type ActionItem = {
  id: string;
  title: string;
  why: string;
  nextStep: string;
  priority: "high" | "medium" | "low";
};

export type UserSettings = {
  emailDigestEnabled: boolean;
  sendTimesLocal: [string, string];
  /**
   * Recipient for the twice-daily digest. Personal builds require this setting.
   */
  digestEmail?: string | null;
  /**
   * Appended to the digest as personal notes and fed to the stakeholder summary
   * generator for context the export cannot infer.
   */
  digestFooterNotes?: string | null;
};

export type AppData = {
  accounts: Account[];
  transactions: Transaction[];
  settings: UserSettings;
  ingestions: { id: string; sourceType: SourceType; createdAt: string }[];
};
