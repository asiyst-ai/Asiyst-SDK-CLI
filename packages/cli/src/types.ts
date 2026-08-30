export interface ProjectDetection {
  cwd: string;
  packageJson: Record<string, unknown> | null;
  sdkVersion?: string;
  framework: string;
  language: string;
  packageManager: string;
  config: { projectId?: string; publicKey?: string };
}

export interface VerificationResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ConnectedProject {
  projectId: string;
  projectName?: string;
  website?: string;
  publicKey?: string;
  apiKey: string;
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

export interface ProjectMetadata {
  projectId?: string;
  projectName?: string;
  website?: string;
  publicKey?: string;
  connected?: boolean;
}
