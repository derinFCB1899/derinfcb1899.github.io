import * as THREE from './vendor/three/three.module.js';
import { clamp, wrap, damp, renderScale, seededRandom } from './world-math.js';
import { createTraffic } from './world-traffic.js?v=continuous4';

// The canvas is decorative. Every project and control remains ordinary HTML.
const canvas = document.getElementById('world-canvas');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let hint = document.querySelector('.world-hint');
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

  const floor = new THREE.GridHelper(300, 90, '#339bc9', '#135271');
  floor.position.set(0, -5.05, -115);
  floor.material.transparent = true;
  floor.material.opacity = .43;
  floor.material.depthWrite = false;
  scene.add(floor);
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

  const lightMaterial = (color, opacity = .85) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  });

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
  for (const x of [-5,5]) {
    const rail = new THREE.Mesh(railGeometry,railMaterial);
    rail.position.set(x,-5,-105);
    rails.add(rail);
  }
  scene.add(rails);
  const roadDashes = new THREE.InstancedMesh(new THREE.BoxGeometry(.045, .02, 3.8), railMaterial, 56);
  const roadMatrix = new THREE.Matrix4();
  for (let i = 0; i < 56; i++) {
    roadMatrix.makeTranslation(i % 2 ? 5 / 3 : -5 / 3, -5, 16 - Math.floor(i / 2) * 8);
    roadDashes.setMatrixAt(i, roadMatrix);
  }
  roadDashes.instanceMatrix.needsUpdate = true;
  scene.add(roadDashes);
  const traffic = createTraffic(THREE, scene);

  function setTheme() {
    const light = root.dataset.theme === 'light';
    traffic.setTheme(light);
    scene.fog.color.set(light ? '#ed7289' : '#020911');
    scene.fog.density = light ? .006 : .012;
    cyan.set(light ? '#a51487' : '#45eaff');
    pink.set(light ? '#ffbb47' : '#ff8e39');
    floor.material.opacity = light ? .58 : .62;
    const gridColor = new THREE.Color(light ? '#c4218e' : '#16728b');
    const colors = floor.geometry.attributes.color;
    for (let i = 0; i < colors.count; i++) colors.setXYZ(i, gridColor.r, gridColor.g, gridColor.b);
    colors.needsUpdate = true;
    stars.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    stars.material.color.set(light ? '#a63086' : '#79dbe9');
    stars.material.opacity = light ? .3 : .5;
    stars.material.needsUpdate = true;
    packets.material.color.copy(cyan);
    railMaterial.color.set(light ? '#faac48' : '#50eaff');
    rails.visible = roadDashes.visible = light;
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
    nextAccent.set(light ? '#d2219a' : '#45eaff');
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
    travel += dt * 3.2;
    const distance = travel + scrollPosition * .018;
    const targetX = pointer.x * (compact ? .15 : .6);
    const targetY = .75 + pointer.y * .25;
    camera.position.x = damp(camera.position.x, targetX, 3, dt);
    camera.position.y = damp(camera.position.y, targetY, 3, dt);
    camera.position.z = 24;
    lookAt.set(pointer.x * .2, -.7 + pointer.y * .12, -70);
    camera.lookAt(lookAt);
    camera.rotation.z = pointer.x * -.005;
    accent.lerp(nextAccent, 1 - Math.exp(-dt * 1.5));

    const light = root.dataset.theme === 'light';
    floor.position.z = (light ? -115 : -110) + wrap(distance, 10 / 3);
    floor.position.x = 0;
    roadDashes.position.z = wrap(distance, 8);
    stars.rotation.z = Math.sin(elapsed * .045) * .02;
    stars.position.z = wrap(elapsed * .25, 10);
    for (let i = 0; i < packetCount; i++) {
      const offset = i * 6;
      const lane = [-4,-3,-2,1,2,3][i % 6] * 10 / 3;
      const position = 28 - wrap(i * 13.7 - elapsed * 10 - scrollPosition * .025, 220);
      packetPositions[offset] = packetPositions[offset + 3] = lane;
      packetPositions[offset + 1] = packetPositions[offset + 4] = -4.95;
      packetPositions[offset + 2] = position;
      packetPositions[offset + 5] = position - 2.5;
    }
    packetGeometry.attributes.position.needsUpdate = true;
    traffic.update(elapsed, compact);
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
    const interval = 1000 / 60;
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
  window.addEventListener('adc:pagechange', () => { hint = document.querySelector('.world-hint'); setChapter(); onScroll(); sync(); });
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
