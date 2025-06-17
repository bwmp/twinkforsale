import { db } from "./db";
import { defaultParticleConfigs, type ParticleConfig } from "~/components/particle-background";

export async function loadUserParticleConfig(userEmail: string): Promise<ParticleConfig> {
  try {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { globalParticleConfig: true },
    });

    if (user?.globalParticleConfig) {
      const parsed = JSON.parse(user.globalParticleConfig);
      return { ...defaultParticleConfigs.hearts, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to load user particle config:", error);
  }
  
  // Return default enabled hearts config
  return { ...defaultParticleConfigs.hearts, enabled: true };
}

export async function saveUserParticleConfig(userEmail: string, config: ParticleConfig): Promise<boolean> {
  try {
    await db.user.update({
      where: { email: userEmail },
      data: { globalParticleConfig: JSON.stringify(config) },
    });
    return true;
  } catch (error) {
    console.warn("Failed to save user particle config:", error);
    return false;
  }
}
