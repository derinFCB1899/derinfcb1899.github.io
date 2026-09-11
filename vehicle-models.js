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

/** Three recognizable 1980s classics, facing -Z with independent X-axis wheels. */
export function createRetroCar(THREE, accent = '#ff359c', variant = 'countach') {
  if (variant === 'testarossa' || variant === 'boxy') return createTestarossa(THREE, accent);
  if (variant === '959' || variant === 'targa') return createPorsche959(THREE, accent);
  return createCountach(THREE, accent);
}

function classicMaterials(THREE, accent, color) {
  return {
    paint: material(THREE, color, { metalness: 0.43, roughness: 0.31 }),
    dark: material(THREE, '#10121b', { metalness: 0.24, roughness: 0.59 }),
    rubber: material(THREE, '#070910', { metalness: 0.02, roughness: 0.95 }),
    alloy: material(THREE, '#bdc4ce', { metalness: 0.85, roughness: 0.25 }),
    glass: material(THREE, '#13243b', {
      metalness: 0.65, roughness: 0.14, side: THREE.DoubleSide,
      emissive: '#244369', emissiveIntensity: 0.13,
    }),
    trim: glow(THREE, accent, 1.25),
    rearLight: glow(THREE, '#ff273f', 2.35),
    amber: glow(THREE, '#ffad4f', 0.8),
    headLight: glow(THREE, '#e7f2ff', 1.8),
  };
}

// Tires ground at y=0. The wheel group itself rotates around its local X axle.
function classicWheels(THREE, car, m, style, axleZ = 1.46, track = 1.0) {
  const tire = new THREE.CylinderGeometry(0.39, 0.39, 0.30, 20);
  const shoulder = new THREE.TorusGeometry(0.315, 0.08, 6, 20);
  const hub = new THREE.CylinderGeometry(0.255, 0.255, 0.024, 20);
  const lip = new THREE.TorusGeometry(0.257, 0.014, 5, 20);
  const spoke = new THREE.BoxGeometry(0.022, 0.068, 0.178);
  const aperture = new THREE.CylinderGeometry(style === 'countach' ? 0.069 : 0.057, style === 'countach' ? 0.069 : 0.057, 0.017, 8);
  car.userData.wheels = [];
  for (const sign of [-1, 1]) {
    for (const z of [-axleZ, axleZ]) {
      const wheel = new THREE.Group();
      wheel.name = `${z < 0 ? 'Front' : 'Rear'} ${sign < 0 ? 'left' : 'right'} wheel`;
      wheel.position.set(sign * track, 0.395, z);
      mesh(THREE, wheel, tire, m.rubber).rotation.z = Math.PI / 2;
      for (const face of [-1, 1]) {
        mesh(THREE, wheel, shoulder, m.rubber, [face * 0.088, 0, 0]).rotation.y = Math.PI / 2;
      }
      const faceX = sign * 0.166;
      mesh(THREE, wheel, hub, style === 'testarossa' ? m.dark : m.alloy, [faceX, 0, 0]).rotation.z = Math.PI / 2;
      mesh(THREE, wheel, lip, m.alloy, [faceX + sign * 0.015, 0, 0]).rotation.y = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        if (style === 'testarossa') {
          const part = mesh(THREE, wheel, spoke, m.alloy,
            [faceX + sign * 0.024, -Math.sin(angle) * 0.143, Math.cos(angle) * 0.143]);
          part.rotation.x = angle;
        } else {
          // Countach telephone-dial holes and the 959's five-aperture aero alloys.
          mesh(THREE, wheel, aperture, m.dark,
            [faceX + sign * 0.019, Math.sin(angle) * 0.153, Math.cos(angle) * 0.153]).rotation.z = Math.PI / 2;
        }
      }
      mesh(THREE, wheel, new THREE.CylinderGeometry(0.072, 0.072, 0.035, 10), m.alloy,
        [faceX + sign * 0.032, 0, 0]).rotation.z = Math.PI / 2;
      batchSurfaces(THREE, wheel);
      car.add(wheel);
      car.userData.wheels.push(wheel);
    }
  }
}

function finishClassic(THREE, car, m, variant, axleZ = 1.46, track = 1.0) {
  classicWheels(THREE, car, m, variant, axleZ, track);
  car.userData.variant = variant;
  car.userData.forwardAxis = '-Z';
  car.userData.wheelAxis = 'X';
  batchSurfaces(THREE, car);
  return car;
}

/** Outboard body skins have real polygonal wheel openings. */
function classicFlanks(THREE, car, mat, top, { x = 0.99, thickness = 0.115, axle = 1.46, radius = 0.445 } = {}) {
  const contour = [...top, [top[top.length - 1][0], 0.25]];
  for (const z of [axle, -axle]) {
    contour.push([z + radius, 0.25]);
    for (let i = 0; i <= 8; i++) {
      const angle = i * Math.PI / 8;
      contour.push([z + Math.cos(angle) * radius, 0.395 + Math.sin(angle) * radius]);
    }
    contour.push([z - radius, 0.25]);
  }
  contour.push([top[0][0], 0.25]);
  const geometry = profile(THREE, contour, thickness);
  for (const sign of [-1, 1]) mesh(THREE, car, geometry, mat, [sign * x, 0, 0]);
}

function classicExhaust(THREE, car, m, x, z, twin = true) {
  const pipe = new THREE.CylinderGeometry(0.049, 0.049, 0.20, 8);
  const hole = new THREE.CylinderGeometry(0.032, 0.032, 0.012, 8);
  for (const sign of [-1, 1]) {
    for (const offset of twin ? [-0.063, 0.063] : [0]) {
      mesh(THREE, car, pipe, m.alloy, [sign * x + offset, 0.27, z]).rotation.x = Math.PI / 2;
      mesh(THREE, car, hole, m.dark, [sign * x + offset, 0.27, z + 0.106]).rotation.x = Math.PI / 2;
    }
  }
}

function createCountach(THREE, accent) {
  const car = new THREE.Group();
  car.name = 'Lamborghini Countach — yellow wedge and raised rear wing';
  const m = classicMaterials(THREE, accent, '#ffd529');
  mesh(THREE, car, taperedProfile(THREE, [
    [-2.42, 0.26, 0.82], [-2.42, 0.48, 0.86], [-1.97, 0.78, 0.85],
    [-0.97, 0.87, 0.85], [0.78, 0.90, 0.85], [2.34, 0.84, 0.88],
    [2.40, 0.70, 0.88], [2.40, 0.27, 0.84],
  ]), m.paint);
  classicFlanks(THREE, car, m.paint, [
    [-2.42, 0.47], [-2.0, 0.84], [-1.80, 0.90], [-0.98, 0.92],
    [0.52, 0.94], [0.97, 0.98], [1.98, 0.96], [2.40, 0.74],
  ], { x: 0.995, thickness: 0.11 });
  mesh(THREE, car, taperedProfile(THREE, [
    [-1.03, 0.875, 0.89], [-0.42, 1.39, 0.67],
    [0.44, 1.39, 0.67], [1.12, 0.90, 0.87],
  ]), m.paint);
  panel(THREE, car, m.glass, [
    [-0.85, 0.913, -0.995], [0.85, 0.913, -0.995],
    [0.637, 1.366, -0.449], [-0.637, 1.366, -0.449],
  ]);
  panel(THREE, car, m.glass, [
    [-0.635, 1.365, 0.479], [0.635, 1.365, 0.479],
    [0.825, 0.942, 1.075], [-0.825, 0.942, 1.075],
  ]);
  for (const sign of [-1, 1]) {
    panel(THREE, car, m.glass, [
      [sign * 0.88, 0.925, -0.96], [sign * 0.686, 1.35, -0.388],
      [sign * 0.686, 1.35, 0.40], [sign * 0.876, 0.936, 0.98],
    ]);
    // Low split side windows and broad rear intake scoops are Countach signatures.
    beam(THREE, car, m.paint, [sign * 0.839, 1.024, -0.84], [sign * 0.838, 1.024, 0.87], 0.022);
    beam(THREE, car, m.paint, [sign * 0.88, 0.93, 0.17], [sign * 0.68, 1.38, 0.12], 0.025);
    box(THREE, car, m.dark, [0.33, 0.23, 0.43], [sign * 0.886, 1.029, 0.88]);
    box(THREE, car, m.paint, [0.37, 0.055, 0.50], [sign * 0.886, 1.17, 0.89]);
    panel(THREE, car, m.dark, [
      [sign * 1.109, 0.46, 0.44], [sign * 1.109, 0.72, 0.65],
      [sign * 1.109, 0.85, 0.93], [sign * 1.109, 0.45, 0.88],
    ]);
    box(THREE, car, m.dark, [0.033, 0.09, 1.77], [sign * 1.11, 0.31, 0]);
    box(THREE, car, m.trim, [0.021, 0.019, 1.49], [sign * 1.13, 0.375, -0.03]);
    box(THREE, car, m.paint, [0.19, 0.11, 0.24], [sign * 1.015, 0.99, -0.68]);
    beam(THREE, car, m.dark, [sign * 0.63, 0.797, -1.97], [sign * 0.67, 0.877, -1.03], 0.009);
    const cover = box(THREE, car, m.dark, [0.45, 0.018, 0.38], [sign * 0.62, 0.765, -2.04]);
    cover.rotation.x = -0.59;
    const paintCover = box(THREE, car, m.paint, [0.417, 0.019, 0.345], [sign * 0.62, 0.777, -2.04]);
    paintCover.rotation.x = -0.59;
    box(THREE, car, m.headLight, [0.54, 0.085, 0.018], [sign * 0.62, 0.408, -2.437]);
    box(THREE, car, m.amber, [0.16, 0.082, 0.019], [sign * 0.985, 0.408, -2.438]);
  }
  box(THREE, car, m.dark, [1.24, 0.034, 0.93], [0, 0.916, 1.55]);
  for (let i = 0; i < 8; i++) {
    box(THREE, car, m.paint, [1.24, 0.028, 0.028], [0, 0.944, 1.17 + i * 0.108]);
  }
  for (let i = 0; i < 4; i++) {
    const z = 0.57 + i * 0.13;
    const y = 1.39 - (z - 0.44) * 0.72 + 0.018;
    const louver = box(THREE, car, m.dark, [1.36 + (z - 0.44) * 0.51, 0.029, 0.063], [0, y, z]);
    louver.rotation.x = 0.6;
  }
  box(THREE, car, m.dark, [2.04, 0.22, 0.04], [0, 0.59, 2.415]);
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      box(THREE, car, i === 2 ? m.amber : m.rearLight, [0.174, 0.134, 0.021], [sign * (0.45 + i * 0.195), 0.62, 2.447]);
    }
    box(THREE, car, m.paint, [0.09, 0.39, 0.18], [sign * 0.77, 1.067, 1.98]);
  }
  // Raised Countach wing: broad horizontal aerofoil with deep end plates.
  mesh(THREE, car, taperedProfile(THREE, [
    [1.81, 1.245, 1.10], [1.82, 1.30, 1.08],
    [2.16, 1.335, 1.17], [2.22, 1.27, 1.18],
  ]), m.paint);
  for (const sign of [-1, 1]) {
    mesh(THREE, car, profile(THREE, [[1.83, 1.23], [1.83, 1.34], [2.22, 1.37], [2.22, 1.25]], 0.025), m.paint, [sign * 1.16, 0, 0]);
  }
  box(THREE, car, m.trim, [2.22, 0.012, 0.014], [0, 1.285, 2.227]);
  box(THREE, car, m.dark, [2.06, 0.09, 0.16], [0, 0.273, 2.34]);
  box(THREE, car, m.dark, [2.02, 0.075, 0.14], [0, 0.267, -2.38]);
  box(THREE, car, m.alloy, [0.235, 0.045, 0.012], [0, 0.64, 2.443]);
  classicExhaust(THREE, car, m, 0.67, 2.37);
  return finishClassic(THREE, car, m, 'countach');
}

function createTestarossa(THREE, accent) {
  const car = new THREE.Group();
  car.name = 'Ferrari Testarossa — red side strakes and wide rear grille';
  const m = classicMaterials(THREE, accent, '#d92629');
  mesh(THREE, car, taperedProfile(THREE, [
    [-2.40, 0.27, 0.82], [-2.40, 0.59, 0.88], [-1.97, 0.86, 0.85],
    [-0.90, 0.91, 0.86], [0.77, 0.93, 0.87], [2.38, 0.90, 0.90],
    [2.42, 0.73, 0.89], [2.42, 0.28, 0.85],
  ]), m.paint);
  classicFlanks(THREE, car, m.paint, [
    [-2.40, 0.57], [-2.00, 0.89], [-1.15, 0.94], [-0.82, 0.94],
    [0.38, 1.00], [1.91, 1.00], [2.42, 0.91],
  ], { x: 1.005, thickness: 0.135, axle: 1.48 });
  mesh(THREE, car, taperedProfile(THREE, [
    [-0.95, 0.916, 0.88], [-0.43, 1.445, 0.67],
    [0.56, 1.445, 0.67], [1.16, 0.945, 0.85],
  ]), m.paint);
  panel(THREE, car, m.glass, [
    [-0.835, 0.957, -0.922], [0.835, 0.957, -0.922],
    [0.635, 1.417, -0.449], [-0.635, 1.417, -0.449],
  ]);
  // Recessed rear window, framed by substantial flat flying buttresses.
  panel(THREE, car, m.glass, [
    [-0.625, 1.414, 0.596], [0.625, 1.414, 0.596],
    [0.79, 0.985, 1.132], [-0.79, 0.985, 1.132],
  ]);
  for (const sign of [-1, 1]) {
    panel(THREE, car, m.glass, [
      [sign * 0.862, 0.969, -0.866], [sign * 0.685, 1.404, -0.40],
      [sign * 0.685, 1.404, 0.49], [sign * 0.851, 0.979, 1.06],
    ]);
    beam(THREE, car, m.paint, [sign * 0.862, 0.969, 0.27], [sign * 0.687, 1.422, 0.21], 0.026);
    mesh(THREE, car, profile(THREE, [[0.55, 1.438], [0.69, 1.438], [1.60, 1.013], [1.03, 0.94]], 0.09), m.paint, [sign * 0.735, 0, 0]);
    box(THREE, car, m.paint, [0.22, 0.115, 0.29], [sign * 1.012, 1.03, -0.68]);
    // Deep black intakes and five broad horizontal strakes down each flank.
    box(THREE, car, m.dark, [0.025, 0.41, 1.39], [sign * 1.144, 0.692, 0.15]);
    for (let i = 0; i < 5; i++) {
      const length = 1.32 + i * 0.045;
      box(THREE, car, m.paint, [0.078, 0.038, length], [sign * 1.152, 0.511 + i * 0.082, 0.18 - i * 0.018]);
    }
    box(THREE, car, m.dark, [0.032, 0.08, 1.87], [sign * 1.146, 0.31, -0.02]);
    box(THREE, car, m.trim, [0.018, 0.016, 1.47], [sign * 1.167, 0.37, -0.13]);
    // Retracted pop-up lids and rectangular lower driving lights.
    const cover = box(THREE, car, m.dark, [0.50, 0.018, 0.44], [sign * 0.64, 0.84, -1.99]);
    cover.rotation.x = -0.39;
    const paintCover = box(THREE, car, m.paint, [0.466, 0.018, 0.405], [sign * 0.64, 0.851, -1.99]);
    paintCover.rotation.x = -0.39;
    box(THREE, car, m.headLight, [0.51, 0.085, 0.023], [sign * 0.63, 0.458, -2.424]);
    box(THREE, car, m.amber, [0.165, 0.076, 0.022], [sign * 0.987, 0.459, -2.425]);
  }
  box(THREE, car, m.dark, [1.23, 0.033, 0.98], [0, 0.965, 1.73]);
  for (let i = 0; i < 9; i++) {
    box(THREE, car, m.paint, [1.24, 0.031, 0.034], [0, 0.994, 1.31 + i * 0.103]);
  }
  box(THREE, car, m.dark, [2.20, 0.34, 0.035], [0, 0.701, 2.44]);
  for (const sign of [-1, 1]) {
    box(THREE, car, m.rearLight, [0.70, 0.21, 0.025], [sign * 0.691, 0.738, 2.464]);
  }
  // The grille bars run over the rear lamps, a defining Testarossa rear view.
  for (let i = 0; i < 7; i++) {
    box(THREE, car, m.dark, [2.22, 0.022, 0.029], [0, 0.575 + i * 0.046, 2.49]);
  }
  box(THREE, car, m.paint, [2.15, 0.055, 0.105], [0, 0.953, 2.37]);
  box(THREE, car, m.alloy, [0.20, 0.037, 0.012], [0, 0.741, 2.51]);
  box(THREE, car, m.dark, [0.37, 0.115, 0.019], [0, 0.394, 2.44]);
  box(THREE, car, m.alloy, [0.27, 0.065, 0.012], [0, 0.394, 2.456]);
  box(THREE, car, m.dark, [2.18, 0.065, 0.17], [0, 0.275, 2.37]);
  box(THREE, car, m.dark, [2.01, 0.064, 0.17], [0, 0.269, -2.36]);
  box(THREE, car, m.dark, [0.69, 0.098, 0.026], [0, 0.475, -2.427]);
  classicExhaust(THREE, car, m, 0.76, 2.38);
  return finishClassic(THREE, car, m, 'testarossa', 1.48, 1.015);
}

/** Rounded shoulder sections for the 959; faceted so the silhouette stays legible. */
function roundedBody(THREE, sections) {
  const vertices = [];
  const indices = [];
  const ring = ([z, top, halfWidth, bottom = 0.27]) => [
    [-halfWidth * 0.84, bottom, z], [-halfWidth, bottom + 0.12, z],
    [-halfWidth, top - 0.19, z], [-halfWidth * 0.90, top - 0.065, z],
    [-halfWidth * 0.66, top, z], [halfWidth * 0.66, top, z],
    [halfWidth * 0.90, top - 0.065, z], [halfWidth, top - 0.19, z],
    [halfWidth, bottom + 0.12, z], [halfWidth * 0.84, bottom, z],
  ];
  const n = 10;
  for (const section of sections) vertices.push(...ring(section).flat());
  for (let j = 0; j < sections.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n;
      indices.push(a, c, b, b, c, d);
    }
  }
  for (let i = 1; i < n - 1; i++) {
    indices.push(0, i, i + 1);
    const end = (sections.length - 1) * n;
    indices.push(end, end + i + 1, end + i);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function createPorsche959(THREE, accent) {
  const car = new THREE.Group();
  car.name = 'Porsche 959 — silver rounded haunches and integrated rear spoiler';
  const m = classicMaterials(THREE, accent, '#b9c8d3');
  mesh(THREE, car, roundedBody(THREE, [
    [-2.37, 0.64, 0.78], [-2.23, 0.78, 0.86], [-1.82, 0.84, 0.85],
    [-1.05, 0.87, 0.85], [-0.72, 0.91, 0.86], [0.70, 0.94, 0.86],
    [1.32, 1.02, 0.88], [2.04, 1.00, 0.90], [2.39, 0.84, 0.89],
  ]), m.paint);
  classicFlanks(THREE, car, m.paint, [
    [-2.36, 0.57], [-2.13, 0.80], [-1.81, 0.96], [-1.46, 1.00],
    [-1.11, 0.97], [-0.78, 0.88], [0.57, 0.94], [1.03, 1.06],
    [1.52, 1.12], [1.98, 1.06], [2.38, 0.85],
  ], { x: 0.985, thickness: 0.115, axle: 1.46 });
  // Convex fender crowns round off the cut-out flanks without hiding the tires.
  for (const sign of [-1, 1]) {
    for (const z of [-1.46, 1.46]) {
      const fender = mesh(THREE, car, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.paint,
        [sign * 0.907, z < 0 ? 0.92 : 1.01, z]);
      fender.scale.set(0.204, 0.092, 0.53);
    }
  }
  // Arched 911-family roof, raked windscreen and flowing fastback rear glass.
  mesh(THREE, car, taperedProfile(THREE, [
    [-0.98, 0.872, 0.83], [-0.61, 1.23, 0.71], [-0.31, 1.43, 0.61],
    [0.14, 1.485, 0.60], [0.54, 1.40, 0.66], [1.15, 0.95, 0.85],
  ]), m.paint);
  panel(THREE, car, m.glass, [
    [-0.773, 0.929, -0.946], [0.773, 0.929, -0.946],
    [0.587, 1.408, -0.336], [-0.587, 1.408, -0.336],
  ]);
  panel(THREE, car, m.glass, [
    [-0.63, 1.377, 0.563], [0.63, 1.377, 0.563],
    [0.80, 0.991, 1.126], [-0.80, 0.991, 1.126],
  ]);
  for (const sign of [-1, 1]) {
    panel(THREE, car, m.glass, [
      [sign * 0.818, 0.934, -0.862], [sign * 0.629, 1.385, -0.29],
      [sign * 0.627, 1.407, 0.19], [sign * 0.841, 0.968, 0.26],
    ]);
    panel(THREE, car, m.glass, [
      [sign * 0.839, 0.972, 0.35], [sign * 0.638, 1.401, 0.28],
      [sign * 0.677, 1.342, 0.53], [sign * 0.836, 0.981, 1.04],
    ]);
    // Flush body-color mirrors, door handles, and small rear quarter intakes.
    const mirror = mesh(THREE, car, new THREE.SphereGeometry(1, 8, 5), m.paint, [sign * 0.995, 1.005, -0.58]);
    mirror.scale.set(0.145, 0.077, 0.125);
    box(THREE, car, m.dark, [0.025, 0.035, 0.18], [sign * 1.108, 0.865, 0.30]);
    box(THREE, car, m.dark, [0.025, 0.155, 0.23], [sign * 1.108, 0.716, 0.76]);
    for (let i = 0; i < 3; i++) {
      box(THREE, car, m.paint, [0.03, 0.018, 0.235], [sign * 1.128, 0.668 + i * 0.045, 0.76]);
    }
    box(THREE, car, m.dark, [0.026, 0.035, 1.74], [sign * 1.11, 0.49, 0]);
    box(THREE, car, m.trim, [0.018, 0.016, 1.46], [sign * 1.129, 0.382, 0]);
    // The 959's sloped, oval headlamp lenses lie on its raised front fenders.
    const bezel = mesh(THREE, car, new THREE.SphereGeometry(1, 12, 8), m.dark, [sign * 0.77, 0.89, -1.964]);
    bezel.scale.set(0.216, 0.035, 0.262);
    bezel.rotation.x = -0.65;
    const lamp = mesh(THREE, car, new THREE.SphereGeometry(1, 12, 8), m.headLight, [sign * 0.77, 0.914, -1.982]);
    lamp.scale.set(0.183, 0.026, 0.224);
    lamp.rotation.x = -0.65;
    box(THREE, car, m.headLight, [0.25, 0.075, 0.025], [sign * 0.57, 0.441, -2.392]);
    box(THREE, car, m.amber, [0.15, 0.063, 0.025], [sign * 0.819, 0.441, -2.392]);
  }
  box(THREE, car, m.dark, [1.04, 0.025, 0.67], [0, 1.021, 1.53]);
  for (let i = 0; i < 7; i++) {
    box(THREE, car, m.paint, [1.04, 0.025, 0.027], [0, 1.046, 1.24 + i * 0.09]);
  }
  // Integrated loop spoiler: side buttresses grow continuously from the haunches.
  for (const sign of [-1, 1]) {
    mesh(THREE, car, profile(THREE, [
      [1.31, 1.015], [1.73, 1.18], [2.22, 1.20], [2.38, 0.94], [2.28, 0.83],
    ], 0.135), m.paint, [sign * 0.925, 0, 0]);
  }
  mesh(THREE, car, taperedProfile(THREE, [
    [1.80, 1.157, 0.97], [1.88, 1.223, 1.02],
    [2.26, 1.198, 1.06], [2.28, 1.128, 1.055],
  ]), m.paint);
  box(THREE, car, m.dark, [2.08, 0.184, 0.035], [0, 0.706, 2.407]);
  box(THREE, car, m.rearLight, [1.99, 0.111, 0.026], [0, 0.725, 2.43]);
  for (const sign of [-1, 1]) {
    box(THREE, car, m.amber, [0.18, 0.108, 0.025], [sign * 0.9, 0.725, 2.448]);
    box(THREE, car, m.dark, [0.019, 0.12, 0.025], [sign * 0.75, 0.725, 2.45]);
    box(THREE, car, m.dark, [0.25, 0.11, 0.023], [sign * 0.82, 0.441, 2.414]);
  }
  box(THREE, car, m.dark, [2.09, 0.032, 0.06], [0, 0.585, 2.40]);
  box(THREE, car, m.dark, [0.39, 0.127, 0.025], [0, 0.456, 2.416]);
  box(THREE, car, m.alloy, [0.29, 0.073, 0.018], [0, 0.456, 2.437]);
  box(THREE, car, m.dark, [1.86, 0.075, 0.13], [0, 0.273, 2.31]);
  box(THREE, car, m.dark, [1.85, 0.062, 0.13], [0, 0.272, -2.31]);
  box(THREE, car, m.dark, [0.53, 0.10, 0.03], [0, 0.42, -2.391]);
  classicExhaust(THREE, car, m, 0.69, 2.31, false);
  return finishClassic(THREE, car, m, '959', 1.46, 0.99);
}

export function createLightCycle(THREE, accent = '#49edff') {
  const cycle = new THREE.Group();
  cycle.name = 'Lightcycle with crouched rider';
  const armor = material(THREE, '#090f19', { metalness: 0.75, roughness: 0.28 });
  const edgeArmor = material(THREE, '#182735', { metalness: 0.78, roughness: 0.31 });
  const rubber = material(THREE, '#070a0e', { metalness: 0.04, roughness: 0.85 });
  const riderMaterial = material(THREE, '#0c1420', { metalness: 0.22, roughness: 0.49 });
  const luminous = glow(THREE, accent, 3.6);
  const softGlow = glow(THREE, accent, 1.35);
  const visor = material(THREE, accent, {
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
