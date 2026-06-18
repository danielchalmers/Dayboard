import { createRoot } from "react-dom/client"

import { NewTabPage } from "~/NewTabPage"
import "~/styles/global.css"

const container = document.getElementById("root")

if (container) {
  createRoot(container).render(<NewTabPage />)
}
