# Getting Started

Welcome to Onlysaid! This guide will help you set up and start using the platform to complete tasks with natural language.

## Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v13 or higher)
- **Git** for cloning the repository
- **OpenAI API Key** (or other supported LLM provider)

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/spoonbobo/onlysaid.git
   cd onlysaid
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/onlysaid

   # OpenAI
   OPENAI_API_KEY=your_openai_api_key_here

   # Application
   NEXTAUTH_SECRET=your_secret_here
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Database Setup**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start the Application**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to access Onlysaid!

## Project Structure

```
onlysaid/
├── app/                    # Next.js app directory
├── components/             # React components
├── stores/                 # Zustand state management
│   ├── User/              # User-related stores
│   ├── Workspace/         # Workspace management
│   └── Topic/             # Topic/conversation stores
├── lib/                   # Utility functions
├── db/                    # Database migrations and seeds
├── mcp-servers/           # MCP server implementations
└── docs/                  # Documentation
```

## First Steps

### 1. Create Your First Workspace

1. Sign up or log in to Onlysaid
2. Click "Create Workspace"
3. Give your workspace a name and description
4. Invite team members (optional)

### 2. Start Your First Conversation

1. Navigate to your workspace
2. Click "New Topic" to start a conversation
3. Type your task in natural language, for example:
   - "Create a project plan for a mobile app"
   - "Analyze the latest sales data"
   - "Help me write a blog post about AI"

### 3. Work with Agents

Onlysaid agents will automatically:

- Understand your request
- Break it down into actionable steps
- Execute tasks using available tools
- Provide updates and results

### 4. Configure Trust Mode

- **High Trust**: Agents execute tasks automatically
- **Medium Trust**: Agents ask for confirmation on important actions
- **Low Trust**: You approve each step manually

## Configuration

### Agent Settings

Access agent configuration through:

1. Workspace Settings → Agents
2. Configure individual agent capabilities
3. Set trust levels and permissions
4. Enable/disable specific MCP servers

### MCP Server Management

Available servers can be configured in:

1. Settings → MCP Servers
2. Enable/disable servers as needed
3. Configure server-specific settings
4. Monitor server status and logs

## Development Setup

For developers wanting to contribute or customize:

### Local Development

1. **Frontend Development**

   ```bash
   npm run dev:frontend
   ```

2. **Backend Development**

   ```bash
   npm run dev:backend
   ```

3. **Database Development**
   ```bash
   npm run db:studio  # Open database GUI
   npm run db:reset   # Reset database
   ```

### Adding Custom MCP Servers

1. Create a new server in `mcp-servers/`
2. Implement the MCP protocol interface
3. Register the server in the configuration
4. Test with the development environment

## Next Steps

- Explore [Use Cases](use-cases.md) for inspiration
- Learn about [Agentic](agentic.md) capabilities
- Check out [Query](query.md) and [Ask](ask.md) features
- Review [FAQ](faq.md) for common questions

## Need Help?

- Check the [FAQ](faq.md)
- Report issues on [GitHub](https://github.com/spoonbobo/onlysaid/issues)
- Join our community discussions
- Contact support for enterprise needs
