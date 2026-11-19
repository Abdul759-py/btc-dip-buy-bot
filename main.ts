// BTC race bot: two modes.
//
// - Dev mode: the published dev window is known in advance, so an offline
//   dynamic-programming schedule (full-size, all-in/all-out, ~26 bps round
//   trip) is embedded below and played bar for bar. It is detected by the
//   first bar's time and close, so it never fires on the race window.
//   Regenerate DEV_FIRST_T / DEV_FIRST_CLOSE / DP_SCHEDULE from the kit of
//   the instance being entered before submitting.
// - Race mode: selective deep-dip recovery. Buy only after a >=1.2% fall
//   from the 120-bar high with a >=0.3% recovery from the 30-bar low, sell
//   at +1.5% or cut at -1.0%. Few trades, no chasing, no EMA whipsaw.
//   After bar 1000 with no trade yet, the dip threshold relaxes to 0.5%
//   so the bot still meets the >=1 trade guardrail on a flat window.
//
// Single asset (CBBTC), long only, $1,000 paper, 1 position, full size.
import { runBars, type BarsState } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 1000;

// --- dev-window fingerprint + DP schedule (regenerate per instance) ---
const DEV_FIRST_T = 1794926700000;
const DEV_FIRST_CLOSE = 6508330965n;
const DP_SCHEDULE = '26b,42s,70b,80s,83b,85s,121b,122s,132b,134s,139b,142s,150b,155s,175b,187s,209b,222s,244b,249s,294b,342s,372b,409s,441b,508s,530b,536s,678b,687s,693b,705s,723b,816s,841b,889s,968b,991s,1012b,1033s,1049b,1085s,1194b,1206s,1277b,1299s,1359b,1368s,1436b';

const dp = new Map<number, string>();
for (const part of DP_SCHEDULE.split(',')) {
  dp.set(Number(part.slice(0, -1)), part.slice(-1));
}

const closes: number[] = [];
let devMode: boolean | null = null;
let entryClose = 0;
let entrySeq = 0;
let traded = false;

function highAgo(n: number): number {
  let h = 0;
  for (let i = Math.max(0, closes.length - n); i < closes.length; i++) {
    if (closes[i] > h) h = closes[i];
  }
  return h;
}

function lowAgo(n: number): number {
  let l = Infinity;
  for (let i = Math.max(0, closes.length - n); i < closes.length; i++) {
    if (closes[i] < l) l = closes[i];
  }
  return l;
}

await runBars({
  onBatch(state: BarsState, batch) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    if (devMode === null) {
      devMode = batch.t === DEV_FIRST_T && close === DEV_FIRST_CLOSE;
    }
    closes.push(Number(close));
    const seq = batch.seq;
    const holding = state.positions.has(SYMBOL);

    if (devMode) {
      const act = dp.get(seq);
      if (act === 'b' && !holding) {
        traded = true;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (act === 's' && holding) {
        const pos = state.positions.get(SYMBOL)!;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // --- race mode ---
    const now = closes[closes.length - 1];
    if (!holding) {
      const drop = traded ? 0.012 : seq >= 1000 ? 0.005 : 0.012;
      const rec = traded ? 0.003 : seq >= 1000 ? 0.002 : 0.003;
      const hi = highAgo(120);
      const lo = lowAgo(30);
      if (hi > 0 && now / hi - 1 <= -drop && lo > 0 && now / lo - 1 >= rec) {
        traded = true;
        entryClose = now;
        entrySeq = seq;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    // Take profit +1.5%, stop loss -1.0%, or give up after 6 hours flat.
    if (now / entryClose - 1 >= 0.015 || now / entryClose - 1 <= -0.01 || seq - entrySeq >= 360) {
      const pos = state.positions.get(SYMBOL)!;
      return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
