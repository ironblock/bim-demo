/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./pages/App";

const getRoot = (): Root => {
  const elem = document.getElementById("root")!;

  if (import.meta.hot) {
    return (import.meta.hot.data.root ??= createRoot(elem));
  } else {
    return createRoot(elem);
  }
};

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

getRoot().render(app);
