// CData Embedded Cloud auth and MCP utilities

const MCP_BASE_URL = "https://mcp.cloud.cdata.com/mcp";

// Use proxy in development to avoid CORS, direct URL in production
// Check for dev server by port or DEV flag (custom hostnames may not set DEV correctly)
function isDevServer(): boolean {
  return import.meta.env.DEV || window.location.port === "8080";
}

const API_BASE_URL = isDevServer() ? "/cdata-api" : "https://cloud.cdata.com/api";

interface JWTPayload {
  tokenType: string;
  iat: number;
  exp: number;
  iss: string;
  sub: string;
}

function getCredentials() {
  return {
    accountId: import.meta.env.VITE_CDATA_ACCOUNT_ID || "",
    subscriberId: import.meta.env.VITE_CDATA_SUBSCRIBER_ID || "",
    privateKey: import.meta.env.VITE_CDATA_PRIVATE_KEY || "",
  };
}

export function hasCredentials(): boolean {
  const { accountId, subscriberId, privateKey } = getCredentials();
  return !!(accountId && subscriberId && privateKey);
}

// Check if crypto.subtle is available (requires secure context)
function isSecureContext(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

export async function generateJWT(): Promise<string> {
  // In non-secure contexts (HTTP on custom domains), use server-side JWT generation
  if (!isSecureContext()) {
    const response = await fetch("/api/jwt");
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate JWT from server");
    }
    const data = await response.json();
    return data.token;
  }

  // In secure contexts (HTTPS or localhost), generate JWT client-side
  const { accountId, subscriberId, privateKey } = getCredentials();

  if (!accountId || !subscriberId || !privateKey) {
    throw new Error("Missing CData credentials in environment variables");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7200; // 2 hours

  const payload: JWTPayload = {
    tokenType: "powered-by",
    iat: now,
    exp,
    iss: accountId,
    sub: subscriberId,
  };

  // Import the jose library for JWT signing
  const { SignJWT, importPKCS8 } = await import("jose");

  const key = await importPKCS8(privateKey, "RS256");

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256" })
    .sign(key);

  return token;
}

export function getMCPBaseURL(): string {
  return MCP_BASE_URL;
}

export function getAPIBaseURL(): string {
  return API_BASE_URL;
}

// MCP JSON-RPC types
interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

let requestId = 0;

export async function mcpRequest(
  token: string,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: ++requestId,
    method,
    params,
  };

  const response = await fetch(MCP_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status}`);
  }

  // Handle SSE response format
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");

    let data: MCPResponse | null = null;

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6); // Remove "data: " prefix
        if (jsonStr.trim()) {
          try {
            data = JSON.parse(jsonStr);
          } catch {
            // Continue to next line if parse fails
          }
        }
      }
    }

    if (!data) {
      throw new Error("No valid JSON data in SSE response");
    }

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }

  // Fallback to regular JSON response
  const data: MCPResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result;
}

export async function listMCPTools(token: string): Promise<MCPTool[]> {
  const result = await mcpRequest(token, "tools/list");
  return (result as { tools: MCPTool[] }).tools;
}

export async function callMCPTool(
  token: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await mcpRequest(token, "tools/call", { name, arguments: args });
  return result;
}

// REST API types
export interface QueryResultSchema {
  columnName: string;
  dataTypeName: string;
}

export interface QueryResult {
  schema: QueryResultSchema[];
  rows: unknown[][];
}

export interface APIQueryResponse {
  results: QueryResult[];
}

// REST API query function - direct SQL queries without MCP
export async function queryData(
  token: string,
  sql: string
): Promise<APIQueryResponse> {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Helper to convert query result to array of objects
export function queryResultToObjects<T>(result: QueryResult): T[] {
  const { schema, rows } = result;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    schema.forEach((col, i) => {
      obj[col.columnName] = row[i];
    });
    return obj as T;
  });
}

// Connection management types
export interface Connection {
  id: string;
  name: string;
  driver: string;
  iconUrl?: string;
  dateCreated?: string;
  dateModified?: string;
}

export interface ConnectionListResponse {
  connections: Connection[];
}

export interface ConnectionCreateResponse {
  url?: string;
  URL?: string;
  redirectUrl?: string;
  link?: string;
}

// List all connections for the subscriber
// Endpoint: GET /poweredby/connection/list
export async function listConnections(token: string): Promise<Connection[]> {
  const response = await fetch(`${API_BASE_URL}/poweredby/connection/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list connections: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Connection list API response:", JSON.stringify(data, null, 2));
  // API returns array of connections directly or in a connections property
  const connections = Array.isArray(data) ? data : (data.connections || []);
  return connections.map((conn: { id: string; name: string; dataSource?: string; driver?: string; iconUrl?: string; icon?: string; logoUrl?: string }) => ({
    id: conn.id,
    name: conn.name,
    driver: conn.dataSource || conn.driver || "",
    iconUrl: conn.iconUrl || conn.icon || conn.logoUrl,
  }));
}

// Delete a connection by ID
// Endpoint: DELETE /poweredby/connection/delete/{id}
export async function deleteConnection(token: string, connectionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/poweredby/connection/delete/${connectionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete connection: ${response.status} - ${errorText}`);
  }
}

// Get connection creation URL for a specific driver
export async function getConnectionCreateURL(
  token: string,
  dataSource: string,
  connectionName: string,
  redirectUrl?: string
): Promise<string> {
  // Use current page URL as redirect if not specified
  const redirect = redirectUrl || window.location.origin + window.location.pathname;

  const response = await fetch(`${API_BASE_URL}/poweredby/connection/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dataSource,
      name: connectionName,
      redirectURL: redirect,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get connection URL: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Connection create API response:", JSON.stringify(data, null, 2));

  // Try different possible field names for the URL
  const url = data.redirectURL || data.url || data.URL || data.redirectUrl || data.link || data.connectionUrl;
  if (!url) {
    throw new Error(`API response missing URL field. Response: ${JSON.stringify(data)}`);
  }
  return url;
}

// Get generic connection picker URL (no specific driver - shows all available sources)
export async function getGenericConnectionURL(
  token: string,
  redirectUrl?: string
): Promise<string> {
  // Use current page URL as redirect if not specified
  const redirect = redirectUrl || window.location.origin + window.location.pathname;

  const response = await fetch(`${API_BASE_URL}/poweredby/connection/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      redirectURL: redirect,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get connection URL: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("Generic connection create API response:", JSON.stringify(data, null, 2));

  // Try different possible field names for the URL
  const url = data.redirectURL || data.url || data.URL || data.redirectUrl || data.link || data.connectionUrl;
  if (!url) {
    throw new Error(`API response missing URL field. Response: ${JSON.stringify(data)}`);
  }
  return url;
}

// Get logo URL for a data source from CData Azure CDN
export function getDataSourceLogoURL(driver: string): string {
  // CData serves driver icons from Azure CDN with original casing
  // Examples: GoogleDrive, Snowflake, Salesforce
  return `https://cdata-cloudprod.azureedge.net/driver-icons/${driver}.svg`;
}
