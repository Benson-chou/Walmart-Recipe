import type { Metadata } from "next";
import { SignupForm } from "@/components/SignupForm";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Sign up · ${APP_NAME}`,
};

export default function SignupPage() {
  return <SignupForm />;
}
