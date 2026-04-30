export class TechniqueSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "item", "technique"],
    window: { title: "DAWN.Sheet.Technique.Title", resizable: true },
    position: { width: 460, height: 400 },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/items/technique-sheet.hbs",
    },
  };

  override async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    const document = (context as unknown as { document: { system: Record<string, unknown>; name: string } }).document;
    return Object.assign(context, { system: document.system });
  }
}
