import bcrypt from 'bcryptjs';

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  process.stderr.write('[hash-password] ADMIN_PASSWORD env var is not set\n');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
process.stdout.write(hash + '\n');
