import { createRoot } from "react-dom/client";
import { Jali } from "@jali/react";
import "@jali/react/styles.css";
import "./app.css";
import { workspace } from "./workspace";

createRoot(document.getElementById("root")!).render(<Jali workspace={workspace} className="app" />);
