import { runInit } from "./init";
import { openUrl } from "./open";

const command = process.argv[2] ?? "help";

if (command === "init") {
  try {
    const result = runInit(process.cwd());
    console.log("Asiyst setup");
    for (const step of result.nextSteps) {
      console.log(`- ${step}`);
    }
    console.log(`Opening ${result.dashboardUrl}`);
    openUrl(result.dashboardUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "init failed";
    console.error(message);
    process.exitCode = 1;
  }
} else {
  console.log("Usage: asiyst init");
}
