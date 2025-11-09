import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Copay API')
    .setDescription(
      'Cooperative Payment System API - A multi-tenant digital payment platform for cooperatives',
    )
    .setVersion('1.0')
    .addTag('Authentication', 'JWT authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Cooperatives', 'Cooperative management endpoints')
    .addTag('Payments', 'Payment processing endpoints')
    .addTag('Transactions', 'Transaction tracking endpoints')
    .addTag('Complaints', 'Complaint management endpoints')
    .addBearerAuth(
      {
        description: 'JWT Authorization header using the Bearer scheme',
        name: 'Authorization',
        bearerFormat: 'JWT',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      },
      'defaultBearerAuth',
    )
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.copay.rw', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Customize the Swagger UI
  const customOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Copay API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
    `,
  };

  SwaggerModule.setup('docs', app, document, customOptions);
}
