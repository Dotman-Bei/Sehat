# PRD.md — Sehat

## 1. Product Overview

**Product name:** Sehat  
**Product category:** Security / bug-bounty infrastructure  
**Target ecosystem:** BOT Chain  
**Reference project:** Shield Net, as shown in the BOT Chain Project Party directory  
**Project goal:** Build a real, deployable, on-chain bug-bounty board on BOT Chain, suitable for evaluation by the BOT Labs incubation programme.

> **Category note:** The user requested “Predictions,” but the supplied Shield Net listing screenshot labels Shield Net as **Infra**. Shield Net’s described functionality—escrowed bug bounties, severity-graded vulnerability reports, and on-chain payouts—is not a prediction market. Build the bug-bounty product defined below, and confirm the correct Project Party listing category with the BOT Chain ecosystem team before submission. Do not turn the product into a prediction market merely to match a category label.

### Product summary

Sehat is an on-chain bug-bounty board where protocol teams publish security programmes, define scope and reward tiers, fund bounty escrow in native BOT, and receive responsible vulnerability disclosures from researchers. Reports stay private while triage is in progress. When a finding is accepted, the programme owner can release the approved reward from escrow to the researcher, with settlement verifiable on BOT Chain.

Sehat is a coordination and payout tool. It is not an automated vulnerability scanner, a guarantee that a project is secure, or an adjudicator that can independently determine whether a report is valid.

### Core user promise

**Security teams can publish funded bounty programmes; researchers can submit scoped findings privately; approved rewards are paid transparently on BOT Chain.**

---

## 2. Problem

Security researchers need a clear way to identify bounty scope, understand payout ranges, disclose findings responsibly, track triage, and receive compensation. Project teams need a structured intake workflow and confidence that the reward budget is available when a valid finding is accepted.

Sehat should provide:

1. A discoverable directory of security programmes.
2. Clear scope, rules, severity tiers, and payout budgets.
3. A private report-submission and triage workflow.
4. On-chain escrow for the bounty budget.
5. Status tracking for researchers and programme owners.
6. A traceable payout record when a finding is rewarded.
7. Safe closure and recovery of unused escrow after the programme and its outstanding obligations have ended.

---

## 3. BOT Chain and Incubation Fit

The project must follow the BOT Chain Builder / BOT Labs incubation principles: deployed code over slides, a working end-to-end demo, evidence of real usage, credible milestones, and meaningful ecosystem contribution.

### 3.1 Blockchain must be load-bearing

BOT Chain must do more than connect a wallet. On-chain contracts must handle the financial state of each bounty programme:

- Creating or registering a programme reference.
- Funding the programme escrow in native BOT.
- Tracking available escrow balance.
- Releasing an approved reward to a researcher.
- Emitting payout and funding events.
- Enforcing programme ownership and payout limits.
- Preventing a reward from being paid twice for the same report reference.
- Allowing unused funds to be reclaimed only under defined closure rules.

Report contents, private discussions, attachments, and sensitive vulnerability details must remain off-chain. The chain should record non-sensitive identifiers or hashes, wallet addresses, amounts, and financial events only.

### 3.2 BOT-native rationale

Sehat brings security researchers and project teams into the BOT Chain ecosystem and generates measurable transactions for programme funding and reward settlement. Native BOT is used for gas and the MVP’s bounty escrow currency. Do not add a separate project token.

### 3.3 Incubation requirements

The implementation should demonstrate:

- **Technical capability:** deployed and verified contracts, private report workflow, working escrow and payout.
- **Market potential:** real project teams can publish programmes and researchers can submit findings.
- **Ecosystem fit:** security activity and bounty settlement on BOT Chain.
- **Milestone readiness:** staged deployment, testing, first programmes, and adoption targets.
- **Community foundation:** real testers, builder feedback, public documentation, and build updates.

### 3.4 Usage evidence

Track and report real data including:

- Published programmes.
- Funded programmes.
- Unique programme owners.
- Unique researchers.
- Reports submitted and triaged.
- Accepted findings.
- Rewards paid.
- Total BOT placed into escrow and paid out.
- Repeat programme owners and researchers.

Never fabricate users, findings, security reviews, rewards, contracts, or traction metrics.

### 3.5 No speculative token

Sehat does not need its own token. Use native BOT for testnet and mainnet escrow, subject to deployment and operational checks. Do not claim a payout is guaranteed unless the on-chain escrow balance and release rules support it.

---

## 4. Users and Roles

### 4.1 Programme owner

A protocol team, project developer, or organization that creates a security programme, defines its permitted scope and reward tiers, funds escrow, triages submissions, and authorizes rewards.

### 4.2 Security researcher

A user who reviews a programme, submits a private vulnerability report, responds to triage questions, and receives a reward if the finding is accepted.

### 4.3 Programme triager

An owner-authorized team member who can view private reports and update triage status. The MVP may use the programme owner wallet as the sole authority if a separate role would add too much complexity.

### 4.4 Platform administrator

A trusted platform operator who handles spam/abuse reports, programme moderation, terms enforcement, and platform-level suspension. Platform administrators must not be able to arbitrarily withdraw user escrow or silently change contract payout rules.

---

## 5. MVP Scope

The MVP must deliver the full workflow:

```text
Owner connects wallet
        ↓
Creates programme and defines scope/reward tiers
        ↓
Funds programme escrow in BOT
        ↓
Programme appears in public directory
        ↓
Researcher reads rules and submits private report
        ↓
Owner/triager reviews report off-chain
        ↓
Report is marked accepted, duplicate, invalid, or needs information
        ↓
For an accepted report, owner releases an agreed reward from escrow
        ↓
Contract pays the researcher and emits a settlement event
        ↓
Both parties can inspect the on-chain payout record
```

Build a small, auditable MVP. Do not attempt to replicate every feature of mature bug-bounty platforms.

---

## 6. Programme Model

Each programme should contain:

- Programme ID.
- Owner wallet.
- Project/protocol name.
- Title and public description.
- Public scope and out-of-scope targets.
- Rules of engagement.
- Responsible-disclosure instructions.
- Severity definitions and reward ranges.
- Minimum/maximum reward by configured severity where applicable.
- Programme status: draft, active, paused, closing, closed.
- Start time and optional end time.
- Escrow contract/program reference.
- Current escrow balance.
- Report submission instructions.
- Created/updated timestamps.
- Public metadata URI or content hash where needed.

Only non-sensitive programme metadata may be placed on-chain. Use a metadata URI or digest for longer public programme descriptions rather than storing large text on-chain. Do not include private contact information or vulnerability details in public metadata.

---

## 7. Programme Creation and Funding

A connected wallet can create a draft programme and provide its public metadata. An owner must fund the programme before it is marked **Funded / Active** and able to accept reward-bearing reports.

Programme creation flow:

1. Connect wallet.
2. Enter project name and programme title.
3. Define permitted targets and excluded targets.
4. Write rules of engagement and disclosure expectations.
5. Configure severity levels and reward ranges.
6. Set an optional end date and closing policy.
7. Review details.
8. Create/register the programme.
9. Fund escrow with native BOT.
10. Publish the programme.

### Funding requirements

- Escrow is funded using a payable smart-contract function.
- Programme creation must not imply that the escrow is funded until a successful chain receipt confirms funding.
- The UI must display the balance sourced from contract state, not a manually entered figure.
- If escrow is exhausted, the programme must display that new reward-bearing submissions cannot be accepted until funding is restored.
- The contract must prevent a payout that exceeds the available programme balance.
- The contract must track programme ownership and only permit authorized owners/roles to perform privileged actions.

MVP should use native BOT only. ERC-20 payout assets can be considered later after the native escrow flow is proven.

---

## 8. Research Report Submission

Researchers submit reports privately through the website. Each report must include:

- Programme reference.
- Short title.
- Vulnerability category.
- Suggested severity.
- Affected in-scope target.
- Impact summary.
- Reproduction steps sufficient for the owner to validate safely.
- Evidence attachments, if needed.
- Researcher wallet address.
- Confirmation that the reporter followed the programme rules and has the right to submit the report.

### Confidentiality requirements

- Report content and attachments must not be written to public blockchain storage.
- Do not put exploit payloads, reproduction details, private URLs, credentials, personal data, or confidential attachments into transaction calldata or public events.
- A database reference or cryptographic hash may be emitted on-chain only if it does not expose report contents and the privacy implications are understood.
- Store reports in a private off-chain datastore with authorization checks.
- Private report links must not be guessable or usable without access authorization.
- Restrict report access to the relevant programme owner and authorized triagers, plus necessary platform operators under documented access controls.
- Do not promise end-to-end encryption unless the implementation actually provides it.

### Report status lifecycle

```text
SUBMITTED
   ↓
TRIAGE
   ├── NEEDS_INFORMATION
   ├── DUPLICATE
   ├── OUT_OF_SCOPE
   ├── INVALID
   └── ACCEPTED
          ↓
      REWARD_AGREED
          ↓
       PAID
```

Reports may also be marked **Closed without reward** with a clear reason. A report status is not a public statement about vulnerability severity unless the researcher and programme owner agree to disclose it.

---

## 9. Severity and Reward Rules

Support a simple, documented severity model:

- Critical
- High
- Medium
- Low
- Informational

Each programme sets its own accepted payout range for each severity, within the escrow available. These values are proposal guidelines, not automatic oracle results. The programme owner/triager is responsible for validating the impact and agreeing the final severity.

Requirements:

- The UI must distinguish researcher-suggested severity from owner-confirmed severity.
- A report’s suggested severity does not guarantee that a report will be accepted or paid.
- The agreed payout amount must be shown to the researcher before settlement.
- The payout amount and recipient must be confirmed in the owner’s wallet transaction.
- The contract must ensure the payout does not exceed the active programme’s remaining escrow.
- Store the report reference, payout amount, recipient, programme ID, and payment transaction hash for auditability.
- The app must not describe rewards as guaranteed income.

MVP does not require a universal severity-scoring oracle or an automated vulnerability adjudicator.

---

## 10. On-Chain Escrow and Payout

### 10.1 Contract responsibilities

The initial smart contract should be small and auditable. It must support:

- Registering a programme owner and non-sensitive programme reference.
- Funding programme escrow in native BOT.
- Reading owner and available balance.
- Releasing a reward from escrow to a specified researcher for a report reference.
- Emitting funding and payout events.
- Marking a report reference as paid so it cannot be paid twice.
- Closing a programme and returning eligible unused funds to the owner when closure rules permit.
- Pausing high-risk contract actions through a clearly defined emergency mechanism.

Avoid unnecessary multi-contract architecture. Separate contracts only if security or maintainability genuinely requires it.

### 10.2 Payout flow

1. Owner/authorized triager completes off-chain review.
2. The parties agree on severity and reward amount.
3. Owner opens the report and checks the recipient, report reference, and amount.
4. Owner initiates the release transaction.
5. The contract verifies authorization, active/closing state, escrow balance, and unused report reference.
6. The contract marks the reference paid before external transfer where appropriate and transfers native BOT.
7. The app waits for a successful transaction receipt before showing the report as paid.
8. The report detail shows a transaction link to the official BOT Chain explorer.

### 10.3 Trust model

For the MVP, programme owners decide whether a report is accepted and what reward to pay. The smart contract guarantees only the rules actually encoded in the contract. It does **not** independently prove the existence of a vulnerability, validate report quality, or force an owner to accept a report.

Make this trust model clear in the product copy and programme terms. Disputes, decentralized arbitration, reputation staking, and third-party adjudication are future features, not MVP requirements.

### 10.4 Unused escrow and programme closure

- A programme owner may pause accepting new reports.
- Closing a programme must not erase submitted reports or payout history.
- Define a closing/payout window for pending reports.
- Unused funds may be returned to the owner only after the configured close conditions are met and the contract’s rules permit it.
- Do not permit withdrawal of funds already paid or otherwise reserved for a completed payout.
- If the product cannot correctly account for pending rewards at MVP, keep withdrawal disabled until a safe closure procedure is implemented rather than offering an unsafe shortcut.

---

## 11. Responsible Disclosure and Abuse Prevention

Sehat must support lawful, scoped security research and must not encourage indiscriminate exploitation.

Each programme must state:

- In-scope systems and permitted testing.
- Out-of-scope assets.
- Whether automated scanning is permitted and under what limits.
- Prohibited actions, including denial-of-service, destructive tests, data exfiltration, privacy violations, and social engineering unless expressly and lawfully authorized by the programme.
- How to report accidental access to sensitive data.
- Disclosure timeline and coordination expectations.
- How duplicate reports and disputes are handled.

The platform should require the reporter to confirm that they have read the rules before submission. Platform abuse reporting and programme suspension must be available to authorized staff.

Sehat does not run scans or execute submitted proof-of-concept code. Submitted content is treated as untrusted input and must not run on the application server.

---

## 12. Researcher Dashboard

The researcher dashboard should provide:

- Connected wallet.
- Reports submitted.
- Status of each report.
- Requests for more information.
- Accepted findings and agreed severity.
- Paid rewards and transaction links.
- Reports closed without reward, with the stated reason where available.
- Filters by status/programme/date.

A researcher should only see reports they submitted, with any programme-private notes hidden unless deliberately shared with the reporter.

---

## 13. Programme Owner Dashboard

The programme owner dashboard should provide:

- Programmes owned.
- Escrow balance and funding history.
- Active/paused/closing status.
- Reports awaiting triage.
- Report filters by status and suggested/confirmed severity.
- Private report detail and triage notes.
- Request-more-information action.
- Accept/reject/duplicate/out-of-scope actions with reason.
- Set agreed severity and reward.
- Release payout transaction.
- Close programme and view eligible unused balance.

All privileged API actions must be authorized server-side and verified against the connected wallet/signature or contract permissions. A hidden frontend control is not sufficient access control.

---

## 14. Admin and Moderation

Platform administrators should be able to:

- Review reports about abusive or misleading programmes.
- Suspend a programme from directory discovery if it violates platform rules.
- Review gameable/spam submissions.
- View aggregate platform metrics.
- Record moderation actions in an audit log.

Platform moderation must not allow an administrator to withdraw programme escrow or redirect bounty payments. Admin authority should be separated from escrow ownership and payout authority. If a platform-level pause is implemented in the contract, document exactly which functions it stops and how it can be reversed.

---

## 15. Standard Pages and Routes

The MVP will have **9 standard pages/routes**.

### 1. Home — `/`

Purpose:
- Explain Sehat and the responsible-disclosure workflow.
- Show featured and recently funded programmes.
- Show high-level stats based on verified data.
- Provide entry points for researchers and programme owners.

### 2. Programmes — `/programs`

Purpose:
- Browse searchable/filterable security programmes.
- Show programme status, project, scope summary, available escrow, and configured reward range.
- Clearly distinguish active, paused, closing, and closed programmes.

### 3. Programme Detail — `/programs/[programId]`

Purpose:
- Show public scope, programme rules, severity model, and reward ranges.
- Show actual on-chain funding/balance and last-updated data.
- Let a researcher begin a submission when the programme is active.
- Link to its verified contract/activity where applicable.

### 4. Create Programme — `/programs/create`

Purpose:
- Let a connected wallet draft a programme.
- Define scope, rules, dates, severity tiers, and metadata.
- Register/fund/publish the programme through the required flow.

### 5. Submit Report — `/programs/[programId]/submit`

Purpose:
- Submit a confidential vulnerability report for the selected programme.
- Validate required fields and rules-of-engagement confirmation.
- Show a private confirmation/reference after successful submission.

### 6. Researcher Dashboard — `/researcher`

Purpose:
- Show the connected researcher’s submitted reports, current statuses, reward outcomes, and transaction links.

### 7. Report Detail — `/reports/[reportId]`

Purpose:
- Show the report to authorized parties only.
- Support triage discussion, requests for information, severity/reward agreement, decisions, and payout status.
- Prevent unauthorized users from seeing private report contents.

### 8. Programme Management — `/dashboard/programs/[programId]`

Purpose:
- Let the programme owner manage scope/status, review reports, set agreed rewards, release payments, view escrow, and close a programme when eligible.

### 9. Platform Admin — `/admin`

Purpose:
- Moderate programmes and abuse reports, inspect platform metrics, and view moderation audit history.
- Restrict access to authorized admin identities.

### Route summary

```text
/                              Home
/programs                      Programmes
/programs/[programId]          Programme Detail
/programs/create               Create Programme
/programs/[programId]/submit   Submit Report
/researcher                    Researcher Dashboard
/reports/[reportId]            Report Detail
/dashboard/programs/[programId] Programme Management
/admin                         Platform Admin
```

**Total standard pages/routes: 9.**

Wallet prompts, form validation, transaction confirmations, report status dialogs, loading states, and success/error states should be handled within these routes rather than creating unnecessary standalone pages.

---

## 16. Frontend Rules

This PRD contains **no visual design requirements**.

When frontend implementation begins, the building agent MUST first read and follow **`frontend.md`**. That file is the source of truth for layout, visual style, typography, color, components, responsive behavior, and interaction presentation.

Do not invent or duplicate design requirements in this PRD.

---

## 17. Suggested Data Model

Implement only entities required for the MVP.

### Programme
- Programme ID and owner wallet.
- Public title, description, scope, rules, dates, and metadata URI/hash.
- Severity/reward policy.
- Contract reference and on-chain escrow balance.
- Status and timestamps.

### Report
- Private report ID.
- Programme ID.
- Reporter wallet.
- Title/category/suggested severity.
- Encrypted/private body storage reference.
- Attachments and access policy.
- Status, triage notes, owner-confirmed severity, agreed reward, and timestamps.
- Non-sensitive report digest/reference for payout replay protection.

### Payout
- Programme ID.
- Report reference/digest.
- Recipient wallet.
- Amount in wei.
- Transaction hash.
- Settlement status and timestamp.

### User/Role
- Wallet address.
- Programme ownership/triager relation.
- Platform admin role, if applicable.
- Public researcher profile fields only where appropriate.

### Moderation record
- Actor/role.
- Action and reason.
- Target programme/submission.
- Timestamp.

Never place vulnerability details, credentials, unredacted evidence, private contact information, or sensitive personal data in on-chain records or public event logs.

---

## 18. Technology Expectations

Use standard EVM tooling and a maintainable web stack. The building agent may choose the implementation details as long as the result is simple, testable, and deployable.

Suggested stack:

- Solidity.
- Hardhat or Foundry.
- TypeScript.
- React/Next.js or an equivalent standard framework.
- viem/wagmi or another maintained EVM wallet connector.
- A database for reports, attachments metadata, triage, users/roles, and programme metadata.
- Private object storage for report attachments, with authorization checks and retention policies.
- An event indexer or read service if needed for explorer-like views and aggregates.

Do not deploy every report detail on-chain. Use the chain for escrow and settlement while keeping confidential report workflow off-chain.

---

## 19. BOT Chain Configuration and Deployment

Before deployment, fetch and verify current network configuration from BOT Chain’s official developer documentation. Do not rely on remembered values or hardcode an address from an old implementation.

The current official quick guide lists:

- **Mainnet Chain ID:** `677`
- **Mainnet RPC:** `https://rpc.botchain.ai`
- **Mainnet explorer:** `https://scan.botchain.ai`
- **Bohr Testnet Chain ID:** `968`
- **Testnet RPC:** `https://rpc.bohr.life`
- **Testnet explorer:** `https://scan.bohr.life`
- **Native token:** BOT

These values must be rechecked at implementation/deployment time. Keep network details and addresses in environment/configuration files. Never commit private keys, seed phrases, wallet JSON, signing keys, or production credentials.

Official quick guide: https://dev-docs.botchain.ai/docs/Developers/quick-guide/

Deployment path:

1. Compile and test contracts locally.
2. Deploy to testnet.
3. Verify contracts on the relevant explorer where supported.
4. Run end-to-end tests with test BOT.
5. Have independent reviewers inspect escrow, payout, and withdrawal logic.
6. Fix issues and redeploy as needed.
7. Deploy to mainnet only after the security, legal/policy, and operational gates are satisfied.

---

## 20. Security Requirements

### Smart contract security

- Use checks-effects-interactions.
- Apply reentrancy protection where appropriate.
- Restrict programme administration to the correct owner/authorized role.
- Check that the payout recipient is not the zero address.
- Check that payout amount is non-zero and within escrow.
- Prevent duplicate payments for a report reference.
- Emit clear programme funding, payout, closure, and withdrawal events.
- Ensure only the programme owner/authorized payout role can release rewards.
- Prevent unauthorized withdrawals.
- Define safe pause/unpause authority and document its scope.
- Avoid unbounded loops.
- Test invalid, duplicate, insufficient-balance, unauthorized, and paused states.
- Do not assume the frontend is enforcing contract security.

### Report confidentiality

- Keep full vulnerability content and attachments off-chain.
- Use authorization checks on every report read/update/download.
- Ensure private attachment URLs expire or require access authorization.
- Do not leak reports through logs, analytics, error traces, URLs, or public APIs.
- Sanitize input and treat uploaded files as untrusted.
- Do not execute uploaded proofs of concept.
- Apply upload limits and file-type restrictions.
- Document data retention and deletion expectations.

### Wallet and application security

- Never ask for seed phrases or private keys.
- Verify the active chain before contract writes.
- Verify the signer/role for owner and admin actions.
- Wait for confirmed receipts before displaying financial success.
- Rate-limit submissions and auth-sensitive endpoints.
- Use secure session management for any off-chain authentication.
- Protect API secrets and signing credentials.
- Maintain an audit trail for privileged actions.

### Threat model

README must explicitly address:

- Reentrancy or accounting mistakes in escrow payout.
- Unauthorized reward releases or withdrawals.
- Duplicate report payouts.
- Malicious/false bounty programmes.
- Spam and harassment via report submissions.
- Confidential vulnerability disclosure leaks.
- Compromised owner/admin wallet.
- Disagreement about validity, severity, or reward.
- A programme closing while reports remain unresolved.

Sehat is not an independent security auditor and does not guarantee that a programme owner will pay unless the on-chain funds and contract logic enforce that specific payment.

---

## 21. MVP Non-Goals

Do NOT build these in the first release:

- Automated vulnerability scanning.
- Automated execution of submitted exploit code.
- Public posting of private reports.
- A decentralized arbitration network.
- On-chain storage of full report bodies or attachments.
- Reputation staking or slashable researcher bonds.
- A project token.
- Multi-chain escrow.
- Stablecoin payout support before native BOT escrow is stable.
- Complex DAO governance.
- Guaranteed response-time or guaranteed payout promises that the platform cannot enforce.
- A prediction market. The reference project is a bug-bounty board, regardless of the category mismatch noted above.

---

## 22. Milestone Plan

### M1 — Foundation and Discovery

- Inspect BOT Chain Project Party and verify the closest available category with the ecosystem team.
- Initialize repository and toolchain.
- Verify current BOT Chain config from official documentation.
- Define programme/report states and escrow interfaces.
- Establish tests, lint, build, and environment configuration.
- Establish secure storage approach for confidential reports.

### M2 — Escrow Contract

- Implement programme references and ownership.
- Implement native BOT funding.
- Implement payout release and report-reference replay protection.
- Implement safe closure/unused-fund recovery policy or keep recovery disabled until complete.
- Add contract tests for successful and failing paths.
- Deploy and verify on testnet.

### M3 — Programme Directory and Creation

- Implement home and programme directory.
- Add programme detail.
- Add create-programme workflow.
- Integrate wallet and funding transactions.
- Ensure funded status is derived from chain state.

### M4 — Private Report and Triage Workflow

- Implement secure report submission/storage.
- Add report list/detail access control.
- Add triage states and private owner/researcher communication.
- Add status changes and audit trail.
- Test privacy controls and authorization boundaries.

### M5 — Payout and Dashboards

- Connect accepted reports to on-chain payout.
- Implement researcher dashboard and programme management.
- Display payout hash and explorer link.
- Test duplicate payout prevention and insufficient escrow.
- Implement admin moderation and role restrictions.

### M6 — Testnet Pilot

- Publish test programmes with clearly labelled test values.
- Run full workflow with real pilot testers.
- Test confidentiality and authorization.
- Review contract security with an independent developer.
- Collect usage and issue feedback.
- Fix critical issues before mainnet.

### M7 — Mainnet and Ecosystem Adoption

- Deploy to mainnet after security and operational readiness.
- Onboard initial project teams and researchers.
- Measure real programmes, funded BOT, reports, and payments.
- Publish a 2–4 minute demo video and setup documentation.
- Publish build updates/tutorials and participate in BOT Chain builder channels.

Milestones are phased checkpoints. Do not skip contract review or report-privacy testing in order to launch faster.

---

## 23. Metrics

### Supply and activity

- Programmes created.
- Programmes funded and active.
- Total unique programme owners.
- Total unique researchers.
- Reports submitted and reports triaged.
- Accepted findings.
- Paid reports.
- Average time from submission to first triage response (where measurable).
- Repeat programmes and repeat researchers.

### On-chain activity

- Native BOT deposited to escrow.
- Native BOT paid to researchers.
- Funding and payout transaction counts.
- Number of active programmes with non-zero balance.
- Unused escrow returned after valid closure.

### Safety and quality

- Duplicate reports flagged.
- Spam reports rejected.
- Unauthorized access attempts.
- Reports with access-control incidents.
- Contract issues found/fixed during tests.

Only report metrics grounded in actual application data and chain events.

---

## 24. Definition of Done

- [ ] All nine standard routes work.
- [ ] Wallet connection and chain mismatch handling work.
- [ ] Programme owners can create programmes.
- [ ] Public scope and responsible-disclosure rules are visible.
- [ ] Programme escrow can be funded in native BOT.
- [ ] On-screen escrow balance matches contract state.
- [ ] Researchers can submit private reports.
- [ ] Reports are only visible to authorized parties.
- [ ] Report triage and status history work.
- [ ] Accepted findings can be associated with an agreed severity and payout.
- [ ] Authorized programme owners can pay an accepted finding from escrow.
- [ ] Duplicate payments are prevented by contract state.
- [ ] Successful payment waits for a confirmed transaction receipt.
- [ ] Report detail shows the on-chain payout transaction.
- [ ] Programme closure and unused funds follow safe, tested rules.
- [ ] Admin moderation is access-controlled.
- [ ] Contract tests cover successful and adversarial scenarios.
- [ ] Confidential details never appear in public events or transaction calldata.
- [ ] Testnet deployment and end-to-end pilot have been completed.
- [ ] Mainnet deployment is completed or there is a documented readiness plan.
- [ ] README includes pitch, problem, architecture, setup, commands, deployment, testing, threat model, and known limitations.
- [ ] 2–4 minute demo video is prepared.
- [ ] Real-user testing is documented.
- [ ] Git history shows continuous meaningful development.

---

## 25. Git Commit Rules

Git commits are a required part of the development process.

During the build, commit changes continuously instead of waiting until the entire project is finished.

### Commit Frequency

For a normal build, aim for **50+ meaningful commits** across the development process.

Do NOT create 50 meaningless commits just to reach the number. Every commit should represent a real, completed development step.

Make a commit whenever you complete a logical unit of work, such as:

- Creating a new page
- Creating or modifying a component
- Adding a feature
- Implementing an API endpoint
- Adding database functionality
- Adding authentication logic
- Adding validation
- Adding error handling
- Connecting frontend to backend
- Adding a utility/helper
- Adding a configuration
- Refactoring a specific section
- Fixing a bug
- Improving an existing feature
- Adding tests
- Fixing failing tests
- Improving responsiveness
- Fixing accessibility issues
- Updating documentation
- Completing a route
- Completing a major UI section
- Integrating an external service

### Commit Process

After completing each logical development unit:

1. Check the current changes.
2. Verify that the changes work.
3. Stage only the relevant files.
4. Create a descriptive commit.
5. Continue building from the committed state.

Use conventional commit messages where appropriate:

- `feat: add programme directory`
- `feat: add wallet connection`
- `feat: implement bounty escrow funding`
- `feat: add private report submission`
- `fix: prevent duplicate bounty payout`
- `refactor: simplify report triage service`
- `test: add escrow payout tests`
- `style: improve mobile programme view`
- `docs: update setup instructions`

### Important Rules

- Do NOT wait until the end of the project to commit everything.
- Do NOT make one giant commit containing the entire project.
- Do NOT create fake changes solely to increase the commit count.
- Do NOT repeatedly modify and commit the same thing without a meaningful reason.
- Keep commits small, focused, and logically separated.
- Before moving to the next major feature, make sure the previous feature has been committed.
- If a task contains several independent steps, commit each completed step separately.
- If you encounter and fix a bug during development, commit the fix separately.
- If you make a meaningful refactor, commit it separately.

### Target

For a substantial project, aim for **50+ meaningful commits by the time the build is complete**, distributed naturally throughout development.

The commit history should clearly show the progression of the project from initial setup → individual features → integrations → fixes → testing → polish → final state.

At the end of the build, run `git log` and verify that the history accurately reflects the development process.

---

## 26. Build Rules for the Coding Agent

1. Read this PRD fully before coding.
2. Inspect the reference narrative shown in the provided Shield Net listing; preserve its core bug-bounty/escrow idea without copying branding or unsupported claims.
3. Confirm the correct BOT Chain Project Party category before submission; the supplied image says Infra while the requester mentioned Predictions.
4. Read `frontend.md` before implementing any frontend and use it as the only source of visual design requirements.
5. Do not add design requirements to this PRD.
6. Verify BOT Chain config against official docs before any deployment.
7. Keep private vulnerability reports and evidence off-chain and access-controlled.
8. Keep native BOT escrow and payouts auditable, minimal, and thoroughly tested.
9. Do not claim that smart contracts can assess vulnerability validity or enforce a payout decision that is not encoded in the contract.
10. Do not invent a token or store secret information in a repository.
11. Never fake programme data, findings, users, rewards, or transaction results.
12. Follow the Git Commit Rules throughout development.
13. Document assumptions, trust boundaries, and known limitations.
14. Verify each item in the Definition of Done before declaring completion.
15. Run `git log` at the end and verify that commits represent real development work.

---

## 27. Final Product Positioning

> **Sehat is an escrowed bug-bounty board on BOT Chain where security teams fund programmes, researchers disclose vulnerabilities privately, and approved findings can be paid on-chain.**

The product should win through responsible disclosure, clear programme scope, confidential report handling, reliable escrow, duplicate-payout prevention, and real adoption—not through speculative tokenomics or exaggerated security claims.

### Sources to verify during implementation

- BOT Chain Project Party: https://www.botchain.ai/en/project-party/
- BOT Chain developer Quick Guide: https://dev-docs.botchain.ai/docs/Developers/quick-guide/
