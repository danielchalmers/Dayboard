import type { WidgetKind } from "~/lib/types"

// One line-icon per widget kind, shared by the add menu, the card headers, and the edit dialog so every surface names a kind with the same visual.
const ICON_PATHS: Record<WidgetKind, React.ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5v5l3.5 2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </>
  ),
  countdown: (
    <path
      d="M8 4h8M8 20h8M9 4c0 3.8 1.5 5.6 3 7 1.5-1.4 3-3.2 3-7M9 20c0-3.8 1.5-5.6 3-7 1.5 1.4 3 3.2 3 7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  note: (
    <>
      <path
        d="M5 4.5h14a1 1 0 0 1 1 1V14l-6 5.5H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M20 14h-5a1 1 0 0 0-1 1v4.5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 9h8M8 12.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </>
  ),
  quote: (
    <path
      d="M10 7.5C7.5 8.3 6 10.3 6 13v3.5h4.5V12H8.4c.2-1.3 1-2.2 2.3-2.7L10 7.5ZM19 7.5c-2.5.8-4 2.8-4 5.5v3.5h4.5V12h-2.1c.2-1.3 1-2.2 2.3-2.7L19 7.5Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.5" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 13.5V9.5M9.5 2.75h5M18.5 7l1.4-1.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 13 15 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </>
  ),
  habit: (
    <path
      d="m12 4.5 2.1 4.6 5 .5-3.7 3.4 1 4.9L12 16l-4.4 2.4 1-4.9L4.9 9.6l5-.5z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  ),
  todo: (
    <>
      <path
        d="m4 7.5 2 2 3.5-3.5M4 17l2 2 3.5-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M13 8h7M13 17h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </>
  )
}

export const WidgetIcon = ({ kind, size = 22 }: { kind: WidgetKind; size?: number }) => (
  <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
    {ICON_PATHS[kind]}
  </svg>
)
