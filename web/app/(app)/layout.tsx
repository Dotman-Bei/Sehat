import "./app.css";
import Shell from "@/components/app/Shell";
import { WalletProvider } from "@/lib/wallet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <Shell>{children}</Shell>
    </WalletProvider>
  );
}
