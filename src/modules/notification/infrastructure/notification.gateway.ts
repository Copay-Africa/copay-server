import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { NotificationService } from '../application/notification.service';
import { NotificationType } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  cooperativeId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly for production
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(private notificationService: NotificationService) {}

  afterInit(server: Server) {
    this.logger.log('Notification WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract user information from auth token or connection handshake
      const userId = this.extractUserFromSocket(client);
      
      if (!userId) {
        this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
        client.disconnect();
        return;
      }

      client.userId = userId;
      
      // Store connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      this.logger.log(`User ${userId} connected via socket ${client.id}`);
      
      // Send pending in-app notifications
      await this.sendPendingNotifications(client, userId);
      
      // Notify successful connection
      client.emit('connected', {
        message: 'Connected to notification service',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Connection error for socket ${client.id}:`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    
    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(client.id);
      
      // Remove user entry if no more connections
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    this.logger.log(`Socket ${client.id} disconnected`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { cooperativeId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!data.cooperativeId || !client.userId) {
      return { error: 'Invalid room or user data' };
    }

    client.cooperativeId = data.cooperativeId;
    await client.join(`cooperative_${data.cooperativeId}`);
    
    this.logger.log(
      `User ${client.userId} joined cooperative room ${data.cooperativeId}`,
    );

    return {
      success: true,
      message: `Joined cooperative room ${data.cooperativeId}`,
    };
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { cooperativeId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (data.cooperativeId) {
      await client.leave(`cooperative_${data.cooperativeId}`);
      
      this.logger.log(
        `User ${client.userId} left cooperative room ${data.cooperativeId}`,
      );
    }

    return {
      success: true,
      message: `Left cooperative room ${data.cooperativeId}`,
    };
  }

  @SubscribeMessage('mark_notification_read')
  async handleMarkAsRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!data.notificationId || !client.userId) {
      return { error: 'Missing notification ID or user authentication' };
    }

    try {
      await this.notificationService.markNotificationAsRead(
        data.notificationId,
        client.userId,
      );

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      this.logger.error(
        `Error marking notification as read: ${error.message}`,
      );
      return { error: 'Failed to mark notification as read' };
    }
  }

  @SubscribeMessage('get_notifications')
  async handleGetNotifications(
    @MessageBody() data: { limit?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.userId) {
      return { error: 'User not authenticated' };
    }

    try {
      const notifications = await this.notificationService.getInAppNotifications(
        client.userId,
        data.limit || 20,
      );

      return {
        success: true,
        notifications,
        count: notifications.length,
      };
    } catch (error) {
      this.logger.error(`Error fetching notifications: ${error.message}`);
      return { error: 'Failed to fetch notifications' };
    }
  }

  /**
   * Send real-time notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: {
      id: string;
      type: NotificationType;
      title: string;
      message: string;
      data?: Record<string, any>;
    },
  ) {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets && userSockets.size > 0) {
      const notificationPayload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: new Date().toISOString(),
        data: notification.data || {},
      };

      // Send to all user's connected sockets
      for (const socketId of userSockets) {
        this.server.to(socketId).emit('new_notification', notificationPayload);
      }

      this.logger.log(
        `Real-time notification sent to user ${userId} via ${userSockets.size} socket(s)`,
      );
      return true;
    }

    this.logger.debug(`User ${userId} not connected for real-time notification`);
    return false;
  }

  /**
   * Send notification to all users in a cooperative
   */
  async sendNotificationToCooperative(
    cooperativeId: string,
    notification: {
      title: string;
      message: string;
      data?: Record<string, any>;
    },
  ) {
    const roomName = `cooperative_${cooperativeId}`;
    
    const notificationPayload = {
      title: notification.title,
      message: notification.message,
      timestamp: new Date().toISOString(),
      data: notification.data || {},
      scope: 'cooperative',
    };

    this.server.to(roomName).emit('cooperative_notification', notificationPayload);
    
    this.logger.log(`Cooperative notification sent to room ${roomName}`);
  }

  /**
   * Send urgent reminder notifications with special priority
   */
  async sendUrgentReminderNotification(
    userId: string,
    reminder: {
      id: string;
      title: string;
      message: string;
      type: string;
      isOverdue: boolean;
    },
  ) {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets && userSockets.size > 0) {
      const payload = {
        ...reminder,
        timestamp: new Date().toISOString(),
        priority: reminder.isOverdue ? 'critical' : 'high',
        requiresAcknowledgment: reminder.isOverdue,
      };

      // Send to all user's connected sockets with high priority
      for (const socketId of userSockets) {
        this.server.to(socketId).emit('urgent_reminder', payload);
      }

      this.logger.log(
        `Urgent reminder notification sent to user ${userId}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Get statistics about connected users
   */
  getConnectionStats() {
    const totalConnections = Array.from(this.connectedUsers.values())
      .reduce((sum, sockets) => sum + sockets.size, 0);
    
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections,
      userConnectionsMap: Object.fromEntries(
        Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => [
          userId,
          sockets.size,
        ]),
      ),
    };
  }

  /**
   * Force disconnect a user (admin function)
   */
  async disconnectUser(userId: string) {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets) {
      for (const socketId of userSockets) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('force_disconnect', {
            reason: 'Disconnected by administrator',
          });
          socket.disconnect();
        }
      }
      
      this.connectedUsers.delete(userId);
      this.logger.log(`Force disconnected user ${userId}`);
    }
  }

  private extractUserFromSocket(socket: AuthenticatedSocket): string | null {
    try {
      // Extract from authorization header or handshake auth
      const token = socket.handshake.auth?.token || 
                   socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return null;
      }

      // In a real application, you'd verify the JWT token here
      // For now, we'll extract user ID from the token payload
      // This should use your JWT verification logic
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.userId || null;
    } catch (error) {
      this.logger.error('Error extracting user from socket:', error.message);
      return null;
    }
  }

  private async sendPendingNotifications(socket: AuthenticatedSocket, userId: string) {
    try {
      const pendingNotifications = await this.notificationService.getInAppNotifications(
        userId,
        10,
      );

      if (pendingNotifications.length > 0) {
        socket.emit('pending_notifications', {
          notifications: pendingNotifications,
          count: pendingNotifications.length,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error sending pending notifications to user ${userId}:`,
        error.message,
      );
    }
  }
}