from typing import List, Optional
from pydantic import BaseModel


class AgentTarget(BaseModel):
    aria: Optional[str] = None
    element_id: Optional[str] = None


class AgentStep(BaseModel):
    kind: str
    url: Optional[str] = None
    target: Optional[AgentTarget] = None
    value: Optional[str] = None
    text: Optional[str] = None


class AgentActionPlan(BaseModel):
    plan_id: str
    steps: List[AgentStep]
    meta: Optional[dict] = None


class AgentContextUpdate(BaseModel):
    url: str
    aria_ids: List[str]
    locale: str = "en"
    screen: Optional[dict] = None
    ts: Optional[int] = None


class AgentSpeakPayload(BaseModel):
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    text: Optional[str] = None
