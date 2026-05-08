import { openRollDialog } from "../dice/roll.js";

export class AdversarySheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "actor", "adversary"],
    window: { title: "DAWN.Sheet.Adversary.Title", resizable: true },
    position: { width: 480, height: 640 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      printEdge: AdversarySheet._onPrintEdge,
      printTechnique: AdversarySheet._onPrintTechnique,
      printComponent: AdversarySheet._onPrintComponent,
      deleteItem: AdversarySheet._onDeleteItem,
      openItem: AdversarySheet._onOpenItem,
      toggleGate: AdversarySheet._onToggleGate,
      rollAttack: AdversarySheet._onRollAttack,
      chatPassive: AdversarySheet._onChatPassive,
      chatAction: AdversarySheet._onChatAction,
      chatAttack: AdversarySheet._onChatAttack,
      chatAce: AdversarySheet._onChatAce,
    },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/actors/adversary-sheet.hbs",
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: "main", icon: "fa-solid fa-id-card" },
        { id: "components", icon: "fa-solid fa-puzzle-piece" },
      ],
      initial: "main",
      labelPrefix: "DAWN.Sheet.Adversary.Tab",
    },
  };

  private _scrollTop = 0;
  private _passives: Array<{ source: string; text: string }> = [];
  private _actions: Array<{ source: string; name: string; text: string }> = [];
  private _attacks: Array<{ source: string; name: string; dice: number; tensionx: number; text: string }> = [];
  private _aces: Array<{ source: string; name: string; tension: number; text: string }> = [];

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

    const edges = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "edge")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const npcTechniques = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "modifier")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const npcComponents = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "component")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const system = document.system as Record<string, unknown>;
    const tier = Number((system as any).tier ?? 1);
    const { healthMax, gatesMax, speed, armor, evasionMax } = AdversarySheet._computeDerived(npcComponents, npcTechniques, tier);
    const gatesValue: number = Number((system.gates as Record<string, unknown>)?.value ?? 0);
    const gateBoxes = Array.from({ length: gatesMax }, (_, i) => ({
      index: i,
      checked: i < gatesValue,
    }));

    // Aggregate passives, actions, attacks, aces from all attached components and modifiers.
    const allNpcItems = [...npcComponents, ...npcTechniques];
    const { passives, actions, attacks, aces } = AdversarySheet._aggregateAbilities(allNpcItems, tier);

    // Store data for chat action handlers.
    this._passives = passives;
    this._actions = actions;
    this._attacks = attacks.map((a) => ({
      source: a.source,
      name: a.name,
      dice: a.dice,
      tensionx: a.tensionx,
      text: a.text,
    }));
    this._aces = aces;

    return Object.assign(context, {
      system: document.system,
      edges,
      npcTechniques,
      npcComponents,
      healthMax,
      gatesMax,
      gateBoxes,
      speed,
      armor,
      evasionMax,
      passives,
      actions,
      attacks,
      aces,
    });
  }

  static _computeDerived(components: foundry.documents.BaseItem[], modifiers: foundry.documents.BaseItem[], tier: number): { healthMax: number; gatesMax: number; speed: number; armor: number; evasionMax: number } {
    const gatesMax = components.length;
    if (gatesMax === 0) return { healthMax: 0, gatesMax: 0, speed: 0, armor: 0, evasionMax: 0 };
    const total = components.reduce((sum, comp) => {
      const cs = comp.system as Record<string, unknown>;
      return sum + (Number(cs.basehp ?? 0) + Number(cs.tierhp ?? 0) * tier);
    }, 0);
    // Compute mode speed: most common value, highest wins ties.
    const speedCounts: Record<number, number> = {};
    for (const comp of components) {
      const cs = comp.system as Record<string, unknown>;
      const s = Number(cs.speed ?? 0);
      speedCounts[s] = (speedCounts[s] ?? 0) + 1;
    }
    let speed = 0;
    let maxCount = 0;
    for (const [s, count] of Object.entries(speedCounts)) {
      const num = Number(s);
      if (count > maxCount || (count === maxCount && num > speed)) {
        speed = num;
        maxCount = count;
      }
    }
    // Compute armor: max component (tierarmor × tier) + sum of modifier armor bonuses.
    let maxComponentArmor = 0;
    for (const comp of components) {
      const cs = comp.system as Record<string, unknown>;
      const a = Number(cs.tierarmor ?? 0) * tier;
      if (a > maxComponentArmor) maxComponentArmor = a;
    }
    let modifierArmorBonus = 0;
    for (const mod of modifiers) {
      const ms = mod.system as Record<string, unknown>;
      modifierArmorBonus += Number(ms.basearmor ?? 0) + Number(ms.tierarmor ?? 0) * tier;
    }
    // Compute evasion: sum of modifier evasion bonuses (baseevasion + tierevasion × tier).
    let evasionMax = 0;
    for (const mod of modifiers) {
      const ms = mod.system as Record<string, unknown>;
      evasionMax += Number(ms.baseevasion ?? 0) + Number(ms.tierevasion ?? 0) * tier;
    }
    return { healthMax: Math.ceil(total / gatesMax), gatesMax, speed, armor: maxComponentArmor + modifierArmorBonus, evasionMax };
  }

  static _aggregateAbilities(items: foundry.documents.BaseItem[], tier: number): {
    passives: Array<{ source: string; text: string }>;
    actions: Array<{ source: string; name: string; text: string }>;
    attacks: Array<{ source: string; name: string; dice: number; roll: string; tensionx: number; text: string }>;
    aces: Array<{ source: string; name: string; tension: number; text: string }>;
  } {
    const passives: Array<{ source: string; text: string }> = [];
    const actions: Array<{ source: string; name: string; text: string }> = [];
    const attacks: Array<{ source: string; name: string; dice: number; roll: string; tensionx: number; text: string }> = [];
    const aces: Array<{ source: string; name: string; tension: number; text: string }> = [];

    for (const item of items) {
      const s = item.system as Record<string, unknown>;
      const source = String(item.name ?? "");

      if (s.passive && String(s.passive).trim()) {
        passives.push({ source, text: String(s.passive) });
      }
      if (s.actionname && String(s.actionname).trim()) {
        actions.push({ source, name: String(s.actionname), text: String(s.action ?? "") });
      }
      if (s.attackname && String(s.attackname).trim()) {
        const dice = Number(s.attackdice ?? 0) + Number(s.attacktierdice ?? 0) * tier;
        attacks.push({
          source,
          name: String(s.attackname),
          dice,
          roll: dice > 0 ? `${dice}d6` : `0d6`,
          tensionx: Number(s.attacktensionx ?? 0),
          text: String(s.attack ?? ""),
        });
      }
      if (s.acename && String(s.acename).trim()) {
        aces.push({ source, name: String(s.acename), tension: Number(s.acetension ?? 0), text: String(s.ace ?? "") });
      }
    }

    return { passives, actions, attacks, aces };
  }

  static async _onPrintEdge(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as foundry.documents.BaseItem | undefined;
    if (!item) return;
    const s = item.system as Record<string, unknown>;
    const content = `<strong>${item.name}</strong><hr>${s.flavor ?? ""}${s.defense ? `<p><strong>${s.defensename ?? "Defense"}</strong>: ${s.defense}</p>` : ""}${s.turn ? `<p><strong>${s.turnname ?? "Turn"}</strong>: ${s.turn}</p>` : ""}${s.phase ? `<p><strong>${s.phasename ?? "Phase"}</strong>: ${s.phase}</p>` : ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onPrintTechnique(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as foundry.documents.BaseItem | undefined;
    if (!item) return;
    const s = item.system as Record<string, unknown>;
    const content = `<strong>${item.name}</strong> <span style="opacity:0.7;font-size:0.85em">(${s.tech ?? ""} #${s.level ?? 1})</span><hr>${s.text ?? ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onPrintComponent(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as foundry.documents.BaseItem | undefined;
    if (!item) return;
    const s = item.system as Record<string, unknown>;
    const content = `<strong>${item.name}</strong><hr>${s.flavor ?? ""}<p><strong>HP</strong>: ${s.basehp ?? 0} + ${s.tierhp ?? 0} × Tier</p><p><strong>Speed</strong>: ${s.speed ?? 0}</p><p><strong>Armor</strong>: ${s.tierarmor ?? 0}</p>${s.passive ? `<p><strong>Passive</strong>: ${s.passive}</p>` : ""}${s.actionname ? `<p><strong>${s.actionname}</strong>: ${s.action}</p>` : ""}${s.attackname ? `<p><strong>${s.attackname}</strong>: ${s.attack} [${s.attackdice ?? 0}d6${s.attacktierdice ? `+${s.attacktierdice}d6` : ""}${s.attacktensionx ? ` × Tension` : ""}]</p>` : ""}${s.acename ? `<p><strong>${s.acename}</strong>: ${s.ace} (Min Tension: ${s.acetension ?? 0})</p>` : ""}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onDeleteItem(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { delete(): Promise<unknown> }) | undefined;
    await item?.delete();
  }

  static async _onOpenItem(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const itemId = target.closest("[data-item-id]")?.getAttribute("data-item-id");
    if (!itemId) return;
    const item = (this as any).document.items.get(itemId) as (foundry.documents.BaseItem & { sheet: { render(force: boolean): void } }) | undefined;
    item?.sheet?.render(true);
  }

  static async _onToggleGate(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.gateIndex);
    const current = Number((this as any).document.system.gates?.value ?? 0);
    const newValue = index < current ? current - 1 : current + 1;
    await (this as any).document.update({ "system.gates.value": newValue });
  }

  static async _onRollAttack(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.attackIndex);
    const attack = (this as any)._attacks[index];
    if (!attack) return;
    await openRollDialog(
      attack.name,
      attack.dice,
      (this as any).document,
      { tensionx: attack.tensionx }
    );
  }

  static async _onChatPassive(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.abilityIndex);
    const passive = (this as any)._passives[index];
    if (!passive) return;
    const content = `<strong>Passive</strong> <span style="opacity:0.7;font-size:0.85em">(${passive.source})</span><hr>${passive.text}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onChatAction(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.abilityIndex);
    const action = (this as any)._actions[index];
    if (!action) return;
    const content = `<strong>${action.name}</strong> <span style="opacity:0.7;font-size:0.85em">(${action.source})</span><hr>${action.text}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onChatAttack(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.abilityIndex);
    const attack = (this as any)._attacks[index];
    if (!attack) return;
    const content = `<strong>${attack.name}</strong> <span style="opacity:0.7;font-size:0.85em">(${attack.source} | ${attack.dice}d6${attack.tensionx ? ' × Tension' : ''})</span><hr>${attack.text}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }

  static async _onChatAce(this: AdversarySheet, _event: Event, target: HTMLElement): Promise<void> {
    const index = Number(target.dataset.abilityIndex);
    const ace = (this as any)._aces[index];
    if (!ace) return;
    const content = `<strong>${ace.name}</strong> <span style="opacity:0.7;font-size:0.85em">(${ace.source} | Min Tension: ${ace.tension})</span><hr>${ace.text}`;
    await (ChatMessage as unknown as { create(data: Record<string, unknown>): Promise<unknown> }).create({
      content,
      speaker: (ChatMessage as unknown as { getSpeaker(opts: Record<string, unknown>): unknown }).getSpeaker({ actor: (this as any).document }),
    });
  }
}
