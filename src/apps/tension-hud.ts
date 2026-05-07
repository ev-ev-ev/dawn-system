function getTensionHudElement(): HTMLElement | null {
  return document.querySelector(".tension-hud");
}

export function createTensionHud(): void {
  if (getTensionHudElement()) return;

  const hud = document.createElement("div");
  hud.className = "tension-hud";

  const bar = document.createElement("div");
  bar.className = "tension-hud-bar";

  const label = document.createElement("span");
  label.className = "tension-label";
  label.textContent = game.i18n.localize("DAWN.Tension.Title");

  const value = document.createElement("span");
  value.className = "tension-value";
  value.id = "tension-value";

  const isGM = game.user?.isGM === true || game.user?.limited === false;

  bar.appendChild(label);
  bar.appendChild(value);

  if (isGM) {
    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "tension-btn";
    decBtn.setAttribute("data-tooltip", game.i18n.localize("DAWN.Tension.Decrement"));
    decBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
    decBtn.addEventListener("click", async () => {
      const current = game.settings.get("dawn-system", "tension") as number;
      if (current <= 0) return;
      await game.settings.set("dawn-system", "tension", current - 1);
      updateTensionDisplay();
    });

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "tension-btn";
    incBtn.setAttribute("data-tooltip", game.i18n.localize("DAWN.Tension.Increment"));
    incBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    incBtn.addEventListener("click", async () => {
      const current = game.settings.get("dawn-system", "tension") as number;
      await game.settings.set("dawn-system", "tension", current + 1);
      updateTensionDisplay();
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "tension-btn";
    resetBtn.setAttribute("data-tooltip", game.i18n.localize("DAWN.Tension.Reset"));
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
    resetBtn.addEventListener("click", async () => {
      await game.settings.set("dawn-system", "tension", 0);
      updateTensionDisplay();
    });

    bar.appendChild(decBtn);
    bar.appendChild(incBtn);
    bar.appendChild(resetBtn);
  }

  hud.appendChild(bar);
  document.body.appendChild(hud);
  updateTensionDisplay();
}

export function updateTensionDisplay(): void {
  const valueEl = document.getElementById("tension-value");
  if (valueEl) {
    const tension = game.settings.get("dawn-system", "tension") as number;
    valueEl.textContent = String(tension);
  }
}
