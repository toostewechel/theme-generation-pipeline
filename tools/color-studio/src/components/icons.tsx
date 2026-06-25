// Inlined Tabler icons (MIT) — paths copied verbatim from @tabler/icons outline
// set, kept inline so the studio stays dependency-light (same approach as
// FigmaIcon). stroke=currentColor, so colour follows the surrounding text.
interface IconProps {
  size?: number;
  className?: string;
}

function TablerIcon({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// chevron-down — rotated to point right when a section is collapsed (via CSS)
export const IconChevron = (p: IconProps) => (
  <TablerIcon {...p}>
    <path d="M6 9l6 6l6 -6" />
  </TablerIcon>
);

export const IconSun = (p: IconProps) => (
  <TablerIcon {...p}>
    <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
  </TablerIcon>
);

export const IconMoon = (p: IconProps) => (
  <TablerIcon {...p}>
    <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
  </TablerIcon>
);

// rotate — used for reset-to-defaults
export const IconReset = (p: IconProps) => (
  <TablerIcon {...p}>
    <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" />
  </TablerIcon>
);
