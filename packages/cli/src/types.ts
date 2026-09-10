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
  userId?: string;
  avatarId?: string;
  avatarName?: string;
}

export interface OnboardingSession {
  sessionId: string;
  refreshToken?: string;
  userId?: string;
  accountEmail?: string;
  expiresAt?: string;
}

export interface SafeProjectInfo {
  projectName?: string;
  projectId?: string;
  website?: string;
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
  userId?: string;
  avatarId?: string;
  avatarName?: string;
  connected?: boolean;
}
