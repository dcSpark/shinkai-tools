# /// script
# dependencies = [
#   "pandas>=2.2.0",
#   "numpy>=1.26.0",
#   "aiohttp>=3.8.0",
#   "requests",
#   "python-dotenv>=0.21.0",
#   "setuptools>=65.0.0",
#   "pandas-ta>=0.3.14b"
# ]
# ///

import os
import aiohttp
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List

# Ensure numpy nan is available for pandas-ta
np.NaN = np.nan

import pandas_ta as ta

# Load environment variables from .env if present
load_dotenv()

class CONFIG:
    tiingo_api_key: str = ""  # If empty, we'll default to TIINGO_API_KEY env var

class INPUTS:
    symbol: str
    lookback_days: int = 365

class OUTPUT:
    analysis: dict

async def run(c: CONFIG, p: INPUTS) -> OUTPUT:
    if not p.symbol or not p.symbol.strip():
        raise ValueError("Missing 'symbol' in parameters")

    api_key = c.tiingo_api_key.strip() if c.tiingo_api_key else os.getenv("TIINGO_API_KEY", "").strip()
    if not api_key:
        raise ValueError("No Tiingo API key found. Provide it in 'tiingo_api_key' config or TIINGO_API_KEY env var")

    # Prepare date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=p.lookback_days)

    # Build the Tiingo URL
    base_url = "https://api.tiingo.com/tiingo/daily"
    url = (
        f"{base_url}/{p.symbol}/prices?"
        f"startDate={start_date.strftime('%Y-%m-%d')}&"
        f"endDate={end_date.strftime('%Y-%m-%d')}&"
        "format=json"
    )
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Token {api_key}"
    }

    # Fetch data asynchronously
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 404:
                raise ValueError(f"Symbol not found: {p.symbol}")
            resp.raise_for_status()
            data = await resp.json()

    if not data:
        raise ValueError(f"No data returned for symbol {p.symbol}")

    # Convert to DataFrame
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)

    # Use adjusted price columns if present
    df["open"] = df.get("adjOpen", df["open"]).round(2)
    df["high"] = df.get("adjHigh", df["high"]).round(2)
    df["low"] = df.get("adjLow", df["low"]).round(2)
    df["close"] = df.get("adjClose", df["close"]).round(2)
    df["volume"] = df.get("adjVolume", df["volume"]).astype(int)

    # Basic sanity check: must have enough rows
    if len(df) < 10:
        raise ValueError(f"Not enough data points to calculate indicators for {p.symbol}")

    # Calculate indicators using pandas_ta
    # Moving Averages
    df.ta.sma(length=20, append=True, col_names=("sma_20",))
    df.ta.sma(length=50, append=True, col_names=("sma_50",))
    df.ta.sma(length=200, append=True, col_names=("sma_200",))

    # RSI
    df.ta.rsi(length=14, append=True, col_names=("rsi",))

    # MACD
    df.ta.macd(append=True)

    # ATR
    df.ta.atr(length=14, append=True, col_names=("atr",))

    # Average Daily Range
    df["daily_range"] = df["high"] - df["low"]
    df["adr"] = df["daily_range"].rolling(window=20).mean()
    df["adrp"] = (df["adr"] / df["close"]) * 100

    # Volume
    df["avg_20d_vol"] = df["volume"].rolling(window=20).mean()

    # Get latest values
    latest = df.iloc[-1]

    # Build an output dict
    analysis_dict = {
        "latestClose": float(latest["close"]),
        "aboveSma20": bool(latest["close"] > latest["sma_20"]),
        "aboveSma50": bool(latest["close"] > latest["sma_50"]),
        "aboveSma200": bool(latest["close"] > latest["sma_200"]),
        "sma20OverSma50": bool(latest["sma_20"] > latest["sma_50"]),
        "sma50OverSma200": bool(latest["sma_50"] > latest["sma_200"]),
        "rsi": float(latest["rsi"]) if not np.isnan(latest["rsi"]) else None,
        "macdBullish": bool(latest["MACD_12_26_9"] > latest["MACDs_12_26_9"]),
        "atr": float(latest["atr"]) if not np.isnan(latest["atr"]) else None,
        "adrPercent": float(latest["adrp"]) if not np.isnan(latest["adrp"]) else None,
        "avg20dVolume": float(latest["avg_20d_vol"]) if not np.isnan(latest["avg_20d_vol"]) else None,
    }

    # Build final OUTPUT
    out = OUTPUT()
    out.analysis = analysis_dict
    return out 