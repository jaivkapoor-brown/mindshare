import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";

function supported(): string | null {
  if (typeof WebSocket === "undefined") return "Mindshare needs a browser with WebSockets. Try a recent Chrome, Safari or Firefox.";
  try {
    const k = "__ms_probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
  } catch {
    return "Mindshare needs local storage to remember your seat. Turn off private browsing restrictions or try another browser.";
  }
  return null;
}

const root = createRoot(document.getElementById("root")!);
const problem = supported();
root.render(problem ? <p style={{ padding: 24, fontSize: 18 }}>{problem}</p> : <App />);
