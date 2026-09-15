# Local code-sandbox image with common scientific packages pre-installed.
#
# The backend never pulls or builds images at runtime — build this image once
# on the host, then point SANDBOX_PYTHON_IMAGE at it in backend/.env:
#
#   docker build -t workbench-sandbox:py312 docker/sandbox
#   SANDBOX_PYTHON_IMAGE=workbench-sandbox:py312
#
# The agent runs code in a container with no network egress; every dependency
# the code may import must already exist in this image.

FROM python:3.12-slim

RUN python -m pip install --no-cache-dir \
    "numpy" \
    "pandas" \
    "openpyxl" \
    "pytest" \
  && rm -rf /root/.cache/pip

WORKDIR /sandbox
CMD ["python", "main.py"]
