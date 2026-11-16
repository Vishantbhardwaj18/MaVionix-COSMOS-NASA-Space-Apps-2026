FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
<<<<<<< HEAD
RUN useradd --create-home --uid 10001 cosmos && mkdir -p /cache && chown cosmos /cache
USER cosmos
ENV COSMOS_CACHE_DIR=/cache PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import os,urllib.request;urllib.request.urlopen('http://localhost:%s/api/health' % os.environ.get('PORT','8000'))"
# PORT is honoured so the same image runs on Render, Railway, Fly and Cloud Run.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*'"]
=======
ENV COSMOS_CACHE_DIR=/cache
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
