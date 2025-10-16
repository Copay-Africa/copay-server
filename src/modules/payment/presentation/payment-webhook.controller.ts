import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaymentService } from '../application/payment.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentGatewayFactory } from '../infrastructure/payment-gateway.factory';

@ApiTags('Payment Webhooks')
@Controller('webhooks/payments')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private paymentService: PaymentService,
    private paymentGatewayFactory: PaymentGatewayFactory,
  ) {}

  @Post('irembopay')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Exclude from Swagger as it's for external services
  @ApiOperation({
    summary: 'IremboPay webhook endpoint',
    description: 'Receives payment status updates from IremboPay gateway',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleIremboPayWebhook(
    @Body() webhookPayload: any,
    @Headers('x-irembopay-signature') signature: string,
  ): Promise<{ status: string; message: string }> {
    try {
      this.logger.log('Received IremboPay webhook', {
        transactionId: webhookPayload?.transaction_id,
        status: webhookPayload?.status,
      });

      // Get IremboPay gateway for verification
      const gateway = this.paymentGatewayFactory.getGateway('IREMBOPAY' as any);

      // Verify webhook signature
      if (!gateway.verifyWebhook(webhookPayload, signature)) {
        this.logger.warn('Invalid webhook signature', { signature });
        throw new BadRequestException('Invalid signature');
      }

      // Map IremboPay webhook format to our internal format
      const webhookDto: PaymentWebhookDto = {
        gatewayTransactionId: webhookPayload.transaction_id,
        status: this.mapIremboPayStatus(webhookPayload.status),
        gatewayReference: webhookPayload.reference,
        failureReason: webhookPayload.failure_reason,
        gatewayData: webhookPayload,
        signature,
      };

      // Process the webhook
      await this.paymentService.handleWebhook(webhookDto);

      this.logger.log('Webhook processed successfully', {
        transactionId: webhookPayload.transaction_id,
      });

      return {
        status: 'success',
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('Webhook processing failed', {
        error: error.message,
        stack: error.stack,
        payload: webhookPayload,
      });

      // Still return 200 to prevent webhook retries for invalid data
      if (error instanceof BadRequestException) {
        return {
          status: 'error',
          message: error.message,
        };
      }

      // For other errors, we might want the gateway to retry
      throw error;
    }
  }

  // Note: MTN, Airtel, and Bank webhooks are all handled through IremboPay
  // IremboPay acts as the unified gateway for all payment methods

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test webhook endpoint',
    description: 'Test endpoint for webhook functionality during development',
  })
  @ApiResponse({
    status: 200,
    description: 'Test webhook processed successfully',
  })
  async handleTestWebhook(
    @Body() webhookDto: PaymentWebhookDto,
  ): Promise<{ status: string; message: string }> {
    try {
      this.logger.log('Received test webhook', {
        transactionId: webhookDto.gatewayTransactionId,
      });

      // Process test webhook without signature verification
      await this.paymentService.handleWebhook(webhookDto);

      return {
        status: 'success',
        message: 'Test webhook processed successfully',
      };
    } catch (error) {
      this.logger.error('Test webhook processing failed', error);
      throw error;
    }
  }

  private mapIremboPayStatus(status: string): any {
    const statusMapping: Record<string, any> = {
      pending: 'PENDING',
      processing: 'PROCESSING',
      successful: 'COMPLETED',
      completed: 'COMPLETED',
      failed: 'FAILED',
      error: 'FAILED',
      cancelled: 'CANCELLED',
      timeout: 'FAILED',
    };

    return statusMapping[status?.toLowerCase()] || 'PENDING';
  }
}
