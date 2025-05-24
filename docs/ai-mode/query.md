# 🔍 Query: Intelligent Search & Retrieval

The **Query** feature enables powerful search and information retrieval across your workspace, knowledge base, and connected data sources. Use it to find specific information, search through documents, and retrieve relevant data quickly.

## 📋 Quick Reference

- [How to Query](#how-to-query)
- [Search Scope](#search-scope)
- [Query Types](#query-types)
- [Search Filters](#search-filters)
- [Advanced Search](#advanced-search)

---

## How to Query

### Basic Search

Simple keyword searches across your workspace:

```
Query: "project timeline"
Query: "customer feedback Q3"
Query: "API documentation"
```

### Advanced Search Syntax

Use advanced operators for precise searches:

```
Query: "marketing AND strategy NOT outdated"
Query: "sales report OR revenue analysis"
Query: "title:meeting notes date:2024"
```

### Natural Language Queries

Ask questions in natural language:

```
Query: "What were the main outcomes of last week's team meeting?"
Query: "Show me all documents related to the product launch"
Query: "Find emails about the budget approval"
```

### Search Operators

#### Boolean Operators

- **AND**: Both terms must be present

  ```
  Query: "machine learning AND python"
  ```

- **OR**: Either term can be present

  ```
  Query: "React OR Vue OR Angular"
  ```

- **NOT**: Exclude specific terms
  ```
  Query: "meeting NOT cancelled"
  ```

#### Phrase Search

Use quotes for exact phrases:

```
Query: "quarterly business review"
Query: "customer satisfaction survey"
```

#### Wildcard Search

Use asterisk (\*) for partial matches:

```
Query: "develop*" (finds develop, development, developer, etc.)
Query: "market*" (finds market, marketing, marketplace, etc.)
```

---

## Search Scope

### Workspace Content

Query searches across all your workspace content:

#### Documents

- **PDFs**: Research papers, reports, manuals
- **Word Documents**: Proposals, specifications, meeting notes
- **Text Files**: Code documentation, README files, notes
- **Spreadsheets**: Data files, budgets, tracking sheets
- **Presentations**: Slide decks, training materials

#### Conversations

- **Chat History**: All previous conversations and discussions
- **Topic Discussions**: Organized conversation threads
- **Comments**: Annotations and feedback on documents
- **Meeting Transcripts**: Recorded meeting content

#### Files & Media

- **Images**: Screenshots, diagrams, photos with OCR text
- **Videos**: Transcribed content from video files
- **Audio**: Transcribed content from audio recordings
- **Archives**: Content within ZIP and compressed files

#### Code & Technical

- **Source Code**: All programming language files
- **Configuration**: Config files, environment settings
- **Documentation**: Technical docs, API references
- **Logs**: System logs and debug information

### Knowledge Base

Access your growing organizational knowledge:

#### Learned Information

- **Task Outcomes**: Results from previous AI tasks
- **Research Findings**: Accumulated research data
- **Best Practices**: Documented successful approaches
- **Lessons Learned**: Insights from past projects

#### External Sources

- **Web Research**: Information gathered from internet sources
- **API Data**: Data retrieved from connected services
- **Database Content**: Information from connected databases
- **Third-party Tools**: Data from integrated applications

#### Team Knowledge

- **Shared Insights**: Collective team discoveries
- **Expertise Areas**: Individual team member specializations
- **Project History**: Complete project documentation
- **Decision Records**: Historical decision-making context

### Connected Sources

Query external data sources when configured:

#### Cloud Storage

- **Google Drive**: Documents, sheets, presentations
- **Dropbox**: Files and shared folders
- **OneDrive**: Microsoft Office documents
- **Box**: Enterprise file storage

#### Databases

- **SQL Databases**: Structured data queries
- **NoSQL Databases**: Document and key-value stores
- **Data Warehouses**: Analytics and reporting data
- **APIs**: Real-time data from web services

#### Communication Tools

- **Slack**: Channel messages and direct messages
- **Microsoft Teams**: Chat and file content
- **Discord**: Server and channel discussions
- **Email**: Inbox and sent message content

---

## Query Types

### 1. Document Search

Find specific documents and files:

#### By File Type

```
Query: "Find all PDFs about machine learning"
Query: "Show me Excel files from last month"
Query: "Search for presentations containing 'quarterly results'"
```

#### By Content

```
Query: "Documents mentioning customer satisfaction"
Query: "Files containing budget information"
Query: "Reports with performance metrics"
```

#### By Metadata

```
Query: "Documents created by Sarah"
Query: "Files modified this week"
Query: "Large files over 10MB"
```

### 2. Content Search

Search within document content:

#### Text Search

```
Query: "Find mentions of 'customer satisfaction' in all reports"
Query: "Search for code examples using React hooks"
Query: "Show me all references to the new pricing model"
```

#### Contextual Search

```
Query: "Problems mentioned in customer feedback"
Query: "Solutions discussed in engineering meetings"
Query: "Decisions made in board meetings"
```

### 3. Semantic Search

Find conceptually related content:

#### Topic-Based

```
Query: "Find documents about improving team productivity"
Query: "Show me content related to user experience design"
Query: "Search for information about scaling challenges"
```

#### Intent-Based

```
Query: "How to reduce customer churn"
Query: "Best practices for remote work"
Query: "Strategies for market expansion"
```

### 4. Temporal Search

Search by time periods:

#### Recent Content

```
Query: "Show me all documents created this week"
Query: "Find conversations from the last sprint"
Query: "Search for files modified today"
```

#### Historical Content

```
Query: "Documents from Q1 2024"
Query: "Meetings from last month"
Query: "Files created before January"
```

#### Time Ranges

```
Query: "Content between March 1 and March 15"
Query: "Files modified in the last 30 days"
Query: "Conversations from this quarter"
```

### 5. Author/Source Search

Find content by creator or source:

#### By Person

```
Query: "Show me all documents created by Sarah"
Query: "Find content from the engineering team"
Query: "Search for John's meeting notes"
```

#### By Department

```
Query: "Marketing team documents"
Query: "Sales reports and presentations"
Query: "HR policies and procedures"
```

#### By Source

```
Query: "Information from external sources"
Query: "Content imported from Google Drive"
Query: "Data from customer surveys"
```

---

## Search Filters

### File Type Filters

Narrow results by file type:

#### Document Types

- `type:pdf` - PDF documents
- `type:doc` - Word documents
- `type:txt` - Text files
- `type:md` - Markdown files

#### Data Types

- `type:xlsx` - Excel spreadsheets
- `type:csv` - CSV data files
- `type:json` - JSON data files
- `type:xml` - XML files

#### Presentation Types

- `type:ppt` - PowerPoint presentations
- `type:key` - Keynote presentations
- `type:odp` - OpenDocument presentations

#### Code Types

- `type:js` - JavaScript files
- `type:py` - Python files
- `type:java` - Java files
- `type:cpp` - C++ files

#### Media Types

- `type:image` - Image files (JPG, PNG, GIF)
- `type:video` - Video files
- `type:audio` - Audio files

### Date Filters

Filter by creation or modification date:

#### Relative Dates

- `date:today` - Today's content
- `date:yesterday` - Yesterday's content
- `date:week` - This week's content
- `date:month` - This month's content
- `date:year` - This year's content

#### Specific Dates

- `date:2024-01-15` - Specific date
- `created:>2024-01-01` - Created after date
- `modified:<2024-12-31` - Modified before date

#### Date Ranges

- `date:2024-01-01..2024-01-31` - January 2024
- `modified:>2024-01-01 AND modified:<2024-02-01` - Modified in January

### Size Filters

Filter by file size:

#### Size Comparisons

- `size:>1MB` - Files larger than 1MB
- `size:<100KB` - Files smaller than 100KB
- `size:=0` - Empty files

#### Size Ranges

- `size:1MB..10MB` - Files between 1-10MB
- `size:>100KB AND size:<1MB` - Files between 100KB-1MB

### Tag Filters

Search by tags and categories:

#### Content Tags

- `tag:important` - Important content
- `tag:draft` - Draft documents
- `tag:final` - Final versions
- `tag:review` - Content under review

#### Project Tags

- `tag:project-alpha` - Project Alpha related
- `tag:meeting` - Meeting-related content
- `tag:research` - Research materials

#### Status Tags

- `tag:completed` - Completed items
- `tag:in-progress` - Work in progress
- `tag:pending` - Pending items

### Author Filters

Filter by content creator:

#### Individual Authors

- `author:john.doe` - Content by John Doe
- `author:sarah` - Content by Sarah
- `created-by:team-lead` - Content by team lead

#### Team Filters

- `team:engineering` - Engineering team content
- `department:marketing` - Marketing department
- `group:executives` - Executive team content

---

## Advanced Search

### Complex Query Construction

#### Multiple Conditions

```
Query: "marketing AND (strategy OR plan) AND date:2024 NOT draft"
```

#### Nested Searches

```
Query: "(customer feedback OR user review) AND (mobile app OR website) AND date:>2024-01-01"
```

#### Field-Specific Searches

```
Query: "title:quarterly AND content:revenue AND author:finance-team"
```

### Search Optimization

#### Use Specific Terms

- **Good**: `"Q4 sales performance analysis"`
- **Better**: `"Q4 2024 sales performance analysis revenue growth"`

#### Combine Keywords Strategically

- Use AND for required terms: `marketing AND strategy AND 2024`
- Use OR for alternatives: `revenue OR sales OR income`
- Use NOT to exclude: `meeting NOT cancelled`

#### Leverage Metadata

- Include file types: `budget spreadsheet type:xlsx`
- Specify dates: `project plan date:>2024-01-01`
- Use tags: `tag:urgent AND tag:review`

### Search Result Ranking

Results are ranked by:

1. **Relevance Score**: How well content matches your query
2. **Recency**: Newer content gets higher priority
3. **Usage Frequency**: Frequently accessed content ranks higher
4. **User Preferences**: Personalized based on your usage patterns
5. **Content Quality**: Well-structured content ranks higher

### Search Analytics

Track your search patterns:

- **Popular Queries**: Most frequently used search terms
- **Search Success Rate**: Percentage of searches that find relevant results
- **Click-through Patterns**: Which results are most useful
- **Search Refinement**: How often you modify searches

---

## Integration Features

### Query + Ask

Combine search with agent assistance:

```
1. Query: "Find all customer feedback about our mobile app"
2. Ask: "Analyze the feedback found and create an improvement plan"
```

### Query + Agentic

Use search results for agent tasks:

```
1. Query: "Latest market research reports"
2. Agentic: "Use these reports to create a competitive analysis"
```

### Saved Searches

Create reusable search queries:

```
Saved Search: "Weekly Team Updates"
Query: "tag:team-update AND date:week"

Saved Search: "Customer Issues"
Query: "(customer complaint OR bug report) AND tag:urgent"
```

### Search Alerts

Get notified when new content matches your criteria:

```
Alert: "New Customer Feedback"
Query: "customer feedback OR user review"
Frequency: Daily

Alert: "Project Updates"
Query: "tag:project-alpha AND (update OR progress)"
Frequency: Real-time
```

---

## Best Practices

### Effective Search Strategies

#### Start Broad, Then Narrow

1. Begin with general terms
2. Add specific filters based on initial results
3. Refine with additional keywords or operators

#### Use Multiple Search Approaches

- Try different keyword combinations
- Use both specific terms and synonyms
- Combine semantic and exact searches

#### Leverage Search History

- Review previous successful searches
- Build on queries that worked well
- Learn from searches that didn't find what you needed

### Query Optimization

#### Keyword Selection

- Use domain-specific terminology
- Include both technical and common terms
- Consider different ways to express the same concept

#### Filter Usage

- Apply relevant filters to reduce noise
- Use date filters for time-sensitive searches
- Combine multiple filters for precision

#### Result Evaluation

- Review result relevance and adjust queries
- Use feedback to improve future searches
- Save successful query patterns

---

## Troubleshooting

### Common Search Issues

#### No Results Found

**Causes**:

- Overly specific query
- Misspelled terms
- Content doesn't exist

**Solutions**:

- Broaden search terms
- Check spelling
- Try synonyms or related terms
- Remove some filters

#### Too Many Results

**Causes**:

- Overly broad query
- Common terms used
- Insufficient filtering

**Solutions**:

- Add more specific terms
- Use additional filters
- Narrow time range
- Add exclusion terms

#### Irrelevant Results

**Causes**:

- Ambiguous terms
- Insufficient context
- Poor keyword selection

**Solutions**:

- Use more specific terminology
- Add context with additional keywords
- Use phrase searches with quotes
- Apply content type filters

### Performance Optimization

#### Search Speed

- Use specific filters to reduce search scope
- Avoid overly complex queries
- Consider using saved searches for frequent queries

#### Result Quality

- Provide feedback on result relevance
- Use specific rather than generic terms
- Combine multiple search approaches

---

## 📚 Related Documentation

- [Ask](ask.md): Learn about natural language task execution
- [Agentic](agentic.md): Understand multi-agent coordination
- [Use Cases](../use-cases/README.md): Real-world Query examples
- [Getting Started](../getting-started.md): Initial setup and first steps
