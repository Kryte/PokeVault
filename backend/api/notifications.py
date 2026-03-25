from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import desc
from typing import List, Optional
from api.auth import get_current_user
from database import get_db
from models import Notification, User, Card, WishlistItem
import datetime

router = APIRouter()


class NotificationResponse:
    """Response model for notifications"""
    def __init__(self, notification):
        self.id = notification.id
        self.user_id = notification.user_id
        self.title = notification.title
        self.message = notification.message
        self.notification_type = notification.notification_type
        self.related_card_id = notification.related_card_id
        self.related_wishlist_id = notification.related_wishlist_id
        self.is_read = notification.is_read
        self.action_url = notification.action_url
        self.created_at = notification.created_at
        self.read_at = notification.read_at


@router.get("/", response_model=List[dict])
def get_notifications(
    is_read: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user notifications with optional filtering by read status."""
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )
    
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    
    notifications = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "related_card_id": n.related_card_id,
            "related_wishlist_id": n.related_wishlist_id,
            "is_read": n.is_read,
            "action_url": n.action_url,
            "created_at": n.created_at.isoformat(),
            "read_at": n.read_at.isoformat() if n.read_at else None,
        }
        for n in notifications
    ]


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.datetime.utcnow()
    db.commit()
    
    return {"status": "ok", "id": notification_id}


@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read."""
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True, "read_at": datetime.datetime.utcnow()})
    
    db.commit()
    
    return {"status": "ok", "marked_as_read": unread_count}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a notification."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"status": "ok", "id": notification_id}


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get count of unread notifications."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    
    return {"unread_count": count}


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    related_card_id: Optional[str] = None,
    related_wishlist_id: Optional[int] = None,
    action_url: Optional[str] = None,
) -> Notification:
    """Helper function to create notifications (used by other API endpoints)."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        related_card_id=related_card_id,
        related_wishlist_id=related_wishlist_id,
        action_url=action_url,
        created_at=datetime.datetime.utcnow(),
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
