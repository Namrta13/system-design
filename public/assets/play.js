// Small helpers shared by every lesson's interactive playground.

// Centre of a node, as a position inside its stage.
function centre(el) {
  const s = el.parentElement.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}

// Moves a dot from one node to another. Resolves when it arrives.
function sendDot(from, to, { ms = 700, color } = {}) {
  const stage = from.parentElement;
  const a = centre(from), b = centre(to);
  const dot = document.createElement("div");
  dot.className = "dot";
  if (color) dot.style.background = color;
  stage.appendChild(dot);
  const anim = dot.animate(
    [{ left: a.x + "px", top: a.y + "px" }, { left: b.x + "px", top: b.y + "px" }],
    { duration: ms, easing: "ease-in-out", fill: "forwards" }
  );
  return anim.finished.then(() => dot.remove());
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function flash(el, cls = "lit", ms = 500) {
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
