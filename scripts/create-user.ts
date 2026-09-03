/**
 * Script puntual para crear (o resetear) un usuario directamente en la BD.
 * Uso: npx ts-node scripts/create-user.ts <email> <username> <password>
 * Si el usuario ya existe, solo le actualiza la contraseña.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

dotenv.config();

async function run(): Promise<void> {
  const email = (process.argv[2] || 'ruben@therevenuelabs.com').toLowerCase().trim();
  const username = process.argv[3] || 'Ruben';
  const password = process.argv[4] || 'WordWars-Temp-2026!';

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordwars';
  await mongoose.connect(uri);

  let user = await User.findOne({ email });

  if (user) {
    user.password = password; // pre-save lo hashea
    await user.save();
    console.log(`\n✅ Contraseña actualizada para usuario existente: ${user.email} (${user.username}).`);
  } else {
    user = new User({ username, email, password, elo: 1200, gamesPlayed: 0, gamesWon: 0 });
    await user.save();
    console.log(`\n✅ Usuario creado: ${email} (username: ${username}).`);
  }

  console.log(`   Contraseña: ${password}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
