export interface TargetStats {
  name: string;
  tokenId: string;
  sceneId: string;
  healthValue: number;
  healthMax: number;
  evasion: number;
  armor: number;
  actorType: string;
}

export interface DamageResult {
  name: string;
  damageDealt: number;
  evasionLost: number;
  healthLost: number;
  armor: number;
  woundTaken: boolean;
  gatePassed: boolean;
  takenOut: boolean;
}

export interface DamageFluffData {
  result: number;
  targets: Array<{ tokenId: string; sceneId: string }>;
  actorType: string;
  rollerActorId: string;
}

/**
 * Resolve targeted tokens to {tokenId, sceneId} pairs.
 */
export function getTargetTokens(): Array<{ tokenId: string; sceneId: string }> {
  const targets: Array<{ tokenId: string; sceneId: string }> = [];
  const userTargets = (game as any).user?.targets;
  if (userTargets) {
    for (const t of userTargets) {
      targets.push({
        tokenId: t.id,
        sceneId: t.scene?.id ?? "",
      });
    }
  }
  return targets;
}

/**
 * Resolve a token by scene + token ID.
 */
function resolveToken(sceneId: string, tokenId: string): any {
  const scene = (game as any).scenes?.get(sceneId);
  if (!scene) return null;
  return scene.tokens?.get(tokenId) ?? null;
}

/**
 * Read stats from a character actor.
 */
function readCharacterStats(actor: foundry.documents.BaseActor, tokenId: string, sceneId: string): TargetStats {
  const s = actor.system as Record<string, unknown>;
  const healthObj = s.health as { value?: number; max?: number };
  return {
    name: actor.name,
    tokenId,
    sceneId,
    healthValue: Number(healthObj?.value ?? 0),
    healthMax: Number(healthObj?.max ?? 0),
    evasion: Number(s.evasion ?? 0),
    armor: Number(s.armor ?? 0),
    actorType: "character",
  };
}

/**
 * Compute adversary armor + evasionMax from attached items.
 */
function computeAdversaryDerivedStats(actor: foundry.documents.BaseActor): { armor: number; healthMax: number } {
  const tier = Number((actor.system as any).tier ?? 1);
  const components = (actor as any).items?.filter((i: foundry.documents.BaseItem) => i.type === "component") ?? [];
  const modifiers = (actor as any).items?.filter((i: foundry.documents.BaseItem) => i.type === "modifier") ?? [];

  let maxCompArmor = 0;
  for (const comp of components) {
    const cs = comp.system as Record<string, unknown>;
    const a = Number(cs.tierarmor ?? 0) * tier;
    if (a > maxCompArmor) maxCompArmor = a;
  }
  let modArmor = 0;
  for (const mod of modifiers) {
    const ms = mod.system as Record<string, unknown>;
    modArmor += Number(ms.basearmor ?? 0) + Number(ms.tierarmor ?? 0) * tier;
  }

  const gatesMax = components.length;
  let healthMax = 0;
  if (gatesMax > 0) {
    const total = components.reduce((sum: number, comp: foundry.documents.BaseItem) => {
      const cs = comp.system as Record<string, unknown>;
      return sum + (Number(cs.basehp ?? 0) + Number(cs.tierhp ?? 0) * tier);
    }, 0);
    healthMax = Math.ceil(total / gatesMax);
  }

  return { armor: maxCompArmor + modArmor, healthMax };
}

/**
 * Read stats from an adversary actor.
 */
function readAdversaryStats(actor: foundry.documents.BaseActor, tokenId: string, sceneId: string): TargetStats {
  const s = actor.system as Record<string, unknown>;
  const healthObj = s.health as { value?: number; max?: number };
  const evasionObj = s.evasion as { value?: number; max?: number };
  const derived = computeAdversaryDerivedStats(actor);
  return {
    name: actor.name,
    tokenId,
    sceneId,
    healthValue: Number(healthObj?.value ?? 0),
    healthMax: derived.healthMax,
    evasion: Number(evasionObj?.value ?? 0),
    armor: derived.armor,
    actorType: "adversary",
  };
}

/**
 * Read target stats for a given token.
 */
export async function readTargetStats(tokenId: string, sceneId: string): Promise<TargetStats | null> {
  const token = resolveToken(sceneId, tokenId);
  if (!token) return null;
  const actor = token.actor;
  if (!actor) return null;
  if (actor.type === "character") return readCharacterStats(actor, tokenId, sceneId);
  if (actor.type === "adversary") return readAdversaryStats(actor, tokenId, sceneId);
  return null;
}

/**
 * Apply damage to a single token following Dawn System rules.
 */
export async function applyDamageToTarget(tokenId: string, sceneId: string, damage: number): Promise<DamageResult | null> {
  const token = resolveToken(sceneId, tokenId);
  if (!token) return null;
  const actor = token.actor;
  if (!actor) return null;

  const stats = actor.type === "character"
    ? readCharacterStats(actor, tokenId, sceneId)
    : readAdversaryStats(actor, tokenId, sceneId);

  let remaining = damage;

  // Step 1: reduce evasion (no armor reduction, floor 0)
  const evasionLost = Math.min(stats.evasion, remaining);
  remaining -= evasionLost;

  // Step 2: reduce health (armor reduction, min 1)
  let healthLost = 0;
  if (remaining > 0) {
    healthLost = Math.max(1, remaining - stats.armor);
    if (healthLost > stats.healthValue) healthLost = stats.healthValue;
  }

  let newHealth = stats.healthValue - healthLost;
  let woundTaken = false;
  let gatePassed = false;
  let takenOut = false;

  // Step 3: check for wound/gate
  if (newHealth <= 0) {
    if (actor.type === "character") {
      const currentWounds = Number((actor.system as any).wounds ?? 0);
      if (currentWounds >= 3) {
        takenOut = true;
      } else {
        woundTaken = true;
        newHealth = stats.healthMax;
      }
    } else {
      const gatesValue = Number((actor.system as any).gates?.value ?? 0);
      const components = (actor as any).items?.filter((i: foundry.documents.BaseItem) => i.type === "component") ?? [];
      if (gatesValue >= components.length) {
        takenOut = true;
      } else {
        gatePassed = true;
        newHealth = stats.healthMax;
      }
    }
  }

  // Persist updates on the actor
  const updates: Record<string, unknown> = {};

  if (actor.type === "character") {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion"] = Math.max(0, stats.evasion - evasionLost);
    if (woundTaken) {
      updates["system.wounds"] = Number((actor.system as any).wounds ?? 0) + 1;
    }
  } else {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion.value"] = Math.max(0, stats.evasion - evasionLost);
    if (gatePassed) {
      updates["system.gates.value"] = Number((actor.system as any).gates?.value ?? 0) + 1;
    }
  }

  await actor.update(updates);

  return {
    name: stats.name,
    damageDealt: damage,
    evasionLost,
    healthLost,
    armor: stats.armor,
    woundTaken,
    gatePassed,
    takenOut,
  };
}

/**
 * Open the damage dialog. Returns the damage amount chosen, or null if cancelled.
 */
export async function openDamageDialog(targetTokens: Array<{ tokenId: string; sceneId: string }>, defaultDamage: number): Promise<number | null> {
  const statsList: TargetStats[] = [];
  for (const t of targetTokens) {
    const s = await readTargetStats(t.tokenId, t.sceneId);
    if (s) statsList.push(s);
  }
  if (statsList.length === 0) return null;

  const rows = statsList
    .map(
      (s) =>
        `<tr><td>${s.name}</td><td>${s.healthValue} / ${s.healthMax}</td><td>${s.evasion}</td><td>${s.armor}</td></tr>`
    )
    .join("");

  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize("DAWN.Damage.DialogTitle") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("DAWN.Damage.Amount")}</label>
        <input type="number" name="damage" value="${defaultDamage}" min="0" autofocus />
      </div>
      <table class="damage-target-table">
        <thead>
          <tr>
            <th>${game.i18n.localize("DAWN.Damage.Target")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Health")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Evasion")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Armor")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
    ok: { label: game.i18n.localize("DAWN.Damage.Confirm"), icon: "fa-solid fa-heart-crack" },
    rejectClose: false,
  });

  if (!formData) return null;
  return Number(formData.damage);
}

/**
 * Open damage dialog for the sheet's own actor (self-damage).
 */
export async function openSelfDamageDialog(actor: foundry.documents.BaseActor, defaultDamage: number): Promise<number | null> {
  const stats = actor.type === "character"
    ? readCharacterStats(actor, "", "")
    : readAdversaryStats(actor, "", "");

  const rows = `<tr><td>${stats.name}</td><td>${stats.healthValue} / ${stats.healthMax}</td><td>${stats.evasion}</td><td>${stats.armor}</td></tr>`;

  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize("DAWN.Damage.DialogTitle") },
    content: `
      <div class="form-group">
        <label>${game.i18n.localize("DAWN.Damage.Amount")}</label>
        <input type="number" name="damage" value="${defaultDamage}" min="0" autofocus />
      </div>
      <table class="damage-target-table">
        <thead>
          <tr>
            <th>${game.i18n.localize("DAWN.Damage.Target")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Health")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Evasion")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Armor")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
    ok: { label: game.i18n.localize("DAWN.Damage.Confirm"), icon: "fa-solid fa-heart-crack" },
    rejectClose: false,
  });

  if (!formData) return null;
  return Number(formData.damage);
}

/**
 * Apply damage to the sheet's own actor directly.
 */
export async function applySelfDamage(actor: foundry.documents.BaseActor, damage: number): Promise<DamageResult | null> {
  const stats = actor.type === "character"
    ? readCharacterStats(actor, "", "")
    : readAdversaryStats(actor, "", "");

  let remaining = damage;

  const evasionLost = Math.min(stats.evasion, remaining);
  remaining -= evasionLost;

  let healthLost = 0;
  if (remaining > 0) {
    healthLost = Math.max(1, remaining - stats.armor);
    if (healthLost > stats.healthValue) healthLost = stats.healthValue;
  }

  let newHealth = stats.healthValue - healthLost;
  let woundTaken = false;
  let gatePassed = false;
  let takenOut = false;

  if (newHealth <= 0) {
    if (actor.type === "character") {
      const currentWounds = Number((actor.system as any).wounds ?? 0);
      if (currentWounds >= 3) {
        takenOut = true;
      } else {
        woundTaken = true;
        newHealth = stats.healthMax;
      }
    } else {
      const gatesValue = Number((actor.system as any).gates?.value ?? 0);
      const components = (actor as any).items?.filter((i: foundry.documents.BaseItem) => i.type === "component") ?? [];
      if (gatesValue >= components.length) {
        takenOut = true;
      } else {
        gatePassed = true;
        newHealth = stats.healthMax;
      }
    }
  }

  const updates: Record<string, unknown> = {};

  if (actor.type === "character") {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion"] = Math.max(0, stats.evasion - evasionLost);
    if (woundTaken) {
      updates["system.wounds"] = Number((actor.system as any).wounds ?? 0) + 1;
    }
  } else {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion.value"] = Math.max(0, stats.evasion - evasionLost);
    if (gatePassed) {
      updates["system.gates.value"] = Number((actor.system as any).gates?.value ?? 0) + 1;
    }
  }

  await actor.update(updates);

  return {
    name: stats.name,
    damageDealt: damage,
    evasionLost,
    healthLost,
    armor: stats.armor,
    woundTaken,
    gatePassed,
    takenOut,
  };
}

/**
 * Post a damage summary chat message.
 */
export async function postDamageSummary(results: DamageResult[]): Promise<void> {
  const rows = results
    .map((r) => {
      let status = "";
      if (r.takenOut) status = `<span class="damage-status-takenout">${game.i18n.localize("DAWN.Damage.TakenOut")}</span>`;
      else if (r.woundTaken) status = `<span class="damage-status-wound">${game.i18n.localize("DAWN.Damage.WoundTaken")}</span>`;
      else if (r.gatePassed) status = `<span class="damage-status-gate">${game.i18n.localize("DAWN.Damage.GatePassed")}</span>`;

      return `<tr${r.takenOut ? ' class="taken-out-row"' : ""}>
        <td>${r.name}</td>
        <td>${r.damageDealt}</td>
        <td>${r.evasionLost}</td>
        <td>${r.healthLost}</td>
        <td>${r.armor}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");

  const content = `
    <div class="damage-summary">
      <strong>${game.i18n.localize("DAWN.Damage.SummaryTitle")}</strong>
      <table class="damage-summary-table">
        <thead>
          <tr>
            <th>${game.i18n.localize("DAWN.Damage.Target")}</th>
            <th>${game.i18n.localize("DAWN.Damage.Damage")}</th>
            <th>${game.i18n.localize("DAWN.Damage.EvasionLost")}</th>
            <th>${game.i18n.localize("DAWN.Damage.HealthLost")}</th>
            <th>${game.i18n.localize("DAWN.Actor.Character.Armor")}</th>
            <th>${game.i18n.localize("DAWN.Damage.Status")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  await (ChatMessage as any).create({ content });
}

/**
 * Check if the current user may apply damage for this roll.
 * Character rolls: GM only.
 * Adversary rolls: GM, or player if their controlled token's actor is a target.
 */
export function canApplyDamage(fluff: DamageFluffData): boolean {
  const user = (game as any).user;
  if (!user) return false;
  const isGM = user.isGM;
  if (isGM) return true;

  // Player on adversary roll: allow if their controlled token is a target
  if (fluff.actorType === "adversary") {
    const controlled = (canvas as any)?.tokens?.controlled ?? [];
    for (const token of controlled) {
      const match = fluff.targets.find((t: { tokenId: string; sceneId: string }) => t.tokenId === token.id);
      if (match) return true;
    }
  }

  return false;
}
