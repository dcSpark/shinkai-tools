# /// script
# dependencies = [
#   "requests",
#   "matplotlib",
# ]
# ///

from typing import Any, Dict, List, Optional
import requests
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from datetime import datetime, timedelta
from shinkai_local_support import get_home_path

class CONFIG:
    pass

class INPUTS:
    period: Optional[str]  # "All Time", "Last Month", "Last 6 Months", "Last Year", "Last 5 Years", "Last 10 Years"

class OUTPUT:
    plot_path: str
    current_bitcoin_hashrate: str
    current_bitcoin_price: str

# Mapping user-friendly names → blockchain.info timespan parameter
PERIOD_TO_TIMESPAN = {
    "All Time": "all",
    "Last Month": "30days",
    "Last 6 Months": "180days",
    "Last Year": "365days",
    "Last 5 Years": "5years",
    "Last 10 Years": "10years",
}

PERIOD_TO_TIMESPAN_LOWER = {k.lower(): v for k, v in PERIOD_TO_TIMESPAN.items()}

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    # Get selected period, default to "All Time"
    selected_period = inputs.period if inputs.period is not None else "All Time"
    lookup_key = selected_period.lower()
    timespan = PERIOD_TO_TIMESPAN_LOWER.get(lookup_key, "all")
    display_period = selected_period.title()

    # Build URLs with chosen timespan
    url_hashrate = f"https://api.blockchain.info/charts/hash-rate?timespan={timespan}&format=json&sampled=true"
    url_price = f"https://api.blockchain.info/charts/market-price?timespan={timespan}&format=json&sampled=true"

    # Fetch hashrate
    try:
        resp_hash = requests.get(url_hashrate, timeout=15)
        resp_hash.raise_for_status()
        data_hashrate = resp_hash.json()
    except Exception as e:
        output.current_bitcoin_hashrate = "Error fetching hashrate"
        output.current_bitcoin_price = "N/A"
        output.plot_path = ""
        return output

    values_hashrate = data_hashrate.get('values', [])
    if not values_hashrate:
        output.current_bitcoin_hashrate = "No data"
        output.current_bitcoin_price = "N/A"
        output.plot_path = ""
        return output

    timestamps_hashrate = [v['x'] for v in values_hashrate]
    hashrate_mhs = [v['y'] for v in values_hashrate]
    hashrate_ths = [y / 1_000_000 for y in hashrate_mhs]  # MH/s → TH/s
    current_th = hashrate_ths[-1]
    output.current_bitcoin_hashrate = f"{current_th:,.2f} TH/s"

    dates_hashrate = [datetime.fromtimestamp(ts) for ts in timestamps_hashrate]

    # Fetch price
    try:
        resp_price = requests.get(url_price, timeout=15)
        resp_price.raise_for_status()
        data_price = resp_price.json()
    except Exception:
        prices = []
        dates_price = []
        current_price = None
    else:
        values_price = data_price.get('values', [])
        timestamps_price = [v['x'] for v in values_price]
        prices = [v['y'] for v in values_price]
        dates_price = [datetime.fromtimestamp(ts) for ts in timestamps_price]
        current_price = prices[-1] if prices else None

    if current_price is not None:
        output.current_bitcoin_price = f"${current_price:,.2f}"
    else:
        output.current_bitcoin_price = "N/A"

    # === Plotting ===
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(14, 8))

    # Hashrate (left axis)
    ax.plot(dates_hashrate, hashrate_ths, color='#1E90FF', linewidth=2.5, label='Hash Rate')

    def th_formatter(x, pos):
        if x >= 1000:
            return f"{x/1000:.1f}B"
        else:
            return f"{x:.1f}M".replace('.0M', 'M')

    ax.yaxis.set_major_formatter(mticker.FuncFormatter(th_formatter))
    ax.set_ylabel('Hash Rate (TH/s)', color='#1E90FF', fontsize=13)

    # Price (right axis)
    ax2 = ax.twinx()
    if prices:
        ax2.plot(dates_price, prices, color='orange', linewidth=2.5, label='Price')

    def price_formatter(x, pos):
        return f"${x:,.0f}"

    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(price_formatter))
    ax2.set_ylabel('Price (USD)', color='orange', fontsize=13)

    # Title & labels
    ax.set_title(f'Bitcoin Hash Rate & Price — {display_period}', 
                 fontsize=18, fontweight='bold', pad=30, color='white')
    ax.set_xlabel('Date', fontsize=12, color='white')

    # Grid and background
    ax.grid(True, color='#333333', linewidth=0.5, alpha=0.7)
    ax.set_facecolor('#0d0d0d')
    fig.patch.set_facecolor('#0d0d0d')

    # Specific tick label colors
    ax.tick_params(axis='x', labelcolor='white')
    ax.tick_params(axis='y', labelcolor='#1E90FF')
    ax2.tick_params(axis='y', labelcolor='orange')

    plt.xticks(rotation=0)
    plt.tight_layout()

    # Save
    home_path = await get_home_path()
    safe_period = display_period.replace(" ", "_").replace("-", "")
    plot_path = f"{home_path}/bitcoin_hashrate_price_{safe_period}.png"
    plt.savefig(plot_path, dpi=300, bbox_inches='tight', facecolor='#0d0d0d')
    plt.close()

    output.plot_path = plot_path
    return output