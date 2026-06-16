import { Form } from "react-router";

import type { OnboardingChecklistField } from "../types/onboarding";

export type OnboardingChecklistItem = {
  label: string;
  completed: boolean;
  description?: string;
  manualField?: OnboardingChecklistField;
};

type OnboardingChecklistProps = {
  items: OnboardingChecklistItem[];
  actionPath?: string;
};

export function OnboardingChecklist({
  items,
  actionPath,
}: OnboardingChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;

  return (
    <s-section
      heading={`Onboarding checklist (${completedCount}/${items.length})`}
    >
      <div className="counterpulse-checklist">
        {items.map((item) => (
          <div className="counterpulse-checklist__item" key={item.label}>
            <span
              aria-hidden="true"
              className={
                item.completed
                  ? "counterpulse-checklist__marker counterpulse-checklist__marker--complete"
                  : "counterpulse-checklist__marker"
              }
            >
              {item.completed ? "✓" : ""}
            </span>
            <div className="counterpulse-checklist__content">
              <div className="counterpulse-checklist__label">{item.label}</div>
              {item.description && (
                <div className="counterpulse-checklist__description">
                  {item.description}
                </div>
              )}
            </div>
            {item.manualField && (
              <Form
                action={actionPath}
                className="counterpulse-checklist__action"
                method="post"
              >
                <input name="intent" type="hidden" value="updateChecklist" />
                <input name="field" type="hidden" value={item.manualField} />
                <input
                  name="value"
                  type="hidden"
                  value={item.completed ? "false" : "true"}
                />
                <button className="counterpulse-button-secondary" type="submit">
                  {item.completed ? "Mark not done" : "Mark done"}
                </button>
              </Form>
            )}
          </div>
        ))}
      </div>
    </s-section>
  );
}
