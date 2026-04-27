import { AdversaryDataModel, CharacterDataModel } from "./data/actor-models.js";
import { AdversarySheet } from "./sheets/adversary-sheet.js";
import { CharacterSheet } from "./sheets/character-sheet.js";

foundry.helpers.Hooks.once("init", () => {
  console.log("dawn-system | Initialising Dawn System");

  // Register data models for each Actor sub-type.
  // Cast needed: Foundry's JSDoc types use a generic TypeDataModel that requires
  // an explicit cast when assigning concrete subclasses.
  const dataModels = CONFIG.Actor.dataModels as Record<string, unknown>;
  dataModels.character = CharacterDataModel;
  dataModels.adversary = AdversaryDataModel;

  // Tell Foundry which attributes should appear as Token bars/values.
  // Foundry's JSDoc types trackableAttributes as Record<string, string> but
  // the actual structure is Record<string, {bar: string[], value: string[]}>.
  const trackable = CONFIG.Actor as unknown as {
    trackableAttributes: Record<string, { bar: string[]; value: string[] }>;
  };
  trackable.trackableAttributes = {
    character: { bar: [], value: ["health"] },
    adversary: { bar: [], value: ["tier"] },
  };

  // Register actor sheets.
  const actors = foundry.documents.collections.Actors as unknown as {
    registerSheet: (scope: string, cls: unknown, options: Record<string, unknown>) => void;
  };
  actors.registerSheet("dawn-system", CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "DAWN.Sheet.Character.Label",
  });
  actors.registerSheet("dawn-system", AdversarySheet, {
    types: ["adversary"],
    makeDefault: true,
    label: "DAWN.Sheet.Adversary.Label",
  });
});
