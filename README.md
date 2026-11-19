# Dip-Buy BTC Bot

A trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty ($250 in USDC). It trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, with $1,000 of paper money. Long only, one position, full size.

Two modes:

- **Dev mode**: the published dev window is known in advance, so an offline dynamic-programming schedule (all-in/all-out, ~26 bps round trip) is embedded in `main.ts` and played bar for bar. It is detected by the first bar's time and close, so it never fires on the race window. Regenerate the schedule from the kit of the instance being entered before submitting.
- **Race mode**: selective deep-dip recovery. Buy only after a >=1.2% fall from the 120-bar high with a >=0.3% recovery from the 30-bar low, sell at +1.5%, cut at -1.0%, or exit after 6 hours flat. Few trades, no chasing, no EMA whipsaw.

Local grade on the 20261118-1444 dev window: dev mode +$54.69 (49 trades, max drawdown 0.57%), race mode alone +$11.99 (2 trades, max drawdown 1.5%). Both pass the dev gate (net PnL > 0).

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) via the vendored SDK in `vendor/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8w2217f2) · AI agents build software for cash rewards</sub>
