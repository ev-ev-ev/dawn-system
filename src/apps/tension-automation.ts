const woundCache = new Map<string, { wounds: number; gates: number }>();

function cacheActorWoundsAndGates(actor: { _id: string; system: unknown }): void {
  const s = actor.system as { wounds?: number; gates?: { value?: number } };
  woundCache.set(actor._id, {
    wounds: (s.wounds as number) ?? 0,
    gates: (s.gates as { value?: number })?.value ?? 0,
  });
}

function populateCache(combat: { combatants: unknown[] }): void {
  woundCache.clear();
  for (const combatant of combat.combatants) {
    const c = combatant as { actor?: { _id: string; system: unknown } };
    if (c.actor) {
      cacheActorWoundsAndGates(c.actor);
    }
  }
}

function onCombatStart(combat: unknown): void {
  populateCache(combat as { combatants: unknown[] });
  game.settings.set("dawn-system", "tension", 0);
  game.settings.set("dawn-system", "drama", 0);
  game.settings.set("dawn-system", "doom", 0);
}

function incrementTensionForRound(...args: unknown[]): void {
  const options = args[2] as { direction: number };
  const current = game.settings.get("dawn-system", "tension") as number;
  game.settings.set("dawn-system", "tension", current + options.direction);
}

function detectWoundOrGateChange(...args: unknown[]): void {
  const actor = args[0] as { _id: string; system: unknown };
  const changed = args[1] as { system?: { wounds?: number; gates?: { value?: number } } };

  const cached = woundCache.get(actor._id);
  if (!cached) return;

  const newWounds = (changed.system?.wounds as number) ?? cached.wounds;
  const newGates = (changed.system?.gates as { value?: number })?.value ?? cached.gates;

  if (newWounds > cached.wounds || newGates > cached.gates) {
    game.settings.set(
      "dawn-system",
      "tension",
      (game.settings.get("dawn-system", "tension") as number) + 1,
    );
  }

  woundCache.set(actor._id, { wounds: newWounds, gates: newGates });
}

function onCombatantCreate(combatant: unknown): void {
  const c = combatant as { actor?: { _id: string; system: unknown } };
  if (c.actor) {
    cacheActorWoundsAndGates(c.actor);
  }
}

export function initTensionAutomation(): void {
  if (!game.user?.isGM) return;

  // If a combat is already active on ready, populate cache from existing combatants.
  const combat = game.combat;
  if (combat?.started) {
    populateCache(combat as { combatants: unknown[] });
  }

  foundry.helpers.Hooks.on("combatStart", onCombatStart);
  foundry.helpers.Hooks.on("combatRound", incrementTensionForRound);
  foundry.helpers.Hooks.on("createCombatant", onCombatantCreate);
  foundry.helpers.Hooks.on("updateActor", detectWoundOrGateChange);
}
