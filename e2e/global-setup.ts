import { execSync } from "node:child_process"

// Build the extension once before the suite so the fixture can load
// .output/chrome-mv3 as an unpacked extension.
export default function globalSetup() {
  execSync("npm run build", { stdio: "inherit" })
}
