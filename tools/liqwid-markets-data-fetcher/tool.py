# /// script
# dependencies = [
#   "requests",
# ]
# ///

import requests
from typing import Any, Dict, List

class CONFIG:
    app_name: str = "shinkai"
    show_delisted: bool = False

class INPUTS:
    page: int = 0
    perPage: int = 30
    tokens_filter: str = "All"

class OUTPUT:
    request_details: Dict[str, Any]
    listed: List[Dict[str, Any]]
    delisted: List[Dict[str, Any]]
    info: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    endpoint = "https://v2.api.liqwid.finance/graphql"
    
    query = """
    query GetBasicMarket($input: MarketsInput) {
      liqwid {
        data {
          markets(input: $input) {
            page
            pagesCount
            perPage
            totalCount
            results {
              id
              displayName
              supplyAPY
              borrowAPY
              lqSupplyAPY
              batching
              private
              delisting
              exchangeRate
              receiptAsset {
                currencySymbol
              }
              asset {
                price
                logo
                decimals
                currencySymbol
                hexName
              }
            }
          }
        }
      }
    }
    """
    
    variables = {
        "input": {
            "perPage": inputs.perPage,
            "page": inputs.page
        }
    }
    
    headers = {
        "X-App-Source": config.app_name,
        "Content-Type": "application/json"
    }
    
    response = requests.post(endpoint, json={"query": query, "variables": variables}, headers=headers)
    response.raise_for_status()
    
    data = response.json()
    markets_data = data["data"]["liqwid"]["data"]["markets"]
    
    output.info = "lq_rewards_supply_APY are rewards to incentivize supplying. qTokens are receipt tokens for supplying assets and the qToken_exchange_rate accrues over time"
    
    # Parse tokens filter: Comma-separated display names, e.g., 'ADA, USDM, wanBTC'
    filter_set = None
    if inputs.tokens_filter != "All":
        filter_set = set(token.strip() for token in inputs.tokens_filter.split(',') if token.strip())
    
    listed = []
    delisted = []
    for market in markets_data["results"]:
        # Format APYs with space before %
        supply_apy = f"{market['supplyAPY'] * 100:.2f} %"
        borrow_apy = f"{market['borrowAPY'] * 100:.2f} %"
        lq_supply_apy = f"{market['lqSupplyAPY'] * 100:.2f} %"
        
        display_name = market["displayName"]
        inner_dict = market.copy()
        del inner_dict["displayName"]
        del inner_dict["asset"]
        
        # Flatten asset
        inner_dict.update(market["asset"])
        
        # Rename currencySymbol from asset
        if "currencySymbol" in inner_dict:
            inner_dict["currency_symbol"] = inner_dict.pop("currencySymbol")
        
        # Rename receiptAsset currencySymbol
        if "receiptAsset" in inner_dict and "currencySymbol" in inner_dict["receiptAsset"]:
            inner_dict["receiptAsset"]["currency_symbol"] = inner_dict["receiptAsset"].pop("currencySymbol")
        
        # Flatten receiptAsset to qToken_receipt_asset_currency_symbol
        if "receiptAsset" in inner_dict:
            qToken_symbol = inner_dict["receiptAsset"]["currency_symbol"]
            del inner_dict["receiptAsset"]
            inner_dict["qToken_receipt_asset_currency_symbol"] = qToken_symbol
        
        # Rename exchangeRate
        inner_dict["qToken_exchange_rate"] = inner_dict.pop("exchangeRate")
        
        # Set formatted and renamed APYs
        inner_dict["supply_APY"] = supply_apy
        inner_dict["borrow_APY"] = borrow_apy
        inner_dict["lq_rewards_supply_APY"] = lq_supply_apy
        
        # Remove old APY keys
        inner_dict.pop("supplyAPY", None)
        inner_dict.pop("borrowAPY", None)
        inner_dict.pop("lqSupplyAPY", None)
        
        # Format price
        price = inner_dict["price"]
        inner_dict["price"] = f"${price:,.2f}"
        
        # Rename id to market_ID
        if "id" in inner_dict:
            inner_dict["market_ID"] = inner_dict.pop("id")
        
        new_entry = {display_name: inner_dict}
        
        # Apply filter
        if filter_set is None or display_name in filter_set:
            if market["delisting"]:
                if config.show_delisted:
                    delisted.append(new_entry)
            else:
                listed.append(new_entry)
    
    output.listed = listed
    output.delisted = delisted
    
    # Build request_details
    shown_count = len(listed) + len(delisted)
    output.request_details = {
        "page": markets_data["page"],
        "pagesCount": markets_data["pagesCount"],
        "perPage": markets_data["perPage"],
        "total_market_count": markets_data["totalCount"],
        "markets_shown_count": shown_count
    }
    
    return output