# HASDATA — Agent Guide

A game of doubling on BNB Chain. Lives are ERC-721 monoliths with values 2, 4, 8 … 2048.
Mint a 2, burn two of a kind to double it, climb eleven rungs to 2048.
The whole game shares one pool of 2,048 mint units, so only two 2048 hashes can ever exist.

Site: https://hasdata.org · Model: https://hasdata.org/model.html

## Contract

- Network: BNB Chain (chainId 56)
- Contract (HASDATA): TO BE ANNOUNCED AT LAUNCH. Read the live address from the Contracts
  section of https://hasdata.org before calling anything. Never use an address from
  anywhere else.
- No Agent ID is required. Any wallet may play. Calls must come from the wallet
  itself (tx.origin == msg.sender); calls routed through another contract revert.

## Prices (fixed in the contract at launch; confirm by reading the site)

- Base mint: ±0.00026 BNB ($0.20) → 1 unit, value 2
- Boost mint: ±0.0039 BNB ($3) → 16 units, value 32
- Merge: 0 BNB, gas only
- One wallet may mint at most 64 units in total across both mints.

## Functions

- mint() — selector 0x1249c58b, payable, exact base price. Mints one value-2 hash.
- mintBoost() — selector 0x4347f837, payable, exact boost price. Mints one value-32 hash.
- merge(uint256 tokenIdA, uint256 tokenIdB) — selector 0xd1c2babb, value 0.
  Burns two hashes of equal value owned by the caller, mints one hash of double value.
  Reverts at value 2048 (top of the ladder).
- Views: totalSupply() 0x18160ddd · unitsMinted() 0xf8eabc9d ·
  aliveByLevel(uint8 level 1..11) 0x8f4f6a7f · valueOf(uint256) 0xcadf338f ·
  originOf(uint256) 0x794b2a07 (0 minted, 1 merged, 2 boost) ·
  walletLevelCount(address, uint8) 0x274a1ea2 · mintOpen() 0x24bbd049

## The $HASH token (gate)

- Token: $HASH, fixed supply 2,048,000,000. Contract: TO BE ANNOUNCED AT LAUNCH
  (read it from https://hasdata.org, Contracts section, like the HASDATA address).
- Only HASDATA holders can mint $HASH, and only through their own hashes:
  mintTokens(uint256 tokenId) — selector 0x97304ced, value 0 (gas only).
- Allowance per hash = units(value) x 1,000,000 $HASH, spendable once per hash:
  allowanceOf(uint256) 0x516d2435 · already minted: tokensMintedOf(uint256) 0xb22c2069
  (both read on the HASDATA contract). Value 2 → 1,000,000; value 32 → 16,000,000;
  value 2048 → 1,024,000,000.
- Minting tokens never burns the hash. A merged hash inherits its parents' minted
  totals, so its remaining allowance shrinks by whatever they already took.
- Failures: caller does not own the hash; allowance already spent; token mint closed.

## Procedure

1. Confirm mintOpen() reads 1 and check the caller's minted units stay within 64.
2. Always preview first (Binance Agentic Wallet: baw contract-call preview with
   --inputData, --binanceChainId 56, --from the agentic wallet, exact --value in wei).
   Execute only on a clean simulation, then verify the receipt.
3. After a mint, report the new tokenId, its value, and its artwork:
   https://hasdata.org/art/<tokenId>.png and metadata https://hasdata.org/metadata/<tokenId>.
4. For a merge, list the caller's hashes by value first (walletLevelCount per level,
   or the wallet's token list), pick a pair of equal value, and name both tokenIds
   to the user before burning anything. Merging is irreversible.

## If a call fails

- Mint closed: mintOpen() is 0. Wait for the opening.
- Wrong value: the sent wei differs from the fixed price by any amount. Resend exact.
- Pool empty: unitsMinted() reached 2,048. No more hashes can be minted; merging continues.
- Wallet cap: the caller already minted 64 units. Buy hashes on the market instead.
- Not a pair: merge tokenIds differ in value, or one is not owned by the caller,
  or one is a 2048. Check valueOf() and ownership first.
- Intermediary call: the call passed through another contract. Call directly from the wallet.
- Low balance: the wallet needs the price plus gas (merges need gas only).
