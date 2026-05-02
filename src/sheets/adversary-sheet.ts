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

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: foundry.documents.BaseActor }).document;
    const allItems = ((document as unknown as { items: foundry.documents.BaseItem[] }).items ?? []);

    const edges = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "edge")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const npcTechniques = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "technique")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const npcComponents = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "component")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    const modifiers = allItems
      .filter((i: foundry.documents.BaseItem) => i.type === "modifier")
      .sort((a: foundry.documents.BaseItem, b: foundry.documents.BaseItem) => String(a.name).localeCompare(String(b.name)));

    return Object.assign(context, {
      system: document.system,
      edges,
      npcTechniques,
      npcComponents,
      modifiers,
    });
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
}
