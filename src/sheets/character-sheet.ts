export class CharacterSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "actor", "character"],
    window: { title: "DAWN.Sheet.Character.Title", resizable: true },
    position: { width: 480, height: 360 },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/actors/character-sheet.hbs",
    },
  };

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: { system: Record<string, unknown> } }).document;
    return Object.assign(context, { system: document.system });
  }
}
