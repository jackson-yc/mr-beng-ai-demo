import * as T from './vendor/three.module.min.js';

const ROLE_INFO = [
  ['sales', 'Sales floor', '01', -4.7, 4.6, '#3ba99a'],
  ['finance', 'Finance', '02', 6.0, -2.6, '#d4a66b'],
  ['ads', 'Creative studio', '03', -7.4, -3.3, '#3ba99a'],
  ['owner', 'Owner’s office', '04', 0.0, -3.7, '#d4a66b'],
  ['human', 'Human handoff', '05', 7.4, 4.4, '#3ba99a'],
];

/** Headless-safe procedural model. No renderer, network, or animation required.
 * Returns {group, cars: Group[3], roles: {id,label,group,anchor,ring}[], dispose()}.
 * All geometry coordinates stay within a 22 × 14 footprint, floor surface y=0.
 */
export function buildShowroom(T, scene) {
  const group = new T.Group();
  group.name = 'MR BENG — fictional demonstration';
  scene.add(group);
  const geometryCache = new Map();
  const materials = new Set();
  const textures = new Set();
  const batches = new Map();
  const instances = new Set();
  const cars = [];
  const roles = [];
  let disposed = false;
  const material = (color, options = {}) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.65, ...options });
    materials.add(m);
    return m;
  };
  const M = {
    ivory: material('#f2eee4'), wall: material('#e5dfd0'), tile: material('#d6d8d3'),
    grout: material('#afb9b5'), wood: material('#b18760'), woodLight: material('#c7a17a'),
    woodDark: material('#8b6547'), navy: material('#172c34'), teal: material('#3ba99a'),
    tealDark: material('#21655d'), amber: material('#d4a66b'), black: material('#20272b'),
    rubber: material('#202629', { roughness: 0.95 }), chrome: material('#a5b4b7', { metalness: 0.82, roughness: 0.25 }),
    paleMetal: material('#e0e4df', { metalness: 0.45, roughness: 0.3 }),
    green: material('#3e7653'), leaf: material('#699465'), soil: material('#574b3d'),
    lamp: material('#ffdfad', { emissive: '#ffce8d', emissiveIntensity: 0.65 }),
    screen: material('#102e37', { emissive: '#163c45', emissiveIntensity: 0.25 }),
    led: material('#a8ece0', { emissive: '#7ee5ce', emissiveIntensity: 0.5 }),
    glass: material('#9dc0bd', { transparent: true, opacity: 0.23, roughness: 0.15, metalness: 0.05, depthWrite: false, side: T.DoubleSide }),
    window: material('#253e48', { metalness: 0.45, roughness: 0.18 }),
    red: material('#b75443', { emissive: '#7c3025', emissiveIntensity: 0.25 }),
  };
  const geo = (key, make) => {
    if (!geometryCache.has(key)) geometryCache.set(key, make());
    return geometryCache.get(key);
  };
  const boxGeo = geo('box', () => new T.BoxGeometry(1, 1, 1));
  const sphereGeo = geo('sphere', () => new T.SphereGeometry(1, 12, 8));
  const cylGeo = geo('cylinder', () => new T.CylinderGeometry(1, 1, 1, 20));
  const dummy = new T.Object3D();
  function mesh(g, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = group, rotation = [0, 0, 0], name = '') {
    const m = new T.Mesh(g, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(...rotation);
    m.castShadow = !mat.transparent; m.receiveShadow = !mat.transparent;
    m.name = name; parent.add(m); return m;
  }
  function box(mat, x, y, z, w, h, d, parent = group, rotation, name) {
    return mesh(boxGeo, mat, x, y, z, w, h, d, parent, rotation, name);
  }
  function sphere(mat, x, y, z, sx, sy, sz, parent = group) {
    return mesh(sphereGeo, mat, x, y, z, sx, sy, sz, parent);
  }
  function cylinder(mat, x, y, z, radius, height, parent = group, rotation) {
    return mesh(cylGeo, mat, x, y, z, radius, height, radius, parent, rotation);
  }
  function roundedGeo(w, h, d, radius = 0.1) {
    const r = Math.min(radius, w / 2, h / 2, d / 2);
    return geo(`rounded:${w}:${h}:${d}:${r}`, () => {
      const g = new T.BoxGeometry(w, h, d, 5, 5, 5);
      const position = g.attributes.position;
      const p = new T.Vector3(); const q = new T.Vector3();
      const core = new T.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i);
        q.set(T.MathUtils.clamp(p.x, -core.x, core.x), T.MathUtils.clamp(p.y, -core.y, core.y), T.MathUtils.clamp(p.z, -core.z, core.z));
        p.sub(q).normalize().multiplyScalar(r).add(q);
        position.setXYZ(i, p.x, p.y, p.z);
      }
      g.computeVertexNormals(); return g;
    });
  }
  function soft(mat, x, y, z, w, h, d, radius = 0.1, parent = group, name = '') {
    return mesh(roundedGeo(w, h, d, radius), mat, x, y, z, 1, 1, 1, parent, [0, 0, 0], name);
  }
  // Opaque repeated slats, legs, leaves, tiles and desk accessories share batches.
  function batch(g, mat, x, y, z, sx, sy, sz, rotation = [0, 0, 0]) {
    const key = `${g.uuid}:${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry: g, material: mat, transforms: [] });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(...rotation); dummy.updateMatrix();
    batches.get(key).transforms.push(dummy.matrix.clone());
  }
  const b = (mat, x, y, z, w, h, d, rotation) => batch(boxGeo, mat, x, y, z, w, h, d, rotation);
  function sign(text, sub, x, y, z, w, h, parent = group, color = '#172c34') {
    let mat = M.ivory;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f2eee4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.round(canvas.height * (sub ? 0.28 : 0.43))}px system-ui, sans-serif`;
        ctx.fillText(text, canvas.width / 2, canvas.height * (sub ? 0.39 : 0.51), canvas.width * 0.9);
        if (sub) { ctx.fillStyle = '#d4a66b'; ctx.font = `500 ${Math.round(canvas.height * 0.14)}px system-ui, sans-serif`; ctx.fillText(sub, canvas.width / 2, canvas.height * 0.75, canvas.width * 0.9); }
        const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
        textures.add(texture); mat = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }); materials.add(mat);
      }
    }
    const board = box(M.woodDark, x, y, z - 0.035, w + 0.07, h + 0.07, 0.09, parent);
    const face = mesh(geo('plane', () => new T.PlaneGeometry(1, 1)), mat, x, y, z + 0.018, w, h, 1, parent);
    face.name = `sign:${text}`; face.castShadow = false;
    return board;
  }
  function plant(x, z, scale = 1) {
    cylinder(M.ivory, x, 0.25 * scale, z, 0.32 * scale, 0.5 * scale);
    cylinder(M.soil, x, 0.508 * scale, z, 0.27 * scale, 0.025);
    batch(cylGeo, M.woodDark, x, 0.91 * scale, z, 0.035 * scale, 0.85 * scale, 0.035 * scale);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.399; const level = 0.85 + (i % 4) * 0.18;
      batch(sphereGeo, i % 2 ? M.green : M.leaf, x + Math.cos(a) * 0.25 * scale, level * scale, z + Math.sin(a) * 0.25 * scale, 0.16 * scale, 0.38 * scale, 0.105 * scale, [Math.sin(a) * 0.6, a, Math.cos(a) * 0.65]);
    }
  }
  function chair(x, z, rotation = 0, upholstery = M.tealDark) {
    const c = new T.Group(); c.position.set(x, 0, z); c.rotation.y = rotation; group.add(c);
    soft(upholstery, 0, 0.54, 0, 0.73, 0.16, 0.72, 0.07, c);
    soft(upholstery, 0, 0.94, -0.29, 0.73, 0.7, 0.13, 0.06, c);
    for (const side of [-1, 1]) {
      box(M.wood, side * 0.38, 0.79, 0, 0.09, 0.09, 0.65, c);
      for (const end of [-1, 1]) {
        const xx = side * 0.27; const zz = end * 0.25;
        b(M.woodDark, x + xx * Math.cos(rotation) + zz * Math.sin(rotation), 0.25, z - xx * Math.sin(rotation) + zz * Math.cos(rotation), 0.07, 0.5, 0.07);
      }
    }
  }
  function monitor(x, z, y = 1.45) {
    soft(M.navy, x, y, z, 0.93, 0.57, 0.065, 0.04);
    box(M.screen, x, y, z + 0.039, 0.83, 0.47, 0.012);
    cylinder(M.chrome, x, y - 0.35, z, 0.035, 0.23);
    soft(M.navy, x, y - 0.47, z + 0.03, 0.38, 0.025, 0.24, 0.01);
    for (let i = 0; i < 4; i++) b(i === 0 ? M.teal : M.ivory, x - 0.12, y + 0.12 - i * 0.075, z + 0.05, 0.43 - i * 0.06, 0.022, 0.008);
    for (let i = 0; i < 3; i++) b(M.amber, x + 0.28, y - 0.1 + i * 0.06, z + 0.05, 0.055, 0.07 + i * 0.04, 0.008);
  }
  function desk(x, z, width = 2.65) {
    soft(M.woodLight, x, 0.95, z, width, 0.14, 1.12, 0.045);
    for (const side of [-1, 1]) {
      soft(M.ivory, x + side * (width / 2 - 0.3), 0.47, z, 0.42, 0.86, 0.85, 0.03);
      for (let i = 0; i < 3; i++) b(M.woodDark, x + side * (width / 2 - 0.3), 0.32 + i * 0.21, z + 0.43, 0.15, 0.025, 0.025);
    }
    monitor(x - 0.25, z - 0.2);
    soft(M.navy, x - 0.25, 1.035, z + 0.25, 0.7, 0.025, 0.24, 0.01);
    b(M.ivory, x + 0.75, 1.04, z + 0.1, 0.32, 0.018, 0.39, [0, -0.18, 0]);
    cylinder(M.amber, x + 0.85, 1.14, z - 0.26, 0.09, 0.24);
    for (let i = 0; i < 3; i++) b(M.navy, x + 0.8 + i * 0.04, 1.29, z - 0.26, 0.018, 0.2, 0.018);
  }

  // A single slab and continuous circulation, rather than disconnected room cards.
  soft(M.navy, 0, -0.28, 0, 22, 0.55, 14, 0.18);
  box(M.grout, 0, -0.035, 0, 21.75, 0.07, 13.75);
  for (let ix = 0; ix < 18; ix++) for (let iz = 0; iz < 11; iz++) {
    b((ix + iz) % 7 === 0 ? M.ivory : M.tile, -10.26 + ix * 1.207, 0.009, -6.23 + iz * 1.245, 1.186, 0.018, 1.224);
  }
  box(M.woodDark, 0, 0.035, -4.65, 21.6, 0.06, 4.25);
  for (let i = 0; i < 58; i++) b(i % 3 ? M.woodLight : M.wood, -10.61 + i * 0.372, 0.075, -4.65, 0.36, 0.025, 4.22);
  box(M.woodDark, 7.35, 0.04, 3.3, 6.0, 0.07, 5.9);
  for (let i = 0; i < 16; i++) b(i % 3 ? M.woodLight : M.wood, 4.55 + i * 0.372, 0.085, 3.3, 0.36, 0.022, 5.85);
  b(M.amber, 0, 0.035, -2.5, 21.6, 0.018, 0.045);
  b(M.amber, 4.31, 0.06, 3.3, 0.045, 0.02, 5.9);
  // Back wall, warm vertical wood rhythm and a shallow left cutaway wall.
  box(M.wall, 0, 1.8, -6.83, 21.8, 3.6, 0.24);
  box(M.ivory, -10.83, 0.73, 0, 0.22, 1.46, 13.5);
  box(M.woodDark, 0, 0.12, -6.65, 21.7, 0.18, 0.08);
  for (let i = 0; i < 24; i++) b(i % 3 ? M.wood : M.woodLight, -3.65 + i * 0.3, 1.8, -6.65, 0.14, 3.45, 0.14);
  sign('MR BENG', 'A BETTER WAY TO MOVE · DEMONSTRATION', -0.2, 2.75, -6.48, 5.7, 1.0);
  sign('CREATIVE STUDIO', 'IDEAS → YOUR NEXT JOURNEY', -7.1, 2.95, -6.65, 4.25, 0.62);
  sign('FINANCE & CARE', 'CONVERSATIONS, NOT COMPLICATIONS', 6.9, 2.95, -6.65, 4.2, 0.62);
  for (const x of [-9.6, -4.5, 3.7, 10]) {
    box(M.woodDark, x, 2.6, -6.56, 0.12, 0.55, 0.17);
    box(M.lamp, x, 2.6, -6.45, 0.1, 0.4, 0.035);
  }
  // Partial glass walls remain individually transparent, never opaque instances.
  function glassWall(x, z, length, alongZ = false) {
    box(M.glass, x, 0.75, z, alongZ ? 0.04 : length, 1.4, alongZ ? length : 0.04);
    b(M.paleMetal, x, 1.46, z, alongZ ? 0.045 : length, 0.045, alongZ ? length : 0.045);
    for (const s of [-1, 1]) b(M.chrome, x + (alongZ ? 0 : s * length / 2), 0.75, z + (alongZ ? s * length / 2 : 0), 0.05, 1.5, 0.05);
  }
  glassWall(3.7, -4.52, 4.1, true); glassWall(8.5, -2.45, 4.25);
  glassWall(-4.25, -4.58, 3.95, true);
  glassWall(10.75, 2.1, 6.3, true);

  // Rear departments: creative studio, owner workspace, finance consultation.
  desk(-7.5, -5.05, 2.8); chair(-7.5, -5.98); chair(-8.9, -3.65, -0.2, M.ivory);
  soft(M.ivory, -5.15, 0.83, -5.0, 1.0, 1.55, 0.7, 0.08);
  sign('CAMPAIGN', 'DEMO STORYBOARD', -5.15, 1.7, -4.61, 1.2, 0.9, group, '#3c6d68');
  for (const x of [-9.75, -5.2]) {
    cylinder(M.navy, x, 0.85, -3.9, 0.032, 1.7);
    for (let i = 0; i < 3; i++) b(M.navy, x + Math.cos(i * 2.094) * 0.2, 0.15, -3.9 + Math.sin(i * 2.094) * 0.2, 0.045, 0.32, 0.045, [0.45, i * 2.094, 0]);
    const light = cylinder(M.ivory, x, 1.95, -3.9, 0.37, 0.08, group, [Math.PI / 2, 0, 0]);
    light.name = 'studio-softbox';
    cylinder(M.lamp, x, 1.95, -3.845, 0.31, 0.025, group, [Math.PI / 2, 0, 0]);
  }
  desk(-0.2, -5.1, 3.6); chair(-0.25, -6.05, 0, M.navy);
  chair(-1.4, -3.7, Math.PI, M.ivory); chair(1.3, -3.7, Math.PI, M.ivory);
  soft(M.wood, 2.65, 0.6, -5.8, 1.0, 1.2, 1.0, 0.04);
  for (let i = 0; i < 5; i++) b(i % 2 ? M.teal : M.ivory, 2.28 + i * 0.16, 1.36, -5.8, 0.105, 0.32 + i % 2 * 0.1, 0.4);
  desk(6.9, -5.0, 3.1); chair(6.8, -6.0, 0, M.navy);
  chair(5.6, -3.7, Math.PI, M.ivory); chair(8.0, -3.7, Math.PI, M.ivory);
  soft(M.ivory, 9.9, 0.63, -5.25, 1.15, 1.2, 1.6, 0.07);
  for (let i = 0; i < 4; i++) b(M.amber, 9.9, 0.35 + i * 0.23, -4.44, 0.25, 0.035, 0.035);
  plant(-10, -6.0, 1.1); plant(3.0, -2.8, 0.82); plant(10.0, -2.9, 1.0);

  function cabinGeometry(suv) {
    return geo(`cabin:${suv}`, () => {
      const h = suv ? 1.83 : 1.62;
      const points = [ [-0.84,1.01,-1.25],[0.84,1.01,-1.25],[0.84,1.01,0.88],[-0.84,1.01,0.88], [-0.69,h,-0.94],[0.69,h,-0.94],[0.69,h,0.22],[-0.69,h,0.22] ];
      const indices = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
    });
  }
  function quad(points, mat, parent, name) {
    const key = `quad:${points.flat().join(',')}`;
    const g = geo(key, () => {
      const v = new T.BufferGeometry(); v.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3)); v.setIndex([0,2,1,0,3,2]); v.computeVertexNormals(); return v;
    });
    return mesh(g, mat, 0,0,0,1,1,1,parent,[0,0,0],name);
  }
  function car(x, z, color, style, angle) {
    const c = new T.Group(); c.name = `Generic ${style} — demo vehicle`; c.userData.kind = 'car'; c.position.set(x,0.07,z); c.rotation.y = angle; group.add(c); cars.push(c);
    const paint = material(color, { metalness: 0.42, roughness: 0.27 });
    const suv = style === 'crossover'; const roof = suv ? 1.83 : 1.62;
    soft(M.black, 0,0.38,0,1.77,0.25,3.75,0.12,c,'undercarriage');
    soft(paint,0,0.72,0,1.94,0.57,4.03,0.22,c,'chassis');
    soft(paint,0,1.00,1.29,1.8,0.2,1.17,0.1,c,'bonnet');
    soft(paint,0,1.00,-1.59,1.82,0.19,0.67,0.09,c,'rear-deck');
    mesh(cabinGeometry(suv),paint,0,0,0,1,1,1,c,[0,0,0],'cabin');
    // Separate glass panels leave visible painted pillars and a roof.
    const frontZ = y => 0.88 - (y - 1.01) / (roof - 1.01) * 0.66 + 0.016;
    const rearZ = y => -1.25 + (y - 1.01) / (roof - 1.01) * 0.31 - 0.016;
    quad([[-0.65,roof-0.065,frontZ(roof-0.065)],[0.65,roof-0.065,frontZ(roof-0.065)],[0.79,1.08,frontZ(1.08)],[-0.79,1.08,frontZ(1.08)]],M.window,c,'windshield');
    quad([[-0.65,roof-0.06,rearZ(roof-0.06)],[-0.79,1.09,rearZ(1.09)],[0.79,1.09,rearZ(1.09)],[0.65,roof-0.06,rearZ(roof-0.06)]],M.window,c,'rear-window');
    for (const side of [-1,1]) {
      const sideX = y => side * (0.84 - (y - 1.01) / (roof - 1.01) * 0.15 + 0.014);
      const xb=sideX(1.09), xt=sideX(roof-0.08);
      // Winding differs by side; both sides are explicitly visible.
      const sideMat = M.window;
      const rear = [[xb,1.09,-1.16],[xb,1.09,-0.42],[xt,roof-0.08,-0.42],[xt,roof-0.08,-0.90]];
      const front = [[xb,1.09,-0.34],[xb,1.09,0.75],[xt,roof-0.08,0.17],[xt,roof-0.08,-0.34]];
      if (side < 0) { rear.reverse(); front.reverse(); }
      quad(rear,sideMat,c,`side-window-${side}-rear`); quad(front,sideMat,c,`side-window-${side}-front`);
      box(M.chrome,side*0.963,0.84,0.1,0.025,0.035,0.24,c);
      box(M.chrome,side*0.963,0.84,-0.92,0.025,0.035,0.24,c);
      box(M.black,side*0.975,0.64,-0.41,0.012,0.37,0.018,c);
      box(M.chrome,side*0.97,0.47,0,0.025,0.05,2.9,c);
      soft(paint,side*1.02,1.1,0.64,0.24,0.17,0.29,0.07,c,side<0?'mirror-left':'mirror-right');
      box(M.window,side*1.025,1.11,0.495,0.17,0.1,0.018,c);
      for (const axle of [-1.22,1.23]) {
        const tire = cylinder(M.rubber,side*0.94,0.43,axle,0.425,0.28,c,[0,0,Math.PI/2]); tire.userData.kind='tire'; tire.name='tire';
        cylinder(M.chrome,side*1.09,0.43,axle,0.292,0.025,c,[0,0,Math.PI/2]);
        cylinder(M.navy,side*1.107,0.43,axle,0.235,0.03,c,[0,0,Math.PI/2]);
        for(let spoke=0;spoke<5;spoke++) box(M.chrome,side*1.13,0.43,axle,0.03,0.055,0.47,c,[spoke*Math.PI/5,0,0]);
        cylinder(M.paleMetal,side*1.14,0.43,axle,0.075,0.04,c,[0,0,Math.PI/2]);
      }
      soft(M.lamp,side*0.64,0.88,1.984,0.47,0.12,0.065,0.025,c,'headlight');
      soft(M.red,side*0.65,0.85,-1.99,0.44,0.12,0.06,0.025,c,'taillight');
      box(M.chrome,side*0.64,0.4,-1.95,0.23,0.08,0.1,c);
    }
    soft(M.navy,0,0.65,1.994,1.0,0.29,0.06,0.045,c,'grille');
    for(let i=0;i<6;i++) box(M.chrome,-0.4+i*0.16,0.65,2.033,0.023,0.2,0.015,c);
    soft(M.ivory,0,0.41,2.017,0.45,0.10,0.035,0.01,c,'blank-plate');
    box(M.chrome,0,0.46,1.97,1.65,0.045,0.045,c);
    if (suv) for(const side of [-1,1]) soft(M.chrome,side*0.59,roof+0.04,-0.35,0.045,0.045,1.3,0.02,c,'roof-rail');
    return c;
  }
  // Three vehicles occupy a connected polished display floor.
  for(const [x,z] of [[-7.6,0.8],[-3.85,0.5],[-0.05,0.9]]) {
    soft(M.ivory,x,0.045,z,3.05,0.07,5.15,0.25);
    for(const side of [-1,1]) b(M.amber,x+side*1.39,0.09,z,0.025,0.018,4.35);
  }
  car(-7.6,0.8,'#e6e1d4','crossover',0.045);
  car(-3.85,0.5,'#3c807d','touring',-0.045);
  car(-0.05,0.9,'#b87553','sport',0.06);
  for (const [x,z,label] of [[-9.2,3.25,'01 / CROSSOVER'],[-5.5,3.1,'02 / TOURING'],[-1.7,3.45,'03 / SPORT']]) {
    cylinder(M.navy,x,0.42,z,0.035,0.8);
    soft(M.navy,x,0.065,z,0.38,0.06,0.38,0.05);
    const board = new T.Group(); board.position.set(x,0.9,z); board.rotation.x=-0.25; group.add(board);
    sign(label,'DEMO COLLECTION',0,0,0,0.95,0.44,board);
  }
  sign('CURATED. CONNECTED. PERSONAL.', 'MR BENG · FICTIONAL SHOWROOM',-6.0,0.58,6.5,6.1,0.69);
  // Open reception, hospitality and a lounge: detailed rather than empty zones.
  soft(M.ivory,7.35,0.58,2.6,3.65,1.08,1.25,0.2);
  soft(M.woodDark,7.35,1.15,2.6,3.86,0.16,1.42,0.08);
  for(let i=0;i<18;i++) b(M.wood,5.72+i*0.19,0.61,3.225,0.075,0.91,0.04);
  sign('HELLO, MR BENG','A HUMAN IS ALWAYS PART OF THE PICTURE',7.35,0.65,3.26,2.75,0.57);
  monitor(7.75,2.25,1.65); chair(7.5,1.4,0,M.navy);
  cylinder(M.amber,5.9,1.28,2.6,0.12,0.22);
  soft(M.ivory,5.6,0.4,5.6,1.75,0.4,1.0,0.14);
  soft(M.tealDark,5.6,0.68,5.64,1.76,0.22,1.0,0.12);
  soft(M.tealDark,5.6,1.01,6.0,1.76,0.64,0.22,0.1);
  for(const x of [4.8,6.4]) soft(M.tealDark,x,0.9,5.6,0.2,0.54,0.95,0.08);
  for(const x of [5.05,6.15]) b(M.woodDark,x,0.19,5.6,0.09,0.29,0.68);
  cylinder(M.woodDark,7.3,0.33,5.85,0.51,0.07); cylinder(M.navy,7.3,0.16,5.85,0.045,0.28);
  b(M.ivory,7.3,0.38,5.85,0.36,0.035,0.28,[0,0.3,0]);
  soft(M.wood,9.8,0.54,0.1,1.25,1.05,1.0,0.06);
  soft(M.navy,9.8,1.28,0.1,0.5,0.4,0.45,0.05);
  cylinder(M.ivory,9.65,1.12,0.42,0.07,0.13);
  sign('TAKE A MOMENT','COFFEE & CONVERSATION',9.8,1.85,-0.35,1.6,0.5);
  plant(10,5.85,1.25); plant(4.7,1.0,0.9); plant(-9.7,5.3,1.05);
  // Elegant freestanding light arch at reception; open roof keeps cutaway clear.
  for(const x of [4.5,10.35]) cylinder(M.woodDark,x,1.8,0.8,0.055,3.6);
  box(M.woodDark,7.425,3.58,0.8,5.96,0.12,0.14);
  box(M.lamp,7.425,3.505,0.8,5.65,0.025,0.09);

  function robot(id,label,number,x,z,color) {
    const staff = new T.Group(); staff.position.set(x,0.08,z); staff.name=`${label} · demo assistant`; staff.userData.roleId=id; group.add(staff);
    const accent = color === '#d4a66b' ? M.amber : M.teal;
    cylinder(M.navy,0,0.08,0,0.34,0.12,staff);
    for(const side of [-1,1]) {
      soft(M.navy,side*0.15,0.21,0.025,0.22,0.27,0.25,0.06,staff);
      soft(M.ivory,side*0.19,0.095,0.12,0.28,0.12,0.4,0.06,staff);
      sphere(M.chrome,side*0.4,0.83,0,0.12,0.12,0.12,staff);
      const arm=soft(M.ivory,side*0.47,0.65,0.04,0.19,0.38,0.21,0.08,staff);arm.rotation.z=side*0.22;
      sphere(accent,side*0.5,0.46,0.06,0.12,0.12,0.12,staff);
    }
    soft(M.ivory,0,0.68,0,0.7,0.66,0.45,0.16,staff);
    soft(accent,0,0.75,0.231,0.38,0.21,0.025,0.04,staff);
    box(M.ivory,0,0.75,0.25,0.18,0.025,0.008,staff);
    cylinder(M.chrome,0,1.05,0,0.11,0.13,staff);
    soft(M.ivory,0,1.29,0,0.81,0.5,0.55,0.15,staff);
    soft(M.navy,0,1.29,0.265,0.65,0.3,0.065,0.1,staff);
    for(const side of [-1,1]) soft(M.led,side*0.16,1.3,0.307,0.08,0.095,0.018,0.03,staff);
    soft(M.led,0,1.21,0.307,0.15,0.02,0.018,0.008,staff);
    cylinder(M.chrome,0,1.61,0,0.025,0.18,staff);
    sphere(accent,0,1.73,0,0.065,0.065,0.065,staff);
    const ring=mesh(geo('selection-ring',()=>new T.RingGeometry(0.55,0.63,48)),M.amber,x,0.11,z,1,1,1,group,[-Math.PI/2,0,0]);
    ring.visible=false;ring.castShadow=false;
    roles.push({id,label,number,group:staff,anchor:new T.Vector3(x,2.08,z),ring});
  }
  ROLE_INFO.forEach(args=>robot(...args));
  for(const entry of batches.values()) {
    const instanced = new T.InstancedMesh(entry.geometry,entry.material,entry.transforms.length);
    entry.transforms.forEach((matrix,index)=>instanced.setMatrixAt(index,matrix));
    instanced.instanceMatrix.needsUpdate=true; instanced.castShadow=true;instanced.receiveShadow=true;
    instanced.name='batched opaque furniture & architecture'; instanced.computeBoundingBox(); instanced.computeBoundingSphere();
    group.add(instanced); instances.add(instanced);
  }
  group.updateMatrixWorld(true);
  return { group,cars,roles,dispose() {
    if(disposed)return;disposed=true;
    group.removeFromParent();
    instances.forEach(instance=>instance.dispose());
    geometryCache.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());
    batches.clear();instances.clear();geometryCache.clear();materials.clear();textures.clear();
  }};
}

/** Event-driven browser adapter. Positive zoom(delta) zooms in; rotate uses radians.
 * select(id) highlights without invoking onSelect; user clicks invoke onSelect(id).
 * Context loss / unsupported WebGL sets root.dataset.sceneFallback to a reason.
 */
export function createShowroom({root,onSelect = () => {}}) {
  if(!root || typeof root.appendChild !== 'function') throw new TypeError('createShowroom requires a root element');
  let disposed=false, renderer=null, model=null, observer=null, frame=0, selected=null;
  let azimuth=0.72, elevation=0.70, zoomLevel=1, width=1, height=1, drag=null;
  const cleanup=[];
  const scene=new T.Scene(); scene.background=new T.Color('#101c23');
  const camera=new T.OrthographicCamera(-15,15,10,-10,0.1,150);
  const raycaster=new T.Raycaster();const pointer=new T.Vector2();
  const target=new T.Vector3(0,0.6,0);
  const initialPosition=root.style.position;
  if(getComputedStyle(root).position==='static') root.style.position='relative';
  const layer=document.createElement('div');layer.className='showroom-labels';
  Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'2'});
  const buttons=new Map();
  const fallback=reason=>{root.dataset.sceneFallback=reason;root.dataset.sceneState='fallback';};
  function draw() {
    frame=0;
    if(disposed||!renderer||root.dataset.sceneState==='fallback')return;
    renderer.render(scene,camera); updateLabels();
  }
  function requestDraw() { if(!disposed&&!frame)frame=requestAnimationFrame(draw); }
  function updateLabels() {
    if(!model)return;
    const placed=[];
    for(const role of [...model.roles].sort((a,b)=>a.anchor.clone().project(camera).y-b.anchor.clone().project(camera).y)) {
      const el=buttons.get(role.id); const point=role.anchor.clone().project(camera);
      const rect=el.getBoundingClientRect(); const w=rect.width||110, h=rect.height||29;
      const x=T.MathUtils.clamp((point.x+1)*width/2,w/2+6,width-w/2-6);
      let y=T.MathUtils.clamp((1-point.y)*height/2-h-5,6,height-h-6);
      for(let pass=0;pass<5;pass++) {
        const collision=placed.find(p=>Math.abs(x-p.x)<(w+p.w)/2+4&&Math.abs(y-p.y)<h+4);
        if(!collision)break;
        y=Math.max(6,collision.y-h-5);
      }
      el.style.left=`${x}px`;el.style.top=`${y}px`;placed.push({x,y,w});
    }
  }
  function fit() {
    if(!model)return;
    camera.position.set(Math.sin(azimuth)*32*Math.cos(elevation),32*Math.sin(elevation),Math.cos(azimuth)*32*Math.cos(elevation));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model.group);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const v=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
    }
    const aspect=width/height;
    const fullHeight=Math.max(maxY-minY+2.5,(maxX-minX+2.4)/aspect)/zoomLevel;
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2+0.2;
    camera.left=cx-fullHeight*aspect/2;camera.right=cx+fullHeight*aspect/2;
    camera.top=cy+fullHeight/2;camera.bottom=cy-fullHeight/2;camera.updateProjectionMatrix();requestDraw();
  }
  function select(roleId) {
    if(disposed)return false;
    if(roleId!==null&&!ROLE_INFO.some(([id])=>id===roleId))return false;
    selected=roleId;
    if(model)model.roles.forEach(role=>{role.ring.visible=role.id===roleId;});
    buttons.forEach((button,id)=>{button.setAttribute('aria-pressed',String(id===roleId));button.style.borderColor=id===roleId?'#d4a66b':'#668c87';button.style.background=id===roleId?'#34514f':'#172c34f2';});
    requestDraw();return true;
  }
  const api={
    select,
    reset(){if(disposed)return;azimuth=0.72;elevation=0.70;zoomLevel=1;select(null);fit();},
    zoom(delta){if(disposed||!Number.isFinite(delta))return;zoomLevel=T.MathUtils.clamp(zoomLevel+delta,0.8,1.55);fit();},
    rotate(delta){if(disposed||!Number.isFinite(delta))return;azimuth=T.MathUtils.clamp(azimuth+delta,0.35,1.12);fit();},
    dispose(){
      if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();cleanup.forEach(fn=>fn());
      model?.dispose();layer.remove();
      scene.traverse(object=>{if(object.isLight&&object.shadow)object.shadow.dispose();});scene.clear();
      if(renderer){renderer.renderLists.dispose();renderer.dispose();renderer.domElement.remove();}
      root.style.position=initialPosition;delete root.dataset.sceneFallback;delete root.dataset.sceneState;
    },
  };
  try {
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    const canvas=renderer.domElement;canvas.className='showroom-canvas';canvas.setAttribute('aria-label','MR BENG miniature demo showroom. Use department buttons to explore.');canvas.setAttribute('role','img');
    Object.assign(canvas.style,{width:'100%',height:'100%',display:'block',touchAction:'pan-y',cursor:'grab'});
    root.appendChild(canvas);root.appendChild(layer);
    model=buildShowroom(T,scene);
    scene.add(new T.HemisphereLight('#fff4df','#607b86',2.5));
    const sun=new T.DirectionalLight('#fff0d6',3.6);sun.position.set(-3,18,13);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.normalBias=0.03;sun.shadow.bias=-0.0002;sun.shadow.camera.far=55;scene.add(sun);
    const fill=new T.DirectionalLight('#b9dce7',1.3);fill.position.set(12,8,-5);scene.add(fill);
    for(const [x,z] of [[-7,-4],[0,-4],[7,-4],[7,3]]){const light=new T.PointLight('#ffcf8c',8,8,2);light.position.set(x,3,z);scene.add(light);}
    const listen=(element,type,handler,options)=>{element.addEventListener(type,handler,options);cleanup.push(()=>element.removeEventListener(type,handler,options));};
    for(const role of model.roles){
      const button=document.createElement('button');button.type='button';button.className='scene-role-label';button.dataset.role=role.id;button.setAttribute('aria-label',`Explore ${role.label} — demo`);button.setAttribute('aria-pressed','false');
      button.textContent=`${role.number}  ${role.label}`;
      Object.assign(button.style,{position:'absolute',transform:'translateX(-50%)',pointerEvents:'auto',font:'600 10px/1.1 system-ui,sans-serif',letterSpacing:'.01em',whiteSpace:'nowrap',border:'1px solid #668c87',borderRadius:'5px',color:'#fff7e9',background:'#172c34f2',padding:'8px 9px',cursor:'pointer',boxShadow:'0 3px 12px #0004'});
      listen(button,'click',()=>{select(role.id);onSelect(role.id);});layer.appendChild(button);buttons.set(role.id,button);
    }
    const resize=()=>{
      if(disposed)return;
      const rect=root.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
      const nw=Math.round(rect.width),nh=Math.round(rect.height);if(nw===width&&nh===height)return;
      width=nw;height=nh;renderer.setSize(width,height,false);fit();
    };
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(root);}else listen(window,'resize',resize);
    listen(canvas,'webglcontextlost',event=>{event.preventDefault();if(frame){cancelAnimationFrame(frame);frame=0;}fallback('context-lost');});
    listen(canvas,'webglcontextrestored',()=>{if(disposed)return;delete root.dataset.sceneFallback;root.dataset.sceneState='ready';requestDraw();});
    listen(canvas,'pointerdown',event=>{
      if(event.button!==0||!event.isPrimary)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
      canvas.setPointerCapture?.(event.pointerId);canvas.style.cursor='grabbing';
    });
    listen(canvas,'pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.lastX,dy=event.clientY-drag.lastY;
      if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
      if(drag.moved){azimuth=T.MathUtils.clamp(azimuth-dx*0.005,0.35,1.12);elevation=T.MathUtils.clamp(elevation+dy*0.003,0.52,0.88);fit();}
      drag.lastX=event.clientX;drag.lastY=event.clientY;
    });
    const endDrag=event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const click=!drag.moved&&event.type==='pointerup';drag=null;canvas.style.cursor='grab';
      if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      if(!click)return;
      const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects(model.roles.map(role=>role.group),true);
      if(hits.length){let object=hits[0].object;while(object&&!object.userData.roleId)object=object.parent;if(object){select(object.userData.roleId);onSelect(object.userData.roleId);}}
    };
    listen(canvas,'pointerup',endDrag);listen(canvas,'pointercancel',endDrag);listen(canvas,'lostpointercapture',()=>{drag=null;canvas.style.cursor='grab';});
    root.dataset.sceneState='ready';delete root.dataset.sceneFallback;resize();
  }catch(error){
    fallback('webgl-unavailable');
    // Partial construction is still owned by dispose(); expose a usable no-op API.
    if(renderer)renderer.domElement.style.display='none';
  }
  return api;
}
