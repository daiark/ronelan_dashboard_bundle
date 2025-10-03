# Offline Buffer Duplication Issue - Troubleshooting & Fix

**Date:** 2025-07-15  
**Issue:** Massive data duplication (37%) during offline buffer sync  
**Status:** ✅ RESOLVED

## Problem Summary

The offline buffer was causing severe data duplication by replaying ALL session data instead of only the outage period. This resulted in 37% duplicate records in the database during sync operations.

## Root Cause Analysis

### Initial Misdiagnosis
- **Wrong assumption:** Thought duplicates were from sync handoff race conditions
- **Missed the real issue:** Sync was replaying entire session history, not just outage data
- **False conclusion:** Called 37% duplication "acceptable" and "aeronautic grade" (embarrassing!)

### Actual Root Cause
Located in `edge/agent/internal/buffering/offline_buffer.go` in the `Write()` method:

```go
// WRONG - Always writes to file regardless of NATS success
func (b *OfflineBuffer) Write(data SensorData) error {
    // Always write to local file first (persistence guarantee)
    if err := b.writeToFile(jsonBytes); err != nil {
        return err
    }
    // Then attempt NATS transmission
    if b.online.Load() {
        if err := b.sendToNATS(jsonBytes); err != nil {
            // NATS failed, but data already in file
        }
    }
}
```

This caused:
1. **ALL messages** written to file regardless of NATS success
2. **Sync replayed everything** from session start
3. **Database received duplicates** from both real-time + sync

## Database Schema Notes

### Important Field Names
- **Primary timestamp field:** `time` (NOT `timestamp`)
- **Table structure:** TimescaleDB hypertable with proper timezone handling
- **No built-in deduplication:** Database accepts identical records

### Key SQL Commands for Analysis
```sql
-- Check duplicates
SELECT COUNT(*) as duplicates FROM (
    SELECT time, COUNT(*) FROM sensor_data 
    GROUP BY time HAVING COUNT(*) > 1
) as dups;

-- Analyze timing gaps
WITH time_gaps AS (
    SELECT time, 
           LAG(time) OVER (ORDER BY time) as prev_time,
           EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds 
    FROM sensor_data
) 
SELECT MAX(gap_seconds) as max_gap, 
       COUNT(*) FILTER (WHERE gap_seconds > 1) as outages 
FROM time_gaps WHERE prev_time IS NOT NULL;

-- Check specific time ranges
SELECT COUNT(*) FROM sensor_data 
WHERE time BETWEEN 'start_time' AND 'end_time';
```

## Fix Implementation

### Code Change
Modified `Write()` method in `offline_buffer.go`:

```go
// CORRECT - Only write to file if NATS fails or offline
func (b *OfflineBuffer) Write(data SensorData) error {
    jsonBytes, err := json.Marshal(data)
    if err != nil {
        return fmt.Errorf("failed to marshal data: %w", err)
    }

    // Attempt real-time transmission if online
    if b.online.Load() {
        if err := b.sendToNATS(jsonBytes); err != nil {
            // Only write to file if NATS fails
            if writeErr := b.writeToFile(jsonBytes); writeErr != nil {
                return writeErr
            }
            b.setOffline()
        }
        // If NATS succeeds, don't write to file (no duplication)
    } else {
        // If offline, write to file only
        if err := b.writeToFile(jsonBytes); err != nil {
            return err
        }
    }
    return nil
}
```

### Key Changes
1. **Try NATS first** when online
2. **Only write to file if NATS fails** or if offline
3. **No file writes for successful real-time transmissions**
4. **Sync only replays genuinely failed/offline data**

## Testing Methodology

### Fresh Database Script
Created `fresh_db_test.sh` for clean testing:
- Backs up existing data automatically
- Resets both database and NATS stream
- Ensures sequence numbers start from 1
- Maintains docker-compose compatibility

### Test Results Comparison

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| **Duplicates** | 228/612 (37%) | 0/132 (0%) |
| **Synced Messages** | 250+ (entire session) | 44 (outage only) |
| **Data Integrity** | ✅ No loss | ✅ No loss |
| **Sequence Gaps** | 1 (outage) | 1 (outage) |

## Critical Debugging Commands

### Backend Log Analysis
```bash
# Check if backend receives duplicate messages
docker logs monitor_app | grep "DEBUG: Received message" | head -10

# Count processed messages
docker logs monitor_app --tail 50 | grep -E "(Successfully processed|DEBUG: Received)" | wc -l
```

### Database Verification
```bash
# Check for identical data (not just timing)
docker exec timescale_db psql -U user -d cnc_monitor -c \
"SELECT time, temperature, x_pos_mm FROM sensor_data 
 WHERE time = 'specific_timestamp' ORDER BY temperature;"

# Verify sequence continuity
docker exec timescale_db psql -U user -d cnc_monitor -c \
"WITH expected_data AS (SELECT generate_series(1, X) as seq_num) 
 SELECT COUNT(*) as missing_sequences FROM expected_data e 
 LEFT JOIN (SELECT ROW_NUMBER() OVER (ORDER BY time) as row_num FROM sensor_data) s 
 ON e.seq_num = s.row_num WHERE s.row_num IS NULL;"
```

## Common Pitfalls for Future Reference

### Analysis Mistakes
1. **Don't assume race conditions** - check the actual data flow first
2. **Verify backend logs show duplicate messages** vs database inserting same message twice
3. **Check timing vs data identity** - identical timestamps + data = replay issue
4. **Never call high duplication rates "acceptable"** without investigating

### Database Schema Awareness
1. **Use `time` field** for timestamps, not `timestamp`
2. **TimescaleDB uses hypertables** - normal PostgreSQL commands work
3. **No automatic deduplication** - identical records will be inserted
4. **Timezone handling** - timestamps include timezone info

### Testing Best Practices
1. **Always use fresh database** for clean tests
2. **Reset NATS stream** to start sequences from 1
3. **Analyze both logs and database** - don't rely on one source
4. **Check specific time ranges** during outage periods
5. **Verify sync message counts** match log outputs

## Performance Impact

### Before Fix
- **Storage overhead:** 37% wasted space
- **Processing overhead:** Unnecessary duplicate handling
- **Query performance:** Degraded due to duplicate data
- **Data integrity concerns:** Unclear which records are authoritative

### After Fix
- **Zero duplication:** Clean data set
- **Optimal storage:** No wasted space
- **Improved performance:** No duplicate processing
- **Production ready:** True enterprise-grade reliability

## Lessons Learned

1. **Thorough root cause analysis** prevents incorrect fixes
2. **Database field naming** matters for queries (`time` vs `timestamp`)
3. **Always verify assumptions** with actual data examination
4. **Never settle for "acceptable" when 0% is achievable**
5. **Fresh test environments** are crucial for accurate results

## Future Monitoring

### Key Metrics to Track
```sql
-- Daily duplication check
SELECT DATE(time) as date, 
       COUNT(*) as total, 
       COUNT(DISTINCT time) as unique,
       ROUND(100.0 * (COUNT(*) - COUNT(DISTINCT time)) / COUNT(*), 2) as duplication_pct
FROM sensor_data 
GROUP BY DATE(time) 
ORDER BY date DESC;

-- Outage detection
WITH gaps AS (
    SELECT time, 
           EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds
    FROM sensor_data
)
SELECT COUNT(*) as outages, MAX(gap_seconds) as longest_outage_sec
FROM gaps WHERE gap_seconds > 1;
```

## Related Files Modified
- `edge/agent/internal/buffering/offline_buffer.go` - Core fix
- `fresh_db_test.sh` - Testing utility (NEW)

## Next Steps
- Monitor production for any edge cases
- Consider adding database-level unique constraints on (machine_id, time)
- Implement automated duplication monitoring alerts