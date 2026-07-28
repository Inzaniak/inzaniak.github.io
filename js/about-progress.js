(function () {
  "use strict";

  var sections = Array.prototype.slice.call(
    document.querySelectorAll("[data-outline-section]")
  );
  var links = Array.prototype.slice.call(
    document.querySelectorAll(".about-outline a")
  );
  var fill = document.querySelector(".about-outline__fill");
  var activeId = "";
  var updateQueued = false;

  if (!sections.length || !links.length || !fill) {
    return;
  }

  function updateOutline() {
    var readingLine = window.innerHeight * 0.42;
    var currentSection = sections[0];
    var documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = documentHeight > 0 ? window.scrollY / documentHeight : 0;

    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= readingLine) {
        currentSection = section;
      }
    });

    if (currentSection.id !== activeId) {
      links.forEach(function (link) {
        var isCurrent = link.getAttribute("href") === "#" + currentSection.id;

        if (isCurrent) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      activeId = currentSection.id;
    }

    progress = Math.max(0, Math.min(1, progress));
    fill.style.transform = "translateX(-50%) scaleY(" + progress + ")";
    updateQueued = false;
  }

  function queueUpdate() {
    if (!updateQueued) {
      updateQueued = true;
      window.requestAnimationFrame(updateOutline);
    }
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var target = document.querySelector(link.getAttribute("href"));

      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("load", queueUpdate);
  queueUpdate();
}());
