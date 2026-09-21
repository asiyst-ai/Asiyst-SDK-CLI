import type { ProjectConfig, TaskDefinition, WebsiteMapSnapshot, WorkflowDefinition } from "../types";
import { AuthenticationError, NetworkError } from "../errors";
import { SDK_VERSION } from "../core/constants";
import { normalizeProjectConfig } from "../config/schema";
import type { CloudTransport, ConversationReply } from "./types";
import type { InstallationRegistration, InstallationRegistrationResponse } from "../installation/types";
import { RuntimeAuth, type RuntimeCapability } from "./RuntimeAuth";

export class CloudClient {
  constructor(
    private readonly transport: CloudTransport,
    private readonly projectId: string,
    private readonly publicKey = "",
    private readonly runtimeAuth?: RuntimeAuth,
  ) {}

  async fetchConfig(): Promise<ProjectConfig> {
    const response = await this.runtimeRequest<{ config?: unknown }> ({
      path: `/projects/${encodeURIComponent(this.projectId)}/avatar`,
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

  async heartbeat(metadata: {
    origin: string;
    environment: string;
    timestamp: string;
  }): Promise<{
    ok: boolean;
    status: number;
    verificationStatus?: "connected" | "verified" | "inactive" | "not_detected" | "error";
    versionOutdated?: boolean;
  }> {
    const response = await this.runtimeRequest<unknown>({
      path: "/sdk/heartbeat",
      method: "POST",
      body: {
        project_id: this.projectId,
        public_key: this.publicKey,
        sdk_version: SDK_VERSION,
        origin: metadata.origin,
        environment: metadata.environment,
        timestamp: metadata.timestamp,
      },
    }, "assistant:heartbeat");
    const body = response.data && typeof response.data === "object" && !Array.isArray(response.data)
      ? response.data as Record<string, unknown>
      : undefined;
    const rawStatus = body?.status ?? body?.connectionStatus ?? body?.verificationStatus ?? (body?.verified === true ? "verified" : undefined);
    const verificationStatus = rawStatus === "connected"
      || rawStatus === "verified"
      || rawStatus === "inactive"
      || rawStatus === "not_detected"
      || rawStatus === "error"
      ? rawStatus
      : undefined;
    const versionOutdated = body?.versionOutdated === true
      || body?.sdkVersionOutdated === true
      || rawStatus === "outdated";
    return {
      ok: response.ok && (verificationStatus === undefined || verificationStatus === "connected" || verificationStatus === "verified"),
      status: response.status,
      verificationStatus,
      versionOutdated,
    };
  }

  async registerInstallation(
    registration: InstallationRegistration,
  ): Promise<InstallationRegistrationResponse> {
    const response = await this.transport.request<InstallationRegistrationResponse>({
      path: "/sdk/installations/register",
      method: "POST",
      body: registration,
    });
    if (!response.ok) {
      throw new NetworkError(`SDK installation registration failed (${response.status}).`);
    }
    return response.data ?? {};
  }

  async requestTask(userText: string, pageUrl: string): Promise<TaskDefinition> {
    const response = await this.runtimeRequest<{ task?: TaskDefinition }>({
      path: "/tasks",
      method: "POST",
      body: {
        projectId: this.projectId,
        text: userText,
        pageUrl,
      },
    }, "assistant:conversation");
    if (!response.ok || !response.data?.task?.id || !Array.isArray(response.data.task.steps)) {
      throw new NetworkError("Task planning is unavailable");
    }
    return response.data.task;
  }

  async fetchWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const response = await this.runtimeRequest<{ workflow?: WorkflowDefinition }>({
      path: `/workflows/${encodeURIComponent(workflowId)}`,
      method: "GET",
    }, "assistant:conversation");
    if (!response.ok || !response.data?.workflow?.id || !Array.isArray(response.data.workflow.steps)) {
      throw new NetworkError("Workflow is unavailable");
    }
    return response.data.workflow;
  }

  async sendConversationMessage(
    text: string,
    pageUrl: string,
  ): Promise<ConversationReply> {
    const response = await this.runtimeRequest<ConversationReply>({
      path: "/conversations/messages",
      method: "POST",
      body: { projectId: this.projectId, text, pageUrl },
    }, "assistant:conversation");
    if (!response.ok || !response.data?.message?.text) {
      throw new NetworkError("Conversation service is unavailable");
    }
    return response.data;
  }

  async sendWebsiteMap(snapshot: WebsiteMapSnapshot): Promise<void> {
    await this.safePost("/website-maps", snapshot);
  }

  async sendAnalytics(events: unknown[]): Promise<void> {
    await this.safePost("/analytics", { events });
  }

  async sendTaskUpdate(taskId: string, status: string, stepId?: string): Promise<void> {
    await this.safePost(`/tasks/${encodeURIComponent(taskId)}/events`, {
      status,
      stepId,
    });
  }

  private async safePost(path: string, body: unknown): Promise<void> {
    try {
      await this.runtimeRequest({ path, method: "POST", body }, "assistant:telemetry");
    } catch {
      // Cloud ingestion failures are swallowed at the transport caller.
    }
  }

  private async runtimeRequest<T>(
    request: Parameters<CloudTransport["request"]>[0],
    capability: RuntimeCapability = "assistant:config",
  ): Promise<{ ok: boolean; status: number; data: T | null }> {
    if (!this.runtimeAuth) {
      return this.transport.request<T>(request);
    }
    let token = await this.runtimeAuth.getToken(capability);
    let response = await this.transport.request<T>({ ...request, authorizationToken: token });
    if (response.status === 401) {
      this.runtimeAuth.invalidate();
      token = await this.runtimeAuth.getToken(capability);
      response = await this.transport.request<T>({ ...request, authorizationToken: token });
    }
    return response;
  }
}
