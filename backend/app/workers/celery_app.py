from celery import Celery
from ..core.config import settings

celery = Celery("transcript_ai", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery.conf.task_track_started = True
celery.autodiscover_tasks(["app.workers"])
from . import tasks  # noqa
