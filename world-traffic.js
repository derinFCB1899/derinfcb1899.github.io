import { createRetroCar, createLightCycle, createRecognizer } from './vehicle-models.js';

// Vehicle paths and light walls live in the same 3D coordinates as the road.
export function createTraffic(THREE, scene) {
  const sunset = new THREE.Group();
  sunset.name = 'sunset-traffic';
  const arena = new THREE.Group();
  arena.name = 'tron-arena';
  const cars = [createRetroCar(THREE, '#fa258e'), createRetroCar(THREE, '#6d38e0')];
  cars.forEach(car => { car.scale.setScalar(1.35); sunset.add(car); });
  const cycles = [createLightCycle(THREE, '#51eaff'), createLightCycle(THREE, '#ff962e')];
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
    const wall = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.25, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    wall.frustumCulled = false;
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(samples * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const edge = new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({ color, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false }));
    edge.frustumCulled = false;
    arena.add(wall, edge);
    return {wall, edge};
  }
  const trails = [trail('#38deff'), trail('#ff8c29')];
  const sparksGeometry = new THREE.BufferGeometry();
  sparksGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const sparks = new THREE.Points(sparksGeometry, new THREE.PointsMaterial({color:'#bff7ff',size:.14,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  sparks.frustumCulled = false;
  arena.add(sparks);

  function cyclePose(phase, side) {
    if (phase < .43) return { x:side * (16 - phase / .43 * 14.4), z:5, angle:side * Math.PI / 2 };
    const turn = (phase - .43) / .57;
    return { x:side * (1.6 + Math.sin(turn * Math.PI) * 5), z:5 - turn * 90, angle:side * Math.PI / 2 * Math.max(0, 1 - turn * 5) };
  }
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
        const phase = (time / 22 + i * .49 + .09) % 1;
        car.position.set(i === 0 ? (compact ? .8 : 2.6) : -3.3, -5, 15 - phase * 105);
        car.rotation.y = -.13 + Math.sin(time * .25 + i) * .035;
        car.rotation.z = Math.sin(time * 1.8 + i) * .006;
        car.userData.wheels?.forEach(wheel => { wheel.rotation.x = -time * 7; });
      });
    }
    if (arena.visible) {
      const phase = (time / 13 + .18) % 1;
      cycles.forEach((cycle, i) => {
        const side = i === 0 ? -1 : 1;
        const pose = cyclePose(phase, side);
        cycle.position.set(pose.x, -5, pose.z);
        cycle.rotation.y = pose.angle;
        cycle.rotation.z = phase > .43 && phase < .57 ? side * -.18 * Math.sin((phase - .43) / .14 * Math.PI) : 0;
        cycle.userData.wheels?.forEach(wheel => { wheel.rotation.x = -time * 10; });
        const wall = trails[i].wall.geometry.attributes.position;
        const edge = trails[i].edge.geometry.attributes.position;
        for (let j = 0; j < samples; j++) {
          const previous = cyclePose(Math.max(0, phase - j * .006), side);
          const x = previous.x + Math.sin(previous.angle) * 1.45;
          const z = previous.z + Math.cos(previous.angle) * 1.45;
          const height = .9 * (1 - j / samples);
          wall.setXYZ(j * 2, x, -4.98, z);
          wall.setXYZ(j * 2 + 1, x, -4.98 + height, z);
          edge.setXYZ(j, x, -4.98 + height, z);
        }
        wall.needsUpdate = edge.needsUpdate = true;
      });
      const collision = Math.max(0, 1 - Math.abs(phase - .43) / .055);
      sparks.material.opacity = collision * .75;
      const particles = sparksGeometry.attributes.position;
      for (let i = 0; i < 24; i++) {
        const angle = i * 2.39996;
        const radius = (1 - collision) * 2.2;
        particles.setXYZ(i, Math.cos(angle) * radius, -4.1 + Math.sin(angle * 2) * radius * .55, 5 + Math.sin(angle) * radius);
      }
      particles.needsUpdate = true;
      recognizers[0].position.y = 5 + Math.sin(time * .3) * .35;
      recognizers[0].position.x = (compact ? 0 : 5) + Math.sin(time * .13) * (compact ? .3 : 1.2);
      recognizers[0].scale.setScalar(compact ? .85 : 1);
      recognizers[1].position.y = 7 + Math.sin(time * .24 + 2) * .4;
      recognizers[1].visible = !compact;
    }
  }
  return {setTheme, update};
}
