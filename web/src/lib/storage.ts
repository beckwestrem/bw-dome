import type { AppData, UserSettings } from "@/lib/types";
import * as file from "@/lib/storage-file";
import type { DigestSubscriberRow } from "@/lib/storage-pg";
import * as pg from "@/lib/storage-pg";

export type { DigestSubscriberRow };

function postgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function readAppData(ownerId: string): Promise<AppData> {
  if (postgresEnabled()) return pg.readAppDataPg(ownerId);
  return file.readAppDataFile(ownerId);
}

export async function writeAppData(
  ownerId: string,
  next: AppData,
): Promise<void> {
  if (postgresEnabled()) return pg.writeAppDataPg(ownerId, next);
  return file.writeAppDataFile(ownerId, next);
}

export async function updateSettings(
  ownerId: string,
  updates: Partial<UserSettings>,
): Promise<UserSettings> {
  if (postgresEnabled()) {
    const current = await pg.readAppDataPg(ownerId);
    const merged: UserSettings = {
      emailDigestEnabled:
        updates.emailDigestEnabled ?? current.settings.emailDigestEnabled,
      sendTimesLocal:
        updates.sendTimesLocal ?? current.settings.sendTimesLocal,
      digestEmail:
        updates.digestEmail !== undefined
          ? updates.digestEmail
          : current.settings.digestEmail,
      digestFooterNotes:
        updates.digestFooterNotes !== undefined
          ? updates.digestFooterNotes
          : current.settings.digestFooterNotes,
    };
    await pg.updateSettingsPg(ownerId, merged);
    return merged;
  }
  return file.updateSettingsFile(ownerId, updates);
}

export async function listDigestSubscribers(): Promise<DigestSubscriberRow[]> {
  if (!postgresEnabled()) {
    return [];
  }
  return pg.listDigestSubscribersPg();
}
