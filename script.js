/* script.js — Daymo Digital (clean, consolidated)
   Features:
   - Theme toggle (persists to localStorage)
   - Mobile hamburger menu (open/close + focus management)
   - Smooth internal scrolling (accounts for header height)
   - Back-to-top button
   - Stats counter (supports integers and floats; triggers once on view)
   - Testimonials slider (auto-play, pause on hover, controls, dots)
   - FAQ accordion (one-open behavior optional)
   - Reveal-on-scroll animations (IntersectionObserver)
   - Lazy-loading helper (IntersectionObserver fallback)
   - Contact form basic submit simulation + success toast
   - Small accessibility improvements
*/

(function () {
  'use strict';

  // ---- Helper utilities ----
  const qs = (s, ctx = document) => ctx.querySelector(s);
  const qsa = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const closest = (el, sel) => el.closest ? el.closest(sel) : null;

  // Easing used by counters
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // Throttle util
  function throttle(fn, wait = 100) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  // Simple toast (reusable)
  function showToast(msg, opts = {}) {
    const timeout = opts.timeout || 3500;
    let toast = qs('.dm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'dm-toast';
      Object.assign(toast.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        padding: '12px 16px',
        borderRadius: '10px',
        zIndex: 99999,
        boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
        color: '#fff',
        background: 'rgba(0,0,0,0.75)',
        fontWeight: 600,
      });
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, timeout);
  }

  // ---- Elements we reuse ----
  const docEl = document.documentElement;
  const body = document.body;
  const headerEl = qs('.header');
  const hamburger = qs('#hamburger');
  const navLinksWrap = qs('.nav-links');
  const themeToggle = qs('#themeToggle');
  const backToTopBtn = qs('#backToTop');
  const statsSection = qs('.stats');
  const statNumbers = qsa('.stat-number');
  const testimonialSlides = qsa('.testimonial-slide');
  const sliderPrev = qs('.slider-prev');
  const sliderNext = qs('.slider-next');
  const sliderDots = qsa('.slider-dots .dot');
  const faqItems = qsa('.faq-item');
  const contactForm = qs('#contactForm');
  const heroVisual = qs('.hero-visual');

  // ---- Initialization on DOM ready ----
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initSmoothScroll();
    initBackToTop();
    initStatsCounter();
    initTestimonials();
    initFAQAccordion();
    initScrollReveal();
    initContactForm();
    initLazyLoading();
    initHeroParallax();
    addImageFixCSS(); // optional helper CSS
    debugMediaLoadingDeferred(); // optional debug (safe to remove)
  });

  // ---------------- THEME ----------------
  function initTheme() {
    const KEY = 'dm-theme-v1';
    // default: dark (matches your HTML earlier)
    const saved = localStorage.getItem(KEY);
    const initial = saved || (docEl.getAttribute('data-theme') || 'dark');
    docEl.setAttribute('data-theme', initial);
    updateThemeIcon(initial);

    on(themeToggle, 'click', () => {
      const current = docEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      docEl.setAttribute('data-theme', next);
      localStorage.setItem(KEY, next);
      updateThemeIcon(next);
    });

    function updateThemeIcon(theme) {
      if (!themeToggle) return;
      const icon = themeToggle.querySelector('i');
      if (!icon) return;
      icon.classList.toggle('fa-sun', theme === 'light');
      icon.classList.toggle('fa-moon', theme !== 'light');
      themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      themeToggle.setAttribute('title', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
    }
  }

  // ---------------- NAVIGATION & HAMBURGER ----------------
  function initNavigation() {
    if (!hamburger || !navLinksWrap) return;

    hamburger.addEventListener('click', () => {
      const open = navLinksWrap.classList.toggle('open');
      hamburger.classList.toggle('is-active', open);
      // lock page scroll on mobile when nav is open
      if (open) {
        body.style.overflow = 'hidden';
        // make links keyboard focusable
        qsa('.nav-links a').forEach(a => a.tabIndex = 0);
      } else {
        body.style.overflow = '';
        qsa('.nav-links a').forEach(a => a.tabIndex = -1);
      }
    });

    // Initially set tabindex depending on width
    function setNavTabIndex() {
      const mobile = window.innerWidth < 900;
      qsa('.nav-links a').forEach(a => a.tabIndex = mobile ? -1 : 0);
    }
    setNavTabIndex();
    window.addEventListener('resize', throttle(setNavTabIndex, 200));

    // Close when clicking a nav link (internal anchors)
    qsa('.nav-links a').forEach(a => {
      a.addEventListener('click', (e) => {
        // only auto-close on internal anchors
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#')) {
          if (navLinksWrap.classList.contains('open')) {
            navLinksWrap.classList.remove('open');
            hamburger.classList.remove('is-active');
            body.style.overflow = '';
            qsa('.nav-links a').forEach(n => n.tabIndex = -1);
          }
        }
      });
    });

    // Close on escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && navLinksWrap.classList.contains('open')) {
        navLinksWrap.classList.remove('open');
        hamburger.classList.remove('is-active');
        body.style.overflow = '';
        qsa('.nav-links a').forEach(n => n.tabIndex = -1);
      }
    });
  }

  // ---------------- SMOOTH SCROLL ----------------
  function initSmoothScroll() {
    qsa('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const target = qs(href);
        if (target) {
          e.preventDefault();
          const headerH = headerEl ? headerEl.offsetHeight : 0;
          const top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
          window.scrollTo({ top, behavior: 'smooth' });
          // focus target for accessibility after scroll
          setTimeout(() => {
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
          }, 600);
        }
      });
    });
  }

  // ---------------- BACK TO TOP ----------------
  function initBackToTop() {
    if (!backToTopBtn) return;
    function check() {
      backToTopBtn.classList.toggle('visible', window.pageYOffset > 300);
    }
    on(window, 'scroll', throttle(check, 120));
    check();
    backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ---------------- STATS COUNTER ----------------
  function initStatsCounter() {
    if (!statsSection || !statNumbers.length) return;
    let triggered = false;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          statNumbers.forEach(el => {
            const raw = el.getAttribute('data-count') || el.textContent.trim();
            // normalize: allow values like "5.2" or "350" or "5.2M"
            const m = String(raw).match(/^([\d,.]+)([kKmM]?)$/);
            if (!m) {
              animateNumber(el, parseFloat(raw) || 0);
            } else {
              let num = parseFloat(m[1].replace(/,/g, ''));
              const suffix = m[2].toUpperCase();
              if (suffix === 'K') num *= 1000;
              if (suffix === 'M') num *= 1000000;
              animateNumber(el, num, suffix);
            }
          });
        }
      });
    }, { threshold: 0.35 });

    obs.observe(statsSection);

    function animateNumber(el, target, suffixRaw = '') {
      const duration = 1600;
      const start = 0;
      const startTime = performance.now();
      const isFloat = String(target).includes('.') || target % 1 !== 0;

      function frame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const v = start + (target - start) * easeOutCubic(t);
        // display nicely depending on magnitude
        if (suffixRaw === 'M') {
          el.textContent = (v / 1000000).toFixed(1) + 'M';
        } else if (target >= 1000000 && !suffixRaw) {
          el.textContent = Math.floor(v).toLocaleString();
        } else if (isFloat && target < 10) {
          el.textContent = v.toFixed(1);
        } else {
          el.textContent = Math.floor(v).toLocaleString();
        }
        if (t < 1) requestAnimationFrame(frame);
        else {
          // final set
          if (suffixRaw === 'M') {
            el.textContent = (target / 1000000).toFixed(1) + 'M';
          } else if (target >= 1000000 && !suffixRaw) {
            el.textContent = Math.floor(target).toLocaleString();
          } else if (isFloat && target < 10) {
            el.textContent = parseFloat(target).toFixed(1);
          } else {
            el.textContent = Math.floor(target).toLocaleString();
          }
        }
      }
      requestAnimationFrame(frame);
    }
  }

  // ---------------- TESTIMONIALS SLIDER ----------------
  function initTestimonials() {
    if (!testimonialSlides.length) return;
    let idx = 0;
    const total = testimonialSlides.length;
    let timer = null;
    const INTERVAL = 4500;

    function show(i) {
      idx = (i + total) % total;
      testimonialSlides.forEach((s, j) => s.classList.toggle('active', j === idx));
      sliderDots.forEach((d, j) => d.classList.toggle('active', j === idx));
    }

    function next() { show(idx + 1); }
    function prev() { show(idx - 1); }

    function start() {
      stop();
      timer = setInterval(next, INTERVAL);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    // Controls
    on(sliderNext, 'click', () => { next(); start(); });
    on(sliderPrev, 'click', () => { prev(); start(); });
    sliderDots.forEach((dot, i) => on(dot, 'click', () => { show(i); start(); }));

    const wrap = qs('.testimonials-slider');
    if (wrap) {
      wrap.addEventListener('mouseenter', stop);
      wrap.addEventListener('mouseleave', start);
    }

    // initial
    show(0);
    start();
    // expose to window for debugging if needed
    window._daymoTestimonials = { show, next, prev, start, stop };
  }

  // ---------------- FAQ ACCORDION ----------------
  function initFAQAccordion() {
    if (!faqItems.length) return;
    faqItems.forEach(item => {
      const q = qs('.faq-question', item);
      const a = qs('.faq-answer', item);
      const toggleIcon = qs('.faq-toggle i', item);

      if (!q || !a) return;
      // set initial collapsed style
      a.style.height = '0';
      a.style.overflow = 'hidden';
      a.style.transition = 'height 300ms ease';

      q.addEventListener('click', () => {
        const open = item.classList.contains('active');
        // Optional: close others (accordion behavior)
        faqItems.forEach(other => {
          if (other !== item) {
            other.classList.remove('active');
            const otherA = qs('.faq-answer', other);
            if (otherA) otherA.style.height = '0';
            const otherIcon = qs('.faq-toggle i', other);
            if (otherIcon) {
              otherIcon.classList.remove('fa-chevron-up');
              otherIcon.classList.add('fa-chevron-down');
            }
          }
        });

        if (!open) {
          item.classList.add('active');
          a.style.height = a.scrollHeight + 'px';
          if (toggleIcon) {
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-up');
          }
        } else {
          item.classList.remove('active');
          a.style.height = '0';
          if (toggleIcon) {
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
          }
        }
      });
    });
  }

  // ---------------- REVEAL ON SCROLL ----------------
  function initScrollReveal() {
    const revealSelectors = [
      '.service-card',
      '.process-step',
      '.portfolio-item',
      '.team-member',
      '.section-header',
      '.hero-content',
      '.hero-visual',
      '.pricing-card',
      '.testimonial-slide'
    ].join(',');
    const els = qsa(revealSelectors);
    if (!els.length) return;

    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target); // reveal once
        }
      });
    }, { threshold: 0.12 });

    els.forEach(el => obs.observe(el));
  }

  // ---------------- LAZY LOADING ----------------
  function initLazyLoading() {
    const lazyImgs = qsa('img[loading="lazy"], img[data-src]');
    if (!lazyImgs.length) return;

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src || img.getAttribute('src');
            if (img.dataset.src) img.src = img.dataset.src;
            img.classList.add('loaded');
            obs.unobserve(img);
          }
        });
      }, { rootMargin: '120px 0px' });

      lazyImgs.forEach(img => io.observe(img));
    } else {
      // fallback: ensure images are loaded
      lazyImgs.forEach(img => {
        if (img.dataset.src) img.src = img.dataset.src;
        img.classList.add('loaded');
      });
    }
  }

  // ---------------- HERO PARALLAX (floating elements) ----------------
  function initHeroParallax() {
    if (!heroVisual) return;
    const floats = qsa('.floating-element', heroVisual);
    if (!floats.length) return;

    heroVisual.addEventListener('mousemove', (ev) => {
      if (window.innerWidth < 900) return;
      const r = heroVisual.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width - 0.5;
      const py = (ev.clientY - r.top) / r.height - 0.5;
      floats.forEach((el, idx) => {
        const factor = (idx + 1) * 8;
        el.style.transform = `translate3d(${px * factor}px, ${py * factor}px, 0)`;
      });
    });
    heroVisual.addEventListener('mouseleave', () => {
      floats.forEach(el => el.style.transform = '');
    });
  }

  // ---------------- CONTACT FORM ----------------
  function initContactForm() {
    if (!contactForm) return;
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.dataset.orig = btn.textContent;
        btn.textContent = 'Sending...';
      }

      // collect data (for later real send)
      const data = new FormData(contactForm);
      const payload = Object.fromEntries(data.entries());

      // simulate server send
      setTimeout(() => {
        showFormMessage('Thank you — we received your message. We will contact you shortly.', 'success');
        contactForm.reset();
        if (btn) {
          btn.disabled = false;
          btn.textContent = btn.dataset.orig || 'Send Message';
        }
      }, 900);
    });

    // floating labels behavior (simple)
    const inputs = qsa('#contactForm input, #contactForm textarea, #contactForm select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => input.classList.toggle('has-value', !!input.value));
      // optional: animate label on focus
      input.addEventListener('focus', () => {
        const label = input.previousElementSibling;
        if (label && label.tagName === 'LABEL') label.classList.add('focused');
      });
      input.addEventListener('blur', () => {
        const label = input.previousElementSibling;
        if (label && label.tagName === 'LABEL') label.classList.remove('focused');
      });
    });
  }

  function showFormMessage(message, type = 'success') {
    const existing = qs('.form-message', contactForm);
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `form-message ${type}`;
    msg.textContent = message;
    // simple inline styling — ideally move to CSS file
    Object.assign(msg.style, {
      padding: '12px 14px',
      borderRadius: '8px',
      marginTop: '14px',
      textAlign: 'center',
      fontWeight: 600,
    });
    if (type === 'success') {
      msg.style.background = 'rgba(34,193,195,0.08)';
      msg.style.color = 'var(--primary, #16a085)';
      msg.style.border = '1px solid rgba(34,193,195,0.14)';
    } else {
      msg.style.background = 'rgba(229,62,62,0.06)';
      msg.style.color = '#e53e3e';
      msg.style.border = '1px solid rgba(229,62,62,0.12)';
    }
    contactForm.appendChild(msg);
    setTimeout(() => { msg.remove(); }, 5000);
  }

  // ---------------- Small CSS fixes injected ----------------
  function addImageFixCSS() {
    const css = `
      /* small runtime fixes added by script.js */
      .dm-toast { transition: opacity .25s ease, transform .25s ease; }
      .form-message { transition: opacity .18s ease; }
      img { max-width: 100%; height: auto; display: block; }
      .nav-links.open { display: block !important; } /* helps some mobile cases */
      .back-to-top { transition: opacity .2s ease, transform .2s ease; }
    `;
    const s = document.createElement('style');
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  // ---------------- Debugging (deferred; remove in production) ----------------
  function debugMediaLoadingDeferred() {
    // run a check a little after load to help debug image/icon problems (non-blocking)
    setTimeout(() => debugMediaLoading(), 1000);
    setTimeout(() => debugMediaLoading(), 3000);
  }
  function debugMediaLoading() {
    try {
      console.group('Daymo Debug: Media');
      const imgs = qsa('img');
      console.log(`Images: ${imgs.length}`);
      imgs.forEach((img, i) => console.log(i + 1, img.src || img.dataset.src || '(no src)', 'complete:', img.complete, 'naturalWidth:', img.naturalWidth));
      const icons = qsa('i[class*="fa"]');
      console.log(`FontAwesome icons: ${icons.length}`);
      icons.slice(0, 10).forEach((ic, i) => console.log(i + 1, ic.className, 'offset:', ic.offsetWidth, ic.offsetHeight));
      console.groupEnd();
    } catch (err) {
      console.warn('Debug error', err);
    }
  }

})();