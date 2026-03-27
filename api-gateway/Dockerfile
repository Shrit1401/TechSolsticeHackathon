# Python 3.10 runtime for the gateway.
FROM python:3.10

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

# Listen on all interfaces so Docker port mapping works.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
