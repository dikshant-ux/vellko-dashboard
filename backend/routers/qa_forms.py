from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from database import db
from models import QAForm, QAFormCreate, QAFormUpdate, User, UserRole, APIConnectionType, ApplicationPermission
from auth import get_current_user
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/admin/qa-forms", tags=["QA Forms"])

async def get_current_admin(username: str = Depends(get_current_user)):
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
    user = User(**user_data)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user

async def get_current_approver(username: str = Depends(get_current_user)):
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
    user = User(**user_data)
    # Allow if Admin/Super Admin OR if can_approve_signups is True
    if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN] or user.can_approve_signups:
        return user
    raise HTTPException(status_code=403, detail="Not authorized")

def check_permission(user: User, api_type: APIConnectionType):
    if user.role == UserRole.SUPER_ADMIN:
        return True
    
    if api_type == APIConnectionType.CAKE:
        return user.application_permission in [ApplicationPermission.WEB_TRAFFIC, ApplicationPermission.BOTH]
    elif api_type == APIConnectionType.RINGBA:
        return user.application_permission in [ApplicationPermission.CALL_TRAFFIC, ApplicationPermission.BOTH]
    
    return False

@router.get("", response_model=List[QAForm])
async def get_qa_forms(user: User = Depends(get_current_admin)):
    query = {}
    
    # Filter based on user application permission
    if user.role != UserRole.SUPER_ADMIN:
        allowed_types = []
        if user.application_permission in [ApplicationPermission.WEB_TRAFFIC, ApplicationPermission.BOTH]:
            allowed_types.append(APIConnectionType.CAKE)
        if user.application_permission in [ApplicationPermission.CALL_TRAFFIC, ApplicationPermission.BOTH]:
            allowed_types.append(APIConnectionType.RINGBA)
        
        query["api_type"] = {"$in": allowed_types}

    forms = await db.qa_forms.find(query).sort("created_at", -1).to_list(100)
    return [QAForm(**f) for f in forms]

@router.post("", response_model=QAForm)
async def create_qa_form(form_in: QAFormCreate, user: User = Depends(get_current_admin)):
    if not check_permission(user, form_in.api_type):
        raise HTTPException(status_code=403, detail="Not authorized to create forms for this API type")
        
    form_dict = form_in.dict()
    form_dict["created_by"] = user.username
    form_dict["created_at"] = datetime.utcnow()
    form_dict["status"] = "Inactive"
    
    # Questions already have IDs from model default_factory
    
    result = await db.qa_forms.insert_one(form_dict)
    form_dict["_id"] = result.inserted_id
    return QAForm(**form_dict)

@router.get("/{id}", response_model=QAForm)
async def get_qa_form(id: str, user: User = Depends(get_current_admin)):
    form = await db.qa_forms.find_one({"_id": ObjectId(id)})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    qa_form = QAForm(**form)
    if not check_permission(user, qa_form.api_type):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return qa_form

@router.put("/{id}", response_model=QAForm)
async def update_qa_form(id: str, form_in: QAFormUpdate, user: User = Depends(get_current_admin)):
    existing = await db.qa_forms.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if not check_permission(user, existing["api_type"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = form_in.dict(exclude_unset=True)
    
    # If questions are updated, ensure they have IDs if missing (shouldn't happen with Pydantic model)
    
    result = await db.qa_forms.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    updated = await db.qa_forms.find_one({"_id": ObjectId(id)})
    return QAForm(**updated)

@router.delete("/{id}")
async def delete_qa_form(id: str, user: User = Depends(get_current_admin)):
    existing = await db.qa_forms.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")
        
    if not check_permission(user, existing["api_type"]):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    await db.qa_forms.delete_one({"_id": ObjectId(id)})
    return {"message": "Form deleted successfully"}

@router.post("/{id}/activate")
async def activate_qa_form(id: str, user: User = Depends(get_current_admin)):
    existing = await db.qa_forms.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Form not found")
        
    if not check_permission(user, existing["api_type"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    api_type = existing["api_type"]
    
    # Deactivate all other forms of same type
    await db.qa_forms.update_many(
        {"api_type": api_type},
        {"$set": {"status": "Inactive"}}
    )
    
    # Activate this one
    await db.qa_forms.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": "Active"}}
    )
    
    return {"message": f"Form activated for {api_type}"}

@router.get("/active/{api_type}", response_model=Optional[QAForm])
async def get_active_qa_form(api_type: APIConnectionType, user: User = Depends(get_current_approver)):
    # Verify permission for the type
    if not check_permission(user, api_type):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    form = await db.qa_forms.find_one({"api_type": api_type, "status": "Active"})
    if not form:
        return None
        
    return QAForm(**form)
