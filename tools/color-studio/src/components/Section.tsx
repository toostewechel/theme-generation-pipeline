import { useState } from "react";
import { Collapsible } from "@base-ui-components/react/collapsible";
import { IconChevron, IconReset } from "./icons.js";

interface SectionProps {
  id: string;
  title: string;
  /** Optional — omit for static groups (e.g. output/display options). */
  description?: string;
  /** Optional — when omitted, no "modified" diamond is shown. */
  modified?: boolean;
  /** Optional — when omitted, no reset affordance is rendered. */
  onReset?: () => void;
  children: React.ReactNode;
}

export function Section({ id, title, description, modified, onReset, children }: SectionProps) {
  const storageKey = `cs-section-${id}`;
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== "false");

  const handleOpen = (next: boolean) => {
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={handleOpen}
      render={<section className="sec" data-open={String(open)} />}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Collapsible.Trigger className="sec-head">
          <IconChevron className="sec-chevron" size={15} />
          <span className="sec-title">{title}</span>
          {modified && <span className="sec-diamond" title="modified from default" />}
        </Collapsible.Trigger>
        {onReset && (
          <button
            className="sec-reset"
            title="Reset section"
            onClick={onReset}
            aria-label={`Reset ${title}`}
          >
            <IconReset size={15} />
          </button>
        )}
      </div>
      {description && <p className="sec-desc">{description}</p>}
      <Collapsible.Panel>
        <div className="sec-body">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
