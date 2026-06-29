import { useState } from "react";

import {
  customMessageSlotName,
  generateCustomMessageId,
  type CustomMessage,
} from "../utils/custom-messages";

// Lets the merchant define reusable message snippets (each can use the campaign's
// dynamic variables) and place them anywhere in the custom structural HTML. Each
// message gets a short auto-generated id and a copyable slot tag:
//   <span data-cp-slot="custom-<id>"></span>
export function CustomMessagesEditor({
  value,
  onChange,
}: {
  value: CustomMessage[];
  onChange: (next: CustomMessage[]) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addMessage = () => {
    // Avoid the (astronomically unlikely) id collision.
    let id = generateCustomMessageId();
    const taken = new Set(value.map((message) => message.id));
    while (taken.has(id)) id = generateCustomMessageId();
    onChange([...value, { id, text: "" }]);
  };

  const updateText = (id: string, text: string) => {
    onChange(
      value.map((message) =>
        message.id === id ? { ...message, text } : message,
      ),
    );
  };

  const removeMessage = (id: string) => {
    onChange(value.filter((message) => message.id !== id));
  };

  const copySlot = (id: string) => {
    const tag = `<span data-cp-slot="${customMessageSlotName(id)}"></span>`;
    try {
      navigator.clipboard?.writeText(tag);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        1500,
      );
    } catch {
      // Clipboard not available — the tag is still visible to copy manually.
    }
  };

  return (
    <section className="counterpulse-custom-messages">
      <div className="counterpulse-custom-messages__head">
        <div>
          <p className="counterpulse-design-field-title">Custom messages</p>
          <p className="counterpulse-design-note">
            Create extra reusable texts (they can use the same dynamic variables)
            and place them anywhere in the custom HTML structure with the slot tag
            shown below — for example a second line, a fine-print note, or a label
            next to the timer.
          </p>
        </div>
        <button
          className="counterpulse-button-secondary"
          type="button"
          onClick={addMessage}
        >
          Add message
        </button>
      </div>

      {value.length === 0 ? (
        <p className="counterpulse-design-note counterpulse-custom-messages__empty">
          No custom messages yet. Add one, write its text, then paste its slot tag
          into the Design tab’s “Campaign HTML structure” where you want it to
          appear.
        </p>
      ) : (
        <ul className="counterpulse-custom-messages__list">
          {value.map((message) => {
            const tag = `<span data-cp-slot="${customMessageSlotName(
              message.id,
            )}"></span>`;
            return (
              <li
                key={message.id}
                className="counterpulse-custom-messages__item"
              >
                <div className="counterpulse-custom-messages__item-head">
                  <code className="counterpulse-custom-messages__id">
                    {customMessageSlotName(message.id)}
                  </code>
                  <button
                    aria-label="Remove message"
                    className="counterpulse-custom-messages__remove"
                    type="button"
                    onClick={() => removeMessage(message.id)}
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  aria-label={`Message ${message.id}`}
                  className="counterpulse-custom-messages__text"
                  placeholder="e.g. Order in {{time_left}} for same-day dispatch"
                  rows={2}
                  value={message.text}
                  onChange={(event) =>
                    updateText(message.id, event.target.value)
                  }
                />
                <div className="counterpulse-custom-messages__slot">
                  <code>{tag}</code>
                  <button
                    className="counterpulse-button-secondary counterpulse-custom-messages__copy"
                    type="button"
                    onClick={() => copySlot(message.id)}
                  >
                    {copiedId === message.id ? "Copied" : "Copy slot"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
