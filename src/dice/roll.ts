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
    <table>
      ${row(tag, dice, EXPLAIN_ANYWAY)}
      ${row("Advantage", advantage)}
      ${row("Critting On", crittingOn)}
      ${row("Tension", displayTension)}
      ${row("Tension X", tensionx)}
      ${row("Bonus", bonus)}
      ${row("Crits", crits)}
      ${row("Hits", r.toAnchor().outerHTML, EXPLAIN_ANYWAY)}
      ${row("Result", result, EXPLAIN_ANYWAY)}
    </table>
    ${targetHtml}
  `;

  // Build fluff data for damage system
  const speaker = ChatMessage.getSpeaker();
  const fluffData: DamageFluffData = {
    result,
    targets: targetTokens,
    actorType,
    rollerActorId: (speaker as any)?.actorID ?? "",
  };

  // Create message, then store damage data as a flag for renderHook
  const msg = await ChatMessage.create({
    content,
    speaker,
    rolls: [r],
    renderHook: `
      (async () => {
        try {
          const msg = arguments[0];
          const fluffRaw = msg.getFlag("dawn-system", "damage");
          if (!fluffRaw) return;
          const fluff = typeof fluffRaw === "string" ? JSON.parse(fluffRaw) : fluffRaw;
          if (!fluff.targets || !fluff.targets.length || fluff.result < 1) return;
          const { canApplyDamage } = await import("systems/dawn-system/dist/dawn-system.mjs");
          if (!canApplyDamage(fluff)) return;
          const btn = document.createElement("button");
          btn.className = "damage-apply-btn";
          btn.innerHTML = '<i class="fa-solid fa-heart-crack"></i> ' + game.i18n.localize("DAWN.Damage.Apply");
          btn.addEventListener("click", async () => {
            const damage = await openDamageDialogFromChat(fluff);
            if (damage === null || damage === undefined) return;
            const results = [];
            for (const t of fluff.targets) {
              const r = await applyDamageToTarget(t.tokenId, t.sceneId, damage);
              if (r) results.push(r);
            }
            if (results.length) await postDamageSummary(results);
          });
          const footer = msg.element.querySelector(".message-footer");
          if (footer) footer.prepend(btn);
        } catch(e) { console.warn("dawn-system damage renderHook error", e); }
      })();
    `,
  } as any);

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
