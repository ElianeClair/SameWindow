(() => {
  const cursor = document.querySelector("#agent-cursor");
  const clickRing = document.querySelector("#agent-click-ring");
  const boundsMargin = 18;
  const sampleCount = 36;
  const candidateCurves = [0.07, 0.12, 0.18, 0.25, 0.33];
  const approachBlends = [0.32, 0.58];

  let lastSequence = null;
  let activeMotion = 0;
  let currentPoint = viewportPoint(0.5, 0.48);

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function viewportPoint(x, y) {
    return {
      x: clamp(Number(x) || 0, 0, 1) * window.innerWidth,
      y: clamp(Number(y) || 0, 0, 1) * window.innerHeight,
    };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function normalize(vector) {
    const length = Math.hypot(vector.x, vector.y) || 1;
    return { x: vector.x / length, y: vector.y / length };
  }

  function mix(a, b, amount) {
    return a + (b - a) * amount;
  }

  function cubicPoint(path, t) {
    const inverse = 1 - t;
    const a = inverse ** 3;
    const b = 3 * inverse * inverse * t;
    const c = 3 * inverse * t * t;
    const d = t ** 3;
    return {
      x: path.start.x * a + path.control1.x * b + path.control2.x * c + path.end.x * d,
      y: path.start.y * a + path.control1.y * b + path.control2.y * c + path.end.y * d,
    };
  }

  function cubicTangent(path, t) {
    const inverse = 1 - t;
    return {
      x:
        3 * inverse * inverse * (path.control1.x - path.start.x) +
        6 * inverse * t * (path.control2.x - path.control1.x) +
        3 * t * t * (path.end.x - path.control2.x),
      y:
        3 * inverse * inverse * (path.control1.y - path.start.y) +
        6 * inverse * t * (path.control2.y - path.control1.y) +
        3 * t * t * (path.end.y - path.control2.y),
    };
  }

  function candidatePath(start, end, curveRatio, side, approachBlend) {
    const direct = normalize({ x: end.x - start.x, y: end.y - start.y });
    const normal = { x: -direct.y * side, y: direct.x * side };
    const length = distance(start, end);
    const curvature = Math.min(220, length * curveRatio);
    const startHandle = clamp(length * 0.42, 44, 290);
    const endHandle = clamp(length * 0.18, 34, 145);
    const preferredApproach = normalize({ x: 0.72, y: 0.7 });
    const approach = normalize({
      x: mix(direct.x, preferredApproach.x, approachBlend),
      y: mix(direct.y, preferredApproach.y, approachBlend),
    });

    return {
      start,
      end,
      control1: {
        x: start.x + direct.x * startHandle + normal.x * curvature,
        y: start.y + direct.y * startHandle + normal.y * curvature,
      },
      control2: {
        x: end.x - approach.x * endHandle + normal.x * curvature * 0.18,
        y: end.y - approach.y * endHandle + normal.y * curvature * 0.18,
      },
    };
  }

  function scorePath(path) {
    let previous = path.start;
    let previousAngle = null;
    let length = 0;
    let turningEnergy = 0;
    let totalTurn = 0;
    let outOfBounds = 0;

    for (let index = 1; index <= sampleCount; index += 1) {
      const point = cubicPoint(path, index / sampleCount);
      const delta = { x: point.x - previous.x, y: point.y - previous.y };
      const angle = Math.atan2(delta.y, delta.x);
      length += Math.hypot(delta.x, delta.y);

      if (previousAngle !== null) {
        let turn = angle - previousAngle;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        turningEnergy += turn * turn;
        totalTurn += Math.abs(turn);
      }

      if (
        point.x < boundsMargin ||
        point.x > window.innerWidth - boundsMargin ||
        point.y < boundsMargin ||
        point.y > window.innerHeight - boundsMargin
      ) {
        outOfBounds += 1;
      }

      previous = point;
      previousAngle = angle;
    }

    return length + turningEnergy * 150 + totalTurn * 20 + outOfBounds * 10000;
  }

  function choosePath(start, end) {
    if (distance(start, end) < 72) {
      return candidatePath(start, end, 0.04, 1, 0.12);
    }

    const candidates = [];
    for (const side of [-1, 1]) {
      for (const curveRatio of candidateCurves) {
        for (const approachBlend of approachBlends) {
          candidates.push(candidatePath(start, end, curveRatio, side, approachBlend));
        }
      }
    }

    return candidates.reduce((best, candidate) =>
      scorePath(candidate) < scorePath(best) ? candidate : best,
    );
  }

  function springProgress(t) {
    const response = 8.25;
    const value = 1 - Math.exp(-response * t) * (1 + response * t);
    const finalValue = 1 - Math.exp(-response) * (1 + response);
    return clamp(value / finalValue, 0, 1);
  }

  function render(point, tangent, travel) {
    const angle = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
    const tilt = clamp(angle * 0.09, -11, 11);
    const stretch = 1 + Math.sin(Math.PI * travel) * 0.09;
    cursor.style.transform = [
      `translate3d(${(point.x - 3).toFixed(2)}px, ${(point.y - 3).toFixed(2)}px, 0)`,
      `rotate(${tilt.toFixed(2)}deg)`,
      `scale(1, ${stretch.toFixed(3)})`,
    ].join(" ");
  }

  function pulseClick(point) {
    clickRing.getAnimations().forEach((animation) => animation.cancel());
    clickRing.style.transform = `translate3d(${point.x - 11}px, ${point.y - 11}px, 0)`;
    clickRing.animate(
      [
        { opacity: 0.85, transform: `${clickRing.style.transform} scale(0.35)` },
        { opacity: 0, transform: `${clickRing.style.transform} scale(1.55)` },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.75,.2,1)" },
    );
  }

  function pulseArrival() {
    cursor.animate(
      [
        { filter: "drop-shadow(0 0 3px rgb(51 156 255 / 95%)) drop-shadow(0 0 9px rgb(51 156 255 / 58%))" },
        { filter: "drop-shadow(0 0 5px rgb(51 156 255 / 100%)) drop-shadow(0 0 15px rgb(51 156 255 / 85%))" },
        { filter: "drop-shadow(0 0 3px rgb(51 156 255 / 95%)) drop-shadow(0 0 9px rgb(51 156 255 / 58%))" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  }

  function moveTo(command) {
    const target = viewportPoint(command.x, command.y);
    if (distance(currentPoint, target) < 2) {
      currentPoint = target;
      render(target, { x: 1, y: 1 }, 1);
      if (command.click === true) pulseClick(target);
      return;
    }
    const path = choosePath(currentPoint, target);
    const travelDistance = distance(currentPoint, target);
    const duration = clamp(Number(command.durationMs) || 110 + travelDistance * 0.28, 140, 460);
    const motion = ++activeMotion;
    const startedAt = performance.now();

    function frame(now) {
      if (motion !== activeMotion) return;
      const time = clamp((now - startedAt) / duration, 0, 1);
      const progress = command.animate === false ? 1 : springProgress(time);
      const point = cubicPoint(path, progress);
      const tangent = cubicTangent(path, progress);
      currentPoint = point;
      render(point, tangent, progress);

      if (time < 1 && progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      currentPoint = target;
      render(target, cubicTangent(path, 1), 1);
      pulseArrival();
      if (command.click === true) pulseClick(target);
    }

    requestAnimationFrame(frame);
  }

  function applyCommand(command) {
    cursor.hidden = command.visible === false;
    if (cursor.hidden) return;
    if (Number.isFinite(Number(command.x)) && Number.isFinite(Number(command.y))) {
      moveTo(command);
    }
  }

  async function poll() {
    try {
      const response = await fetch(`/cursor-state.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      const command = await response.json();
      if (command.sequence !== lastSequence) {
        lastSequence = command.sequence;
        applyCommand(command);
      }
    } catch (_) {
      // Keep the shared desktop usable while cursor state is unavailable.
    } finally {
      window.setTimeout(poll, 33);
    }
  }

  render(currentPoint, { x: 1, y: 1 }, 1);
  poll();
})();
