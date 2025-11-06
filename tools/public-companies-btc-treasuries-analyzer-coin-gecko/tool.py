# /// script
# dependencies = [
#   "requests",
#   "matplotlib",
#   "pandas",
# ]
# ///

from typing import Any, Optional, List, Dict
import csv
import os
from datetime import datetime
import traceback

import requests
from shinkai_local_support import get_home_path  # type: ignore

class CONFIG:
    api_key: str  # CoinGecko API key (x-cg-demo-api-key)
    save_folder: str  # folder path where the data (CSV) and graphs will be saved

class INPUTS:
    show_full_list: Optional[bool] = False  # whether to include the full companies data in the output (default: False)

class OUTPUT:
    top_10_public_companies_with_BTC_treasuries: List[dict]
    # overview moved to top-level key; we still include 'overview' field for compatibility but will set top-level key directly
    Overview_of_public_companies_with_bitcoin_treasuries: dict  # exact key expected by user (underscores sanitized in attribute)
    # new structure for saved files (both for 'save_files' and 'saved_files')
    save_files: Dict[str, List[str]]
    data_source: str
    error: Optional[str]
    full_companies: Optional[List[dict]]

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.top_10_public_companies_with_BTC_treasuries = []
    output.Overview_of_public_companies_with_bitcoin_treasuries = {}
    output.save_files = {"plot_saved_paths": [], "data_saved_paths": []}
    output.data_source = "coingecko"
    output.error = None
    output.full_companies = None

    coin_id = "bitcoin"  # force bitcoin

    try:
        api_url = f"https://api.coingecko.com/api/v3/companies/public_treasury/{coin_id}"
        headers = {"x-cg-demo-api-key": config.api_key}
        resp = requests.get(api_url, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        total_holdings = data.get("total_holdings")
        total_value_usd = data.get("total_value_usd")
        market_cap_dominance = data.get("market_cap_dominance")
        companies = data.get("companies", [])
        if not isinstance(companies, list):
            companies = []

        companies_sorted = sorted(companies, key=lambda c: c.get("total_holdings", 0), reverse=True)

        timestamp = datetime.utcnow().isoformat()

        header = [
            "timestamp",
            "name",
            "symbol",
            "country",
            "total_holdings",
            "total_entry_value_usd",
            "total_current_value_usd",
            "percentage_of_total_supply",
        ]
        csv_rows = []
        for c in companies_sorted:
            row = {
                "timestamp": timestamp,
                "name": c.get("name"),
                "symbol": c.get("symbol"),
                "country": c.get("country"),
                "total_holdings": c.get("total_holdings"),
                "total_entry_value_usd": c.get("total_entry_value_usd"),
                "total_current_value_usd": c.get("total_current_value_usd"),
                "percentage_of_total_supply": c.get("percentage_of_total_supply"),
            }
            csv_rows.append(row)

        save_folder = config.save_folder
        os.makedirs(save_folder, exist_ok=True)
        companies_csv = os.path.join(save_folder, "BTC_treasury_public_companies_full_data.csv")
        write_header = not os.path.exists(companies_csv)
        with open(companies_csv, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=header)
            if write_header:
                writer.writeheader()
            for row in csv_rows:
                writer.writerow(row)

        aggregates_header = ["timestamp", "total_btc", "total_usd", "market_cap_dominance", "count"]
        count = len(companies_sorted)
        total_btc = total_holdings if isinstance(total_holdings, (int, float)) else sum(
            [c.get("total_holdings", 0) for c in companies_sorted]
        )
        total_usd = total_value_usd if isinstance(total_value_usd, (int, float)) else sum(
            [c.get("total_current_value_usd", 0) or 0 for c in companies_sorted]
        )
        dominance = market_cap_dominance if isinstance(market_cap_dominance, (int, float)) else None

        aggregates_row = {
            "timestamp": timestamp,
            "total_btc": total_btc,
            "total_usd": total_usd,
            "market_cap_dominance": dominance,
            "count": count,
        }
        aggregates_csv = os.path.join(save_folder, "BTC_treasuries_public_companies_aggregate_data.csv")
        write_header_agg = not os.path.exists(aggregates_csv)
        with open(aggregates_csv, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=aggregates_header)
            if write_header_agg:
                writer.writeheader()
            writer.writerow(aggregates_row)

        # Build detailed top 10 with requested formatting and gain factor
        top_10 = companies_sorted[:10]
        detailed_top_10 = []
        for c in top_10:
            name = c.get("name") or "Unknown"
            symbol = c.get("symbol") or ""
            country = c.get("country") or ""
            pct = c.get("percentage_of_total_supply")
            total_hold = c.get("total_holdings") or 0
            entry_usd = c.get("total_entry_value_usd")
            current_usd = c.get("total_current_value_usd") or 0

            try:
                total_holdings_str = f"{int(total_hold):,} BTC"
            except Exception:
                total_holdings_str = f"{total_hold:,} BTC"

            try:
                entry_usd_val = float(entry_usd) if entry_usd is not None else None
            except Exception:
                entry_usd_val = None
            try:
                current_usd_val = float(current_usd) if current_usd is not None else 0.0
            except Exception:
                current_usd_val = 0.0

            def fmt_usd(v):
                try:
                    return f"${v:,.12f}".rstrip("0").rstrip(".")
                except Exception:
                    return f"${v}"

            entry_usd_str = fmt_usd(entry_usd_val) if entry_usd_val is not None else None
            current_usd_str = fmt_usd(current_usd_val)

            pct_str = f"{pct} % of all BTC" if pct is not None else None

            gain_factor = None
            if entry_usd_val not in (None, 0):
                try:
                    gain_factor = current_usd_val / entry_usd_val
                except Exception:
                    gain_factor = None

            detailed = {
                "country": country,
                "name": name,
                "percentage_of_total_supply": pct_str,
                "symbol": symbol,
                "total_current_value_usd": current_usd_str,
                "total_entry_value_usd": entry_usd_str,
                "total_holdings": total_holdings_str,
                "gain_factor": gain_factor,
            }
            detailed_top_10.append(detailed)

        output.top_10_public_companies_with_BTC_treasuries = detailed_top_10

        # Build cleaned top-level overview key with units (exact key name requested)
        def fmt_number(n):
            try:
                if isinstance(n, int):
                    return f"{n:,}"
                if isinstance(n, float):
                    return f"{n:,.8f}".rstrip("0").rstrip(".")
                return str(n)
            except Exception:
                return str(n)

        overview_dict = {
            "count": f"{count} public companies",
            "market_cap_dominance": f"{dominance} % of all Bitcoins" if dominance is not None else None,
            "total_btc": f"{fmt_number(total_btc)} BTC",
            "total_usd": f"${fmt_number(total_usd)} ",
        }
        # assign to the attribute that will be returned as top-level key (attribute name adapted)
        output.Overview_of_public_companies_with_bitcoin_treasuries = overview_dict

        if getattr(inputs, "show_full_list", False):
            output.full_companies = companies_sorted
        else:
            output.full_companies = None

        # Plotting
        try:
            import pandas as pd  # type: ignore
            import matplotlib.pyplot as plt  # type: ignore
            import matplotlib.dates as mdates  # type: ignore
        except Exception as e:
            output.error = f"Plotting skipped due to missing libraries: {e}"
            # populate save_files with data CSVs only
            output.save_files = {"plot_saved_paths": [], "data_saved_paths": [aggregates_csv, companies_csv]}
            return output

        try:
            df_comp = pd.read_csv(companies_csv, parse_dates=["timestamp"])
        except Exception as e:
            output.error = f"Plotting skipped because companies CSV could not be read: {e}"
            output.save_files = {"plot_saved_paths": [], "data_saved_paths": [aggregates_csv, companies_csv]}
            return output

        try:
            latest_ts = df_comp["timestamp"].max()
            latest_snapshot = df_comp[df_comp["timestamp"] == latest_ts].copy()
            latest_snapshot["id_key"] = latest_snapshot["symbol"].fillna(latest_snapshot["name"])
            latest_snapshot = latest_snapshot.sort_values(by="total_holdings", ascending=False)
            top10_keys = list(latest_snapshot["id_key"].iloc[:10])

            if len(top10_keys) == 0:
                output.error = "Plotting skipped: no public companies found in CSV for plotting."
                output.save_files = {"plot_saved_paths": [], "data_saved_paths": [aggregates_csv, companies_csv]}
                return output

            df_comp["id_key"] = df_comp["symbol"].fillna(df_comp["name"])
            df_plot = df_comp[df_comp["id_key"].isin(top10_keys)].copy()
            df_plot["total_holdings"] = pd.to_numeric(df_plot["total_holdings"], errors="coerce").fillna(0)
            pivot = df_plot.pivot_table(index="timestamp", columns="id_key", values="total_holdings", aggfunc="last")
            pivot = pivot.sort_index()

            plt.style.use("dark_background")
            fig1, ax1 = plt.subplots(figsize=(12, 8))
            colors = {}
            for col in pivot.columns:
                line, = ax1.plot(pivot.index, pivot[col], marker="o", label=col)
                colors[col] = line.get_color()

            ax1.set_xlabel("Timestamp", color="white")
            ax1.set_ylabel("BTC Holdings", color="white")
            ax1.tick_params(colors="white")
            for spine in ax1.spines.values():
                spine.set_color("white")
            ax1.set_title("Top 10 Public Companies BTC Holdings Over Time", color="white")

            ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
            fig1.autofmt_xdate()
            x_vals = mdates.date2num(pivot.index.to_pydatetime()) if len(pivot.index) > 0 else None
            if x_vals is not None and len(x_vals) > 0:
                x_min, x_max = x_vals.min(), x_vals.max()
            else:
                x_min = x_max = None

            for col in pivot.columns:
                series = pivot[col].dropna()
                if series.empty:
                    continue
                last_ts = series.index.max()
                last_y = series.loc[last_ts]
                last_x = mdates.date2num(pd.to_datetime(last_ts).to_pydatetime())
                if x_min is not None and x_max is not None and x_max != x_min:
                    offset = (x_max - x_min) * 0.02
                else:
                    offset = 0
                label_x_num = last_x + offset
                label_x = mdates.num2date(label_x_num)
                ax1.text(label_x, last_y, f" {col}", color=colors.get(col, "white"),
                         va="center", fontsize=9)

            fig1.tight_layout()

            try:
                df_agg = pd.read_csv(aggregates_csv, parse_dates=["timestamp"])
            except Exception:
                import pandas as _pd  # type: ignore
                df_agg = _pd.DataFrame([aggregates_row])
                df_agg["timestamp"] = _pd.to_datetime(df_agg["timestamp"])

            df_agg["timestamp"] = pd.to_datetime(df_agg["timestamp"])

            fig2, axes = plt.subplots(nrows=2, ncols=2, figsize=(14, 10), sharex=True)
            ax_a = axes[0, 0]
            ax_b = axes[0, 1]
            ax_c = axes[1, 0]
            ax_d = axes[1, 1]

            ax_a.plot(df_agg["timestamp"], pd.to_numeric(df_agg["total_btc"], errors="coerce"), marker="o", color="white")
            ax_a.set_ylabel("Total BTC", color="white")
            ax_a.tick_params(colors="white")
            ax_a.set_title("Total BTC Held by Public Companies", color="white")

            ax_b.plot(df_agg["timestamp"], pd.to_numeric(df_agg["total_usd"], errors="coerce"), marker="o", color="white")
            ax_b.set_ylabel("Total USD", color="white")
            ax_b.tick_params(colors="white")
            ax_b.set_title("Total USD Value of Holdings", color="white")

            ax_c.plot(df_agg["timestamp"], pd.to_numeric(df_agg["count"], errors="coerce"), marker="o", color="white")
            ax_c.set_ylabel("Public Company Count", color="white")
            ax_c.tick_params(colors="white")
            ax_c.set_title("Count of Public Companies Reporting", color="white")

            ax_d.plot(df_agg["timestamp"], pd.to_numeric(df_agg["market_cap_dominance"], errors="coerce"), marker="o", color="white")
            ax_d.set_ylabel("Market Cap Dominance (%)", color="white")
            ax_d.tick_params(colors="white")
            ax_d.set_title("Market Cap Dominance Over Time", color="white")

            for ax in axes.flatten():
                for spine in ax.spines.values():
                    spine.set_color("white")
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))

            fig2.autofmt_xdate()
            fig2.tight_layout()

            plot1_name = "top10_public_companies_btc_holdings.png"
            plot2_name = "BTC_treasuries_public_companies_overview.png"
            plot1_local = os.path.join(save_folder, plot1_name)
            plot2_local = os.path.join(save_folder, plot2_name)

            try:
                home_path = await get_home_path()
            except Exception:
                home_path = os.path.expanduser("~")
            plot1_home = os.path.join(home_path, plot1_name)
            plot2_home = os.path.join(home_path, plot2_name)

            try:
                # Save both local and home copies, but only report local paths in save_files
                fig1.savefig(plot1_local, facecolor=fig1.get_facecolor())
                fig1.savefig(plot1_home, facecolor=fig1.get_facecolor())
                fig2.savefig(plot2_local, facecolor=fig2.get_facecolor())
                fig2.savefig(plot2_home, facecolor=fig2.get_facecolor())

                # build the save_files structure per user's requested layout
                save_files_dict = {
                    "plot_saved_paths": [plot1_local, plot2_local],
                    "data_saved_paths": [aggregates_csv, companies_csv],
                }
                output.save_files = save_files_dict
            except Exception as e:
                output.error = f"Plot saving failed: {e}"
                output.save_files = {"plot_saved_paths": [], "data_saved_paths": [aggregates_csv, companies_csv]}
            finally:
                import matplotlib.pyplot as _plt  # type: ignore
                _plt.close(fig1)
                _plt.close(fig2)

        except Exception as e:
            tb = traceback.format_exc()
            output.error = f"Plotting skipped due to error: {e}\n{tb}"
            output.save_files = {"plot_saved_paths": [], "data_saved_paths": [aggregates_csv, companies_csv]}

        return output

    except Exception as e:
        tb = traceback.format_exc()
        output.error = f"Failed to fetch or process data: {e}\n{tb}"
        return output