let nodes = {
  paths: ["articles/the-pixel-art-comfyui-workflow-guide.html"],
  nodeCount: 1,
  linkSources: [],
  linkTargets: [],
  labels: ["The Pixel Art ComfyUI Workflow Guide"],
  radii: [null],
  linkCount: 0
};
let attractionForce = 1;
let linkLength = 10;
let repulsionForce = 150;
let centralForce = 3;
let edgePruning = 100;

document.addEventListener("DOMContentLoaded", function () {
  const exportedPage = document.querySelector(".webpage-container");
  const documentContainer = document.querySelector(".document-container");

  if (!exportedPage || !documentContainer || document.querySelector("#fh5co-page")) {
    return;
  }

  document.documentElement.lang = "en";
  document.body.classList.add("site-article-page");

  const page = document.createElement("div");
  page.id = "fh5co-page";

  const navToggle = document.createElement("a");
  navToggle.href = "#";
  navToggle.className = "js-fh5co-nav-toggle fh5co-nav-toggle";
  navToggle.setAttribute("aria-label", "Toggle navigation");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.innerHTML = "<i></i>";

  const siteNav = document.createElement("aside");
  siteNav.id = "fh5co-aside";
  siteNav.className = "border";
  siteNav.setAttribute("role", "complementary");
  siteNav.innerHTML = `
    <h1 id="fh5co-logo"><a href="/index.html">Inzaniak</a></h1>
    <h3 id="fh5co-sublogo">AKA Umberto Grando</h3>
    <nav id="fh5co-main-menu" aria-label="Main navigation">
      <ul>
        <li><a href="/index.html">Home</a></li>
        <li><a href="/about.html">About</a></li>
        <li><a href="/music.html">Music</a></li>
        <li><a href="/media.html">Media</a></li>
        <li class="fh5co-active"><a href="/blog.html" aria-current="page">Blog</a></li>
        <li><a href="/stuff.html">Stuff</a></li>
        <li><a href="/links.html">Links</a></li>
      </ul>
    </nav>
    <div class="fh5co-footer">
      <p><small>&copy; All Rights Reserved.</small></p>
      <ul class="article-socials" aria-label="Social profiles">
        <li><a href="https://inzaniak.bandcamp.com" aria-label="Bandcamp">BC</a></li>
        <li><a href="https://medium.com/@inzaniak" aria-label="Medium">MD</a></li>
        <li><a href="https://github.com/Inzaniak" aria-label="GitHub">GH</a></li>
      </ul>
    </div>`;

  const main = document.createElement("main");
  main.id = "fh5co-main";

  const title = document.title.trim();
  const articleDetails = {
    "The Pixel Art ComfyUI Workflow Guide": {
      kicker: "GENAI / COMFYUI / WORKFLOW",
      description: "A practical workflow for creating pixel art with Stable Diffusion and ComfyUI."
    },
    "The 1shot LoRA Guide": {
      kicker: "GENAI / STABLE DIFFUSION / LORA",
      description: "How to train and test a LoRA from a single source image."
    },
    "The Workflow Script Comprehensive Guide": {
      kicker: "GENAI / AUTOMATION / GUIDE",
      description: "A complete guide to installing and using the Workflow script."
    },
    "The Ranbooru Comprehensive Guide": {
      kicker: "GENAI / STABLE DIFFUSION / RANBOORU",
      description: "Installation, configuration, and advanced usage for the Ranbooru extension."
    }
  };
  const details = articleDetails[title] || {
    kicker: "BLOG / GUIDE",
    description: "Notes, experiments, and practical guides from Inzaniak."
  };

  const articleHeader = document.createElement("header");
  articleHeader.className = "article-masthead";
  articleHeader.innerHTML = `
    <a class="article-back" href="/blog.html"><span aria-hidden="true">←</span> All posts</a>
    <p class="article-kicker">${details.kicker}</p>
    <h1>${title}</h1>
    <p class="article-deck">${details.description}</p>`;

  const articleLayout = document.createElement("div");
  articleLayout.className = "article-layout";

  const toc = document.createElement("aside");
  toc.className = "article-toc";
  toc.setAttribute("aria-label", "Table of contents");

  const headingLinks = Array.from(
    documentContainer.querySelectorAll(".markdown-preview-sizer .heading[id]")
  ).filter(function (heading) {
    return heading.tagName === "H1" || heading.tagName === "H2";
  });

  if (headingLinks.length) {
    const tocList = document.createElement("ol");
    const tocTitle = document.createElement("p");
    tocTitle.className = "article-toc-title";
    tocTitle.textContent = "On this page";
    toc.appendChild(tocTitle);

    headingLinks.forEach(function (heading) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const label = heading.getAttribute("data-heading") || heading.textContent.trim();

      if (heading.tagName === "H2") {
        item.className = "article-toc-subitem";
      }

      link.href = window.location.pathname + "#" + heading.id;
      link.textContent = label;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        heading.headingWrapper?.collapse(false, true, false);
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search + "#" + heading.id
        );
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("offcanvas");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
      item.appendChild(link);
      tocList.appendChild(item);
    });

    toc.appendChild(tocList);
  }

  exportedPage.parentNode.insertBefore(page, exportedPage);
  page.appendChild(navToggle);
  page.appendChild(siteNav);
  page.appendChild(main);
  main.appendChild(articleHeader);
  main.appendChild(articleLayout);
  articleLayout.appendChild(exportedPage);
  if (headingLinks.length) {
    articleLayout.appendChild(toc);
  }

  navToggle.addEventListener("click", function (event) {
    event.preventDefault();
    const isOpen = document.body.classList.toggle("offcanvas");
    navToggle.classList.toggle("active", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", function (event) {
    if (
      document.body.classList.contains("offcanvas") &&
      !siteNav.contains(event.target) &&
      !navToggle.contains(event.target)
    ) {
      document.body.classList.remove("offcanvas");
      navToggle.classList.remove("active");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  if ("IntersectionObserver" in window && headingLinks.length) {
    const tocAnchors = Array.from(toc.querySelectorAll("a"));
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tocAnchors.forEach(function (anchor) {
            anchor.classList.toggle(
              "is-active",
              anchor.getAttribute("href") === "#" + entry.target.id
            );
          });
        });
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    headingLinks.forEach(function (heading) {
      observer.observe(heading);
    });
  }
});
