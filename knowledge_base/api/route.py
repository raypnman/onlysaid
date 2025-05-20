from typing import List, Dict, Any, Optional
import os
from starlette.background import BackgroundTask
from fastapi import Request, Depends, Response, HTTPException
from fastapi.routing import APIRouter
from fastapi.responses import PlainTextResponse, StreamingResponse
from schemas.document import QueryRequest, KnowledgeBaseRegistration, KnowledgeBaseStatus
from loguru import logger
from pydantic import BaseModel
import json
import asyncio

router = APIRouter()

def get_kb_manager(request: Request):
    return request.app.state.kb_manager
  
@router.post("/api/register")
async def register(request: Request, registration: KnowledgeBaseRegistration) -> Dict[str, Any]:
    print("register called with:", registration)
    kb_manager = request.app.state.kb_manager
    result = kb_manager.register_knowledge_base(registration)
    return result


@router.get("/api/view/{workspace_id}")
async def view(request: Request, workspace_id: str) -> Dict[str, Any]:
    kb_manager = request.app.state.kb_manager
    data_sources = kb_manager.get_data_sources(workspace_id)
    logger.info(data_sources)
    
    response = {
        "dataSources": data_sources,
        "folderStructures": {},
        "documents": {}
    }
    
    for source in data_sources:
        source_id = source["id"]
        response["folderStructures"][source_id] = kb_manager.get_folder_structure(source_id, workspace_id)
        response["documents"][source_id] = kb_manager.get_documents(source_id)
    
    return response

@router.get("/api/kb_status/{workspace_id}/{kb_id}")
async def kb_status(request: Request, workspace_id: str, kb_id: str) -> KnowledgeBaseStatus:
    kb_manager = request.app.state.kb_manager
    status = kb_manager.get_kb_status(kb_id, workspace_id)
    
    return KnowledgeBaseStatus(
        id=kb_id,
        status=status,
        message=None
    )

@router.post("/api/sync")
async def kb_sync(request: Request) -> Dict[str, Any]:
    kb_manager = request.app.state.kb_manager
    
    for kb_id, status in kb_manager._kb_status.items():
        if status == "running":
            try:
                if kb_id in kb_manager.readers:
                    reader = kb_manager.readers[kb_id]
                    docs = reader.load_documents()
                    kb_manager.documents[kb_id] = docs
                    kb_manager.folder_structure[kb_id] = kb_manager._build_folder_structure(docs)
                    
                    await asyncio.to_thread(kb_manager.create_indices, kb_id)
                    logger.info(f"Reloaded documents and recreated index for KB {kb_id}")
            except Exception as e:
                logger.error(f"Error reloading documents for KB {kb_id}: {str(e)}")
                kb_manager._kb_status[kb_id] = "error"
    
    return {"status": "success", "message": "Knowledge base synchronized"}

async def cleanup_session(kb_manager, session_id):
    kb_manager.remove_message(session_id)

async def stream_tokens(kb_manager, query, session_id):
    accumulated_content = ""
    
    yield "event: start\ndata: {}\n\n"
    gen = await kb_manager.stream_answer_with_context(query)
    
    try:
        async for chunk in gen:
            logger.info(f"Chunk received: {chunk}")
            if hasattr(chunk, 'delta'):
                token = chunk.delta
            elif hasattr(chunk, 'text'):
                token = chunk.text
            elif isinstance(chunk, dict) and 'text' in chunk:
                token = chunk['text']
            elif isinstance(chunk, str):
                token = chunk
            else:
                logger.warning(f"Unexpected token type: {type(chunk)}, value: {chunk}")
                token = str(chunk)
                
            accumulated_content += token
            
            kb_manager.update_message_content(session_id, accumulated_content)
            
            data = json.dumps({"token": token})
            yield f"event: token\ndata: {data}\n\n"
            
            await asyncio.sleep(0.01)
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
    finally:
        if session_id in kb_manager._message_store:
            kb_manager._message_store[session_id]["is_complete"] = True
        
        yield "event: end\ndata: {}\n\n"

@router.post("/api/update_kb_status")
async def update_kb_status(request: Request, kb_data: dict) -> Dict[str, Any]:
    kb_manager = request.app.state.kb_manager
    kb_id = kb_data.get("id")
    enabled = kb_data.get("enabled")
    workspace_id = kb_data.get("workspace_id")
    
    if not kb_id:
        return {"status": "error", "message": "Knowledge base ID is required"}
    
    result = kb_manager.update_kb_status(kb_id, enabled, workspace_id)
    return result

@router.post("/api/delete_kb")
async def delete_kb(request: Request, kb_data: dict) -> Dict[str, Any]:
    kb_manager = request.app.state.kb_manager
    kb_id = kb_data.get("id")
    workspace_id = kb_data.get("workspace_id")
    
    if not kb_id:
        return {"status": "error", "message": "Knowledge base ID is required"}
    
    result = kb_manager.delete_knowledge_base(kb_id, workspace_id)
    return result

@router.post("/api/query")
async def query_knowledge_base(request: Request, query: QueryRequest):
    kb_manager = request.app.state.kb_manager
    logger.info(f"Query received: {query}")
    if query.streaming:
        session_id = f"stream_{os.urandom(8).hex()}"
        
        kb_manager.store_message(session_id, {
            "query": query.dict(),
            "current_content": "",
            "is_complete": False
        })
        
        return StreamingResponse(
            stream_tokens(kb_manager, query, session_id),
            media_type="text/event-stream",
            background=BackgroundTask(cleanup_session, kb_manager, session_id)
        )
    else:
        answer = kb_manager.answer_with_context(query)
        return {"status": "success", "results": answer}

@router.get("/api/stream")
async def stream_knowledge_base(
    request: Request,
    workspace_id: str,
    query: str,
    message_id: Optional[str] = None,
    conversation_history: Optional[str] = "",
    preferred_language: str = "en",
    top_k: int = 5
):
    kb_manager = request.app.state.kb_manager
    
    query_request = QueryRequest(
        workspace_id=workspace_id,
        query=query,
        conversation_history=conversation_history or [],
        streaming=True,
        top_k=top_k,
        preferred_language=preferred_language,
        message_id=message_id
    )
    
    logger.info(f"Stream request received: {query_request}")
    
    session_id = f"stream_{os.urandom(8).hex()}"
    
    kb_manager.store_message(session_id, {
        "query": query_request.dict(),
        "current_content": "",
        "is_complete": False
    })
    
    return StreamingResponse(
        stream_tokens(kb_manager, query_request, session_id),
        media_type="text/event-stream",
        background=BackgroundTask(cleanup_session, kb_manager, session_id)
    )

@router.post("/api/retrieve")
async def retrieve_from_knowledge_base(request: Request, query_data: dict) -> Dict[str, Any]:
    kb_manager = request.app.state.kb_manager
    
    query_text = query_data.get("query")
    knowledge_bases = query_data.get("knowledge_bases")
    top_k = query_data.get("top_k", 5)
    workspace_id = query_data.get("workspace_id")
    
    logger.info(f"Retrieving from knowledge base for workspace {workspace_id} with query: {query_text}")
    logger.info(f"Knowledge bases: {knowledge_bases}")
    
    if not query_text:
        return {"status": "error", "message": "Query text is required"}
    
    try:
        results = kb_manager.query_knowledge_base(
            workspace_id,
            query_text,
            knowledge_bases,
            top_k
        )
        
        formatted_results = []
        for result in results:
            formatted_results.append({
                "source": result["source"],
                "text": result["text"],
                "score": result["score"],
                "metadata": result["metadata"]
            })
        
        return {
            "status": "success", 
            "results": formatted_results
        }
    except Exception as e:
        logger.error(f"Error retrieving from knowledge base: {str(e)}")
        return {"status": "error", "message": str(e)}