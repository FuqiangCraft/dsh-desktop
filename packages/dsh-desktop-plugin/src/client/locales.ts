/**
 * `desktop` locale namespace: the attention-HUD copy and notification titles.
 * Simplified Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '桌面',
  'attention.title': '需要你的输入',
  'attention.subtitle': '有智能体正在等待你的审批或回答',
  'attention.kind.approval': '等待审批',
  'attention.kind.question': '等待回答问题',
  'attention.kind.plan-review': '等待评审计划',
  'attention.open': '打开会话',
  'notify.titleApproval': 'DSH 需要你的审批',
  'notify.titleQuestion': 'DSH 需要你的回答',
  'notify.titlePlanReview': 'DSH 需要你评审计划',
  'notify.pendingBody': '正在等待你的输入，点击此处打开会话',
  'canvas.title': '多智能体画布',
  'canvas.empty': '暂无运行中的智能体',
  'canvas.layout.grid': '网格',
  'canvas.layout.split': '分栏',
  'canvas.status.running': '运行中',
  'canvas.status.idle': '空闲',
  'canvas.status.waiting': '等待中',
  'canvas.turn': '轮次',
  'canvas.open': '打开会话',
} satisfies Record<string, string>

/** The `desktop` namespace key union. */
export type DesktopKey = keyof typeof zh

/** English dictionary, mirrors the Chinese key set. */
export const en: Record<DesktopKey, string> = {
  'nav': 'Desktop',
  'attention.title': 'Input needed',
  'attention.subtitle': 'An agent is waiting for your approval or answer',
  'attention.kind.approval': 'Approval required',
  'attention.kind.question': 'Question pending',
  'attention.kind.plan-review': 'Plan review pending',
  'attention.open': 'Open session',
  'notify.titleApproval': 'DSH needs your approval',
  'notify.titleQuestion': 'DSH needs your answer',
  'notify.titlePlanReview': 'DSH needs a plan review',
  'notify.pendingBody': 'Awaiting your input — click to open the session',
  'canvas.title': 'Multi-agent canvas',
  'canvas.empty': 'No agents running',
  'canvas.layout.grid': 'Grid',
  'canvas.layout.split': 'Split',
  'canvas.status.running': 'Running',
  'canvas.status.idle': 'Idle',
  'canvas.status.waiting': 'Waiting',
  'canvas.turn': 'Turn',
  'canvas.open': 'Open session',
}
