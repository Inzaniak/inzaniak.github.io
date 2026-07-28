/**
 * Inzaniak High-Contrast Color Bayer Dither Engine
 * Transforms hero and card images into crisp, high-visibility 4x4 Bayer dithered color artwork.
 */

(function () {
  'use strict';

  // 4x4 Bayer Matrix
  const BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  class ColorImageDitherEngine {
    constructor(heroEl) {
      this.hero = heroEl;
      if (!this.hero) return;

      // Read the slide backgrounds off the DOM rather than repeating them here,
      // so adding a hero slide is a one-line change in index.html. Bail before
      // touching the DOM if there is nothing to dither.
      this.imageUrls = this.readSlideImages();
      if (!this.imageUrls.length) return;

      // Create canvas overlay positioned over hero slides
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'hero-dither-canvas';
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '3';

      if (getComputedStyle(this.hero).position === 'static') {
        this.hero.style.position = 'relative';
      }

      this.hero.insertBefore(this.canvas, this.hero.firstChild);
      this.ctx = this.canvas.getContext('2d');

      // Offscreen canvas for fast pixel-level Bayer processing
      this.offCanvas = document.createElement('canvas');
      this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true });

      this.loadedImages = {};
      this.currentImageIndex = 0;

      // Cursor light source tracking
      this.mouseX = -1000;
      this.mouseY = -1000;
      this.targetX = -1000;
      this.targetY = -1000;
      this.isHovered = false;

      this.init();
    }

    async init() {
      // Preload background images
      await Promise.all(this.imageUrls.map(url => this.loadImage(url)));

      this.resize();
      window.addEventListener('resize', () => this.resize());

      // Track cursor position on hero container
      this.hero.addEventListener('mousemove', (e) => {
        const rect = this.hero.getBoundingClientRect();
        this.targetX = e.clientX - rect.left;
        this.targetY = e.clientY - rect.top;
        this.isHovered = true;
      });

      this.hero.addEventListener('mouseleave', () => {
        this.isHovered = false;
      });

      // Synchronize with active flexslider slide
      this.observeFlexslider();

      // Start render loop
      requestAnimationFrame((t) => this.render(t));
    }

    loadImage(url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.loadedImages[url] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    }

    readSlideImages() {
      const slides = this.hero.querySelectorAll('.slides > li');
      const urls = [];

      slides.forEach(slide => {
        // Read the inline style, not the computed one: flexslider clones slides
        // for its carousel, and getComputedStyle would resolve to absolute URLs.
        const match = /url\(\s*['"]?(.*?)['"]?\s*\)/.exec(slide.style.backgroundImage || '');
        if (match && urls.indexOf(match[1]) === -1) {
          urls.push(match[1]);
        }
      });

      return urls;
    }

    observeFlexslider() {
      setInterval(() => {
        const activeSlide = this.hero.querySelector('.slides > li.flex-active-slide') || this.hero.querySelector('.slides > li');
        if (activeSlide) {
          const bgStyle = activeSlide.style.backgroundImage || '';
          for (let i = 0; i < this.imageUrls.length; i++) {
            const filename = this.imageUrls[i].split('/').pop();
            if (bgStyle.includes(filename)) {
              this.currentImageIndex = i;
              break;
            }
          }
        }
      }, 200);
    }

    resize() {
      this.width = this.hero.clientWidth;
      this.height = this.hero.clientHeight;

      this.canvas.width = this.width;
      this.canvas.height = this.height;

      // Cell scale factor: 4px per Bayer cell for clear pixelated dither dots
      this.scale = 4; 
      this.offW = Math.max(1, Math.ceil(this.width / this.scale));
      this.offH = Math.max(1, Math.ceil(this.height / this.scale));

      this.offCanvas.width = this.offW;
      this.offCanvas.height = this.offH;
    }

    render(time) {
      if (this.width === 0 || this.height === 0) {
        requestAnimationFrame((t) => this.render(t));
        return;
      }

      // Smooth mouse coordinate easing
      if (this.isHovered) {
        this.mouseX += (this.targetX - this.mouseX) * 0.15;
        this.mouseY += (this.targetY - this.mouseY) * 0.15;
      } else {
        // Ambient moving light source when cursor is off hero
        const t = time * 0.0008;
        const ambX = (this.width / 2) + Math.sin(t) * (this.width * 0.28);
        const ambY = (this.height / 2) + Math.cos(t * 1.3) * (this.height * 0.22);
        this.mouseX += (ambX - this.mouseX) * 0.05;
        this.mouseY += (ambY - this.mouseY) * 0.05;
      }

      const activeUrl = this.imageUrls[this.currentImageIndex];
      const img = this.loadedImages[activeUrl] || this.loadedImages[this.imageUrls[0]];

      if (img) {
        this.offCtx.clearRect(0, 0, this.offW, this.offH);
        
        // Draw background image scaled cover to offscreen canvas
        const imgRatio = img.width / img.height;
        const containerRatio = this.offW / this.offH;
        let dw, dh, dx, dy;

        if (containerRatio > imgRatio) {
          dw = this.offW;
          dh = this.offW / imgRatio;
          dx = 0;
          dy = (this.offH - dh) / 2;
        } else {
          dh = this.offH;
          dw = this.offH * imgRatio;
          dx = (this.offW - dw) / 2;
          dy = 0;
        }

        this.offCtx.drawImage(img, dx, dy, dw, dh);

        // Extract raw image pixels
        const imgData = this.offCtx.getImageData(0, 0, this.offW, this.offH);
        const data = imgData.data;

        const offMx = this.mouseX / this.scale;
        const offMy = this.mouseY / this.scale;
        const lightRadius = 110; // Light radius in offscreen coordinates

        // High contrast Bayer dither parameters
        const levels = 4; // 4 color steps per RGB channel = 64 color retro palette
        const step = 255 / (levels - 1); // 85
        const ditherSpread = 96; // Strong Bayer matrix threshold spread for prominent dot patterns

        for (let y = 0; y < this.offH; y++) {
          for (let x = 0; x < this.offW; x++) {
            const idx = (y * this.offW + x) * 4;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Bayer 4x4 matrix normalized [-0.5, 0.5]
            const bayerVal = (BAYER_4X4[y % 4][x % 4] / 16.0) - 0.5;
            const bayerOffset = bayerVal * ditherSpread;

            // Distance to cursor position light source
            const dist = Math.hypot(x - offMx, y - offMy);
            let lightBoost = 0;
            if (dist < lightRadius) {
              lightBoost = (1 - dist / lightRadius) * 75;
            }

            // Apply Bayer offset & mouse light boost to original image RGB channels
            const rMod = Math.min(255, Math.max(0, r + bayerOffset + lightBoost));
            const gMod = Math.min(255, Math.max(0, g + bayerOffset + lightBoost));
            const bMod = Math.min(255, Math.max(0, b + bayerOffset + lightBoost));

            // Quantize to discrete color palette
            data[idx]     = Math.round(rMod / step) * step;
            data[idx + 1] = Math.round(gMod / step) * step;
            data[idx + 2] = Math.round(bMod / step) * step;
          }
        }

        this.offCtx.putImageData(imgData, 0, 0);

        // Render retro pixel-sharp color dithered photo to hero overlay canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.offCanvas, 0, 0, this.width, this.height);
      }

      requestAnimationFrame((t) => this.render(t));
    }
  }

  class CardImageDitherEngine {
    constructor(card) {
      this.card = card;
      this.image = card.querySelector('.blog-img img');
      this.imageContainer = this.image && this.image.closest('.blog-img');
      this.renderTarget = this.imageContainer || card;
      this.sourceUrl = this.image
        ? (this.image.currentSrc || this.image.src)
        : this.getBackgroundUrl(card);
      this.isRendering = false;
      this.renderedWidth = 0;
      this.renderedHeight = 0;
      this.isActive = false;
      this.animationFrame = null;
      this.mouseX = null;
      this.mouseY = null;
      this.targetX = null;
      this.targetY = null;

      if (!this.sourceUrl || !this.renderTarget) return;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'card-dither-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.renderTarget.appendChild(this.canvas);

      this.card.addEventListener('pointerenter', (event) => this.activate(event));
      this.card.addEventListener('pointermove', (event) => this.updatePointer(event));
      this.card.addEventListener('pointerleave', () => this.deactivate());
      this.card.addEventListener('focusin', () => this.activate());
      this.card.addEventListener('focusout', (event) => {
        if (!this.card.contains(event.relatedTarget)) this.deactivate();
      });
    }

    getBackgroundUrl(element) {
      const backgroundImage = getComputedStyle(element).backgroundImage;
      const match = backgroundImage.match(/^url\((['"]?)(.*)\1\)$/);
      return match ? match[2] : '';
    }

    activate(event) {
      this.isActive = true;
      this.card.classList.add('is-dither-active');
      this.updatePointer(event);
      this.prepare();
      this.startAnimation();
    }

    deactivate() {
      this.isActive = false;
      this.card.classList.remove('is-dither-active');
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }

    updatePointer(event) {
      const rect = this.renderTarget.getBoundingClientRect();
      const x = event ? event.clientX - rect.left : rect.width / 2;
      const y = event ? event.clientY - rect.top : rect.height / 2;

      this.targetX = Math.min(rect.width, Math.max(0, x));
      this.targetY = Math.min(rect.height, Math.max(0, y));
      if (this.mouseX === null || this.mouseY === null) {
        this.mouseX = this.targetX;
        this.mouseY = this.targetY;
      }
    }

    prepare() {
      const width = Math.round(this.renderTarget.clientWidth);
      const height = Math.round(this.renderTarget.clientHeight);

      if (!width || !height || this.isRendering) return;
      if (width === this.renderedWidth && height === this.renderedHeight) {
        this.startAnimation();
        return;
      }

      this.isRendering = true;
      const source = new Image();
      source.crossOrigin = 'anonymous';
      source.onload = () => {
        try {
          this.prepareSource(source, width, height);
          this.canvas.classList.add('is-ready');
          this.renderedWidth = width;
          this.renderedHeight = height;
          this.startAnimation();
        } catch (error) {
          // Some remote hosts do not permit pixel access. Keep the original image.
          this.canvas.remove();
          this.sourceUrl = '';
        }
        this.isRendering = false;
      };
      source.onerror = () => {
        this.canvas.remove();
        this.sourceUrl = '';
        this.isRendering = false;
      };
      source.src = this.sourceUrl;
    }

    prepareSource(source, width, height) {
      this.cellSize = 3;
      this.offWidth = Math.max(1, Math.ceil(width / this.cellSize));
      this.offHeight = Math.max(1, Math.ceil(height / this.cellSize));
      this.offCanvas = document.createElement('canvas');
      this.offContext = this.offCanvas.getContext('2d', { willReadFrequently: true });
      this.context = this.canvas.getContext('2d');

      this.offCanvas.width = this.offWidth;
      this.offCanvas.height = this.offHeight;
      this.canvas.width = width;
      this.canvas.height = height;

      const sourceRatio = source.naturalWidth / source.naturalHeight;
      const targetRatio = this.offWidth / this.offHeight;
      let drawWidth;
      let drawHeight;
      let drawX;
      let drawY;

      if (targetRatio > sourceRatio) {
        drawWidth = this.offWidth;
        drawHeight = this.offWidth / sourceRatio;
        drawX = 0;
        drawY = (this.offHeight - drawHeight) / 2;
      } else {
        drawHeight = this.offHeight;
        drawWidth = this.offHeight * sourceRatio;
        drawX = (this.offWidth - drawWidth) / 2;
        drawY = 0;
      }

      this.offContext.drawImage(source, drawX, drawY, drawWidth, drawHeight);
      this.sourcePixels = new Uint8ClampedArray(
        this.offContext.getImageData(0, 0, this.offWidth, this.offHeight).data
      );
    }

    startAnimation() {
      if (!this.isActive || !this.sourcePixels || this.animationFrame) return;
      this.animationFrame = requestAnimationFrame(() => this.renderFrame());
    }

    renderFrame() {
      this.animationFrame = null;
      if (!this.isActive || !this.sourcePixels) return;

      this.mouseX += (this.targetX - this.mouseX) * 0.16;
      this.mouseY += (this.targetY - this.mouseY) * 0.16;

      const imageData = this.offContext.createImageData(this.offWidth, this.offHeight);
      imageData.data.set(this.sourcePixels);
      const pixels = imageData.data;
      const levels = 4;
      const colorStep = 255 / (levels - 1);
      const spread = 92;
      const lightRadius = Math.min(this.offWidth, this.offHeight) * 0.62;
      const lightX = this.mouseX / this.cellSize;
      const lightY = this.mouseY / this.cellSize;

      for (let y = 0; y < this.offHeight; y++) {
        for (let x = 0; x < this.offWidth; x++) {
          const index = (y * this.offWidth + x) * 4;
          const offset = ((BAYER_4X4[y % 4][x % 4] / 16) - 0.5) * spread;
          const distance = Math.hypot(x - lightX, y - lightY);
          const lightBoost = distance < lightRadius
            ? (1 - distance / lightRadius) * 78
            : 0;

          pixels[index] = Math.round(
            Math.min(255, Math.max(0, pixels[index] + offset + lightBoost)) / colorStep
          ) * colorStep;
          pixels[index + 1] = Math.round(
            Math.min(255, Math.max(0, pixels[index + 1] + offset + lightBoost)) / colorStep
          ) * colorStep;
          pixels[index + 2] = Math.round(
            Math.min(255, Math.max(0, pixels[index + 2] + offset + lightBoost)) / colorStep
          ) * colorStep;
        }
      }

      this.offContext.putImageData(imageData, 0, 0);
      this.context.imageSmoothingEnabled = false;
      this.context.clearRect(0, 0, this.renderedWidth, this.renderedHeight);
      this.context.drawImage(this.offCanvas, 0, 0, this.renderedWidth, this.renderedHeight);
      this.startAnimation();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const hero = document.getElementById('fh5co-hero');
    if (hero) {
      new ColorImageDitherEngine(hero);
    }

    const imageCards = Array.from(document.querySelectorAll('.blog-img img'))
      .map((image) => image.closest('.blog-entry'))
      .filter(Boolean);
    const backgroundCards = Array.from(document.querySelectorAll('.work'));

    imageCards.concat(backgroundCards).forEach((card) => {
      new CardImageDitherEngine(card);
    });
  });

})();
