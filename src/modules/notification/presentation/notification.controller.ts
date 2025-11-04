import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationService } from '../application/notification.service';
import {
  NotificationResponseDto,
  InAppNotificationsResponseDto,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get('in-app')
  @ApiOperation({
    summary: 'Get in-app notifications for current user',
    description: 'Retrieve in-app notifications for the authenticated user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of notifications to return (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'In-app notifications retrieved successfully',
    type: InAppNotificationsResponseDto,
  })
  async getInAppNotifications(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<InAppNotificationsResponseDto> {
    const notifications = await this.notificationService.getInAppNotifications(
      currentUser.id,
      limit,
    );

    return { data: notifications };
  }

  @Patch('in-app/:id/read')
  @ApiOperation({
    summary: 'Mark in-app notification as read',
    description: 'Mark a specific in-app notification as read',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Notification marked as read',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markNotificationAsRead(
    @Param('id') notificationId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    await this.notificationService.markNotificationAsRead(
      notificationId,
      currentUser.id,
    );

    return { message: 'Notification marked as read' };
  }
}
