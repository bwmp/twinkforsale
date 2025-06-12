import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function seedUploadDomains() {
  // Create default top-level upload domains
  const domains = [
    { domain: 'twink.forsale', name: 'Twink For Sale (Main)', isDefault: true },
  ];

  for (const domainData of domains) {
    try {
      await db.uploadDomain.upsert({
        where: { domain: domainData.domain },
        update: {},
        create: domainData
      });
      console.log(`✓ Created/updated domain: ${domainData.domain}`);
    } catch (error) {
      console.error(`✗ Failed to create domain ${domainData.domain}:`, error);
    }
  }

  console.log('Upload domains seeding completed!');
}

seedUploadDomains()
  .catch(console.error)
  .finally(() => db.$disconnect());
