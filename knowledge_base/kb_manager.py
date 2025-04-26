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

from schemas.document import Folder, DataSource, KnowledgeBaseRegistration
from schemas.document import QueryRequest
from readers.base_reader import BaseReader
from readers.local_store_reader import LocalStoreReader
from prompts.lang import lng_map, lng_prompt

class KBManager:
    """
    Manages configurable data sources
    Communicates with qdrant
    """
    sources: Dict[str, type[BaseReader]] = {
        "local_store": LocalStoreReader
        # Other sources are disabled for now
    }

    def __init__(
        self,
        qdrant_client: QdrantClient
    ):
        self.qdrant_client = qdrant_client
        self.documents = {}
        self.folder_structure = {}
        self.readers = {}
        self.indices = {}
        self.embed_model = OllamaEmbedding(
            model_name=os.getenv("EMBED_MODEL"),
            base_url=os.getenv("OLLAMA_API_BASE_URL")
        )
        self.llm = DeepSeek(
            model=os.getenv("OPENAI_MODEL"),
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Add message store for streaming resumption
        self._message_store = {}
        
        # Add knowledge base status tracking
        self._kb_status = {}
        self._kb_queue = asyncio.Queue()
        
        # Start the background task for processing KB registrations
        asyncio.create_task(self._process_kb_queue())
    
    async def _process_kb_queue(self):
        """Background task to process knowledge base registrations"""
        while True:
            try:
                kb_item = await self._kb_queue.get()
                logger.info(f"Processing KB registration: {kb_item.id}")
                
                # Update status to initializing
                self._kb_status[kb_item.id] = "initializing"
                
                # Configure the reader based on the source type
                if kb_item.source_type not in self.sources:
                    logger.error(f"Unknown source type: {kb_item.source_type}")
                    self._kb_status[kb_item.id] = "error"
                    continue
                
                # Create a config for this specific KB
                kb_config = {}
                
                # Handle different source types
                if kb_item.source_type == "local_store":
                    # Ensure the path exists and is accessible
                    if not kb_item.url:
                        logger.error(f"No path provided for local_store KB {kb_item.id}")
                        self._kb_status[kb_item.id] = "error"
                        continue
                    
                    # Normalize path
                    path = os.path.normpath(kb_item.url)
                    if not os.path.exists(path):
                        logger.error(f"Path does not exist: {path} for KB {kb_item.id}")
                        self._kb_status[kb_item.id] = "error"
                        continue
                    
                    kb_config["path"] = path
                else:
                    # Handle other source types
                    kb_config["url"] = kb_item.url
                
                # Initialize the reader
                try:
                    reader = self.sources[kb_item.source_type]()
                    reader.configure(kb_config)
                    
                    # Load documents
                    docs = reader.load_documents()
                    self.readers[kb_item.id] = reader
                    self.documents[kb_item.id] = docs
                    self.folder_structure[kb_item.id] = self._build_folder_structure(docs)
                    
                    # Create index for this KB
                    await asyncio.to_thread(self.create_indices, kb_item.id)
                    
                    # Update status to running
                    self._kb_status[kb_item.id] = "running"
                    logger.info(f"KB {kb_item.id} is now running")
                except Exception as e:
                    logger.error(f"Error processing KB {kb_item.id}: {str(e)}")
                    self._kb_status[kb_item.id] = "error"
            except Exception as e:
                logger.error(f"Error in KB queue processing: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying
    
    def register_knowledge_base(self, kb_item: KnowledgeBaseRegistration):
        """Register a new knowledge base and queue it for processing"""
        # Set initial status as disabled
        self._kb_status[kb_item.id] = "disabled"
        
        # Store the KB name for display purposes
        if not hasattr(self, 'kb_names'):
            self.kb_names = {}
        self.kb_names[kb_item.id] = kb_item.name or kb_item.id
        
        # Add to processing queue
        asyncio.create_task(self._kb_queue.put(kb_item))
        
        return {"status": "queued", "id": kb_item.id}
    
    def get_kb_status(self, kb_id: str):
        """Get the status of a knowledge base"""
        if kb_id not in self._kb_status:
            return "not_found"
        
        return self._kb_status[kb_id]
    
    
    def create_indices(self, source_name=None):
        """
        Create vector indices for document sources and store in Qdrant
        
        Args:
            source_name: Optional specific source to create index for (or create all if None)
        
        Returns:
            Dictionary of created indices
        """
        sources_to_index = [source_name] if source_name else self.documents.keys()
        
        for src_name in sources_to_index:
            if src_name not in self.documents:
                logger.warning(f"Source {src_name} not found in documents")
                continue
                
            docs = self.documents[src_name]
            logger.info(f"Creating index for {src_name} with {len(docs)} documents")
            
            # Extract original llama_index documents
            original_docs = [doc.original_doc for doc in docs if hasattr(doc, 'original_doc')]
            
            if not original_docs:
                logger.warning(f"No original documents found for {src_name}")
                continue
                
            # Create Qdrant vector store
            collection_name = f"kb_{src_name}"
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=collection_name
            )
            
            # Create storage context
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            
            # Create index with Ollama embedding model
            index = VectorStoreIndex.from_documents(
                original_docs,
                storage_context=storage_context,
                embed_model=self.embed_model
            )
            
            self.indices[src_name] = index
            logger.info(f"Successfully created index for {src_name} in Qdrant collection '{collection_name}'")
        
        return self.indices

    def generate_context(self, query_text: str, knowledge_bases: Optional[List[str]] = None, top_k: int = 5):
       """
       Generate context from knowledge base for LLM augmentation
       
       Args:
           query_text: The query string
           knowledge_bases: List of knowledge base IDs to query (optional)
           top_k: Number of results to return
       
       Returns:
           Formatted context string
       """
       results = self.query_knowledge_base(query_text, knowledge_bases, top_k)
       
       context = "Relevant information:\n\n"
       logger.info(f"Results: {len(results)}")
       for i, result in enumerate(results):
           context += f"[Document {i+1}] {result['text']}\n\n"
        
       return context

    def query_knowledge_base(self, query_text: str, knowledge_bases: Optional[List[str]] = None, top_k: int = 5):
        """
        Query the knowledge base and return relevant documents
        
        Args:
            query_text: The query string
            knowledge_bases: List of knowledge base IDs to query (optional)
            top_k: Number of results to return
        
        Returns:
            List of retrieved documents with their scores
        """
        results = []
        
        # Determine which knowledge bases to query
        if knowledge_bases and len(knowledge_bases) > 0:
            # Filter to only include running knowledge bases from the provided list
            sources_to_query = [kb_id for kb_id in knowledge_bases 
                               if kb_id in self._kb_status and self._kb_status[kb_id] == "running"]
            
            # Log if any requested knowledge bases are not running
            not_running = [kb_id for kb_id in knowledge_bases if kb_id not in sources_to_query]
            if not_running:
                logger.warning(f"Some requested knowledge bases are not running: {not_running}")
        else:
            # If no specific knowledge bases are requested, query all running ones
            sources_to_query = [src for src in self.indices.keys() 
                               if src in self._kb_status and self._kb_status[src] == "running"]
        
        logger.info(f"Querying knowledge bases: {sources_to_query}")
        
        for source in sources_to_query:
            # Create index on demand if it doesn't exist
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
            
            # Extract nodes/documents from response
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes:
                    results.append({
                        "source": source,
                        "text": node.node.text,
                        "score": node.score,
                        "metadata": node.node.metadata
                    })
        
        # Sort by relevance score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    async def stream_answer_with_context(self, query: QueryRequest):
        """
        Stream an answer using RAG with async support
        """
        # Handle both string and list inputs
        query_text = query.query[-1] if isinstance(query.query, list) else query.query
        
        # Generate context based on the latest query and knowledge bases
        context = self.generate_context(query_text, query.knowledge_bases, query.top_k)
        
        prompt_template = lng_prompt[query.preferred_language]
        prompt = prompt_template.format(
            preferred_language=lng_map[query.preferred_language],
            context=context,
            conversation_history=query.conversation_history,
            query=query_text
        )
        
        # Stream tokens from the LLM
        return await self.llm.astream_complete(prompt)
    
    def answer_with_context(self, query: QueryRequest):
        """
        Generate an answer using RAG with synchronous support
        
        Args:
            query: The query request object
            
        Returns:
            The generated answer as a string
        """
        # Handle both string and list inputs
        query_text = query.query[-1] if isinstance(query.query, list) else query.query
        
        # Generate context based on the latest query and knowledge bases
        context = self.generate_context(query_text, query.knowledge_bases, query.top_k)
        
        prompt_template = lng_prompt[query.preferred_language]
        prompt = prompt_template.format(
            preferred_language=lng_map[query.preferred_language],
            context=context,
            conversation_history=query.conversation_history,
            query=query_text
        )
        
        # Get complete response from the LLM
        response = self.llm.complete(prompt)
        return response.text
    
    # Methods for message persistence
    def store_message(self, message_id: str, message_data: dict):
        """Store message data for potential resumption"""
        self._message_store[message_id] = message_data
        
        # Set expiration (optional) - remove after 30 minutes
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
        
        # First pass: identify all unique folders
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
        
        # Second pass: add files to their respective folders
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
            # Only include sources that are running (not disabled or in error state)
            if source_name in self._kb_status and self._kb_status[source_name] == "running":
                # Extract a more user-friendly name from the UUID
                display_name = source_name
                
                # Check if we have a stored name for this knowledge base
                if hasattr(self, 'kb_names') and source_name in self.kb_names:
                    display_name = self.kb_names[source_name]
                # Fallback to first part of UUID if no name is stored
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

    def update_kb_status(self, kb_id: str, enabled: bool):
        """Update the status of a knowledge base (enable/disable)"""
        if kb_id not in self._kb_status:
            logger.warning(f"Knowledge base {kb_id} not found")
            return {"status": "error", "message": "Knowledge base not found"}
        
        if enabled:
            # Only change to running if it was previously disabled (not in error state)
            if self._kb_status[kb_id] == "disabled":
                self._kb_status[kb_id] = "running"
                logger.info(f"Knowledge base {kb_id} enabled")
        else:
            # Disable the knowledge base
            if self._kb_status[kb_id] == "running":
                self._kb_status[kb_id] = "disabled"
                logger.info(f"Knowledge base {kb_id} disabled")
        
        return {"status": "success", "id": kb_id, "enabled": enabled}

    def delete_knowledge_base(self, kb_id: str):
        """Delete a knowledge base completely"""
        if kb_id not in self._kb_status:
            logger.warning(f"Knowledge base {kb_id} not found")
            return {"status": "error", "message": "Knowledge base not found"}
        
        try:
            # Remove from status tracking
            del self._kb_status[kb_id]
            
            # Remove from readers
            if kb_id in self.readers:
                del self.readers[kb_id]
            
            # Remove from documents
            if kb_id in self.documents:
                del self.documents[kb_id]
            
            # Remove from folder structure
            if kb_id in self.folder_structure:
                del self.folder_structure[kb_id]
            
            # Remove from indices and delete collection
            if kb_id in self.indices:
                # Delete the Qdrant collection
                collection_name = f"kb_{kb_id}"
                try:
                    self.qdrant_client.delete_collection(collection_name)
                    logger.info(f"Deleted Qdrant collection {collection_name}")
                except Exception as e:
                    logger.error(f"Error deleting Qdrant collection {collection_name}: {str(e)}")
                
                # Remove from indices
                del self.indices[kb_id]
            
            logger.info(f"Knowledge base {kb_id} deleted")
            return {"status": "success", "message": f"Knowledge base {kb_id} deleted"}
        except Exception as e:
            logger.error(f"Error deleting knowledge base {kb_id}: {str(e)}")
            return {"status": "error", "message": str(e)}
