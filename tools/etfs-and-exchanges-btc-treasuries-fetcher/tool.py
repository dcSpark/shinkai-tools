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
    """Converts a formatted USD string (e.g., '$1.2B', '500M') to a float."""
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
    folder_path: Optional[str] = None

class INPUTS:
    show_full_list: bool = False

class OUTPUT:
    overview_of_etfs_and_exchanges_with_BTC_treasuries: Dict[str, Any]
    top_10_etfs_and_exchanges_with_BTC_holdings: Optional[List[Dict[str, Any]]] = None
    etfs_and_exchanges_with_BTC_holdings: Optional[List[Dict[str, Any]]] = None
    saved_files: List[str]

def parse_etf_exchange_btc_treasuries(markdown_content: str) -> dict:
    """
    Parses markdown content from bitcointreasuries.net for ETFs and Exchanges.
    This version is more robust and identifies the correct table by its unique column structure.
    """
    entities = []
    totals = {}
    lines = markdown_content.strip().split('\n')
    
    for line in lines:
        clean_line = line.strip()
        
        if not clean_line.startswith('|') or '| ---' in clean_line:
            continue
            
        cells = [cell.strip() for cell in clean_line.split('|')]
        
        # Heuristic for the unique ETF/Exchanges total line
        if len(cells) > 5 and "Total:" in cells[3]:
            try:
                totals['total_btc'] = float(cells[4].replace(',', ''))
                totals['total_usd_value'] = cells[5]
                totals['total_supply_percentage'] = float(cells[6].replace('%', ''))
                break # Stop parsing after finding the final total for this section
            except (ValueError, IndexError):
                continue

        # Heuristic for an ETF/Exchanges data row:
        # It must have at least 8 cells (including empty ones from start/end '|')
        # and contain specific patterns like a rank, country link, BTC symbol, $, and %
        # The try/except block is the most effective filter.
        if len(cells) < 8:
            continue
            
        try:
            # Rank (must be a number)
            rank = int(cells[1])

            # Country from flag column (must contain a country link)
            country_slug_match = re.search(r'countries/([\w-]+)', cells[2])
            if not country_slug_match:
                continue
            country = country_slug_match.group(1).replace('-', ' ').title()
            
            # Entity Name and Ticker
            name_raw = cells[3]
            name_match = re.search(r'\[(.*?)\]\(', name_raw)
            entity_name = name_match.group(1).strip() if name_match else name_raw.strip()
            
            ticker = ''
            # Ticker often follows the markdown link, e.g., "] (...) Ticker"
            ticker_match = re.search(r'\)\s+([\w.-]+)$', name_raw)
            if ticker_match:
                ticker = ticker_match.group(1).strip()

            # BTC Holdings (must contain the Bitcoin symbol or be a number)
            btc_holdings_raw = cells[4].replace('₿', '').replace(',', '')
            btc_holdings = float(btc_holdings_raw)

            # USD Value (as string, must contain '$')
            usd_value = cells[5]
            if '$' not in usd_value:
                continue
            
            # Supply Percentage (must contain '%')
            supply_pct_raw = cells[6]
            if '%' not in supply_pct_raw:
                continue
            supply_pct = float(supply_pct_raw.replace('%',''))
            
            entity_data = {
                'rank': rank,
                'country': country,
                'entity_name': entity_name,
                'ticker': ticker,
                'btc_holdings': btc_holdings,
                'usd_value': usd_value,
                'percentage_of_total_supply': supply_pct
            }
            entities.append(entity_data)
        
        except (ValueError, IndexError, AttributeError):
            # This will gracefully skip header lines or any other non-data rows
            continue
            
    return {
        'totals': totals,
        'entities': sorted(entities, key=lambda x: x['rank'])
    }


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    
    saved_files = []
    
    folder_path = config.folder_path.strip() if config.folder_path and config.folder_path.strip() else await get_home_path()
    os.makedirs(folder_path, exist_ok=True)
    
    entities_history_path = os.path.join(folder_path, 'btc_etfs_exchanges_history.csv')
    totals_history_path = os.path.join(folder_path, 'btc_etf_exchange_totals_history.csv')
    
    extractor_input = {
        'url': 'https://bitcointreasuries.net/etfs-and-exchanges',
        'show_content': True
    }
    
    result = await webpage_clean_text_extractor(extractor_input)
    
    markdown_content = result.get('content', '')
    
    if markdown_content:
        data = parse_etf_exchange_btc_treasuries(markdown_content)
        parsed_totals = data['totals']
        parsed_entities = data['entities']
    else:
        parsed_totals = {}
        parsed_entities = []
    
    timestamp = datetime.now().isoformat()
    num_entities = len(parsed_entities)
    
    # Append to totals history (raw numbers)
    total_usd_raw = parse_usd(parsed_totals.get('total_usd_value', '$0'))
    totals_data = {
        'timestamp': timestamp,
        'total_btc': parsed_totals.get('total_btc', 0.0),
        'total_usd_value': total_usd_raw,
        'total_supply_percentage': parsed_totals.get('total_supply_percentage', 0.0),
        'num_entities': num_entities
    }
    new_totals_df = pd.DataFrame([totals_data])
    if os.path.exists(totals_history_path):
        old_df = pd.read_csv(totals_history_path)
        df = pd.concat([old_df, new_totals_df], ignore_index=True)
    else:
        df = new_totals_df
    df.to_csv(totals_history_path, index=False)
    saved_files.append(totals_history_path)
    
    # Append to entities history (raw numbers)
    entities_list = []
    for entity in parsed_entities:
        usd_raw = parse_usd(entity['usd_value']) if entity['usd_value'] else 0.0
        entity_data = {
            'timestamp': timestamp,
            'rank': entity['rank'],
            'country': entity['country'],
            'entity_name': entity['entity_name'],
            'ticker': entity['ticker'],
            'btc_holdings': entity['btc_holdings'] or 0.0,
            'usd_value': usd_raw,
            'percentage_of_total_supply': entity['percentage_of_total_supply'] or 0.0
        }
        entities_list.append(entity_data)
    if entities_list:
        new_entities_df = pd.DataFrame(entities_list)
        if os.path.exists(entities_history_path):
            old_df = pd.read_csv(entities_history_path)
            df = pd.concat([old_df, new_entities_df], ignore_index=True)
        else:
            df = new_entities_df
        df.to_csv(entities_history_path, index=False)
    saved_files.append(entities_history_path)
    
    # Process overview
    total_btc = parsed_totals.get('total_btc', 0)
    total_usd_value = parsed_totals.get('total_usd_value', '$0')
    supply_pct = parsed_totals.get('total_supply_percentage', 0)
    overview = {
        'count': f"{num_entities} entities (ETFs, Exchanges, etc.)",
        'total_btc': f"{total_btc:,.0f} BTC",
        'total_usd_value': total_usd_value,
        'total_supply_percentage': f"{supply_pct:.3f} % of total BTC supply"
    }
    output.overview_of_etfs_and_exchanges_with_BTC_treasuries = overview
    
    # Process full list with formatted strings
    full_processed_entities = []
    for entity in parsed_entities:
        p_entity = {
            'entity_name': entity['entity_name'],
            'ticker': entity['ticker'],
            'rank': entity['rank'],
            'country': entity['country'],
            'btc_holdings': f"{entity['btc_holdings']:,g} BTC" if entity['btc_holdings'] is not None else '0 BTC',
            'btc_holdings_value_in_USD': entity['usd_value'] or '$0',
            'percentage_of_total_supply': f"{entity['percentage_of_total_supply']:.3f} % of total BTC supply" if entity['percentage_of_total_supply'] is not None else '0 % of total BTC supply'
        }
        full_processed_entities.append(p_entity)
    
    # Assign based on show_full_list
    if inputs.show_full_list:
        output.etfs_and_exchanges_with_BTC_holdings = full_processed_entities
    else:
        top10 = full_processed_entities[:10]
        output.top_10_etfs_and_exchanges_with_BTC_holdings = top10
    
    # For plots: use top 10 from the most recent data
    top10_names = [entity['entity_name'] for entity in full_processed_entities[:10]]
    
    home_path = await get_home_path()
    
    # Plot 1: Top 10 holdings over time
    top10_png = os.path.join(folder_path, 'btc_etfs_exchanges_top10_holdings.png')
    if os.path.exists(entities_history_path) and top10_names:
        entities_df = pd.read_csv(entities_history_path)
        if not entities_df.empty:
            entities_df['timestamp'] = pd.to_datetime(entities_df['timestamp'])
            entities_df['btc_holdings'] = pd.to_numeric(entities_df['btc_holdings'], errors='coerce').fillna(0)
            plot_df = entities_df[entities_df['entity_name'].isin(top10_names)]
            if not plot_df.empty:
                min_x = plot_df['timestamp'].min()
                max_x = plot_df['timestamp'].max()
                
                time_range = max_x - min_x if min_x != max_x else timedelta(days=1)
                right_buffer = time_range * 0.35 # Buffer for labels
                text_offset = time_range * 0.02
                max_lim = max_x + right_buffer

                plt.style.use('dark_background')
                fig, ax = plt.subplots(figsize=(12, 6))
                for name in top10_names:
                    name_df = plot_df[plot_df['entity_name'] == name].sort_values('timestamp')
                    if not name_df.empty:
                        line, = ax.plot(name_df['timestamp'], name_df['btc_holdings'], marker='o')
                        color = line.get_color()
                        last_x = name_df['timestamp'].iloc[-1]
                        last_y = name_df['btc_holdings'].iloc[-1]
                        ax.text(last_x + text_offset, last_y, name, color=color, va='center', ha='left', fontsize=9)
                
                ax.set_title('Top 10 ETFs & Exchanges BTC Holdings Over Time')
                ax.set_xlabel('Time')
                ax.set_ylabel('BTC Holdings')
                ax.set_xlim(right=max_lim)
                ax.grid(True, alpha=0.3)
                plt.xticks(rotation=45)
                plt.tight_layout()
                plt.savefig(top10_png, dpi=300, bbox_inches='tight')
                plt.savefig(os.path.join(home_path, 'btc_etfs_exchanges_top10_holdings.png'), dpi=300, bbox_inches='tight')
                plt.close()
                saved_files.append(top10_png)
    
    # Plot 2: 2x2 panel for totals over time
    totals_panel_png = os.path.join(folder_path, 'btc_etf_exchange_totals_panel.png')
    if os.path.exists(totals_history_path):
        totals_df = pd.read_csv(totals_history_path)
        if not totals_df.empty:
            totals_df['timestamp'] = pd.to_datetime(totals_df['timestamp'])
            totals_df['total_btc'] = pd.to_numeric(totals_df['total_btc'], errors='coerce').fillna(0)
            totals_df['total_usd_value'] = pd.to_numeric(totals_df['total_usd_value'], errors='coerce').fillna(0)
            totals_df['total_supply_percentage'] = pd.to_numeric(totals_df['total_supply_percentage'], errors='coerce').fillna(0)
            totals_df['num_entities'] = pd.to_numeric(totals_df['num_entities'], errors='coerce').fillna(0)
            
            plt.style.use('dark_background')
            fig, axs = plt.subplots(2, 2, figsize=(12, 10))
            
            axs[0, 0].plot(totals_df['timestamp'], totals_df['total_btc'], color='white', marker='o')
            axs[0, 0].set_title('Total BTC Held Over Time')
            axs[0, 0].set_ylabel('Total BTC')
            
            axs[0, 1].plot(totals_df['timestamp'], totals_df['total_supply_percentage'], color='white', marker='o')
            axs[0, 1].set_title('Total Supply Percentage Over Time')
            axs[0, 1].set_ylabel('% of Total Supply')
            
            axs[1, 0].plot(totals_df['timestamp'], totals_df['total_usd_value'], color='white', marker='o')
            axs[1, 0].set_title('Total USD Value Over Time')
            axs[1, 0].set_ylabel('USD Value (in Billions)')
            
            axs[1, 1].plot(totals_df['timestamp'], totals_df['num_entities'], color='white', marker='o')
            axs[1, 1].set_title('Number of Entities Over Time')
            axs[1, 1].set_ylabel('Number of Entities')
            
            plt.suptitle('ETF & Exchange Bitcoin Treasuries Aggregate Data Over Time')
            for ax in axs.flat:
                ax.grid(True, alpha=0.3)
                ax.tick_params(axis='x', rotation=45)
            plt.tight_layout()
            plt.savefig(totals_panel_png, dpi=300, bbox_inches='tight')
            plt.savefig(os.path.join(home_path, 'btc_etf_exchange_totals_panel.png'), dpi=300, bbox_inches='tight')
            plt.close()
            saved_files.append(totals_panel_png)
    
    output.saved_files = saved_files
    
    return output