function getTensionHudElement(): HTMLElement | null {
  return document.querySelector(".tension-hud");
}

function createBar(
  settingKey: string,
  titleLocKey: string,
  valueId: string,
  decLocKey: string,
  incLocKey: string,
  resetLocKey: string,
  isGM: boolean,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "tension-hud-bar";

  const label = document.createElement("span");
  label.className = "tension-label";
  label.textContent = game.i18n.localize(titleLocKey);

  const value = document.createElement("span");
  value.className = "tension-value";
  value.id = valueId;
  value.textContent = String(game.settings.get("dawn-system", settingKey) as number);

  bar.appendChild(label);
  bar.appendChild(value);

  if (isGM) {
    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "tension-btn";
    decBtn.setAttribute("data-tooltip", game.i18n.localize(decLocKey));
    decBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
    decBtn.addEventListener("click", async () => {
      const current = game.settings.get("dawn-system", settingKey) as number;
      if (current <= 0) return;
      await game.settings.set("dawn-system", settingKey, current - 1);
      refreshValueEl(valueId, settingKey);
    });

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "tension-btn";
    incBtn.setAttribute("data-tooltip", game.i18n.localize(incLocKey));
    incBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    incBtn.addEventListener("click", async () => {
      const current = game.settings.get("dawn-system", settingKey) as number;
      await game.settings.set("dawn-system", settingKey, current + 1);
      refreshValueEl(valueId, settingKey);
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "tension-btn";
    resetBtn.setAttribute("data-tooltip", game.i18n.localize(resetLocKey));
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
    resetBtn.addEventListener("click", async () => {
      await game.settings.set("dawn-system", settingKey, 0);
      refreshValueEl(valueId, settingKey);
    });

    bar.appendChild(decBtn);
    bar.appendChild(incBtn);
    bar.appendChild(resetBtn);
  }

  return bar;
}

function refreshValueEl(id: string, settingKey: string, override?: number): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = String(override !== undefined ? override : (game.settings.get("dawn-system", settingKey) as number));
  }
}

export function createTensionHud(): void {
  if (getTensionHudElement()) return;

  const isGM = game.user?.isGM === true || game.user?.limited === false;
  const dramaEnabled = game.settings.get("dawn-system", "dramaEnabled") as boolean;
  const doomEnabled = game.settings.get("dawn-system", "doomEnabled") as boolean;

  const hud = document.createElement("div");
  hud.className = "tension-hud";

  hud.appendChild(createBar(
    "tension", "DAWN.Tension.Title", "tension-value",
    "DAWN.Tension.Decrement", "DAWN.Tension.Increment", "DAWN.Tension.Reset",
    isGM,
  ));

  const dramaBar = createBar(
    "drama", "DAWN.Drama.Title", "drama-value",
    "DAWN.Drama.Decrement", "DAWN.Drama.Increment", "DAWN.Drama.Reset",
    isGM,
  );
  dramaBar.id = "drama-bar";
  if (!dramaEnabled) dramaBar.style.display = "none";
  hud.appendChild(dramaBar);

  const doomBar = createBar(
    "doom", "DAWN.Doom.Title", "doom-value",
    "DAWN.Doom.Decrement", "DAWN.Doom.Increment", "DAWN.Doom.Reset",
    isGM,
  );
  doomBar.id = "doom-bar";
  if (!doomEnabled) doomBar.style.display = "none";
  hud.appendChild(doomBar);

  document.body.appendChild(hud);
}

export function updateTensionDisplay(tensionValue?: number): void {
  refreshValueEl("tension-value", "tension", tensionValue);
}

export function updateDramaDisplay(value?: number): void {
  refreshValueEl("drama-value", "drama", value);
}

export function updateDoomDisplay(value?: number): void {
  refreshValueEl("doom-value", "doom", value);
}

export function updateDramaVisibility(enabled: boolean): void {
  const dramaBar = document.getElementById("drama-bar");
  if (dramaBar) dramaBar.style.display = enabled ? "" : "none";
}

export function updateDoomVisibility(enabled: boolean): void {
  const doomBar = document.getElementById("doom-bar");
  if (doomBar) doomBar.style.display = enabled ? "" : "none";
}
