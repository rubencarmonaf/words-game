/**
 * Script puntual para resetear la contraseña de un usuario directamente en la BD.
 * Uso: npx ts-node scripts/reset-my-password.ts <email> <nuevaContraseña>
 * La contraseña se hashea automáticamente por el hook pre-save del modelo User.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

dotenv.config();

async function run(): Promise<void> {
  const email = (process.argv[2] || 'ruben@therevenuelabs.com').toLowerCase().trim();
  const newPassword = process.argv[3] || 'WordWars-Temp-2026!';

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordwars';
  await mongoose.connect(uri);

  const user = await User.findOne({ email });

  if (!user) {
    console.log(`\n❌ No existe ningún usuario con email "${email}".`);
    const all = await User.find({}, 'email username').lean();
    console.log('Usuarios en la BD:');
    all.forEach((u: any) => console.log(`  - ${u.email} (${u.username})`));
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = newPassword; // el hook pre-save lo hashea
  await user.save();

  console.log(`\n✅ Contraseña reseteada para ${user.email} (usuario: ${user.username}).`);
  console.log(`   Nueva contraseña temporal: ${newPassword}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Error:', err);
  process.exit(1);
});
