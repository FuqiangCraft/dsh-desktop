/**
 * Floating attention HUD (client half): a `shell.overlay` entry that lists
 * every session currently blocked on a pending user interaction. Clicking a
 * card opens the session, where the stock composer surfaces the question. The
 * overlay layer is click-through; the cards opt back into pointer events.
 */
import type { GlobalStandardProps, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopKey } from './locales.ts'

/** The interaction face the plugin injects into the overlay entry. */
export interface AttentionInjected {
  /** Navigate to a session (the stock composer renders the pending question there). */
  open: (id: SessionId) => void
}

/** Full component props: inject face + the framework's global standard kit + locale seat. */
export type AttentionCardProps = AttentionInjected & GlobalStandardProps & PropsLocale<'desktop'>

/** A session row narrowed to one with a pending interaction. */
interface PendingSession extends SessionSummary {
  pendingInteraction: 'approval' | 'plan-review' | 'question'
}

/** Locale keys for each interaction kind's card label. */
const KIND_TEXT: Record<PendingSession['pendingInteraction'], DesktopKey> = {
  approval: 'attention.kind.approval',
  question: 'attention.kind.question',
  'plan-review': 'attention.kind.plan-review',
}

/** Root-scoped floating stack of pending-interaction cards. */
export function AttentionCard({ useSessions, open, t }: AttentionCardProps) {
  const ids = useSessions((s) => s.ids)
  const byId = useSessions((s) => s.byId)
  const pending = ids
    .map((id) => byId[id])
    .filter((row): row is PendingSession => row?.pendingInteraction !== undefined)

  if (pending.length === 0) return null

  return (
    <div className="dsh_desktop_attentionStack">
      {pending.map((row) => (
        <button
          key={row.id}
          type="button"
          className="dsh_desktop_attentionCard"
          onClick={() => open(row.id)}
          aria-label={`${t(KIND_TEXT[row.pendingInteraction])} — ${row.displayTitle}`}
        >
          <span className="dsh_desktop_attentionKind">{t(KIND_TEXT[row.pendingInteraction])}</span>
          <span className="dsh_desktop_attentionTitle">{row.displayTitle}</span>
        </button>
      ))}
    </div>
  )
}
