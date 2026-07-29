from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from urllib.request import Request, urlopen

from airflow import DAG
from airflow.models.param import Param
from airflow.operators.python import PythonOperator, get_current_context


START_DATE = datetime(2026, 7, 29)
RUN_TIMEOUT = timedelta(hours=4)
DEFAULT_ARGS = {
    "owner": "decision-workspace",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": RUN_TIMEOUT,
}


def call_workspace(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    base_url = os.environ["DECISION_WORKSPACE_BASE_URL"].rstrip("/")
    secret = os.environ["DECISION_WORKSPACE_CRON_SECRET"]
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{base_url}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=330) as response:
        return json.loads(response.read().decode("utf-8"))


def trigger_daily() -> dict:
    return call_workspace("/api/cron/connectors/daily")


def trigger_weekly() -> dict:
    return call_workspace("/api/cron/connectors/weekly")


def trigger_backfill() -> dict:
    params = get_current_context()["params"]
    return call_workspace(
        "/api/cron/connectors/backfill",
        method="POST",
        payload={"platform": params["platform"], "months": params["months"]},
    )


def trigger_tiktok_digest() -> dict:
    return call_workspace("/api/cron/tiktok-digest")


def trigger_budget_models() -> dict:
    return call_workspace("/api/cron/budget-models/daily")


def trigger_budget_alerts() -> dict:
    return call_workspace("/api/cron/budget-alerts/daily")


def trigger_budget_resume() -> dict:
    return call_workspace("/api/cron/budget-actions/resume")


with DAG(
    dag_id="decision_workspace_daily_connectors",
    schedule="15 1 * * *",
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=RUN_TIMEOUT,
    default_args=DEFAULT_ARGS,
    tags=["decision-workspace", "etl", "incremental"],
) as daily_connectors:
    PythonOperator(task_id="incremental_sync", python_callable=trigger_daily)


with DAG(
    dag_id="decision_workspace_weekly_connectors",
    schedule="45 1 * * 0",
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=RUN_TIMEOUT,
    default_args=DEFAULT_ARGS,
    tags=["decision-workspace", "etl", "full-refresh"],
) as weekly_connectors:
    PythonOperator(task_id="full_sync", python_callable=trigger_weekly)


with DAG(
    dag_id="decision_workspace_connector_backfill",
    schedule=None,
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=RUN_TIMEOUT,
    default_args=DEFAULT_ARGS,
    params={
        "platform": Param(
            "google_ads",
            type="string",
            enum=["google_ads", "youtube", "linkedin"],
        ),
        "months": Param(13, type="integer", minimum=1, maximum=13),
    },
    tags=["decision-workspace", "etl", "backfill"],
) as connector_backfill:
    PythonOperator(task_id="run_backfill", python_callable=trigger_backfill)


with DAG(
    dag_id="decision_workspace_daily_operations",
    schedule="0 1 * * *",
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=RUN_TIMEOUT,
    default_args=DEFAULT_ARGS,
    tags=["decision-workspace", "digest", "budget"],
) as daily_operations:
    digest = PythonOperator(
        task_id="tiktok_watchlist_digest",
        python_callable=trigger_tiktok_digest,
    )
    models = PythonOperator(
        task_id="refresh_budget_models",
        python_callable=trigger_budget_models,
    )
    alerts = PythonOperator(
        task_id="deliver_budget_alerts",
        python_callable=trigger_budget_alerts,
    )
    digest >> models >> alerts


with DAG(
    dag_id="decision_workspace_budget_action_resume",
    schedule="*/15 * * * *",
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=timedelta(minutes=14),
    default_args=DEFAULT_ARGS,
    tags=["decision-workspace", "budget", "learning-phase"],
) as budget_action_resume:
    PythonOperator(
        task_id="resume_learning_exit_actions",
        python_callable=trigger_budget_resume,
        execution_timeout=timedelta(minutes=10),
    )
