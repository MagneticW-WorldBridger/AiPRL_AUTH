import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { helmet } from 'elysia-helmet';
import { rateLimit } from 'elysia-rate-limit';
import { logger } from 'elysia-logger';
import { authRoutes } from './auth';

// Validate Environment Variables
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
for (const env of requiredEnv) {
    if (!process.env[env]) {
        console.error(`Missing required environment variable: ${env}`);
        process.exit(1);
    }
}

const app = new Elysia()
    // Global Middleware
    .use(helmet({
        contentSecurityPolicy: false
    }))
    .use(cors())
    .use(rateLimit({
        duration: 60000,
        max: 100
    }))
    .use(logger())

    // Documentation
    .use(swagger({
        documentation: {
            info: {
                title: 'Auth Microservice',
                version: '1.0.0',
                description: 'Secure authentication service using Bun, Elysia, and TigerData',
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Enter JWT token'
                    }
                }
            },
            security: [
                {
                    bearerAuth: []
                }
            ]
        },
    }))

    // Health Check
    .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

    // Routes
    .use(authRoutes)

    .listen(3000);

console.log(
    `🦊 Auth Service is running at ${app.server?.hostname}:${app.server?.port}`
);
