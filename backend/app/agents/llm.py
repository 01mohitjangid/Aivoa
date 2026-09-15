from langchain_groq import ChatGroq

from app.config import settings

DEFAULT_MODEL = "gemma2-9b-it"
LONG_CONTEXT_MODEL = "llama-3.3-70b-versatile"


def get_llm(*, long_context: bool = False, temperature: float = 0.0) -> ChatGroq:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set - add it to backend/.env")
    model = LONG_CONTEXT_MODEL if long_context else DEFAULT_MODEL
    return ChatGroq(model=model, temperature=temperature, api_key=settings.groq_api_key)
