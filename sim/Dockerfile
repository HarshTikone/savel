# Build context: repo root.  docker build -f sim/Dockerfile .
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY sim/requirements.txt sim/requirements.txt
RUN pip install --no-cache-dir -r sim/requirements.txt
COPY sim sim
EXPOSE 8001
CMD ["python", "sim/simulator.py"]
