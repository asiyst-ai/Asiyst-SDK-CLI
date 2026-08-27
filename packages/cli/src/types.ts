export type SessionState = "pending" | "authenticated" | "project_selected" | "completed" | "expired" | "cancelled";

export interface ProjectDetection {
  cwd: string;
  packageJson: Record<string, unknown> | null;
  sdkVersion?: string;
  framework: string;
  language: string;
  packageManager: string;
  config: { projectId?: string; publicKey?: string };
}

export interface CliSession {
  sessionId: string;
  connectUrl: string;
  expiresAt: string;
}

export interface VerificationResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface SafeProjectInfo {
  projectName?: string;
  projectId?: string;
  connectionStatus?: string;
  lastSdkConnection?: string;
  domainStatus?: string;
  avatarStatus?: string;
  publishedConfigurationStatus?: string;
  publicKey?: string;
}
