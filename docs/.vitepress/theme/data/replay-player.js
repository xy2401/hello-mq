export function clampReplayStep(events, requested) {
  const parsed = Number.parseInt(String(requested ?? 0), 10)
  if (!Number.isFinite(parsed) || events.length === 0) return 0
  return Math.min(Math.max(0, parsed), events.length - 1)
}

export function moveReplayStep(events, current, delta) {
  return clampReplayStep(events, current + delta)
}

export function resolveReplayAction(tracks, action) {
  const track = tracks.find((item) => item.id === action.targetTrack)
  if (!track || track.events.length === 0) return undefined
  return { track: track.id, step: clampReplayStep(track.events, action.targetStep) }
}
