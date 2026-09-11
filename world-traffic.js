import { createRetroCar, createLightCycle, createRecognizer } from './vehicle-models.js?v=formation6';

// Both themes share one fixed formation on the road's grid axes.
const formation = [
  {x:0, z:10 / 3},
  {x:10 / 3, z:-20 / 3},
  {x:-10 / 3, z:-20 / 3},
];
const cycleColors = ['#51eaff', '#ff962e', '#ffffff'];

export function createTraffic(THREE, scene) {
  const sunset = new THREE.Group();
  sunset.name = 'sunset-traffic';
  const arena = new THREE.Group();
  arena.name = 'tron-arena';
  const cars = [
    createRetroCar(THREE, '#fa258e', 'countach'),
    createRetroCar(THREE, '#ff744b', 'testarossa'),
    createRetroCar(THREE, '#66d9ff', '959'),
  ];
  cars.forEach(car => {
    car.scale.setScalar(.72);
    sunset.add(car);
  });
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const cycles = cycleColors.map(color => createLightCycle(THREE, color));
  cycles.forEach(cycle => arena.add(cycle));
  const recognizers = [createRecognizer(THREE), createRecognizer(THREE)];
  recognizers.forEach(model => arena.add(model));
  recognizers[0].position.set(5, 5, -27);
  recognizers[0].rotation.y = Math.PI - .22;
  recognizers[1].position.set(-12, 7, -88);
  recognizers[1].scale.setScalar(.85);
  recognizers[1].rotation.y = Math.PI + .28;

  const ambient = new THREE.HemisphereLight('#b0e7ff', '#131832', 2.2);
  const key = new THREE.DirectionalLight('#a1e9ff', 3.2);
  key.position.set(-7, 16, 18);
  const rim = new THREE.DirectionalLight('#ff772b', 1.8);
  rim.position.set(9, 5, -15);
  scene.add(sunset, arena, ambient, key, rim);

  const samples = 32;
  function trail(color) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples * 6), 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let i = 0; i < samples - 1; i++) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    geometry.setIndex(indices);
    const wall = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color:'#ffffff', vertexColors:true, transparent:true, opacity:.25, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    wall.frustumCulled = false;
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const edge = new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({ color:'#ffffff', vertexColors:true, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false }));
    edge.frustumCulled = false;
    const tint = new THREE.Color(color);
    const wallColors = new Float32Array(samples * 6);
    const edgeColors = new Float32Array(samples * 3);
    for (let j = 0; j < samples; j++) {
      const fade = 1 - smoothstep(.3, 1, j / (samples - 1));
      for (let component = 0; component < 3; component++) {
        const value = [tint.r, tint.g, tint.b][component] * fade;
        wallColors[j * 6 + component] = wallColors[j * 6 + 3 + component] = value;
        edgeColors[j * 3 + component] = value;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(wallColors,3));
    edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors,3));
    arena.add(wall, edge);
    return {wall, edge};
  }
  const trails = cycleColors.map(trail);
  function setTheme(light) {
    sunset.visible = light;
    arena.visible = !light;
    ambient.color.set(light ? '#ffe3a0' : '#9dc8e2');
    ambient.groundColor.set(light ? '#863968' : '#081f30');
    key.color.set(light ? '#ffe0a0' : '#83d8ff');
    key.intensity = light ? 3.4 : 2.6;
    rim.color.set(light ? '#ff489a' : '#ff852e');
  }
  function update(time, compact) {
    if (sunset.visible) {
      cars.forEach((car, i) => {
        const {x, z} = formation[i];
        car.position.set(x, -5, z);
        car.rotation.y = 0;
        car.userData.wheels?.forEach(wheel => { wheel.rotation.x = -time * 7; });
      });
    }
    if (arena.visible) {
      cycles.forEach((cycle, i) => {
        const {x, z} = formation[i];
        cycle.position.set(x, -5, z);
        cycle.rotation.y = 0;
        cycle.rotation.z = Math.sin(time * .72 + i * 1.8) * .04;
        cycle.userData.wheels?.forEach(wheel => { wheel.rotation.x = -time * 10; });
        const wall = trails[i].wall.geometry.attributes.position;
        const edge = trails[i].edge.geometry.attributes.position;
        for (let j = 0; j < samples; j++) {
          // Straight light walls stay on the grid axes. Body lean never bends them.
          const trailZ = z + 1.48 + j * .9;
          wall.setXYZ(j * 2, x, -4.98, trailZ);
          wall.setXYZ(j * 2 + 1, x, -4.23, trailZ);
          edge.setXYZ(j, x, -4.23, trailZ);
        }
        wall.needsUpdate = edge.needsUpdate = true;
      });
      recognizers[0].position.y = 5 + Math.sin(time * .3) * .35;
      recognizers[0].position.x = (compact ? 0 : 5) + Math.sin(time * .13) * (compact ? .3 : 1.2);
      recognizers[0].scale.setScalar(compact ? .85 : 1);
      recognizers[1].position.y = 7 + Math.sin(time * .24 + 2) * .4;
      recognizers[1].visible = !compact;
    }
  }
  return {setTheme, update};
}
