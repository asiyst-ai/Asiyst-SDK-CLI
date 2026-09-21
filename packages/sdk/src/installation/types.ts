export type SdkEnvironment = "production" | "development" | "preview";

export interface InstallationRegistration {
  project_id: string;
  public_key: string;
  installation_id: string;
  origin: string;
  environment: SdkEnvironment;
  sdk_version: string;
}

export interface InstallationRegistrationResponse {
  installation_id?: string;
  status?: string;
  verified_at?: string;
}
