#!/usr/bin/env python3

import psycopg2
from datetime import datetime, timedelta
import sys

def connect_to_db():
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            database="cnc_monitor",
            user="user",
            password="password"
        )
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def analyze_database():
    conn = connect_to_db()
    if not conn:
        return
    
    cur = conn.cursor()
    
    print("=" * 80)
    print("🔍 ULTIMATE DATABASE ANALYSIS - MASTERFUL DATA INTEGRITY VERIFICATION")
    print("=" * 80)
    
    # Basic stats
    cur.execute("SELECT COUNT(*) FROM sensor_data")
    total_records = cur.fetchone()[0]
    print(f"📊 Total records: {total_records}")
    
    if total_records == 0:
        print("⚠️  No data found - database is empty")
        return
    
    # Time range analysis
    cur.execute("SELECT MIN(time), MAX(time) FROM sensor_data")
    min_time, max_time = cur.fetchone()
    duration = max_time - min_time
    print(f"⏰ Time range: {min_time} to {max_time}")
    print(f"📏 Duration: {duration}")
    
    # Sequence number analysis
    print("\n🔢 SEQUENCE NUMBER ANALYSIS (Core Integrity Check)")
    print("-" * 60)
    
    cur.execute("""
        SELECT machine_id, MIN(sequence_number), MAX(sequence_number), COUNT(*) 
        FROM sensor_data 
        GROUP BY machine_id 
        ORDER BY machine_id
    """)
    
    sequence_stats = cur.fetchall()
    total_gaps = 0
    
    for machine_id, min_seq, max_seq, count in sequence_stats:
        expected_count = max_seq - min_seq + 1
        missing_count = expected_count - count
        gap_percentage = (missing_count / expected_count) * 100
        
        print(f"🤖 Machine {machine_id}:")
        print(f"   Sequence range: {min_seq} → {max_seq}")
        print(f"   Expected messages: {expected_count}")
        print(f"   Actual messages: {count}")
        print(f"   Missing messages: {missing_count}")
        print(f"   Gap percentage: {gap_percentage:.2f}%")
        
        total_gaps += missing_count
        
        # Find specific gaps
        if missing_count > 0:
            print(f"   🔍 Finding gaps...")
            cur.execute("""
                WITH sequences AS (
                    SELECT sequence_number, 
                           LAG(sequence_number) OVER (ORDER BY sequence_number) as prev_seq
                    FROM sensor_data 
                    WHERE machine_id = %s
                    ORDER BY sequence_number
                )
                SELECT sequence_number, prev_seq, (sequence_number - prev_seq - 1) as gap_size
                FROM sequences 
                WHERE sequence_number - prev_seq > 1
                ORDER BY sequence_number
            """, (machine_id,))
            
            gaps = cur.fetchall()
            for seq, prev_seq, gap_size in gaps:
                print(f"     Gap: {prev_seq+1} to {seq-1} ({gap_size} messages)")
    
    # Timing analysis
    print(f"\n⏱️  TIMING PRECISION ANALYSIS")
    print("-" * 60)
    
    cur.execute("""
        SELECT 
            machine_id,
            time,
            LAG(time) OVER (PARTITION BY machine_id ORDER BY sequence_number) as prev_time,
            sequence_number
        FROM sensor_data 
        ORDER BY machine_id, sequence_number
    """)
    
    timing_data = cur.fetchall()
    intervals = []
    
    for machine_id, time, prev_time, seq in timing_data:
        if prev_time:
            interval = (time - prev_time).total_seconds() * 1000  # Convert to ms
            intervals.append(interval)
    
    if intervals:
        avg_interval = sum(intervals) / len(intervals)
        perfect_100ms = sum(1 for i in intervals if 99 <= i <= 101)
        timing_precision = (perfect_100ms / len(intervals)) * 100
        
        print(f"📈 Average interval: {avg_interval:.2f}ms")
        print(f"🎯 Perfect 100ms intervals: {perfect_100ms}/{len(intervals)} ({timing_precision:.1f}%)")
        print(f"📊 Timing drift variance: {max(intervals) - min(intervals):.2f}ms")
    
    # Duplicate detection
    print(f"\n🔍 DUPLICATE DETECTION")
    print("-" * 60)
    
    cur.execute("""
        SELECT machine_id, sequence_number, COUNT(*) as duplicate_count
        FROM sensor_data
        GROUP BY machine_id, sequence_number
        HAVING COUNT(*) > 1
        ORDER BY machine_id, sequence_number
    """)
    
    duplicates = cur.fetchall()
    if duplicates:
        print(f"⚠️  Found {len(duplicates)} duplicate sequence numbers:")
        for machine_id, seq, count in duplicates:
            print(f"   Machine {machine_id}, seq {seq}: {count} copies")
    else:
        print("✅ No duplicates found - sequence numbers are unique!")
    
    # Data quality scoring
    print(f"\n🏆 OVERALL DATA QUALITY SCORE")
    print("-" * 60)
    
    expected_total = sum(max_seq - min_seq + 1 for _, min_seq, max_seq, _ in sequence_stats)
    data_completeness = ((expected_total - total_gaps) / expected_total) * 100 if expected_total > 0 else 0
    
    duplicate_penalty = len(duplicates) * 5  # 5% penalty per duplicate type
    timing_quality = timing_precision if intervals else 0
    
    overall_score = (data_completeness + timing_quality - duplicate_penalty) / 2
    overall_score = max(0, min(100, overall_score))  # Clamp to 0-100
    
    print(f"📊 Data completeness: {data_completeness:.1f}%")
    print(f"⏰ Timing precision: {timing_quality:.1f}%")
    print(f"🎯 Duplicate penalty: -{duplicate_penalty}%")
    print(f"🏆 OVERALL QUALITY SCORE: {overall_score:.1f}%")
    
    # Final verdict
    print(f"\n🎖️  MASTERFUL ENGINEERING VERDICT")
    print("-" * 60)
    
    if overall_score >= 95:
        print("🏆 EXCELLENT - Computer-precision data integrity achieved!")
    elif overall_score >= 90:
        print("🥈 VERY GOOD - High-quality data with minor gaps")
    elif overall_score >= 80:
        print("🥉 GOOD - Acceptable data quality with some issues")
    elif overall_score >= 70:
        print("⚠️  FAIR - Moderate data quality, improvements needed")
    else:
        print("❌ POOR - Significant data quality issues detected")
    
    print(f"Expected messages: {expected_total}")
    print(f"Missing messages: {total_gaps}")
    print(f"Success rate: {data_completeness:.1f}%")
    
    conn.close()

if __name__ == "__main__":
    analyze_database()