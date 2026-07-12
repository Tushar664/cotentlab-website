/* ============================================================
   CoTent Lab — "From Chaos to System"
   Three.js particle morph (chaos cloud → funnel vortex)
   driven by GSAP ScrollTrigger
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);
let uniforms; // assigned when WebGL initialises; scroll handlers guard on it

const isMobile = window.matchMedia('(max-width: 768px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   1. THREE.JS SCENE
------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const uniformsRef = { uTime:{value:0}, uProgress:{value:0}, uChaosAmp:{value:1}, uPixel:{value:1}, uOpacity:{value:1}, uRadius:{value:3.2} };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.style.display = 'none'; // no WebGL — site still works, just without particles
}
if (renderer) {
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

const COUNT = isMobile ? 3600 : 18000;

/* --- geometry attributes --- */
const geo = new THREE.BufferGeometry();
const positions = new Float32Array(COUNT * 3);   // required by three, dummy
const aChaos    = new Float32Array(COUNT * 3);   // chaotic home position
const aRand     = new Float32Array(COUNT * 3);   // per-particle randoms (flowT, angleOffset, stagger)
const aSize     = new Float32Array(COUNT);

const LINES = isMobile ? 130 : 220;                  // meridian dot-lines
const perLine = Math.ceil(COUNT / LINES);
for (let i = 0; i < COUNT; i++) {
  // sphere shell: vertical dotted meridians (positions computed in shader)
  const line = i % LINES, idx = (i / LINES) | 0;
  const theta = (line / LINES) * Math.PI * 2 + (Math.random() - 0.5) * 0.006;
  const phi = (idx / (perLine - 1)) * Math.PI;
  const phiJ = phi + (Math.random() - 0.5) * 0.008;

  aChaos.set([theta, phiJ, 0], i * 3);                // store spherical coords
  positions.set([0, 0, 0], i * 3);
  aRand.set([Math.random(), Math.random(), Math.random()], i * 3);
  aSize[i] = Math.random() < 0.94 ? 0.5 + Math.random() * 0.45 : 1.3 + Math.random() * 0.8;
}

geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('aChaos', new THREE.BufferAttribute(aChaos, 3));
geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 3));
geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));

/* --- shader: mixes chaos position with an animated funnel vortex --- */
uniforms = uniformsRef;
uniforms.uPixel.value = renderer.getPixelRatio();
function fitSphere() {
  const halfH = Math.tan((55 * Math.PI) / 360) * 7;      // camera fov/dist
  const aspect = window.innerWidth / window.innerHeight;
  // fill ~94% of viewport width; cap vertical crop at 1.9x height
  uniformsRef.uRadius.value = halfH * Math.min(aspect * 0.94, 1.9);
}
fitSphere();

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute vec3 aChaos;
    attribute vec3 aRand;
    attribute float aSize;
    uniform float uTime;
    uniform float uProgress;
    uniform float uChaosAmp;
    uniform float uPixel;
    uniform float uRadius;
    varying float vP;      // per-particle organization progress
    varying float vFlow;   // position along funnel (0 top → 1 bottom)
    varying float vRim;    // silhouette glow (sphere rim lighting)
    varying float vWarm;   // blue↔warm colour mix across the sphere

    void main() {
      /* ---- particle sphere with organic wobble (idle state) ---- */
      float theta = aChaos.x;
      float phi   = aChaos.y;
      float t = uTime * 0.55;
      float wob =
        sin(phi * 3.0 + theta * 2.0 + t * 1.5) * 0.035 +
        sin(phi * 5.0 - t * 1.0 + aRand.x * 3.0) * 0.025 +
        sin(theta * 4.0 + phi * 1.5 + t * 0.8) * 0.030;
      /* uChaosAmp deepens the deformation during the narrative */
      float R = uRadius * (1.0 + wob * (0.55 + 1.1 * uChaosAmp));
      vec3 chaosPos = vec3(
        R * sin(phi) * cos(theta),
        R * cos(phi),
        R * sin(phi) * sin(theta)
      );
      /* rim: silhouette (z≈0) bright, front/back faces dark — text sits in the dark centre */
      vRim  = pow(1.0 - clamp(abs(chaosPos.z) / R, 0.0, 1.0), 1.7);
      vWarm = clamp((chaosPos.x / R) * 0.62 + (chaosPos.y / R) * 0.45 + 0.5, 0.0, 1.0);

      /* ---- funnel vortex ---- */
      float flow = fract(aRand.x + uTime * 0.045);          // travels top→bottom forever
      float angle = aRand.y * 6.2831 + uTime * 0.55 + flow * 11.0;
      /* thin-walled cone: radius sits on a crisp surface with slight thickness */
      float wall = (aRand.z - 0.5) * 0.16;                  // ±0.08 wall thickness
      float radius = mix(2.8, 0.16, pow(flow, 0.72)) + wall;
      float fy = mix(2.4, -2.1, flow);
      vec3 funnelPos = vec3(cos(angle) * radius, fy, sin(angle) * radius * 0.92);

      /* revenue stream: after the spout, particles fall in a tight beam */
      if (flow > 0.86) {
        float drop = (flow - 0.86) / 0.14;
        funnelPos.x = cos(angle) * 0.12;
        funnelPos.z = sin(angle) * 0.12;
        funnelPos.y = -2.1 - drop * 1.4;
      }

      /* ---- staggered morph ---- */
      float p = clamp((uProgress - aRand.z * 0.45) / 0.55, 0.0, 1.0);
      p = p * p * (3.0 - 2.0 * p); // smoothstep
      vec3 pos = mix(chaosPos, funnelPos, p);

      vP = p;
      vFlow = flow;

      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixel * (26.0 / -mv.z) * (1.05 + 0.3 * p);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying float vP;
    varying float vFlow;
    varying float vRim;
    varying float vWarm;

    void main() {
      /* crisp bright core + soft outer halo — sharp, not blurry */
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float core = smoothstep(0.16, 0.05, d);          // hard bright center
      float halo = smoothstep(0.5, 0.14, d) * 0.35;    // faint glow around it
      float alpha = core + halo;

      /* sphere = blue (left/bottom) → warm red-orange (right/top), lit at the rim */
      vec3 coolCol = vec3(0.22, 0.48, 1.0);
      vec3 warmCol = vec3(1.0, 0.38, 0.26);
      vec3 chaosCol = mix(coolCol, warmCol, vWarm) * (0.18 + 0.95 * vRim);
      vec3 systemCol = mix(vec3(0.30, 0.52, 1.0), vec3(0.56, 0.74, 1.0), vFlow);
      /* revenue beam glows mint-white at the very end */
      if (vFlow > 0.86) systemCol = mix(systemCol, vec3(0.55, 1.0, 0.75), (vFlow - 0.86) / 0.14);

      vec3 col = mix(chaosCol, systemCol, vP);
      /* white-hot core reads as sharp point */
      col = mix(col, vec3(1.0), core * mix(0.22 * vRim + 0.03, 0.6, vP));

      gl_FragColor = vec4(col, alpha * uOpacity * mix(0.10 + 0.85 * vRim, 1.0, vP));
    }
  `,
});

scene.add(new THREE.Points(geo, material));

/* --- subtle mouse parallax --- */
let mx = 0, my = 0;
if (!isMobile && !reducedMotion) {
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 0.6;
    my = (e.clientY / window.innerHeight - 0.5) * 0.4;
  });
}

const clock = new THREE.Clock();
function tick() {
  uniforms.uTime.value = clock.getElapsedTime();
  camera.position.x += (mx - camera.position.x) * 0.04;
  camera.position.y += (-my - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitSphere();
});
} // end if(renderer)

/* ------------------------------------------------------------
   2. SCROLL CHOREOGRAPHY
------------------------------------------------------------ */

/* Chaos narrative: pinned lines + intensifying swirl */
const chaosLines = gsap.utils.toArray('.chaos__line');
const chaosTL = gsap.timeline({
  scrollTrigger: {
    trigger: '.chaos',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => {
      document.getElementById('chaosbar').style.width = (self.progress * 100) + '%';
      uniformsRef.uChaosAmp.value = 1 + self.progress * 1.6; // chaos gets worse…
    },
  },
});
chaosLines.forEach((line, i) => {
  chaosTL.to(line, { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power2.out' });
  if (i < chaosLines.length - 1) {
    chaosTL.to(line, { opacity: 0, y: -40, scale: 0.97, duration: 1, ease: 'power2.in' }, '+=0.6');
  }
});

/* The Shift: chaos → funnel morph, scrubbed */
const shiftEl = document.querySelector('.shift');
gsap.timeline({
  scrollTrigger: {
    trigger: '.shift',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
    onToggle: (self) => shiftEl.classList.toggle('is-live', self.isActive),
    onUpdate: (self) => {
      uniformsRef.uProgress.value = self.progress;
      uniformsRef.uChaosAmp.value = Math.max(1, 2.6 - self.progress * 2.6);
      // chips fly from their float spots to the landing row; word slots fill in sync
      placeChips(self.progress);
      const slots = shiftEl.querySelectorAll('.slot');
      const at = [0.2, 0.34, 0.48, 0.62];
      slots.forEach((s, i) => s.classList.toggle('filled', self.progress > at[i]));
      // funnel flow labels
      document.querySelectorAll('.shift__label').forEach((el) => {
        const at = parseFloat(el.dataset.at);
        gsap.to(el, { opacity: self.progress > at ? 1 : 0, duration: 0.4, overwrite: 'auto' });
      });
    },
  },
});

/* --- chip placement: idle float positions -> landing row on scroll --- */
const chips = gsap.utils.toArray('.ichip');
const lspots = gsap.utils.toArray('.lspot');
const scatter = [
  [-0.36, -0.24], [0.36, -0.28], [-0.40, 0.10], [0.40, 0.06],
]; // fractions of viewport (from centre)
const smooth = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

function placeChips(progress) {
  const W = window.innerWidth, H = window.innerHeight;
  chips.forEach((chip, i) => {
    const spot = lspots[i];
    const r = spot.getBoundingClientRect();
    const sx = W / 2 + scatter[i][0] * W;
    const sy = H / 2 + scatter[i][1] * H;
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;
    const p = smooth((progress - (0.14 + i * 0.14)) / 0.26);
    const x = sx + (tx - sx) * p;
    // gentle arc on the way down
    const y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * H * 0.06;
    chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    chip.classList.toggle('landed', p >= 1);
    spot.classList.toggle('taken', p >= 1);
  });
}
placeChips(0);
window.addEventListener('resize', () => placeChips(uniformsRef.uProgress.value));

/* keep last chaos line + shift heading fading nicely */
gsap.from('.shift__title, .shift__sub', {
  scrollTrigger: { trigger: '.shift', start: 'top 60%' },
  opacity: 0, y: 40, duration: 1, stagger: 0.15, ease: 'power3.out',
});

/* dim particles behind dense content, brighten at final CTA */
ScrollTrigger.create({
  trigger: '.pillars',
  start: 'top 85%',
  end: 'top 25%',
  scrub: true,
  onUpdate: (s) => { uniformsRef.uOpacity.value = 1 - s.progress * 0.93; },
});
ScrollTrigger.create({
  trigger: '.cta',
  start: 'top 95%',
  end: 'top 35%',
  scrub: true,
  onUpdate: (s) => { uniformsRef.uOpacity.value = 0.07 + s.progress * 0.38; },
});

/* Funnel blueprint: stages assemble one by one */
{
  const items = gsap.utils.toArray('.fmap__stage, .fmap__link, .fmap__beam');
  ScrollTrigger.create({
    trigger: '.fmap__funnel',
    start: 'top 78%',
    once: true,
    onEnter: () => {
      items.forEach((el, i) => setTimeout(() => el.classList.add('is-on'), i * 260));
    },
  });
}

/* generic reveals */
gsap.utils.toArray('.reveal').forEach((el) => {
  gsap.to(el, {
    scrollTrigger: { trigger: el, start: 'top 88%' },
    opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
  });
});

/* ------------------------------------------------------------
   3. COUNTERS
------------------------------------------------------------ */
gsap.utils.toArray('[data-count]').forEach((el) => {
  const target = parseFloat(el.dataset.count);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const obj = { v: 0 };
  ScrollTrigger.create({
    trigger: el,
    start: 'top 90%',
    once: true,
    onEnter: () =>
      gsap.to(obj, {
        v: target, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { el.textContent = prefix + Math.round(obj.v) + suffix; },
      }),
  });
});

/* ------------------------------------------------------------
   4. HERO TEXT SCRAMBLE (on load)
------------------------------------------------------------ */
if (!reducedMotion) {
  const glyphs = '!<>-_\\/[]{}—=+*^?#@%&';
  document.querySelectorAll('.scramble').forEach((el, idx) => {
    const word = el.dataset.word;
    let frame = 0;
    const total = 26;
    setTimeout(() => {
      const iv = setInterval(() => {
        frame++;
        const settled = Math.floor((frame / total) * word.length);
        let out = '';
        for (let i = 0; i < word.length; i++) {
          out += i < settled ? word[i] : glyphs[(Math.random() * glyphs.length) | 0];
        }
        el.textContent = out;
        if (frame >= total) { el.textContent = word; clearInterval(iv); }
      }, 34);
    }, 500 + idx * 420);
  });
}

/* hero intro */
gsap.to('.hero .reveal', {
  opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.15,
});

/* ------------------------------------------------------------
   5. NAV
------------------------------------------------------------ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
});
const burger = document.getElementById('burger');
const mobilemenu = document.getElementById('mobilemenu');
burger.addEventListener('click', () => mobilemenu.classList.toggle('open'));
mobilemenu.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => mobilemenu.classList.remove('open'))
);
