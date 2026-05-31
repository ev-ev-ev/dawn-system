type AbilityEntry = {
  text: string;
  cost: number;
  symbols: string;
  variable: boolean;
};

const VERBS: AbilityEntry[] = [
  { text: "Breathe / Blow",        cost: 0, symbols: "✦", variable: false },
  { text: "Eat / Absorb",          cost: 0, symbols: "✦", variable: false },
  { text: "Perceive / Talk To",    cost: 0, symbols: "✦", variable: false },
  { text: "Become / Embody",       cost: 1, symbols: "✦", variable: false },
  { text: "Empower / Weaken",      cost: 1, symbols: "",  variable: false },
  { text: "Launch / Attract",      cost: 1, symbols: "",  variable: false },
  { text: "Repair / Heal / Toughen", cost: 1, symbols: "", variable: false },
  { text: "Rotate / Vibrate",      cost: 1, symbols: "",  variable: false },
  { text: "Shape / Solidify",      cost: 1, symbols: "",  variable: false },
  { text: "Stop / Immobilize",     cost: 2, symbols: "",  variable: false },
  { text: "Duplicate / Recreate",  cost: 2, symbols: "",  variable: false },
  { text: "Cut / Break / Melt",    cost: 2, symbols: "",  variable: false },
  { text: "Conceal / Locate",      cost: 2, symbols: "",  variable: false },
  { text: "Control / Manipulate",  cost: 2, symbols: "",  variable: false },
  { text: "Enlarge / Shrink",      cost: 2, symbols: "",  variable: false },
  { text: "Teleport / Swap",       cost: 2, symbols: "",  variable: false },
  { text: "Create / Secrete",      cost: 2, symbols: "✦", variable: false },
  { text: "Negate / Reverse",      cost: 4, symbols: "",  variable: false },
  { text: "Fuse X and ☽",          cost: 4, symbols: "",  variable: false },
  { text: "Store X in ☽",          cost: 0, symbols: "",  variable: true  },
  { text: "Transform X Into ☽",    cost: 0, symbols: "",  variable: true  },
];

const NOUNS: AbilityEntry[] = [
  { text: "Ghosts / Illusions",       cost: 0, symbols: "",     variable: false },
  { text: "Weather / Clouds",         cost: 0, symbols: "✦",    variable: false },
  { text: "Food / Bubbles / Toys",    cost: 0, symbols: "",     variable: false },
  { text: "Barriers / Traps",         cost: 0, symbols: "",     variable: false },
  { text: "Plants / Beasts",          cost: 1, symbols: "◇",    variable: false },
  { text: "Simple Weapons",           cost: 1, symbols: "◇",    variable: false },
  { text: "Sound / Dust / Smoke",     cost: 1, symbols: "",     variable: false },
  { text: "Light / Shadow",           cost: 1, symbols: "",     variable: false },
  { text: "Animals / Monsters",       cost: 1, symbols: "◇",    variable: false },
  { text: "Magic / Electricity",      cost: 1, symbols: "",     variable: false },
  { text: "People / Others",          cost: 2, symbols: "◇",    variable: false },
  { text: "Machines / Devices",       cost: 2, symbols: "◇",    variable: false },
  { text: "The Classical Elements",   cost: 2, symbols: "◇",    variable: false },
  { text: "Heat",                     cost: 2, symbols: "✦",    variable: false },
  { text: "Meat / Bones / Blood",     cost: 2, symbols: "",     variable: false },
  { text: "Explosives",               cost: 2, symbols: "◇",    variable: false },
  { text: "Yourself / Your Body",     cost: 2, symbols: "✦ ◇",  variable: false },
  { text: "Abilities / Knowledge",    cost: 3, symbols: "",     variable: false },
  { text: "Gravity",                  cost: 3, symbols: "",     variable: false },
  { text: "Fluids / Solids / Gasses", cost: 4, symbols: "",     variable: false },
  { text: "Distance / Velocity",      cost: 4, symbols: "",     variable: false },
];

const CONDITIONS: AbilityEntry[] = [
  { text: "You Win In A Game",        cost: -1, symbols: "◇", variable: false },
  { text: "You Are Sweating",         cost: -1, symbols: "",  variable: false },
  { text: "It's A Specific Time",     cost: -1, symbols: "",  variable: false },
  { text: "You consume X ☽",          cost: -1, symbols: "",  variable: false },
  { text: "You're Wearing X ☽",       cost: 0,  symbols: "",  variable: false },
  { text: "You've Built The Target",  cost: 0,  symbols: "",  variable: false },
  { text: "You're Carrying It",       cost: 0,  symbols: "",  variable: false },
  { text: "You Write On The Target",  cost: 0,  symbols: "",  variable: false },
  { text: "You Aren't Seen",          cost: 0,  symbols: "",  variable: false },
  { text: "You Touch The Target",     cost: 0,  symbols: "",  variable: false },
  { text: "You Hear / Smell It",      cost: 1,  symbols: "",  variable: false },
  { text: "You Dance",                cost: 1,  symbols: "",  variable: false },
  { text: "You Speak To The Target",  cost: 1,  symbols: "",  variable: false },
  { text: "You Understand It",        cost: 1,  symbols: "",  variable: false },
  { text: "You Draw The Target",      cost: 1,  symbols: "",  variable: false },
  { text: "You Explain It",           cost: 1,  symbols: "",  variable: false },
  { text: "You Hold Your Breath",     cost: 1,  symbols: "",  variable: false },
  { text: "It Can Hear You",          cost: 1,  symbols: "",  variable: false },
  { text: "You See The Target",       cost: 2,  symbols: "",  variable: false },
  { text: "You Remember The Target",  cost: 3,  symbols: "",  variable: false },
  { text: "You've Touched It",        cost: 3,  symbols: "",  variable: false },
];

type AbilityComponentArray = Array<{ text: string; cost: number }>;

export class LearnAbilityDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  (foundry.applications.api as unknown as {
    ApplicationV2: Parameters<typeof foundry.applications.api.HandlebarsApplicationMixin>[0];
  }).ApplicationV2
) {
  private _actor: foundry.documents.BaseActor;

  constructor(actor: foundry.documents.BaseActor, options: object = {}) {
    super(options as never);
    this._actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "learn-ability",
    classes: ["dawn-system", "learn-ability-dialog"],
    window: { title: "DAWN.Dialog.LearnAbility.Title", resizable: true },
    position: { width: 880, height: 600 },
    actions: {
      addVerb:      LearnAbilityDialog._onAddVerb,
      addNoun:      LearnAbilityDialog._onAddNoun,
      addCondition: LearnAbilityDialog._onAddCondition,
    },
  };

  static PARTS = {
    body: {
      template: "systems/dawn-system/templates/dialogs/learn-ability.hbs",
      scrollable: [".ability-col-list"],
    },
  };

  async _prepareContext(options: object) {
    const context = await super._prepareContext(options as never);
    return Object.assign(context, {
      verbs:      VERBS.map((e, i) => ({ ...e, index: i })),
      nouns:      NOUNS.map((e, i) => ({ ...e, index: i })),
      conditions: CONDITIONS.map((e, i) => ({ ...e, index: i })),
    });
  }

  private async _addComponent(field: string, entry: AbilityEntry): Promise<void> {
    const current = [...(((this._actor.system as any).ability?.[field] ?? []) as AbilityComponentArray)];
    current.push({ text: entry.text, cost: entry.cost });
    await (this._actor as any).update({ [`system.ability.${field}`]: current });
    this.render();
  }

  static async _onAddVerb(this: LearnAbilityDialog, _event: Event, target: HTMLElement): Promise<void> {
    const entry = VERBS[Number(target.dataset.index)];
    if (entry) await this._addComponent("verbs", entry);
  }

  static async _onAddNoun(this: LearnAbilityDialog, _event: Event, target: HTMLElement): Promise<void> {
    const entry = NOUNS[Number(target.dataset.index)];
    if (entry) await this._addComponent("nouns", entry);
  }

  static async _onAddCondition(this: LearnAbilityDialog, _event: Event, target: HTMLElement): Promise<void> {
    const entry = CONDITIONS[Number(target.dataset.index)];
    if (entry) await this._addComponent("conditions", entry);
  }
}
