import { useState } from "react";
import { PanelSection } from "@ui";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  modified?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}

export function Section({ id, title, description, modified, onReset, children }: SectionProps) {
  const storageKey = `cs-tc-section-${id}`;
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );

  const handleCollapsed = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(storageKey, String(next));
  };

  const action = (
    <span className="inline-flex items-center gap-1.5">
      {modified && (
        <span
          title="modified from default"
          style={{ width: 8, height: 8, background: "var(--attention)", transform: "rotate(45deg)", display: "inline-block" }}
        />
      )}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Reset ${title}`}
          title={`Reset ${title}`}
          className="inline-flex items-center justify-center p-0.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </button>
      )}
    </span>
  );

  return (
    <PanelSection
      title={title}
      collapsible
      collapsed={collapsed}
      onCollapsedChange={handleCollapsed}
      action={action}
    >
      {description && (
        <p className="m-0 text-[color:var(--muted-foreground)]" style={{ fontSize: 11, lineHeight: 1.4 }}>
          {description}
        </p>
      )}
      {children}
    </PanelSection>
  );
}
