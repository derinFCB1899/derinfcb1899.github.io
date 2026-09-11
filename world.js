import * as THREE from './vendor/three/three.module.js';
import { clamp, wrap, damp, renderScale, portalDepth, seededRandom } from './world-math.js';

// The canvas is decorative. Every project and control remains ordinary HTML.
const canvas = document.getElementById('world-canvas');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const hint = document.querySelector('.world-hint');
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  root.dataset.world = 'fallback';
}

if (renderer) startWorld(renderer);

function startWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2('#03060d', .012);
  const camera = new THREE.PerspectiveCamera(54, 1, .1, 310);
  camera.position.set(0, 1, 24);
  camera.lookAt(0, -.6, -70);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const pointer = new THREE.Vector2();
  const lookAt = new THREE.Vector3();
  const cyan = new THREE.Color('#29cfff');
  const pink = new THREE.Color('#df43ff');
  const nextAccent = cyan.clone();
  const accent = cyan.clone();
  const page = root.dataset.page || 'about';
  const plane = new THREE.PlaneGeometry(1, 1);
  const portals = [];
  let contextLost = false;
  let failed = false;
  let disposed = false;
  let pageCached = false;
  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let compact = false;
  let lastTime = 0;
  let lastPaint = 0;
  let elapsed = 0;
  let travel = 0;
  let scrollTarget = window.scrollY;
  let scrollPosition = scrollTarget;
  let chapter = 0;
  let chapterTarget = 0;

  const vertexShader = `
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      vUv = uv;
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      vDepth = -viewPosition.z;
      gl_Position = projectionMatrix * viewPosition;
    }
  `;
  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      float x = abs(vUv.x - 0.5) * 2.0;
      float core = exp(-x * x * 700.0);
      float halo = pow(max(0.0, 1.0 - x), 3.0);
      float endFade = smoothstep(0.0, 0.015, vUv.y) * smoothstep(0.0, 0.015, 1.0 - vUv.y);
      float depthFade = exp(-max(vDepth, 0.0) * 0.009);
      float alpha = (core * 0.95 + halo * 0.28) * uOpacity * depthFade * endFade;
      if (alpha < 0.006) discard;
      vec3 light = mix(uColor, vec3(0.83, 0.97, 1.0), core * 0.55);
      gl_FragColor = vec4(light, min(alpha, 1.0));
      #include <colorspace_fragment>
    }
  `;

  for (let i = 0; i < (page === 'work' ? 10 : 0); i++) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: (i % 3 === 2 ? pink : cyan).clone() }, uOpacity: { value: 1 } },
      vertexShader, fragmentShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false
    });
    const group = new THREE.Group();
    // Feathered light strips form a spatial frame, not an image plane.
    [[-8, 0, .48, 10, 0], [8, 0, .48, 10, 0], [0, 5, .48, 16.2, Math.PI / 2], [0, -5, .48, 16.2, Math.PI / 2]].forEach(([x, y, w, h, rotation]) => {
      const beam = new THREE.Mesh(plane, material);
      beam.position.set(x, y, 0);
      beam.scale.set(w, h, 1);
      beam.rotation.z = rotation;
      group.add(beam);
    });
    group.position.z = portalDepth(i, 0);
    scene.add(group);
    portals.push({ group, material });
  }

  const floor = new THREE.GridHelper(300, 90, '#339bc9', '#135271');
  floor.position.set(0, -5.05, -115);
  floor.material.transparent = true;
  floor.material.opacity = .43;
  floor.material.depthWrite = false;
  scene.add(floor);
  const ceiling = new THREE.GridHelper(300, 60, '#453870', '#25284c');
  ceiling.position.set(0, 5.1, -115);
  ceiling.material.transparent = true;
  ceiling.material.opacity = .13;
  ceiling.material.depthWrite = false;
  scene.add(ceiling);

  const random = seededRandom(1899);
  const starPositions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    starPositions[i * 3] = (random() - .5) * 140;
    starPositions[i * 3 + 1] = (random() - .35) * 50;
    starPositions[i * 3 + 2] = -random() * 220;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#90cfff', size: .14, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);

  // Each document has a distinct silhouette, all sharing the same small renderer.
  const sculpture = new THREE.Group();
  sculpture.position.set(5, -5, -18);
  sculpture.scale.setScalar(.72);
  scene.add(sculpture);
  const orbitRings = [];
  const pulseRings = [];
  let core;
  let orbitNodes;
  const lightMaterial = (color, opacity = .85) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  });
  function ring(radius, color, arc = Math.PI * 2) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.TorusGeometry(radius, .022, 4, 128, arc), lightMaterial(color)));
    group.add(new THREE.Mesh(new THREE.TorusGeometry(radius, .10, 4, 128, arc), lightMaterial(color, .09)));
    return group;
  }
  if (page === 'about') {
    const geometry = new THREE.IcosahedronGeometry(4.65, 1);
    core = new THREE.Group();
    const edges = new THREE.EdgesGeometry(geometry);
    core.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#67edff', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })));
    core.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#7569ff', wireframe: true, transparent: true, opacity: .17, blending: THREE.AdditiveBlending, depthWrite: false })));
    sculpture.add(core);
    for (let i = 0; i < 3; i++) {
      const orbit = ring(5.7 + i * .8, i === 1 ? '#dc78ff' : '#62eaff', Math.PI * 1.72);
      orbit.rotation.set(.65 + i * .7, i * .8, i * 1.4);
      sculpture.add(orbit);
      orbitRings.push(orbit);
    }
    const nodes = new Float32Array(24 * 3);
    const nodesGeometry = new THREE.BufferGeometry();
    nodesGeometry.setAttribute('position', new THREE.BufferAttribute(nodes, 3));
    orbitNodes = new THREE.Points(nodesGeometry, new THREE.PointsMaterial({ color: '#c3faff', size: .17, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
    orbitNodes.frustumCulled = false;
    sculpture.add(orbitNodes);
  } else if (page === 'contact') {
    for (let i = 0; i < 3; i++) {
      const orbit = ring(3.9 + i * .9, i === 1 ? '#67edff' : '#f197ed', Math.PI * 1.85);
      orbit.rotation.set(.25 + i * .42, .45 + i * .55, i * 1.4);
      sculpture.add(orbit);
      orbitRings.push(orbit);
    }
    core = new THREE.Points(new THREE.IcosahedronGeometry(2.5, 2), new THREE.PointsMaterial({ color: '#e8c6ff', size: .065, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
    sculpture.add(core);
    for (let i = 0; i < 3; i++) {
      const pulse = new THREE.Mesh(new THREE.TorusGeometry(5.5, .018, 4, 128), lightMaterial('#ee82ee', .4));
      pulse.rotation.x = -.15;
      sculpture.add(pulse);
      pulseRings.push(pulse);
    }
  }

  const packetCount = 26;
  const packetPositions = new Float32Array(packetCount * 6);
  const packetGeometry = new THREE.BufferGeometry();
  packetGeometry.setAttribute('position', new THREE.BufferAttribute(packetPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const packets = new THREE.LineSegments(packetGeometry, new THREE.LineBasicMaterial({ color: '#9fefff', transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false }));
  packets.frustumCulled = false;
  scene.add(packets);

  const rails = new THREE.Group();
  const railGeometry = new THREE.BoxGeometry(.025, .025, 220);
  const railMaterial = lightMaterial('#52dfff', .6);
  for (const x of [-8,-4,4,8]) {
    const rail = new THREE.Mesh(railGeometry,railMaterial);
    rail.position.set(x,-5,-105);
    rails.add(rail);
  }
  scene.add(rails);

  function setTheme() {
    const light = root.dataset.theme === 'light';
    scene.fog.color.set(light ? '#dfeaff' : '#160e2e');
    scene.fog.density = light ? .008 : .012;
    cyan.set(light ? '#007d9f' : '#40dfff');
    pink.set(light ? '#a33e9e' : '#f15be0');
    floor.material.opacity = light ? .7 : .5;
    ceiling.visible = page === 'work' && !light;
    scene.traverse(object => {
      const material = object.material;
      if (!material) return;
      if (material.userData.nightBlending === undefined) {
        material.userData.nightBlending = material.blending;
        if (material.color) material.userData.nightColor = material.color.clone();
      }
      material.blending = light ? THREE.NormalBlending : material.userData.nightBlending;
      if (material.color) material.color.copy(material.userData.nightColor).multiplyScalar(light ? .36 : 1);
      material.needsUpdate = true;
    });
    stars.material.color.set(light ? '#517ab6' : '#bddaff');
    stars.material.opacity = light ? .4 : .75;
    packets.material.color.copy(cyan);
    railMaterial.color.copy(cyan);
    setChapter();
    accent.copy(nextAccent);
    if (!shouldRun() && !document.hidden) renderStill();
  }

  function motionAllowed() {
    return !reduced.matches && root.dataset.motion === 'active';
  }
  function shouldRun() {
    return motionAllowed() && !document.hidden && !contextLost && !failed && !disposed && !pageCached;
  }
  function setChapter() {
    const current = root.dataset.page || root.dataset.chapter || 'about';
    chapterTarget = ({ home: 0, work: 1, about: 2, contact: 3 })[current] ?? 0;
    const light = root.dataset.theme === 'light';
    nextAccent.set(chapterTarget >= 2 ? (light ? '#8053b5' : '#b791ff') : (light ? '#087eab' : '#40dfff'));
    if (chapterTarget === 3) nextAccent.set(light ? '#a94591' : '#ee87dc');
  }
  function size() {
    if (disposed || failed || contextLost) return;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const ratio = renderScale(w, h, window.devicePixelRatio, w < 800);
    if (w === width && h === height && ratio === pixelRatio) return;
    width = w;
    height = h;
    compact = width < 800;
    pixelRatio = ratio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, -width * (compact ? .12 : .2), 0, width, height);
    camera.updateProjectionMatrix();
    starGeometry.setDrawRange(0, compact ? 100 : 240);
    packetGeometry.setDrawRange(0, compact ? 28 : 52);
    if (!shouldRun()) renderStill();
  }
  function updateScene(dt) {
    elapsed += dt;
    scrollPosition = damp(scrollPosition, scrollTarget, 3.8, dt);
    chapter = damp(chapter, chapterTarget, 1.7, dt);
    travel += dt * (page === 'work' ? 3.5 + 18 * Math.exp(-elapsed * 1.25) : .95);
    const distance = travel + scrollPosition * .018;
    const targetX = pointer.x * (compact ? .3 : 1.5) + Math.sin(elapsed * .13) * .24;
    const targetY = .75 + pointer.y * .65 + Math.sin(elapsed * .19) * .12;
    camera.position.x = damp(camera.position.x, targetX, 3, dt);
    camera.position.y = damp(camera.position.y, targetY, 3, dt);
    camera.position.z = 24 + (motionAllowed() ? 7 * Math.exp(-elapsed * 1.45) : 0);
    lookAt.set(pointer.x * .45, -.7 + pointer.y * .3, -70);
    camera.lookAt(lookAt);
    camera.rotation.z = pointer.x * -.016;
    accent.lerp(nextAccent, 1 - Math.exp(-dt * 1.5));

    portals.forEach(({ group, material }, index) => {
      group.position.z = portalDepth(index, distance);
      group.rotation.z = Math.sin(elapsed * .25 + index * .28) * .15 + chapter * .012;
      group.scale.setScalar(1 + Math.sin(elapsed * .3 + index * .8) * .035);
      material.uniforms.uOpacity.value = clamp((24 - group.position.z) / 10, 0, 1) * (1 - chapter * .09);
      material.uniforms.uColor.value.copy(index % 3 === 2 ? pink : accent);
    });
    floor.position.z = -115 + wrap(distance, 300 / 90);
    ceiling.position.z = -115 + wrap(distance, 5);
    stars.rotation.z = Math.sin(elapsed * .045) * .02;
    stars.position.z = wrap(elapsed * .25, 10);
    sculpture.rotation.set(pointer.y * -.07, pointer.x * .10 + Math.sin(elapsed * .17) * .07, 0);
    sculpture.position.y = -5 + Math.sin(elapsed * .55) * .25;
    if (core) core.rotation.set(.3 + elapsed * .055, .35 + elapsed * .10 + scrollPosition * .0003, .1);
    orbitRings.forEach((orbit, i) => {
      orbit.rotation.z = i * 1.4 + elapsed * (i % 2 ? -.16 : .13);
      orbit.rotation.y = .45 + i * .55 + Math.sin(elapsed * .25 + i) * .28;
    });
    if (orbitNodes) {
      const positions = orbitNodes.geometry.attributes.position;
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI * 2 / 24 + elapsed * .18;
        const radius = 5.7 + (i % 3) * .8;
        positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius * .65, Math.sin(angle * 2 + i) * 3);
      }
      positions.needsUpdate = true;
    }
    pulseRings.forEach((pulse, i) => {
      const phase = wrap(elapsed * .19 + i / 3, 1);
      pulse.scale.setScalar(1 + phase * .9);
      pulse.position.z = -phase * 4;
      pulse.material.opacity = Math.sin(phase * Math.PI) * .35;
    });
    for (let i = 0; i < packetCount; i++) {
      const offset = i * 6;
      const lane = [-12, -8, -4, 4, 8, 12][i % 6];
      const z = 28 - wrap(i * 13.7 - elapsed * (page === 'work' ? 22 : 8) - scrollPosition * .025, 220);
      packetPositions[offset] = packetPositions[offset + 3] = lane;
      packetPositions[offset + 1] = packetPositions[offset + 4] = i % 4 === 0 ? 5 : -4.95;
      packetPositions[offset + 2] = z;
      packetPositions[offset + 5] = z - (page === 'work' ? 5 : 1.8);
    }
    packetGeometry.attributes.position.needsUpdate = true;
  }
  function draw() {
    if (failed || disposed || contextLost) return;
    try { renderer.render(scene, camera); } catch { fail(); }
  }
  function renderStill() {
    updateScene(0);
    draw();
  }
  function frame(now) {
    if (!shouldRun()) return;
    const interval = compact ? 1000 / 30 : 1000 / 60;
    const sincePaint = now - lastPaint;
    if (sincePaint + .001 < interval) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
    lastTime = now;
    lastPaint = now - (sincePaint % interval);
    updateScene(dt);
    draw();
  }
  function sync() {
    if (disposed || failed) return;
    const active = shouldRun();
    lastTime = lastPaint = 0;
    renderer.setAnimationLoop(active ? frame : null);
    hint.hidden = !(active && finePointer.matches);
    if (!active && !document.hidden && !contextLost) renderStill();
  }
  function fail() {
    if (failed) return;
    failed = true;
    root.dataset.world = 'fallback';
    hint.hidden = true;
    renderer.setAnimationLoop(null);
  }
  renderer.debug.onShaderError = fail;
  function onPointer(event) {
    if (!motionAllowed() || !finePointer.matches || event.pointerType === 'touch') return;
    pointer.set(clamp(event.clientX / innerWidth * 2 - 1, -1, 1), clamp(1 - event.clientY / innerHeight * 2, -1, 1));
  }
  function resetPointer() { pointer.set(0, 0); }
  function onScroll() { if (motionAllowed()) scrollTarget = window.scrollY; }
  function onMotion() {
    if (!motionAllowed()) resetPointer();
    else scrollTarget = window.scrollY;
    sync();
  }
  function lost(event) {
    event.preventDefault();
    contextLost = true;
    root.dataset.world = 'fallback';
    hint.hidden = true;
    renderer.setAnimationLoop(null);
  }
  function restored() {
    contextLost = false;
    width = height = 0;
    size();
    renderStill();
    if (!failed) root.dataset.world = 'ready';
    sync();
  }
  function pageHide(event) {
    if (event.persisted) { pageCached = true; sync(); return; }
    disposed = true;
    renderer.setAnimationLoop(null);
    resizeObserver?.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerout', pointerOut);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', size);
    window.removeEventListener('adc:motionchange', onMotion);
    window.removeEventListener('adc:chapterchange', setChapter);
    window.removeEventListener('adc:themechange', setTheme);
    document.removeEventListener('visibilitychange', sync);
    reduced.removeEventListener('change', onMotion);
    finePointer.removeEventListener('change', sync);
    const geometries = new Set();
    const materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    renderer.dispose();
  }
  function pointerOut(event) { if (!event.relatedTarget) resetPointer(); }
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerout', pointerOut, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', size, { passive: true });
  window.addEventListener('adc:motionchange', onMotion);
  window.addEventListener('adc:chapterchange', setChapter);
  window.addEventListener('adc:themechange', setTheme);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', onMotion);
  finePointer.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', lost, false);
  canvas.addEventListener('webglcontextrestored', restored, false);
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', () => { pageCached = false; sync(); });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  resizeObserver?.observe(canvas);
  setTheme();
  size();
  renderStill();
  if (!failed) root.dataset.world = 'ready';
  sync();
}
