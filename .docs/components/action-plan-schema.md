# Action Plan Schema

## Overview

This document defines the Action Plan JSON schema used for structured communication between the LLM and the voice agent. Action Plans allow the LLM to request specific actions that the voice agent can execute.

---

## Schema Definition

### JSON Schema (Draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sahayak.dev/schemas/action-plan.json",
  "title": "Voice Agent Action Plan",
  "description": "Schema for structured voice agent action responses",
  "type": "object",
  "required": ["response"],
  "properties": {
    "response": {
      "type": "string",
      "description": "The text response to speak to the user"
    },
    "intent": {
      "type": "string",
      "description": "The detected user intent",
      "enum": [
        "query",
        "action",
        "navigation",
        "confirmation",
        "clarification",
        "greeting",
        "farewell",
        "help",
        "cancel",
        "error"
      ]
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score for intent detection"
    },
    "actions": {
      "type": "array",
      "description": "List of actions to execute",
      "items": {
        "$ref": "#/$defs/action"
      }
    },
    "context": {
      "type": "object",
      "description": "Context to maintain for follow-up interactions",
      "properties": {
        "topic": {
          "type": "string"
        },
        "entities": {
          "type": "object",
          "additionalProperties": true
        },
        "slotsFilled": {
          "type": "object",
          "additionalProperties": true
        },
        "slotsRequired": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "suggestions": {
      "type": "array",
      "description": "Follow-up suggestions for the user",
      "items": {
        "type": "string"
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional metadata",
      "additionalProperties": true
    }
  },
  "$defs": {
    "action": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "description": "The action type identifier"
        },
        "target": {
          "type": "string",
          "description": "The target of the action (e.g., URL, element ID)"
        },
        "params": {
          "type": "object",
          "description": "Action parameters",
          "additionalProperties": true
        },
        "priority": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10,
          "default": 5,
          "description": "Execution priority (higher = first)"
        },
        "requiresConfirmation": {
          "type": "boolean",
          "default": false,
          "description": "Whether user confirmation is required"
        },
        "confirmationMessage": {
          "type": "string",
          "description": "Message to speak when asking for confirmation"
        },
        "fallbackAction": {
          "$ref": "#/$defs/action",
          "description": "Action to execute if this one fails"
        },
        "conditions": {
          "type": "array",
          "description": "Conditions that must be met for execution",
          "items": {
            "$ref": "#/$defs/condition"
          }
        }
      }
    },
    "condition": {
      "type": "object",
      "required": ["field", "operator", "value"],
      "properties": {
        "field": {
          "type": "string",
          "description": "The field to check"
        },
        "operator": {
          "type": "string",
          "enum": ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists"]
        },
        "value": {
          "description": "The value to compare against"
        }
      }
    }
  }
}
```

---

## Action Types

### Standard Actions

| Type | Description | Required Params |
|------|-------------|-----------------|
| `navigate` | Navigate to URL/page | `url` or `route` |
| `click` | Click an element | `selector` or `elementId` |
| `input` | Enter text in field | `selector`, `value` |
| `submit` | Submit a form | `formId` or `selector` |
| `scroll` | Scroll page/element | `direction`, `amount` |
| `select` | Select from dropdown | `selector`, `value` |
| `api_call` | Make API request | `endpoint`, `method`, `body` |
| `display` | Show information | `content`, `format` |
| `notify` | Show notification | `message`, `type` |
| `speak` | Additional TTS | `text` |
| `wait` | Pause execution | `duration` |
| `confirm` | Require confirmation | `message` |

### Domain-Specific Actions (Banking Example)

| Type | Description | Required Params |
|------|-------------|-----------------|
| `check_balance` | Check account balance | `accountType` |
| `transfer` | Transfer money | `fromAccount`, `toAccount`, `amount` |
| `pay_bill` | Pay a bill | `billerId`, `amount` |
| `transaction_history` | View transactions | `accountType`, `dateRange` |
| `block_card` | Block a card | `cardId` |
| `schedule_payment` | Schedule payment | `date`, `recipient`, `amount` |

---

## Examples

### Simple Query Response

```json
{
  "response": "Your current balance is $2,450.32 in your checking account.",
  "intent": "query",
  "confidence": 0.95,
  "actions": [
    {
      "type": "display",
      "params": {
        "content": {
          "accountType": "checking",
          "balance": 2450.32,
          "currency": "USD"
        },
        "format": "balance_card"
      }
    }
  ],
  "suggestions": [
    "View recent transactions",
    "Transfer money",
    "Check savings balance"
  ]
}
```

### Action with Confirmation

```json
{
  "response": "I'll transfer $500 from your checking to your savings account. Please confirm.",
  "intent": "action",
  "confidence": 0.92,
  "actions": [
    {
      "type": "transfer",
      "params": {
        "fromAccount": "checking",
        "toAccount": "savings",
        "amount": 500,
        "currency": "USD"
      },
      "requiresConfirmation": true,
      "confirmationMessage": "Do you want me to transfer five hundred dollars from checking to savings?"
    }
  ],
  "context": {
    "topic": "transfer",
    "entities": {
      "amount": 500,
      "fromAccount": "checking",
      "toAccount": "savings"
    }
  }
}
```

### Multi-Step Action

```json
{
  "response": "I'm looking up your recent transactions now.",
  "intent": "action",
  "confidence": 0.88,
  "actions": [
    {
      "type": "navigate",
      "target": "/transactions",
      "priority": 10
    },
    {
      "type": "api_call",
      "params": {
        "endpoint": "/api/transactions",
        "method": "GET",
        "query": {
          "accountId": "checking",
          "limit": 10
        }
      },
      "priority": 9
    },
    {
      "type": "display",
      "params": {
        "format": "transaction_list"
      },
      "priority": 8
    }
  ]
}
```

### Conditional Action

```json
{
  "response": "I'll pay your electric bill of $85.50.",
  "intent": "action",
  "confidence": 0.90,
  "actions": [
    {
      "type": "pay_bill",
      "params": {
        "billerId": "electric_company",
        "amount": 85.50,
        "currency": "USD"
      },
      "conditions": [
        {
          "field": "account.balance",
          "operator": "gte",
          "value": 85.50
        }
      ],
      "requiresConfirmation": true,
      "confirmationMessage": "Confirm payment of eighty-five dollars and fifty cents to Electric Company?",
      "fallbackAction": {
        "type": "notify",
        "params": {
          "message": "Insufficient funds for this payment",
          "type": "error"
        }
      }
    }
  ]
}
```

### Slot-Filling Response

```json
{
  "response": "How much would you like to transfer?",
  "intent": "clarification",
  "confidence": 0.85,
  "context": {
    "topic": "transfer",
    "entities": {
      "fromAccount": "checking",
      "toAccount": "savings"
    },
    "slotsFilled": {
      "fromAccount": "checking",
      "toAccount": "savings"
    },
    "slotsRequired": ["amount"]
  }
}
```

---

## TypeScript Types

```typescript
interface ActionPlan {
  response: string;
  intent?: Intent;
  confidence?: number;
  actions?: Action[];
  context?: ConversationContext;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

type Intent = 
  | 'query'
  | 'action'
  | 'navigation'
  | 'confirmation'
  | 'clarification'
  | 'greeting'
  | 'farewell'
  | 'help'
  | 'cancel'
  | 'error';

interface Action {
  type: string;
  target?: string;
  params?: Record<string, any>;
  priority?: number;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  fallbackAction?: Action;
  conditions?: Condition[];
}

interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';
  value: any;
}

interface ConversationContext {
  topic?: string;
  entities?: Record<string, any>;
  slotsFilled?: Record<string, any>;
  slotsRequired?: string[];
}
```

---

## LLM System Prompt

To enable structured action plan responses, include this in the LLM system prompt:

```
You are a voice assistant that responds in structured JSON format.

Always respond with a JSON object containing:
- "response": The text to speak to the user (required)
- "intent": The detected intent (query, action, navigation, etc.)
- "confidence": Your confidence in the intent (0-1)
- "actions": Array of actions to execute (if applicable)
- "context": Context to maintain for follow-ups
- "suggestions": Follow-up suggestions for the user

For actions, include:
- "type": The action type (navigate, click, api_call, transfer, etc.)
- "params": Required parameters for the action
- "requiresConfirmation": true for sensitive actions like payments

Available actions in this system:
- check_balance: Check account balance. Params: accountType
- transfer: Transfer money. Params: fromAccount, toAccount, amount
- pay_bill: Pay a bill. Params: billerId, amount
- transaction_history: View transactions. Params: accountType, dateRange
- navigate: Go to a page. Params: route or url
- display: Show information. Params: content, format

Example response:
{
  "response": "Your checking account balance is $1,234.56",
  "intent": "query",
  "confidence": 0.95,
  "actions": [
    {
      "type": "display",
      "params": {
        "content": {"balance": 1234.56, "accountType": "checking"},
        "format": "balance_card"
      }
    }
  ],
  "suggestions": ["View recent transactions", "Transfer money"]
}
```

---

## Action Handler Implementation

```typescript
// Action handler registry
class ActionRegistry {
  private handlers: Map<string, ActionHandler> = new Map();
  
  register(type: string, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }
  
  async execute(action: Action, context: any): Promise<ActionResult> {
    const handler = this.handlers.get(action.type);
    
    if (!handler) {
      return {
        success: false,
        error: `Unknown action type: ${action.type}`
      };
    }
    
    // Check conditions
    if (action.conditions) {
      const conditionsMet = this.evaluateConditions(action.conditions, context);
      if (!conditionsMet) {
        if (action.fallbackAction) {
          return this.execute(action.fallbackAction, context);
        }
        return {
          success: false,
          error: 'Conditions not met'
        };
      }
    }
    
    try {
      return await handler.handle(action, context);
    } catch (error) {
      if (action.fallbackAction) {
        return this.execute(action.fallbackAction, context);
      }
      throw error;
    }
  }
  
  private evaluateConditions(conditions: Condition[], context: any): boolean {
    return conditions.every(cond => {
      const value = this.getFieldValue(cond.field, context);
      return this.evaluateCondition(cond, value);
    });
  }
  
  private evaluateCondition(cond: Condition, value: any): boolean {
    switch (cond.operator) {
      case 'eq': return value === cond.value;
      case 'neq': return value !== cond.value;
      case 'gt': return value > cond.value;
      case 'gte': return value >= cond.value;
      case 'lt': return value < cond.value;
      case 'lte': return value <= cond.value;
      case 'contains': return String(value).includes(String(cond.value));
      case 'exists': return value !== undefined && value !== null;
      default: return false;
    }
  }
}

// Example handlers
const registry = new ActionRegistry();

registry.register('navigate', {
  async handle(action: Action, context: any): Promise<ActionResult> {
    const url = action.params?.url || action.target;
    window.location.href = url;
    return { success: true };
  }
});

registry.register('check_balance', {
  async handle(action: Action, context: any): Promise<ActionResult> {
    const response = await fetch(`/api/accounts/${action.params.accountType}/balance`);
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  }
});

registry.register('transfer', {
  async handle(action: Action, context: any): Promise<ActionResult> {
    const { fromAccount, toAccount, amount } = action.params;
    const response = await fetch('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromAccount, toAccount, amount })
    });
    const data = await response.json();
    return {
      success: response.ok,
      data: data
    };
  }
});
```

---

## Validation

### Runtime Validation with Zod

```typescript
import { z } from 'zod';

const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']),
  value: z.any()
});

const ActionSchema: z.ZodType<Action> = z.lazy(() =>
  z.object({
    type: z.string(),
    target: z.string().optional(),
    params: z.record(z.any()).optional(),
    priority: z.number().min(0).max(10).default(5).optional(),
    requiresConfirmation: z.boolean().default(false).optional(),
    confirmationMessage: z.string().optional(),
    fallbackAction: ActionSchema.optional(),
    conditions: z.array(ConditionSchema).optional()
  })
);

const ActionPlanSchema = z.object({
  response: z.string(),
  intent: z.enum([
    'query', 'action', 'navigation', 'confirmation',
    'clarification', 'greeting', 'farewell', 'help', 'cancel', 'error'
  ]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  actions: z.array(ActionSchema).optional(),
  context: z.object({
    topic: z.string().optional(),
    entities: z.record(z.any()).optional(),
    slotsFilled: z.record(z.any()).optional(),
    slotsRequired: z.array(z.string()).optional()
  }).optional(),
  suggestions: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

// Usage
function parseActionPlan(json: string): ActionPlan {
  const parsed = JSON.parse(json);
  return ActionPlanSchema.parse(parsed);
}
```
