/**
 * `desktop` locale namespace: attention-HUD, canvas, and desktop & pet settings.
 * Simplified Chinese is the product copy; English mirrors it 1:1.
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

  // Settings: Desktop & Pet Companion
  'settings.title': '宠物',
  'settings.subtitle': '选择并管理桌面宠物',
  'settings.group.pet': '宠物',
  'settings.petEnabled.label': '启用桌面伴侣',
  'settings.petEnabled.desc': '在桌面上显示微型伴侣浮窗，实时感知 Agent 思考与执行状态',
  'settings.petCharacter.label': '宠物伴侣',
  'settings.petCharacter.desc': '选择显示在桌面上的伴侣角色',
  'settings.petCharacter.robot': '蓝焰机器人',
  'settings.petCharacter.whale': '深海小鲸鱼',
  'settings.petCharacter.cat': '星际小蓝猫',
  'settings.petCharacter.robotDesc': '灵动可靠的原生 AI 桌面伙伴。',
  'settings.petCharacter.whaleDesc': '安静陪伴，适合专注工作的深海朋友。',
  'settings.petCharacter.catDesc': '好奇敏捷，时刻关注 Agent 动态。',
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

  // Settings: Desktop & Pet Companion
  'settings.title': 'Pets',
  'settings.subtitle': 'Choose and manage your desktop pet',
  'settings.group.pet': 'Pets',
  'settings.petEnabled.label': 'Enable desktop companion',
  'settings.petEnabled.desc': 'Display a floating pet widget reflecting real-time agent state',
  'settings.petCharacter.label': 'Companion character',
  'settings.petCharacter.desc': 'Choose the character shown on your desktop',
  'settings.petCharacter.robot': 'Blueflare Robot',
  'settings.petCharacter.whale': 'Deep-sea Whale',
  'settings.petCharacter.cat': 'Starlight Cat',
  'settings.petCharacter.robotDesc': 'The lively and dependable original AI companion.',
  'settings.petCharacter.whaleDesc': 'A calm deep-sea friend for focused work.',
  'settings.petCharacter.catDesc': 'Curious, nimble, and attentive to every agent update.',
}
