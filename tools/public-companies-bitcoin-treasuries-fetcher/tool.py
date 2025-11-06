# /// script
# dependencies = [
#   "requests",
#   "pandas",
#   "matplotlib",
# ]
# ///

from typing import Any, Dict, List, Optional
from shinkai_local_tools import webpage_clean_text_extractor
from shinkai_local_support import get_home_path
import pandas as pd
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import os
import re

def parse_usd(value_str: str) -> float:
    if not value_str or value_str in ['—', '']:
        return 0.0
    value_str = value_str.replace('$', '').replace(',', '')
    if 'B' in value_str:
        return float(value_str.replace('B', '')) * 1e9
    elif 'M' in value_str:
        return float(value_str.replace('M', '')) * 1e6
    elif 'K' in value_str:
        return float(value_str.replace('K', '')) * 1e3
    else:
        try:
            return float(value_str)
        except ValueError:
            return 0.0

class CONFIG:
    folder_path: str

class INPUTS:
    show_full_list: bool

class OUTPUT:
    overview_of_public_companies_with_BTC_treasuries: Dict[str, Any]
    top_10_public_companies_with_BTC_holdings: Optional[List[Dict[str, Any]]] = None
    public_companies_with_BTC_holdings: Optional[List[Dict[str, Any]]] = None
    saved_files: List[str]

def parse_btc_treasuries(markdown_content: str) -> dict:
    companies = []
    totals = {}

    lines = markdown_content.strip().split('\n')

    for line in lines:
        clean_line = line.strip()
        # Skip lines that are not part of a table, or are table separators/headers
        if not clean_line.startswith('|') or clean_line.startswith('| ---') or clean_line.startswith('| # |'):
            continue

        cells = [cell.strip() for cell in clean_line.split('|')]

        # Check for the totals line, which is formatted differently
        # It could be in cell[3] (old format) or cell[2] (new format), so we check both
        if (len(cells) > 3 and "Total:" in cells[3]) or (len(cells) > 2 and "Total:" in cells[2]):
            try:
                # Find the total BTC and percentage, which are usually the last numeric values
                totals['total_btc'] = float(cells[4].replace(',', ''))
                totals['total_usd_value'] = cells[5]
                totals['total_supply_percentage'] = float(cells[-2].replace('%', ''))
            except (ValueError, IndexError):
                pass
            continue

        # This is the main filter. It ensures we only process rows from the 
        # DETAILED table format by checking for the minimum number of columns.
        # THE isdigit() CHECK HAS BEEN REMOVED FROM HERE.
        if len(cells) < 14:
            continue

        try:
            # --- START OF FIX ---
            # Robustly parse the rank by finding the leading number in the cell.
            # This handles cases like "1 Log in or create an account...".
            rank_text = cells[1]
            rank_match = re.match(r'^\d+', rank_text)
            if not rank_match:
                continue # Skip if no number is found at the start of the rank cell
            rank = int(rank_match.group(0))
            # --- END OF FIX ---

            def clean_cell(value):
                if value in ['—', ''] or '*' in value:
                    return None
                return value

            country_match = re.search(r'countries/([\w-]+)', cells[2])
            country = country_match.group(1).replace('-', ' ').title() if country_match else 'N/A'

            name_raw = cells[3]
            name_match = re.search(r'\[(.*?)\]\(.*?\)\s*(.*)', name_raw)
            if name_match:
                company_name = name_match.group(1).strip()
                ticker = name_match.group(2).strip().split(' ')[0] or None # Take first part as ticker
            else:
                company_name = name_raw
                ticker = None

            btc_holdings_raw = cells[4].replace('₿', '').replace(',', '')
            # Handle potential edge cases like '.8' for Phunware
            if btc_holdings_raw.startswith('.'):
                 btc_holdings_raw = '0' + btc_holdings_raw
            btc_holdings = float(btc_holdings_raw) if btc_holdings_raw else None

            usd_value = clean_cell(cells[5])
            market_cap = clean_cell(cells[6])

            supply_pct_raw = cells[13].replace('%', '')
            supply_pct = float(supply_pct_raw) if clean_cell(supply_pct_raw) else None

            company_data = {
                'rank': rank,
                'country': country,
                'company_name': company_name,
                'ticker': ticker,
                'btc_holdings': btc_holdings,
                'usd_value': usd_value,
                'market_cap': market_cap,
                'percentage_of_total_supply': supply_pct
            }
            companies.append(company_data)

        except (ValueError, IndexError, AttributeError):
            continue

    return {
        'totals': totals,
        'companies': companies
    }

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    saved_files = []
    
    folder_path = config.folder_path.strip() if config.folder_path and config.folder_path.strip() else await get_home_path()
    os.makedirs(folder_path, exist_ok=True)
    
    companies_history_path = os.path.join(folder_path, 'btc_companies_history.csv')
    totals_history_path = os.path.join(folder_path, 'btc_totals_history.csv')
    
    extractor_input = {
        'url': 'https://bitcointreasuries.net/',
        'show_content': True
    }
    
    result = await webpage_clean_text_extractor(extractor_input)
    
    markdown_content = result.get('content', '')
    
    if markdown_content:
        data = parse_btc_treasuries(markdown_content)
        parsed_totals = data['totals']
        parsed_companies = data['companies']
    else:
        parsed_totals = {}
        parsed_companies = []
    
    timestamp = datetime.now().isoformat()
    num_companies = len(parsed_companies)
    
    # Append to totals history (raw numbers)
    total_usd_raw = parse_usd(parsed_totals.get('total_usd_value', '$0'))
    totals_data = {
        'timestamp': timestamp,
        'total_btc': parsed_totals.get('total_btc', 0.0),
        'total_usd_value': total_usd_raw,
        'total_supply_percentage': parsed_totals.get('total_supply_percentage', 0.0),
        'num_companies': num_companies
    }
    new_totals_df = pd.DataFrame([totals_data])
    if os.path.exists(totals_history_path):
        old_df = pd.read_csv(totals_history_path)
        df = pd.concat([old_df, new_totals_df], ignore_index=True)
    else:
        df = new_totals_df
    df.to_csv(totals_history_path, index=False)
    saved_files.append(totals_history_path)
    
    # Append to companies history (raw numbers)
    companies_list = []
    for comp in parsed_companies:
        usd_raw = parse_usd(comp['usd_value']) if comp['usd_value'] else 0.0
        market_cap_raw = parse_usd(comp['market_cap']) if comp['market_cap'] else 0.0
        comp_data = {
            'timestamp': timestamp,
            'rank': comp['rank'],
            'country': comp['country'],
            'company_name': comp['company_name'],
            'ticker': comp['ticker'],
            'btc_holdings': comp['btc_holdings'] or 0.0,
            'usd_value': usd_raw,
            'market_cap': market_cap_raw,
            'percentage_of_total_supply': comp['percentage_of_total_supply'] or 0.0
        }
        companies_list.append(comp_data)
    if companies_list:
        new_companies_df = pd.DataFrame(companies_list)
        if os.path.exists(companies_history_path):
            old_df = pd.read_csv(companies_history_path)
            df = pd.concat([old_df, new_companies_df], ignore_index=True)
        else:
            df = new_companies_df
        df.to_csv(companies_history_path, index=False)
    saved_files.append(companies_history_path)
    
    # Process overview
    total_btc = parsed_totals.get('total_btc', 0)
    total_usd_value = parsed_totals.get('total_usd_value', '$0')
    supply_pct = parsed_totals.get('total_supply_percentage', 0)
    overview = {
        'count': f"{num_companies} companies",
        'total_btc': f"{total_btc:,.0f} BTC",
        'total_usd_value': total_usd_value,
        'total_supply_percentage': f"{supply_pct:.3f} % of total BTC supply"
    }
    output.overview_of_public_companies_with_BTC_treasuries = overview
    
    # Process full companies with formatted strings
    full_processed_companies = []
    for comp in parsed_companies:
        pcomp = {
            'company_name': comp['company_name'],
            'ticker': comp['ticker'] or '',
            'rank': comp['rank'],
            'country': comp['country'],
            'btc_holdings': f"{comp['btc_holdings']:,.0f} BTC" if comp['btc_holdings'] is not None else '0 BTC',
            'btc_holdings_value_in_USD': comp['usd_value'] or '$0',
            'market_cap': comp['market_cap'] or '$0',
            'percentage_of_total_supply': f"{comp['percentage_of_total_supply']:.3f} % of total BTC supply" if comp['percentage_of_total_supply'] is not None else '0 % of total BTC supply'
        }
        full_processed_companies.append(pcomp)
    
    # Assign based on show_full_list (only relevant field assigned, others default None)
    if inputs.show_full_list:
        output.public_companies_with_BTC_holdings = full_processed_companies
    else:
        top10 = full_processed_companies[:10]
        output.top_10_public_companies_with_BTC_holdings = top10
    
    # For plots: use top 10
    top10_processed = full_processed_companies[:10]
    top10_names = [comp['company_name'] for comp in top10_processed]
    name_to_ticker = {comp['company_name']: comp['ticker'] or comp['company_name'] for comp in top10_processed}
    
    home_path = await get_home_path()
    
    # Plot 1: Top 10 holdings over time (buffer x, labels right of last point)
    top10_png = os.path.join(folder_path, 'btc_top10_holdings.png')
    if os.path.exists(companies_history_path) and top10_names:
        companies_df = pd.read_csv(companies_history_path)
        if not companies_df.empty:
            companies_df['timestamp'] = pd.to_datetime(companies_df['timestamp'])
            companies_df['btc_holdings'] = pd.to_numeric(companies_df['btc_holdings'], errors='coerce').fillna(0)
            plot_df = companies_df[companies_df['company_name'].isin(top10_names)]
            if not plot_df.empty:
                min_x = plot_df['timestamp'].min()
                max_x = plot_df['timestamp'].max()
                
                # Calculate the total time range of the data
                if min_x == max_x:
                    time_range = timedelta(days=1) # Handle case with only one data point
                else:
                    time_range = max_x - min_x

                # Create proportional buffers and text offset based on the time range
                left_buffer = time_range * 0.05   # 5% buffer on the left
                right_buffer = time_range * 0.05  # 35% buffer on the right for labels
                text_offset = time_range * 0.02   # Small gap between line end and text start

                min_lim = min_x - left_buffer
                max_lim = max_x + right_buffer

                plt.style.use('dark_background')
                fig, ax = plt.subplots(figsize=(12, 6))
                for name in top10_names:
                    name_df = plot_df[plot_df['company_name'] == name].sort_values('timestamp')
                    if not name_df.empty:
                        line, = ax.plot(name_df['timestamp'], name_df['btc_holdings'], marker='o')
                        color = line.get_color()
                        last_x = name_df['timestamp'].iloc[-1]
                        last_y = name_df['btc_holdings'].iloc[-1]
                        label_text = name_to_ticker.get(name, name)

                        # Use the new proportional offset
                        ax.text(last_x + text_offset, last_y, label_text, color=color, va='center', ha='left', fontsize=9)
                
                ax.set_title('Top 10 Public Companies BTC Holdings Over Time')
                ax.set_xlabel('Time')
                ax.set_ylabel('BTC Holdings')
                ax.set_xlim(min_lim, max_lim) # Apply the corrected limits
                ax.grid(True, alpha=0.3)
                plt.xticks(rotation=45)
                plt.tight_layout()
                plt.savefig(top10_png, dpi=300, bbox_inches='tight')
                plt.savefig(os.path.join(home_path, 'btc_top10_holdings.png'), dpi=300, bbox_inches='tight')
                plt.close()
                saved_files.append(top10_png)
    
    # Plot 2: 2x2 panel for totals over time (white lines, small buffer x)
    totals_panel_png = os.path.join(folder_path, 'btc_totals_panel.png')
    if os.path.exists(totals_history_path):
        totals_df = pd.read_csv(totals_history_path)
        if not totals_df.empty:
            totals_df['timestamp'] = pd.to_datetime(totals_df['timestamp'])
            totals_df['total_btc'] = pd.to_numeric(totals_df['total_btc'], errors='coerce').fillna(0)
            totals_df['total_usd_value'] = pd.to_numeric(totals_df['total_usd_value'], errors='coerce').fillna(0)
            totals_df['total_supply_percentage'] = pd.to_numeric(totals_df['total_supply_percentage'], errors='coerce').fillna(0)
            totals_df['num_companies'] = pd.to_numeric(totals_df['num_companies'], errors='coerce').fillna(0)
            min_x = totals_df['timestamp'].min()
            max_x = totals_df['timestamp'].max()
            if min_x == max_x:
                buffer = timedelta(days=1)
            else:
                buffer = (max_x - min_x) * 0.05
            min_lim = min_x - buffer
            max_lim = max_x + buffer
            plt.style.use('dark_background')
            fig, axs = plt.subplots(2, 2, figsize=(12, 10))
            
            # Total BTC
            axs[0, 0].plot(totals_df['timestamp'], totals_df['total_btc'], color='white', marker='o')
            axs[0, 0].set_title('Total BTC Held Over Time')
            axs[0, 0].set_ylabel('Total BTC')
            axs[0, 0].grid(True, alpha=0.3)
            
            # Total Supply Percentage
            axs[0, 1].plot(totals_df['timestamp'], totals_df['total_supply_percentage'], color='white', marker='o')
            axs[0, 1].set_title('Total Supply Percentage Over Time')
            axs[0, 1].set_ylabel('% of Total Supply')
            axs[0, 1].grid(True, alpha=0.3)
            
            # Total USD Value
            axs[1, 0].plot(totals_df['timestamp'], totals_df['total_usd_value'], color='white', marker='o')
            axs[1, 0].set_title('Total USD Value Over Time')
            axs[1, 0].set_ylabel('USD')
            axs[1, 0].grid(True, alpha=0.3)
            
            # Number of Companies
            axs[1, 1].plot(totals_df['timestamp'], totals_df['num_companies'], color='white', marker='o')
            axs[1, 1].set_title('Number of Companies Over Time')
            axs[1, 1].set_ylabel('Number of Companies')
            axs[1, 1].grid(True, alpha=0.3)
            
            plt.suptitle('Bitcoin Treasuries Aggregate Data Over Time')
            for ax in axs.flat:
                ax.tick_params(axis='x', rotation=45)
                ax.set_xlim(min_lim, max_lim)
            plt.tight_layout()
            plt.savefig(totals_panel_png, dpi=300, bbox_inches='tight')
            plt.savefig(os.path.join(home_path, 'btc_totals_panel.png'), dpi=300, bbox_inches='tight')
            plt.close()
            saved_files.append(totals_panel_png)
    
    output.saved_files = saved_files
    
    return output