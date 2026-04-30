const EXPLAIN_ANYWAY = true;

export interface RollParams {
  tag: string;
  dice: number;
  advantage?: number;
  crittingOn?: number;
  tension?: number;
  tensionx?: number;
  bonus?: number;
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
  } = params;

  const r = new Roll(`${dice + advantage}d6x>=${crittingOn}cs>=4`);
  await r.evaluate();

  const totalBonus = tension * tensionx + bonus;
  const displayTension = tensionx === 0 ? 0 : tension;

  const crits = r.dice[0].results.filter(d => d.exploded).length;
  const successes = r.dice[0].results.filter(d => d.success).length;
  const result = Math.max(0, successes + totalBonus);

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
  `;

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker(),
    rolls: [r],
  });
}

function row(tag: string, value: unknown, always = false): string {
  if (always || (value !== 0 && value !== "")) {
    return `<tr><td><strong>${tag}</strong></td><td><strong>${value}</strong></td></tr>`;
  }
  return "";
}

export async function openRollDialog(tag: string, defaultDice: number, actor: unknown): Promise<void> {
  const locTag = (game as any).i18n.localize(tag);
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Roll: ${locTag}` },
    content: `
      <div class="form-group">
        <label>Dice</label>
        <input type="number" name="dice" value="${defaultDice}" min="1" autofocus />
      </div>
      <div class="form-group">
        <label>Advantage</label>
        <input type="number" name="advantage" value="0" />
      </div>
      <div class="form-group">
        <label>Critting On</label>
        <input type="number" name="crittingOn" value="6" min="2" max="6" />
      </div>
      <div class="form-group">
        <label>Tension</label>
        <input type="number" name="tension" value="0" />
      </div>
      <div class="form-group">
        <label>Tension Multiplier</label>
        <input type="number" name="tensionx" value="0" />
      </div>
      <div class="form-group">
        <label>Bonus</label>
        <input type="number" name="bonus" value="0" />
      </div>
    `,
    ok: { label: "Roll", icon: "fa-solid fa-dice-d6" },
    rejectClose: false,
  });

  if (!formData) return;

  await rollAttribute({
    tag: locTag,
    dice: Number(formData.dice),
    advantage: Number(formData.advantage),
    crittingOn: Number(formData.crittingOn),
    tension: Number(formData.tension),
    tensionx: Number(formData.tensionx),
    bonus: Number(formData.bonus),
  });
}
