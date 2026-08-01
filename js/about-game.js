/**
 * Interactive Dithered Breakout Game for Gaming Passion Card
 * Inzaniak - Charcoal & Crimson low-bit retro aesthetic
 */
(function () {
  'use strict';

  // Global Sound Manager (starts MUTED by default!)
  const SoundManager = {
    isMuted: true,
    listeners: [],

    toggle() {
      this.isMuted = !this.isMuted;
      this.notify();
      return this.isMuted;
    },

    subscribe(fn) {
      this.listeners.push(fn);
      fn(this.isMuted);
    },

    notify() {
      this.listeners.forEach(fn => fn(this.isMuted));
    }
  };

  // 4x4 Bayer Dither Matrix
  const BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  function setupMuteButton(btnEl) {
    if (!btnEl) return;
    SoundManager.subscribe(isMuted => {
      if (isMuted) {
        btnEl.textContent = '🔇 MUTED';
        btnEl.classList.remove('is-unmuted');
        btnEl.classList.add('is-muted');
      } else {
        btnEl.textContent = '🔊 AUDIO ON';
        btnEl.classList.remove('is-muted');
        btnEl.classList.add('is-unmuted');
      }
    });

    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      SoundManager.toggle();
    });
  }

  class DitherBreakoutGame {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.canvas = this.card.querySelector('.grid-card__game-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.scoreEl = document.getElementById('game-score');
      this.msgEl = document.getElementById('game-msg');
      this.hiscoreEl = document.getElementById('game-hiscore');

      // Audio context (synthesized retro SFX)
      this.audioCtx = null;

      // Internal virtual resolution for authentic pixel art & dithering
      this.virtualWidth = 320;
      this.virtualHeight = 200;

      // Offscreen canvas for buffer rendering
      this.offCanvas = document.createElement('canvas');
      this.offCanvas.width = this.virtualWidth;
      this.offCanvas.height = this.virtualHeight;
      this.offCtx = this.offCanvas.getContext('2d');

      // Game state
      this.score = 0;
      this.hiscore = parseInt(localStorage.getItem('inzaniak_game_hiscore') || '0', 10);
      this.state = 'READY'; // 'READY', 'PLAYING', 'GAMEOVER', 'VICTORY'
      this.level = 1;

      // Target mouse position
      this.targetX = this.virtualWidth / 2;
      this.isHovered = false;

      // Entities
      this.paddle = {
        x: this.virtualWidth / 2 - 24,
        y: this.virtualHeight - 16,
        width: 48,
        height: 8,
        color: '#ff334b'
      };

      this.ball = {
        x: this.virtualWidth / 2,
        y: this.virtualHeight - 24,
        size: 5,
        vx: 0,
        vy: 0,
        speed: 2.8,
        trail: []
      };

      this.bricks = [];
      this.particles = [];
      this.floatingTexts = [];
      this.starfield = [];

      this.animationFrame = null;

      this.init();
    }

    init() {
      this.updateHiScoreDisplay();
      this.createStarfield();
      this.resetBricks();
      this.resetBall();

      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Card hover/mouse events
      this.card.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      this.card.addEventListener('mouseenter', (e) => this.handleMouseEnter(e));
      this.card.addEventListener('mouseleave', () => this.handleMouseLeave());
      this.card.addEventListener('click', (e) => this.handleClick(e));

      // Touch events for mobile support
      this.card.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          this.handleMouseMove(e.touches[0]);
        }
      }, { passive: true });

      this.card.addEventListener('touchstart', (e) => {
        this.initAudio();
        if (e.touches.length > 0) {
          this.handleMouseMove(e.touches[0]);
        }
        if (this.state !== 'PLAYING') {
          this.handleClick(e);
        }
      }, { passive: true });

      // Initial render frame
      this.render();
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playTone(freq, type, duration, startVol = 0.1, endVol = 0.001) {
      if (SoundManager.isMuted || !this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(startVol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endVol, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (err) {
        // Audio error fallback silent
      }
    }

    createStarfield() {
      this.starfield = [];
      for (let i = 0; i < 30; i++) {
        this.starfield.push({
          x: Math.random() * this.virtualWidth,
          y: Math.random() * this.virtualHeight,
          speed: 0.2 + Math.random() * 0.5,
          brightness: Math.random() > 0.5 ? '#26262c' : '#1a1a1e'
        });
      }
    }

    resetBricks() {
      this.bricks = [];
      const rows = 4;
      const cols = 8;
      const padding = 4;
      const brickWidth = Math.floor((this.virtualWidth - 20 - (cols - 1) * padding) / cols);
      const brickHeight = 10;
      const startX = 10;
      const startY = 36;

      const colors = [
        { main: '#ff334b', points: 50, hits: 1, type: 'crimson' },
        { main: '#f4f4f5', points: 30, hits: 2, type: 'armored' },
        { main: '#71717a', points: 20, hits: 1, type: 'surface' },
        { main: '#ff334b', points: 10, hits: 1, type: 'dither' }
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cfg = colors[r % colors.length];
          this.bricks.push({
            x: startX + c * (brickWidth + padding),
            y: startY + r * (brickHeight + padding),
            w: brickWidth,
            h: brickHeight,
            hits: cfg.hits,
            maxHits: cfg.hits,
            color: cfg.main,
            points: cfg.points,
            type: cfg.type,
            active: true
          });
        }
      }
    }

    resetBall() {
      this.ball.x = this.paddle.x + this.paddle.width / 2;
      this.ball.y = this.paddle.y - this.ball.size - 2;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.trail = [];
    }

    launchBall() {
      if (this.state === 'READY') {
        const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2;
        const speed = this.ball.speed + (this.level - 1) * 0.3;
        this.ball.vx = Math.cos(angle) * speed;
        this.ball.vy = Math.sin(angle) * speed;
        this.state = 'PLAYING';
        this.updateHUD('CLEAR ALL BRICKS!');
        this.playTone(440, 'triangle', 0.08, 0.12);
      } else if (this.state === 'GAMEOVER') {
        this.score = 0;
        this.level = 1;
        this.updateScoreDisplay();
        this.resetBricks();
        this.resetBall();
        this.state = 'READY';
        this.updateHUD('MOVE MOUSE • CLICK TO LAUNCH');
      } else if (this.state === 'VICTORY') {
        this.level++;
        this.resetBricks();
        this.resetBall();
        this.state = 'READY';
        this.updateHUD(`WAVE ${this.level} • CLICK TO LAUNCH`);
      }
    }

    handleMouseMove(e) {
      const rect = this.card.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width;
      this.targetX = relativeX * this.virtualWidth;
    }

    handleMouseEnter(e) {
      this.initAudio();
      this.isHovered = true;
      this.resizeCanvas();
      this.startLoop();
    }

    handleMouseLeave() {
      this.isHovered = false;
      this.stopLoop();
    }

    handleClick(e) {
      this.initAudio();
      this.launchBall();
    }

    resizeCanvas() {
      const rect = this.card.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      }
    }

    spawnParticles(x, y, color, count = 10) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2.5;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: color,
          size: Math.random() > 0.5 ? 2 : 3,
          life: 1.0,
          decay: 0.03 + Math.random() * 0.03
        });
      }
    }

    addFloatingText(text, x, y, color = '#ff334b') {
      this.floatingTexts.push({
        text: text,
        x: x,
        y: y,
        vy: -0.6,
        life: 1.0,
        decay: 0.025,
        color: color
      });
    }

    update() {
      // Paddle smooth tracking to mouse target
      const paddleCenterTarget = this.targetX - this.paddle.width / 2;
      this.paddle.x += (paddleCenterTarget - this.paddle.x) * 0.35;
      this.paddle.x = Math.max(4, Math.min(this.virtualWidth - this.paddle.width - 4, this.paddle.x));

      // Starfield parallax background animation
      this.starfield.forEach(s => {
        s.y += s.speed;
        if (s.y > this.virtualHeight) {
          s.y = 0;
          s.x = Math.random() * this.virtualWidth;
        }
      });

      if (this.state === 'READY') {
        this.ball.x = this.paddle.x + this.paddle.width / 2;
        this.ball.y = this.paddle.y - this.ball.size - 2;
      } else if (this.state === 'PLAYING') {
        // Ball position update
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Ball trail effect
        this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
        if (this.ball.trail.length > 5) this.ball.trail.shift();

        // Wall collisions
        if (this.ball.x - this.ball.size / 2 <= 0) {
          this.ball.x = this.ball.size / 2;
          this.ball.vx *= -1;
          this.playTone(300, 'square', 0.03, 0.08);
        } else if (this.ball.x + this.ball.size / 2 >= this.virtualWidth) {
          this.ball.x = this.virtualWidth - this.ball.size / 2;
          this.ball.vx *= -1;
          this.playTone(300, 'square', 0.03, 0.08);
        }

        if (this.ball.y - this.ball.size / 2 <= 0) {
          this.ball.y = this.ball.size / 2;
          this.ball.vy *= -1;
          this.playTone(350, 'square', 0.03, 0.08);
        }

        // Paddle collision
        if (
          this.ball.vy > 0 &&
          this.ball.y + this.ball.size / 2 >= this.paddle.y &&
          this.ball.y - this.ball.size / 2 <= this.paddle.y + this.paddle.height &&
          this.ball.x >= this.paddle.x - 4 &&
          this.ball.x <= this.paddle.x + this.paddle.width + 4
        ) {
          const hitOffset = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
          const currentSpeed = Math.hypot(this.ball.vx, this.ball.vy);
          const maxAngle = (Math.PI / 180) * 60; // 60 deg max bounce
          const bounceAngle = hitOffset * maxAngle - Math.PI / 2;

          this.ball.vx = Math.cos(bounceAngle) * currentSpeed;
          this.ball.vy = Math.sin(bounceAngle) * currentSpeed;
          this.ball.y = this.paddle.y - this.ball.size / 2;

          this.spawnParticles(this.ball.x, this.paddle.y, '#f4f4f5', 5);
          this.playTone(220, 'square', 0.04, 0.1);
        }

        // Bottom floor collision (Game Over)
        if (this.ball.y > this.virtualHeight + 10) {
          this.state = 'GAMEOVER';
          this.updateHUD('GAME OVER • CLICK TO RESTART');
          this.spawnParticles(this.paddle.x + this.paddle.width / 2, this.paddle.y, '#ff334b', 20);
          this.playTone(140, 'sawtooth', 0.3, 0.15);
        }

        // Brick collisions
        let activeCount = 0;
        this.bricks.forEach(b => {
          if (!b.active) return;
          activeCount++;

          if (
            this.ball.x + this.ball.size / 2 >= b.x &&
            this.ball.x - this.ball.size / 2 <= b.x + b.w &&
            this.ball.y + this.ball.size / 2 >= b.y &&
            this.ball.y - this.ball.size / 2 <= b.y + b.h
          ) {
            b.hits--;
            this.ball.vy *= -1;

            if (b.hits <= 0) {
              b.active = false;
              this.score += b.points;
              this.updateScoreDisplay();
              this.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);
              this.addFloatingText(`+${b.points}`, b.x + b.w / 2, b.y, b.color);

              if (b.type === 'crimson') {
                this.playTone(880, 'square', 0.08, 0.12);
              } else {
                this.playTone(520, 'triangle', 0.06, 0.1);
              }
            } else {
              this.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#f4f4f5', 6);
              this.playTone(380, 'sine', 0.05, 0.09);
            }
          }
        });

        // Victory check
        if (activeCount === 0) {
          this.state = 'VICTORY';
          this.score += 200;
          this.updateScoreDisplay();
          this.updateHUD('WAVE CLEARED! • CLICK FOR NEXT WAVE');
          this.spawnParticles(this.virtualWidth / 2, this.virtualHeight / 2, '#ff334b', 30);
          this.playTone(660, 'square', 0.15, 0.15);
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= p.decay;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= ft.decay;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    render() {
      const ctx = this.offCtx;
      const w = this.virtualWidth;
      const h = this.virtualHeight;

      // 1. Clear background
      ctx.fillStyle = '#111113';
      ctx.fillRect(0, 0, w, h);

      // 2. Draw starfield
      this.starfield.forEach(s => {
        ctx.fillStyle = s.brightness;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
      });

      // 3. Draw subtle dither grid backdrop
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // 4. Draw bricks with Bayer dithering textures
      this.bricks.forEach(b => {
        if (!b.active) return;

        // Brick body
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // Brick 1px inner border / dither highlights
        if (b.type === 'crimson') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(b.x, b.y, b.w, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
        } else if (b.type === 'armored') {
          ctx.fillStyle = b.hits < b.maxHits ? '#ff334b' : '#1a1a1e';
          ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
        } else if (b.type === 'dither') {
          ctx.fillStyle = 'rgba(17, 17, 19, 0.35)';
          for (let dy = 0; dy < b.h; dy += 2) {
            for (let dx = (dy % 4 === 0 ? 0 : 2); dx < b.w; dx += 4) {
              ctx.fillRect(b.x + dx, b.y + dy, 2, 2);
            }
          }
        }
      });

      // 5. Draw Paddle
      ctx.fillStyle = '#ff334b';
      ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, 1);

      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(this.paddle.x + 2, this.paddle.y + this.paddle.height - 2, this.paddle.width - 4, 2);

      // 6. Draw Ball and Trail
      this.ball.trail.forEach((t, idx) => {
        const alpha = (idx + 1) / this.ball.trail.length;
        ctx.fillStyle = `rgba(255, 51, 75, ${alpha * 0.5})`;
        ctx.fillRect(t.x - this.ball.size / 2, t.y - this.ball.size / 2, this.ball.size, this.ball.size);
      });

      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(
        Math.floor(this.ball.x - this.ball.size / 2),
        Math.floor(this.ball.y - this.ball.size / 2),
        this.ball.size,
        this.ball.size
      );

      // 7. Draw Particles
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      });
      ctx.globalAlpha = 1.0;

      // 8. Draw Floating Texts
      this.floatingTexts.forEach(ft => {
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, Math.floor(ft.x), Math.floor(ft.y));
      });
      ctx.globalAlpha = 1.0;

      // 9. Overlay Banner for GameOver / Victory / Launch Prompt
      if (this.state === 'READY') {
        ctx.fillStyle = 'rgba(17, 17, 19, 0.75)';
        ctx.fillRect(0, h / 2 + 10, w, 24);
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ff334b';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK TO LAUNCH', w / 2, h / 2 + 26);
      } else if (this.state === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(17, 17, 19, 0.85)';
        ctx.fillRect(0, h / 2 - 20, w, 40);
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ff334b';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', w / 2, h / 2 - 4);
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#f4f4f5';
        ctx.fillText('CLICK TO RESTART', w / 2, h / 2 + 12);
      } else if (this.state === 'VICTORY') {
        ctx.fillStyle = 'rgba(17, 17, 19, 0.85)';
        ctx.fillRect(0, h / 2 - 20, w, 40);
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#f4f4f5';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEARED!', w / 2, h / 2 - 4);
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ff334b';
        ctx.fillText('CLICK FOR NEXT LEVEL', w / 2, h / 2 + 12);
      }

      // 10. Blit offscreen buffer to main display canvas
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.offCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    updateHUD(msg) {
      if (this.msgEl) {
        this.msgEl.textContent = msg;
      }
    }

    updateScoreDisplay() {
      if (this.scoreEl) {
        this.scoreEl.textContent = String(this.score).padStart(4, '0');
      }
      if (this.score > this.hiscore) {
        this.hiscore = this.score;
        localStorage.setItem('inzaniak_game_hiscore', String(this.hiscore));
        this.updateHiScoreDisplay();
      }
    }

    updateHiScoreDisplay() {
      if (this.hiscoreEl) {
        this.hiscoreEl.textContent = String(this.hiscore).padStart(4, '0');
      }
    }

    startLoop() {
      if (this.animationFrame) return;
      const loop = () => {
        this.update();
        this.render();
        if (this.isHovered || this.state === 'PLAYING') {
          this.animationFrame = requestAnimationFrame(loop);
        } else {
          this.stopLoop();
        }
      };
      this.animationFrame = requestAnimationFrame(loop);
    }

    stopLoop() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }
  }

  class DitherCodingTerminal {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.codeEl = this.card.querySelector('#coding-terminal-text');
      this.statusEl = this.card.querySelector('.terminal-status');
      if (!this.codeEl) return;

      this.audioCtx = null;
      this.isTyping = false;
      this.typingTimeout = null;
      this.hasCompleted = false;

      // The script sequence (Hitchhiker's Guide to the Galaxy quote & calculation)
      this.codeLines = [
        { type: 'comment', text: '# Hitchhiker\'s Guide to the Galaxy\n' },
        { type: 'keyword', text: 'import ' },
        { type: 'plain', text: 'time\n\n' },
        { type: 'keyword', text: 'def ' },
        { type: 'func', text: 'calculate_ultimate_answer' },
        { type: 'plain', text: '():\n' },
        { type: 'comment', text: '    # Computing for 7.5M years...\n' },
        { type: 'keyword', text: '    return ' },
        { type: 'num', text: '6' },
        { type: 'plain', text: ' * ' },
        { type: 'num', text: '7' },
        { type: 'plain', text: '\n\n' },
        { type: 'plain', text: '>>> ' },
        { type: 'func', text: 'calculate_ultimate_answer' },
        { type: 'plain', text: '()\n' },
        { type: 'result', text: '=> 42  # The Ultimate Answer' }
      ];

      this.init();
    }

    init() {
      this.card.addEventListener('mouseenter', () => this.handleHover());
      this.card.addEventListener('mouseleave', () => this.handleLeave());
      this.card.addEventListener('click', () => this.handleClick());
      this.card.addEventListener('focus', () => this.handleHover());
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playClickSound() {
      if (SoundManager.isMuted || !this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(500 + Math.random() * 250, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.012, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.02);
      } catch (err) {}
    }

    playChimeSound() {
      if (SoundManager.isMuted || !this.audioCtx) return;
      try {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.06);

          gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.06 + 0.12);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(this.audioCtx.currentTime + idx * 0.06);
          osc.stop(this.audioCtx.currentTime + idx * 0.06 + 0.12);
        });
      } catch (err) {}
    }

    handleHover() {
      this.initAudio();
      if (!this.hasCompleted && !this.isTyping) {
        this.startTyping();
      }
    }

    handleLeave() {
      // Retain state
    }

    handleClick() {
      this.initAudio();
      this.restartTyping();
    }

    restartTyping() {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      this.codeEl.innerHTML = '';
      this.hasCompleted = false;
      this.isTyping = false;
      if (this.statusEl) this.statusEl.textContent = 'RUNNING';
      this.startTyping();
    }

    startTyping() {
      this.isTyping = true;
      this.codeEl.innerHTML = '';
      let lineIdx = 0;
      let charIdx = 0;
      let currentSpan = null;

      const typeNextChar = () => {
        if (lineIdx >= this.codeLines.length) {
          this.isTyping = false;
          this.hasCompleted = true;
          if (this.statusEl) this.statusEl.textContent = 'EXECUTED (0.042s)';
          this.playChimeSound();
          return;
        }

        const chunk = this.codeLines[lineIdx];

        if (charIdx === 0) {
          currentSpan = document.createElement('span');
          if (chunk.type === 'keyword') currentSpan.className = 'term-keyword';
          else if (chunk.type === 'string') currentSpan.className = 'term-string';
          else if (chunk.type === 'comment') currentSpan.className = 'term-comment';
          else if (chunk.type === 'func') currentSpan.className = 'term-func';
          else if (chunk.type === 'num') currentSpan.className = 'term-num';
          else if (chunk.type === 'result') currentSpan.className = 'term-result-box';
          this.codeEl.appendChild(currentSpan);
        }

        currentSpan.textContent += chunk.text[charIdx];
        charIdx++;

        if (chunk.text[charIdx - 1] !== '\n' && chunk.text[charIdx - 1] !== ' ') {
          this.playClickSound();
        }

        if (charIdx >= chunk.text.length) {
          lineIdx++;
          charIdx = 0;
        }

        const delay = chunk.type === 'result' ? 250 : (15 + Math.random() * 25);
        this.typingTimeout = setTimeout(typeNextChar, delay);
      };

      typeNextChar();
    }
  }

  class DitherMinimalDAW {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.playBtn = this.card.querySelector('#daw-play-btn');
      this.bpmBtn = this.card.querySelector('#daw-bpm-btn');
      this.presetBtn = this.card.querySelector('#daw-preset-btn');
      this.steps = Array.from(this.card.querySelectorAll('.daw-step'));

      this.audioCtx = null;
      this.isPlaying = false;
      this.bpm = 120;
      this.currentStep = 0;
      this.timerId = null;

      // 4 Tracks: synth, hihat, snare, kick (8 steps each)
      this.tracks = {
        synth: [1, 0, 0, 1, 0, 1, 0, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        kick:  [1, 0, 0, 0, 1, 0, 0, 0]
      };

      // Synth note frequencies for pentatonic ambient scale
      this.synthNotes = [220, 261.63, 329.63, 392.00, 440, 523.25, 659.25, 783.99];

      this.presets = [
        {
          name: 'AMBIENT',
          bpm: 110,
          synth: [1, 0, 1, 0, 0, 1, 0, 1],
          hihat: [1, 0, 1, 0, 1, 0, 1, 0],
          snare: [0, 0, 1, 0, 0, 0, 1, 0],
          kick:  [1, 0, 0, 0, 1, 0, 0, 0]
        },
        {
          name: 'SYNTHWAVE',
          bpm: 124,
          synth: [1, 0, 0, 1, 1, 0, 1, 0],
          hihat: [1, 1, 1, 1, 1, 1, 1, 1],
          snare: [0, 0, 1, 0, 0, 0, 1, 0],
          kick:  [1, 0, 0, 1, 1, 0, 0, 0]
        },
        {
          name: 'LO-FI BEAT',
          bpm: 95,
          synth: [1, 0, 0, 0, 1, 0, 1, 0],
          hihat: [1, 0, 1, 1, 0, 1, 1, 0],
          snare: [0, 0, 1, 0, 0, 0, 1, 0],
          kick:  [1, 0, 0, 0, 0, 1, 0, 0]
        }
      ];
      this.currentPresetIdx = 0;

      this.init();
    }

    init() {
      setupMuteButton(this.card.querySelector('#daw-mute-btn'));
      this.renderStepStates();

      // Step toggle click
      this.steps.forEach(stepBtn => {
        stepBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = stepBtn.closest('.daw-row');
          const trackName = row ? row.dataset.track : null;
          const stepIdx = parseInt(stepBtn.dataset.step, 10);

          if (trackName && this.tracks[trackName] !== undefined) {
            this.tracks[trackName][stepIdx] = this.tracks[trackName][stepIdx] ? 0 : 1;
            this.renderStepStates();
            this.initAudio();
            if (this.tracks[trackName][stepIdx]) {
              this.triggerSound(trackName, stepIdx);
            }
          }
        });
      });

      // Controls
      if (this.playBtn) {
        this.playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.initAudio();
          this.togglePlay();
        });
      }

      if (this.bpmBtn) {
        this.bpmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const bpms = [95, 110, 124, 140];
          const nextIdx = (bpms.indexOf(this.bpm) + 1) % bpms.length;
          this.bpm = bpms[nextIdx];
          this.bpmBtn.textContent = `${this.bpm} BPM`;
          if (this.isPlaying) {
            this.stopScheduler();
            this.startScheduler();
          }
        });
      }

      if (this.presetBtn) {
        this.presetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentPresetIdx = (this.currentPresetIdx + 1) % this.presets.length;
          const preset = this.presets[this.currentPresetIdx];
          this.bpm = preset.bpm;
          if (this.bpmBtn) this.bpmBtn.textContent = `${this.bpm} BPM`;
          this.tracks.synth = [...preset.synth];
          this.tracks.hihat = [...preset.hihat];
          this.tracks.snare = [...preset.snare];
          this.tracks.kick = [...preset.kick];
          this.renderStepStates();
          this.initAudio();
        });
      }

      // Auto start on hover
      this.card.addEventListener('mouseenter', () => {
        this.initAudio();
        if (!this.isPlaying) {
          this.startPlay();
        }
      });
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    renderStepStates() {
      this.steps.forEach(stepBtn => {
        const row = stepBtn.closest('.daw-row');
        const trackName = row ? row.dataset.track : null;
        const stepIdx = parseInt(stepBtn.dataset.step, 10);

        if (trackName && this.tracks[trackName]) {
          if (this.tracks[trackName][stepIdx]) {
            stepBtn.classList.add('is-on');
          } else {
            stepBtn.classList.remove('is-on');
          }
        }
      });
    }

    togglePlay() {
      if (this.isPlaying) {
        this.stopPlay();
      } else {
        this.startPlay();
      }
    }

    startPlay() {
      this.isPlaying = true;
      if (this.playBtn) {
        this.playBtn.classList.add('daw-btn--active');
        this.playBtn.textContent = '⏸ PAUSE';
      }
      this.startScheduler();
    }

    stopPlay() {
      this.isPlaying = false;
      if (this.playBtn) {
        this.playBtn.classList.remove('daw-btn--active');
        this.playBtn.textContent = '▶ PLAY';
      }
      this.stopScheduler();
      this.clearStepHighlights();
    }

    startScheduler() {
      const intervalMs = (60 / this.bpm / 2) * 1000;
      this.timerId = setInterval(() => {
        this.tick();
      }, intervalMs);
    }

    stopScheduler() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    clearStepHighlights() {
      this.steps.forEach(s => s.classList.remove('is-playing'));
    }

    tick() {
      this.clearStepHighlights();

      this.steps.forEach(stepBtn => {
        const stepIdx = parseInt(stepBtn.dataset.step, 10);
        if (stepIdx === this.currentStep) {
          stepBtn.classList.add('is-playing');
        }
      });

      Object.keys(this.tracks).forEach(trackName => {
        if (this.tracks[trackName][this.currentStep]) {
          this.triggerSound(trackName, this.currentStep);
        }
      });

      this.currentStep = (this.currentStep + 1) % 8;
    }

    triggerSound(track, stepIdx) {
      if (SoundManager.isMuted || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      if (track === 'kick') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (track === 'snare') {
        const bufferSize = this.audioCtx.sampleRate * 0.08;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.audioCtx.createBufferSource();
        whiteNoise.buffer = buffer;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        whiteNoise.connect(gain);
        gain.connect(this.audioCtx.destination);
        whiteNoise.start(now);
      } else if (track === 'hihat') {
        const bufferSize = this.audioCtx.sampleRate * 0.03;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);
        noise.start(now);
      } else if (track === 'synth') {
        const freq = this.synthNotes[stepIdx % this.synthNotes.length];
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    }
  }

  class DitherTechTelemetry {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.canvas = this.card.querySelector('#tech-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.stressBtn = this.card.querySelector('#tech-stress-btn');
      this.cpuValEl = this.card.querySelector('#tech-cpu-val');
      this.memValEl = this.card.querySelector('#tech-mem-val');
      this.memFillEl = this.card.querySelector('#tech-mem-fill');
      this.netValEl = this.card.querySelector('#tech-net-val');
      this.netFillEl = this.card.querySelector('#tech-net-fill');

      this.nodeLoadEls = [
        this.card.querySelector('#node-1-load'),
        this.card.querySelector('#node-2-load'),
        this.card.querySelector('#node-3-load'),
        this.card.querySelector('#node-4-load')
      ];

      this.history = new Array(40).fill(22);
      this.cpuLoad = 24;
      this.memLoad = 42;
      this.netTraffic = 1.2;
      this.isStressed = false;

      this.audioCtx = null;
      this.intervalId = null;

      this.init();
    }

    init() {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      if (this.stressBtn) {
        this.stressBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.triggerStressTest();
        });
      }

      this.startMonitoring();
      this.render();
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playBeep(freq = 600, duration = 0.05) {
      if (SoundManager.isMuted) return;
      this.initAudio();
      if (!this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (err) {}
    }

    triggerStressTest() {
      this.isStressed = true;
      this.playBeep(880, 0.1);
      setTimeout(() => this.playBeep(1200, 0.12), 100);

      this.cpuLoad = 96;
      this.memLoad = 88;
      this.netTraffic = 8.4;

      setTimeout(() => {
        this.isStressed = false;
      }, 3500);
    }

    resizeCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      }
    }

    startMonitoring() {
      if (this.intervalId) return;
      this.intervalId = setInterval(() => {
        this.updateTelemetry();
        this.render();
      }, 200);
    }

    updateTelemetry() {
      if (this.isStressed) {
        this.cpuLoad = Math.min(99, Math.max(85, this.cpuLoad + (Math.random() * 10 - 5)));
        this.memLoad = Math.min(95, Math.max(80, this.memLoad + (Math.random() * 4 - 2)));
        this.netTraffic = Math.min(9.8, Math.max(7.2, this.netTraffic + (Math.random() * 1.5 - 0.75)));
      } else {
        this.cpuLoad = Math.min(55, Math.max(15, this.cpuLoad + (Math.random() * 8 - 4)));
        this.memLoad = Math.min(65, Math.max(38, this.memLoad + (Math.random() * 2 - 1)));
        this.netTraffic = Math.min(3.5, Math.max(0.8, this.netTraffic + (Math.random() * 0.4 - 0.2)));
      }

      this.history.push(this.cpuLoad);
      if (this.history.length > 40) this.history.shift();

      if (this.cpuValEl) this.cpuValEl.textContent = `${Math.round(this.cpuLoad)}%`;
      if (this.memValEl) this.memValEl.textContent = `${Math.round(this.memLoad)}%`;
      if (this.memFillEl) this.memFillEl.style.width = `${Math.round(this.memLoad)}%`;
      if (this.netValEl) this.netValEl.textContent = `${this.netTraffic.toFixed(1)} GB/s`;
      if (this.netFillEl) this.netFillEl.style.width = `${Math.min(100, (this.netTraffic / 10) * 100)}%`;

      this.nodeLoadEls.forEach((el, idx) => {
        if (el) {
          const nodeVal = Math.round(Math.min(99, Math.max(8, this.cpuLoad + (idx * 5 - 10) + Math.random() * 6)));
          el.textContent = `${nodeVal}%`;
        }
      });
    }

    render() {
      const w = this.canvas.width;
      const h = this.canvas.height;
      if (!w || !h) return;
      const ctx = this.ctx;

      ctx.fillStyle = '#111113';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      ctx.fillStyle = this.isStressed ? 'rgba(255, 51, 75, 0.25)' : 'rgba(255, 51, 75, 0.12)';
      ctx.beginPath();
      const stepX = w / (this.history.length - 1);
      ctx.moveTo(0, h);

      this.history.forEach((val, i) => {
        const y = h - (val / 100) * (h - 6);
        ctx.lineTo(i * stepX, y);
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ff334b';
      ctx.lineWidth = 2;
      ctx.beginPath();

      this.history.forEach((val, i) => {
        const y = h - (val / 100) * (h - 6);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * stepX, y);
      });
      ctx.stroke();

      const lastVal = this.history[this.history.length - 1];
      const lastY = h - (lastVal / 100) * (h - 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w - 4, lastY - 2, 4, 4);
    }
  }

  class DitherGenerativeArt {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.canvas = this.card.querySelector('#art-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.genBtn = this.card.querySelector('#art-gen-btn');
      this.stepTxtEl = this.card.querySelector('#art-step-txt');
      this.stepFillEl = this.card.querySelector('#art-step-fill');

      this.virtualWidth = 240;
      this.virtualHeight = 135;

      this.offCanvas = document.createElement('canvas');
      this.offCanvas.width = this.virtualWidth;
      this.offCanvas.height = this.virtualHeight;
      this.offCtx = this.offCanvas.getContext('2d');

      this.isGenerating = false;
      this.currentStep = 20;
      this.totalSteps = 20;

      this.mouseX = 0.5;
      this.mouseY = 0.5;
      this.seed = Math.random() * 100;
      this.audioCtx = null;

      this.init();
    }

    init() {
      this.resizeCanvas();
      window.addEventListener('resize', () => {
        this.resizeCanvas();
        this.render();
      });

      this.card.addEventListener('mouseenter', () => {
        this.resizeCanvas();
        this.startAnimLoop();
      });

      this.card.addEventListener('mouseleave', () => {
        this.stopAnimLoop();
      });

      this.card.addEventListener('mousemove', (e) => {
        const rect = this.card.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.mouseX = (e.clientX - rect.left) / rect.width;
          this.mouseY = (e.clientY - rect.top) / rect.height;
        }
        if (!this.animFrame) {
          this.render();
        }
      });

      if (this.genBtn) {
        this.genBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.triggerGeneration();
        });
      }

      this.card.addEventListener('click', () => {
        if (!this.isGenerating) {
          this.triggerGeneration();
        }
      });

      // Initial render pass
      setTimeout(() => {
        this.resizeCanvas();
        this.render();
      }, 50);
    }

    startAnimLoop() {
      if (this.animFrame) return;
      const loop = () => {
        this.seed += 0.02;
        this.render();
        this.animFrame = requestAnimationFrame(loop);
      };
      this.animFrame = requestAnimationFrame(loop);
    }

    stopAnimLoop() {
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playChime() {
      if (SoundManager.isMuted) return;
      this.initAudio();
      if (!this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, this.audioCtx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.2);
      } catch (err) {}
    }

    triggerGeneration() {
      if (this.isGenerating) return;
      this.isGenerating = true;
      this.currentStep = 0;
      this.seed = Math.random() * 100;

      const stepInterval = setInterval(() => {
        this.currentStep++;
        const pct = (this.currentStep / this.totalSteps) * 100;

        if (this.stepTxtEl) this.stepTxtEl.textContent = `DENOISING (${this.currentStep}/${this.totalSteps})`;
        if (this.stepFillEl) this.stepFillEl.style.width = `${pct}%`;

        this.render();

        if (this.currentStep >= this.totalSteps) {
          clearInterval(stepInterval);
          this.isGenerating = false;
          if (this.stepTxtEl) this.stepTxtEl.textContent = 'DONE (20/20)';
          this.playChime();
        }
      }, 50);
    }

    resizeCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      } else {
        this.canvas.width = 300;
        this.canvas.height = 94;
      }
    }

    render() {
      const w = this.virtualWidth;
      const h = this.virtualHeight;
      if (!w || !h) return;

      const imgData = this.offCtx.createImageData(w, h);
      const data = imgData.data;

      const noiseAmount = 1 - (this.currentStep / this.totalSteps);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;

          const nx = (x / w - 0.5) * 4 + (this.mouseX - 0.5) * 2;
          const ny = (y / h - 0.5) * 4 + (this.mouseY - 0.5) * 2;
          const dist = Math.sqrt(nx * nx + ny * ny);

          const patternVal = Math.sin(nx * 3 + this.seed) * Math.cos(ny * 3 + this.seed) + Math.sin(dist * 5 - this.seed);
          let normVal = (patternVal + 2) / 4;

          if (noiseAmount > 0) {
            const rNoise = Math.random();
            normVal = normVal * (1 - noiseAmount) + rNoise * noiseAmount;
          }

          const bv = BAYER_4X4[y % 4][x % 4] / 16.0;

          let r = 17, g = 17, b = 19;
          if (normVal > bv + 0.25) {
            r = 255; g = 51; b = 75;
          } else if (normVal > bv) {
            r = 244; g = 244; b = 245;
          } else if (normVal > bv - 0.2) {
            r = 38; g = 38; b = 44;
          }

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }

      this.offCtx.putImageData(imgData, 0, 0);

      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.offCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  class DitherBloggingTypewriter {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.nextBtn = this.card.querySelector('#blogging-next-btn');
      this.metaEl = this.card.querySelector('#blogging-post-meta');
      this.titleEl = this.card.querySelector('#blogging-post-title');
      this.textEl = this.card.querySelector('#blogging-text');

      this.posts = [
        {
          meta: "ARTICLE 01/03 • TECH & SHADERS",
          readtime: "⏱ 4 MIN",
          title: "Building Procedural Dither Shaders in WebGL",
          text: "How Bayer matrix thresholding and blue-noise dithering create authentic retro pixel-art aesthetic at 60 FPS in modern web applications.",
          url: "blog/"
        },
        {
          meta: "ARTICLE 02/03 • AI & GENERATIVE ART",
          readtime: "⏱ 6 MIN",
          title: "Generative AI & Custom LoRA Fine-Tuning",
          text: "Exploring latent diffusion space, dataset curation, and training compact custom LoRA models for unique stylized digital illustrations.",
          url: "blog/"
        },
        {
          meta: "ARTICLE 03/03 • MUSIC & MODULAR SYNTH",
          readtime: "⏱ 5 MIN",
          title: "Generative Ambient Patches in Eurorack",
          text: "Designing generative soundscapes using control voltage, clock dividers, and pentatonic hardware quantizers in my home studio.",
          url: "blog/"
        }
      ];

      this.currentIndex = 0;
      this.typingTimeout = null;
      this.isTyping = false;
      this.audioCtx = null;

      this.init();
    }

    init() {
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.nextPost();
        });
      }

      this.card.addEventListener('mouseenter', () => {
        if (!this.isTyping && (!this.textEl || !this.textEl.textContent)) {
          this.typeCurrentPost();
        }
      });

      this.card.addEventListener('click', () => {
        if (!this.isTyping) {
          this.nextPost();
        }
      });

      this.typeCurrentPost();
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playClickSound() {
      if (SoundManager.isMuted) return;
      this.initAudio();
      if (!this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 300, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.015, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.02);
      } catch (err) {}
    }

    nextPost() {
      this.currentIndex = (this.currentIndex + 1) % this.posts.length;
      this.typeCurrentPost();
    }

    typeCurrentPost() {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      const post = this.posts[this.currentIndex];
      if (this.metaEl) this.metaEl.textContent = post.meta;
      if (this.titleEl) this.titleEl.textContent = post.title;

      if (!this.textEl) return;
      this.textEl.textContent = '';
      this.isTyping = true;

      let charIndex = 0;
      const typeChar = () => {
        if (charIndex < post.text.length) {
          this.textEl.textContent += post.text.charAt(charIndex);
          charIndex++;

          if (charIndex % 3 === 0) {
            this.playClickSound();
          }

          this.typingTimeout = setTimeout(typeChar, 25 + Math.random() * 20);
        } else {
          this.isTyping = false;
        }
      };

      typeChar();
    }
  }

  class GenerativeAIRadar {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.labelEl = this.card.querySelector('#genai-signal-label');
      this.titleEl = this.card.querySelector('#genai-signal-title');
      this.metaEl = this.card.querySelector('#genai-signal-meta');
      this.topicButtons = Array.from(this.card.querySelectorAll('[data-genai-topic]'));
      this.activeIndex = 0;
      this.scanInterval = null;
      this.signals = [
        { label: 'SCANNING: MODELS', title: 'New model releases', meta: 'READ · TEST · COMPARE' },
        { label: 'SCANNING: NEWS', title: 'Latest GenAI news', meta: 'FOLLOW · VERIFY · CONNECT' },
        { label: 'SCANNING: TOOLS', title: 'Emerging AI tools', meta: 'DISCOVER · BUILD · REVIEW' },
        { label: 'SCANNING: TRENDS', title: 'Signals worth tracking', meta: 'STUDY · QUESTION · ADAPT' }
      ];

      this.init();
    }

    init() {
      this.topicButtons.forEach((button, index) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          this.showSignal(index);
          this.restartScan();
        });
      });

      this.card.addEventListener('mouseenter', () => this.startScan());
      this.card.addEventListener('mouseleave', () => this.stopScan());
      this.card.addEventListener('focusin', () => this.startScan());
      this.card.addEventListener('focusout', (event) => {
        if (!this.card.contains(event.relatedTarget)) this.stopScan();
      });
    }

    showSignal(index) {
      this.activeIndex = index % this.signals.length;
      const signal = this.signals[this.activeIndex];
      if (this.labelEl) this.labelEl.textContent = signal.label;
      if (this.titleEl) this.titleEl.textContent = signal.title;
      if (this.metaEl) this.metaEl.textContent = signal.meta;
      this.topicButtons.forEach((button, buttonIndex) => {
        button.classList.toggle('is-active', buttonIndex === this.activeIndex);
      });
    }

    startScan() {
      if (this.scanInterval) return;
      this.scanInterval = window.setInterval(() => {
        this.showSignal((this.activeIndex + 1) % this.signals.length);
      }, 1800);
    }

    stopScan() {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    restartScan() {
      this.stopScan();
      this.startScan();
    }
  }

  class SportsMatchCenter {
    constructor(cardEl) {
      this.card = cardEl;
      if (!this.card) return;

      this.tabs = Array.from(this.card.querySelectorAll('[data-sport]'));
      this.periodEl = this.card.querySelector('#sports-period');
      this.homeTeamEl = this.card.querySelector('#sports-home-team');
      this.awayTeamEl = this.card.querySelector('#sports-away-team');
      this.homeScoreEl = this.card.querySelector('#sports-home-score');
      this.awayScoreEl = this.card.querySelector('#sports-away-score');
      this.homeScorersEl = this.card.querySelector('#sports-home-scorers');
      this.awayScorersEl = this.card.querySelector('#sports-away-scorers');
      this.playEl = this.card.querySelector('#sports-play-text');
      this.statOneLabelEl = this.card.querySelector('#sports-stat-one-label');
      this.statOneEl = this.card.querySelector('#sports-stat-one');
      this.statTwoLabelEl = this.card.querySelector('#sports-stat-two-label');
      this.statTwoEl = this.card.querySelector('#sports-stat-two');
      this.statThreeLabelEl = this.card.querySelector('#sports-stat-three-label');
      this.statThreeEl = this.card.querySelector('#sports-stat-three');
      this.activeSport = 'football';
      this.clockSeconds = 72 * 60 + 14;
      this.clockInterval = null;
      this.playIndex = 0;
      this.matches = {
        football: {
          period: 'FT · 29 AUG 2009',
          home: 'MILAN',
          away: 'INTER',
          homeScore: '0',
          awayScore: '4',
          homeScorers: [],
          awayScorers: ["Motta 29'", "Milito 36' (p)", "Maicon 45+1'", "Stankovic 67'"],
          startSeconds: 90 * 60,
          plays: [
            "29' GOAL! THIAGO MOTTA (0-1)",
            "36' GOAL! DIEGO MILITO PENALTY (0-2)",
            "40' RED CARD! GATTUSO SENT OFF",
            "45+1' GOAL! MAICON POWER STRIKE (0-3)",
            "67' GOAL! DEJAN STANKOVIC SCREAMER (0-4)",
            "90' FULL TIME · MILAN 0-4 INTER (LEO VS MOU)"
          ],
          stats: [['MATCH', 'LEO VS MOU'], ['SERIE A', '09/10'], ['RED CARD', 'GATTUSO 40\'']]
        },
        'american-football': {
          period: 'FT · SUPER BOWL LX (2026)',
          home: 'SEAHAWKS',
          away: 'PATRIOTS',
          homeScore: '29',
          awayScore: '13',
          homeScorers: ["Walker III 8yd TD", "Myers 5x FG (Rec)"],
          awayScorers: ["Maye 12yd TD", "Stevenson 4yd TD"],
          startSeconds: 60 * 60,
          plays: [
            "1Q 4:12 · MYERS 31 YD FIELD GOAL (3-0)",
            "2Q 8:45 · MYERS 42 YD FIELD GOAL (6-0)",
            "3Q 11:20 · MYERS 28 YD FIELD GOAL (9-0)",
            "4Q 13:05 · KENNETH WALKER III 8 YD TD RUN (16-0)",
            "4Q 9:30 · MYERS 49 YD FIELD GOAL (19-0)",
            "4Q 6:15 · DRAKE MAYE 12 YD TD PASS (19-7)",
            "4Q 2:40 · MYERS 35 YD FG (SUPER BOWL RECORD)",
            "FT · SEAHAWKS WIN SUPER BOWL LX (29-13)"
          ],
          stats: [['SUPER BOWL', 'LX (2026)'], ['MVP', 'K. WALKER III'], ['FG RECORD', 'MYERS 5 FG']]
        }
      };

      this.init();
    }

    init() {
      this.tabs.forEach((tab) => {
        tab.addEventListener('click', (event) => {
          event.stopPropagation();
          this.setSport(tab.dataset.sport);
        });
      });

      this.card.addEventListener('mouseenter', () => this.startClock());
      this.card.addEventListener('mouseleave', () => this.stopClock());
      this.card.addEventListener('focusin', () => this.startClock());
      this.card.addEventListener('focusout', (event) => {
        if (!this.card.contains(event.relatedTarget)) this.stopClock();
      });
    }

    setSport(sport) {
      const match = this.matches[sport];
      if (!match) return;

      this.activeSport = sport;
      this.clockSeconds = match.startSeconds;
      this.playIndex = 0;
      this.tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.sport === sport));
      if (this.homeTeamEl) this.homeTeamEl.textContent = match.home;
      if (this.awayTeamEl) this.awayTeamEl.textContent = match.away;
      if (this.homeScoreEl) this.homeScoreEl.textContent = match.homeScore;
      if (this.awayScoreEl) this.awayScoreEl.textContent = match.awayScore;
      if (this.homeScorersEl) {
        const items = Array.isArray(match.homeScorers) ? match.homeScorers : (match.homeScorers ? [match.homeScorers] : []);
        this.homeScorersEl.innerHTML = items.map((s) => `<div>${s}</div>`).join('');
      }
      if (this.awayScorersEl) {
        const items = Array.isArray(match.awayScorers) ? match.awayScorers : (match.awayScorers ? [match.awayScorers] : []);
        this.awayScorersEl.innerHTML = items.map((s) => `<div>${s}</div>`).join('');
      }
      this.updateStats(match);
      this.updateClock();
    }

    updateStats(match) {
      const labels = [this.statOneLabelEl, this.statTwoLabelEl, this.statThreeLabelEl];
      const values = [this.statOneEl, this.statTwoEl, this.statThreeEl];
      match.stats.forEach((stat, index) => {
        if (labels[index]) labels[index].textContent = stat[0];
        if (values[index]) values[index].textContent = stat[1];
      });
      if (this.playEl) this.playEl.textContent = match.plays[this.playIndex];
    }

    updateClock() {
      const match = this.matches[this.activeSport];
      if (this.periodEl) this.periodEl.textContent = match.period;
    }

    startClock() {
      if (this.clockInterval) return;
      this.clockInterval = window.setInterval(() => {
        this.clockSeconds += this.activeSport === 'football' ? 1 : -1;
        if (this.clockSeconds < 0) this.clockSeconds = this.matches[this.activeSport].startSeconds;
        if (this.clockSeconds % 6 === 0) {
          const match = this.matches[this.activeSport];
          this.playIndex = (this.playIndex + 1) % match.plays.length;
          if (this.playEl) this.playEl.textContent = match.plays[this.playIndex];
        }
        this.updateClock();
      }, 1000);
    }

    stopClock() {
      window.clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  // Initialize passion cards when DOM is ready
  function initPassionCards() {
    const gamingCard = document.getElementById('gaming-card');
    if (gamingCard) {
      new DitherBreakoutGame(gamingCard);
    }

    const codingCard = document.getElementById('coding-card');
    if (codingCard) {
      new DitherCodingTerminal(codingCard);
    }

    const musicCard = document.getElementById('music-card');
    if (musicCard) {
      new DitherMinimalDAW(musicCard);
    }

    const techCard = document.getElementById('tech-card');
    if (techCard) {
      new DitherTechTelemetry(techCard);
    }

    const artCard = document.getElementById('art-card');
    if (artCard) {
      new DitherGenerativeArt(artCard);
    }

    const bloggingCard = document.getElementById('blogging-card');
    if (bloggingCard) {
      new DitherBloggingTypewriter(bloggingCard);
    }

    const genaiCard = document.getElementById('genai-card');
    if (genaiCard) {
      new GenerativeAIRadar(genaiCard);
    }

    const sportsCard = document.getElementById('sports-card');
    if (sportsCard) {
      new SportsMatchCenter(sportsCard);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPassionCards);
  } else {
    initPassionCards();
  }
})();
