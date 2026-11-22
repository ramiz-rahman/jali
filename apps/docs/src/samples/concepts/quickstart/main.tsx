import { createRoot } from "react-dom/client";
import { JaliRoot } from "jali/react";
import "jali/styles.css";
import "./app.css";
import { jali } from "./jali";

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} className="app" />);
