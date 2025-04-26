from typing import List, Dict
import os

from mcp.server.fastmcp import FastMCP
import httpx
from pathlib import Path

# TODO: this should be a variable
kb_url = "http://onlysaid-kb:35430"
mcp = FastMCP("rag")

@mcp.tool()
def query_knowledge_base(query: str, knowledge_bases: List[str] = []) -> str:
    """
    Query the knowledge base for the given query and return the answer.
    
    Args:
        query: The query to ask the knowledge base
        knowledge_bases: The list of knowledge bases to query
    
    Returns:
        The answer to the query
    """
    query_request = {
        "query": query,
        "knowledge_bases": knowledge_bases if knowledge_bases else None
    }
    
    try:
        # Add timeout parameter (in seconds)
        response = httpx.post(
            f"{kb_url}/api/query",
            json=query_request,
            timeout=60.0
        )
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        return response.json()
    except Exception as e:
        return f"An unexpected error occurred: {str(e)}"

@mcp.tool()
def retrieve_from_knowledge_base(query: str, knowledge_bases: List[str]) -> str:
    """
    Retrieve relevant documents from the knowledge base.
    
    Args:
        query: The search query
        knowledge_bases: The list of knowledge bases to search
        top_k: Maximum number of documents to retrieve
    
    Returns:
        The retrieved documents
    """
    retrieve_request = {
        "query": query,
        "knowledge_bases": None,
    }
    
    try:
        response = httpx.post(
            f"{kb_url}/api/retrieve",
            json=retrieve_request,
            timeout=60.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return f"An unexpected error occurred during retrieval: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport='stdio')
