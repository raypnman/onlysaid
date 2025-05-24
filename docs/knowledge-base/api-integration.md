# API Integration

Learn how to integrate the Onlysaid Knowledge Base with external tools and systems using our comprehensive API.

## API Overview

### Authentication

- **API Keys**: Generate and manage API keys for secure access
- **OAuth 2.0**: Use OAuth for user-based authentication
- **Rate Limiting**: Understand API usage limits and best practices

### Base URL and Endpoints

```
Base URL: https://api.onlysaid.com/v1/knowledge-base
```

## Core API Operations

### Document Management

```http
# Upload a document
POST /documents
Content-Type: multipart/form-data

# Get document metadata
GET /documents/{document_id}

# Update document
PUT /documents/{document_id}

# Delete document
DELETE /documents/{document_id}
```

### Search Operations

```http
# Basic search
GET /search?q={query}&limit={limit}&offset={offset}

# Advanced search with filters
POST /search
Content-Type: application/json
{
  "query": "search terms",
  "filters": {
    "file_type": ["pdf", "docx"],
    "tags": ["important", "project-alpha"],
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  }
}
```

### Collection Management

```http
# Create collection
POST /collections

# List collections
GET /collections

# Add document to collection
POST /collections/{collection_id}/documents
```

## Integration Examples

### Python SDK

```python
from onlysaid import KnowledgeBase

# Initialize client
kb = KnowledgeBase(api_key="your_api_key")

# Upload document
document = kb.upload_document(
    file_path="./document.pdf",
    tags=["important", "reference"],
    collection_id="collection_123"
)

# Search documents
results = kb.search(
    query="machine learning algorithms",
    filters={"file_type": ["pdf"]},
    limit=10
)
```

### JavaScript SDK

```javascript
import { KnowledgeBase } from "@onlysaid/sdk";

// Initialize client
const kb = new KnowledgeBase({ apiKey: "your_api_key" });

// Upload document
const document = await kb.uploadDocument({
  file: fileBlob,
  tags: ["important", "reference"],
  collectionId: "collection_123",
});

// Search documents
const results = await kb.search({
  query: "machine learning algorithms",
  filters: { fileType: ["pdf"] },
  limit: 10,
});
```

## Webhooks

### Event Types

- `document.created` - New document uploaded
- `document.updated` - Document modified
- `document.deleted` - Document removed
- `search.performed` - Search query executed

### Webhook Configuration

```http
POST /webhooks
Content-Type: application/json
{
  "url": "https://your-app.com/webhooks/knowledge-base",
  "events": ["document.created", "document.updated"],
  "secret": "your_webhook_secret"
}
```

## Best Practices

### Performance Optimization

1. **Batch Operations**: Use batch endpoints for multiple operations
2. **Pagination**: Implement proper pagination for large result sets
3. **Caching**: Cache frequently accessed documents and search results
4. **Compression**: Use gzip compression for large payloads

### Error Handling

- Implement exponential backoff for rate-limited requests
- Handle network timeouts gracefully
- Log API errors for debugging and monitoring
- Validate responses before processing

### Security

- Store API keys securely (environment variables, key management systems)
- Use HTTPS for all API communications
- Implement proper access controls in your application
- Regularly rotate API keys
