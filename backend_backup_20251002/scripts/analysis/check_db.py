#!/usr/bin/env python3

import psycopg2
import json
from datetime import datetime, timedelta

def connect_to_db():
    """Connect to TimescaleDB"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            port="5433",
            database="cnc_monitor",
            user="user",
            password="password"
        )
        return conn
    except Exception as e:
        print(f"Connection failed: {e}")
        return None

def check_database_entries():
    """Check database entries for continuity"""
    conn = connect_to_db()
    if not conn:
        return
    
    cur = conn.cursor()
    
    try:
        # 1. Total record count
        cur.execute("SELECT COUNT(*) FROM sensor_data;")
        total_records = cur.fetchone()[0]
        print(f"📊 Total records in sensor_data: {total_records}")
        
        # 2. Check if table exists and has data
        if total_records == 0:
            print("⚠️  No data found in sensor_data table")
            
            # Check if tables exist
            cur.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)
            tables = cur.fetchall()
            print(f"📋 Available tables: {[t[0] for t in tables]}")
            return
        
        # 3. Time range analysis
        cur.execute("""
            SELECT 
                MIN(time) as earliest,
                MAX(time) as latest,
                COUNT(DISTINCT machine_id) as machine_count
            FROM sensor_data;
        """)
        result = cur.fetchone()
        earliest, latest, machine_count = result
        print(f"⏰ Time range: {earliest} to {latest}")
        print(f"🏭 Unique machines: {machine_count}")
        
        # 4. Recent data (last 10 records)
        cur.execute("""
            SELECT time, machine_id, temperature, spindle_speed 
            FROM sensor_data 
            ORDER BY time DESC 
            LIMIT 10;
        """)
        recent_data = cur.fetchall()
        print(f"\n📈 Most recent 10 records:")
        for row in recent_data:
            print(f"  {row[0]} | {row[1]} | Temp: {row[2]:.1f}°C | Spindle: {row[3]:.1f} RPM")
        
        # 5. Check for gaps in data (assuming 100ms sampling rate)
        print(f"\n🔍 Checking for data gaps...")
        cur.execute("""
            SELECT 
                machine_id,
                time,
                LAG(time) OVER (PARTITION BY machine_id ORDER BY time) as prev_time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (PARTITION BY machine_id ORDER BY time))) as gap_seconds
            FROM sensor_data 
            WHERE time >= NOW() - INTERVAL '1 hour'
            ORDER BY machine_id, time;
        """)
        
        gaps = cur.fetchall()
        significant_gaps = [g for g in gaps if g[3] and g[3] > 1.0]  # Gaps > 1 second
        
        if significant_gaps:
            print(f"⚠️  Found {len(significant_gaps)} gaps > 1 second:")
            for gap in significant_gaps[:5]:  # Show first 5
                print(f"  {gap[0]} | {gap[1]} | Gap: {gap[3]:.2f}s")
        else:
            print("✅ No significant gaps found in recent data")
        
        # 6. Check for duplicates
        cur.execute("""
            SELECT time, machine_id, COUNT(*) as count
            FROM sensor_data 
            GROUP BY time, machine_id 
            HAVING COUNT(*) > 1
            LIMIT 10;
        """)
        duplicates = cur.fetchall()
        if duplicates:
            print(f"⚠️  Found {len(duplicates)} duplicate timestamp+machine combinations:")
            for dup in duplicates:
                print(f"  {dup[0]} | {dup[1]} | Count: {dup[2]}")
        else:
            print("✅ No duplicates found")
        
        # 7. Data rate analysis
        cur.execute("""
            SELECT 
                machine_id,
                COUNT(*) as record_count,
                EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) as duration_seconds,
                COUNT(*) / EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) as records_per_second
            FROM sensor_data 
            WHERE time >= NOW() - INTERVAL '10 minutes'
            GROUP BY machine_id;
        """)
        rates = cur.fetchall()
        print(f"\n📊 Data rates (last 10 minutes):")
        for rate in rates:
            print(f"  {rate[0]} | {rate[1]} records | {rate[3]:.2f} records/sec")
        
        # 8. Check for missing expected data
        expected_rate = 10  # 100ms = 10 records per second
        for rate in rates:
            if rate[3] < expected_rate * 0.8:  # Allow 20% tolerance
                print(f"⚠️  {rate[0]} data rate is low: {rate[3]:.2f}/sec (expected ~{expected_rate}/sec)")
        
    except Exception as e:
        print(f"Error querying database: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_database_entries()