# /// script
# dependencies = [
#   "requests",
#   "tenacity",
# ]
# ///

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import re
import time
from tenacity import retry, stop_after_attempt, wait_exponential

class CONFIG:
    api_key: Optional[str]

class INPUTS:
    id: str
    vs_currency: str
    from_date: str
    to_date: str
    interval: Optional[str]

class PricePoint:
    timestamp: int
    datetime: str
    price_usd: float
    market_cap_usd: float
    volume_usd: float

class OUTPUT:
    from_date: str
    to_date: str
    interval: Optional[str]
    currency: str
    coin_id: str
    data_points: List[PricePoint]
    summary: Dict[str, Any]

def validate_date_format(date: str) -> None:
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
        raise ValueError(f"Invalid date format: {date}. Use YYYY-MM-DD")

def format_timestamp(ts_ms: int) -> str:
    """Convert millisecond timestamp to readable datetime string"""
    return datetime.fromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d %H:%M:%S UTC')

def calculate_summary(data_points: List[PricePoint]) -> Dict[str, Any]:
    if not data_points:
        return {
            "price_change": 0.0,
            "price_change_percentage": 0.0,
            "highest_price": 0.0,
            "lowest_price": 0.0,
            "average_price": 0.0,
            "highest_volume": 0.0,
            "total_volume": 0.0,
            "number_of_data_points": 0
        }

    prices = [point.price_usd for point in data_points]
    volumes = [point.volume_usd for point in data_points]
    
    first_price = prices[0]
    last_price = prices[-1]
    price_change = last_price - first_price
    price_change_pct = (price_change / first_price) * 100 if first_price > 0 else 0

    return {
        "price_change": round(price_change, 2),
        "price_change_percentage": round(price_change_pct, 2),
        "highest_price": round(max(prices), 2),
        "lowest_price": round(min(prices), 2),
        "average_price": round(sum(prices) / len(prices), 2),
        "highest_volume": round(max(volumes), 2),
        "total_volume": round(sum(volumes), 2),
        "number_of_data_points": len(data_points)
    }

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def make_coingecko_request(url: str, params: Dict[str, Any], headers: Dict[str, str]) -> Dict:
    import requests
    
    try:
        # First check API status
        ping_url = url.split('/coins')[0] + '/ping'
        ping_response = requests.get(ping_url, headers=headers)
        if ping_response.status_code != 200:
            raise Exception(f"CoinGecko API is not available. Status code: {ping_response.status_code}")
            
        response = requests.get(url, params=params, headers=headers)
        
        # Handle rate limiting
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            time.sleep(retry_after)
            response = requests.get(url, params=params, headers=headers)
            
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        if e.response is not None:
            error_message = f"API Error: {str(e)}"
            try:
                error_json = e.response.json()
                if 'error' in error_json:
                    error_message = f"API Error: {error_json['error']}"
            except:
                pass
            if e.response.status_code == 401:
                raise Exception(f"{error_message} (Status code: {e.response.status_code})")
            elif e.response.status_code == 429:
                raise Exception(f"{error_message} (Status code: {e.response.status_code})")
            elif e.response.status_code == 403:
                raise Exception(f"{error_message} (Status code: {e.response.status_code})")
            elif e.response.status_code >= 500:
                raise Exception(f"{error_message} (Status code: {e.response.status_code})")
        raise Exception(f"Request failed: {str(e)}")

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Validate required inputs
    if not all([inputs.id, inputs.vs_currency, inputs.from_date, inputs.to_date]):
        raise ValueError("Missing required parameters: id, vs_currency, from_date, to_date")

    # Validate date formats
    validate_date_format(inputs.from_date)
    validate_date_format(inputs.to_date)

    # Convert dates to UNIX timestamps
    from_timestamp = int(datetime.strptime(inputs.from_date, '%Y-%m-%d').timestamp())
    to_timestamp = int(datetime.strptime(inputs.to_date, '%Y-%m-%d').timestamp())

    # Setup API endpoint
    api_key = config.api_key if hasattr(config, 'api_key') else None
    base_url = 'https://pro-api.coingecko.com/api/v3' if api_key else 'https://api.coingecko.com/api/v3'
    
    # Build URL and params
    url = f"{base_url}/coins/{inputs.id}/market_chart/range"
    params = {
        'vs_currency': inputs.vs_currency,
        'from': from_timestamp,
        'to': to_timestamp
    }
    
    if hasattr(inputs, 'interval') and inputs.interval:
        if inputs.interval not in ['5m', 'hourly', 'daily']:
            raise ValueError("interval must be one of: '5m', 'hourly', 'daily'")
        params['interval'] = inputs.interval

    # Setup headers
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'Shinkai-Tool/1.0'
    }
    if api_key:
        headers['X-Cg-Pro-Api-Key'] = api_key

    try:
        # Make API request with retry logic
        data = make_coingecko_request(url, params, headers)

        # Validate response format
        required_fields = ['prices', 'market_caps', 'total_volumes']
        if not all(field in data for field in required_fields):
            raise ValueError(f"Missing required fields in response")

        # Process and combine the data points
        data_points = []
        for i in range(len(data['prices'])):
            point = PricePoint()
            point.timestamp = int(data['prices'][i][0])
            point.datetime = format_timestamp(point.timestamp)
            point.price_usd = float(data['prices'][i][1])
            point.market_cap_usd = float(data['market_caps'][i][1])
            point.volume_usd = float(data['total_volumes'][i][1])
            data_points.append(point)

        # Calculate summary statistics
        summary = calculate_summary(data_points)

        # Prepare output
        output = OUTPUT()
        output.from_date = inputs.from_date
        output.to_date = inputs.to_date
        output.interval = inputs.interval if hasattr(inputs, 'interval') else None
        output.currency = inputs.vs_currency
        output.coin_id = inputs.id
        output.data_points = data_points
        output.summary = summary

        return output

    except Exception as e:
        # Return the exception with the error message for any exception
        output = OUTPUT()
        output.error = str(e)
        return output