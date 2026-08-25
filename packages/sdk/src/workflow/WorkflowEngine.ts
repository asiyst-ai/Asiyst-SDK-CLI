import type { TargetSource, WorkflowDefinition } from "../types";
import { CloudClient } from "../communication/CloudClient";
import { TaskEngine } from "../task/TaskEngine";

export class WorkflowEngine {
  constructor(
    private readonly cloud: CloudClient,
    private readonly tasks: TaskEngine,
  ) {}

  async start(workflowId: string, source: TargetSource = "developer"): Promise<void> {
    const workflow = await this.cloud.fetchWorkflow(workflowId);
    await this.run(workflow, source);
  }

  async run(workflow: WorkflowDefinition, source: TargetSource): Promise<void> {
    await this.tasks.run(
      {
        id: workflow.id,
        title: workflow.title,
        steps: workflow.steps,
      },
      source,
    );
  }
}
