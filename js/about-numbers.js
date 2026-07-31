(function () {
  "use strict";

  var numbersSection = document.getElementById("numbers");
  var counters = numbersSection
    ? Array.prototype.slice.call(numbersSection.querySelectorAll("[data-number-target]"))
    : [];
  var canAnimate =
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    "IntersectionObserver" in window &&
    "requestAnimationFrame" in window;
  var duration = 1800;

  if (!counters.length) {
    return;
  }

  function setCounterValue(counter, value) {
    counter.textContent = String(value) + counter.dataset.numberSuffix;
  }

  function showFinalValues() {
    counters.forEach(function (counter) {
      setCounterValue(counter, counter.dataset.numberTarget);
    });
  }

  if (!canAnimate) {
    showFinalValues();
    return;
  }

  counters.forEach(function (counter) {
    setCounterValue(counter, 0);
  });

  function animateCounter(counter) {
    var target = Number(counter.dataset.numberTarget);
    var startTime = null;

    function updateCounter(timestamp) {
      if (!startTime) {
        startTime = timestamp;
      }

      var progress = Math.min((timestamp - startTime) / duration, 1);
      var easedProgress = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(easedProgress * target);
      setCounterValue(counter, value);

      if (progress < 1) {
        window.requestAnimationFrame(updateCounter);
      } else {
        setCounterValue(counter, target);
      }
    }

    window.requestAnimationFrame(updateCounter);
  }

  var observer = new IntersectionObserver(function (entries, currentObserver) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }

      counters.forEach(animateCounter);
      currentObserver.disconnect();
    });
  }, { threshold: 0 });

  observer.observe(numbersSection);
}());
