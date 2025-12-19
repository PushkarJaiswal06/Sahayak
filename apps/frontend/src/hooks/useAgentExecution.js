import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Executes agent action plans by handling navigation, form fills, clicks, and speech.
 * Step kinds: navigate, fill, click, speak
 */
export function useAgentExecution() {
  const navigate = useNavigate();

  const findElement = (target) => {
    if (!target) return null;
    
    // Try aria label first
    if (target.aria) {
      return document.querySelector(`[aria-label="${target.aria}"]`);
    }
    // Try element ID
    if (target.element_id) {
      return document.getElementById(target.element_id);
    }
    // Try selector
    if (target.selector) {
      return document.querySelector(target.selector);
    }
    return null;
  };

  const performStep = async (step) => {
    const kind = step.kind?.toLowerCase();

    try {
      switch (kind) {
        case 'navigate': {
          if (step.url) {
            navigate(step.url);
            // Wait for navigation to complete
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return { status: 'ok' };
        }

        case 'fill': {
          const element = findElement(step.target);
          if (!element) {
            console.warn('Fill target not found:', step.target);
            return { status: 'ok' }; // Don't fail on missing elements
          }
          element.focus();
          element.value = step.value || '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return { status: 'ok' };
        }

        case 'click': {
          const element = findElement(step.target);
          if (!element) {
            console.warn('Click target not found:', step.target);
            return { status: 'ok' }; // Don't fail on missing elements
          }
          element.click();
          return { status: 'ok' };
        }

        case 'speak': {
          // Speech is handled by AgentContext via TTS audio
          // Just acknowledge the step
          console.log('Agent speaks:', step.text);
          return { status: 'ok' };
        }

        case 'wait': {
          const ms = step.duration || 500;
          await new Promise(resolve => setTimeout(resolve, ms));
          return { status: 'ok' };
        }

        default:
          console.warn('Unknown step kind:', kind);
          return { status: 'ok' }; // Don't fail on unknown steps
      }
    } catch (err) {
      console.error('Step execution error:', err);
      return { status: 'failed', error: err.message };
    }
  };

  const executePlan = useCallback(async (plan) => {
    if (!plan?.steps || !Array.isArray(plan.steps)) {
      return { status: 'failed', error: 'Invalid plan structure' };
    }

    console.log('Executing plan:', plan.plan_id, 'with', plan.steps.length, 'steps');

    for (const step of plan.steps) {
      const result = await performStep(step);
      if (result.status === 'failed') {
        return result;
      }
    }
    
    return { status: 'success' };
  }, [navigate]);

  return { executePlan };
}

export default useAgentExecution;
