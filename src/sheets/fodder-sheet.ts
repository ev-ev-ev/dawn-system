import { openSelfDamageDialog, applySelfDamage, postDamageSummary } from "../damage/damage.js";

export class FodderSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  static override DEFAULT_OPTIONS = {
    classes: ["dawn-system", "actor", "fodder"],
    window: { title: "DAWN.Sheet.Fodder.Title", resizable: true },
    position: { width: 480, height: 190 },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      applyDamage: FodderSheet._onApplyDamage,
    },
  };

  static override PARTS = {
    body: {
      template: "systems/dawn-system/templates/actors/fodder-sheet.hbs",
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
    return Object.assign(context, {
      system: (context as unknown as { document: foundry.documents.BaseActor }).document.system,
    });
  }

  static async _onApplyDamage(this: FodderSheet, _event: Event, _target: HTMLElement): Promise<void> {
    const actor = (this as any).document;
    const damage = await openSelfDamageDialog(actor, 1);
    if (damage === null || damage === undefined || damage < 1) return;
    const r = await applySelfDamage(actor, damage);
    if (r) await postDamageSummary([r]);
  }
}
