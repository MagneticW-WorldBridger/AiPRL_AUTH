import { db } from '../src/db';
import { users, auth } from '../src/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function findWoodstock() {
  try {
    console.log('🔍 Buscando usuario "woodstock"...\n');

    // Buscar por nombre (case insensitive)
    const userResults = await db
      .select({
        userId: users.id,
        name: users.name,
        email: auth.email,
        passwordHash: auth.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(auth, eq(users.id, auth.userId))
      .where(ilike(users.name, '%woodstock%'));

    if (userResults.length === 0) {
      console.log('❌ No se encontró ningún usuario con "woodstock" en el nombre');
      
      // Buscar también por email
      const emailResults = await db
        .select({
          userId: users.id,
          name: users.name,
          email: auth.email,
          passwordHash: auth.passwordHash,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(auth, eq(users.id, auth.userId))
        .where(ilike(auth.email, '%woodstock%'));

      if (emailResults.length === 0) {
        console.log('❌ No se encontró ningún usuario con "woodstock" en el email');
        console.log('\n📋 Listando todos los usuarios disponibles...\n');
        
        const allUsers = await db
          .select({
            userId: users.id,
            name: users.name,
            email: auth.email,
            createdAt: users.createdAt,
          })
          .from(users)
          .innerJoin(auth, eq(users.id, auth.userId));

        if (allUsers.length === 0) {
          console.log('⚠️  No hay usuarios en la base de datos');
        } else {
          allUsers.forEach((user, index) => {
            console.log(`${index + 1}. Nombre: ${user.name || 'N/A'}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   ID: ${user.userId}`);
            console.log(`   Creado: ${user.createdAt}\n`);
          });
        }
      } else {
        console.log('✅ Usuario encontrado por email:\n');
        emailResults.forEach((user) => {
          console.log(`📧 Email: ${user.email}`);
          console.log(`👤 Nombre: ${user.name || 'N/A'}`);
          console.log(`🆔 User ID: ${user.userId}`);
          console.log(`🔐 Password Hash: ${user.passwordHash.substring(0, 20)}...`);
          console.log(`📅 Creado: ${user.createdAt}\n`);
        });
      }
    } else {
      console.log('✅ Usuario(s) encontrado(s):\n');
      userResults.forEach((user) => {
        console.log(`👤 Nombre: ${user.name}`);
        console.log(`📧 Email: ${user.email}`);
        console.log(`🆔 User ID: ${user.userId}`);
        console.log(`🔐 Password Hash: ${user.passwordHash.substring(0, 20)}...`);
        console.log(`📅 Creado: ${user.createdAt}\n`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findWoodstock();

