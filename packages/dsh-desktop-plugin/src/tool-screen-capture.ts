/**
 * The model-facing `screen_capture` tool commits a PNG capture of the host's
 * primary display into the session as an image attachment, so the image rides
 * the tool-result message into the model's next request (the durable
 * `tool/result` event satisfies "model-visible means logged").
 *
 * Consent model: the tool is DISABLED BY DEFAULT. The host plugin registers it
 * only when `screenCapture: true` is set in the bundle patch — the operator
 * opts in explicitly. Even then, it only fires when the model decides to call
 * it (typically after the user asks for a screenshot), and the captured image
 * is surfaced back into the conversation for transparency. No hidden capture.
 * @module @dsh-community/dsh-desktop-plugin/src/tool-screen-capture
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

const execFileAsync = promisify(execFile)

/** The structured outcome declared by the `screen_capture` output schema. */
interface ScreenCaptureValue {
  source: string
  image: {
    attachmentId: string
    mediaType: 'image/png'
    bytes: number
    width: number
    height: number
    name?: string
  }
}

/** Resolve the platform-native capture command for the given output path. */
function captureCommand(tempPath: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      'Add-Type -AssemblyName System.Drawing;',
      '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;',
      '$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;',
      '$g=[System.Drawing.Graphics]::FromImage($bmp);',
      '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);',
      `$bmp.Save('${tempPath.replace(/'/g, "''")}',[System.Drawing.Imaging.ImageFormat]::Png);`,
      '$g.Dispose();$bmp.Dispose()',
    ].join(' ')
    return { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] }
  }
  if (process.platform === 'darwin') {
    return { command: 'screencapture', args: ['-x', '-t', 'png', tempPath] }
  }
  return { command: 'scrot', args: [tempPath] }
}

/** Capture the host's primary display to a temporary PNG file and return its bytes. */
async function captureScreenPng(): Promise<Buffer> {
  const tempPath = join(tmpdir(), `dsh-screen-capture-${process.pid}.png`)
  try {
    const { command, args } = captureCommand(tempPath)
    try {
      await execFileAsync(command, args, { timeout: 15000 })
    } catch (error) {
      // Linux fallback when `scrot` is not installed.
      if (process.platform !== 'linux') throw error
      await execFileAsync('gnome-screenshot', ['-f', tempPath], { timeout: 15000 })
    }
    return await readFile(tempPath)
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}

/** Re-brand a structured capture outcome into the durable attachment reference an ImageBlock carries. */
function screenRefFromValue(image: ScreenCaptureValue['image']): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

/** The model-facing envelope beside the captured image block. */
function formatScreenCaptureOutput(image: ScreenCaptureValue['image']): string {
  return `<source>screen</source>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes, captured from the host's primary display
</content>`
}

/**
 * Register the `screen_capture` tool. The composing plugin owns the
 * attachments gate and the consent switch: call this only when the operator
 * has enabled screen capture in the bundle patch.
 * @param ctx - the registration scope; execution uses its `attachments` service.
 */
export function applyScreenCaptureTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'screen_capture',
    description: 'Capture the host computer\'s primary display and return the screenshot image itself. '
      + 'The captured image is committed into the conversation so the user can see it. '
      + 'Only use this tool when the user has explicitly asked for a screenshot of their screen. '
      + 'Requires the current model to accept image input.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: true,
        properties: {
          source: { type: 'string', required: true },
          image: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', enum: ['image/png'], required: true },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => {
        const v = value as unknown as ScreenCaptureValue
        return [
          { type: 'text', text: formatScreenCaptureOutput(v.image) },
          { type: 'image', attachment: screenRefFromValue(v.image) },
        ]
      },
    },
    isConcurrencySafe: () => false,
    async execute(_args) {
      const attachments = ctx.get('attachments')
      if (attachments === undefined) {
        throw new Error('screen_capture: no attachment service is mounted')
      }
      const data = await captureScreenPng()
      const ref = await attachments.saveImage({
        data,
        mediaType: 'image/png',
        name: `screen-capture.png`,
      })
      return {
        source: 'screen',
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType as 'image/png',
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...ref.name === undefined ? {} : { name: ref.name },
        },
      }
    },
    // Pure display: a generic card in the read family.
    presentCall(): GenericCallView {
      return { card: 'generic', title: 'Capture screen', kind: 'read' }
    },
  }))
}
