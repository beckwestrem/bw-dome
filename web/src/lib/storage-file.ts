import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AppData, UserSettings } from "@/lib/types";

const dataDir = join(process.cwd(), "data");

function dataPathForOwner(ownerId: string): string {
  const safe = ownerId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(dataDir, `app-data-${safe}.json`);
}

const defaultData = (): AppData => ({
  accounts: [],
  transactions: [],
  settings: {
    emailDigestEnabled: false,
    sendTimesLocal: ["08:00", "18:00"],
    digestEmail: null,
    digestFooterNotes: null,
  },
  ingestions: [],
});

export async function readAppDataFile(ownerId: string): Promise<AppData> {
  const dataPath = dataPathForOwner(ownerId);
  try {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw) as AppData;
  } catch {
    await mkdir(dataDir, { recursive: true });
    const initial = defaultData();
    await writeFile(dataPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

export async function writeAppDataFile(
  ownerId: string,
  next: AppData,
): Promise<void> {
  const dataPath = dataPathForOwner(ownerId);
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataPath, JSON.stringify(next, null, 2), "utf8");
}

export async function updateSettingsFile(
  ownerId: string,
  updates: Partial<UserSettings>,
): Promise<UserSettings> {
  const data = await readAppDataFile(ownerId);
  const merged: UserSettings = {
    emailDigestEnabled:
      updates.emailDigestEnabled ?? data.settings.emailDigestEnabled,
    sendTimesLocal:
      updates.sendTimesLocal ?? data.settings.sendTimesLocal,
    digestEmail:
      updates.digestEmail !== undefined
        ? updates.digestEmail
        : data.settings.digestEmail,
    digestFooterNotes:
      updates.digestFooterNotes !== undefined
        ? updates.digestFooterNotes
        : data.settings.digestFooterNotes,
  };
  await writeAppDataFile(ownerId, { ...data, settings: merged });
  return merged;
}
