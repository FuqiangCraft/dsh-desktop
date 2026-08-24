import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyScreenCaptureTool } from './tool-screen-capture.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = '@mixian/dsh-desktop-plugin'

/** Host plugin has no required service dependencies. */
export const inject: readonly string[] = []

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /**
   * Whether the model-facing `screen_capture` tool is registered. Disabled by
   * default: screen capture exposes the whole display, so the operator must
   * opt in explicitly through the bundle patch.
   */
  screenCapture: boolean
}

/** Configuration schema; the inferred type keeps the callable form accepting partial input. */
export const Config = z.object({
  screenCapture: z.boolean().default(false),
})

/**
 * Host plugin body. Desktop features live in the client half (notifications,
 * attention HUD, multi-agent canvas); the model-facing `screen_capture` tool
 * is registered here behind an explicit opt-in.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved = Config(config ?? {})

  if (resolved.screenCapture) {
    // Defer registration until a durable attachment store is mounted.
    ctx.inject(['attachments'], () => applyScreenCaptureTool(ctx))
  }

  console.info(`[dsh-desktop-plugin] host loaded (screenCapture=${resolved.screenCapture})`)
}
