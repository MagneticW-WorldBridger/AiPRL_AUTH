import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { db } from '../db';
import { auth, users, sessions, roles } from '../db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { swagger } from '@elysiajs/swagger';

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'dev_secret',
        })
    )
    .use(bearer())
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
    .post(
        '/signup',
        async ({ body, error }) => {
            const { email, password, name } = body;

            // Check if email exists
            const existingUser = await db.select().from(auth).where(eq(auth.email, email));
            if (existingUser.length > 0) {
                return error(400, 'Email already exists');
            }

            // Hash password using Bun's native Argon2
            const passwordHash = await Bun.password.hash(password);

            // Transaction to create user, auth, and default role
            try {
                const result = await db.transaction(async (tx) => {
                    const [newUser] = await tx
                        .insert(users)
                        .values({ name })
                        .returning({ id: users.id });

                    await tx.insert(auth).values({
                        userId: newUser.id,
                        email,
                        passwordHash,
                    });

                    // Create default 'user' role
                    await tx.insert(roles).values({
                        userId: newUser.id,
                        role: 'user',
                        title: null,
                    });

                    return newUser;
                });

                return { success: true, userId: result.id };
            } catch (e) {
                return error(500, 'Failed to create user');
            }
        },
        {
            body: t.Object({
                email: t.String({ format: 'email' }),
                password: t.String({ minLength: 8 }),
                name: t.String(),
            }),
        }
    )
    .post(
        '/signin',
        async ({ body, jwt, error }) => {
            const { email, password } = body;

            const [userAuth] = await db
                .select()
                .from(auth)
                .where(eq(auth.email, email));

            if (!userAuth) {
                return error(401, 'Invalid credentials');
            }

            const isMatch = await Bun.password.verify(password, userAuth.passwordHash);
            if (!isMatch) {
                return error(401, 'Invalid credentials');
            }

            // Generate Token
            const token = await jwt.sign({
                id: userAuth.userId,
                email: userAuth.email,
            });

            // Create Stateful Session
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await db.insert(sessions).values({
                userId: userAuth.userId,
                token,
                expiresAt,
            });

            // Get user's role
            const [userRole] = await db
                .select({
                    role: roles.role,
                    title: roles.title,
                })
                .from(roles)
                .where(eq(roles.userId, userAuth.userId))
                .orderBy(desc(roles.createdAt))
                .limit(1);

            return { 
                success: true, 
                token,
                role: userRole?.role || 'user',
                title: userRole?.title || null
            };
        },
        {
            body: t.Object({
                email: t.String(),
                password: t.String(),
            }),
        }
    )
    .get('/me', async ({ bearer, error }) => {
        if (!bearer) return error(401, 'Unauthorized');

        const [session] = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.token, bearer), gt(sessions.expiresAt, new Date())));

        if (!session) return error(401, 'Unauthorized');

        const [user] = await db
            .select({
                id: users.id,
                name: users.name,
                email: auth.email,
                createdAt: users.createdAt
            })
            .from(users)
            .innerJoin(auth, eq(users.id, auth.userId))
            .where(eq(users.id, session.userId));

        return { user };
    }, {
        detail: {
            security: [{ bearerAuth: [] }]
        }
    })
    .post('/verify', async ({ bearer, error }) => {
        if (!bearer) return { valid: false };

        const [session] = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.token, bearer), gt(sessions.expiresAt, new Date())));

        return { valid: !!session };
    }, {
        detail: {
            security: [{ bearerAuth: [] }]
        }
    })
    .post('/signout', async ({ bearer }) => {
        if (!bearer) return { success: false };

        await db.delete(sessions).where(eq(sessions.token, bearer));
        return { success: true };
    }, {
        detail: {
            security: [{ bearerAuth: [] }]
        }
    })
    .get('/role', async ({ bearer, error }) => {
        if (!bearer) return error(401, 'Unauthorized');

        const [session] = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.token, bearer), gt(sessions.expiresAt, new Date())));

        if (!session) return error(401, 'Unauthorized');

        const [userRole] = await db
            .select({
                role: roles.role,
                title: roles.title,
                createdAt: roles.createdAt,
                updatedAt: roles.updatedAt,
            })
            .from(roles)
            .where(eq(roles.userId, session.userId))
            .orderBy(desc(roles.createdAt))
            .limit(1);

        if (!userRole) return error(404, 'Role not found');

        return { role: userRole.role, title: userRole.title };
    }, {
        detail: {
            security: [{ bearerAuth: [] }]
        }
    });
