/**
 * Condensed business operations context for LLM system prompts.
 *
 * Keep this block reasonably short. Expand only when prompts allow.
 */
export const BUSINESS_LLM_CONTEXT = `
Business operations context (priorities — never invent facts missing from data):
- Treat the upload as a snapshot of accounts, customers, opportunities, tasks, and recent activity.
- Prioritize rows with open tasks, stale updates, urgent status wording, large dollar values, or clear next-step blockers.
- Distinguish facts from assumptions. If the export does not show ownership, timing, completion, or escalation details, say that clearly.
- Use plain business language: customers, accounts, work items, follow-ups, blockers, revenue, pipeline, delivery, operations, and next steps.
- Avoid industry-specific terms unless they appear directly in the uploaded data.
`.trim();
