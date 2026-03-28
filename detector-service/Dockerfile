FROM docker:27-cli AS dockercli

FROM python:3.10-slim

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

COPY detector-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml ./ml
COPY detector-service/main.py detector-service/ml_detect.py ./

ENV PYTHONPATH=/app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
