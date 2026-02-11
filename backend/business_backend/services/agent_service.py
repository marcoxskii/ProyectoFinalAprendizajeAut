"""
Agent Service for Business Backend.

Handles the 'Agent 2' logic: Recognition & Request Refinement.
"""

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.language_models import BaseChatModel

from business_backend.llm.provider import LLMProvider
from business_backend.services.product_service import ProductService


class AgentService:
    """Service for handling Agent 2 chat logic."""

    def __init__(
        self,
        llm_provider: LLMProvider | None,
        product_service: ProductService,
    ) -> None:
        """
        Initialize AgentService.

        Args:
            llm_provider: Provider for the LLM (OpenAI/Groq)
            product_service: Service to access inventory context
        """
        self.llm_provider = llm_provider
        self.product_service = product_service

    async def generate_refined_request(self, messages: list[dict], context_data: str = "") -> str:
        """
        Generate a refined request (Agent 2) based on chat history.

        Args:
            messages: List of message dicts ({'role': 'user'|'assistant', 'content': '...'})
            context_data: Extra data from vision system (detected SKU, etc.)

        Returns:
            The refined request string from the LLM.
        """
        if not self.llm_provider:
            return "Error: LLM not configured."

        # 1. Fetch Inventory for Context
        products = await self.product_service.list_products(limit=100)
        inventory_context = "\n".join(
            [f"- {p.brand} {p.product_name} (Código: {p.sku})" for p in products]
        )

        # 2. Build System Prompt (Strict Sales Agent)
        system_prompt = f"""
        Eres 'TecnoBot', asesor de ventas de TecnoCuenca.
        
        SITUACIÓN:
        - Somos una tienda pequeña y exclusiva con stock limitado.
        - SOLO vendemos los productos listados en el INVENTARIO REAL a continuación.
        
        INVENTARIO REAL (No alucines otros modelos):
        {inventory_context}

        REGLAS DE ORO (Si las rompes, fallas tu misión):
        1. SOLO menciona productos del INVENTARIO REAL. Si el usuario pide algo que no está (ej: HP, Dell), di "Lo siento, solo manejamos [Marcas disponibles]".
        2. SÉ BREVE: Máximo 10 oraciones. Respuestas cortas y directas.
        3. NO hagas listas largas. Di: "Tenemos la [Marca Modelo] a $[Precio]..."
        4. Si te preguntan "qué tienes", resume: "Actualmente contamos con opciones de [Marca 1] y [Marca 2]..." (Solo lo real).
        
        ESTILO:
        - Amigable, corto y útil.
        """
        
        # DEBUG: Print prompt to console to verify what LLM sees
        print("--- SYSTEM PROMPT ENVIADO A GROQ ---")
        # print(system_prompt) # Uncomment to debug inventory injection
        print(f"Inventario inyectado: {len(products)} productos.")
        print("------------------------------------")
        
        # 3. Build LangChain Messages
        # IMPORTANT: Start fresh with System Message to override any previous 'Agent 2' hidden context
        lc_messages = [SystemMessage(content=system_prompt)]

        # Add History
        for msg in messages:
            # Skip messages that look like generated refiners if we want clean chat
            if msg["role"] == "user":
                lc_messages.append(HumanMessage(content=msg["content"]))
            else:
                lc_messages.append(AIMessage(content=msg["content"]))
        
        # Add Context Data to the last user message if present
        if context_data and messages and messages[-1]['role'] == 'user':
            # Append context directly to the last message object in LangChain list
            last_msg = lc_messages[-1] 
            if isinstance(last_msg, HumanMessage):
                 last_msg.content += f"\n\n[DATOS DEL SISTEMA DE VISIÓN]: {context_data}"
        elif context_data:
             lc_messages.append(HumanMessage(content=f"[DATOS DEL SISTEMA DE VISIÓN]: {context_data}"))

        # 4. Invoke LLM
        model = self.llm_provider.get_model()
        response = await model.ainvoke(lc_messages)
        
        return response.content
