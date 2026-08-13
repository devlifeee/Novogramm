FROM python:3.12-slim-bookworm

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY ./backend /usr/src/app
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /usr/src/app
USER appuser
EXPOSE 3000
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:3000", "--workers", "2", "--threads", "4", "--timeout", "30", "--access-logfile", "-"]
