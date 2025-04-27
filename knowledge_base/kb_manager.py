from typing import Dict, AsyncGenerator, List, Optional
import os
import uuid
import json
import asyncio
import time

from qdrant_client import QdrantClient
from loguru import logger
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.qdrant import QdrantVectorStore # type: ignore
from llama_index.embeddings.ollama import OllamaEmbedding # type: ignore
from llama_index.core.llms import ChatMessage
from llama_index.llms.deepseek import DeepSeek # type: ignore
from redis import RedisCluster

from schemas.document import Folder, DataSource, KnowledgeBaseRegistration
from schemas.document import QueryRequest
from readers.base_reader import BaseReader
from readers.local_store_reader import LocalStoreReader
from prompts.lang import lng_map, lng_prompt

class KBManager:
    """Manages configurable data sources and communicates with qdrant"""
    sources: Dict[str, type[BaseReader]] = {
        "local_store": LocalStoreReader
    }

    def __init__(
        self,
        qdrant_client: QdrantClient
    ):
        self.qdrant_client = qdrant_client
        self.embed_model = OllamaEmbedding(
            model_name=os.getenv("EMBED_MODEL"),
            base_url=os.getenv("OLLAMA_API_BASE_URL")
        )
        self.llm = DeepSeek(
            model=os.getenv("OPENAI_MODEL"),
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # TODO: replace with envs
        redis_host = "redis-node-5"
        redis_port = 6379
        redis_password = "bitnami"
        
        self.redis_client = RedisCluster( # type: ignore
            host=redis_host,
            port=redis_port,
            password=redis_password,
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True,
            health_check_interval=30
        )
        
        self.redis_client.ping()
        logger.info("Redis client connected")
            
        self._message_store = {}
        self.documents = {}
        self.folder_structure = {}
        self.readers = {}
        self.indices = {}
        self._kb_queue = asyncio.Queue()
        
        asyncio.create_task(self._process_kb_queue())
    
    async def _process_kb_queue(self):
        """Background task to process knowledge base registrations"""
        while True:
            try:
                kb_item = await self._kb_queue.get()
                logger.info(f"Processing KB registration: {kb_item.id}")
                
                self._set_kb_status(kb_item.team_id, kb_item.id, "initializing")
                
                if kb_item.source_type not in self.sources:
                    logger.error(f"Unknown source type: {kb_item.source_type}")
                    self._set_kb_status(kb_item.team_id, kb_item.id, "error")
                    continue
                
                kb_config = {}
                
                if kb_item.source_type == "local_store":
                    if not kb_item.url:
                        logger.error(f"No path provided for local_store KB {kb_item.id}")
                        self._set_kb_status(kb_item.team_id, kb_item.id, "error")
                        continue
                    
                    path = os.path.normpath(kb_item.url)
                    if not os.path.exists(path):
                        logger.error(f"Path does not exist: {path} for KB {kb_item.id}")
                        self._set_kb_status(kb_item.team_id, kb_item.id, "error")
                        continue
                    
                    kb_config["path"] = path
                else:
                    kb_config["url"] = kb_item.url
                
                try:
                    reader = self.sources[kb_item.source_type]()
                    reader.configure(kb_config)
                    
                    docs = reader.load_documents()
                    self.readers[kb_item.id] = reader
                    self.documents[kb_item.id] = docs
                    self.folder_structure[kb_item.id] = self._build_folder_structure(docs)
                    
                    await asyncio.to_thread(self.create_indices, kb_item.id)
                    
                    self._set_kb_status(kb_item.team_id, kb_item.id, "running")
                    logger.info(f"KB {kb_item.id} is now running")
                except Exception as e:
                    logger.error(f"Error processing KB {kb_item.id}: {str(e)}")
                    self._set_kb_status(kb_item.team_id, kb_item.id, "error")
            except Exception as e:
                logger.error(f"Error in KB queue processing: {str(e)}")
                await asyncio.sleep(5)
    
    def _get_kb_status_key(self, team_id: str, kb_id: str) -> str:
        """Generate Redis key for KB status"""
        return f"kb:{team_id}:{kb_id}:status"
    
    def _set_kb_status(self, team_id: str, kb_id: str, status: str) -> None:
        """Set KB status in Redis"""
        key = self._get_kb_status_key(team_id, kb_id)
        self.redis_client.set(key, status)
    
    def _get_kb_status(self, team_id: str, kb_id: str) -> str:
        """Get KB status from Redis"""
        key = self._get_kb_status_key(team_id, kb_id)
        status = self.redis_client.get(key)
        return status if status else "not_found"
    
    def register_knowledge_base(self, kb_item: KnowledgeBaseRegistration):
        """Register a new knowledge base and queue it for processing"""
        self._set_kb_status(kb_item.team_id, kb_item.id, "disabled")
        
        if not hasattr(self, 'kb_names'):
            self.kb_names = {}
        self.kb_names[kb_item.id] = kb_item.name or kb_item.id
        
        asyncio.create_task(self._kb_queue.put(kb_item))
        
        return {"status": "queued", "id": kb_item.id}
    
    def get_kb_status(self, kb_id: str, team_id: str = "default"):
        """Get the status of a knowledge base"""
        return self._get_kb_status(team_id, kb_id)
    
    def create_indices(self, source_name=None):
        """Create vector indices for document sources and store in Qdrant"""
        sources_to_index = [source_name] if source_name else self.documents.keys()
        
        for src_name in sources_to_index:
            if src_name not in self.documents:
                logger.warning(f"Source {src_name} not found in documents")
                continue
                
            docs = self.documents[src_name]
            logger.info(f"Creating index for {src_name} with {len(docs)} documents")
            
            original_docs = [doc.original_doc for doc in docs if hasattr(doc, 'original_doc')]
            
            if not original_docs:
                logger.warning(f"No original documents found for {src_name}")
                continue
                
            collection_name = f"kb_{src_name}"
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=collection_name
            )
            
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            
            index = VectorStoreIndex.from_documents(
                original_docs,
                storage_context=storage_context,
                embed_model=self.embed_model
            )
            
            self.indices[src_name] = index
            logger.info(f"Successfully created index for {src_name} in Qdrant collection '{collection_name}'")
        
        return self.indices

    def generate_context(self, query_text: str, knowledge_bases: Optional[List[str]] = None, top_k: int = 5):
       """Generate context from knowledge base for LLM augmentation"""
       results = self.query_knowledge_base(query_text, knowledge_bases, top_k)
       
       context = "Relevant information:\n\n"
       logger.info(f"Results: {len(results)}")
       for i, result in enumerate(results):
           context += f"[Document {i+1}] {result['text']}\n\n"
        
       return context

    def query_knowledge_base(self, query_text: str, knowledge_bases: Optional[List[str]] = None, top_k: int = 5):
        """Query the knowledge base and return relevant documents"""
        results = []
        
        if knowledge_bases and len(knowledge_bases) > 0:
            sources_to_query = []
            for kb_id in knowledge_bases:
                status = self._get_kb_status("default", kb_id)
                if status == "running":
                    sources_to_query.append(kb_id)
            
            not_running = [kb_id for kb_id in knowledge_bases if kb_id not in sources_to_query]
            if not_running:
                logger.warning(f"Some requested knowledge bases are not running: {not_running}")
        else:
            sources_to_query = []
            for src in self.indices.keys():
                status = self._get_kb_status("default", src)
                if status == "running":
                    sources_to_query.append(src)
        
        logger.info(f"Querying knowledge bases: {sources_to_query}")
        
        for source in sources_to_query:
            if source not in self.indices and source in self.documents:
                logger.info(f"Creating index for {source} on demand")
                self.create_indices(source)
                
            if source not in self.indices:
                logger.warning(f"Source {source} not found in indices")
                continue
                
            query_engine = self.indices[source].as_query_engine(
                similarity_top_k=top_k,
                llm=self.llm
            )
            response = query_engine.query(query_text)
            
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes:
                    results.append({
                        "source": source,
                        "text": node.node.text,
                        "score": node.score,
                        "metadata": node.node.metadata
                    })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    async def stream_answer_with_context(self, query: QueryRequest):
        """Stream an answer using RAG with async support"""
        query_text = query.query[-1] if isinstance(query.query, list) else query.query
        
        context = self.generate_context(query_text, query.knowledge_bases, query.top_k)
        
        prompt_template = lng_prompt[query.preferred_language]
        prompt = prompt_template.format(
            preferred_language=lng_map[query.preferred_language],
            context=context,
            conversation_history=query.conversation_history,
            query=query_text
        )
        
        return await self.llm.astream_complete(prompt)
    
    def answer_with_context(self, query: QueryRequest):
        """Generate an answer using RAG with synchronous support"""
        query_text = query.query[-1] if isinstance(query.query, list) else query.query
        
        context = self.generate_context(query_text, query.knowledge_bases, query.top_k)
        
        prompt_template = lng_prompt[query.preferred_language]
        prompt = prompt_template.format(
            preferred_language=lng_map[query.preferred_language],
            context=context,
            conversation_history=query.conversation_history,
            query=query_text
        )
        
        response = self.llm.complete(prompt)
        return response.text
    
    def store_message(self, message_id: str, message_data: dict):
        """Store message data for potential resumption"""
        self._message_store[message_id] = message_data
        
        asyncio.create_task(self._expire_message(message_id, 1800))
    
    async def _expire_message(self, message_id: str, delay_seconds: int):
        """Remove message after delay"""
        await asyncio.sleep(delay_seconds)
        self.remove_message(message_id)
    
    def get_message_by_id(self, message_id: str):
        """Retrieve stored message data"""
        return self._message_store.get(message_id)
    
    def update_message_content(self, message_id: str, content: str):
        """Update the content of a stored message"""
        if message_id in self._message_store:
            self._message_store[message_id]["current_content"] = content
    
    def remove_message(self, message_id: str):
        """Remove a message from storage"""
        if message_id in self._message_store:
            del self._message_store[message_id]

    def _build_folder_structure(self, documents):
        """Build a hierarchical folder structure from document paths"""
        folders = {}
        root_folders = []
        
        for doc in documents:
            folder_id = doc.get("folderId", "") if isinstance(doc, dict) else doc.folderId
            if not folder_id:
                continue
                
            parts = folder_id.split('/')
            current_path = ""
            
            for i, part in enumerate(parts):
                if not part:
                    continue
                    
                parent_path = current_path
                current_path = os.path.join(current_path, part) if current_path else part
                
                if current_path not in folders:
                    folder = Folder(
                        id=current_path,
                        name=part,
                        folders=[],
                        files=[],
                        isOpen=False
                    )
                    folders[current_path] = folder
                    
                    if parent_path:
                        if parent_path in folders:
                            if folder not in folders[parent_path].folders:
                                folders[parent_path].folders.append(folder)
                    else:
                        if folder not in root_folders:
                            root_folders.append(folder)
        
        for doc in documents:
            doc_id = doc.get("id", "") if isinstance(doc, dict) else doc.id
            folder_id = doc.get("folderId", "") if isinstance(doc, dict) else doc.folderId
            if folder_id in folders:
                folders[folder_id].files.append(doc_id)
        
        return [folder.dict() for folder in root_folders]
    
    def get_data_sources(self):
        """Return information about available data sources"""
        sources = []
        for source_name, docs in self.documents.items():
            status = self._get_kb_status("default", source_name)
            if status == "running":
                display_name = source_name
                
                if hasattr(self, 'kb_names') and source_name in self.kb_names:
                    display_name = self.kb_names[source_name]
                elif "-" in source_name:
                    display_name = f"{source_name.split('-')[0]} KB"
                    
                source_info = DataSource(
                    id=source_name,
                    name=display_name,
                    icon="database",
                    count=len(docs)
                )
                sources.append(source_info.dict())
        return sources
    
    def get_folder_structure(self, source_id):
        """Return the folder structure for a specific source"""
        return self.folder_structure.get(source_id, [])
    
    def get_documents(self, source_id):
        """Return all documents for a specific source"""
        docs = self.documents.get(source_id, [])
        return [doc.dict() if hasattr(doc, 'dict') else doc for doc in docs]

    def update_kb_status(self, kb_id: str, enabled: bool, team_id: str):
        """Update the status of a knowledge base (enable/disable)"""
        current_status = self._get_kb_status(team_id, kb_id)
        if current_status == "not_found":
            logger.warning(f"Knowledge base {kb_id} not found")
            return {"status": "error", "message": "Knowledge base not found"}
        
        if enabled:
            if current_status == "disabled":
                self._set_kb_status(team_id, kb_id, "running")
                logger.info(f"Knowledge base {kb_id} enabled")
        else:
            if current_status == "running":
                self._set_kb_status(team_id, kb_id, "disabled")
                logger.info(f"Knowledge base {kb_id} disabled")
        
        return {"status": "success", "id": kb_id, "enabled": enabled}

    def delete_knowledge_base(self, kb_id: str, team_id: str = "default"):
        """Delete a knowledge base completely"""
        current_status = self._get_kb_status(team_id, kb_id)
        if current_status == "not_found":
            logger.warning(f"Knowledge base {kb_id} not found")
            return {"status": "error", "message": "Knowledge base not found"}
        
        try:
            key = self._get_kb_status_key(team_id, kb_id)
            self.redis_client.delete(key)
            
            if kb_id in self.readers:
                del self.readers[kb_id]
            
            if kb_id in self.documents:
                del self.documents[kb_id]
            
            if kb_id in self.folder_structure:
                del self.folder_structure[kb_id]
            
            if kb_id in self.indices:
                collection_name = f"kb_{kb_id}"
                try:
                    self.qdrant_client.delete_collection(collection_name)
                    logger.info(f"Deleted Qdrant collection {collection_name}")
                except Exception as e:
                    logger.error(f"Error deleting Qdrant collection {collection_name}: {str(e)}")
                
                del self.indices[kb_id]
            
            logger.info(f"Knowledge base {kb_id} deleted")
            return {"status": "success", "message": f"Knowledge base {kb_id} deleted"}
        except Exception as e:
            logger.error(f"Error deleting knowledge base {kb_id}: {str(e)}")
            return {"status": "error", "message": str(e)}
