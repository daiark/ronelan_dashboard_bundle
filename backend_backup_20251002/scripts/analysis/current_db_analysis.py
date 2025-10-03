#!/usr/bin/env python3

import psycopg2
import statistics
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

def current_database_analysis():
    """Analyze current database state"""
    conn = connect_to_db()
    if not conn:
        return
    
    cur = conn.cursor()
    
    try:
        print("=" * 80)
        print("🔬 CURRENT DATABASE ANALYSIS")
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
        
        # Calculate precise expected records based on actual sampling behavior
        # Get the actual average interval first to determine real sampling rate
        
        print(f"Time range: {earliest} to {latest}")
        print(f"Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        print(f"Expected records (10Hz): {expected_records:.0f}")
        print(f"Actual records: {total_records}")
        print(f"Data loss: {((expected_records - total_records) / expected_records * 100):.1f}%")
        print(f"Unique machines: {machine_count}")
        
        # 2. Timing Analysis
        print("\n⏱️  TIMING ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT 
                time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) * 1000 as interval_ms
            FROM sensor_data
            ORDER BY time
        """)
        
        timing_data = cur.fetchall()
        intervals = [float(row[1]) for row in timing_data if row[1] is not None]
        
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
            
            # Timing precision analysis
            perfect_intervals = [i for i in intervals if abs(i - 100.0) < 1.0]
            good_intervals = [i for i in intervals if abs(i - 100.0) < 5.0]
            
            print(f"Perfect intervals (±1ms): {len(perfect_intervals)}/{len(intervals)} ({len(perfect_intervals)/len(intervals)*100:.1f}%)")
            print(f"Good intervals (±5ms): {len(good_intervals)}/{len(intervals)} ({len(good_intervals)/len(intervals)*100:.1f}%)")
            
            # Timing drift
            drift = abs(avg_interval - 100.0) / 100.0 * 100
            print(f"Timing drift: {drift:.2f}%")
            
        # 3. Data Gaps Analysis
        print("\n🕳️  DATA GAPS ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT 
                time,
                LAG(time) OVER (ORDER BY time) as prev_time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds
            FROM sensor_data
            ORDER BY time
        """)
        
        gap_data = cur.fetchall()
        significant_gaps = [row for row in gap_data if row[2] and float(row[2]) > 1.0]
        
        if significant_gaps:
            print(f"Significant gaps (>1s): {len(significant_gaps)}")
            for gap in significant_gaps[:5]:
                print(f"  {gap[0]} | Gap: {gap[2]:.2f}s")
            
            # Calculate total gap time
            total_gap_time = sum(float(gap[2]) for gap in significant_gaps)
            print(f"Total gap time: {total_gap_time:.2f}s")
        else:
            print("No significant gaps detected")
        
        # 4. Duplicates Analysis
        print("\n🔄 DUPLICATES ANALYSIS")
        print("-" * 40)
        
        cur.execute("""
            SELECT time, machine_id, COUNT(*) as count
            FROM sensor_data 
            GROUP BY time, machine_id 
            HAVING COUNT(*) > 1
            ORDER BY time;
        """)
        
        duplicates = cur.fetchall()
        if duplicates:
            print(f"Duplicate timestamps: {len(duplicates)}")
            for dup in duplicates[:5]:
                print(f"  {dup[0]} | {dup[1]} | Count: {dup[2]}")
        else:
            print("No duplicate timestamps found")
        
        # 5. Data Quality Metrics
        print("\n📈 DATA QUALITY METRICS")
        print("-" * 40)
        
        # Recent performance (last 100 records)
        cur.execute("""
            SELECT 
                time,
                EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) * 1000 as interval_ms
            FROM (
                SELECT time FROM sensor_data ORDER BY time DESC LIMIT 100
            ) recent
            ORDER BY time
        """)
        
        recent_data = cur.fetchall()
        recent_intervals = [float(row[1]) for row in recent_data if row[1] is not None]
        
        if recent_intervals:
            recent_avg = sum(recent_intervals) / len(recent_intervals)
            recent_perfect = [i for i in recent_intervals if abs(i - 100.0) < 1.0]
            
            print(f"Recent timing (last 100 records):")
            print(f"  Average interval: {recent_avg:.2f}ms")
            print(f"  Perfect intervals: {len(recent_perfect)}/{len(recent_intervals)} ({len(recent_perfect)/len(recent_intervals)*100:.1f}%)")
        
        # 6. Overall Quality Score
        print("\n🏆 OVERALL QUALITY ASSESSMENT")
        print("-" * 40)
        
        score = 100.0
        issues = []
        
        # Data loss penalty
        if expected_records > 0:
            data_loss_pct = (expected_records - total_records) / expected_records * 100
            if data_loss_pct > 0:
                penalty = min(data_loss_pct * 0.5, 30)
                score -= penalty
                issues.append(f"Data loss: {data_loss_pct:.1f}% (-{penalty:.1f})")
        
        # Timing penalty
        if intervals:
            timing_penalty = min(drift * 0.5, 20)
            if timing_penalty > 2:
                score -= timing_penalty
                issues.append(f"Timing drift: {drift:.1f}% (-{timing_penalty:.1f})")
        
        # Gap penalty
        if significant_gaps:
            gap_penalty = min(len(significant_gaps) * 2, 15)
            score -= gap_penalty
            issues.append(f"Data gaps: {len(significant_gaps)} (-{gap_penalty:.1f})")
        
        # Duplicate penalty
        if duplicates:
            dup_penalty = min(len(duplicates) * 5, 10)
            score -= dup_penalty
            issues.append(f"Duplicates: {len(duplicates)} (-{dup_penalty:.1f})")
        
        score = max(0, score)
        
        print(f"Quality Score: {score:.1f}/100")
        if issues:
            print("Issues found:")
            for issue in issues:
                print(f"  - {issue}")
        
        # 7. Recommendations
        print("\n💡 RECOMMENDATIONS")
        print("-" * 40)
        
        if score >= 95:
            print("✅ Excellent data quality")
        elif score >= 85:
            print("✅ Good data quality - minor improvements possible")
        elif score >= 70:
            print("⚠️  Moderate data quality issues")
        else:
            print("❌ Poor data quality - needs attention")
        
        if expected_records > 0 and (expected_records - total_records) / expected_records > 0.05:
            print("• Consider implementing sequence numbers for gap detection")
        if duplicates:
            print("• Implement message deduplication")
        if significant_gaps:
            print("• Improve connection stability monitoring")
        if intervals and drift > 5:
            print("• Optimize sampling timing precision")
        
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    current_database_analysis()