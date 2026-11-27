const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

function animationTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function connectRolloutCarousel(group, updateGroup) {
  const track = group.querySelector("[data-rollout-set]");
  const filter = group.querySelector("[data-rollout-filter]");
  const paging = group.querySelector("[data-rollout-paging]");
  if (!track || !filter || !paging) return null;

  const slides = [...track.querySelectorAll("[data-task]")];
  const videos = slides.map((slide) => slide.querySelector("video"));
  const radios = [...filter.querySelectorAll("input")];
  let selected = slides.findIndex((slide) => slide.dataset.task === filter.querySelector(":checked").value);
  let active = selected;
  let settleTimer;

  function slideOffset(index) {
    return slides[index].offsetLeft - slides[0].offsetLeft;
  }

  function setCarousel(enabled) {
    track.toggleAttribute("data-carousel", enabled);
    paging.hidden = !enabled;
    track.tabIndex = enabled ? 0 : -1;
    for (const video of videos) video.loop = !enabled;
  }

  function choose(index) {
    active = index;
    selected = index;
    radios.find((radio) => radio.value === slides[index].dataset.task).checked = true;
    updateGroup();
  }

  function settle() {
    if (!track.hasAttribute("data-carousel")) return;
    const nearest = slides.reduce((best, _, index) => {
      const distance = Math.abs(slideOffset(index) - track.scrollLeft);
      return distance < Math.abs(slideOffset(best) - track.scrollLeft) ? index : best;
    }, 0);
    choose(nearest);
  }

  function waitForSettle() {
    if (active !== -1) {
      active = -1;
      updateGroup();
    }
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 140);
  }

  function scrollToSlide(index) {
    const smooth = track.hasAttribute("data-carousel") && !motionPreference.matches
      && Math.abs(selected - index) === 1;
    setCarousel(true);
    selected = index;
    const left = slideOffset(index);
    track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    if (Math.abs(track.scrollLeft - left) < 1) {
      window.clearTimeout(settleTimer);
      choose(index);
    } else {
      waitForSettle();
    }
  }

  function move(direction) {
    scrollToSlide((selected + direction + slides.length) % slides.length);
  }

  filter.addEventListener("change", (event) => {
    const index = slides.findIndex((slide) => slide.dataset.task === event.target.value);
    if (index !== -1) {
      scrollToSlide(index);
    } else {
      window.clearTimeout(settleTimer);
      setCarousel(false);
      selected = active = -1;
      updateGroup();
    }
  });

  paging.querySelector("[data-rollout-prev]").addEventListener("click", () => move(-1));
  paging.querySelector("[data-rollout-next]").addEventListener("click", () => move(1));
  track.addEventListener("scroll", () => {
    if (!track.hasAttribute("data-carousel")) return;
    if (active === -1 || Math.abs(track.scrollLeft - slideOffset(active)) >= 1) waitForSettle();
  }, { passive: true });

  setCarousel(selected !== -1);
  if (selected > 0) track.scrollLeft = slideOffset(selected);
  filter.hidden = false;

  return {
    canPlay(video) {
      return !track.hasAttribute("data-carousel") || videos[active] === video;
    },
    advance(video) {
      if (track.hasAttribute("data-carousel") && videos[active] === video) move(1);
    }
  };
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
    if (isPaused() || scrubPointer !== undefined || document.hidden || !visible.has(video)
      || (carousel && !carousel.canPlay(video))) {
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

  const carousel = connectRolloutCarousel(group, updateGroup);
  if (carousel) {
    for (const video of videos) {
      video.addEventListener("ended", () => {
        if (!isPaused() && !document.hidden && visible.has(video)) carousel.advance(video);
      });
    }
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
