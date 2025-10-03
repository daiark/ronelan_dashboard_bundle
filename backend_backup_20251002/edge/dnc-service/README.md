CNC DNC Service (FastAPI + HTMX)
- Bare-metal microservice for Heidenhain DNC operations via existing heidenhain_sender.py
- HTMX UI for file upload/edit and transfer control
- Publishes progress to NATS JetStream (DNC_PROGRESS.<machine_id>) for backend ingestion

Run locally (dev):
  uvicorn dnc_service.main:app --host 0.0.0.0 --port 8083

Configure via environment:
- DNC_PROGRAM_DIR (default /var/lib/cnc-dnc/programs)
- NATS_URL (default nats://localhost:4222)
- NATS_STREAM (default DNC_PROGRESS)
- MACHINE_ID (default CNC-PI-001)
- HEIDENHAIN_SENDER (path to heidenhain_sender.py on the Pi)
- LOG_LEVEL (info)

