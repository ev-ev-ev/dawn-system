export interface ActorStats {
  name: string;
  healthValue: number;
  healthMax: number;
  evasion: number;
  armor: number;
  actorType: string;
}

export interface TargetStats extends ActorStats {
  tokenId: string;
  sceneId: string;
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
 * Read core stats from an actor (no token info).
 */
function readActorStats(actor: foundry.documents.BaseActor): ActorStats {
  const s = actor.system as Record<string, unknown>;

  if (actor.type === "character") {
    const healthObj = s.health as { value?: number; max?: number };
    return {
      name: actor.name,
      healthValue: Number(healthObj?.value ?? 0),
      healthMax: Number(healthObj?.max ?? 0),
      evasion: Number(s.evasion ?? 0),
      armor: Number(s.armor ?? 0),
      actorType: "character",
    };
  }

  if (actor.type === "terrain") {
    return {
      name: actor.name,
      healthValue: Number(s.health ?? 0),
      healthMax: 0,
      evasion: 0,
      armor: 0,
      actorType: "terrain",
    };
  }

  if (actor.type === "fodder") {
    return {
      name: actor.name,
      healthValue: Number(s.health ?? 0),
      healthMax: 0,
      evasion: 0,
      armor: 0,
      actorType: "fodder",
    };
  }

  const healthObj = s.health as { value?: number; max?: number };
  const evasionObj = s.evasion as { value?: number; max?: number };
  const derived = computeAdversaryDerivedStats(actor);
  return {
    name: actor.name,
    healthValue: Number(healthObj?.value ?? 0),
    healthMax: derived.healthMax,
    evasion: Number(evasionObj?.value ?? 0),
    armor: derived.armor,
    actorType: "adversary",
  };
}

/**
 * Read target stats for a given token (includes tokenId/sceneId).
 */
function readTargetStatsFromToken(token: any, actor: foundry.documents.BaseActor): TargetStats {
  const base = readActorStats(actor);
  return {
    ...base,
    tokenId: token.id,
    sceneId: (token.scene as { id?: string })?.id ?? "",
  };
}

/**
 * Compute adversary armor + healthMax from attached items.
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
 * Read target stats for a given token ID.
 */
export async function readTargetStats(tokenId: string, sceneId: string): Promise<TargetStats | null> {
  const token = resolveToken(sceneId, tokenId);
  if (!token) return null;
  const actor = token.actor;
  if (!actor) return null;
  return readTargetStatsFromToken(token, actor);
}

/**
 * Core damage computation and persistence for an actor.
 */
async function applyDamageToActor(actor: foundry.documents.BaseActor, damage: number): Promise<DamageResult> {
  const stats = readActorStats(actor);

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

  // Step 3: increment wound/gate first, then check taken-out
  if (newHealth <= 0) {
    if (actor.type === "character") {
      const newWounds = Number((actor.system as any).wounds ?? 0) + 1;
      if (newWounds >= 3) {
        takenOut = true;
      } else {
        woundTaken = true;
        newHealth = stats.healthMax;
      }
    } else if (actor.type === "terrain" || actor.type === "fodder") {
      takenOut = true;
    } else {
      const newGates = Number((actor.system as any).gates?.value ?? 0) + 1;
      const components = (actor as any).items?.filter((i: foundry.documents.BaseItem) => i.type === "component") ?? [];
      if (newGates >= components.length) {
        takenOut = true;
      } else {
        gatePassed = true;
        newHealth = stats.healthMax;
      }
    }
  }

  // Persist updates
  const updates: Record<string, unknown> = {};

  if (actor.type === "character") {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion"] = Math.max(0, stats.evasion - evasionLost);
    if (woundTaken || takenOut) {
      updates["system.wounds"] = Number((actor.system as any).wounds ?? 0) + 1;
    }
  } else if (actor.type === "terrain" || actor.type === "fodder") {
    updates["system.health"] = Math.max(0, newHealth);
  } else {
    updates["system.health.value"] = Math.max(0, newHealth);
    updates["system.evasion.value"] = Math.max(0, stats.evasion - evasionLost);
    if (gatePassed || takenOut) {
      updates["system.gates.value"] = Number((actor.system as any).gates?.value ?? 0) + 1;
    }
  }

  await actor.update(updates);

  if (takenOut) {
    await markTakenOut(actor);
  }

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
 * Apply the "dead" status effect and mark combatant as defeated.
 */
async function markTakenOut(actor: foundry.documents.BaseActor): Promise<void> {
  // Apply dead status effect if not already present.
  if (!actor.statuses.has("dead")) {
    await (actor as any).toggleStatusEffect("dead", { active: true, overlay: true });
  }

  // Mark as defeated in combat if they're a combatant.
  const combat = game.combat;
  if (combat?.started) {
    const combatants = (combat as any).combatants ?? [];
    for (const combatant of combatants) {
      if (combatant.actorId === actor.id && !combatant.defeated) {
        await combatant.update({ defeated: true });
        break;
      }
    }
  }
}

/**
 * Apply damage to a single token following Dawn System rules.
 */
export async function applyDamageToTarget(tokenId: string, sceneId: string, damage: number): Promise<DamageResult | null> {
  const token = resolveToken(sceneId, tokenId);
  if (!token) return null;
  const actor = token.actor;
  if (!actor) return null;
  return applyDamageToActor(actor, damage);
}

/**
 * Apply damage to the sheet's own actor directly.
 */
export async function applySelfDamage(actor: foundry.documents.BaseActor, damage: number): Promise<DamageResult> {
  return applyDamageToActor(actor, damage);
}

/**
 * Build dialog content HTML for a list of stats.
 */
function buildDialogContent(statsList: ActorStats[]): string {
  const rows = statsList
    .map(
      (s) =>
        `<tr><td>${foundry.utils.escapeHTML(s.name)}</td><td>${s.healthValue} / ${s.healthMax}</td><td>${s.evasion}</td><td>${s.armor}</td></tr>`
    )
    .join("");

  return `
    <div class="form-group">
      <label>${game.i18n.localize("DAWN.Damage.Amount")}</label>
      <input type="number" name="damage" value="0" min="0" autofocus />
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
  `;
}

/**
 * Open the damage dialog. Returns the damage amount chosen, or null if cancelled.
 */
export async function openDamageDialog(targetTokens: Array<{ tokenId: string; sceneId: string }>, defaultDamage: number): Promise<number | null> {
  const statsList: ActorStats[] = [];
  for (const t of targetTokens) {
    const token = resolveToken(t.sceneId, t.tokenId);
    if (token?.actor) statsList.push(readActorStats(token.actor));
  }
  if (statsList.length === 0) return null;

  const content = buildDialogContent(statsList);
  const formData = await showDialog(content, defaultDamage);
  if (!formData) return null;
  return Number(formData.damage);
}

/**
 * Open damage dialog for the sheet's own actor (self-damage).
 */
export async function openSelfDamageDialog(actor: foundry.documents.BaseActor, defaultDamage: number): Promise<number | null> {
  const stats = readActorStats(actor);
  const content = buildDialogContent([stats]);
  const formData = await showDialog(content, defaultDamage);
  if (!formData) return null;
  return Number(formData.damage);
}

/**
 * Shared dialog builder.
 */
async function showDialog(contentHtml: string, defaultDamage: number): Promise<Record<string, unknown> | null> {
  const content = contentHtml.replace('value="0"', `value="${defaultDamage}"`);
  return foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize("DAWN.Damage.DialogTitle") },
    content,
    ok: { label: game.i18n.localize("DAWN.Damage.Confirm"), icon: "fa-solid fa-heart-crack" },
    rejectClose: false,
  });
}

/**
 * Post a damage summary chat message.
 */
export async function postDamageSummary(results: DamageResult[]): Promise<void> {
  const targetBlocks = results
    .map((r) => {
      let status = "";
      if (r.takenOut) status = `<span class="damage-status-takenout">${game.i18n.localize("DAWN.Damage.TakenOut")}</span>`;
      else if (r.woundTaken) status = `<span class="damage-status-wound">${game.i18n.localize("DAWN.Damage.WoundTaken")}</span>`;
      else if (r.gatePassed) status = `<span class="damage-status-gate">${game.i18n.localize("DAWN.Damage.GatePassed")}</span>`;

      return `<div class="damage-target-block${r.takenOut ? ' taken-out' : ''}">
        <div class="damage-target-name">${foundry.utils.escapeHTML(r.name)}</div>
        <table class="damage-detail-table">
          <tr><td>${game.i18n.localize("DAWN.Damage.Damage")}</td><td>${r.damageDealt}</td></tr>
          <tr><td>${game.i18n.localize("DAWN.Damage.EvasionLost")}</td><td>${r.evasionLost}</td></tr>
          <tr><td>${game.i18n.localize("DAWN.Actor.Character.Armor")}</td><td>${r.armor}</td></tr>
          <tr><td>${game.i18n.localize("DAWN.Damage.HealthLost")}</td><td>${r.healthLost}</td></tr>
          ${status ? `<tr><td>${game.i18n.localize("DAWN.Damage.Status")}</td><td>${status}</td></tr>` : ""}
        </table>
      </div>`;
    })
    .join("");

  const content = `
    <div class="damage-summary">
      <strong>${game.i18n.localize("DAWN.Damage.SummaryTitle")}</strong>
      ${targetBlocks}
    </div>
  `;

  await (ChatMessage as any).create({ content });
}

/**
 * Check if the current user may apply damage for this roll.
 * Character rolls: GM only.
 * Adversary rolls: GM, or player if their controlled token is a target.
 */
export function canApplyDamage(fluff: DamageFluffData): boolean {
  const user = game.user;
  if (!user) return false;
  if (user.isGM) return true;

  // Player on adversary roll: allow if their controlled token is a target
  if (fluff.actorType === "adversary") {
    const controlled = canvas?.tokens?.controlled ?? [];
    for (const token of controlled) {
      const match = fluff.targets.find((t: { tokenId: string; sceneId: string }) => t.tokenId === token.id);
      if (match) return true;
    }
  }

  return false;
}

/**
 * Get the targets the current user is allowed to damage.
 * GM gets all targets. Player gets only their own controlled tokens.
 */
export function getOwnedTargets(fluff: DamageFluffData): Array<{ tokenId: string; sceneId: string }> {
  const user = game.user;
  if (!user) return [];
  if (user.isGM) return fluff.targets;

  // Player: only their controlled tokens
  const controlled = canvas?.tokens?.controlled ?? [];
  const controlledIds = new Set(controlled.map((t: { id: string }) => t.id));
  return fluff.targets.filter((t: { tokenId: string; sceneId: string }) => controlledIds.has(t.tokenId));
}
