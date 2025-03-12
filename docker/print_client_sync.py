import psycopg2
import time
from tabulate import tabulate

# ANSI color codes
BRIGHT_RED = "\033[31;1m"   # Bold/bright red
LESS_RED   = "\033[31;2m"   # Dim red
GRAY       = "\033[90m"     # Gray
RESET      = "\033[0m"      # Reset to default terminal color

# Configuration: adjust these as needed
DB_HOST = "localhost"
DB_USER = "postgres"
DB_PASSWORD = "postgres"  # change if needed
DB_PORT = 10432

# Build the database list explicitly.
db_names = []
# snode1..snode8
for i in range(1, 9):
    db_names.append(f"snode{i}")
# anode1..anode5
for i in range(1, 6):
    db_names.append(f"anode{i}")

# Global dictionary to track (db, url) -> (last_offset, last_change_time)
# - last_offset: the last offset we saw
# - last_change_time: the timestamp when the offset last changed (None if it never changed from first seen)
last_data = {}

def query_db(db_name):
    """
    Connects to a given database and returns a dict of { target_node_url: offset }.
    Uses different table names for snodes vs anodes.
    """
    if db_name.startswith("anode"):
        table_name = 'public."dsetClient"'
    else:
        table_name = "public.dset_client"

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=db_name,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()
        query = f"""
            SELECT target_node_url, target_offset, state
            FROM {table_name}
            ORDER BY target_node_url
        """
        cur.execute(query)
        # Cast target_offset to int to avoid float vs int mismatches
        results = {row[0]: int(row[1]) for row in cur.fetchall()}
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Error connecting to {db_name}: {e}")
        return {}

def color_value(db, url, value, current_time):
    """
    Decide how to color the offset based on when it last changed.

    1) If this is the first time we see (db, url), store it but show white (no color).
    2) If the offset changed from last_val, set last_change_time = now => color it bright red immediately.
    3) If the offset is unchanged:
       - If last_change_time is None (never changed from first seen), keep it white.
       - Otherwise, color depends on how many seconds since last_change_time:
         <= 10s  => bright red
         <= 30s  => dim red
         <= 120s => gray
         > 120s  => white
    """
    key = (db, url)

    # If we never saw this db/url before, record it as first time, no color
    if key not in last_data:
        last_data[key] = (value, None)  # None means "no actual change recorded yet"
        return str(value)  # White (no color)

    last_val, last_change_time = last_data[key]

    # If the offset changed, record a new change time
    if value != last_val:
        last_data[key] = (value, current_time)
        # Immediate color => bright red, since delta=0
        return f"{BRIGHT_RED}{value}{RESET}"
    else:
        # Offset is the same
        if last_change_time is None:
            # It never actually changed from the first offset, so keep white
            return str(value)
        else:
            # Degrade color based on how long since last change
            delta = current_time - last_change_time
            if delta <= 10:
                color = BRIGHT_RED
            elif delta <= 30:
                color = LESS_RED
            elif delta <= 120:
                color = GRAY
            else:
                color = ""  # White

            return f"{color}{value}{RESET}" if color else str(value)

def merge_results(results_by_db, current_time):
    """
    Build the table rows. Each row: [url, offset_for_snode1, ..., offset_for_anode5]
    """
    all_urls = set()
    for data in results_by_db.values():
        all_urls.update(data.keys())
    all_urls = sorted(all_urls)

    header = ["target_node_url"] + db_names
    table_data = []
    for url in all_urls:
        row = [url]
        for db in db_names:
            value = results_by_db.get(db, {}).get(url, "N/A")
            if value == "N/A":
                row.append("N/A")
            else:
                row.append(color_value(db, url, value, current_time))
        table_data.append(row)
    return header, table_data

def main():
    while True:
        current_time = time.time()
        results_by_db = {}
        for db in db_names:
            results_by_db[db] = query_db(db)

        header, table_data = merge_results(results_by_db, current_time)

        # Clear screen and print the table
        print("\033[H\033[J", end="")
        print(tabulate(table_data, headers=header, tablefmt="grid"))

        time.sleep(10)

if __name__ == "__main__":
    main()
