FROM python:3.10-slim
WORKDIR /app

# Встановлюємо конкретні версії, щоб уникнути конфліктів passlib
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    sqlalchemy \
    psycopg2-binary \
    "passlib[bcrypt]" \
    bcrypt==4.0.1 \
    python-multipart \
    python-jose[cryptography]

COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
