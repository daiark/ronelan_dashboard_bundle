# Analysis Scripts

This directory contains database analysis and system diagnostic scripts.

## 📁 Contents

### Database Analysis Scripts
- `check_db.py` - Database connectivity and basic health checks
- `comprehensive_analysis.py` - Comprehensive database analysis with statistics
- `current_db_analysis.py` - Current state analysis of the database
- `detailed_analysis.py` - Detailed database schema and data analysis
- `precise_analysis.py` - Precise analysis with specific query patterns
- `ultimate_analysis.py` - Ultimate comprehensive analysis script (moved from LLM_SCRIPTS)

## 🚀 Usage

These scripts are primarily for development and debugging purposes. They help analyze:

- Database schema and structure
- Data integrity and consistency
- Performance metrics
- Connection health
- Query patterns and optimization opportunities

### Running Analysis Scripts

```bash
# Basic database connectivity check
python scripts/analysis/check_db.py

# Comprehensive analysis
python scripts/analysis/comprehensive_analysis.py

# Current state analysis
python scripts/analysis/current_db_analysis.py
```

## 📋 Requirements

Most scripts require:
- Python 3.x
- Database connection libraries (psycopg2, etc.)
- Access to the TimescaleDB instance
- Proper environment variables or configuration

## ⚠️ Note

These are development/diagnostic tools and should be used with caution in production environments. Always test scripts in a development environment first.
