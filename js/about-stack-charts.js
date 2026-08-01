(function () {
  "use strict";

  var stackSection = document.getElementById("stack");
  if (!stackSection) {
    return;
  }

  var kpiCards = Array.prototype.slice.call(stackSection.querySelectorAll(".stack-kpi-card"));
  var pieSvg = stackSection.querySelector(".stack-pie-svg");
  var barFills = Array.prototype.slice.call(stackSection.querySelectorAll(".stack-bar-fill"));
  var counterEl = stackSection.querySelector("[data-target-number]");

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setFinalState() {
    kpiCards.forEach(function (card) {
      card.classList.add("is-animated");
    });

    if (pieSvg) {
      pieSvg.classList.add("is-animated");
    }

    barFills.forEach(function (bar) {
      if (bar.dataset.targetWidth) {
        bar.style.width = bar.dataset.targetWidth;
      }
    });

    if (counterEl && counterEl.dataset.targetNumber) {
      counterEl.textContent = counterEl.dataset.targetNumber;
    }
  }

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    setFinalState();
    return;
  }

  function animateCounter(el) {
    var target = Number(el.dataset.targetNumber) || 0;
    var duration = 1200;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var easedProgress = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(easedProgress * target);
      el.textContent = String(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
      }
    }

    window.requestAnimationFrame(step);
  }

  function triggerAnimations() {
    // 1. Stagger animate KPI cards
    kpiCards.forEach(function (card, index) {
      setTimeout(function () {
        card.classList.add("is-animated");
      }, index * 120);
    });

    // 2. Animate counter number
    if (counterEl) {
      animateCounter(counterEl);
    }

    // 3. Animate SVG Pie Chart
    if (pieSvg) {
      setTimeout(function () {
        pieSvg.classList.add("is-animated");
      }, 250);
    }

    // 4. Animate Pyramid Bar Fills
    setTimeout(function () {
      barFills.forEach(function (bar) {
        if (bar.dataset.targetWidth) {
          bar.style.width = bar.dataset.targetWidth;
        }
      });
    }, 300);
  }

  var observer = new IntersectionObserver(
    function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          triggerAnimations();
          currentObserver.disconnect();
        }
      });
    },
    { threshold: 0.15 }
  );

  observer.observe(stackSection);
}());
