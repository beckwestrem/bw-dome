/**
 * Resolves where to send the digest for this data owner.
 * Personal builds only send to the explicit Settings digest email.
 */
export async function resolveDigestRecipientEmail(
  _ownerId: string,
  digestEmailOverride: string | null | undefined,
): Promise<string | null> {
  const trimmed = digestEmailOverride?.trim();
  if (trimmed) {
    return trimmed;
  }
  return null;
}
