function setTensionZero(): void {
  game.settings.set("dawn-system", "tension", 0);
}

function incrementTensionForRound(...args: unknown[]): void {
  const options = args[2] as { direction: number };
  const current = game.settings.get("dawn-system", "tension") as number;
  game.settings.set("dawn-system", "tension", current + options.direction);
}

function detectWoundOrGateChange(...args: unknown[]): void {
  const changed = args[1] as { system?: { wounds?: number; gates?: { value?: number } } };
  // TODO: This detects changes to wounds or gates, but not the direction.
  // So we increment tension regardless of whether a wounds is being taken, or healed.
  const woundChange = changed.system?.wounds;
  const gateChange = changed.system?.gates?.value;

  if (woundChange !== undefined || gateChange !== undefined) {
    game.settings.set(
      "dawn-system",
      "tension",
      (game.settings.get("dawn-system", "tension") as number) + 1,
    );
  }
}

export function initTensionAutomation(): void {
  if (!game.user?.isGM) return;

  foundry.helpers.Hooks.on("combatStart", setTensionZero);
  foundry.helpers.Hooks.on("combatRound", incrementTensionForRound);
  foundry.helpers.Hooks.on("updateActor", detectWoundOrGateChange);
}
