# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Dict, Any
from datetime import datetime

class CONFIG:
    coingecko_api_key: str  # For x-cg-demo-api-key header

class INPUTS:
    pass

class OUTPUT:
    data: Dict[str, Any]

import requests

def ordinal(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return str(n) + suffix

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    usd_currency = 'usd'
    try:
        # CoinGecko call for Bitcoin data
        cg_url = "https://api.coingecko.com/api/v3/coins/bitcoin"
        cg_headers = {
            "x-cg-demo-api-key": config.coingecko_api_key
        }
        cg_response = requests.get(cg_url, headers=cg_headers)
        cg_response.raise_for_status()
        cg_data = cg_response.json()
        market_data = cg_data.get("market_data", {})
        
        # Compute formatted date and time from last_updated or fallback
        last_updated_str = cg_data.get('last_updated')
        if last_updated_str:
            try:
                parsed_date = datetime.fromisoformat(last_updated_str.replace('Z', '+00:00'))
                month = parsed_date.strftime('%B')
                day = ordinal(parsed_date.day)
                year = parsed_date.year
                time_str = parsed_date.strftime('%H:%M')
                formatted_date = f"{month} {day} {year} {time_str} UTC"
            except ValueError:
                # Fallback to current UTC date and time
                now = datetime.utcnow()
                month = now.strftime('%B')
                day = ordinal(now.day)
                year = now.year
                time_str = now.strftime('%H:%M')
                formatted_date = f"{month} {day} {year} {time_str} UTC"
        else:
            # Fallback to current UTC date and time
            now = datetime.utcnow()
            month = now.strftime('%B')
            day = ordinal(now.day)
            year = now.year
            time_str = now.strftime('%H:%M')
            formatted_date = f"{month} {day} {year} {time_str} UTC"
        
        dynamic_key = f"bitcoin_data_as_of_{formatted_date}"
        bitcoin_data = {}
        
        # Extract from CoinGecko /coins/bitcoin
        current_price = market_data.get('current_price', {}).get(usd_currency)
        if current_price is not None:
            bitcoin_data["current_price_in_USD"] = f"${current_price:,.2f}"
        
        ath = market_data.get('ath', {}).get(usd_currency)
        ath_date_str = market_data.get('ath_date', {}).get(usd_currency)
        if ath is not None:
            bitcoin_data["all_time_high_USD"] = f"${ath:,.2f}"
        if ath_date_str:
            try:
                parsed_date = datetime.fromisoformat(ath_date_str.replace('Z', '+00:00'))
                month = parsed_date.strftime('%B')
                day = ordinal(parsed_date.day)
                year = parsed_date.year
                bitcoin_data["all_time_high_date"] = f"{month} {day} {year}"
            except ValueError:
                bitcoin_data["all_time_high_date"] = None
        
        high_24h = market_data.get('high_24h', {}).get(usd_currency)
        low_24h = market_data.get('low_24h', {}).get(usd_currency)
        if high_24h is not None:
            bitcoin_data["high_24h_in_USD"] = f"${high_24h:,.2f}"
        if low_24h is not None:
            bitcoin_data["low_24h_in_USD"] = f"${low_24h:,.2f}"
        
        market_cap = market_data.get('market_cap', {}).get(usd_currency)
        if market_cap is not None:
            bitcoin_data["market_cap_in_usd"] = f"${market_cap:,.2f}"
        
        circulating_supply = market_data.get('circulating_supply')
        if circulating_supply is not None:
            bitcoin_data["circulating_supply"] = f"{circulating_supply:,.0f} BTC"
        max_supply = market_data.get('max_supply')
        if max_supply is not None:
            bitcoin_data["max_supply"] = f"{max_supply:,.0f} BTC"
            # Calculate FDV as max_supply * current_price
            if current_price is not None:
                fdv = max_supply * current_price
                bitcoin_data["fully_diluted_valuation_in_USD"] = f"${fdv:,.2f}"
            else:
                bitcoin_data["fully_diluted_valuation_in_USD"] = None
        else:
            bitcoin_data["max_supply"] = None
            bitcoin_data["fully_diluted_valuation_in_USD"] = None
        
        # Price changes percentages from CoinGecko
        changes = {
            "price_change_1h_usd": 'price_change_percentage_1h_in_currency',
            "price_change_24h_usd": 'price_change_percentage_24h_in_currency',
            "price_change_7d_usd": 'price_change_percentage_7d_in_currency',
            "price_change_30d_usd": 'price_change_percentage_30d_in_currency',
            "price_change_14d_usd": 'price_change_percentage_14d_in_currency',
            "price_change_200d_usd": 'price_change_percentage_200d_in_currency',
            "price_change_1y_usd": 'price_change_percentage_1y_in_currency'
        }
        for key, api_key in changes.items():
            change = market_data.get(api_key, {}).get(usd_currency)
            if change is not None:
                bitcoin_data[key] = f"{change:+.2f} %"
        
        price_change_24h_abs = market_data.get('price_change_24h', usd_currency)
        if price_change_24h_abs is not None:
            sign = "+" if price_change_24h_abs >= 0 else "-"
            abs_val = abs(price_change_24h_abs)
            bitcoin_data["price_change_24h_absolute_usd"] = f"{sign}${abs_val:,.2f}"
        
        # CoinGecko global call for BTC dominance
        global_url = "https://api.coingecko.com/api/v3/global"
        global_headers = {
            "x-cg-demo-api-key": config.coingecko_api_key
        }
        try:
            global_response = requests.get(global_url, headers=global_headers)
            global_response.raise_for_status()
            global_data = global_response.json()
            dominance = global_data.get('data', {}).get('market_cap_percentage', {}).get('btc')
            if dominance is not None:
                bitcoin_data["market_cap_dominance"] = f"{dominance:.2f} %"
            else:
                bitcoin_data["market_cap_dominance"] = None
        except Exception:
            bitcoin_data["market_cap_dominance"] = None
        
        # CoinGecko markets call for ATH change and market cap rank
        markets_url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin"
        try:
            markets_response = requests.get(markets_url, headers=global_headers)
            markets_response.raise_for_status()
            markets_data = markets_response.json()
            if markets_data:
                btc_data = markets_data[0]
                ath_change = btc_data.get('ath_change_percentage')
                if ath_change is not None:
                    bitcoin_data["all_time_high_change_percentage"] = f"{ath_change:+.2f} %"
                else:
                    bitcoin_data["all_time_high_change_percentage"] = None
                rank = btc_data.get('market_cap_rank')
                bitcoin_data["market_cap_rank"] = rank if rank else None
            else:
                bitcoin_data["all_time_high_change_percentage"] = None
                bitcoin_data["market_cap_rank"] = None
        except Exception:
            bitcoin_data["all_time_high_change_percentage"] = None
            bitcoin_data["market_cap_rank"] = None
        
        # Set missing keys to None
        required_keys = [
            "all_time_high_date", "all_time_high_USD", "all_time_high_change_percentage",
            "circulating_supply", "current_price_in_USD", "fully_diluted_valuation_in_USD",
            "high_24h_in_USD", "low_24h_in_USD", "market_cap_dominance", "market_cap_in_usd",
            "market_cap_rank", "max_supply", "price_change_14d_usd", "price_change_1h_usd",
            "price_change_1y_usd", "price_change_200d_usd", "price_change_24h_absolute_usd",
            "price_change_24h_usd", "price_change_30d_usd", "price_change_7d_usd"
        ]
        for k in required_keys:
            if k not in bitcoin_data:
                bitcoin_data[k] = None
        
        output.data = {dynamic_key: bitcoin_data}
    except Exception:
        # Fallback date and time and empty data on error
        now = datetime.utcnow()
        month = now.strftime('%B')
        day = ordinal(now.day)
        year = now.year
        time_str = now.strftime('%H:%M')
        formatted_date = f"{month} {day} {year} {time_str} UTC"
        dynamic_key = f"bitcoin_data_as_of_{formatted_date}"
        bitcoin_data = {}
        for k in [
            "all_time_high_date", "all_time_high_USD", "all_time_high_change_percentage",
            "circulating_supply", "current_price_in_USD", "fully_diluted_valuation_in_USD",
            "high_24h_in_USD", "low_24h_in_USD", "market_cap_dominance", "market_cap_in_usd",
            "market_cap_rank", "max_supply", "price_change_14d_usd", "price_change_1h_usd",
            "price_change_1y_usd", "price_change_200d_usd", "price_change_24h_absolute_usd",
            "price_change_24h_usd", "price_change_30d_usd", "price_change_7d_usd"
        ]:
            bitcoin_data[k] = None
        output.data = {dynamic_key: bitcoin_data}
    return output