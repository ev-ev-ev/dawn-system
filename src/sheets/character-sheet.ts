import { openRollDialog } from "../dice/roll.js";
import { LearnTechniqueDialog } from "../apps/learn-technique-dialog.js";
import { LearnAbilityDialog } from "../apps/learn-ability-dialog.js";
import { openSelfDamageDialog, applySelfDamage, postDamageSummary } from "../damage/damage.js";

export class CharacterSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "actor", "character"],
    window: { title: "DAWN.Sheet.Character.Title", resizable: true },
    position: { width: 480, height: 640 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttr: CharacterSheet._onRollAttr,
      rollGeneric: CharacterSheet._onRollGeneric,
      applyDamage: CharacterSheet._onApplyDamage,
      deleteItem: CharacterSheet._onDeleteItem,
      openItem: CharacterSheet._onOpenItem,
      chatItem: CharacterSheet._onChatItem,
      learnTechnique: CharacterSheet._onLearnTechnique,
      toggleWound: CharacterSheet._onToggleWound,
      toggleStress: CharacterSheet._onToggleStress,
      rollSkill: CharacterSheet._onRollSkill,
      addCustomSkill: CharacterSheet._onAddCustomSkill,
      removeCustomSkill: CharacterSheet._onRemoveCustomSkill,
      learnAbility: CharacterSheet._onLearnAbility,
      removeAbilityVerb: CharacterSheet._onRemoveAbilityVerb,
      removeAbilityNoun: CharacterSheet._onRemoveAbilityNoun,
      removeAbilityCondition: CharacterSheet._onRemoveAbilityCondition,
      addBond: CharacterSheet._onAddBond,
      removeBond: CharacterSheet._onRemoveBond,
      chatBond: CharacterSheet._onChatBond,
      addBondAction: CharacterSheet._onAddBondAction,
      removeBondAction: CharacterSheet._onRemoveBondAction,
      chatBondAction: CharacterSheet._onChatBondAction,
    },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/actors/character-sheet.hbs",
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "structured", icon: "fa-solid fa-list" },
        { id: "unstructured", icon: "fa-solid fa-feather" },
      ],
      initial: "structured",
      labelPrefix: "DAWN.Sheet.Character.Tab",
    },
  };

  private _scrollTop = 0;

  async _preRender(_context: object, _options: object) {
    await super._preRender(_context, _options);
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    const body = el.querySelector(".dawn-sheet.sheet-body");
    if (body) this._scrollTop = (body as HTMLElement).scrollTop;
  }

  async _onRender(_context: object, _options: object) {
    await super._onRender(_context, _options);
    const el = (this as any).element as HTMLElement | undefined;
    if (!el) return;
    const scrollTop = this._scrollTop;
    setTimeout(() => {
      const body = el.querySelector(".dawn-sheet.sheet-body");
      if (body) (body as HTMLElement).scrollTop = scrollTop;
    }, 0);
  }

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: foundry.documents.BaseActor }).document;
    const allItems = ((document as unknown as { items: foundry.documents.BaseItem[] }).items ?? []);
    const techniques = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "technique")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => {
        const sa = a.system as Record<string, unknown>;
        const sb = b.system as Record<string, unknown>;
        const techCmp = String(sa.tech ?? "").localeCompare(String(sb.tech ?? ""));
        if (techCmp !== 0) return techCmp;
        return Number(sa.level ?? 1) - Number(sb.level ?? 1);
      });
    const woundsValue = Number((document.system as any).wounds ?? 0);
    const woundBoxes = Array.from({ length: 3 }, (_, i) => ({ index: i, checked: i < woundsValue }));
    const stressValue = Number((document.system as any).stress ?? 0);
    const stressBoxes = Array.from({ length: 3 }, (_, i) => ({ index: i, checked: i < stressValue }));
    const SKILL_GROUPS = [
      { attr: "body",    skills: ["break", "endure", "menace", "defend"] },
      { attr: "talent",  skills: ["finesse", "lurk", "move", "react"] },
      { attr: "spirit",  skills: ["absorb", "intuit", "connect", "luck"] },
      { attr: "mind",    skills: ["deceive", "command", "unveil", "tinker"] },
    ];
    const skillsData = ((document.system as any).skills ?? {}) as Record<string, number>;
    const skillGroups = SKILL_GROUPS.map(group => ({
      labelKey: `DAWN.Actor.Character.${group.attr.charAt(0).toUpperCase() + group.attr.slice(1)}`,
      skills: group.skills.map(key => ({
        key,
        attr: group.attr,
        labelKey: `DAWN.Actor.Character.Skills.${key.charAt(0).toUpperCase() + key.slice(1)}`,
        tooltipKey: `DAWN.Actor.Character.Skills.${key.charAt(0).toUpperCase() + key.slice(1)}Tooltip`,
        value: skillsData[key] ?? 0,
      })),
    }));
    const ability = (document.system as any).ability ?? {};
    const hasAbilityContent = !!(ability.verbs?.length || ability.nouns?.length || ability.conditions?.length);
    return Object.assign(context, {
      system: document.system,
      techniques,
      woundBoxes,
      stressBoxes,
      skillGroups,
      hasAbilityContent,
      attrOptions: {
        body: "DAWN.Actor.Character.Body",
        talent: "DAWN.Actor.Character.Talent",
        spirit: "DAWN.Actor.Character.Spirit",
        mind: "DAWN.Actor.Character.Mind",
      },
    });
  }

  static async _onRollAttr(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const attr = target.dataset.attr as string;
    const system = (this as any).document.system as Record<string, unknown>;
    const dice = Number(system[attr] ?? 2);
    const labelKey = `DAWN.Actor.Character.${attr.charAt(0).toUpperCase() + attr.slice(1)}`;
    await openRollDialog(labelKey, dice, (this as any).document);
  }

  static async _onRollGeneric(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    await openRollDialog((this as any).document.name, 2, (this as any).document);
  }

  static async _onApplyDamage(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const actor = (this as any).document;
    const damage = await openSelfDamageDialog(actor, 1);
    if (damage === null || damage === undefined || damage < 1) return;
    const r = await applySelfDamage(actor, damage);
    if (r) await postDamageSummary([r]);
  }

  static async _onDeleteItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { delete(): Promise<unknown> }) | undefined;
    await item?.delete();
  }

  static async _onOpenItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { sheet: { render(force: boolean): void } }) | undefined;
    item?.sheet?.render(true);
  }

  static async _onLearnTechnique(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const dialog = new LearnTechniqueDialog((this as any).document);
    await dialog.render(true);
  }

  static async _onChatItem(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as foundry.documents.BaseItem | undefined;
    if (!item) return;
    const s = item.system as Record<string, unknown>;
    const e = foundry.utils.escapeHTML;
    const content = `<strong>${e(item.name)}</strong> <span style="opacity:0.7;font-size:0.85em">(${e(s.tech ?? "")} #${s.level ?? 1})</span><hr>${e(s.text ?? "")}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onToggleWound(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.woundIndex);
    const current = Number((this as any).document.system.wounds ?? 0);
    const newValue = index < current ? current - 1 : current + 1;
    await (this as any).document.update({ "system.wounds": newValue });
  }

  static async _onToggleStress(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.stressIndex);
    const current = Number((this as any).document.system.stress ?? 0);
    const newValue = index < current ? current - 1 : current + 1;
    await (this as any).document.update({ "system.stress": newValue });
  }

  static async _onRollSkill(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const skill = target.dataset.skill as string;
    const attr = target.dataset.attr as string;
    const system = (this as any).document.system as Record<string, unknown>;
    const dice = Number((system as Record<string, number>)[attr] ?? 2);
    const advantage = Number((system.skills as Record<string, number>)[skill] ?? 0);
    const labelKey = `DAWN.Actor.Character.Skills.${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
    await openRollDialog(labelKey, dice, (this as any).document, { advantage });
  }

  static async _onAddCustomSkill(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const current = [...((this as any).document.system.customSkills as Array<{ label: string; value: number }> ?? [])];
    current.push({ label: "", value: 0 });
    await (this as any).document.update({ "system.customSkills": current });
  }

  static async _onRemoveCustomSkill(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.skillIndex);
    const current = [...((this as any).document.system.customSkills as Array<{ label: string; value: number }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.customSkills": current });
  }

  static async _onLearnAbility(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const dialog = new LearnAbilityDialog((this as any).document);
    await dialog.render(true);
  }

  static async _onRemoveAbilityVerb(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.verbIndex);
    const current = [...((this as any).document.system.ability.verbs as Array<{ text: string; cost: number }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.ability.verbs": current });
  }

  static async _onRemoveAbilityNoun(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.nounIndex);
    const current = [...((this as any).document.system.ability.nouns as Array<{ text: string; cost: number }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.ability.nouns": current });
  }

  static async _onRemoveAbilityCondition(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.conditionIndex);
    const current = [...((this as any).document.system.ability.conditions as Array<{ text: string; cost: number }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.ability.conditions": current });
  }

  static async _onAddBond(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const current = [...((this as any).document.system.bonds as Array<{ target: string; tags: string; rank: number }> ?? [])];
    current.push({ target: "", tags: "", rank: 1 });
    await (this as any).document.update({ "system.bonds": current });
  }

  static async _onRemoveBond(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.bondIndex);
    const current = [...((this as any).document.system.bonds as Array<{ target: string; tags: string; rank: number }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.bonds": current });
  }

  static async _onChatBond(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.bondIndex);
    const bond = ((this as any).document.system.bonds as Array<{ target: string; tags: string; rank: number }>)[index];
    if (!bond) return;
    const e = foundry.utils.escapeHTML;
    const tags = bond.tags ? `<span style="opacity:0.7;font-size:0.85em">${e(bond.tags)}</span>` : "";
    const content = `<strong>${e(bond.target || "(unnamed)")}</strong> &middot; Rank ${bond.rank}${tags ? "<br>" + tags : ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onAddBondAction(this: CharacterSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const current = [...((this as any).document.system.bondActions as Array<{ name: string; description: string }> ?? [])];
    current.push({ name: "", description: "" });
    await (this as any).document.update({ "system.bondActions": current });
  }

  static async _onRemoveBondAction(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.bondActionIndex);
    const current = [...((this as any).document.system.bondActions as Array<{ name: string; description: string }> ?? [])];
    current.splice(index, 1);
    await (this as any).document.update({ "system.bondActions": current });
  }

  static async _onChatBondAction(this: CharacterSheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.bondActionIndex);
    const action = ((this as any).document.system.bondActions as Array<{ name: string; description: string }>)[index];
    if (!action) return;
    const e = foundry.utils.escapeHTML;
    const content = `<strong>${e(action.name || "(unnamed)")}</strong>${action.description ? "<hr>" + e(action.description) : ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }
}
