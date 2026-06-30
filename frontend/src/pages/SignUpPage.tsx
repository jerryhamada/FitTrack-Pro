import { SignUp } from "@clerk/react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}
