const buttons = [...document.querySelectorAll("[data-animation-toggle]")];
const images = [...document.querySelectorAll(".animation")].map((image) => ({
  image,
  animation: image.getAttribute("src"),
  still: image.dataset.still
}));
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let paused = motionPreference.matches;

function updateMotion() {
  for (const { image, animation, still } of images) {
    const source = paused ? still : animation;
    if (image.getAttribute("src") !== source) image.src = source;
  }
  for (const button of buttons) {
    const label = paused ? "Play animations" : "Pause animations";
    if (button.classList.contains("opening-playback")) {
      button.setAttribute("aria-label", label);
      button.dataset.paused = String(paused);
    } else {
      button.textContent = label;
    }
  }
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    paused = !paused;
    updateMotion();
  });
  button.hidden = false;
}
motionPreference.addEventListener("change", (event) => {
  paused = event.matches;
  updateMotion();
});
updateMotion();

const openingMenu = document.querySelector(".opening-menu");
for (const link of openingMenu.querySelectorAll("a")) {
  link.addEventListener("click", () => { openingMenu.open = false; });
}
document.addEventListener("click", (event) => {
  if (openingMenu.open && !openingMenu.contains(event.target)) openingMenu.open = false;
});
openingMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openingMenu.open) {
    openingMenu.open = false;
    openingMenu.querySelector("summary").focus();
  }
});

const rolloutFilter = document.querySelector("[data-rollout-filter]");
const rolloutSet = document.querySelector("[data-rollout-set]");

if (rolloutFilter && rolloutSet) {
  const rollouts = rolloutSet.querySelectorAll("[data-task]");

  function showTask(task) {
    rolloutSet.toggleAttribute("data-filtered", task !== "all");
    for (const rollout of rollouts) {
      rollout.hidden = task !== "all" && rollout.dataset.task !== task;
    }
  }

  rolloutFilter.addEventListener("change", (event) => showTask(event.target.value));
  showTask(rolloutFilter.querySelector(":checked").value);
  rolloutFilter.hidden = false;
}

function enableScrollReveal() {
  if (motionPreference.matches || !("IntersectionObserver" in window)) return;

  const selector = "[data-scroll-reveal]";
  const blocks = [...document.querySelectorAll(selector)].filter(
    (block) => block.getBoundingClientRect().top >= window.innerHeight
  );
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) reveal(entry.target, true);
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  function reveal(block, animate = false) {
    if (block?.dataset.scrollReveal !== "pending") return;
    block.dataset.scrollReveal = animate ? "revealed" : "";
    observer.unobserve(block);
  }

  function revealFragment() {
    const fragment = location.hash.slice(1);
    if (!fragment || fragment === "main") return;
    const anchor = document.getElementById(fragment);
    reveal(anchor?.closest(selector) ?? anchor?.querySelector(selector));
  }

  for (const block of blocks) {
    block.dataset.scrollReveal = "pending";
    observer.observe(block);
  }

  revealFragment();
  window.addEventListener("hashchange", revealFragment);
  document.addEventListener("focusin", (event) => reveal(event.target.closest(selector)));
  motionPreference.addEventListener("change", (event) => {
    if (event.matches) {
      for (const block of blocks) reveal(block);
    }
  });
}

enableScrollReveal();
