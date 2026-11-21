// Shared control styles for the quizzes UI.
//
// Two gotchas these work around:
// - In dark mode --blue-deep is a *light* blue (blue-300), so primary buttons
//   use --bg for their text (near-white in light mode, near-black in dark)
//   rather than text-white, which is unreadable on blue-300.
// - styles.css has an unlayered `a { color: … }` rule, which beats Tailwind's
//   layered utilities. Text colors here are `!important` (trailing `!`) so a
//   <Link> styled as a button keeps its label color instead of turning
//   --blue-deep on a --blue-deep background (invisible).

const pill =
  'inline-flex items-center justify-center gap-1 rounded-full font-semibold no-underline transition disabled:cursor-not-allowed disabled:opacity-50'

export const primaryButton = `${pill} bg-[var(--blue-deep)] px-5 py-2 text-sm text-[var(--bg)]! shadow-sm hover:bg-[var(--blue-darker)]`

export const primaryButtonSmall = `${pill} bg-[var(--blue-deep)] px-4 py-1.5 text-sm text-[var(--bg)]! shadow-sm hover:bg-[var(--blue-darker)]`

export const secondaryButton = `${pill} border border-[var(--chip-border)] bg-[var(--chip-bg)] px-4 py-1.5 text-sm text-[var(--text)]! hover:border-[var(--blue)]`

export const secondaryButtonSmall = `${pill} border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--text)]! hover:border-[var(--blue)]`

export const dangerButton = `${pill} bg-red-600 px-4 py-1.5 text-sm text-white! hover:bg-red-700`

export const dangerOutlineButton = `${pill} border border-red-500/50 px-4 py-1.5 text-sm text-red-600! hover:bg-red-500/10 dark:text-red-400!`

/** Small square icon buttons (move up/down, remove). */
export const iconButton =
  'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--chip-border)] bg-[var(--chip-bg)] text-sm text-[var(--text)] transition hover:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-30'

export const inputClass =
  'w-full rounded-lg border border-[var(--chip-border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/25'

export const labelClass =
  'mb-1 block text-xs font-semibold text-[var(--text-muted)]'

/** Empty picture slot — dashed so it reads as a target on any background. */
export const placeholderBox =
  'flex items-center justify-center rounded-lg border border-dashed border-[var(--chip-border)] bg-[var(--chip-bg)] text-center text-[var(--text-muted)]'
