const DAWN_STATUS_EFFECTS = [
  // Generic
  { id: "dead", name: "DAWN.Status.TakenOut", img: "icons/svg/skull.svg", order: 0 },
  // Positive
  { id: "banish", name: "DAWN.Status.Banished", img: "icons/svg/sleep.svg", order: 10 },
  { id: "haste", name: "DAWN.Status.Hastened", img: "icons/svg/wingfoot.svg", order: 20 },
  { id: "invisible", name: "DAWN.Status.Invisible", img: "icons/svg/invisible.svg", order: 30 },
  { id: "regen", name: "DAWN.Status.Regenerating", img: "icons/svg/regen.svg", order: 40 },
  { id: "reinforced", name: "DAWN.Status.Reinforced", img: "icons/svg/shield.svg", order: 50 },
  { id: "steady", name: "DAWN.Status.Steadied", img: "icons/svg/statue.svg", order: 60 },
  { id: "strengthen", name: "DAWN.Status.Strengthened", img: "icons/svg/upgrade.svg", order: 70 },
  // Negative
  { id: "blight", name: "DAWN.Status.Blighted", img: "icons/svg/blood.svg", order: 80 },
  { id: "daze", name: "DAWN.Status.Dazed", img: "icons/svg/daze.svg", order: 90 },
  { id: "fear", name: "DAWN.Status.Feared", img: "icons/svg/terror.svg", order: 100 },
  { id: "immobilize", name: "DAWN.Status.Immobilized", img: "icons/svg/cancel.svg", order: 110 },
  { id: "launch", name: "DAWN.Status.Launched", img: "icons/svg/falling.svg", order: 120 },
  { id: "mark", name: "DAWN.Status.Marked", img: "icons/svg/target.svg", order: 130 },
  { id: "slow", name: "DAWN.Status.Slowed", img: "icons/svg/stoned.svg", order: 140 },
  { id: "shred", name: "DAWN.Status.Shredded", img: "icons/svg/hazard.svg", order: 150 },
  { id: "snare", name: "DAWN.Status.Snared", img: "icons/svg/trap.svg", order: 160 },
  { id: "taunt", name: "DAWN.Status.Taunted", img: "icons/svg/target.svg", order: 170 },
  { id: "weak", name: "DAWN.Status.Weakened", img: "icons/svg/downgrade.svg", order: 180 },
];

const SOURCE_TRACKED_STATUSES = ["taunt", "fear"];

function onActiveEffectCreate(...args: unknown[]): void {
  const effect = args[0] as { statuses?: Set<string>; flags?: Record<string, unknown> };
  const userId = args[2] as string;

  const statuses = effect.statuses;
  if (!statuses) return;

  const isTracked = Array.from(statuses).some((s: string) => SOURCE_TRACKED_STATUSES.includes(s));
  if (!isTracked) return;

  // Determine the source actor: current combatant if in combat, otherwise the user's controlled token
  let sourceActorId: string | null = null;
  const combat = game.combat;
  if (combat?.started && combat.current) {
    sourceActorId = combat.current?.actorId ?? null;
  } else if (userId) {
    sourceActorId = userId;
  }

  if (sourceActorId) {
    effect.flags ??= {};
    (effect.flags as Record<string, unknown>)["dawn-system"] ??= {};
    ((effect.flags as Record<string, unknown>)["dawn-system"] as Record<string, unknown>).source = sourceActorId;
  }
}

export function initStatusEffects(): void {
  CONFIG.statusEffects = DAWN_STATUS_EFFECTS;
  foundry.helpers.Hooks.on("createActiveEffect", onActiveEffectCreate);
}
