# Build context: repo root.  docker build -f api/Dockerfile .
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api api
COPY sim/homes.json sim/homes.json
EXPOSE 8000
# Seed homes (idempotent upsert; real phones from DEMO_PHONE_HOMES), then ONE uvicorn worker.
CMD ["sh", "-c", "python -m api.seed_homes || echo 'seed failed, continuing'; exec uvicorn api.main:app --host 0.0.0.0 --port 8000"]
