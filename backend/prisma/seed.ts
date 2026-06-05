import { PrismaClient, Role, PostStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Seed Admin User
    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@sautuk.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'AdminPassword123!';

    console.log(`🌱 Checking for admin user: ${adminEmail}`);
    let admin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!admin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: Role.ADMIN,
        },
      });
      console.log(`✅ Admin user created successfully.`);
    } else {
      console.log(`ℹ️ Admin user already exists.`);
      if (admin.role !== Role.ADMIN) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { role: Role.ADMIN },
        });
        console.log(`✅ Updated existing user role to ADMIN.`);
      }
    }

    // 2. Seed Journalistic Categories
    console.log('🌱 Seeding categories...');
    const categoriesData = [
      { name: 'Climate', slug: 'climate' },
      { name: 'Politics', slug: 'politics' },
      { name: 'Geopolitics', slug: 'geopolitics' },
      { name: 'Economics', slug: 'economics' }
    ];

    const categoryMap: Record<string, string> = {};

    for (const cat of categoriesData) {
      const created = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: { name: cat.name },
        create: { name: cat.name, slug: cat.slug }
      });
      categoryMap[cat.slug] = created.id;
    }
    console.log('✅ Categories seeded successfully.');

    // 3. Seed Journalistic Tags
    console.log('🌱 Seeding tags...');
    const tagsData = [
      { name: 'Global Warming', slug: 'global-warming' },
      { name: 'Elections', slug: 'elections' },
      { name: 'Trade War', slug: 'trade-war' },
      { name: 'Monetary Policy', slug: 'monetary-policy' }
    ];

    const tagMap: Record<string, string> = {};

    for (const tag of tagsData) {
      const created = await prisma.tag.upsert({
        where: { slug: tag.slug },
        update: { name: tag.name },
        create: { name: tag.name, slug: tag.slug }
      });
      tagMap[tag.slug] = created.id;
    }
    console.log('✅ Tags seeded successfully.');

    // 4. Seed Journalistic Sample Posts
    console.log('🌱 Seeding sample posts...');
    const postsData = [
      {
        title: 'The Geopolitical Realities of Climate Capital in the Global South',
        slug: 'climate-capital-global-south',
        excerpt: 'As the transition to green energy accelerates, the flow of climate finance is reshaping alliances and economic dependencies between the Global North and developing nations.',
        content: `## The Finance Divide

Climate capital is no longer just an environmental issue—it is the new frontier of global geopolitics. At the center of this debate is the transfer of funds from historical emitters to nations bearing the brunt of ecological disruption.

> "The promised $100 billion annual climate finance target has become a symbol of broken promises rather than cooperative action."

## Key Strategic Areas

1. **Infrastructure Funding**: Developing solar grids and wind turbines in East Africa.
2. **Critical Minerals**: Access to lithium and cobalt resources in Latin America.
3. **Debt Re-structuring**: Leveraging green bonds to ease sovereign debt burdens.

![Solar panels in desert](https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=800 "Solar farm infrastructure in Kenya financed by transition bonds")

The next decade will determine whether climate capital builds cooperative global resilience or creates new forms of resource dependency.`,
        featuredImage: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=800',
        status: PostStatus.PUBLISHED,
        featured: true,
        categorySlug: 'climate',
        tagSlugs: ['global-warming']
      },
      {
        title: 'The Fragility of Democratic Institutions in the Age of Polarization',
        slug: 'democratic-institutions-polarization',
        excerpt: 'Polarization is no longer just a political disagreement; it is actively eroding the structural foundations of legislative and judicial institutions globally.',
        content: `## A Crisis of Trust

Democratic governance relies on shared norms and trust in institutional neutrality. When polarization turns every policy vote into an existential battle, the institutions themselves become targets.

> "When trust in elections and courts is compromised, democracy loses its peaceful dispute-resolution mechanism."

## Structural Pressures

- **Legislative Gridlock**: The inability to pass basic budgetary agreements.
- **Judicial politicization**: Appointment processes turning into partisan warfare.
- **Information ecosystems**: Algorithmic sorting of news feeds reinforcing tribal narratives.`,
        featuredImage: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=800',
        status: PostStatus.PUBLISHED,
        featured: true,
        categorySlug: 'politics',
        tagSlugs: ['elections']
      },
      {
        title: 'The Rise of Middle Powers in a Multipolar World Order',
        slug: 'rise-of-middle-powers',
        excerpt: 'Nations like India, Brazil, Turkey, and Saudi Arabia are leveraging their strategic positions to navigate and shape a world no longer dominated by two superpowers.',
        content: `## Navigating Between Giants

The post-Cold War unipolar era is firmly behind us. However, instead of a simple US-China bipolar contest, we are witnessing the rise of assertive middle powers.

> "Middle powers are no longer forced to choose sides; they are playing superpowers off each other to maximize national interests."

## Strategic Autonomy in Action

- **Trade Diversification**: Expanding trade ties across both eastern and western blocs.
- **Security Partnerships**: Purchasing defense equipment from multiple sources while maintaining diplomatic dialogue.
- **Regional Hegemony**: Structuring localized trade pacts in South Asia and the Middle East.`,
        featuredImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800',
        status: PostStatus.PUBLISHED,
        featured: false,
        categorySlug: 'geopolitics',
        tagSlugs: ['trade-war']
      },
      {
        title: 'De-dollarization and the Fragmentation of Global Trade Rails',
        slug: 'dedollarization-global-trade',
        excerpt: 'Central banks are quietly diversifying reserves away from the US dollar, signaling a structural fragmentation of global trade and financial settlement systems.',
        content: `## The Currency Anchor

For eighty years, the US dollar has served as the undisputed global reserve currency. But weaponization of financial sanctions has accelerated search for alternative rails.

> "Diversification is not a rapid collapse of the dollar, but a slow, irreversible fragmentation into localized settlement blocs."

## Key Macro Indicators

1. **Gold Accumulation**: Central banks in China, Poland, and Singapore purchasing record volumes of gold bullion.
2. **Bilateral Settlement**: India and Saudi Arabia executing crude oil trades in local currencies.
3. **Alternative Networks**: Rise of central bank digital currencies (CBDCs) for cross-border swap agreements.`,
        featuredImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800',
        status: PostStatus.PUBLISHED,
        featured: false,
        categorySlug: 'economics',
        tagSlugs: ['monetary-policy']
      }
    ];

    for (const post of postsData) {
      const categoryId = categoryMap[post.categorySlug];
      const tagIds = post.tagSlugs.map(slug => tagMap[slug]);

      // Check if post slug already exists
      const existingPost = await prisma.post.findUnique({
        where: { slug: post.slug }
      });

      if (!existingPost) {
        await prisma.post.create({
          data: {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            featuredImage: post.featuredImage,
            status: post.status,
            featured: post.featured,
            categoryId,
            tags: {
              create: tagIds.map(tagId => ({ tagId }))
            }
          }
        });
        console.log(`✅ Created post: ${post.title}`);
      } else {
        // Sync relations & update fields
        await prisma.post.update({
          where: { slug: post.slug },
          data: {
            excerpt: post.excerpt,
            content: post.content,
            featuredImage: post.featuredImage,
            status: post.status,
            featured: post.featured,
            categoryId,
          }
        });
        console.log(`ℹ️ Post already exists: ${post.title}`);
      }
    }

    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
