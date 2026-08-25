export interface CloudRequest {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

export interface CloudResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

export interface CloudTransport {
  request<T>(req: CloudRequest): Promise<CloudResponse<T>>;
}

export interface ConfigResponse {
  config: unknown;
}

export interface TaskPlanResponse {
  task: unknown;
}

export interface WorkflowResponse {
  workflow: unknown;
}

export interface ConversationReply {
  conversationId: string;
  message: { role: "assistant"; text: string };
}
