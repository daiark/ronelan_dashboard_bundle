#!/usr/bin/env python3

import psycopg2
import json
from datetime import datetime, timedelta
import statistics

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

def comprehensive_database_analysis():
    """Perform comprehensive database analysis"""
    conn = connect_to_db()
    if not conn:
        return
    
    cur = conn.cursor()
    
    try:
        print("=" * 80)
        print("🔬 COMPREHENSIVE DATABASE ANALYSIS")
        print("=" * 80)
        
        # 1. Basic Statistics
        print("\n📊 BASIC STATISTICS")
        print("-" * 40)
        
        cur.execute("SELECT COUNT(*) FROM sensor_data;")
        total_records = cur.fetchone()[0]
        print(f"Total records: {total_records}")
        
        cur.execute("""
            SELECT 
                MIN(time) as earliest,
                MAX(time) as latest,
                COUNT(DISTINCT machine_id) as machine_count
            FROM sensor_data;
        """)
        result = cur.fetchone()
        earliest, latest, machine_count = result
        duration = (latest - earliest).total_seconds()
        print(f"Time range: {earliest} to {latest}")
        print(f"Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        print(f"Unique machines: {machine_count}")
        
        # 2. Sequence Number Analysis
        print("\n🔢 SEQUENCE NUMBER ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT 
                MIN(sequence_number) as min_seq,
                MAX(sequence_number) as max_seq,
                COUNT(DISTINCT sequence_number) as unique_sequences
            FROM sensor_data;
        """)
        result = cur.fetchone()
        min_seq, max_seq, unique_sequences = result
        expected_sequences = max_seq - min_seq + 1
        missing_sequences = expected_sequences - unique_sequences
        
        print(f"Sequence range: {min_seq} to {max_seq}")
        print(f"Expected sequences: {expected_sequences}")
        print(f"Actual unique sequences: {unique_sequences}")
        print(f"Missing sequences: {missing_sequences}")
        
        if missing_sequences > 0:
            data_loss_percent = (missing_sequences / expected_sequences) * 100
            print(f"Data loss: {data_loss_percent:.1f}%")
        else:
            print("Data loss: 0.0%")
        
        # 3. Sequence Gaps Detection
        print("\n🕳️  SEQUENCE GAPS DETECTION")
        print("-" * 40)
        
        cur.execute("""
            WITH sequence_gaps AS (
                SELECT 
                    sequence_number,
                    sequence_number - LAG(sequence_number) OVER (ORDER BY sequence_number) as gap
                FROM sensor_data
                ORDER BY sequence_number
            )
            SELECT sequence_number, gap
            FROM sequence_gaps
            WHERE gap > 1
            ORDER BY sequence_number;
        """)
        
        gaps = cur.fetchall()
        if gaps:
            print(f"Found {len(gaps)} sequence gaps:")
            for gap in gaps[:10]:  # Show first 10 gaps
                print(f"  Gap at sequence {gap[0]}: missing {gap[1]-1} sequences")
        else:
            print("No sequence gaps detected")
        
        # 4. Timing Analysis
        print("\n⏱️  TIMING ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT 
                time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) * 1000 as interval_ms
            FROM sensor_data
            ORDER BY time
            LIMIT 1000;
        """)
        
        timing_data = cur.fetchall()
        intervals = [row[1] for row in timing_data if row[1] is not None]
        
        if intervals:
            avg_interval = sum(intervals) / len(intervals)
            median_interval = statistics.median(intervals)
            min_interval = min(intervals)
            max_interval = max(intervals)
            
            print(f"Sample size: {len(intervals)} intervals")
            print(f"Average interval: {avg_interval:.2f}ms")
            print(f"Median interval: {median_interval:.2f}ms")
            print(f"Min interval: {min_interval:.2f}ms")
            print(f"Max interval: {max_interval:.2f}ms")
            print(f"Target interval: 100.0ms")
            print(f"Timing precision: {100 - abs(avg_interval - 100.0):.1f}%")
            
            # Check for perfect 100ms intervals
            perfect_intervals = [i for i in intervals if abs(i - 100.0) < 1.0]
            print(f"Perfect intervals (±1ms): {len(perfect_intervals)}/{len(intervals)} ({len(perfect_intervals)/len(intervals)*100:.1f}%)")
        
        # 5. Duplicates Analysis
        print("\n🔄 DUPLICATES ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT COUNT(*) as duplicate_count
            FROM (
                SELECT time, machine_id, COUNT(*) as count
                FROM sensor_data 
                GROUP BY time, machine_id 
                HAVING COUNT(*) > 1
            ) as duplicates;
        """)
        duplicate_count = cur.fetchone()[0]
        print(f"Duplicate timestamps: {duplicate_count}")
        
        # Check for sequence number duplicates
        cur.execute("""
            SELECT COUNT(*) as seq_duplicate_count
            FROM (
                SELECT sequence_number, COUNT(*) as count
                FROM sensor_data 
                GROUP BY sequence_number
                HAVING COUNT(*) > 1
            ) as seq_duplicates;
        """)
        seq_duplicate_count = cur.fetchone()[0]
        print(f"Duplicate sequence numbers: {seq_duplicate_count}")
        
        # 6. Data Quality Score
        print("\n🏆 DATA QUALITY SCORE")
        print("-" * 40)
        
        quality_score = 100.0
        
        # Deduct for data loss
        if missing_sequences > 0:
            data_loss_penalty = (missing_sequences / expected_sequences) * 50
            quality_score -= data_loss_penalty
            print(f"Data loss penalty: -{data_loss_penalty:.1f}")
        
        # Deduct for timing issues
        if intervals and avg_interval:
            timing_drift = abs(avg_interval - 100.0) / 100.0 * 100
            if timing_drift > 5:
                timing_penalty = min(timing_drift, 20)
                quality_score -= timing_penalty
                print(f"Timing drift penalty: -{timing_penalty:.1f}")
        
        # Deduct for duplicates
        if duplicate_count > 0:
            duplicate_penalty = min(duplicate_count * 5, 15)
            quality_score -= duplicate_penalty
            print(f"Duplicate penalty: -{duplicate_penalty:.1f}")
        
        # Deduct for sequence gaps
        if gaps:
            gap_penalty = min(len(gaps) * 2, 10)
            quality_score -= gap_penalty
            print(f"Gap penalty: -{gap_penalty:.1f}")
        
        quality_score = max(0, quality_score)
        print(f"\nOverall Quality Score: {quality_score:.1f}/100")
        
        # 7. Recent Performance
        print("\n📈 RECENT PERFORMANCE (Last 1000 records)")
        print("-" * 40)
        
        cur.execute("""
            SELECT 
                COUNT(*) as record_count,
                MIN(sequence_number) as min_seq,
                MAX(sequence_number) as max_seq,
                MIN(time) as earliest,
                MAX(time) as latest
            FROM (
                SELECT * FROM sensor_data 
                ORDER BY time DESC 
                LIMIT 1000
            ) as recent;
        """)
        
        result = cur.fetchone()
        recent_count, recent_min_seq, recent_max_seq, recent_earliest, recent_latest = result
        recent_duration = (recent_latest - recent_earliest).total_seconds()
        recent_rate = recent_count / recent_duration if recent_duration > 0 else 0
        
        print(f"Recent records: {recent_count}")
        print(f"Recent sequence range: {recent_min_seq} to {recent_max_seq}")
        print(f"Recent duration: {recent_duration:.2f} seconds")
        print(f"Recent data rate: {recent_rate:.2f} records/sec")
        print(f"Target rate: 10.0 records/sec")
        
        # 8. Recommendations
        print("\n💡 RECOMMENDATIONS")
        print("-" * 40)
        
        if quality_score >= 95:
            print("✅ Excellent data quality - system operating optimally")
        elif quality_score >= 85:
            print("✅ Good data quality - minor improvements possible")
        elif quality_score >= 70:
            print("⚠️  Moderate data quality - attention recommended")
        else:
            print("❌ Poor data quality - immediate attention required")
        
        if missing_sequences > 0:
            print("- Review edge agent connectivity and buffering")
        if duplicate_count > 0:
            print("- Check message deduplication logic")
        if gaps:
            print("- Investigate sequence gap causes")
        if intervals and abs(avg_interval - 100.0) > 5:
            print("- Optimize sampling loop timing precision")
        
        print("\n" + "=" * 80)
        print("Analysis complete.")
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    comprehensive_database_analysis()