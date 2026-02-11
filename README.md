# Proyecto Final: Sistema de Ventas Inteligente (TecnoCuenca)

Este repositorio contiene el sistema completo unificado (Monorepo), dividido en Frontend y Backend.

## Estructura del Proyecto

- **/backend**: Contiene la lógica de negocio, LLM (Agente 2), Base de Datos y APIs.
  - Tecnología: Python, FastAPI, LangChain, PostgreSQL.
  - Ejecución: Ver `backend/README.md` (o usar `./start.sh` dentro de la carpeta).

- **/frontend**: Contiene la interfaz de usuario y el Chatbot.
  - Tecnología: React, Vite, TailwindCSS.
  - Ejecución: `npm install` y `npm run dev`.

## Instrucciones de Inicio Rápido

### 1. Backend
```bash
cd backend
# Configurar .env si es necesario
./start.sh
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Creditos
Sistema desarrollado para la asignatura de Aprendizaje Automático.
Agente 'TecnoBot' implementado con Llama 3 (Groq) y OpenAI como fallback.
