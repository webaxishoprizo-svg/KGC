FROM python:3.11-slim

WORKDIR /code

COPY Backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY Backend /code

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
