import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// withWorkflow enables the "use workflow" / "use step" directives that back
// the durable digest run (src/workflows/digest.ts).
export default withWorkflow(nextConfig);
