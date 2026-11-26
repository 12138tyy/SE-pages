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
    button.textContent = paused ? "Play animations" : "Pause animations";
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
