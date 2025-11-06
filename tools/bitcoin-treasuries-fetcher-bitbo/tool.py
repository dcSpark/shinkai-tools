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

TOTAL_BTC_SUPPLY = 21_000_000

def sanitize_filename(filename: str) -> str:
    """Removes characters that are invalid in Windows filenames."""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def parse_value(value_str: str) -> float:
    """Converts a plain numeric string (e.g., '3,735,805', '1,234.56 BTC') to a float."""
    if not value_str or value_str in ['—', '']:
        return 0.0
    clean_str = value_str.replace(',', '').replace(' BTC', '').strip()
    try:
        return float(clean_str)
    except ValueError:
        return 0.0

def parse_usd_value(value_str: str) -> float:
    """Converts a formatted currency string (e.g., '$66.36 B', '$888.35 M') to a float."""
    if not value_str or value_str in ['—', '']:
        return 0.0
    
    value_str = value_str.replace('$', '').strip()
    
    # Handle multipliers
    if 'B' in value_str:
        return float(value_str.replace('B', '').strip()) * 1e9
    elif 'M' in value_str:
        return float(value_str.replace('M', '').strip()) * 1e6
    elif 'K' in value_str:
        return float(value_str.replace('K', '').strip()) * 1e3
    
    # Handle plain numbers
    try:
        return float(value_str.replace(',', ''))
    except ValueError:
        return 0.0

class CONFIG:
    folder_path: Optional[str] = None

class INPUTS:
    show_full_list_public_companies: bool = False
    show_full_list_private_companies: bool = False
    show_full_list_countries: bool = False
    show_full_list_etfs: bool = False
    show_full_list_miners: bool = False
    show_full_list_defi: bool = False
    
class OUTPUT:
    overall_totals: Dict[str, Any]
    totals_by_category: List[Dict[str, Any]]
    top_10_public_companies: Optional[List[Dict[str, Any]]] = None
    public_companies: Optional[List[Dict[str, Any]]] = None
    top_10_private_companies: Optional[List[Dict[str, Any]]] = None
    private_companies: Optional[List[Dict[str, Any]]] = None
    top_10_countries: Optional[List[Dict[str, Any]]] = None
    countries: Optional[List[Dict[str, Any]]] = None
    top_10_etfs: Optional[List[Dict[str, Any]]] = None
    etfs: Optional[List[Dict[str, Any]]] = None
    top_10_miners: Optional[List[Dict[str, Any]]] = None
    miners: Optional[List[Dict[str, Any]]] = None
    top_10_defi: Optional[List[Dict[str, Any]]] = None
    defi: Optional[List[Dict[str, Any]]] = None
    saved_files: List[str]

def parse_bitbo_treasuries(markdown_content: str) -> Dict[str, Any]:
    """Parses markdown from bitbo.io, calculates % of supply, and correctly parses USD values."""
    HEADER_TO_KEY_MAP = {
        "Public Companies that Own Bitcoin": "public_companies", "Countries & Governments that Own Bitcoin": "countries",
        "Private Companies that Own Bitcoin": "private_companies", "ETFs that Own Bitcoin": "etfs",
        "Bitcoin Mining Companies that Own Bitcoin": "miners", "Defi": "defi", "Totals by Category": "category_totals"
    }
    
    data = { key: [] for key in HEADER_TO_KEY_MAP.values() }; data["overall_totals"] = {}
    lines = markdown_content.split('\n'); current_section_key = None

    try:
        header_index = next(i for i, line in enumerate(lines) if "| Entities | # of BTC |" in line)
        cells = [c.strip() for c in lines[header_index + 2].split('|')]
        if len(cells) > 5:
            btc_holdings = parse_value(cells[2])
            data["overall_totals"] = { "entities": int(parse_value(cells[1])), "btc_holdings": btc_holdings, "value_usd": parse_usd_value(cells[3]), "percentage_of_21m": (btc_holdings / TOTAL_BTC_SUPPLY) * 100, "last_updated": cells[5] }
    except (StopIteration, IndexError, ValueError): pass

    for line in lines:
        line_stripped = line.strip()
        if line_stripped in HEADER_TO_KEY_MAP:
            current_section_key = HEADER_TO_KEY_MAP[line_stripped]; continue
        if not current_section_key or not line_stripped.startswith('|') or '| ---' in line_stripped or "Totals:" in line_stripped: continue

        cells = [c.strip() for c in line_stripped.split('|')]
        try:
            if current_section_key == "category_totals" and len(cells) > 4:
                name = (re.search(r'\[(.*?)\]', cells[1]) or [None, cells[1]])[1]
                if name.lower() == 'category': continue
                btc_holdings = parse_value(cells[2])
                data["category_totals"].append({ "category": name, "btc_holdings": btc_holdings, "value_usd": parse_usd_value(cells[3]), "percentage_of_21m": (btc_holdings / TOTAL_BTC_SUPPLY) * 100 })
            elif current_section_key != "category_totals" and len(cells) > 6:
                name = (re.search(r'\[(.*?)\]', cells[1]) or [None, cells[1]])[1]
                if not name: continue
                
                if current_section_key in ["defi", "countries"]:
                    btc_holdings = parse_value(cells[4]); value_usd = parse_usd_value(cells[5])
                else:
                    btc_holdings = parse_value(cells[5]); value_usd = parse_usd_value(cells[6])
                
                item_data = { "entity": name, "btc_holdings": btc_holdings, "value_usd": value_usd, "percentage_of_21m": (btc_holdings / TOTAL_BTC_SUPPLY) * 100 }
                data[current_section_key].append(item_data)
        except (IndexError, ValueError): continue
            
    for key in data:
        if isinstance(data[key], list) and key != "category_totals":
             data[key] = sorted(data[key], key=lambda x: x.get('btc_holdings', 0), reverse=True)
    return data

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT(); saved_files = []
    folder_path = config.folder_path.strip() if config.folder_path and config.folder_path.strip() else await get_home_path()
    os.makedirs(folder_path, exist_ok=True); home_path = await get_home_path()

    result = await webpage_clean_text_extractor({'url': 'https://bitbo.io/treasuries/', 'show_content': True})
    parsed_data = parse_bitbo_treasuries(result.get('content', ''))
    timestamp = datetime.now().isoformat()
    detailed_categories = ["public_companies", "private_companies", "countries", "etfs", "miners", "defi"]

    def append_to_csv(df, path):
        df.to_csv(path, mode='a', header=not os.path.exists(path), index=False)

    category_totals_history_path = os.path.join(folder_path, 'bitbo_btc_treasuries_category_totals_history.csv')
    if parsed_data["category_totals"]:
        append_to_csv(pd.DataFrame([{**{'timestamp': timestamp}, **row} for row in parsed_data["category_totals"]]), category_totals_history_path)
        saved_files.append(category_totals_history_path)
    for cat_name in detailed_categories:
        if parsed_data.get(cat_name):
            history_path = os.path.join(folder_path, f'bitbo_btc_treasuries_{cat_name}_history.csv')
            append_to_csv(pd.DataFrame([{**{'timestamp': timestamp}, **row} for row in parsed_data[cat_name]]), history_path)
            saved_files.append(history_path)

    output.overall_totals = { "entities": f"{parsed_data['overall_totals'].get('entities', 0):,}", "btc_holdings": f"{parsed_data['overall_totals'].get('btc_holdings', 0):,.2f} BTC", "value_usd": f"${parsed_data['overall_totals'].get('value_usd', 0):,.2f}", "percentage_of_21m": f"{parsed_data['overall_totals'].get('percentage_of_21m', 0):.3f}%", "last_updated": parsed_data['overall_totals'].get('last_updated', 'N/A') }
    output.totals_by_category = sorted([{"category": cat["category"], "btc_holdings": f"{cat.get('btc_holdings', 0):,.2f} BTC", "value_usd": f"${cat.get('value_usd', 0):,.2f}", "percentage_of_21m": f"{cat.get('percentage_of_21m', 0):.3f}%"} for cat in parsed_data["category_totals"]], key=lambda x: parse_value(x['btc_holdings']), reverse=True)
    category_map = { "public_companies": inputs.show_full_list_public_companies, "private_companies": inputs.show_full_list_private_companies, "countries": inputs.show_full_list_countries, "etfs": inputs.show_full_list_etfs, "miners": inputs.show_full_list_miners, "defi": inputs.show_full_list_defi }
    for cat_name, show_full in category_map.items():
        full_list = [{"entity": item["entity"], "btc_holdings": f"{item.get('btc_holdings', 0):,.2f} BTC", "value_usd": f"${item.get('value_usd', 0):,.2f}", "percentage_of_21m": f"{item.get('percentage_of_21m', 0):.4f}%"} for item in parsed_data.get(cat_name, [])]
        if show_full: setattr(output, cat_name, full_list)
        else: setattr(output, f"top_10_{cat_name}", full_list[:10])

    plt.style.use('dark_background')
    if parsed_data["category_totals"]:
        bar_filename = sanitize_filename('bitbo_btc_treasuries_category_distribution.png')
        bar_path = os.path.join(folder_path, bar_filename)
        sorted_cats = sorted(parsed_data["category_totals"], key=lambda x: x['btc_holdings'])
        labels = [c['category'] for c in sorted_cats]; sizes = [c['btc_holdings'] for c in sorted_cats]; percentages = [c['percentage_of_21m'] for c in sorted_cats]
        fig, ax = plt.subplots(figsize=(10, 8)); bars = ax.barh(labels, sizes); ax.set_xlabel('BTC Holdings'); ax.set_title('Bitcoin Treasury Distribution by Category'); ax.margins(x=0.25)
        for i, bar in enumerate(bars): ax.text(bar.get_width(), bar.get_y() + bar.get_height()/2, f" {sizes[i]:,.0f} BTC\n ({percentages[i]:.2f}%)", va='center', ha='left', color='white', fontsize=9)
        plt.tight_layout(); plt.savefig(bar_path, dpi=300, bbox_inches='tight'); plt.savefig(os.path.join(home_path, bar_filename), dpi=300, bbox_inches='tight'); plt.close(); saved_files.append(bar_path)

    if os.path.exists(category_totals_history_path) and len(pd.read_csv(category_totals_history_path)['timestamp'].unique()) > 1:
        cat_history_df = pd.read_csv(category_totals_history_path); cat_history_df['timestamp'] = pd.to_datetime(cat_history_df['timestamp'])
        pivot_df = cat_history_df.pivot(index='timestamp', columns='category', values='btc_holdings')
        fig, ax = plt.subplots(figsize=(12, 7)); min_date, max_date = pivot_df.index.min(), pivot_df.index.max(); time_range = max_date - min_date if max_date > min_date else timedelta(days=1)
        label_offset = time_range * 0.02; right_limit = max_date + time_range * 0.35
        for category in pivot_df.columns:
            series = pivot_df[category].dropna()
            if not series.empty:
                latest_pct = (series.iloc[-1] / TOTAL_BTC_SUPPLY) * 100
                label_text = f"{category} ({latest_pct:.2f}%)"
                line, = ax.plot(series.index, series.values, marker='o', label=category)
                ax.text(series.index[-1] + label_offset, series.values[-1], label_text, color=line.get_color(), va='center', ha='left', fontsize=9)
        ax.set_xlim(right=right_limit); ax.set_title('Bitcoin Holdings by Category Over Time'); ax.set_xlabel('Date'); ax.set_ylabel('BTC Holdings'); ax.grid(True, alpha=0.3); ax.legend().set_visible(False)
        plt.xticks(rotation=45); plt.tight_layout()
        plot_filename = sanitize_filename('bitbo_btc_treasuries_category_history.png'); plot_path = os.path.join(folder_path, plot_filename)
        plt.savefig(plot_path, dpi=300, bbox_inches='tight'); plt.savefig(os.path.join(home_path, plot_filename), dpi=300, bbox_inches='tight'); plt.close(); saved_files.append(plot_path)

    for cat_name in detailed_categories:
        history_path = os.path.join(folder_path, f'bitbo_btc_treasuries_{cat_name}_history.csv')
        if os.path.exists(history_path) and len(pd.read_csv(history_path)['timestamp'].unique()) > 1:
            df = pd.read_csv(history_path); df['timestamp'] = pd.to_datetime(df['timestamp'])
            top10_names = [item['entity'] for item in parsed_data.get(cat_name, [])[:10]]; plot_df = df[df['entity'].isin(top10_names)]
            if not plot_df.empty:
                fig, ax = plt.subplots(figsize=(12, 7)); min_date, max_date = plot_df['timestamp'].min(), plot_df['timestamp'].max(); time_range = max_date - min_date if max_date > min_date else timedelta(days=1)
                label_offset = time_range * 0.02; right_limit = max_date + time_range * 0.35
                for name in top10_names:
                    entity_df = plot_df[plot_df['entity'] == name].sort_values('timestamp')
                    if not entity_df.empty:
                        latest_pct = (entity_df['btc_holdings'].iloc[-1] / TOTAL_BTC_SUPPLY) * 100
                        label_text = f" {name} ({latest_pct:.3f}%)"
                        line, = ax.plot(entity_df['timestamp'], entity_df['btc_holdings'], marker='o', label=name)
                        ax.text(entity_df['timestamp'].iloc[-1] + label_offset, entity_df['btc_holdings'].iloc[-1], label_text, color=line.get_color(), va='center', ha='left', fontsize=9)
                ax.set_xlim(right=right_limit); ax.set_title(f'Top 10 {cat_name.replace("_", " ").title()} BTC Holdings Over Time'); ax.set_xlabel('Date'); ax.set_ylabel('BTC Holdings'); ax.grid(True, alpha=0.3); ax.legend().set_visible(False)
                plt.xticks(rotation=45); plt.tight_layout()
                plot_filename = sanitize_filename(f'bitbo_btc_treasuries_{cat_name}_top10_history.png'); plot_path = os.path.join(folder_path, plot_filename)
                plt.savefig(plot_path, dpi=300, bbox_inches='tight'); plt.savefig(os.path.join(home_path, plot_filename), dpi=300, bbox_inches='tight'); plt.close(); saved_files.append(plot_path)

    output.saved_files = saved_files
    return output