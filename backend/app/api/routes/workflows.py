from fastapi import APIRouter, HTTPException

from app.workflows.models import WorkflowSummary
from app.workflows.service import assistant_workflow

router = APIRouter()


@router.get("", response_model=list[WorkflowSummary])
async def list_workflows() -> list[WorkflowSummary]:
    return [assistant_workflow.summary]


@router.get("/{workflow_id}", response_model=WorkflowSummary)
async def get_workflow(workflow_id: str) -> WorkflowSummary:
    if workflow_id != assistant_workflow.summary.id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return assistant_workflow.summary
