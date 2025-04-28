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

# Dependency to get the KB manager from app state
def get_kb_manager(request: Request):
    return request.app.state.kb_manager

@router.get("/api/list_documents/{team_id}")
async def list_documents(request: Request, team_id: str) -> Dict[str, Any]:
    """
    List all available knowledge base sources, folder structures, and documents.
    """
    kb_manager = request.app.state.kb_manager
    data_sources = kb_manager.get_data_sources(team_id)
    logger.info(data_sources)
    
    # Prepare response structure compatible with the frontend
    response = {
        "dataSources": data_sources,
        "folderStructures": {},
        "documents": {}
    }
    
    # Add folder structures and documents for each source
    for source in data_sources:
        source_id = source["id"]
        response["folderStructures"][source_id] = kb_manager.get_folder_structure(source_id, team_id)
        response["documents"][source_id] = kb_manager.get_documents(source_id)
    
    return response

@router.post("/api/register_kb")
async def register_kb(request: Request, kb_item: KnowledgeBaseRegistration) -> Dict[str, Any]:
    """
    Register a new knowledge base for processing
    """
    kb_manager = request.app.state.kb_manager
    result = kb_manager.register_knowledge_base(kb_item)
    return result

@router.get("/api/kb_status/{team_id}/{kb_id}")
async def kb_status(request: Request, team_id: str, kb_id: str) -> KnowledgeBaseStatus:
    """
    Check the status of a knowledge base
    """
    kb_manager = request.app.state.kb_manager
    status = kb_manager.get_kb_status(kb_id, team_id)
    
    return KnowledgeBaseStatus(
        id=kb_id,
        status=status,
        message=None  # Could add more detailed messages in the future
    )

@router.post("/api/sync")
async def kb_sync(request: Request) -> Dict[str, Any]:
    """
    Synchronize the knowledge base.
    """
    kb_manager = request.app.state.kb_manager
    
    # Only reload documents for registered knowledge bases
    for kb_id, status in kb_manager._kb_status.items():
        if status == "running":
            try:
                # Re-initialize the reader if it exists
                if kb_id in kb_manager.readers:
                    reader = kb_manager.readers[kb_id]
                    docs = reader.load_documents()
                    kb_manager.documents[kb_id] = docs
                    kb_manager.folder_structure[kb_id] = kb_manager._build_folder_structure(docs)
                    
                    # Recreate the index
                    await asyncio.to_thread(kb_manager.create_indices, kb_id)
                    logger.info(f"Reloaded documents and recreated index for KB {kb_id}")
            except Exception as e:
                logger.error(f"Error reloading documents for KB {kb_id}: {str(e)}")
                kb_manager._kb_status[kb_id] = "error"
    
    return {"status": "success", "message": "Knowledge base synchronized"}

async def cleanup_session(kb_manager, session_id):
    """Clean up session data after streaming ends"""
    kb_manager.remove_message(session_id)

async def stream_tokens(kb_manager, query, session_id):
    """Generate server-sent events for streaming tokens with disconnect handling"""
    accumulated_content = ""
    
    # Send initial event
    yield "event: start\ndata: {}\n\n"
    gen = await kb_manager.stream_answer_with_context(query)
    
    try:
        # Use the async streaming method
        async for chunk in gen:
            logger.info(f"Chunk received: {chunk}")
            # Extract the text from the CompletionResponse object
            if hasattr(chunk, 'delta'):
                token = chunk.delta
            elif hasattr(chunk, 'text'):
                token = chunk.text
            elif isinstance(chunk, dict) and 'text' in chunk:
                token = chunk['text']
            elif isinstance(chunk, str):
                token = chunk
            else:
                # Log the unexpected type for debugging
                logger.warning(f"Unexpected token type: {type(chunk)}, value: {chunk}")
                token = str(chunk)
                
            accumulated_content += token
            
            # Update stored content
            kb_manager.update_message_content(session_id, accumulated_content)
            
            data = json.dumps({"token": token})
            yield f"event: token\ndata: {data}\n\n"
            
            # Small delay to prevent overwhelming the client
            await asyncio.sleep(0.01)
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
        # We'll mark the session as complete even on error
    finally:
        # Mark session as complete
        if session_id in kb_manager._message_store:
            kb_manager._message_store[session_id]["is_complete"] = True
        
        # Send completion event
        yield "event: end\ndata: {}\n\n"

@router.post("/api/update_kb_status")
async def update_kb_status(request: Request, kb_data: dict) -> Dict[str, Any]:
    """
    Enable or disable a knowledge base
    """
    kb_manager = request.app.state.kb_manager
    kb_id = kb_data.get("id")
    enabled = kb_data.get("enabled")
    team_id = kb_data.get("team_id")
    
    if not kb_id:
        return {"status": "error", "message": "Knowledge base ID is required"}
    
    result = kb_manager.update_kb_status(kb_id, enabled, team_id)
    return result

@router.post("/api/delete_kb")
async def delete_kb(request: Request, kb_data: dict) -> Dict[str, Any]:
    """
    Delete a knowledge base completely
    """
    kb_manager = request.app.state.kb_manager
    kb_id = kb_data.get("id")
    team_id = kb_data.get("team_id")
    
    if not kb_id:
        return {"status": "error", "message": "Knowledge base ID is required"}
    
    result = kb_manager.delete_knowledge_base(kb_id, team_id)
    return result

@router.post("/api/query")
async def query_knowledge_base(request: Request, query: QueryRequest):
    kb_manager = request.app.state.kb_manager
    logger.info(f"Query received: {query}")
    if query.streaming:
        # Generate a unique ID for this streaming session
        session_id = f"stream_{os.urandom(8).hex()}"
        
        # Store the query parameters for potential reconnection
        kb_manager.store_message(session_id, {
            "query": query.dict(),
            "current_content": "",
            "is_complete": False
        })
        
        # Return a streaming response with cleanup task
        return StreamingResponse(
            stream_tokens(kb_manager, query, session_id),
            media_type="text/event-stream",
            background=BackgroundTask(cleanup_session, kb_manager, session_id)
        )
    else:
        # Return a regular JSON response
        answer = kb_manager.answer_with_context(query)
        return {"status": "success", "results": answer}

@router.get("/api/stream")
async def stream_knowledge_base(
    request: Request,
    team_id: str,
    query: str,
    message_id: Optional[str] = None,
    conversation_history: Optional[str] = "",
    preferred_language: str = "en",
    top_k: int = 5
):
    kb_manager = request.app.state.kb_manager
    
    # Create a QueryRequest object from the GET parameters
    query_request = QueryRequest(
        team_id=team_id,
        query=query,
        conversation_history=conversation_history,
        streaming=True,
        top_k=top_k,
        preferred_language=preferred_language,
        message_id=message_id
    )
    
    logger.info(f"Stream request received: {query_request}")
    
    # Generate a unique ID for this streaming session
    session_id = f"stream_{os.urandom(8).hex()}"
    
    # Store the query parameters for potential reconnection
    kb_manager.store_message(session_id, {
        "query": query_request.dict(),
        "current_content": "",
        "is_complete": False
    })
    
    # Return a streaming response with cleanup task
    return StreamingResponse(
        stream_tokens(kb_manager, query_request, session_id),
        media_type="text/event-stream",
        background=BackgroundTask(cleanup_session, kb_manager, session_id)
    )

@router.post("/api/retrieve")
async def retrieve_from_knowledge_base(request: Request, query_data: dict) -> Dict[str, Any]:
    """
    Retrieve relevant documents from the knowledge base without generating an answer
    
    Args:
        query_data: Dictionary containing query text, knowledge_bases (optional), and top_k (optional)
    
    Returns:
        List of retrieved documents with their scores and metadata
    """
    kb_manager = request.app.state.kb_manager
    
    query_text = query_data.get("query")
    knowledge_bases = query_data.get("knowledge_bases")
    top_k = query_data.get("top_k", 5)
    team_id = query_data.get("team_id")
    
    logger.info(f"Retrieving from knowledge base for team {team_id} with query: {query_text}")
    logger.info(f"Knowledge bases: {knowledge_bases}")
    
    if not query_text:
        return {"status": "error", "message": "Query text is required"}
    
    try:
        # Use the existing query_knowledge_base method to retrieve documents
        results = kb_manager.query_knowledge_base(
            team_id,
            query_text,
            knowledge_bases,
            top_k
        )
        
        # Format the results for the API response
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
