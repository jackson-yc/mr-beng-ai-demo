import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import { buildShowroom, createShowroom } from '../scene.mjs';

const expectedRoles = ['ads', 'finance', 'human', 'owner', 'sales'];

test('exports a browser factory and a headless showroom builder', () => {
  assert.equal(typeof createShowroom, 'function');
  assert.equal(typeof buildShowroom, 'function');
  const scene = new T.Scene();
  const model = buildShowroom(T, scene);
  assert.ok(model.group.isGroup);
  assert.equal(model.group.parent, scene);
  assert.equal(typeof model.dispose, 'function');
  model.dispose();
  assert.equal(model.group.parent, null);
});

test('contains three multipart generic cars with four tires each', () => {
  const model = buildShowroom(T, new T.Scene());
  assert.equal(model.cars.length, 3);
  for (const car of model.cars) {
    const parts = [];
    car.traverse(part => parts.push(part));
    assert.equal(parts.filter(part => part.userData.kind === 'tire').length, 4);
    assert.ok(parts.filter(part => part.isMesh).length >= 35, 'car has modeled details');
    for (const name of ['chassis', 'cabin', 'windshield', 'grille', 'mirror-left', 'mirror-right']) {
      assert.ok(car.getObjectByName(name), `missing car component: ${name}`);
    }
  }
  model.dispose();
});

test('car cabin and glass faces point outwards instead of disappearing by backface culling', () => {
  const model = buildShowroom(T, new T.Scene());
  for (const car of model.cars) {
    const center = new T.Vector3(0, 1.3, -0.2);
    car.traverse(part => {
      if (!['cabin', 'windshield', 'rear-window'].includes(part.name) && !part.name.startsWith('side-window-')) return;
      const position = part.geometry.attributes.position;
      const indices = part.geometry.index;
      for (let i = 0; i < indices.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(position, indices.getX(i));
        const b = new T.Vector3().fromBufferAttribute(position, indices.getX(i + 1));
        const c = new T.Vector3().fromBufferAttribute(position, indices.getX(i + 2));
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        const outward = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(center);
        assert.ok(normal.dot(outward) > 0, `${part.name} triangle ${i / 3} faces inward`);
      }
    });
  }
  model.dispose();
});

test('car glass panels sit outside the painted cabin rather than being occluded', () => {
  const model = buildShowroom(T, new T.Scene());
  model.group.updateMatrixWorld(true);
  const ray = new T.Raycaster();
  for (const car of model.cars) {
    const cabin = car.getObjectByName('cabin');
    car.traverse(part => {
      if (!['windshield', 'rear-window'].includes(part.name) && !part.name.startsWith('side-window-')) return;
      const p = part.geometry.attributes.position;
      const ix = part.geometry.index;
      for (let i = 0; i < ix.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(p, ix.getX(i)).applyMatrix4(part.matrixWorld);
        const b = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 1)).applyMatrix4(part.matrixWorld);
        const c = new T.Vector3().fromBufferAttribute(p, ix.getX(i + 2)).applyMatrix4(part.matrixWorld);
        const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        // Near every vertex as well as the face centroid: the upper edge must not sink into paint.
        for (const weight of [[1/3,1/3,1/3],[0.9,0.05,0.05],[0.05,0.9,0.05],[0.05,0.05,0.9]]) {
          const target = a.clone().multiplyScalar(weight[0]).addScaledVector(b,weight[1]).addScaledVector(c,weight[2]);
          ray.set(target.clone().addScaledVector(normal, 3), normal.clone().negate());
          const hits = ray.intersectObjects([cabin, part], false);
          assert.equal(hits[0]?.object.name, part.name, `${part.name} is hidden by the painted cabin`);
        }
      }
    });
  }
  model.dispose();
});

test('contains exactly five selectable staff with independent anchors', () => {
  const model = buildShowroom(T, new T.Scene());
  assert.deepEqual(model.roles.map(role => role.id).sort(), expectedRoles);
  for (const role of model.roles) {
    assert.equal(role.group.userData.roleId, role.id);
    assert.ok(role.anchor.isVector3);
    assert.ok(role.ring.isMesh);
    assert.equal(role.ring.visible, false);
  }
  model.dispose();
});

test('fits the continuous 22 × 14 floor and batches opaque furnishings', () => {
  const model = buildShowroom(T, new T.Scene());
  model.group.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model.group);
  assert.ok(bounds.min.x >= -11.01 && bounds.max.x <= 11.01, `x bounds ${bounds.min.x}, ${bounds.max.x}`);
  assert.ok(bounds.min.z >= -7.01 && bounds.max.z <= 7.01, `z bounds ${bounds.min.z}, ${bounds.max.z}`);
  assert.ok(bounds.min.y >= -0.6 && bounds.max.y <= 5.2, `y bounds ${bounds.min.y}, ${bounds.max.y}`);
  let instanceCount = 0;
  model.group.traverse(object => {
    if (object.isInstancedMesh) {
      instanceCount += object.count;
      assert.equal(object.material.transparent, false, 'glass must not share opaque batches');
    }
  });
  assert.ok(instanceCount > 100, 'repeated opaque details use instances');
  model.dispose();
});

test('disposal releases shared resources once and is idempotent', () => {
  const model = buildShowroom(T, new T.Scene());
  const resources = new Set();
  model.group.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials.filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
    if (object.isInstancedMesh) resources.add(object);
  });
  const counts = new Map();
  for (const resource of resources) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  model.dispose();
  model.dispose();
  for (const count of counts.values()) assert.equal(count, 1);
});
