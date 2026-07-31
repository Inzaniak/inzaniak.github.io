(function () {
  "use strict";

  var articleBody = document.querySelector(".article-body");
  var modal = document.querySelector(".article-image-modal");
  var modalImage = modal && modal.querySelector(".article-image-modal__image");
  var closeButton = modal && modal.querySelector("[data-article-image-close]");

  if (!articleBody || !modal || !modalImage || !closeButton || typeof modal.showModal !== "function") {
    return;
  }

  var images = Array.prototype.slice.call(articleBody.querySelectorAll("img"));
  var activeTrigger = null;

  function openModal(trigger, image) {
    activeTrigger = trigger;
    modalImage.src = image.currentSrc || image.src;
    modalImage.alt = image.alt || "Enlarged article image";
    modal.showModal();
    closeButton.focus();
  }

  function closeModal() {
    if (modal.open) {
      modal.close();
    }
  }

  images.forEach(function (image) {
    var trigger = document.createElement("button");
    var label = image.alt ? "Zoom image: " + image.alt : "Zoom image";

    trigger.type = "button";
    trigger.className = "article-image-trigger";
    trigger.setAttribute("aria-label", label);
    image.parentNode.insertBefore(trigger, image);
    trigger.appendChild(image);

    trigger.addEventListener("click", function () {
      openModal(trigger, image);
    });
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener("close", function () {
    modalImage.removeAttribute("src");
    if (activeTrigger) {
      activeTrigger.focus();
      activeTrigger = null;
    }
  });
}());
