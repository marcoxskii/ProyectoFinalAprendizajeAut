"""
Chat Endpoints for Business Backend.

Exposes Agent 2 capabilities (LangChain + Open Source LLM).
"""

from typing import List, Optional, Annotated

from aioinject import Inject
from aioinject.ext.fastapi import inject
from fastapi import APIRouter
from pydantic import BaseModel

from business_backend.services.agent_service import AgentService

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    text: str # Changed from content to match frontend format if possible, or mapping needed
    type: Optional[str] = None # 'user', 'bot', 'image'

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    contextData: Optional[str] = ""

class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
@inject
async def chat_endpoint(
    request: ChatRequest,
    agent_service: Annotated[AgentService, Inject],
):
    """
    Chat endpoint for Agent 2.
    Receives full history + context, returns refined request.
    """
    # 1. Convert Pydantic models to dicts for Service
    # Frontend sends [{type: 'user', text: '...'}, {type: 'bot', text: '...'}]
    # Service expects [{'role': 'user', 'content': '...'}, ...]
    
    formatted_messages = []
    for msg in request.messages:
        role = "user" if msg.type == "user" else "assistant"
        content = msg.text
        formatted_messages.append({"role": role, "content": content})
        
    # 2. Call Service
    reply = await agent_service.generate_refined_request(
        messages=formatted_messages,
        context_data=request.contextData
    )
    
    return ChatResponse(reply=reply)
