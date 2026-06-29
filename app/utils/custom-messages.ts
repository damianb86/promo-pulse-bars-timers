// Custom reusable message snippets. A merchant defines them in the Message tab
// (each can use the campaign's dynamic variables, e.g. {{remaining_amount}}, {{time_left}})
// and places them anywhere in the custom structural HTML via a slot:
//   <span data-cp-slot="custom-<id>"></span>
// The renderer (React preview + storefront) fills the slot with the message,
// interpolating the dynamic variables at render time. Stored as a JSON array on
// CampaignDesign.structureMessages and shipped to the storefront inside the
// serialized `structure.messages`.

export type CustomMessage = {
  id: string;
  text: string;
};

// Slot ids are kept short + url/attribute safe.
const ID_PATTERN = /^[a-z0-9]{1,12}$/;
const SLOT_PREFIX = "custom-";
const MAX_MESSAGES = 20;
const MAX_TEXT_LENGTH = 600;

export function isValidCustomMessageId(id: string): boolean {
  return ID_PATTERN.test(id);
}

// Generates a short, lowercase-alphanumeric id (e.g. "m4f2a9").
export function generateCustomMessageId(): string {
  return `m${Math.random().toString(36).slice(2, 7)}`;
}

export function customMessageSlotName(id: string): string {
  return `${SLOT_PREFIX}${id}`;
}

// Returns the message id when the slot is a custom-message slot, else null.
export function customMessageIdFromSlot(slot: string): string | null {
  if (!slot.startsWith(SLOT_PREFIX)) return null;
  const id = slot.slice(SLOT_PREFIX.length);
  return isValidCustomMessageId(id) ? id : null;
}

// Parses + sanitizes the stored JSON. Drops anything malformed so a bad value
// can never break rendering or persistence.
export function parseCustomMessages(
  value: string | null | undefined,
): CustomMessage[] {
  if (!value || typeof value !== "string") return [];
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const messages: CustomMessage[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const text = String(record.text ?? "").slice(0, MAX_TEXT_LENGTH);
    if (!isValidCustomMessageId(id) || seen.has(id)) continue;
    seen.add(id);
    messages.push({ id, text });
    if (messages.length >= MAX_MESSAGES) break;
  }
  return messages;
}

export function serializeCustomMessages(messages: CustomMessage[]): string {
  return JSON.stringify(parseCustomMessages(JSON.stringify(messages)));
}

// Index messages by id for O(1) lookup during render.
export function customMessagesById(
  messages: CustomMessage[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const message of messages) map[message.id] = message.text;
  return map;
}
