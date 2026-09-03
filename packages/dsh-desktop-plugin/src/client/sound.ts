/**
 * Audio chime generator using Web Audio API.
 * Synthesizes crystal-clear zero-latency chimes with volume control.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export type SoundKind = 'notify' | 'complete' | 'alert'

/**
 * Play a synthesized notification chime.
 * @param kind 'notify' for interaction chimes, 'complete' for task completion, 'alert' for attention.
 * @param volume Volume level from 0 to 100 (percentage).
 */
export function playNotificationSound(kind: SoundKind = 'notify', volume = 80): void {
  if (volume <= 0) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const gain = ctx.createGain()
  const masterVolume = (Math.max(0, Math.min(100, volume)) / 100) * 0.25
  gain.gain.setValueAtTime(masterVolume, now)
  gain.connect(ctx.destination)

  if (kind === 'complete') {
    // Gentle ascending triad: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)
      noteGain.gain.setValueAtTime(0, now)
      noteGain.gain.setValueAtTime(1, now + idx * 0.08)
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35)
      osc.connect(noteGain)
      noteGain.connect(gain)
      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.36)
    })
  } else if (kind === 'alert') {
    // Two-tone alert: A5 (880Hz) -> F5 (698.46Hz)
    const notes = [880.0, 698.46]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.12)
      noteGain.gain.setValueAtTime(0, now)
      noteGain.gain.setValueAtTime(1, now + idx * 0.12)
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3)
      osc.connect(noteGain)
      noteGain.connect(gain)
      osc.start(now + idx * 0.12)
      osc.stop(now + idx * 0.12 + 0.31)
    })
  } else {
    // Pleasant notification chime: E5 (659.25Hz) -> B5 (987.77Hz)
    const notes = [659.25, 987.77]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.1)
      noteGain.gain.setValueAtTime(0, now)
      noteGain.gain.setValueAtTime(1, now + idx * 0.1)
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4)
      osc.connect(noteGain)
      noteGain.connect(gain)
      osc.start(now + idx * 0.1)
      osc.stop(now + idx * 0.1 + 0.41)
    })
  }
}
