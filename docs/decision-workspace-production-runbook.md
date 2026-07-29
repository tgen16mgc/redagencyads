# Decision Workspace Production Runbook

## 1. Deploy Persistent Application Storage

Create `.env.production` from `.env.example`, set the production credentials,
then deploy the included container:

```bash
docker compose up --build -d
```

The compose deployment mounts `/var/lib/decision-workspace` and sets:

```bash
DECISION_WORKSPACE_ENVIRONMENT=production
DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT=production
DECISION_WORKSPACE_PERSISTENCE_MODE=persistent_volume
DECISION_WORKSPACE_DATA_DIR=/var/lib/decision-workspace
```

Set `DECISION_WORKSPACE_SCHEDULER=airflow` in `.env.production` when using the
included DAG. Do not declare `database` or `object_storage` until an adapter is
actually installed; readiness intentionally rejects those declarations.

## 2. Operate Airflow

Install `orchestration/airflow/dags/decision_workspace_connectors.py` in the
production Airflow environment and configure:

```bash
DECISION_WORKSPACE_BASE_URL=https://workspace.example.com
DECISION_WORKSPACE_CRON_SECRET=<same value as app CRON_SECRET>
```

Confirm the daily incremental, weekly full, daily operations, and fifteen-minute
budget-resume DAGs are enabled. Trigger one incremental and one full connector
run before release; both must finish in less than four hours.

## 3. Generate Automatic Evidence

These successful production operations persist their own traceable evidence:

| Gate | Operation |
| --- | --- |
| T2.2.3 | Run GA4 attribution against a property using data-driven attribution. |
| T3.1.5 | Load creative clusters with a provider-backed embedding response. |
| T3.3.2 | Run provider-backed creative element inference. |
| T3.3.4 | Run provider-backed raw-audio classification. |
| T4.1.2 | Deliver an interactive or scheduled pacing alert. |

Connector job history, LinkedIn rows, TikTok certification, and audited Meta or
Google write actions are evaluated directly by `GET /api/readiness`.

## 4. Record Traceable Operator Evidence

For external proof that cannot be derived directly from application state, set
the same operator token locally and submit a production run ID or evidence URL:

```bash
DECISION_WORKSPACE_URL=https://workspace.example.com \
DECISION_WORKSPACE_ACCEPTANCE_TOKEN=<operator token> \
npm run record:decision-workspace-evidence -- \
  --requirement T2.1.2 \
  --summary "Airflow incremental and full refresh completed inside the four-hour SLA" \
  --run-id airflow-production-run-123
```

Use `--failed` when recording contrary evidence. Local and non-production
certification never passes a gate.

## 5. Release Gate

Run the strict verifier against the deployed origin:

```bash
DECISION_WORKSPACE_URL=https://workspace.example.com \
npm run verify:decision-workspace -- --require-complete
```

Release only when it exits zero and reports `20/20 external gates passed`.
