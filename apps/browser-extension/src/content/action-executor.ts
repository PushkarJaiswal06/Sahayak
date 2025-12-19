// Action Executor - Executes voice commands on the page

interface Action {
  type: string;
  params?: Record<string, any>;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ActionExecutor {
  async execute(action: Action): Promise<ActionResult> {
    console.log('Executing action:', action);

    try {
      switch (action.type) {
        case 'navigate':
          return this.navigate(action.params);
        case 'click':
          return this.click(action.params);
        case 'type':
          return this.type(action.params);
        case 'scroll':
          return this.scroll(action.params);
        case 'goBack':
          window.history.back();
          return { success: true };
        case 'goForward':
          window.history.forward();
          return { success: true };
        case 'search':
          return this.search(action.params);
        case 'read':
          return this.read(action.params);
        case 'select':
          return this.select(action.params);
        case 'submit':
          return this.submit(action.params);
        case 'highlight':
          return this.highlight(action.params);
        default:
          return { success: false, error: `Unknown action: ${action.type}` };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private navigate(params?: { url?: string }): ActionResult {
    if (!params?.url) {
      return { success: false, error: 'No URL provided' };
    }

    // Handle relative URLs and search queries
    let url = params.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        // Treat as search query
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    window.location.href = url;
    return { success: true };
  }

  private click(params?: { selector?: string; text?: string }): ActionResult {
    let element: Element | null = null;

    if (params?.selector) {
      element = document.querySelector(params.selector);
    }

    if (!element && params?.text) {
      element = this.findElementByText(params.text);
    }

    if (element) {
      // Scroll into view first
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight briefly
      this.highlightElement(element);

      // Click after a short delay
      setTimeout(() => {
        (element as HTMLElement).click();
      }, 300);

      return { success: true };
    }

    return { success: false, error: 'Element not found' };
  }

  private type(params?: { selector?: string; text?: string; clear?: boolean }): ActionResult {
    if (!params?.text) {
      return { success: false, error: 'No text provided' };
    }

    let element: HTMLInputElement | HTMLTextAreaElement | null = null;

    if (params.selector) {
      element = document.querySelector(params.selector) as HTMLInputElement;
    } else {
      // Find focused input or first visible input
      element = document.activeElement as HTMLInputElement;
      if (!element || !['INPUT', 'TEXTAREA'].includes(element.tagName)) {
        element = document.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])') as HTMLInputElement;
      }
    }

    if (element && ['INPUT', 'TEXTAREA'].includes(element.tagName)) {
      element.focus();
      
      if (params.clear) {
        element.value = '';
      }
      
      element.value = params.text;
      
      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true };
    }

    return { success: false, error: 'No input element found' };
  }

  private scroll(params?: { direction?: string; amount?: number }): ActionResult {
    const direction = params?.direction || 'down';
    const amount = params?.amount || 400;

    const delta = direction === 'up' ? -amount : amount;
    window.scrollBy({ top: delta, behavior: 'smooth' });

    return { success: true };
  }

  private search(params?: { query?: string }): ActionResult {
    if (!params?.query) {
      return { success: false, error: 'No search query provided' };
    }

    // Try to use browser find
    if ((window as any).find) {
      (window as any).find(params.query);
      return { success: true };
    }

    // Fallback: highlight matching text
    const matches = this.findTextMatches(params.query);
    if (matches.length > 0) {
      matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightElement(matches[0]);
      return { success: true, data: { matchCount: matches.length } };
    }

    return { success: false, error: 'No matches found' };
  }

  private read(params?: { selector?: string }): ActionResult {
    let element: Element | null = null;

    if (params?.selector) {
      element = document.querySelector(params.selector);
    } else {
      // Read main content
      element = document.querySelector('main, article, [role="main"], .content, #content') || document.body;
    }

    if (element) {
      const text = element.textContent?.trim().slice(0, 2000) || '';
      return { success: true, data: { text } };
    }

    return { success: false, error: 'Element not found' };
  }

  private select(params?: { selector?: string; value?: string }): ActionResult {
    if (!params?.selector || !params?.value) {
      return { success: false, error: 'Selector and value required' };
    }

    const select = document.querySelector(params.selector) as HTMLSelectElement;
    if (select && select.tagName === 'SELECT') {
      select.value = params.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    }

    return { success: false, error: 'Select element not found' };
  }

  private submit(params?: { selector?: string }): ActionResult {
    let form: HTMLFormElement | null = null;

    if (params?.selector) {
      form = document.querySelector(params.selector) as HTMLFormElement;
    } else {
      // Find form containing focused element
      const active = document.activeElement;
      form = active?.closest('form') || document.querySelector('form');
    }

    if (form) {
      form.submit();
      return { success: true };
    }

    return { success: false, error: 'Form not found' };
  }

  private highlight(params?: { selector?: string; text?: string }): ActionResult {
    let element: Element | null = null;

    if (params?.selector) {
      element = document.querySelector(params.selector);
    } else if (params?.text) {
      element = this.findElementByText(params.text);
    }

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightElement(element, 3000);
      return { success: true };
    }

    return { success: false, error: 'Element not found' };
  }

  // Helper methods

  private findElementByText(text: string): Element | null {
    const lowerText = text.toLowerCase();
    
    // Priority order: buttons, links, headings, then any element
    const selectors = [
      'button',
      'a',
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      'h1, h2, h3, h4, h5, h6',
      '*',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const elText = (el.textContent || '').toLowerCase().trim();
        if (elText.includes(lowerText) || lowerText.includes(elText)) {
          // Skip hidden elements
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return el;
          }
        }
      }
    }

    return null;
  }

  private findTextMatches(query: string): Element[] {
    const matches: Element[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const lowerQuery = query.toLowerCase();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.toLowerCase().includes(lowerQuery)) {
        const parent = node.parentElement;
        if (parent && !matches.includes(parent)) {
          matches.push(parent);
        }
      }
    }

    return matches;
  }

  private highlightElement(element: Element, duration = 1500) {
    const el = element as HTMLElement;
    const originalOutline = el.style.outline;
    const originalBackground = el.style.backgroundColor;

    el.style.outline = '3px solid #667eea';
    el.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.backgroundColor = originalBackground;
    }, duration);
  }
}
