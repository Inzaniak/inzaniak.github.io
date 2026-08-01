(function () {
  "use strict";

  var sections = Array.prototype.slice.call(
    document.querySelectorAll("[data-outline-section]")
  );
  var links = Array.prototype.slice.call(
    document.querySelectorAll(".page-outline a")
  );
  var fill = document.querySelector(".page-outline__fill");
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

  var nameReveal = document.querySelector(".name-reveal");
  if (nameReveal) {
    nameReveal.addEventListener("click", function () {
      nameReveal.classList.toggle("is-active");
    });
  }

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("load", queueUpdate);
  queueUpdate();

  // --- Stack Search & Legend Filtering ---
  var searchInput = document.getElementById("stack-search-input");
  var clearBtn = document.getElementById("stack-search-clear");
  var marqueeContainer = document.querySelector(".grid-marquee");
  var pills = Array.prototype.slice.call(document.querySelectorAll("#about-grid .marquee-pill"));
  var legendItems = Array.prototype.slice.call(document.querySelectorAll("#about-grid .stack-legend__item"));

  var noResultsEl = document.getElementById("stack-no-results");
  var noResultsQueryEl = document.getElementById("stack-no-results-query");

  if (pills.length) {
    pills.forEach(function (pill) {
      var textSpan = pill.querySelector(".pill-text");
      if (textSpan) {
        pill.dataset.originalText = textSpan.textContent.trim();
      }
    });

    var activeContextFilter = null;
    var activeLevelFilter = null;

    var escapeHTML = function (str) {
      return str.replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    };

    var highlightMatch = function (text, query) {
      var escapedText = escapeHTML(text);
      if (!query) return escapedText;
      var idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return escapedText;
      var before = escapeHTML(text.slice(0, idx));
      var match = escapeHTML(text.slice(idx, idx + query.length));
      var after = escapeHTML(text.slice(idx + query.length));
      return before + '<mark class="stack-highlight">' + match + '</mark>' + after;
    };

    var updateStackDisplay = function () {
      var query = searchInput ? searchInput.value.trim() : "";
      var lowerQuery = query.toLowerCase();

      if (clearBtn) {
        clearBtn.hidden = !query && !activeContextFilter && !activeLevelFilter;
      }

      var isFiltering = query.length > 0 || activeContextFilter !== null || activeLevelFilter !== null;

      if (marqueeContainer) {
        if (isFiltering) {
          marqueeContainer.classList.add("has-search");
        } else {
          marqueeContainer.classList.remove("has-search");
        }
      }

      var tracks = marqueeContainer ? Array.prototype.slice.call(marqueeContainer.querySelectorAll(".marquee-track")) : [];
      var totalMatches = 0;

      tracks.forEach(function (track) {
        var trackPills = Array.prototype.slice.call(track.querySelectorAll(".marquee-pill"));
        var trackHasMatch = false;
        var seenInTrack = {};

        trackPills.forEach(function (pill) {
          var textSpan = pill.querySelector(".pill-text");
          var originalText = pill.dataset.originalText || (textSpan ? textSpan.textContent.trim() : "");
          var context = pill.getAttribute("data-context") || pill.getAttribute("data-status");
          var level = pill.getAttribute("data-level");

          var matchesSearch = !lowerQuery || originalText.toLowerCase().indexOf(lowerQuery) !== -1;
          var matchesContext = !activeContextFilter || context === activeContextFilter;
          var matchesLevel = !activeLevelFilter || level === activeLevelFilter;

          var matchesFilter = matchesSearch && matchesContext && matchesLevel;

          if (isFiltering) {
            if (matchesFilter && !seenInTrack[originalText]) {
              seenInTrack[originalText] = true;
              trackHasMatch = true;
              totalMatches++;
              pill.classList.add("is-matched");
              pill.classList.remove("is-hidden");
              if (textSpan) {
                textSpan.innerHTML = highlightMatch(originalText, query);
              }
            } else {
              pill.classList.remove("is-matched");
              pill.classList.add("is-hidden");
              if (textSpan) {
                textSpan.textContent = originalText;
              }
            }
          } else {
            pill.classList.remove("is-matched", "is-hidden");
            if (textSpan) {
              textSpan.textContent = originalText;
            }
          }
        });

        if (isFiltering) {
          track.style.display = trackHasMatch ? "flex" : "none";
        } else {
          track.style.display = "";
        }
      });

      if (noResultsEl) {
        if (isFiltering && totalMatches === 0) {
          noResultsEl.hidden = false;
          if (noResultsQueryEl) {
            var activeFilters = [];
            if (activeContextFilter) activeFilters.push(activeContextFilter);
            if (activeLevelFilter) activeFilters.push(activeLevelFilter);
            noResultsQueryEl.textContent = query || activeFilters.join(" + ");
          }
        } else {
          noResultsEl.hidden = true;
        }
      }

      if (isFiltering && marqueeContainer) {
        var containerRect = marqueeContainer.getBoundingClientRect();
        var isAboveViewport = containerRect.top < 0;
        var isBelowViewport = containerRect.bottom > window.innerHeight;
        if (isAboveViewport || isBelowViewport) {
          marqueeContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    };

    if (searchInput) {
      searchInput.addEventListener("input", updateStackDisplay);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        activeContextFilter = null;
        activeLevelFilter = null;
        legendItems.forEach(function (item) { item.classList.remove("is-active"); });
        updateStackDisplay();
      });
    }

    legendItems.forEach(function (item) {
      item.addEventListener("click", function () {
        var filterType = item.getAttribute("data-filter-type");
        var filterValue = item.getAttribute("data-filter-value");

        if (filterType === "context") {
          activeContextFilter = activeContextFilter === filterValue ? null : filterValue;
        } else if (filterType === "level") {
          activeLevelFilter = activeLevelFilter === filterValue ? null : filterValue;
        } else {
          var legacyStatus = item.getAttribute("data-legend-status");
          activeContextFilter = activeContextFilter === legacyStatus ? null : legacyStatus;
        }

        legendItems.forEach(function (el) {
          var t = el.getAttribute("data-filter-type");
          var v = el.getAttribute("data-filter-value");
          if (t === "context") {
            if (v === activeContextFilter) el.classList.add("is-active");
            else el.classList.remove("is-active");
          } else if (t === "level") {
            if (v === activeLevelFilter) el.classList.add("is-active");
            else el.classList.remove("is-active");
          }
        });

        updateStackDisplay();
      });
    });
  }
}());
