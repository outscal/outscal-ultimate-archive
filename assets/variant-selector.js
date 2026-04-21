/**
 * VariantSelector — a floating ring-shaped UI for switching between
 * preview variants of a design. Drop-in component.
 *
 * Usage:
 *   <script src="assets/variant-selector.js"></script>
 *   <script>
 *     const vs = VariantSelector.mount({
 *       label: 'Resources stats',         // small text at the ring centre
 *       variants: [
 *         { id: 'a', label: 'Strip' },
 *         { id: 'b', label: '2-col' },
 *         { id: 'c', label: 'Own row' }
 *       ],
 *       active: 'a',                      // optional — defaults to first
 *       onSelect: (id) => {               // fires on every variant change
 *         document.querySelectorAll('[data-sv]').forEach(el => {
 *           el.hidden = el.dataset.sv !== id;
 *         });
 *       }
 *     });
 *
 *     // Programmatic control:
 *     vs.set('b');      // switch variant
 *     vs.destroy();     // remove from DOM
 *   </script>
 *
 * The component is self-contained: injects its own styles, uses no globals
 * beyond window.VariantSelector, has no external dependencies.
 * The × button in the top-right corner of the ring removes the selector.
 */

(function () {
  'use strict';

  const CSS = `
    .vs-ring {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      border-radius: 50%;
      background: #0A0A0A;
      box-shadow: 0 6px 32px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.06);
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #fff;
      animation: vs-appear .25s ease;
    }
    .vs-ring[hidden] { display: none; }
    @keyframes vs-appear {
      from { transform: scale(0.82); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .vs-ring-center {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      max-width: 78px;
    }
    .vs-ring-center .vs-label {
      font-size: 9px;
      letter-spacing: .18em;
      text-transform: uppercase;
      opacity: .5;
      display: block;
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .vs-ring-center .vs-active {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: .04em;
      color: #F5C518;
      line-height: 1.15;
    }
    .vs-ring-btn {
      position: absolute;
      top: 50%; left: 50%;
      width: 38px; height: 38px;
      border-radius: 50%;
      background: #1A1A1A;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      transform: translate(var(--vs-tx), var(--vs-ty));
      transition: background .15s ease, border-color .15s ease, transform .15s ease;
    }
    .vs-ring-btn:hover {
      background: #2A2A2A;
      transform: translate(var(--vs-tx), var(--vs-ty)) scale(1.08);
    }
    .vs-ring-btn.active {
      background: #F5C518;
      color: #0A0A0A;
      border-color: #F5C518;
      box-shadow: 0 0 0 4px rgba(245,197,24,0.18);
    }
    .vs-ring-close {
      position: absolute;
      top: -6px; right: -6px;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: #fff;
      color: #0A0A0A;
      border: 0;
      font-family: inherit;
      font-size: 13px;
      line-height: 1;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      transition: transform .15s ease;
      padding: 0;
    }
    .vs-ring-close:hover { transform: scale(1.12); }

    /* Minimized bubble — the × minimises the ring down to this,
       click the bubble to restore the full ring. */
    .vs-reopener {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: #F5C518;
      color: #0A0A0A;
      border: 0;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: .04em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: transform .15s ease, box-shadow .15s ease;
      animation: vs-appear .25s ease;
    }
    .vs-reopener[hidden] { display: none; }
    .vs-reopener:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(0,0,0,0.30);
    }
    .vs-reopener::after {
      content: '';
      position: absolute;
      inset: -3px;
      border: 1.5px solid rgba(245,197,24,0.35);
      border-radius: 50%;
    }

    @media (prefers-reduced-motion: reduce) {
      .vs-ring, .vs-reopener { animation: none; }
      .vs-ring-btn, .vs-ring-close, .vs-reopener { transition: none; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('vs-ring-styles')) return;
    const style = document.createElement('style');
    style.id = 'vs-ring-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function positionButton(btn, index, total, radius) {
    const angle = (index / total) * 360 - 90; // start at top
    const rad = angle * Math.PI / 180;
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    btn.style.setProperty('--vs-tx', `calc(-50% + ${x.toFixed(2)}px)`);
    btn.style.setProperty('--vs-ty', `calc(-50% + ${y.toFixed(2)}px)`);
  }

  // Size ring + button radius based on number of variants, so buttons
  // don't crowd the centre label.
  function sizesFor(n) {
    if (n <= 3) return { ring: 160, radius: 54 };
    if (n === 4) return { ring: 170, radius: 60 };
    if (n === 5) return { ring: 184, radius: 68 };
    return { ring: 200, radius: 76 };
  }

  function mount(opts) {
    const { label = '', variants = [], active, onSelect } = opts || {};
    if (!Array.isArray(variants) || variants.length === 0) {
      console.warn('[VariantSelector] No variants provided; not mounting.');
      return null;
    }

    injectStyles();

    const { ring: ringSize, radius } = sizesFor(variants.length);

    const ring = document.createElement('div');
    ring.className = 'vs-ring';
    ring.style.width = ringSize + 'px';
    ring.style.height = ringSize + 'px';
    ring.setAttribute('role', 'group');
    ring.setAttribute('aria-label', label || 'Variant selector');

    // Center label + active-variant readout
    const center = document.createElement('div');
    center.className = 'vs-ring-center';
    const lbl = document.createElement('span');
    lbl.className = 'vs-label';
    lbl.textContent = label;
    const act = document.createElement('span');
    act.className = 'vs-active';
    center.appendChild(lbl);
    center.appendChild(act);
    ring.appendChild(center);

    // Ring buttons
    const buttons = variants.map((v, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vs-ring-btn';
      btn.textContent = String(v.id).toUpperCase();
      btn.title = v.label || v.id;
      btn.dataset.vid = v.id;
      ring.appendChild(btn);
      positionButton(btn, i, variants.length, radius);
      return btn;
    });

    // Close button — minimises the ring to a reopener bubble
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'vs-ring-close';
    close.textContent = '\u00D7'; // ×
    close.title = 'Minimise selector';
    close.setAttribute('aria-label', 'Minimise variant selector');
    ring.appendChild(close);

    document.body.appendChild(ring);

    // Reopener — shown only when the ring is minimised
    const reopener = document.createElement('button');
    reopener.type = 'button';
    reopener.className = 'vs-reopener';
    reopener.hidden = true;
    reopener.title = 'Reopen variant selector';
    reopener.setAttribute('aria-label', 'Reopen variant selector');
    document.body.appendChild(reopener);

    let current = active || variants[0].id;

    function setActive(id) {
      const meta = variants.find(v => v.id === id);
      if (!meta) return;
      current = id;
      buttons.forEach(b => b.classList.toggle('active', b.dataset.vid === id));
      act.textContent = meta.label || String(id).toUpperCase();
      reopener.textContent = String(id).toUpperCase();
      if (typeof onSelect === 'function') onSelect(id);
    }

    setActive(current);

    ring.addEventListener('click', (e) => {
      const btn = e.target.closest('.vs-ring-btn');
      if (!btn) return;
      setActive(btn.dataset.vid);
    });

    close.addEventListener('click', () => {
      ring.hidden = true;
      reopener.hidden = false;
    });

    reopener.addEventListener('click', () => {
      reopener.hidden = true;
      ring.hidden = false;
    });

    return {
      element: ring,
      reopener,
      set: setActive,
      get: () => current,
      minimize: () => { ring.hidden = true; reopener.hidden = false; },
      restore: () => { ring.hidden = false; reopener.hidden = true; },
      destroy: () => { ring.remove(); reopener.remove(); }
    };
  }

  window.VariantSelector = { mount };
})();
