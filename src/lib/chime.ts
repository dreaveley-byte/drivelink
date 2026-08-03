// A short two-tone chime generated on the fly via the Web Audio API — no
// audio file to host or load, just a couple oscillators.
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + duration)
    }

    playTone(880, 0, 0.15)
    playTone(1175, 0.1, 0.2)

    setTimeout(() => ctx.close(), 500)
  } catch {
    // Some browsers block audio without a user gesture first — fail silently.
  }
}
