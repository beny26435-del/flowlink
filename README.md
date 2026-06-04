# FlowLink

FlowLink is a backend-first payment link primitive for Arc. It lets users create payment links, accept native Arc USDC payments, forward funds to recipients, and record onchain receipts.

This repository intentionally does not include a polished frontend yet. The current goal is a clean contract, Foundry test suite, deployment script, Arc config, viem service layer, and App Kit integration stubs that a future UI or backend API can import.

## Why Arc?

Arc is an EVM-compatible L1 built for stablecoin-native financial apps. Arc uses USDC as the native gas token, so payment links, checkout flows, invoices, receipts, and programmable payments are a natural fit.

## Current Scope

- Solidity smart contract for native Arc value payments.
- Foundry tests and deployment script.
- TypeScript service modules for future backend/frontend integration.
- Arc Testnet config for viem.
- App Kit module stubs for future Send, Bridge, and Unified Balance flows.
- No database in v1.
- No polished frontend UI in this task.

## v1 Payment Model

FlowLink v1 uses `msg.value` native payments. On Arc, the native token is USDC, so the payer sends the exact payment amount as native Arc value and the contract forwards that value to the recipient.

This is not an ERC20 `transferFrom` flow. Do not mix native value amounts with ERC20 USDC assumptions in v1. The TypeScript helpers treat native value as 18-decimal wei-like units for contract calls unless Arc/App Kit integration later requires different display handling.

Future v2 can add ERC20 USDC support and App Kit Unified Balance so users can pay from balances across chains or apps.

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

## Deployed Contract

Arc Testnet deployment:

- Contract address: `0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7`
- Deployment transaction: `0x42e768b943404d2ce0c2ddaa27d1a898f0767643ad62008a91be1218d73c0fc6`
- Arcscan: [FlowLink on Arcscan](https://testnet.arcscan.app/address/0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7)

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
PRIVATE_KEY=
FLOWLINK_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS=
APP_KIT_KEY=
SMOKE_RECIPIENT=
SMOKE_AMOUNT_USDC=0.01
```

Never commit private keys or `.env`.

## Build And Test

```bash
forge build
forge test -vvv
npm run typecheck
```

The contract test suite covers link creation, cancellation, exact native payment, receipt storage, recipient forwarding, dashboard getters, direct transfer rejection, expiry, duplicate payment protection, and failed recipient transfers.

## Deploy

Deploy to Arc Testnet:

```bash
forge script script/DeployFlowLink.s.sol:DeployFlowLink \
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
```

Use `src/flowlink/client.ts` to create, pay, cancel, and read links from a backend route, script, or future frontend. Read helpers can create an Arc Testnet public client from `ARC_TESTNET_RPC_URL`.

For write operations, pass `walletClient` explicitly or provide `PRIVATE_KEY` through `FlowLinkConfig.privateKey` or `.env`. The client normalizes private keys with or without a `0x` prefix, but never hardcodes or stores keys.

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

## Service Modules

- `src/arc/chain.ts`: Arc Testnet constants and viem chain object.
- `src/arc/appkit.ts`: App Kit import and explicit v2 TODO stubs.
- `src/flowlink/abi.ts`: typed `FlowLink` ABI.
- `src/flowlink/client.ts`: viem read/write functions.
- `src/flowlink/types.ts`: shared integration types.
- `src/flowlink/utils.ts`: native USDC amount formatting and explorer/payment URL helpers.

## Future Frontend Plan

The future UI should stay thin over this foundation:

- Create link page.
- `/pay/:id` payment page.
- Creator dashboard.
- Payer receipt view.
- App Kit Unified Balance payment flow for pay-from-anywhere checkout.

## Future v2

- ERC20 USDC support if needed.
- App Kit Send for same-chain USDC sending.
- App Kit Bridge for crosschain USDC movement into Arc.
- App Kit Unified Balance for pay-from-anywhere payments.
- Receipt NFTs.
- Partial or group payments.
- Invoice metadata and richer receipt indexing.
- Webhooks or event indexer for backend notifications.
