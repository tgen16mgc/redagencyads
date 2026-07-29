# Decision Workspace Airflow Deployment

Place `dags/decision_workspace_connectors.py` in the Airflow DAG directory and
configure these environment variables on every scheduler and worker:

```bash
DECISION_WORKSPACE_BASE_URL=https://workspace.example.com
DECISION_WORKSPACE_CRON_SECRET=<same value as the app CRON_SECRET>
```

The DAG file provides:

- daily incremental connector sync;
- weekly full connector refresh;
- operator-triggered one-to-thirteen-month backfills;
- the 08:00 Asia/Ho_Chi_Minh TikTok digest and daily budget operations;
- fifteen-minute learning-phase budget action resume checks.

The application deployment must set
`DECISION_WORKSPACE_SCHEDULER=airflow`, mount an absolute persistent data
directory, and expose the cron routes only through `CRON_SECRET`.
