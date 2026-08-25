import type { ProjectConfig, TaskDefinition, WebsiteMapSnapshot, WorkflowDefinition } from "../types";
import { AuthenticationError, NetworkError } from "../errors";
import { normalizeProjectConfig } from "../config/schema";
import type { CloudTransport, ConversationReply } from "./types";

export class CloudClient {
  constructor(
    private readonly transport: CloudTransport,
    private readonly projectId: string,
  ) {}

  async fetchConfig(): Promise<ProjectConfig> {
    const response = await this.transport.request<{ config?: unknown }> ({
      path: `/v1/projects/${encodeURIComponent(this.projectId)}/config`,
      method: "GET",
    });
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError("Project credentials were rejected");
    }
    if (!response.ok || !response.data) {
      throw new NetworkError("Project configuration could not be loaded");
    }
    return normalizeProjectConfig(response.data.config ?? response.data);
  }

  async requestTask(userText: string, pageUrl: string): Promise<TaskDefinition> {
    const response = await this.transport.request<{ task?: TaskDefinition }>({
      path: "/v1/tasks",
      method: "POST",
      body: {
        projectId: this.projectId,
        text: userText,
        pageUrl,
      },
    });
    if (!response.ok || !response.data?.task?.id || !Array.isArray(response.data.task.steps)) {
      throw new NetworkError("Task planning is unavailable");
    }
    return response.data.task;
  }

  async fetchWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const response = await this.transport.request<{ workflow?: WorkflowDefinition }>({
      path: `/v1/workflows/${encodeURIComponent(workflowId)}`,
      method: "GET",
    });
    if (!response.ok || !response.data?.workflow?.id || !Array.isArray(response.data.workflow.steps)) {
      throw new NetworkError("Workflow is unavailable");
    }
    return response.data.workflow;
  }

  async sendConversationMessage(
    text: string,
    pageUrl: string,
  ): Promise<ConversationReply> {
    const response = await this.transport.request<ConversationReply>({
      path: "/v1/conversations/messages",
      method: "POST",
      body: { projectId: this.projectId, text, pageUrl },
    });
    if (!response.ok || !response.data?.message?.text) {
      throw new NetworkError("Conversation service is unavailable");
    }
    return response.data;
  }

  async sendWebsiteMap(snapshot: WebsiteMapSnapshot): Promise<void> {
    await this.safePost("/v1/website-maps", snapshot);
  }

  async sendAnalytics(events: unknown[]): Promise<void> {
    await this.safePost("/v1/analytics", { events });
  }

  async sendTaskUpdate(taskId: string, status: string, stepId?: string): Promise<void> {
    await this.safePost(`/v1/tasks/${encodeURIComponent(taskId)}/events`, {
      status,
      stepId,
    });
  }

  private async safePost(path: string, body: unknown): Promise<void> {
    try {
      await this.transport.request({ path, method: "POST", body });
    } catch {
      // Cloud ingestion failures are swallowed at the transport caller.
    }
  }
}
