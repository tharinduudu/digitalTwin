import * as THREE from './vendor/three.module.js';

// Coordinates are taken from the rectangular recess in the supplied holder.
export function tilePoint(x, y, z, height) {
  return new THREE.Vector3((x - 100) / 10, height + (z - 5) / 10, -(y - 100) / 10);
}

export function fibreCurve(data, height) {
  const face = 19.021;
  const points = [tilePoint(face - 0.35, face + 0.35, 8.5, height),
    ...data.points_mm.map(p => tilePoint(...p, height)),
    tilePoint(face + 0.35, face - 0.35, 8.5, height)];
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

export class FibreLight {
  constructor(curve, radius) {
    this.curve = curve;
    this.samples = curve.getSpacedPoints(160);
    this.origin = 0.5;
    this.phase = 2;
    this.core = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, radius, 6, false),
      new THREE.MeshStandardMaterial({ color: '#65b631', emissive: '#29ff39',
        emissiveIntensity: 0.12, roughness: 0.35 }));
    this.glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, radius * 2.5, 6, false),
      new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { heads: { value: new THREE.Vector2(-1, 2) } },
        vertexShader: `varying float along;
          void main() { along = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying float along; uniform vec2 heads;
          float packet(float head) {
            if (head < 0.0 || head > 1.0) return 0.0;
            return exp(-pow((along - head) / 0.035, 2.0));
          }
          void main() { float light = max(packet(heads.x), packet(heads.y));
            gl_FragColor = vec4(0.12, 1.0, 0.18, light * 0.85); }` }));
    this.glow.renderOrder = 5;
  }

  excite(point) {
    let nearest = 0, distance = Infinity;
    this.samples.forEach((sample, index) => {
      const next = sample.distanceToSquared(point);
      if (next < distance) { distance = next; nearest = index; }
    });
    this.origin = nearest / (this.samples.length - 1);
    this.phase = 0;
  }

  update(dt, visible) {
    // Light propagation is slowed down for the exhibition, not a timing measurement.
    this.phase += dt / 1.3;
    const active = this.phase < Math.max(this.origin, 1 - this.origin);
    this.glow.material.uniforms.heads.value.set(this.origin - this.phase, this.origin + this.phase);
    this.core.material.emissiveIntensity = 0.12 + (active ? 0.7 : 0);
    this.core.visible = visible;
    this.glow.visible = visible && active;
  }
}
