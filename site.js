const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

function animationTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

for (const group of document.querySelectorAll("[data-animation-group]")) {
  const button = group.querySelector("[data-animation-toggle]");
  const videos = [...group.querySelectorAll("video.animation")];
  if (!videos[0]?.canPlayType("video/mp4")) continue;
  const visible = new Set();
  const timeline = group.querySelector("[data-animation-timeline]");
  let userPaused;
  let scrubPointer;

  function isPaused() {
    return userPaused ?? motionPreference.matches;
  }

  function updateButton() {
    const paused = isPaused();
    const hasProgress = videos.some((video) => video.currentTime > 0);
    const action = paused ? (hasProgress ? "Resume" : "Play") : "Pause";
    const label = `${action} animation${videos.length > 1 ? "s" : ""}`;

    if (button.classList.contains("opening-playback")) {
      button.setAttribute("aria-label", label);
      button.dataset.paused = String(paused);
    } else {
      button.textContent = label;
    }
  }

  function updateVideo(video) {
    if (isPaused() || scrubPointer !== undefined || document.hidden || !visible.has(video)) {
      if (!video.paused) video.pause();
      return;
    }

    if (video.paused) {
      video.play().catch((error) => {
        if (error.name === "NotAllowedError" && !isPaused() && visible.has(video)) {
          userPaused = true;
          updateGroup();
        }
      });
    }
  }

  function updateGroup() {
    updateButton();
    videos.forEach(updateVideo);
  }

  if (timeline) {
    const [video] = videos;
    const scrubber = timeline.querySelector("input");
    const clock = timeline.querySelector("[data-animation-time]");

    function updateTimeline() {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      scrubber.disabled = false;
      const maximum = String(duration);
      if (scrubber.max !== maximum) scrubber.max = maximum;
      if (scrubPointer === undefined) scrubber.value = String(video.currentTime);

      const positionLabel = animationTime(scrubber.valueAsNumber);
      const durationLabel = animationTime(duration);
      const timeText = `${positionLabel} / ${durationLabel}`;
      if (clock.textContent !== timeText) {
        clock.textContent = timeText;
        scrubber.setAttribute("aria-valuetext", `${positionLabel} of ${durationLabel}`);
      }
      timeline.hidden = false;
    }

    function endScrub(event) {
      if (scrubPointer === undefined || ("pointerId" in event && event.pointerId !== scrubPointer)) return;
      scrubPointer = undefined;
      updateGroup();
    }

    scrubber.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      scrubPointer = event.pointerId;
      updateVideo(video);
    });
    window.addEventListener("pointerup", endScrub);
    window.addEventListener("pointercancel", endScrub);
    window.addEventListener("blur", endScrub);

    scrubber.addEventListener("input", () => {
      video.currentTime = scrubber.valueAsNumber;
      updateTimeline();
      updateButton();
    });
    video.addEventListener("loadedmetadata", updateTimeline);
    video.addEventListener("timeupdate", updateTimeline);
    updateTimeline();
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) visible.add(target);
        else visible.delete(target);
        updateVideo(target);
      }
    }, { threshold: .01 });
    videos.forEach((video) => observer.observe(video));
  } else {
    videos.forEach((video) => visible.add(video));
  }

  button.addEventListener("click", () => {
    userPaused = !isPaused();
    updateGroup();
  });
  motionPreference.addEventListener("change", updateGroup);
  document.addEventListener("visibilitychange", updateGroup);
  button.hidden = false;
  updateGroup();
}

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
