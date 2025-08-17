import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing');
  }

  // Set up the PostgreSQL connection pool and Prisma v7 adapter
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@sautuk.com').toLowerCase();
    // Use environment password or default if not set
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'AdminPassword123!';

    console.log(`🌱 Checking for admin user: ${adminEmail}`);

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: Role.ADMIN,
        },
      });

      console.log(`✅ Admin user created successfully with ID: ${newAdmin.id}`);
    } else {
      console.log(`ℹ️ Admin user already exists. Checking roles...`);
      if (existingAdmin.role !== Role.ADMIN) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: Role.ADMIN },
        });
        console.log(`✅ Updated existing user role to ADMIN.`);
      }
    }
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    // Clean up connections
    await pool.end();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
