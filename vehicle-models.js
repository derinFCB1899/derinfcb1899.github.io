/**
 * Procedural, solid low-poly assets. Pass the application's Three.js namespace.
 * Vehicles face -Z, rest on y=0, and expose wheel groups in userData.wheels.
 * No scene, renderer, animation loop, textures, loaders, or network requests.
 */

function material(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.56, metalness: 0.38, flatShading: true, ...options,
  });
}

function glow(THREE, color, intensity = 2.5) {
  return material(THREE, color, {
    emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.1,
  });
}

function mesh(THREE, parent, geometry, mat, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  parent.add(object);
  return object;
}

function box(THREE, parent, mat, size, position) {
  return mesh(THREE, parent, new THREE.BoxGeometry(...size), mat, position);
}

/** Extrudes a concave side outline in the YZ plane along X. */
function profile(THREE, points, halfWidth) {
  let outline = points.map(([z, y]) => new THREE.Vector2(z, y));
  const area = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0);
  if (area < 0) outline.reverse();
  const n = outline.length;
  const vertices = [];
  for (const x of [-halfWidth, halfWidth]) {
    for (const p of outline) vertices.push(x, p.y, p.x);
  }
  const indices = [];
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(outline, [])) {
    indices.push(a, b, c, n + c, n + b, n + a);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, n + i, j, j, n + i, n + j);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

/** Solid prism with individually tapered side-profile corners. */
function taperedProfile(THREE, points) {
  let outline = points.slice();
  const area = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area < 0) outline.reverse();
  const n = outline.length;
  const vertices = [];
  for (const sign of [-1, 1]) {
    for (const [z, y, width] of outline) vertices.push(sign * width, y, z);
  }
  const indices = [];
  const contour = outline.map(([z, y]) => new THREE.Vector2(z, y));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    indices.push(a, b, c, n + c, n + b, n + a);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, n + i, j, j, n + i, n + j);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function panel(THREE, parent, mat, corners) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return mesh(THREE, parent, geometry, mat);
}

function beam(THREE, parent, mat, start, end, radius, endRadius = radius, sides = 6) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const object = mesh(
    THREE, parent,
    new THREE.CylinderGeometry(endRadius, radius, direction.length(), sides), mat,
  );
  object.position.copy(a.add(b).multiplyScalar(0.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}

// Batch static surfaces by material while retaining independently spinning wheels.
// Only position/normal attributes are needed because these assets have no textures.
function batchSurfaces(THREE, group) {
  const batches = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh) continue;
    child.updateMatrix();
    const geometry = child.geometry.index
      ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(geometry);
    group.remove(child);
  }
  for (const [mat, parts] of batches) {
    const length = parts.reduce((total, part) => total + part.attributes.position.array.length, 0);
    const positions = new Float32Array(length);
    const normals = new Float32Array(length);
    let offset = 0;
    for (const part of parts) {
      positions.set(part.attributes.position.array, offset);
      normals.set(part.attributes.normal.array, offset);
      offset += part.attributes.position.array.length;
      part.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    mesh(THREE, group, geometry, mat);
  }
}

/** Three distinct 1980s silhouettes. Unknown variants retain the original wedge. */
export function createRetroCar(THREE, accent = '#ff359c', variant = 'wedge') {
  if (variant === 'boxy') return createBoxyCar(THREE, accent);
  if (variant === 'targa') return createTargaCar(THREE, accent);
  const car = createWedgeCar(THREE, accent);
  car.userData.variant = 'wedge';
  return car;
}

function createWedgeCar(THREE, accent = '#ff359c') {
  const car = new THREE.Group();
  car.name = 'Retro wedge coupe';
  const paint = material(THREE, '#351427', { metalness: 0.65, roughness: 0.36 });
  const shoulderPaint = material(THREE, '#572038', { metalness: 0.6, roughness: 0.34 });
  const dark = material(THREE, '#0a0c17', { roughness: 0.72 });
  const rubber = material(THREE, '#08090e', { metalness: 0.02, roughness: 0.96 });
  const alloy = material(THREE, '#697080', { metalness: 0.86, roughness: 0.28 });
  const glass = material(THREE, '#111b31', {
    emissive: '#142139', emissiveIntensity: 0.2, metalness: 0.82,
    roughness: 0.12, side: THREE.DoubleSide,
  });
  const trim = glow(THREE, accent, 2.0);
  const rearLight = glow(THREE, '#ff254a', 3.2);
  const headLight = glow(THREE, '#dafaff', 3.0);

  mesh(THREE, car, taperedProfile(THREE, [
    [-2.4, 0.28, 0.83], [-2.4, 0.49, 0.88], [-1.97, 0.85, 0.84],
    [-0.76, 0.91, 0.84], [0.9, 0.9, 0.84], [1.96, 0.84, 0.84],
    [2.4, 0.75, 0.86], [2.4, 0.28, 0.83],
  ]), paint);
  const sideGeometry = profile(THREE, [
    [-2.4, 0.49], [-2.18, 0.73], [-1.97, 0.89], [-0.76, 0.94],
    [0.9, 0.93], [1.97, 0.89], [2.4, 0.78], [2.4, 0.28],
    [1.96, 0.28], [1.96, 0.44], [1.84, 0.68], [1.64, 0.81],
    [1.28, 0.81], [1.07, 0.67], [0.94, 0.43], [0.94, 0.26],
    [-0.94, 0.26], [-0.94, 0.43], [-1.07, 0.67], [-1.28, 0.81],
    [-1.64, 0.81], [-1.84, 0.68], [-1.96, 0.44], [-1.96, 0.28], [-2.4, 0.28],
  ], 0.10);
  for (const sign of [-1, 1]) {
    mesh(THREE, car, sideGeometry, shoulderPaint, [sign * 0.94, 0, 0]);
    box(THREE, car, dark, [0.032, 0.11, 1.76], [sign * 1.044, 0.37, 0]);
    box(THREE, car, trim, [0.025, 0.025, 1.72], [sign * 1.061, 0.49, 0]);
    box(THREE, car, dark, [0.025, 0.022, 1.23], [sign * 1.046, 0.73, 0.07]);
    box(THREE, car, alloy, [0.025, 0.038, 0.19], [sign * 1.055, 0.78, 0.39]);
  }

  mesh(THREE, car, taperedProfile(THREE, [
    [-0.99, 0.91, 0.89], [-0.36, 1.4, 0.67],
    [0.65, 1.4, 0.67], [1.35, 0.91, 0.9],
  ]), paint);
  panel(THREE, car, glass, [
    [-0.854, 0.935, -0.974], [0.854, 0.935, -0.974],
    [0.638, 1.372, -0.387], [-0.638, 1.372, -0.387],
  ]);
  panel(THREE, car, glass, [
    [-0.64, 1.373, 0.685], [0.64, 1.373, 0.685],
    [0.858, 0.938, 1.318], [-0.858, 0.938, 1.318],
  ]);
  for (const sign of [-1, 1]) {
    panel(THREE, car, glass, [
      [sign * 0.87, 0.955, -0.92], [sign * 0.659, 1.365, -0.342],
      [sign * 0.66, 1.365, 0.59], [sign * 0.877, 0.955, 1.257],
    ]);
    beam(THREE, car, paint, [sign * 0.877, 0.949, 0.38], [sign * 0.677, 1.393, 0.26], 0.033);
    beam(THREE, car, trim, [sign * 0.903, 0.935, -0.95], [sign * 0.903, 0.935, 1.31], 0.012);
    box(THREE, car, dark, [0.19, 0.10, 0.24], [sign * 1.0, 1.0, -0.67]);
  }
  box(THREE, car, shoulderPaint, [1.30, 0.04, 0.94], [0, 1.414, 0.15]);
  // Raised rear-glass louvres follow its slope instead of lying on the roof.
  for (let i = 0; i < 5; i++) {
    const z = 0.77 + i * 0.105;
    const y = 1.4 - (z - 0.65) * 0.7 + 0.025;
    const width = 1.36 + (z - 0.65) * 0.58;
    const louvre = box(THREE, car, dark, [width, 0.035, 0.07], [0, y, z]);
    louvre.rotation.x = 0.6;
  }
  // Sloped hood seams, retractable lamp housings, and a stepped front valance.
  for (const sign of [-1, 1]) {
    beam(THREE, car, dark, [sign * 0.54, 0.872, -1.95], [sign * 0.60, 0.929, -0.98], 0.012);
    const housing = box(THREE, car, dark, [0.51, 0.095, 0.34], [sign * 0.59, 0.773, -2.08]);
    housing.rotation.x = -0.18;
    box(THREE, car, headLight, [0.45, 0.068, 0.022], [sign * 0.59, 0.793, -2.255]);
    box(THREE, car, trim, [0.19, 0.045, 0.022], [sign * 0.86, 0.47, -2.414]);
  }
  box(THREE, car, dark, [1.99, 0.095, 0.14], [0, 0.30, -2.36]);
  box(THREE, car, dark, [0.85, 0.09, 0.028], [0, 0.442, -2.413]);
  box(THREE, car, dark, [2.02, 0.19, 0.045], [0, 0.596, 2.412]);
  for (const sign of [-1, 1]) {
    box(THREE, car, rearLight, [0.81, 0.075, 0.027], [sign * 0.55, 0.64, 2.441]);
    box(THREE, car, rearLight, [0.81, 0.023, 0.027], [sign * 0.55, 0.554, 2.441]);
    box(THREE, car, dark, [0.08, 0.13, 0.031], [sign * 0.49, 0.608, 2.459]);
    box(THREE, car, dark, [0.08, 0.13, 0.031], [sign * 0.72, 0.608, 2.459]);
    box(THREE, car, dark, [0.09, 0.17, 0.12], [sign * 0.68, 0.95, 2.04]);
  }
  box(THREE, car, shoulderPaint, [2.14, 0.055, 0.32], [0, 1.048, 2.08]);
  box(THREE, car, trim, [2.08, 0.016, 0.023], [0, 1.058, 2.253]);
  box(THREE, car, dark, [1.95, 0.09, 0.17], [0, 0.285, 2.35]);
  box(THREE, car, alloy, [0.19, 0.026, 0.016], [0, 0.605, 2.446]);

  const tireGeometry = new THREE.CylinderGeometry(0.39, 0.39, 0.28, 20);
  const shoulderGeometry = new THREE.TorusGeometry(0.315, 0.085, 6, 20);
  const hubGeometry = new THREE.CylinderGeometry(0.245, 0.245, 0.024, 10);
  const rimGeometry = new THREE.TorusGeometry(0.263, 0.019, 5, 20);
  const spokeGeometry = new THREE.BoxGeometry(0.026, 0.06, 0.34);
  car.userData.wheels = [];
  for (const xSign of [-1, 1]) {
    for (const z of [-1.45, 1.45]) {
      const wheel = new THREE.Group();
      wheel.position.set(xSign * 0.965, 0.4, z);
      wheel.name = `${z < 0 ? 'Front' : 'Rear'} ${xSign < 0 ? 'left' : 'right'} wheel`;
      mesh(THREE, wheel, tireGeometry, rubber).rotation.z = Math.PI / 2;
      for (const face of [-1, 1]) {
        mesh(THREE, wheel, shoulderGeometry, rubber, [face * 0.075, 0, 0]).rotation.y = Math.PI / 2;
      }
      const faceX = xSign * 0.156;
      mesh(THREE, wheel, hubGeometry, dark, [faceX, 0, 0]).rotation.z = Math.PI / 2;
      mesh(THREE, wheel, rimGeometry, trim, [faceX + xSign * 0.006, 0, 0]).rotation.y = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const spoke = mesh(THREE, wheel, spokeGeometry, alloy, [faceX + xSign * 0.016, 0, 0]);
        spoke.rotation.x = i * Math.PI / 3;
      }
      car.add(wheel);
      car.userData.wheels.push(wheel);
      batchSurfaces(THREE, wheel);
    }
  }
  car.userData.forwardAxis = '-Z';
  car.userData.wheelAxis = 'X';
  batchSurfaces(THREE, car);
  return car;
}

function retroMaterials(THREE, accent) {
  return {
    paint: material(THREE, '#351427', { metalness: 0.65, roughness: 0.36 }),
    shoulder: material(THREE, '#572038', { metalness: 0.6, roughness: 0.34 }),
    dark: material(THREE, '#0a0c17', { roughness: 0.72 }),
    rubber: material(THREE, '#08090e', { metalness: 0.02, roughness: 0.96 }),
    alloy: material(THREE, '#697080', { metalness: 0.86, roughness: 0.28 }),
    glass: material(THREE, '#111b31', {
      emissive: '#142139', emissiveIntensity: 0.2, metalness: 0.82,
      roughness: 0.12, side: THREE.DoubleSide,
    }),
    trim: glow(THREE, accent, 2.0),
    rearLight: glow(THREE, '#ff254a', 3.2),
    headLight: glow(THREE, '#dafaff', 3.0),
  };
}

/** Wheels remain groups, with their axle along X and the tire surface at y=0. */
function addRetroWheels(THREE, car, m, { axleZ = 1.45, spokes = 4 } = {}) {
  const tire = new THREE.CylinderGeometry(0.39, 0.39, 0.28, 20);
  const shoulder = new THREE.TorusGeometry(0.315, 0.085, 6, 20);
  const hub = new THREE.CylinderGeometry(0.245, 0.245, 0.024, 12);
  const rim = new THREE.TorusGeometry(0.263, 0.019, 5, 20);
  const spoke = new THREE.BoxGeometry(0.026, 0.045, 0.185);
  car.userData.wheels = [];
  for (const sign of [-1, 1]) {
    for (const z of [-axleZ, axleZ]) {
      const wheel = new THREE.Group();
      wheel.position.set(sign * 0.965, 0.4, z);
      wheel.name = `${z < 0 ? 'Front' : 'Rear'} ${sign < 0 ? 'left' : 'right'} wheel`;
      mesh(THREE, wheel, tire, m.rubber).rotation.z = Math.PI / 2;
      for (const face of [-1, 1]) {
        mesh(THREE, wheel, shoulder, m.rubber, [face * 0.075, 0, 0]).rotation.y = Math.PI / 2;
      }
      const faceX = sign * 0.156;
      mesh(THREE, wheel, hub, m.dark, [faceX, 0, 0]).rotation.z = Math.PI / 2;
      mesh(THREE, wheel, rim, m.trim, [faceX + sign * 0.006, 0, 0]).rotation.y = Math.PI / 2;
      for (let i = 0; i < spokes; i++) {
        const angle = i * Math.PI * 2 / spokes;
        const radialSpoke = mesh(THREE, wheel, spoke, m.alloy,
          [faceX + sign * 0.016, -Math.sin(angle) * 0.14, Math.cos(angle) * 0.14]);
        radialSpoke.rotation.x = angle;
      }
      car.add(wheel);
      car.userData.wheels.push(wheel);
      batchSurfaces(THREE, wheel);
    }
  }
}

function finishRetroCar(THREE, car, m, variant, spokes) {
  addRetroWheels(THREE, car, m, { spokes });
  car.userData.variant = variant;
  car.userData.forwardAxis = '-Z';
  car.userData.wheelAxis = 'X';
  batchSurfaces(THREE, car);
  return car;
}

/** Upright notchback cabin, square bonnet and trunk, and broad impact bumpers. */
function createBoxyCar(THREE, accent) {
  const car = new THREE.Group();
  car.name = '1980s boxy notchback coupe';
  const m = retroMaterials(THREE, accent);
  mesh(THREE, car, taperedProfile(THREE, [
    [-2.36, 0.29, 0.85], [-2.36, 0.93, 0.87], [-2.18, 1.00, 0.88],
    [-0.92, 1.00, 0.88], [1.19, 1.00, 0.88], [2.27, 0.99, 0.88],
    [2.36, 0.91, 0.87], [2.36, 0.29, 0.85],
  ]), m.paint);
  const flank = profile(THREE, [
    [-2.36, 0.29], [-2.36, 0.92], [-2.18, 1.03], [2.27, 1.02],
    [2.36, 0.91], [2.36, 0.29], [1.97, 0.29], [1.97, 0.45],
    [1.86, 0.68], [1.65, 0.84], [1.25, 0.84], [1.04, 0.67],
    [0.93, 0.43], [0.93, 0.27], [-0.93, 0.27], [-0.93, 0.43],
    [-1.04, 0.67], [-1.25, 0.84], [-1.65, 0.84], [-1.86, 0.68],
    [-1.97, 0.45], [-1.97, 0.29],
  ], 0.10);
  for (const sign of [-1, 1]) {
    mesh(THREE, car, flank, m.shoulder, [sign * 0.94, 0, 0]);
    box(THREE, car, m.dark, [0.034, 0.075, 4.56], [sign * 1.048, 0.91, 0]);
    box(THREE, car, m.trim, [0.024, 0.022, 1.73], [sign * 1.065, 0.48, 0]);
    box(THREE, car, m.dark, [0.025, 0.36, 0.019], [sign * 1.05, 0.72, 0.60]);
    box(THREE, car, m.alloy, [0.03, 0.05, 0.23], [sign * 1.066, 0.90, 0.37]);
  }
  // A long flat roof and steep rear window make a clear three-box silhouette.
  mesh(THREE, car, taperedProfile(THREE, [
    [-1.01, 1.0, 0.90], [-0.52, 1.66, 0.73],
    [0.83, 1.66, 0.73], [1.26, 1.0, 0.90],
  ]), m.paint);
  box(THREE, car, m.shoulder, [1.48, 0.045, 1.37], [0, 1.669, 0.15]);
  panel(THREE, car, m.glass, [
    [-0.853, 1.045, -0.989], [0.853, 1.045, -0.989],
    [0.697, 1.627, -0.549], [-0.697, 1.627, -0.549],
  ]);
  panel(THREE, car, m.glass, [
    [-0.697, 1.624, 0.858], [0.697, 1.624, 0.858],
    [0.851, 1.049, 1.239], [-0.851, 1.049, 1.239],
  ]);
  for (const sign of [-1, 1]) {
    // Two actual panes split by a thick, upright B pillar.
    panel(THREE, car, m.glass, [
      [sign * 0.892, 1.055, -0.94], [sign * 0.746, 1.618, -0.499],
      [sign * 0.746, 1.618, 0.35], [sign * 0.892, 1.055, 0.35],
    ]);
    panel(THREE, car, m.glass, [
      [sign * 0.892, 1.055, 0.45], [sign * 0.746, 1.618, 0.45],
      [sign * 0.746, 1.618, 0.80], [sign * 0.892, 1.055, 1.20],
    ]);
    beam(THREE, car, m.dark, [sign * 0.895, 1.045, 0.40], [sign * 0.744, 1.643, 0.40], 0.04);
    beam(THREE, car, m.alloy, [sign * 0.916, 1.044, -0.96], [sign * 0.916, 1.044, 1.23], 0.013);
    box(THREE, car, m.dark, [0.22, 0.14, 0.23], [sign * 1.006, 1.13, -0.78]);
    beam(THREE, car, m.dark, [sign * 0.64, 1.007, -2.12], [sign * 0.64, 1.01, -1.03], 0.011);
    // Paired rectangular headlamps sit vertically in the square front fascia.
    for (const x of [0.50, 0.79]) {
      box(THREE, car, m.dark, [0.29, 0.24, 0.034], [sign * x, 0.805, -2.374]);
      box(THREE, car, m.headLight, [0.22, 0.145, 0.021], [sign * x, 0.819, -2.399]);
    }
    box(THREE, car, m.trim, [0.19, 0.06, 0.025], [sign * 0.84, 0.52, -2.467]);
    box(THREE, car, m.rearLight, [0.61, 0.19, 0.031], [sign * 0.67, 0.82, 2.381]);
    box(THREE, car, m.dark, [0.026, 0.20, 0.041], [sign * 0.65, 0.82, 2.40]);
  }
  box(THREE, car, m.dark, [0.70, 0.23, 0.03], [0, 0.81, -2.382]);
  for (const y of [0.75, 0.81, 0.87]) {
    box(THREE, car, m.alloy, [0.62, 0.014, 0.014], [0, y, -2.405]);
  }
  for (const z of [-2.38, 2.38]) {
    box(THREE, car, m.dark, [2.16, 0.17, 0.21], [0, 0.60, z]);
    box(THREE, car, m.alloy, [2.03, 0.025, 0.022], [0, 0.643, z + Math.sign(z) * 0.11]);
  }
  box(THREE, car, m.dark, [0.37, 0.16, 0.023], [0, 0.80, 2.381]);
  box(THREE, car, m.alloy, [0.26, 0.10, 0.015], [0, 0.80, 2.398]);
  // Subtle factory trunk lip instead of the wedge's elevated spoiler.
  box(THREE, car, m.shoulder, [1.91, 0.067, 0.13], [0, 1.042, 2.20]);
  return finishRetroCar(THREE, car, m, 'boxy', 4);
}

/** Low sports body with a genuinely open cockpit, targa hoop and ducktail rear. */
function createTargaCar(THREE, accent) {
  const car = new THREE.Group();
  car.name = '1980s open-roof targa sports car';
  const m = retroMaterials(THREE, accent);
  // Keep the center body below the cockpit sill, leaving no solid roof/cabin fill.
  mesh(THREE, car, taperedProfile(THREE, [
    [-2.35, 0.28, 0.76], [-2.35, 0.57, 0.81], [-1.93, 0.80, 0.86],
    [-0.96, 0.83, 0.88], [-0.61, 0.75, 0.88], [0.95, 0.75, 0.88],
    [1.29, 0.87, 0.89], [2.34, 0.77, 0.83], [2.34, 0.28, 0.78],
  ]), m.paint);
  const flank = profile(THREE, [
    [-2.35, 0.28], [-2.35, 0.56], [-1.94, 0.84], [-1.0, 0.89],
    [-0.68, 0.83], [0.87, 0.83], [1.17, 0.93], [1.92, 0.91],
    [2.34, 0.78], [2.34, 0.28], [1.98, 0.28], [1.98, 0.44],
    [1.86, 0.69], [1.65, 0.83], [1.25, 0.83], [1.04, 0.67],
    [0.93, 0.43], [0.93, 0.25], [-0.93, 0.25], [-0.93, 0.43],
    [-1.04, 0.67], [-1.25, 0.83], [-1.65, 0.83], [-1.86, 0.69],
    [-1.98, 0.44], [-1.98, 0.28],
  ], 0.105);
  for (const sign of [-1, 1]) {
    mesh(THREE, car, flank, m.shoulder, [sign * 0.94, 0, 0]);
    box(THREE, car, m.dark, [0.035, 0.10, 1.76], [sign * 1.05, 0.35, 0]);
    box(THREE, car, m.trim, [0.026, 0.025, 1.73], [sign * 1.072, 0.46, 0]);
    box(THREE, car, m.alloy, [0.03, 0.035, 0.16], [sign * 1.057, 0.78, 0.37]);
    // Deep side intake boxes behind the doors visually separate the rear haunches.
    box(THREE, car, m.dark, [0.029, 0.15, 0.32], [sign * 1.054, 0.64, 0.73]);
    for (const z of [0.62, 0.72, 0.82]) {
      box(THREE, car, m.shoulder, [0.035, 0.16, 0.025], [sign * 1.078, 0.64, z]);
    }
  }
  // Black recessed cockpit floor, two seats, console and dashboard remain visible.
  box(THREE, car, m.dark, [1.59, 0.035, 1.53], [0, 0.783, 0.10]);
  box(THREE, car, m.dark, [1.59, 0.15, 0.22], [0, 0.90, -0.64]);
  box(THREE, car, m.shoulder, [0.17, 0.13, 0.93], [0, 0.85, 0.08]);
  for (const sign of [-1, 1]) {
    box(THREE, car, m.dark, [0.58, 0.10, 0.59], [sign * 0.43, 0.87, 0.15]);
    const seat = box(THREE, car, m.dark, [0.57, 0.39, 0.13], [sign * 0.43, 1.08, 0.46]);
    seat.rotation.x = -0.16;
    box(THREE, car, m.dark, [0.32, 0.15, 0.12], [sign * 0.43, 1.31, 0.51]);
    beam(THREE, car, m.trim, [sign * 0.43, 0.927, -0.10], [sign * 0.43, 0.927, 0.37], 0.012);
  }
  const steeringWheel = mesh(THREE, car, new THREE.TorusGeometry(0.155, 0.02, 5, 12), m.dark, [-0.43, 1.025, -0.46]);
  steeringWheel.rotation.x = -0.30;
  beam(THREE, car, m.alloy, [-0.43, 0.90, -0.53], [-0.43, 1.025, -0.46], 0.02);
  // Only the windshield spans the cabin: the large region behind it is open air.
  panel(THREE, car, m.glass, [
    [-0.835, 0.895, -0.93], [0.835, 0.895, -0.93],
    [0.69, 1.40, -0.39], [-0.69, 1.40, -0.39],
  ]);
  for (const sign of [-1, 1]) {
    beam(THREE, car, m.paint, [sign * 0.863, 0.875, -0.96], [sign * 0.713, 1.42, -0.375], 0.034);
    // Low quarterlights leave the area above the doors open.
    panel(THREE, car, m.glass, [
      [sign * 0.866, 0.852, -0.86], [sign * 0.774, 1.162, -0.61],
      [sign * 0.831, 0.935, -0.42], [sign * 0.866, 0.852, -0.42],
    ]);
    box(THREE, car, m.dark, [0.21, 0.10, 0.22], [sign * 1.001, 0.967, -0.67]);
    beam(THREE, car, m.alloy, [sign * 0.882, 0.86, -0.50], [sign * 0.882, 0.86, 0.77], 0.016);
    // Thick targa pillars and tapered flying buttresses frame the rear deck.
    beam(THREE, car, m.shoulder, [sign * 0.873, 0.865, 0.84], [sign * 0.724, 1.44, 0.80], 0.075, 0.062, 4);
    const buttress = profile(THREE, [[0.80, 1.42], [0.91, 1.42], [1.58, 0.93], [0.95, 0.86]], 0.078);
    mesh(THREE, car, buttress, m.paint, [sign * 0.74, 0, 0]);
  }
  box(THREE, car, m.paint, [1.46, 0.075, 0.10], [0, 1.415, -0.375]);
  box(THREE, car, m.shoulder, [1.58, 0.10, 0.22], [0, 1.44, 0.83]);
  box(THREE, car, m.trim, [1.48, 0.017, 0.023], [0, 1.495, 0.83]);
  panel(THREE, car, m.glass, [
    [-0.663, 0.921, 0.973], [0.663, 0.921, 0.973],
    [0.663, 1.386, 0.933], [-0.663, 1.386, 0.933],
  ]);
  box(THREE, car, m.dark, [1.13, 0.035, 0.79], [0, 0.958, 1.53]);
  for (let i = 0; i < 6; i++) {
    box(THREE, car, m.shoulder, [1.12, 0.026, 0.036], [0, 0.986, 1.21 + i * 0.125]);
  }
  for (const sign of [-1, 1]) {
    // Raised pop-up pods produce a different front profile from the low wedge.
    mesh(THREE, car, taperedProfile(THREE, [
      [-2.07, 0.71, 0.235], [-2.07, 0.98, 0.235],
      [-1.61, 0.83, 0.225], [-1.61, 0.77, 0.225],
    ]), m.shoulder, [sign * 0.59, 0, 0]);
    box(THREE, car, m.dark, [0.43, 0.18, 0.018], [sign * 0.59, 0.878, -2.08]);
    box(THREE, car, m.headLight, [0.35, 0.13, 0.018], [sign * 0.59, 0.885, -2.095]);
    box(THREE, car, m.trim, [0.26, 0.05, 0.024], [sign * 0.70, 0.45, -2.365]);
    for (const x of [0.50, 0.79]) {
      const lamp = mesh(THREE, car, new THREE.CylinderGeometry(0.092, 0.092, 0.028, 12), m.rearLight, [sign * x, 0.626, 2.365]);
      lamp.rotation.x = Math.PI / 2;
    }
    box(THREE, car, m.alloy, [0.16, 0.095, 0.18], [sign * 0.74, 0.30, 2.30]);
  }
  box(THREE, car, m.dark, [1.83, 0.085, 0.17], [0, 0.29, -2.33]);
  box(THREE, car, m.dark, [0.81, 0.10, 0.023], [0, 0.432, -2.365]);
  box(THREE, car, m.dark, [1.91, 0.24, 0.03], [0, 0.63, 2.343]);
  // The wide, swept ducktail rises directly out of the deck; no raised wing legs.
  mesh(THREE, car, taperedProfile(THREE, [
    [1.93, 0.82, 0.98], [2.28, 1.08, 1.07],
    [2.38, 1.075, 1.065], [2.34, 0.775, 0.94],
  ]), m.shoulder);
  box(THREE, car, m.trim, [2.07, 0.022, 0.023], [0, 1.081, 2.375]);
  box(THREE, car, m.dark, [1.94, 0.08, 0.17], [0, 0.28, 2.30]);
  return finishRetroCar(THREE, car, m, 'targa', 5);
}

export function createLightCycle(THREE, accent = '#49edff') {
  const cycle = new THREE.Group();
  cycle.name = 'Cyan lightcycle with crouched rider';
  const armor = material(THREE, '#090f19', { metalness: 0.75, roughness: 0.28 });
  const edgeArmor = material(THREE, '#182735', { metalness: 0.78, roughness: 0.31 });
  const rubber = material(THREE, '#070a0e', { metalness: 0.04, roughness: 0.85 });
  const riderMaterial = material(THREE, '#0c1420', { metalness: 0.22, roughness: 0.49 });
  const luminous = glow(THREE, accent, 3.6);
  const softGlow = glow(THREE, accent, 1.35);
  const visor = material(THREE, '#4deaff', {
    emissive: accent, emissiveIntensity: 0.65, roughness: 0.12, metalness: 0.8,
  });

  mesh(THREE, cycle, taperedProfile(THREE, [
    [-1.59, 0.64, 0.20], [-1.29, 0.91, 0.25], [-0.89, 0.98, 0.26],
    [-0.40, 0.73, 0.29], [0.21, 0.70, 0.30], [0.63, 0.88, 0.28],
    [1.28, 0.91, 0.24], [1.54, 0.73, 0.20], [1.21, 0.57, 0.23],
    [0.56, 0.47, 0.28], [0.31, 0.25, 0.26], [-0.46, 0.25, 0.26],
    [-0.77, 0.48, 0.23], [-1.32, 0.52, 0.20],
  ]), armor);
  const flankGeometry = profile(THREE, [
    [-0.75, 0.61], [-0.36, 0.78], [0.14, 0.75], [0.64, 0.61],
    [0.29, 0.28], [-0.39, 0.28],
  ], 0.018);
  for (const sign of [-1, 1]) {
    mesh(THREE, cycle, flankGeometry, edgeArmor, [sign * 0.303, 0, 0]);
    const x = sign * 0.328;
    const path = [[x, 0.63, -0.68], [x, 0.40, -0.4], [x, 0.34, 0.24], [x, 0.60, 0.61]];
    for (let i = 0; i < path.length - 1; i++) {
      beam(THREE, cycle, luminous, path[i], path[i + 1], 0.022);
    }
    beam(THREE, cycle, edgeArmor, [sign * 0.19, 0.60, -0.70], [sign * 0.19, 0.51, -1.02], 0.054);
    beam(THREE, cycle, edgeArmor, [sign * 0.19, 0.50, 0.34], [sign * 0.19, 0.51, 1.02], 0.064);
    beam(THREE, cycle, softGlow, [sign * 0.18, 0.94, -1.20], [sign * 0.18, 0.89, -0.88], 0.014);
    beam(THREE, cycle, softGlow, [sign * 0.17, 0.92, 0.78], [sign * 0.17, 0.94, 1.16], 0.016);
  }
  box(THREE, cycle, luminous, [0.25, 0.043, 0.034], [0, 0.72, -1.533]);
  box(THREE, cycle, luminous, [0.15, 0.051, 0.035], [0, 0.76, 1.505]);
  box(THREE, cycle, rubber, [0.36, 0.11, 0.47], [0, 0.78, 0.29]);
  beam(THREE, cycle, edgeArmor, [-0.29, 0.83, -0.89], [0.29, 0.83, -0.89], 0.025);

  const tireGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.27, 24);
  const shoulderGeometry = new THREE.TorusGeometry(0.415, 0.105, 8, 24);
  const discGeometry = new THREE.CylinderGeometry(0.393, 0.393, 0.022, 24);
  const ringGeometry = new THREE.TorusGeometry(0.395, 0.026, 6, 32);
  const innerRingGeometry = new THREE.TorusGeometry(0.31, 0.009, 4, 24);
  const hubGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.018, 8);
  cycle.userData.wheels = [];
  for (const z of [-1.02, 1.02]) {
    const wheel = new THREE.Group();
    wheel.name = z < 0 ? 'Front luminous wheel' : 'Rear luminous wheel';
    wheel.position.set(0, 0.52, z);
    mesh(THREE, wheel, tireGeometry, rubber).rotation.z = Math.PI / 2;
    mesh(THREE, wheel, shoulderGeometry, rubber).rotation.y = Math.PI / 2;
    for (const sign of [-1, 1]) {
      mesh(THREE, wheel, discGeometry, armor, [sign * 0.144, 0, 0]).rotation.z = Math.PI / 2;
      mesh(THREE, wheel, ringGeometry, luminous, [sign * 0.161, 0, 0]).rotation.y = Math.PI / 2;
      mesh(THREE, wheel, innerRingGeometry, softGlow, [sign * 0.164, 0, 0]).rotation.y = Math.PI / 2;
      mesh(THREE, wheel, hubGeometry, edgeArmor, [sign * 0.170, 0, 0]).rotation.z = Math.PI / 2;
    }
    cycle.add(wheel);
    cycle.userData.wheels.push(wheel);
    batchSurfaces(THREE, wheel);
  }

  const rider = new THREE.Group();
  rider.name = 'Crouched helmeted rider';
  mesh(THREE, rider, taperedProfile(THREE, [
    [0.48, 0.83, 0.15], [0.34, 1.00, 0.18],
    [-0.32, 1.13, 0.19], [-0.45, 0.99, 0.16], [0.12, 0.80, 0.15],
  ]), riderMaterial);
  beam(THREE, rider, softGlow, [0, 1.018, 0.31], [0, 1.148, -0.29], 0.017);
  const helmet = mesh(THREE, rider, new THREE.IcosahedronGeometry(0.19, 1), armor, [0, 1.16, -0.57]);
  helmet.scale.set(0.90, 1.0, 1.08);
  const face = mesh(THREE, rider, new THREE.SphereGeometry(
    0.195, 12, 6, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.32, Math.PI * 0.26,
  ), visor, [0, 1.16, -0.57]);
  face.scale.set(0.91, 1.01, 1.08);
  for (const sign of [-1, 1]) {
    const shoulder = [sign * 0.17, 1.035, -0.32];
    const elbow = [sign * 0.245, 0.88, -0.58];
    const hand = [sign * 0.275, 0.83, -0.88];
    beam(THREE, rider, riderMaterial, shoulder, elbow, 0.075, 0.064);
    beam(THREE, rider, riderMaterial, elbow, hand, 0.060, 0.045);
    beam(THREE, rider, softGlow,
      [sign * 0.226, 1.046, -0.33], [sign * 0.297, 0.892, -0.575], 0.011,
    );
    mesh(THREE, rider, new THREE.IcosahedronGeometry(0.062, 0), rubber, hand);
    const hip = [sign * 0.13, 0.87, 0.30];
    const knee = [sign * 0.242, 0.65, -0.10];
    const ankle = [sign * 0.248, 0.39, 0.30];
    beam(THREE, rider, riderMaterial, hip, knee, 0.092, 0.079);
    beam(THREE, rider, riderMaterial, knee, ankle, 0.07, 0.054);
    beam(THREE, rider, softGlow,
      [sign * 0.294, 0.647, -0.095], [sign * 0.294, 0.414, 0.25], 0.010,
    );
    box(THREE, rider, rubber, [0.12, 0.09, 0.26], [sign * 0.25, 0.345, 0.22]);
  }
  cycle.add(rider);
  cycle.userData.rider = rider;
  cycle.userData.forwardAxis = '-Z';
  cycle.userData.wheelAxis = 'X';
  batchSurfaces(THREE, rider);
  batchSurfaces(THREE, cycle);
  return cycle;
}

export function createRecognizer(THREE) {
  const recognizer = new THREE.Group();
  recognizer.name = 'TRON-style hovering Recognizer';
  const armor = material(THREE, '#12141b', { metalness: 0.72, roughness: 0.40 });
  const inset = material(THREE, '#080b12', { metalness: 0.45, roughness: 0.63 });
  const plate = material(THREE, '#242932', { metalness: 0.75, roughness: 0.38 });
  const orange = glow(THREE, '#ff5724', 2.75);
  const faintOrange = glow(THREE, '#ff6a31', 1.15);
  const frontProfile = (points, depth, mat, z = 0) => {
    const geometry = profile(THREE, points, depth / 2);
    geometry.rotateY(Math.PI / 2);
    return mesh(THREE, recognizer, geometry, mat, [0, 0, z]);
  };

  // Broad, shallow head; the entire central opening remains empty below it.
  frontProfile([
    [-5.6, 4.72], [-4.98, 5.0], [4.98, 5.0], [5.6, 4.72],
    [5.6, 3.45], [4.80, 3.03], [-4.80, 3.03], [-5.6, 3.45],
  ], 2.0, armor);
  box(THREE, recognizer, inset, [9.65, 0.39, 0.055], [0, 4.12, -1.031]);
  box(THREE, recognizer, orange, [9.18, 0.079, 0.023], [0, 4.13, -1.070]);
  box(THREE, recognizer, plate, [9.4, 0.24, 0.035], [0, 4.64, -1.027]);
  box(THREE, recognizer, plate, [5.25, 0.20, 0.04], [0, 3.41, -1.027]);
  box(THREE, recognizer, inset, [1.34, 0.31, 0.16], [0, 3.09, -0.83]);
  box(THREE, recognizer, orange, [0.79, 0.035, 0.026], [0, 2.947, -0.922]);

  for (const sign of [-1, 1]) {
    const leg = [
      [3.50, 3.31], [5.18, 3.31], [5.18, -1.17], [5.87, -3.43],
      [5.80, -4.84], [3.66, -4.84], [3.22, -3.40], [3.59, -1.23],
    ].map(([x, y]) => [sign * x, y]);
    frontProfile(leg, 1.38, armor, 0.05);
    frontProfile([
      [sign * 3.77, 2.86], [sign * 4.90, 2.86],
      [sign * 4.90, -1.19], [sign * 4.04, -1.29],
    ], 0.06, plate, -0.679);
    frontProfile([
      [sign * 4.08, -1.56], [sign * 4.99, -1.45],
      [sign * 5.51, -3.43], [sign * 5.43, -4.29],
      [sign * 3.93, -4.29], [sign * 3.66, -3.38],
    ], 0.07, inset, -0.689);
    box(THREE, recognizer, armor, [2.22, 0.45, 1.78], [sign * 4.73, -4.775, -0.08]);
    box(THREE, recognizer, plate, [1.82, 0.11, 0.046], [sign * 4.73, -4.78, -0.992]);
    const path = [
      [sign * 3.76, 2.86, -0.737], [sign * 3.83, -1.19, -0.737],
      [sign * 3.47, -3.40, -0.737], [sign * 3.89, -4.56, -0.737],
    ];
    for (let i = 0; i < path.length - 1; i++) {
      beam(THREE, recognizer, faintOrange, path[i], path[i + 1], 0.026, 0.026, 4);
    }
    box(THREE, recognizer, orange, [0.60, 0.047, 0.027], [sign * 4.93, -4.35, -0.747]);
    box(THREE, recognizer, inset, [0.17, 0.58, 0.034], [sign * 4.76, 3.76, -1.067]);
    box(THREE, recognizer, faintOrange, [0.048, 0.45, 0.027], [sign * 5.26, 3.92, -1.054]);
  }
  recognizer.userData.forwardAxis = '-Z';
  batchSurfaces(THREE, recognizer);
  return recognizer;
}
