/**
 * ALPACA TRADING ENGINE - Scalping + Day Trading + Auto-Reinvestment
 * Uses environment variables: ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_BASE_URL
 */

const Alpaca = require('@alpacahq/alpaca-trade-api');

function getAlpacaClient() {
  const keyId = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  const baseUrl = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';

  if (!keyId || !secretKey) {
    throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY must be set');
  }

  return new Alpaca({
    keyId,
    secretKey,
    paper: baseUrl.includes('paper'),
    baseUrl,
  });
}

// High-probability momentum scalping signals
const SCALP_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA'];
const INDEX_FUNDS = ['VOO', 'QQQ'];
const DAILY_TARGET = 100; // $100/day target

async function getAccountInfo(alpaca) {
  const account = await alpaca.getAccount();
  return {
    equity: parseFloat(account.equity),
    buyingPower: parseFloat(account.buying_power),
    cash: parseFloat(account.cash),
    dayTradeCount: account.daytrade_count,
    portfolioValue: parseFloat(account.portfolio_value),
  };
}

async function getMarketStatus(alpaca) {
  const clock = await alpaca.getClock();
  return {
    isOpen: clock.is_open,
    nextOpen: clock.next_open,
    nextClose: clock.next_close,
  };
}

async function executeMomentumScalp(alpaca, symbol) {
  // Get recent bars for momentum analysis
  const bars = await alpaca.getBarsV2(symbol, {
    timeframe: '5Min',
    limit: 20,
  });

  const barData = [];
  for await (const bar of bars) {
    barData.push({
      close: bar.ClosePrice,
      high: bar.HighPrice,
      low: bar.LowPrice,
      volume: bar.Volume,
      timestamp: bar.Timestamp,
    });
  }

  if (barData.length < 10) return null;

  // Simple momentum: price above 10-bar SMA with increasing volume
  const closes = barData.map(b => b.close);
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  const volumes = barData.map(b => b.volume);
  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const currentVolume = volumes[volumes.length - 1];

  // Entry conditions: price above SMA, positive momentum, volume surge
  const isBullish = currentPrice > sma10 && currentPrice > prevPrice;
  const hasVolume = currentVolume > avgVolume * 1.2;

  if (isBullish && hasVolume) {
    return {
      symbol,
      action: 'buy',
      price: currentPrice,
      confidence: 0.7,
      reason: 'Momentum + volume confirmation',
    };
  }

  return null;
}

async function executeScalpTrade(alpaca, signal, account) {
  // Risk management: max 2% of equity per trade
  const maxRisk = account.equity * 0.02;
  const shares = Math.floor(maxRisk / signal.price);

  if (shares < 1) return null;

  // Place bracket order with tight stops for scalping
  const takeProfitPct = 0.005; // 0.5% take profit
  const stopLossPct = 0.003; // 0.3% stop loss

  const order = await alpaca.createOrder({
    symbol: signal.symbol,
    qty: shares,
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    order_class: 'bracket',
    take_profit: { limit_price: (signal.price * (1 + takeProfitPct)).toFixed(2) },
    stop_loss: { stop_price: (signal.price * (1 - stopLossPct)).toFixed(2) },
  });

  return {
    orderId: order.id,
    symbol: signal.symbol,
    shares,
    entryPrice: signal.price,
    targetProfit: (shares * signal.price * takeProfitPct).toFixed(2),
  };
}

async function reinvestProfits(alpaca, dailyPnL) {
  if (dailyPnL <= 0) return null;

  // Invest 100% of profits into index funds
  const perFund = dailyPnL / INDEX_FUNDS.length;

  const investments = [];
  for (const fund of INDEX_FUNDS) {
    try {
      const order = await alpaca.createOrder({
        symbol: fund,
        notional: perFund.toFixed(2),
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      });
      investments.push({ fund, amount: perFund.toFixed(2), orderId: order.id });
    } catch (e) {
      console.error(`  Failed to invest in ${fund}: ${e.message}`);
    }
  }

  return investments;
}

async function executeTradingCycle() {
  const alpaca = getAlpacaClient();
  const account = await getAccountInfo(alpaca);
  const market = await getMarketStatus(alpaca);

  console.log(`  Account equity: $${account.equity.toFixed(2)}`);
  console.log(`  Buying power: $${account.buyingPower.toFixed(2)}`);
  console.log(`  Market open: ${market.isOpen}`);

  if (!market.isOpen) {
    console.log('  Market closed - checking for reinvestment opportunities');
    // At market close, reinvest any daily profits
    const positions = await alpaca.getPositions();
    const dailyPnL = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_intraday_pl), 0);
    
    if (dailyPnL > 0) {
      const investments = await reinvestProfits(alpaca, dailyPnL);
      return { status: 'reinvested', dailyPnL, investments };
    }
    return { status: 'market_closed', equity: account.equity };
  }

  // Execute scalping strategy
  const signals = [];
  for (const symbol of SCALP_SYMBOLS) {
    try {
      const signal = await executeMomentumScalp(alpaca, symbol);
      if (signal) signals.push(signal);
    } catch (e) {
      console.error(`  Error analyzing ${symbol}: ${e.message}`);
    }
  }

  // Execute top 3 signals by confidence
  const topSignals = signals.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const trades = [];

  for (const signal of topSignals) {
    try {
      const trade = await executeScalpTrade(alpaca, signal, account);
      if (trade) trades.push(trade);
    } catch (e) {
      console.error(`  Trade execution error: ${e.message}`);
    }
  }

  return {
    status: 'executed',
    equity: account.equity,
    signalsFound: signals.length,
    tradesExecuted: trades.length,
    trades,
  };
}

module.exports = { executeTradingCycle };
