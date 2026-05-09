const EXPLAIN_ANYWAY = true;

import { getTargetTokens, DamageFluffData } from "../damage/damage.js";

export interface RollParams {
  tag: string;
  dice: number;
  advantage?: number;
  crittingOn?: number;
  tension?: number;
  tensionx?: number;
  bonus?: number;
  actorType?: string;
}

export async function rollAttribute(params: RollParams): Promise<void> {
  const {
    tag,
    dice,
    advantage = 0,
    crittingOn = 6,
    tension = 0,
    tensionx = 0,
    bonus = 0,
    actorType = "character",
  } = params;

  const r = new Roll(`${dice + advantage}d6x>=${crittingOn}cs>=4`);
  await r.evaluate();

  const totalBonus = tension * tensionx + bonus;
  const displayTension = tensionx === 0 ? 0 : tension;

  const crits = r.dice[0].results.filter(d => d.exploded).length;
  const successes = r.dice[0].results.filter(d => d.success).length;
  const result = Math.max(0, successes + totalBonus);

  // Capture targeted tokens (sceneId + tokenId pairs)
  const targetTokens = getTargetTokens();

  // Build target list HTML
  let targetHtml = "";
  if (targetTokens.length > 0) {
    const targetNames: string[] = [];
    for (const t of targetTokens) {
      const scene = (game as any).scenes?.get(t.sceneId);
      const token = scene?.tokens?.get(t.tokenId);
      if (token) targetNames.push(token.name ?? token.actor?.name ?? "Unknown");
    }
    targetHtml = `<div class="damage-targets"><span class="damage-targets-label">${game.i18n.localize("DAWN.Damage.Targets")}:</span> ${targetNames.join(", ")}</div>`;
  }

  const content = `
    <div class="roll-summary">
      <div class="roll-target-block">
        <table class="roll-detail-table">
          <tr><td>${tag}</td><td>${dice}</td></tr>
          ${advantage ? `<tr><td>Advantage</td><td>${advantage}</td></tr>` : ""}
          <tr><td>Critting On</td><td>${crittingOn}</td></tr>
          ${displayTension ? `<tr><td>Tension</td><td>${displayTension}</td></tr>` : ""}
          ${tensionx ? `<tr><td>Tension X</td><td>${tensionx}</td></tr>` : ""}
          ${bonus ? `<tr><td>Bonus</td><td>${bonus}</td></tr>` : ""}
          <tr><td>Crits</td><td>${crits}</td></tr>
          <tr><td>Hits</td><td>${r.toAnchor().outerHTML}</td></tr>
          <tr class="roll-result-row"><td>Result</td><td>${result}</td></tr>
        </table>
      </div>
      ${targetHtml}
    </div>
  `;

  // Build fluff data for damage system
  const speaker = ChatMessage.getSpeaker();
  const fluffData: DamageFluffData = {
    result,
    targets: targetTokens,
    actorType,
    rollerActorId: (speaker as any)?.actorID ?? "",
  };

  // Create message and store damage data as a flag for the renderChatMessageHTML hook
  const msg = (await ChatMessage.create({
    content,
    speaker,
    rolls: [r],
  })) as any;

  await msg.setFlag("dawn-system", "damage", fluffData);
}

function row(tag: string, value: unknown, always = false): string {
  if (always || (value !== 0 && value !== "")) {
    return `<tr><td><strong>${tag}</strong></td><td><strong>${value}</strong></td></tr>`;
  }
  return "";
}

export interface RollDialogDefaults {
  dice?: number;
  advantage?: number;
  crittingOn?: number;
  tension?: number;
  tensionx?: number;
  bonus?: number;
}

export async function openRollDialog(tag: string, defaultDice: number, actor: unknown, defaults?: RollDialogDefaults): Promise<void> {
  const locTag = (game as any).i18n.localize(tag);
  const tensionValue = game.settings.get("dawn-system", "tension") as number;
  const d = defaults ?? {};
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Roll: ${locTag}` },
    content: `
      <div class="form-group">
        <label>Dice</label>
        <input type="number" name="dice" value="${d.dice ?? defaultDice}" min="1" autofocus />
      </div>
      <div class="form-group">
        <label>Advantage</label>
        <input type="number" name="advantage" value="${d.advantage ?? 0}" />
      </div>
      <div class="form-group">
        <label>Critting On</label>
        <input type="number" name="crittingOn" value="${d.crittingOn ?? 6}" min="2" max="6" />
      </div>
      <div class="form-group">
        <label>Tension</label>
        <input type="number" name="tension" value="${d.tension ?? tensionValue}" />
      </div>
      <div class="form-group">
        <label>Tension Multiplier</label>
        <input type="number" name="tensionx" value="${d.tensionx ?? 0}" />
      </div>
      <div class="form-group">
        <label>Bonus</label>
        <input type="number" name="bonus" value="${d.bonus ?? 0}" />
      </div>
    `,
    ok: { label: "Roll", icon: "fa-solid fa-dice-d6" },
    rejectClose: false,
  });

  if (!formData) return;

  const actorType = (actor as any)?.type ?? "character";

  await rollAttribute({
    tag: locTag,
    dice: Number(formData.dice),
    advantage: Number(formData.advantage),
    crittingOn: Number(formData.crittingOn),
    tension: Number(formData.tension),
    tensionx: Number(formData.tensionx),
    bonus: Number(formData.bonus),
    actorType,
  });
}
