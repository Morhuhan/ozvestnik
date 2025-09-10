import SignInClient from "./SignInClient";

export default function SignInPage() {
  const appId = Number(process.env.AUTH_VK_ID || 0);
  return <SignInClient appId={appId} />;
}
