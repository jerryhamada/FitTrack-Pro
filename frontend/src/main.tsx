import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!publishableKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — add it to frontend/.env.local");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey} signInUrl="/sign-in" signUpUrl="/sign-up">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
