#!/usr/bin/env python3

import psycopg2
from datetime import datetime, timedelta

def detailed_analysis():
    """Detailed analysis of data quality issues"""
    conn = psycopg2.connect(
        host="localhost", port="5433", database="cnc_monitor",
        user="user", password="password"
    )
    cur = conn.cursor()
    
    print("🔍 DETAILED DATA QUALITY ANALYSIS")
    print("="*50)
    
    # 1. Expected vs Actual data rate
    cur.execute("""
        SELECT 
            MIN(time) as start_time,
            MAX(time) as end_time,
            COUNT(*) as total_records,
            EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) as duration_seconds
        FROM sensor_data;
    """)
    result = cur.fetchone()
    start_time, end_time, total_records, duration = result
    
    expected_records = int(duration * 10)  # 10 records/second (100ms sampling)
    missing_records = expected_records - total_records
    loss_percentage = (missing_records / expected_records) * 100
    
    print(f"📊 DATA RATE ANALYSIS:")
    print(f"  Duration: {duration:.1f} seconds")
    print(f"  Expected records: {expected_records}")
    print(f"  Actual records: {total_records}")
    print(f"  Missing records: {missing_records}")
    print(f"  Data loss: {loss_percentage:.1f}%")
    print()
    
    # 2. All significant gaps
    cur.execute("""
        WITH gaps AS (
            SELECT 
                time,
                LAG(time) OVER (ORDER BY time) as prev_time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds
            FROM sensor_data 
            ORDER BY time
        )
        SELECT time, prev_time, gap_seconds
        FROM gaps 
        WHERE gap_seconds > 0.5
        ORDER BY gap_seconds DESC;
    """)
    gaps = cur.fetchall()
    
    print(f"⚠️  ALL GAPS > 0.5 SECONDS ({len(gaps)} found):")
    for gap in gaps:
        print(f"  {gap[1]} → {gap[0]} | Gap: {gap[2]:.2f}s")
    print()
    
    # 3. Duplicate analysis
    cur.execute("""
        WITH duplicates AS (
            SELECT time, machine_id, COUNT(*) as count
            FROM sensor_data 
            GROUP BY time, machine_id 
            HAVING COUNT(*) > 1
        )
        SELECT d.time, d.machine_id, d.count,
               array_agg(s.temperature) as temperatures,
               array_agg(s.spindle_speed) as spindle_speeds
        FROM duplicates d
        JOIN sensor_data s ON d.time = s.time AND d.machine_id = s.machine_id
        GROUP BY d.time, d.machine_id, d.count;
    """)
    duplicates = cur.fetchall()
    
    print(f"🔄 DUPLICATE ANALYSIS ({len(duplicates)} found):")
    for dup in duplicates:
        print(f"  Time: {dup[0]}")
        print(f"  Machine: {dup[1]}")
        print(f"  Count: {dup[2]}")
        print(f"  Temperatures: {dup[3]}")
        print(f"  Spindle speeds: {dup[4]}")
    print()
    
    # 4. Timeline analysis - show exact timing pattern
    cur.execute("""
        SELECT 
            time,
            EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as interval_seconds
        FROM sensor_data 
        ORDER BY time
        LIMIT 20;
    """)
    timeline = cur.fetchall()
    
    print("📅 FIRST 20 RECORDS TIMING:")
    for i, (time, interval) in enumerate(timeline):
        if interval:
            print(f"  {i+1:2d}. {time} | Δ{interval:.3f}s")
        else:
            print(f"  {i+1:2d}. {time} | [START]")
    print()
    
    # 5. Recent data pattern
    cur.execute("""
        SELECT 
            time,
            EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as interval_seconds
        FROM sensor_data 
        WHERE time >= (SELECT MAX(time) - INTERVAL '1 minute' FROM sensor_data)
        ORDER BY time;
    """)
    recent = cur.fetchall()
    
    intervals = [r[1] for r in recent if r[1] is not None]
    if intervals:
        avg_interval = sum(intervals) / len(intervals)
        print(f"📈 RECENT DATA PATTERN (last minute):")
        print(f"  Records: {len(recent)}")
        print(f"  Average interval: {avg_interval:.3f}s")
        print(f"  Expected interval: 0.100s")
        print(f"  Actual vs Expected: {avg_interval/0.100:.1f}x slower")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    detailed_analysis()