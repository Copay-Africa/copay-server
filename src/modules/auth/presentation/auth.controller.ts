import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPinDto } from './dto/forgot-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { ForgotPinResponseDto } from './dto/forgot-pin-response.dto';
import { Public } from '../../../shared/decorators/auth.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone number and PIN' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request PIN reset token' })
  @ApiResponse({
    status: 200,
    description: 'Reset token sent successfully',
    type: ForgotPinResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No account found with this phone number',
  })
  @ApiResponse({
    status: 400,
    description: 'Account is not active',
  })
  async forgotPin(
    @Body() forgotPinDto: ForgotPinDto,
  ): Promise<ForgotPinResponseDto> {
    return this.authService.forgotPin(forgotPinDto);
  }

  @Public()
  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset PIN with token' })
  @ApiResponse({
    status: 200,
    description: 'PIN reset successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'PIN reset successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token or token expired',
  })
  @ApiResponse({
    status: 404,
    description: 'No account found with this phone number',
  })
  async resetPin(
    @Body() resetPinDto: ResetPinDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPin(resetPinDto);
  }
}
