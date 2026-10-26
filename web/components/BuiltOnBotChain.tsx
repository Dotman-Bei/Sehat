import { BOTCHAIN_EXPLORER, BOTCHAIN_SITE } from "@/lib/config";

/** "Built on BOT Chain" with links to the chain's official website and explorer. Shown in every footer. */
export default function BuiltOnBotChain({ className }: { className?: string }) {
  return (
    <p className={className}>
      Built on <strong>BOT Chain</strong>
      <span aria-hidden> · </span>
      <a className="link" href={BOTCHAIN_SITE} target="_blank" rel="noopener noreferrer">
        Official website
      </a>
      <span aria-hidden> · </span>
      <a className="link" href={BOTCHAIN_EXPLORER} target="_blank" rel="noopener noreferrer">
        BOT Chain Explorer
      </a>
    </p>
  );
}
