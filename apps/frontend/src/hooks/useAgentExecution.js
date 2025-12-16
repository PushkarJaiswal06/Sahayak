import { useCallback } from 'react';

// Executes a plan by targeting elements with ARIA labels to keep things screen-reader friendly.
export function useAgentExecution() {
  const findByAria = (label) => document.querySelector(`[aria-label="${label}"]`);

  const performAction = (step) => {
    const target = findByAria(step.target_aria_label || step.targetLabel || '');
    if (!target) {
      return { status: 'failed', error: `Target not found: ${step.target_aria_label}` };
    }

    const action = step.action?.toLowerCase();
    try {
      if (action === 'click') {
        target.click();
      } else if (action === 'fill' && typeof step.value === 'string') {
        target.focus();
        target.value = step.value;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (action === 'select' && typeof step.value === 'string') {
        target.value = step.value;
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (action === 'submit') {
        target.dispatchEvent(new Event('submit', { bubbles: true }));
      } else {
        return { status: 'failed', error: `Unsupported action: ${action}` };
      }
      return { status: 'ok' };
    } catch (err) {
      return { status: 'failed', error: err.message };
    }
  };

  const executePlan = useCallback(async (plan) => {
    if (!plan?.steps || !Array.isArray(plan.steps)) {
      return { status: 'failed', error: 'Invalid plan structure' };
    }

    for (const step of plan.steps) {
      const result = performAction(step);
      if (result.status !== 'ok') {
        return result;
      }
    }
    return { status: 'completed' };
  }, []);

  return { executePlan };
}

export default useAgentExecution;
