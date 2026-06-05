# FlowLink

FlowLink is a stablecoin checkout primitive for Arc. It lets users create payment links, invoices, unlock-after-payment links, group funding links, public payment URLs, creator profiles, and profile Tip Jars using native Arc USDC.

This repository includes a minimal demo frontend plus a clean contract, Foundry test suite, deployment script, Arc config, viem service layer, and App Kit integration stubs. The UI is intentionally simple and focused on creating, paying, and managing FlowLink payment links on Arc Testnet.

## Why Arc?

Arc is an EVM-compatible L1 built for stablecoin-native financial apps. Arc uses USDC as the native gas token, so payment links, checkout flows, invoices, receipts, and programmable payments are a natural fit.

## Current Scope

- Solidity smart contracts for native Arc value payments.
- Foundry tests and deployment script.
- TypeScript service modules for future backend/frontend integration.
- Minimal Next.js frontend for create, pay/contribute/refund, dashboard, profile, and public slug flows.
- Arc Testnet config for viem.
- App Kit module stubs for future Send, Bridge, and Unified Balance flows.
- No database.
- No ERC20 payment flow or App Kit Unified Balance payment flow yet.

## v1 Payment Model

FlowLink v1 uses `msg.value` native payments. On Arc, the native token is USDC, so the payer sends the exact payment amount as native Arc value and the contract forwards that value to the recipient.

This is not an ERC20 `transferFrom` flow. Do not mix native value amounts with ERC20 USDC assumptions in v1. The TypeScript helpers treat native value as 18-decimal wei-like units for contract calls unless Arc/App Kit integration later requires different display handling.

The multi-mode contract still uses native Arc USDC through `msg.value`. Future work can add ERC20 USDC support and App Kit Unified Balance so users can pay from balances across chains or apps.

## Product Modes

FlowLink supports four payment link modes in the latest contract generation:

- Payment Link: exact native Arc USDC payment to a recipient.
- Invoice: exact payment with client name, invoice number, and service title metadata.
- Unlock: exact payment with plaintext onchain success message and unlock URL metadata.
- Group: contributors fund a goal before a deadline.

Group links do not forward funds until the goal is fully funded. If a Group link expires before funding, or the creator cancels it while unfunded, contributors refund themselves individually from the pay page. The contract does not loop over contributors.

For Group links, the onchain `payer` field records the contributor whose payment completed the funding goal. Individual contribution amounts remain readable through `getGroupContribution`.

Unlock metadata is plaintext onchain metadata. Do not store private secrets, passwords, private files, or sensitive access tokens in the success message or unlock URL.

Creator profiles include a profile-level Tip Jar. Tips are not link modes, do not have `/p/<slug>` payment pages, and do not appear in listed payment links. When enabled on a profile, tips forward immediately to the profile owner, can have an optional minimum amount, allow multiple tips from the same or different payers, and are not refundable.

## Slugs, Profiles, And Listed Links

`FlowLinkV3` adds real onchain payment slugs and creator profiles. Slugs are stored by the contract and resolved with `getLinkIdBySlug` or `getLinkBySlug`; they are not cosmetic encodings of numeric link IDs.

Slug rules:

- Required for every `FlowLinkV3` link.
- 6 to 64 bytes.
- Allowed characters: `A-Z`, `a-z`, `0-9`, hyphen, and underscore.
- Globally unique across all links.

Profile rules:

- A creator can create or update a profile with display name, bio, avatar URL, and optional username.
- Usernames are lowercase only, 3 to 32 bytes when set, and allow `a-z`, `0-9`, hyphen, and underscore.
- Changing a username releases the old username and reserves the new one.

Listed links appear on public profile pages through `getListedCreatorLinks`. Unlisted links still appear in the creator dashboard through `getCreatorLinks`, but are not returned by the public listed-link getter.

Profile Tip Jar rules:

- Tips are attached to creator profiles, not payment links.
- Profiles can enable or disable tips and set an optional minimum tip amount.
- `tipProfile` and `tipProfileByUsername` forward native Arc USDC immediately to the profile owner.
- `totalTipsReceived`, `tipCountReceived`, `tipsFromPayer`, and profile tip getter functions expose public profile tip stats.
- Tips are not refundable because funds are forwarded immediately.

## Arc Docs

- [Arc Docs home](https://docs.arc.io/)
- [Arc Network overview](https://docs.arc.io/arc-chain)
- [Stablecoin-native model](https://docs.arc.io/arc/concepts/stablecoin-native-model)
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees)
- [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints)
- [Contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Deploy on Arc with Foundry](https://docs.arc.io/arc/tutorials/deploy-on-arc)
- [App Kit](https://docs.arc.io/app-kit)
- [App Kit Send](https://docs.arc.io/app-kit/send)
- [App Kit Bridge](https://docs.arc.io/app-kit/bridge)
- [App Kit Unified Balance](https://docs.arc.io/app-kit/unified-balance)
- [Unified Balance quickstart](https://docs.arc.io/app-kit/quickstarts/unified-balance-deposit-and-spend)
- [Arc Testnet explorer](https://testnet.arcscan.app/)

## Arc Testnet

- Network name: Arc Testnet
- Chain ID: `5042002`
- RPC HTTPS: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Native currency symbol: `USDC`

## Deployed Contracts

Existing Arc Testnet v1 deployment:

- Contract address: `0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7`
- Deployment transaction: `0x42e768b943404d2ce0c2ddaa27d1a898f0767643ad62008a91be1218d73c0fc6`
- Arcscan: [FlowLink on Arcscan](https://testnet.arcscan.app/address/0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7)

New multi-mode contract:

- Contract address: `0xca7C0E9305da6Af14260aDd60E59e1D75C38e42b`
- Deployment transaction: `0xc7d3f9c3744d04bae9b87d6f41b2a673371385aa0b4e2e9f2d40f41bbd816bc4`
- Arcscan: [FlowLink multi-mode contract on Arcscan](https://testnet.arcscan.app/address/0xca7C0E9305da6Af14260aDd60E59e1D75C38e42b)

Profile and slug contract:

- Contract address: `0x829177f771217FB2875095ff8668c27703828b8E`
- Deployment transaction: `0x433956ad358da8a58e1e5ab2e5570d4dc6614d7d10619c59a9f31e51f87b9600`
- Arcscan: [FlowLink profile and slug contract on Arcscan](https://testnet.arcscan.app/address/0x829177f771217FB2875095ff8668c27703828b8E)

Profile Tip Jar contract:

- Contract address: `0x531f40744d9c675dE15C0326766955F5b1cbC938`
- Deployment transaction: `0xd0b8d619533c1a706e660dd2fd6f06e6522ec269d6444277850942ca099b90bc`
- Arcscan: [FlowLink Profile Tip Jar contract on Arcscan](https://testnet.arcscan.app/address/0x531f40744d9c675dE15C0326766955F5b1cbC938)

## Setup

Install Node dependencies:

```bash
npm install
```

Install Foundry dependencies if `lib/forge-std` is missing:

```bash
forge install foundry-rs/forge-std --no-git --shallow
```

Create an environment file:

```bash
cp .env.example .env
```

Set at least:

```bash
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=
FLOWLINK_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS=
FLOWLINK_V2_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS=
FLOWLINK_V3_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOWLINK_V3_CONTRACT_ADDRESS=
FLOWLINK_V4_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS=
APP_KIT_KEY=
SMOKE_RECIPIENT=
SMOKE_AMOUNT_USDC=0.01
SMOKE_BASE_URL=http://localhost:3000
```

Never commit private keys or `.env`.

## Build And Test

```bash
forge build
forge test -vvv
npm run typecheck
npm run build
```

The contract test suite covers link creation, cancellation, exact native payment, receipt storage, recipient forwarding, dashboard getters, direct transfer rejection, expiry, duplicate payment protection, and failed recipient transfers.
The multi-mode test suite also covers invoices, unlock metadata, Group contributions, Group funding, refunds after expiry/cancel, and reentrancy attempts around pay, contribute, and refund.

## Deploy

Deploy to Arc Testnet:

```bash
forge script script/DeployFlowLink.s.sol:DeployFlowLink \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

Deploy the multi-mode contract to Arc Testnet:

```bash
forge script script/DeployFlowLinkV2.s.sol:DeployFlowLinkV2 \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

Deploy the profile and slug contract to Arc Testnet:

```bash
forge script script/DeployFlowLinkV3.s.sol:DeployFlowLinkV3 \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

Deploy the profile Tip Jar contract to Arc Testnet:

```bash
forge script script/DeployFlowLinkV4.s.sol:DeployFlowLinkV4 \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

If verification is configured for the explorer, use:

```bash
forge script script/DeployFlowLink.s.sol:DeployFlowLink \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast \
  --verify
```

## After Deploy

Save the deployed contract address in `.env`:

```bash
FLOWLINK_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS=0x...
FLOWLINK_V2_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS=0x...
FLOWLINK_V3_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_V3_CONTRACT_ADDRESS=0x...
FLOWLINK_V4_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS=0x...
```

Use `src/flowlink/client.ts` to create, pay, cancel, and read links from a backend route, script, or future frontend. Read helpers can create an Arc Testnet public client from `ARC_TESTNET_RPC_URL`.
Use `src/flowlink-v2/client.ts` for the multi-mode contract.
Use `src/flowlink-v3/client.ts` for profile, username, slug, listed-link, and public payment URL flows.
Use `src/flowlink-v4/client.ts` for profile Tip Jar flows plus profile, username, slug, listed-link, and all previous payment link mode flows.

For write operations, pass `walletClient` explicitly or provide `PRIVATE_KEY` through `FlowLinkConfig.privateKey` or `.env`. The client normalizes private keys with or without a `0x` prefix, but never hardcodes or stores keys.

## Frontend

Run the minimal Next.js frontend locally:

```bash
npm run dev
```

Then open `http://localhost:3000`.

Frontend wallet actions use the connected browser wallet through wagmi. The frontend only reads public environment variables:

```bash
NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS=0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7
NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_V3_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
```

The app includes:

- `/`: product overview and deployed contract link.
- `/create`: create a Payment Link, Invoice, Unlock, or Group link with a public slug.
- `/p/:slug`: primary public payment page.
- `/pay/:id`: numeric technical/backward-compatible payment page.
- `/dashboard`: view and cancel unpaid links created by the connected wallet.
- `/profile`: edit the connected wallet profile and Tip Jar settings.
- `/u/:address`: public profile by wallet address.
- `/@username`: public profile by username.

Payment links still use native Arc USDC through `msg.value`. The frontend does not expose `PRIVATE_KEY`, does not use backend wallet signing, and does not add ERC20 or database behavior.

## Smoke Test

Set `FLOWLINK_CONTRACT_ADDRESS` or `NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS` in `.env`, then run:

```bash
npm run smoke:arc
```

The smoke script creates a test payment link, reads it back, and prints the link ID, receipt/status fields, and Arcscan URLs. It does not pay the link by default. To send the exact native Arc USDC payment amount, explicitly pass `--pay`:

```bash
npm run smoke:arc -- --pay
```

Optional smoke settings:

```bash
SMOKE_RECIPIENT=0x...
SMOKE_AMOUNT_USDC=0.01
```

If `SMOKE_RECIPIENT` is omitted, the script uses the signer address as the recipient.

For the multi-mode contract, set `FLOWLINK_V2_CONTRACT_ADDRESS` or `NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS`, then run:

```bash
npm run smoke:arc:v2
```

The multi-mode smoke script creates one Payment Link, one Invoice, one Unlock, and one Group link, then reads them back and prints link IDs and Arcscan URLs. It does not pay, contribute, or refund by default.

Successful Arc Testnet smoke run:

- Payment Link ID: `1`
- Invoice Link ID: `2`
- Unlock Link ID: `3`
- Group Link ID: `4`

For the profile and slug contract, set `FLOWLINK_V3_CONTRACT_ADDRESS` or `NEXT_PUBLIC_FLOWLINK_V3_CONTRACT_ADDRESS`, then run:

```bash
npm run smoke:arc:v3
```

The V3 smoke script creates or updates a creator profile, creates one Payment Link, one Invoice, one Unlock, and one Group link with unique onchain slugs, reads each link back by slug, reads listed profile links, and prints `/p/<slug>` and profile URLs. It does not pay, contribute, or refund.

Successful profile and slug Arc Testnet smoke run:

- Profile username: `smoke_mq0thjb7`
- Profile URL: `http://localhost:3000/@smoke_mq0thjb7`
- Payment Link ID: `1`
- Payment slug: `pay_iBXfiKJC49`
- Invoice Link ID: `2`
- Invoice slug: `inv_KaMcwUDSqX`
- Unlock Link ID: `3`
- Unlock slug: `unlock_oYLkyRTF2R`
- Group Link ID: `4`
- Group slug: `group_MfWqNYQwnb`
- Listed link count for creator: `4`

For the profile Tip Jar contract, set `FLOWLINK_V4_CONTRACT_ADDRESS` or `NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS`, then run:

```bash
npm run smoke:arc:v4
```

The V4 smoke script creates or updates a creator profile with tips enabled, creates one Payment Link, one Invoice, one Unlock, and one Group link with unique onchain slugs, reads each link back by slug, reads listed profile links and profile tip stats, and prints `/p/<slug>` and profile URLs. It does not pay, contribute, tip, or refund.

Successful Profile Tip Jar Arc Testnet smoke run:

- Profile username: `smoke_mq13tkr5`
- Profile URL: `http://localhost:3000/@smoke_mq13tkr5`
- Profile tips enabled: `true`
- Profile minimum tip: `0.01 native Arc USDC`
- Profile total tips: `0 native Arc USDC`
- Profile tip count: `0`
- Payment Link ID: `1`
- Payment slug: `pay_4Ug3f9aBYW`
- Invoice Link ID: `2`
- Invoice slug: `inv_3XYWQr6bqm`
- Unlock Link ID: `3`
- Unlock slug: `unlock_VasGnPdHhV`
- Group Link ID: `4`
- Group slug: `group_7JEKeDSiYp`
- Listed link count for creator: `4`

## Service Modules

- `src/arc/chain.ts`: Arc Testnet constants and viem chain object.
- `src/arc/appkit.ts`: App Kit import and explicit v2 TODO stubs.
- `src/flowlink/abi.ts`: typed `FlowLink` ABI.
- `src/flowlink/client.ts`: viem read/write functions.
- `src/flowlink/types.ts`: shared integration types.
- `src/flowlink/utils.ts`: native USDC amount formatting and explorer/payment URL helpers.
- `src/flowlink-v2/abi.ts`: multi-mode `FlowLinkV2` ABI.
- `src/flowlink-v2/client.ts`: viem read/write functions for all four modes.
- `src/flowlink-v2/types.ts`: multi-mode integration types.
- `src/flowlink-v2/utils.ts`: mode helpers plus native USDC utility re-exports.
- `src/flowlink-v3/abi.ts`: profile and slug `FlowLinkV3` ABI.
- `src/flowlink-v3/client.ts`: viem read/write functions for profiles, slugs, listed links, and all four modes.
- `src/flowlink-v3/types.ts`: profile, slug, and multi-mode integration types.
- `src/flowlink-v3/utils.ts`: slug, username, public URL, profile URL, mode, and native USDC helpers.
- `src/flowlink-v4/abi.ts`: profile Tip Jar `FlowLinkV4` ABI.
- `src/flowlink-v4/client.ts`: viem read/write functions for profile tips plus profiles, slugs, listed links, and all previous modes.
- `src/flowlink-v4/types.ts`: profile tip, slug, and multi-mode integration types.
- `src/flowlink-v4/utils.ts`: slug, username, public URL, profile URL, mode, and native USDC helpers.

## Future Work

- ERC20 USDC support if needed.
- App Kit Send for same-chain USDC sending.
- App Kit Bridge for crosschain USDC movement into Arc.
- App Kit Unified Balance for pay-from-anywhere payments.
- Receipt NFTs.
- Richer receipt indexing.
- Webhooks or event indexer for backend notifications.
