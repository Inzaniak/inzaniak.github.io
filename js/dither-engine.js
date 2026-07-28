/**
 * Inzaniak High-Contrast Color Bayer Dither Engine
 * Transforms hero background images into crisp, high-visibility 4x4 Bayer dithered color artwork.
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

      // Image paths corresponding to flexslider background slides
      this.imageUrls = [
        'images/bg1.jpg',
        'images/bg2.jpg',
        'images/bg3.jpg',
        'images/bg4.jpg'
      ];
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

  document.addEventListener('DOMContentLoaded', () => {
    const hero = document.getElementById('fh5co-hero');
    if (hero) {
      new ColorImageDitherEngine(hero);
    }
  });

})();
