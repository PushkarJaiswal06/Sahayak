import os
import uuid
import json
import httpx
from typing import Optional
from loguru import logger

from app.schemas.agent import AgentActionPlan, AgentStep, AgentTarget
from app.core.config import settings


SYSTEM_PROMPT = """You are Sahayak, a voice-first banking assistant. You help users with:
- Checking balance
- Viewing recent transactions
- Transferring money to beneficiaries
- Paying utility bills
- Managing profile settings

You receive the user's voice command and the current UI context (URL, visible elements).
Respond with a JSON action plan containing steps to execute.

Step kinds:
- navigate: Go to a URL (url field)
- fill: Fill a form field (target.aria or target.element_id, value)
- click: Click an element (target.aria or target.element_id)
- speak: Say something to user (text field)

Always validate amounts against limits (max 50000 INR per transfer).
Include a speak step to acknowledge the action.

Respond ONLY with valid JSON matching this schema:
{
  "plan_id": "uuid",
  "steps": [{"kind": "...", ...}],
  "meta": {"confidence": 0.0-1.0, "language": "hi-en"}
}
"""


class LLMService:
    """LLM reasoning using Groq (Llama 3 70B)"""

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama3-70b-8192"

    async def generate_action_plan(self, transcript: str, context: dict) -> AgentActionPlan:
        if not self.api_key:
            logger.warning("GROQ_API_KEY not set; returning mock plan")
            return self._mock_plan(transcript)

        user_message = f"""User command: "{transcript}"

Current context:
- URL: {context.get('url', '/')}
- Visible elements: {context.get('aria_ids', [])}
- Locale: {context.get('locale', 'en')}

Generate the action plan."""

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
            "temperature": 0.2,
            "max_tokens": 1024,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.base_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                plan_dict = json.loads(content)
                return AgentActionPlan(**plan_dict)
        except Exception as e:
            logger.exception(f"LLM error: {e}")
            return self._error_plan()

    def _mock_plan(self, transcript: str) -> AgentActionPlan:
        plan_id = str(uuid.uuid4())
        lower = transcript.lower()

        if "balance" in lower:
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/dashboard"),
                    AgentStep(kind="speak", text="Here is your account balance."),
                ],
                meta={"confidence": 0.9, "language": "hi-en"},
            )
        elif "transfer" in lower or "send" in lower:
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/transfers"),
                    AgentStep(kind="speak", text="Opening transfers page. Who would you like to send money to?"),
                ],
                meta={"confidence": 0.85, "language": "hi-en"},
            )
        elif "bill" in lower or "pay" in lower:
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="navigate", url="/bills"),
                    AgentStep(kind="speak", text="Opening bill payments. Which bill would you like to pay?"),
                ],
                meta={"confidence": 0.85, "language": "hi-en"},
            )
        else:
            return AgentActionPlan(
                plan_id=plan_id,
                steps=[
                    AgentStep(kind="speak", text="I can help you check balance, transfer money, or pay bills. What would you like to do?"),
                ],
                meta={"confidence": 0.5, "language": "hi-en"},
            )

    def _error_plan(self) -> AgentActionPlan:
        return AgentActionPlan(
            plan_id=str(uuid.uuid4()),
            steps=[
                AgentStep(kind="speak", text="Sorry, I encountered an error. Please try again."),
            ],
            meta={"confidence": 0.0, "language": "en"},
        )
