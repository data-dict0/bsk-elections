/* Scrolly animation for the topper chart.
   The markup is embedded directly in the page so it works when opened from disk.
   Styles: css/topper.css. */
(function () {
  var mount = document.getElementById("g-topper-mount");
  if (!mount) return;

  function init() {
    var scrolly = document.getElementById("g-topper-scrolly");
    if (!scrolly) return;

    var viewport = scrolly.querySelector(".g-topper-viewport");
    var zoom = scrolly.querySelector(".g-topper-zoom");
    var artboards = Array.prototype.slice.call(
      scrolly.querySelectorAll(".g-artboard")
    );
    var steps = Array.prototype.slice.call(
      scrolly.querySelectorAll("#g-topper-steps .g-step")
    );

    // desktop artboard geometry, used when an artboard carries no data-focus-* values
    var DEFAULTS = {
      aspect: 3.622,
      focusX: 0.053857,
      focusY: 0.152933,
      focusSpan: 0.100532
    };
    var FOCUS_TARGET = 0.5; // the first term marker fills this share of the viewport width
    var STAGGER = 0.07; // seconds between marks revealed in the same phase

    // highest mark phase shown / zoom state / annotation state per step
    var STEPS = [
      { phase: 1, zoomed: true, label: false, axis: false },
      { phase: 1, zoomed: true, label: true, axis: false },
      { phase: 1, zoomed: false, label: true, axis: true },
      { phase: 4, zoomed: false, label: true, axis: true },
      { phase: 5, zoomed: false, label: true, axis: true },
      { phase: 6, zoomed: false, label: true, axis: true },
      { phase: 7, zoomed: false, label: true, axis: true }
    ];

    // each artboard keeps its own phase buckets so delays follow its own coordinates
    var layers = artboards.map(function (artboard) {
      var phases = {};
      Array.prototype.slice
        .call(artboard.querySelectorAll("[data-phase]"))
        .forEach(function (el) {
          var p = +el.getAttribute("data-phase");
          (phases[p] = phases[p] || []).push(el);
        });
      return {
        el: artboard,
        phases: phases,
        keys: Object.keys(phases).map(Number),
        geom: {
          aspect: +artboard.getAttribute("data-aspect-ratio") || DEFAULTS.aspect,
          focusX: +artboard.getAttribute("data-focus-x") || DEFAULTS.focusX,
          focusY: +artboard.getAttribute("data-focus-y") || DEFAULTS.focusY,
          focusSpan:
            +artboard.getAttribute("data-focus-span") || DEFAULTS.focusSpan
        }
      };
    });

    var shown = {};
    var current = -1;
    var initialPaint = true;

    function activeLayer() {
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].el.offsetParent !== null) return layers[i];
      }
      return layers[0];
    }

    function layout(zoomed) {
      var layer = activeLayer();
      if (!layer) return;
      var g = layer.geom;
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var cw = layer.el.offsetWidth;
      var ch = cw / g.aspect;
      var cx = layer.el.offsetLeft;
      var s = 1;
      var x = (vw - cw) / 2 - cx;
      var y = (vh - ch) / 2;

      if (zoomed) {
        s = Math.min(8, (FOCUS_TARGET * vw) / (g.focusSpan * cw));
        x = vw / 2 - s * (cx + g.focusX * cw);
        y = vh / 2 - s * (g.focusY * ch);
      }
      zoom.style.transform =
        "translate(" + x + "px," + y + "px) scale(" + s + ")";
    }

    function isDot(mark) {
      return mark.tagName.toLowerCase() === "circle";
    }

    function leftEdge(mark) {
      if (isDot(mark)) {
        return (
          parseFloat(mark.getAttribute("cx")) -
          parseFloat(mark.getAttribute("r"))
        );
      }
      return parseFloat(mark.getAttribute("x"));
    }

    function showPhase(phase) {
      layers.forEach(function (layer) {
        if (!layer.phases[phase]) return;
        var els = layer.phases[phase].slice().sort(function (a, b) {
          return leftEdge(a) - leftEdge(b);
        });
        if (phase === 4) {
          // the dots land first, then the light grey terms crawl out from them
          var dots = els.filter(isDot);
          var bars = els.filter(function (el) {
            return !isDot(el);
          });
          dots.forEach(function (el, i) {
            el.style.transitionDelay = i * 0.05 + "s";
          });
          bars.forEach(function (el, i) {
            el.style.transitionDelay = dots.length * 0.05 + i * 0.08 + "s";
          });
        } else {
          els.forEach(function (el, i) {
            el.style.transitionDelay = i * STAGGER + "s";
          });
        }
        els.forEach(function (el) {
          el.classList.add("is-visible");
        });
      });
    }

    function setPhase(max) {
      layers[0].keys.forEach(function (p) {
        if (p <= max && !shown[p]) {
          shown[p] = true;
          showPhase(p);
        } else if (p > max && shown[p]) {
          shown[p] = false;
          layers.forEach(function (layer) {
            (layer.phases[p] || []).forEach(function (el) {
              el.classList.remove("is-visible");
              el.style.transitionDelay = "0s";
            });
          });
        }
      });
    }

    function activate(index) {
      if (index === current) return;
      current = index;
      var step = STEPS[index];
      scrolly.classList.toggle("is-label-on", step.label);
      scrolly.classList.toggle("is-axis-on", step.axis);

      if (initialPaint) {
        zoom.style.transition = "none";
        layout(step.zoomed);
        setPhase(step.phase);
        initialPaint = false;
        return;
      }

      zoom.style.transition = "transform 1200ms cubic-bezier(0.65, 0.05, 0.36, 1)";
      layout(step.zoomed);
      setPhase(step.phase);
    }

    function triggerLine() {
      // the bottom of the chart box, measured inside the graphic so it survives
      // the sticky release at the end of the scrolly
      return Math.min(
        viewport.offsetTop + viewport.offsetHeight + 24,
        window.innerHeight * 0.85
      );
    }

    // the last step's copy is sticky; this spacer ends its containing block early
    // enough that it lets go on the same frame the graphic does
    function sizeTail() {
      var tail = document.getElementById("g-topper-tail");
      if (!tail || !steps.length) return;
      var copy = steps[steps.length - 1].firstElementChild;
      if (!copy) return;
      var stuckTop = viewport.offsetTop + viewport.offsetHeight + 20;
      tail.style.height =
        Math.max(0, window.innerHeight - stuckTop - copy.offsetHeight) + "px";
    }

    function update() {
      var trigger = triggerLine();
      var active = 0;
      steps.forEach(function (step, i) {
        var copy = step.firstElementChild || step;
        if (copy.getBoundingClientRect().top <= trigger) active = i;
      });
      activate(active);
    }

    var ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          update();
        });
      },
      { passive: true }
    );

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeTail();
        layout(STEPS[Math.max(current, 0)].zoomed);
      }, 120);
    });

    sizeTail();
    update();
  }

  init();
})();
