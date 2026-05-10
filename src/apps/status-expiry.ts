const EXCLUDED_STATUSES = ["dead"];

function isMultiGateAdversary(actor: unknown): boolean {
  const a = actor as { type?: string; items?: Array<{ type?: string }> };
  if (a.type !== "adversary") return false;
  const components = a.items?.filter((i: { type?: string }) => i.type === "component") ?? [];
  return components.length > 1;
}

function getCombatantForActor(combat: unknown, actor: unknown): unknown | null {
  const combatants = (combat as { combatants?: Array<{ actorId?: string }> }).combatants ?? [];
  const actorId = (actor as { id?: string }).id;
  for (const c of combatants) {
    if ((c as { actorId?: string }).actorId === actorId) {
      return c;
    }
  }
  return null;
}

function onActiveEffectCreate(effect: unknown): void {
  const statuses = (effect as { statuses?: Set<string> }).statuses;
  if (!statuses) return;

  // Skip excluded statuses (dead never expires)
  const hasExcluded = Array.from(statuses).some((s: string) => EXCLUDED_STATUSES.includes(s));
  if (hasExcluded) return;

  const combat = game.combat;
  if (!combat?.started) return;

  const actor = (effect as { parent?: unknown }).parent;
  if (!actor) return;

  // Only apply duration if the actor is a combatant
  if (!getCombatantForActor(combat, actor)) return;

  const multiGate = isMultiGateAdversary(actor);
  (effect as { update(data: Record<string, unknown>): Promise<void> }).update({
    duration: {
      value: 2,
      units: multiGate ? "rounds" : "turns",
      expiry: multiGate ? "roundEnd" : "turnEnd",
    },
  });
}

function onCombatRound(...args: unknown[]): void {
  const options = args[2] as { direction?: number };
  if (options?.direction !== 1) return;

  const combat = game.combat;
  if (!combat?.started) return;

  const combatants = (combat as { combatants?: Array<{ actorId?: string }> }).combatants ?? [];
  for (const combatant of combatants) {
    const actorId = (combatant as { actorId?: string }).actorId;
    if (!actorId) continue;

    const actor = game.actors.get(actorId);
    if (!actor) continue;
    if (!isMultiGateAdversary(actor)) continue;

    const effects = (actor as { activeEffects?: Array<{ update(data: Record<string, unknown>): Promise<void>; duration?: { value?: number } }> }).activeEffects ?? [];
    for (const effect of effects) {
      const current = (effect.duration as { value?: number })?.value;
      if (current !== undefined && current > 0) {
        effect.update({ "duration.value": current - 1 });
      }
    }
  }
}

function onCombatStart(combat: unknown): void {
  // Set duration on any pre-existing effects that weren't caught by createActiveEffect
  const combatants = (combat as { combatants?: Array<{ actorId?: string }> }).combatants ?? [];
  for (const combatant of combatants) {
    const actorId = (combatant as { actorId?: string }).actorId;
    if (!actorId) continue;

    const actor = game.actors.get(actorId);
    if (!actor) continue;

    const multiGate = isMultiGateAdversary(actor);
    const effects = (actor as { activeEffects?: Array<{ update(data: Record<string, unknown>): Promise<void>; duration?: { value?: number } }> }).activeEffects ?? [];
    for (const effect of effects) {
      const current = (effect.duration as { value?: number })?.value;
      if (current === undefined) {
        effect.update({
          duration: {
            value: 2,
            units: multiGate ? "rounds" : "turns",
            expiry: multiGate ? "roundEnd" : "turnEnd",
          },
        });
      }
    }
  }
}

export function initStatusExpiry(): void {
  if (!game.user?.isGM) return;

  foundry.helpers.Hooks.on("createActiveEffect", onActiveEffectCreate);
  foundry.helpers.Hooks.on("combatRound", onCombatRound);
  foundry.helpers.Hooks.on("combatStart", onCombatStart);
}
