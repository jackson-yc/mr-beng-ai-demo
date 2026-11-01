// Local demo only: qualification and consultation, never financing approval.
export const STEPS = [
  { id: 'enquiry', label: 'Enquiry', role: 'ads' },
  { id: 'matched', label: 'Vehicle match', role: 'sales' },
  { id: 'finance-intake', label: 'Finance qualification', role: 'finance' },
  { id: 'human-review', label: 'Human review', role: 'human' },
  { id: 'appointment', label: 'Consultation booking', role: 'human' },
  { id: 'follow-up', label: 'Follow-up', role: 'sales' },
  { id: 'owner-summary', label: 'Owner summary', role: 'owner' },
];

export function transition(state, action) {
  if (action.type === 'reset') {
    return createState(isPath(action.path) ? action.path : state.path);
  }
  if (action.type === 'review' && state.step === 3) {
    return { ...state, humanReviewed: true, issue: '' };
  }
  if (action.type === 'provide-budget' && state.step === 2) {
    return { ...state, budgetProvided: true, issue: '' };
  }
  if (action.type === 'back') {
    const step = state.path === 'human' && state.step === 3 ? 1 : Math.max(0, state.step - 1);
    // Retain supplied information; returning to review invalidates its sign-off.
    return { ...state, step, humanReviewed: step <= 3 ? false : state.humanReviewed, issue: '' };
  }
  if (action.type === 'next') {
    if (state.step === 3 && !state.humanReviewed) {
      return { ...state, issue: 'human-review' };
    }
    if (state.path === 'missing' && state.step === 2 && !state.budgetProvided) {
      return { ...state, issue: 'missing-budget' };
    }
    const step = state.path === 'human' && state.step === 1 ? 3 : Math.min(6, state.step + 1);
    return { ...state, step, issue: '' };
  }
  return state;
}

const isPath = path => ['standard', 'missing', 'human'].includes(path);

export function createState(path = 'standard') {
  return {
    step: 0,
    path: isPath(path) ? path : 'standard',
    budgetProvided: false,
    humanReviewed: false,
    issue: '',
  };
}
