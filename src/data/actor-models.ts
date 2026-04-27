const { NumberField } = foundry.data.fields;

/**
 * Data model for the "character" Actor type.
 * Extends TypeDataModel to store per-type system data on Actors.
 */
export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      health: new NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 10,
        label: "DAWN.Actor.Character.Health",
      }),
    };
  }
}

/**
 * Data model for the "adversary" Actor type.
 */
export class AdversaryDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema() {
    return {
      tier: new NumberField({
        required: true,
        integer: true,
        min: 1,
        initial: 1,
        label: "DAWN.Actor.Adversary.Tier",
      }),
    };
  }
}
