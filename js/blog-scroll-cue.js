(function () {
  'use strict';

  var cue = document.querySelector('.blog-scroll-cue');
  var articles = Array.prototype.slice.call(
    document.querySelectorAll('.signal-list .blog-entry')
  );

  if (!cue || !articles.length) {
    return;
  }

  var nextArticle = null;
  var updateQueued = false;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function updateCue() {
    var viewportMarker = window.innerHeight * 0.5;
    var currentIndex = -1;
    var atPageBottom =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2;

    articles.forEach(function (article, index) {
      if (article.getBoundingClientRect().top <= viewportMarker) {
        currentIndex = index;
      }
    });

    nextArticle = atPageBottom ? null : articles[currentIndex + 1] || null;
    cue.hidden = !nextArticle;
    updateQueued = false;
  }

  function queueUpdate() {
    if (!updateQueued) {
      updateQueued = true;
      window.requestAnimationFrame(updateCue);
    }
  }

  cue.addEventListener('click', function () {
    if (!nextArticle) {
      return;
    }

    nextArticle.scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'center'
    });
  });

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
  updateCue();
}());
