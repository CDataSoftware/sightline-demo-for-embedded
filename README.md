# Sightline Insights Dashboard

A demo application showcasing **CData Embedded Cloud for AI** capabilities. This app demonstrates how to build AI-powered data experiences using CData's connectivity platform and the Model Context Protocol (MCP).

## Demo Credentials

| Email | Password | Role | Access |
|-------|----------|------|--------|
| `admin@mycompany.com` | any | Admin | Full access to all features and data |
| `user@mycompany.com` | any | User | Restricted schema access in Data Explorer |

## Features

### Dashboard
- Customer health metrics powered by Salesforce, Zendesk, and Snowflake
- Toggle data sources on/off to change which connections power the visualizations
- Real-time updates when data sources change

### Data Explorer
- SQL query interface with schema browser
- Role-based schema filtering (users see limited tables/columns)
- Save and manage queries

### AI Data Advisor (Admin only)
- Natural language interface to query enterprise data
- Agentic loop using Claude API with CData MCP tools
- No SQL knowledge required for end users

### Tickets
- Kanban board for tracking work items
- Expandable ticket list in sidebar navigation

### Settings
- Manage data source connections
- Add new connections via embedded authentication flows

## What This Demo Shows

### CData Embedded Cloud Integration
- JWT-based authentication using CData's "powered-by" token type
- MCP (Model Context Protocol) for AI tool access
- REST API for direct SQL queries
- Embedded authentication flows (OAuth, API keys, credentials) via CData's connection UI

## Demo Flow

1. **Login** — Sign in as admin or user to see different permission levels
2. **Authentication** — App generates a JWT using CData credentials and fetches available MCP tools
3. **Data Sources** — Toggle data sources on/off to change which data powers the dashboard
4. **Add Connection** — Use the "Add Data Source" button to demonstrate embedded source-native authentication
5. **Dashboard** — View customer health metrics that update based on enabled data sources
6. **Data Explorer** — Browse schema and run SQL queries (notice restricted access as user role)
7. **AI Data Advisor** — Ask questions in plain English, Claude uses CData MCP tools to query and summarize results

## Getting Started

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- CData Embedded Cloud account
- Anthropic API key

### Environment Variables

Create a `.env` file with:

```
VITE_CDATA_ACCOUNT_ID=your-account-id
VITE_CDATA_SUBSCRIBER_ID=your-subscriber-id
VITE_CDATA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
VITE_ANTHROPIC_API_KEY=your-anthropic-api-key
VITE_ANTHROPIC_MODEL=claude-sonnet-4-20250514  # optional
```

### Installation

```sh
npm install
npm run dev
```

## Using a Custom Domain (Optional)

For demos, you may want to use a vanity domain instead of `localhost`.

### Step 1: Add the domain to your hosts file

Edit your hosts file to point your custom domain to localhost:

**macOS/Linux:** `/etc/hosts`
**Windows:** `C:\Windows\System32\drivers\etc\hosts`

Add:
```
127.0.0.1   your-domain.com
```

### Step 2: Run the dev server with the custom host

```sh
npm run dev -- --host your-domain.com
```

Then access the app at `http://your-domain.com:8080`

### Step 3 (Optional): Enable HTTPS

HTTPS is required for CData's connection iframe to work on custom domains. The dev server automatically enables HTTPS if certificate files are present.

**Generate certificates with mkcert (recommended):**
```sh
# Install mkcert
brew install mkcert        # macOS
# or: sudo apt install mkcert  # Ubuntu/Debian

# Install local CA (one-time, requires sudo)
mkcert -install

# Create certificates in the project root
mkcert -key-file cdata.embedded.demo-key.pem -cert-file cdata.embedded.demo.pem \
  localhost your-domain.com 127.0.0.1 ::1
```

**Or generate with openssl:**
```sh
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout cdata.embedded.demo-key.pem \
  -out cdata.embedded.demo.pem \
  -days 365 \
  -subj "/CN=your-domain.com" \
  -addext "subjectAltName=DNS:localhost,DNS:your-domain.com"
```

Once the certificate files exist (`cdata.embedded.demo-key.pem` and `cdata.embedded.demo.pem`), restart the dev server and access:
```
https://your-domain.com:8080
```

**Note:** Self-signed certificates will show a browser warning. Click "Advanced" → "Proceed anyway", or add the certificate to your system's trusted certificates.

## Tech Stack

- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- Recharts for visualizations
- TanStack Query for data fetching
- CData Embedded Cloud for data connectivity
- Anthropic Claude API for AI chat
