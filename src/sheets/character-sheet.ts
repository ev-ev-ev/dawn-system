import { openRollDialog } from "../dice/roll.js";

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

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: foundry.documents.BaseActor }).document;
    return Object.assign(context, {
      system: document.system,
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
}
