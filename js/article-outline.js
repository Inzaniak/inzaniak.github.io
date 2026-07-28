(function () {
  "use strict";

  var outline = document.querySelector(".article-outline");
  var article = document.querySelector(".article");
  var masthead = document.querySelector(".article-masthead");
  var list = outline && outline.querySelector("ol");
  var fill = outline && outline.querySelector(".page-outline__fill");

  if (!outline || !article || !masthead || !list || !fill) {
    return;
  }

  var headings = Array.prototype.slice.call(
    article.querySelectorAll(".article-body h2")
  );

  if (!headings.length) {
    return;
  }

  var sections = [masthead].concat(headings);
  var usedIds = {};

  sections.forEach(function (section, index) {
    var label = index === 0 ? "Top" : section.textContent.trim();
    var baseId = section.id || label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
    var id = baseId;
    var suffix = 2;

    while (usedIds[id] || (document.getElementById(id) && document.getElementById(id) !== section)) {
      id = baseId + "-" + suffix;
      suffix += 1;
    }

    section.id = id;
    section.setAttribute("data-outline-section", "");
    usedIds[id] = true;

    var item = document.createElement("li");
    var link = document.createElement("a");
    var number = String(index).padStart(2, "0");
    var tooltip = document.createElement("span");

    link.href = "#" + encodeURIComponent(id);
    link.dataset.targetId = id;
    link.setAttribute("aria-label", index === 0 ? "Top of article" : label);
    link.textContent = number;

    tooltip.className = "page-outline__label";
    tooltip.textContent = label;

    item.appendChild(link);
    item.appendChild(tooltip);
    list.appendChild(item);
  });

  var links = Array.prototype.slice.call(list.querySelectorAll("a"));
  var activeId = "";
  var updateQueued = false;

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
        if (link.dataset.targetId === currentSection.id) {
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
      var target = document.getElementById(link.dataset.targetId);

      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  outline.hidden = false;
  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("load", queueUpdate);
  queueUpdate();
}());
