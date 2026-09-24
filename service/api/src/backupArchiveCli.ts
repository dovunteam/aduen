import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { createBackupOpener, createBackupSealer, readBackupKeyring } from './backupArchive.js'

let scratchDirectory: string | undefined
let plaintextFile: string | undefined
try {
  const mode = process.argv[2]
  const keyringValue = process.env.BACKUP_ENCRYPTION_KEYRING
  if (!keyringValue) throw new Error('BACKUP_ENCRYPTION_KEYRING is required.')
  const keyring = readBackupKeyring(keyringValue)
  if (mode === 'seal') {
    await pipeline(process.stdin, createBackupSealer(process.env.BACKUP_ACTIVE_KEY_ID ?? '', keyring), process.stdout)
  } else if (mode === 'open') {
    const configuredScratch = process.env.BACKUP_SCRATCH_DIR
    if (!configuredScratch || !isAbsolute(configuredScratch)) throw new Error('BACKUP_SCRATCH_DIR must be an absolute path on protected temporary storage.')
    scratchDirectory = await mkdtemp(join(configuredScratch, 'aduen-backup-'))
    plaintextFile = join(scratchDirectory, 'authenticated.dump')
    await pipeline(process.stdin, createBackupOpener(keyring), createWriteStream(plaintextFile, { flags: 'wx', mode: 0o600 }))
    await pipeline(createReadStream(plaintextFile), process.stdout)
  } else throw new Error('Usage: node dist/backupArchiveCli.js <seal|open>')
} catch (error) {
  const message = error instanceof Error && /^BACKUP_|^Usage:/u.test(error.message) ? error.message : 'Backup archive processing failed.'
  console.error(message)
  process.exitCode = 1
} finally {
  if (plaintextFile) await rm(plaintextFile, { force: true }).catch(() => undefined)
  if (scratchDirectory) await rm(scratchDirectory, { recursive: true, force: true }).catch(() => undefined)
}
