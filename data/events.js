// Weekly rotating events. The active event is derived from the calendar (no server needed): every player sees the same one.
// Effects are read in game.js. Cycle = EVENTS.length weeks, starting Monday 5 Jan 2026 (UTC).
export const EVENT_MS = 7 * 24 * 60 * 60 * 1000;
export const EVENT_EPOCH = Date.UTC(2026, 0, 5);
export const EVENTS = [
  { id: 'typhoon', name: 'Bagyong Habagat', emoji: '🌀', tag: 'Typhoon Season',
    desc: 'Rain, windstorms and thunderstorms are 5x more common, and mutations they cause are worth +50%.' },
  { id: 'pista', name: 'Pista ng Ani', emoji: '🎉', tag: 'Harvest Festival',
    desc: 'Bayanihan! +50% XP from harvests and +25% crop sell price.' },
  { id: 'mutmad', name: 'Mutation Madness', emoji: '🧪', tag: 'Mutation Madness',
    desc: 'Weather changes twice as fast, so mutations roll twice as often. Secret combos are easier to chase.' },
  { id: 'parade', name: 'Parada ng mga Alaga', emoji: '🎊', tag: 'Pet Parade',
    desc: 'Pet bonuses are doubled and the exclusive Sarimanok can be adopted (it stays yours forever).' },
];
export function getEvent(now = Date.now()) {
  const slot = Math.floor((now - EVENT_EPOCH) / EVENT_MS), n = EVENTS.length, idx = ((slot % n) + n) % n;
  const start = EVENT_EPOCH + slot * EVENT_MS;
  return { ...EVENTS[idx], startsAt: start, endsAt: start + EVENT_MS, next: EVENTS[(idx + 1) % n] };
}
