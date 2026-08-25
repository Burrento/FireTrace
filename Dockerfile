# Place this file at the repo root: FireTrace BackEnd/Dockerfile
# (same folder as Pipfile, Pipfile.lock, and the FireTrace/ project folder)

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Kept as a safety net: Python 3.14 is very new, so a handful of transitive
# dependencies may not yet publish prebuilt wheels for it and could need to
# compile from source. Cheap to include, saves a confusing build failure.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install pipenv

# Copy only the Pipfiles first so Docker can cache this layer and skip
# reinstalling everything when only your app code changes.
COPY Pipfile Pipfile.lock ./
RUN pipenv install --system --deploy --ignore-pipfile

# Now copy the actual Django project (the inner "FireTrace" folder that
# contains manage.py, accounts/, incidents/, realtime/, analytics/, etc.)
COPY FireTrace/ ./FireTrace/

WORKDIR /app/FireTrace

# Collect static files (admin CSS, DRF browsable API assets) into STATIC_ROOT.
# Safe to fail here if you haven't added STATIC_ROOT yet — see settings_patch.md.
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Note the capitalized "FireTrace.asgi" — matches ASGI_APPLICATION in your
# actual settings.py exactly (case-sensitive).
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "FireTrace.asgi:application"]
