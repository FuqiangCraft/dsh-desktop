/**
 * Multi-agent tiling canvas (client half): a `conversation.view` tab rendering
 * a live grid of every session and sub-agent, read straight from the client
 * sessions store (`useSessions`). Clicking a card opens that session. Read-only
 * observer — it never claims the composer or mutates session state.
 */
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopKey } from './locales.ts'

/** The interaction face the plugin injects into the view entry. */
export interface CanvasInjected {
  /** Navigate to a session. */
  open: (id: SessionId) => void
}

/** Full component props: the view's runtime kit + inject face + locale seat. */
export type MultiAgentCanvasProps = ConvViewProps & InjectFace<CanvasInjected> & PropsLocale<'desktop'>

/** The runtime fields the canvas reads. */
type Card = SessionSummary & { displayTitle: string }

/** Locale keys per interaction kind. */
const KIND_TEXT: Record<string, 'attention.kind.approval' | 'attention.kind.question' | 'attention.kind.plan-review'> = {
  approval: 'attention.kind.approval',
  question: 'attention.kind.question',
  'plan-review': 'attention.kind.plan-review',
}

function statusKey(s: Card): 'canvas.status.running' | 'canvas.status.idle' | 'canvas.status.waiting' {
  if (s.pendingInteraction !== undefined) return 'canvas.status.waiting'
  return s.running ? 'canvas.status.running' : 'canvas.status.idle'
}

/** One session card in the grid. */
function SessionCard({ session, open, t }: {
  session: Card
  open: (id: SessionId) => void
  t: (key: DesktopKey) => string
}) {
  const kind = session.pendingInteraction === undefined ? undefined : KIND_TEXT[session.pendingInteraction]
  return (
    <button
      type="button"
      className="dsh_desktop_canvasCard"
      onClick={() => open(session.id)}
      aria-label={`${session.displayTitle} — ${t(statusKey(session))}`}
    >
      <div className="dsh_desktop_canvasCardTop">
        <span className="dsh_desktop_canvasCardTitle">{session.displayTitle}</span>
        <span className={`dsh_desktop_canvasCardStatus ${session.running ? 'is-running' : ''}`}>
          {t(statusKey(session))}
        </span>
      </div>
      {session.cwd !== undefined && <div className="dsh_desktop_canvasCardMeta">{session.cwd}</div>}
      {kind !== undefined && <div className="dsh_desktop_canvasCardPending">{t(kind)}</div>}
    </button>
  )
}

/** The live multi-session grid. */
export function MultiAgentCanvas({ useSessions, open, t }: MultiAgentCanvasProps) {
  const ids = useSessions((s) => s.ids)
  const byId = useSessions((s) => s.byId)

  const sessions = ids
    .map((id) => byId[id])
    .filter((row): row is Card => row !== undefined)
  const active = sessions.filter((row) => row.running || row.pendingInteraction !== undefined)
  const shown = active.length > 0 ? active : sessions

  return (
    <div className="dsh_desktop_canvas">
      <div className="dsh_desktop_canvasHeader">
        <span className="dsh_desktop_canvasTitle">{t('canvas.title')}</span>
        <span className="dsh_desktop_canvasCount">{shown.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="dsh_desktop_canvasEmpty">{t('canvas.empty')}</p>
      ) : (
        <div className="dsh_desktop_canvasGrid">
          {shown.map((row) => (
            <SessionCard key={row.id} session={row} open={open} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
