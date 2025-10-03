#!/usr/bin/env python3

import psycopg2
import statistics
from datetime import datetime, timedelta
from decimal import Decimal, getcontext

# Set high precision for calculations
getcontext().prec = 50

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

def precise_database_analysis():
    """Carmack/Hotz/Keller level precision analysis"""
    conn = connect_to_db()
    if not conn:
        return
    
    cur = conn.cursor()
    
    try:
        print("=" * 80)
        print("🔬 PRECISION DATABASE ANALYSIS")
        print("=" * 80)
        
        # First, get basic record count and time range
        cur.execute("SELECT COUNT(*) FROM sensor_data;")
        total_records = cur.fetchone()[0]
        
        cur.execute("""
            SELECT 
                MIN(time) as earliest,
                MAX(time) as latest
            FROM sensor_data;
        """)
        result = cur.fetchone()
        earliest, latest = result
        
        # Calculate precise duration in seconds with microsecond precision
        duration_seconds = (latest - earliest).total_seconds()
        print(f"📊 PRECISE TIMING ANALYSIS")
        print("-" * 40)
        print(f"Start time: {earliest}")
        print(f"End time: {latest}")
        print(f"Duration: {duration_seconds:.6f} seconds")
        print(f"Total records: {total_records}")
        
        # Now get ALL interval data to understand actual sampling behavior
        cur.execute("""
            SELECT 
                time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as interval_seconds
            FROM sensor_data
            ORDER BY time
        """)
        
        timing_data = cur.fetchall()
        intervals_sec = [float(row[1]) for row in timing_data if row[1] is not None]
        intervals_ms = [i * 1000 for i in intervals_sec]
        
        print(f"\n⏱️  INTERVAL ANALYSIS")
        print("-" * 40)
        print(f"Total intervals: {len(intervals_sec)}")
        
        if intervals_sec:
            avg_interval_sec = sum(intervals_sec) / len(intervals_sec)
            avg_interval_ms = avg_interval_sec * 1000
            median_interval_ms = statistics.median(intervals_ms)
            min_interval_ms = min(intervals_ms)
            max_interval_ms = max(intervals_ms)
            
            print(f"Average interval: {avg_interval_ms:.3f}ms ({avg_interval_sec:.6f}s)")
            print(f"Median interval: {median_interval_ms:.3f}ms")
            print(f"Min interval: {min_interval_ms:.3f}ms")
            print(f"Max interval: {max_interval_ms:.3f}ms")
            
            # Calculate ACTUAL sampling rate from data
            actual_hz = 1.0 / avg_interval_sec
            print(f"Actual sampling rate: {actual_hz:.6f} Hz")
            
            # Calculate what we SHOULD have based on actual sampling rate
            expected_records_actual = duration_seconds * actual_hz
            print(f"Expected records (actual rate): {expected_records_actual:.1f}")
            
            # Calculate what we SHOULD have based on target 10Hz
            expected_records_target = duration_seconds * 10.0
            print(f"Expected records (target 10Hz): {expected_records_target:.1f}")
            
            # Data loss calculations
            actual_loss = (expected_records_actual - total_records) / expected_records_actual * 100
            target_loss = (expected_records_target - total_records) / expected_records_target * 100
            
            print(f"\n📉 DATA LOSS ANALYSIS")
            print("-" * 40)
            print(f"Based on actual sampling rate: {actual_loss:.2f}%")
            print(f"Based on target 10Hz: {target_loss:.2f}%")
            
            # Timing precision analysis
            print(f"\n🎯 TIMING PRECISION")
            print("-" * 40)
            target_interval_ms = 100.0
            
            # Perfect timing (±0.5ms)
            perfect_intervals = [i for i in intervals_ms if abs(i - target_interval_ms) < 0.5]
            # Good timing (±1ms)
            good_intervals = [i for i in intervals_ms if abs(i - target_interval_ms) < 1.0]
            # Acceptable timing (±5ms)
            acceptable_intervals = [i for i in intervals_ms if abs(i - target_interval_ms) < 5.0]
            
            print(f"Perfect timing (±0.5ms): {len(perfect_intervals)}/{len(intervals_ms)} ({len(perfect_intervals)/len(intervals_ms)*100:.1f}%)")
            print(f"Good timing (±1.0ms): {len(good_intervals)}/{len(intervals_ms)} ({len(good_intervals)/len(intervals_ms)*100:.1f}%)")
            print(f"Acceptable timing (±5.0ms): {len(acceptable_intervals)}/{len(intervals_ms)} ({len(acceptable_intervals)/len(intervals_ms)*100:.1f}%)")
            
            # Timing drift analysis
            drift_pct = (avg_interval_ms - target_interval_ms) / target_interval_ms * 100
            print(f"Timing drift: {drift_pct:.3f}%")
            
            # Standard deviation of intervals
            if len(intervals_ms) > 1:
                std_dev = statistics.stdev(intervals_ms)
                print(f"Timing jitter (std dev): {std_dev:.3f}ms")
            
            # Find outliers (>1 second gaps)
            outliers = [i for i in intervals_ms if i > 1000.0]
            if outliers:
                print(f"\n🕳️  OUTLIERS (>1s gaps): {len(outliers)}")
                for outlier in outliers:
                    print(f"  Gap: {outlier:.0f}ms ({outlier/1000:.2f}s)")
                
                # Calculate time lost to gaps
                total_gap_time = sum(outliers) / 1000.0  # Convert to seconds
                gap_loss_pct = total_gap_time / duration_seconds * 100
                print(f"Time lost to gaps: {total_gap_time:.2f}s ({gap_loss_pct:.2f}%)")
            
        # Check for duplicates
        print(f"\n🔄 DUPLICATE ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT time, machine_id, COUNT(*) as count
            FROM sensor_data 
            GROUP BY time, machine_id 
            HAVING COUNT(*) > 1
            ORDER BY time;
        """)
        
        duplicates = cur.fetchall()
        print(f"Duplicate timestamps: {len(duplicates)}")
        if duplicates:
            for dup in duplicates:
                print(f"  {dup[0]} | {dup[1]} | Count: {dup[2]}")
        
        # Final assessment
        print(f"\n🏆 CARMACK/HOTZ/KELLER ASSESSMENT")
        print("-" * 40)
        
        if intervals_sec:
            print(f"🔍 MATHEMATICAL TRUTH:")
            print(f"  • Duration: {duration_seconds:.6f}s")
            print(f"  • Records: {total_records}")
            print(f"  • Actual rate: {actual_hz:.6f} Hz")
            print(f"  • Target rate: 10.000000 Hz")
            print(f"  • Rate deviation: {(actual_hz - 10.0)/10.0 * 100:.3f}%")
            
            if abs(actual_loss) < 1.0:
                print(f"✅ VERDICT: Near-perfect data integrity ({actual_loss:.2f}% loss)")
            elif abs(actual_loss) < 5.0:
                print(f"⚠️  VERDICT: Good data integrity ({actual_loss:.2f}% loss)")
            else:
                print(f"❌ VERDICT: Data integrity issues ({actual_loss:.2f}% loss)")
                
            if len(perfect_intervals) / len(intervals_ms) > 0.99:
                print(f"✅ TIMING: Excellent precision")
            elif len(good_intervals) / len(intervals_ms) > 0.95:
                print(f"⚠️  TIMING: Good precision")
            else:
                print(f"❌ TIMING: Precision issues")
        
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    precise_database_analysis()