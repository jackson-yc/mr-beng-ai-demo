import test from 'node:test';
import assert from 'node:assert/strict';

const flow = await import('../flow.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const { STEPS, createState, transition } = flow;
const act = (state, type, extra = {}) => transition(state, { type, ...extra });
test('standard happy flow reaches consultation and owner summary after review', () => {
  assert.equal(typeof transition, 'function', 'transition must be implemented');
  let state = createState();
  for (const step of [1, 2, 3]) {
    state = act(state, 'next');
    assert.equal(state.step, step);
    assert.equal(state.issue, '');
  }
  state = act(state, 'review');
  assert.equal(state.step, 3);
  assert.equal(state.humanReviewed, true);
  for (const step of [4, 5, 6]) {
    state = act(state, 'next');
    assert.equal(state.step, step);
    assert.equal(state.issue, '');
  }
});

test('missing budget blocks repeatedly until intake receives information', () => {
  let state = advance(createState('missing'), 2);
  for (let i = 0; i < 3; i++) {
    state = act(state, 'next');
    assert.equal(state.step, 2);
    assert.equal(state.issue, 'missing-budget');
    assert.equal(state.budgetProvided, false);
  }
  state = act(state, 'provide-budget');
  assert.equal(state.step, 2);
  assert.equal(state.budgetProvided, true);
  assert.equal(state.issue, '');
  assert.deepEqual(act(state, 'provide-budget'), state);
  state = act(state, 'next');
  assert.equal(state.step, 3);
  state = act(state, 'review');
  assert.equal(advance(state, 3).step, 6);
  for (const step of [0, 1, 3, 4, 5, 6]) {
    const outside = { ...createState('missing'), step };
    assert.deepEqual(act(outside, 'provide-budget'), outside);
  }
});

test('every path requires explicit review at step 3 and cannot prereview', () => {
  for (const path of ['standard', 'missing', 'human']) {
    let state = { ...createState(path), step: 3 };
    state = act(state, 'next');
    assert.equal(state.step, 3);
    assert.equal(state.issue, 'human-review');
    assert.deepEqual(act(state, 'next'), state);
    assert.deepEqual(act(state, 'provide-budget'), state);
    state = act(state, 'review');
    assert.equal(state.humanReviewed, true);
    assert.equal(state.issue, '');
    assert.equal(state.step, 3);
    assert.deepEqual(act(state, 'review'), state);
    assert.equal(act(state, 'next').step, 4);
    for (const step of [0, 1, 2, 4, 5, 6]) {
      const outside = { ...createState(path), step };
      assert.deepEqual(act(outside, 'review'), outside);
    }
  }
});

test('human request skips finance intake and waits for a person', () => {
  let state = act(createState('human'), 'next');
  assert.equal(state.step, 1);
  state = act(state, 'next');
  assert.equal(state.step, 3);
  assert.equal(state.budgetProvided, false);
  state = act(state, 'next');
  assert.equal(state.step, 3);
  assert.equal(state.issue, 'human-review');
  state = act(state, 'review');
  assert.equal(advance(state, 3).step, 6);
});

test('reset clears progress and flags using only valid replacement paths', () => {
  for (const path of ['standard', 'missing', 'human']) {
    const state = { ...createState(path), step: 6, budgetProvided: true, humanReviewed: true, issue: 'human-review' };
    for (const replacement of ['standard', 'missing', 'human']) {
      assert.deepEqual(act(state, 'reset', { path: replacement }), createState(replacement));
    }
    for (const replacement of [undefined, null, '', 'unknown', 'toString', {}]) {
      assert.deepEqual(act(state, 'reset', { path: replacement }), createState(path));
    }
    const initial = createState(path);
    assert.notStrictEqual(act(initial, 'reset'), initial);
    assert.deepEqual(act(initial, 'next', { path: 'other' }), act(initial, 'next'));
  }
});

test('back follows visited steps and requires review again on replay', () => {
  for (const path of ['standard', 'missing', 'human']) {
    let state = advance(createState(path), 2);
    if (state.step === 2) state = act(act(state, 'provide-budget'), 'next');
    state = advance(act(state, 'review'), 3);
    const expected = path === 'human' ? [5, 4, 3, 1, 0] : [5, 4, 3, 2, 1, 0];
    for (const step of expected) {
      state = act(state, 'back');
      assert.equal(state.step, step);
      assert.equal(state.issue, '');
      assert.equal(state.humanReviewed, step > 3);
      assert.equal(state.budgetProvided, path !== 'human');
    }
    state = advance(state, path === 'human' ? 2 : 3);
    assert.equal(state.step, 3);
    state = act(state, 'next');
    assert.equal(state.step, 3);
    assert.equal(state.issue, 'human-review');
    assert.equal(act(act(state, 'review'), 'next').step, 4);
    assert.equal(act(state, 'back').issue, '');
  }
  const blocked = advance(createState('missing'), 3);
  assert.deepEqual(act(blocked, 'back'), { ...createState('missing'), step: 1 });
});

test('bounds are stable and unknown actions never change state', () => {
  for (const path of ['standard', 'missing', 'human']) {
    let initial = createState(path);
    for (let i = 0; i < 10; i++) {
      initial = act(initial, 'back');
      assert.deepEqual(initial, createState(path));
    }
    let final = { ...createState(path), step: 6, humanReviewed: true };
    for (let i = 0; i < 10; i++) {
      final = act(final, 'next');
      assert.equal(final.step, 6);
    }
    for (const state of [initial, final, { ...initial, step: 3, issue: 'human-review' }]) {
      for (const type of ['unknown', '', 'NEXT', undefined, 'approve']) {
        assert.deepEqual(act(state, type), state);
      }
    }
  }
});

test('all actions preserve frozen inputs and produce deterministic results', () => {
  for (const path of ['standard', 'missing', 'human']) {
    for (let step = 0; step <= 6; step++) {
      for (const budgetProvided of [false, true]) {
        for (const humanReviewed of [false, true]) {
          const state = Object.freeze({ step, path, budgetProvided, humanReviewed, issue: '' });
          const before = { ...state };
          for (const type of ['next', 'back', 'reset', 'provide-budget', 'review', 'unknown']) {
            const action = Object.freeze({ type, path: 'missing' });
            const result = transition(state, action);
            assert.deepEqual(state, before);
            assert.deepEqual(action, { type, path: 'missing' });
            assert.deepEqual(transition(state, action), result);
            assert.deepEqual(Object.keys(result).sort(), Object.keys(before).sort());
            assert.ok(result.step >= 0 && result.step <= 6);
            if (result !== state) {
              result.issue = 'consumer edit';
              assert.deepEqual(state, before);
            }
          }
        }
      }
    }
  }
});

const advance = (state, count) => {
  for (let i = 0; i < count; i++) state = act(state, 'next');
  return state;
};

test('exports the seven ordered demo steps and fresh allowlisted initial state', () => {
  assert.equal(typeof createState, 'function', 'createState must be implemented');
  assert.deepEqual(STEPS.map(({ id, role }) => [id, role]), [
    ['enquiry', 'ads'], ['matched', 'sales'], ['finance-intake', 'finance'],
    ['human-review', 'human'], ['appointment', 'human'],
    ['follow-up', 'sales'], ['owner-summary', 'owner'],
  ]);
  for (const step of STEPS) {
    assert.deepEqual(Object.keys(step).sort(), ['id', 'label', 'role']);
    assert.ok(typeof step.label === 'string' && step.label.trim());
    assert.doesNotMatch(step.label, /approv|guaranteed|loan granted/i);
  }
  const initial = { step: 0, path: 'standard', budgetProvided: false, humanReviewed: false, issue: '' };
  assert.deepEqual(createState(), initial);
  assert.notStrictEqual(createState(), createState());
  for (const path of ['standard', 'missing', 'human']) {
    assert.deepEqual(createState(path), { ...initial, path });
  }
  for (const path of ['unknown', '', null, {}, 'toString']) {
    assert.deepEqual(createState(path), initial);
  }
});
