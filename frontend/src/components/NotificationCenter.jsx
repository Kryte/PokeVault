import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import * as api from '../api/client'
import { useSettings } from '../contexts/SettingsContext'
import toast from 'react-hot-toast'

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useSettings()

  // Load notifications on mount and set up polling
  useEffect(() => {
    loadNotifications()
    loadUnreadCount()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const data = await api.getNotifications(null, 0, 20)
      setNotifications(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load notifications:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const data = await api.getUnreadNotificationCount()
      setUnreadCount(data.unread_count || 0)
    } catch (e) {
      console.error('Failed to load unread count:', e)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.markNotificationAsRead(notificationId)
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ))
      await loadUnreadCount()
    } catch (e) {
      toast.error(t('errors.general') || 'Failed to mark notification as read')
    }
  }

  const handleDelete = async (notificationId) => {
    try {
      await api.deleteNotification(notificationId)
      setNotifications(notifications.filter(n => n.id !== notificationId))
      await loadUnreadCount()
    } catch (e) {
      toast.error(t('errors.general') || 'Failed to delete notification')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead()
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (e) {
      toast.error(t('errors.general') || 'Failed to mark all as read')
    }
  }

  const handleNotificationClick = (notification) => {
    if (notification.action_url) {
      window.location.href = notification.action_url
    }
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-bg-secondary transition-colors"
        title={t('notifications.title') || 'Notifications'}
      >
        <Bell size={20} className="text-text-primary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-brand-red text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-bg-secondary border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-bg-secondary border-b border-border p-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">
              {t('notifications.title') || 'Notifications'}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-brand-red hover:underline"
              >
                {t('notifications.markAllRead') || 'Mark all as read'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-4 text-center text-text-muted">
              {t('common.loading') || 'Loading...'}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-text-muted">
              {t('notifications.empty') || 'No notifications'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    notification.is_read
                      ? 'hover:bg-bg'
                      : 'bg-bg hover:bg-opacity-80 border-l-2 border-brand-red'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text-primary">
                        {notification.title}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(notification.id)
                      }}
                      className="ml-2 p-1 hover:bg-bg rounded transition-colors"
                    >
                      <X size={16} className="text-text-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close on outside click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
