import uuid
import json
import re
import httpx
from typing import Optional
from loguru import logger

from app.schemas.agent import AgentActionPlan, AgentStep, AgentTarget


SYSTEM_PROMPT = """You are Sahayak, a voice-first banking assistant for an Indian banking app. 
You help users with checking balance, viewing transactions, transferring money, and paying bills.

Based on the user's voice command and UI context, generate an action plan.

IMPORTANT: Respond with ONLY a JSON object (no markdown, no explanation, just pure JSON).

Available actions:
1. navigate - Go to a page: {"kind": "navigate", "url": "/dashboard" or "/transfers" or "/bills" or "/profile"}
2. fill - Fill a form field: {"kind": "fill", "target": {"aria": "aria-label-value"}, "value": "text to fill"}
3. click - Click a button/element: {"kind": "click", "target": {"aria": "aria-label-value"}}
4. speak - Say something to user: {"kind": "speak", "text": "message to speak"}

Rules:
- Max transfer amount is 50000 INR
- Always include a speak step to confirm the action
- Use /dashboard for balance, /transfers for sending money, /bills for bill payments

JSON Response Format:
{"plan_id": "uuid-string", "steps": [{"kind": "...", ...}], "meta": {"confidence": 0.9}}"""


class LLMService:
    """LLM reasoning using Groq"""

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.3-70b-versatile"

    async def generate_action_plan(self, transcript: str, context: dict) -> AgentActionPlan:
        if not self.api_key:
            logger.error("GROQ_API_KEY not configured")
            raise ValueError("GROQ_API_KEY not configured")

        plan_id = str(uuid.uuid4())
        
        user_message = f"""User said: "{transcript}"
Current page: {context.get('url', '/')}
Available UI elements: {context.get('aria_ids', [])}

Generate the action plan JSON:"""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.1,
            "max_tokens": 512,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.base_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                
                # Extract JSON from response (handle markdown code blocks)
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    content = json_match.group()
                
                plan_dict = json.loads(content)
                
                # Ensure plan_id exists
                if "plan_id" not in plan_dict:
                    plan_dict["plan_id"] = plan_id
                
                # Validate and create plan
                return AgentActionPlan(**plan_dict)
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Groq API error {e.response.status_code}: {e.response.text}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}. Content: {content[:200]}")
            raise
        except Exception as e:
            logger.exception(f"LLM error: {e}")
            raise

    def create_simple_plan(self, transcript: str) -> AgentActionPlan:
        """Create a simple plan based on keyword matching (fallback)"""
        plan_id = str(uuid.uuid4())
        lower = transcript.lower()
        
        if any(w in lower for w in ["balance", "account", "money", "kitna"]):
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/dashboard"),
                    AgentStep(kind="speak", text="Here is your account balance."),
                ],
                meta={"confidence": 0.9, "source": "fallback"},
            )
        elif any(w in lower for w in ["transfer", "send", "bhejo", "payment"]):
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/transfers"),
                    AgentStep(kind="speak", text="Opening transfers. Who would you like to send money to?"),
                ],
                meta={"confidence": 0.85, "source": "fallback"},
            )
        elif any(w in lower for w in ["bill", "electricity", "water", "gas", "broadband"]):
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/bills"),
                    AgentStep(kind="speak", text="Opening bill payments. Which bill would you like to pay?"),
                ],
                meta={"confidence": 0.85, "source": "fallback"},
            )
        elif any(w in lower for w in ["profile", "settings", "beneficiary"]):
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/profile"),
                    AgentStep(kind="speak", text="Opening your profile settings."),
                ],
                meta={"confidence": 0.85, "source": "fallback"},
            )
        else:
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="speak", text="I can help you check balance, transfer money, or pay bills. What would you like to do?"),
                ],
                meta={"confidence": 0.5, "source": "fallback"},
            )
