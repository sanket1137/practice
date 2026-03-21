export interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    readAt?: string;
    actionUrl?: string;
    referenceId?: string;
    referenceType?: string;
    createdAt: string;
}

export interface NotificationsResponse {
    items: Notification[];
    totalCount: number;
    page: number;
    pageSize: number;
}
